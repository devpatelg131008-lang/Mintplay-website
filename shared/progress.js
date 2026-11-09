import { gameById } from './engine.js';

const databaseName = 'mint-play-arcade-v1';
const temporaryProfiles = new Map();
const temporaryRuns = new Map();
const listeners = new Set();
let opening;
let channel;

function gameFor(id) {
  const game = gameById(id);
  if (!game) throw new Error('Unknown game.');
  return game;
}

function initialProfile(game) {
  const first = game.styles[0].id;
  return { balance: 0, best: 0, owned: [first], equipped: first, revision: 0 };
}

function snapshot(profile, persistent) {
  return { ...profile, owned: [...profile.owned], persistent };
}

function openDatabase() {
  opening ??= new Promise((resolve) => {
    let request;
    try {
      request = globalThis.indexedDB?.open(databaseName, 1);
    } catch {
      resolve(null);
      return;
    }
    if (!request) {
      resolve(null);
      return;
    }
    let blocked = false;
    request.onupgradeneeded = () => {
      request.result.createObjectStore('profiles');
      request.result.createObjectStore('runs');
    };
    request.onsuccess = () => {
      const db = request.result;
      if (blocked) {
        db.close();
        return;
      }
      db.onversionchange = () => {
        db.close();
        opening = undefined;
      };
      resolve(db);
    };
    request.onerror = () => resolve(null);
    request.onblocked = () => {
      blocked = true;
      resolve(null);
    };
  });
  return opening;
}

export async function readProfile(id) {
  const game = gameFor(id);
  const db = await openDatabase();
  if (!db) return snapshot(temporaryProfiles.get(id) ?? initialProfile(game), false);
  return new Promise((resolve, reject) => {
    const read = db.transaction('profiles').objectStore('profiles').get(id);
    read.onsuccess = () => resolve(snapshot(read.result ?? initialProfile(game), true));
    read.onerror = () => reject(read.error);
  });
}

function emit(id) {
  for (const listener of listeners) listener(id);
}

export function watchProfiles(listener) {
  if (!channel && typeof BroadcastChannel === 'function') {
    channel = new BroadcastChannel(databaseName);
    channel.onmessage = ({ data }) => emit(data);
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (!listeners.size) {
      channel?.close();
      channel = undefined;
    }
  };
}

function updatePersistent(db, game, runId, apply) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(runId ? ['profiles', 'runs'] : ['profiles'], 'readwrite');
    const profiles = transaction.objectStore('profiles');
    const runs = runId ? transaction.objectStore('runs') : null;
    const key = [game.id, runId];
    const profile = profiles.get(game.id);
    const run = runs?.get(key);
    let remaining = run ? 2 : 1;
    let result;
    let failure;
    function onRead() {
      if (--remaining) return;
      try {
        const current = profile.result ?? initialProfile(game);
        const change = apply(current, run?.result ?? 0);
        if (change.profile !== current) profiles.put(change.profile, game.id);
        if (change.credited !== undefined) runs.put(change.credited, key);
        result = { profile: snapshot(change.profile, true), status: change.status };
      } catch (error) {
        failure = error;
        transaction.abort();
      }
    }
    profile.onsuccess = onRead;
    if (run) run.onsuccess = onRead;
    transaction.oncomplete = () => resolve(result);
    transaction.onabort = () => reject(failure ?? transaction.error ?? new Error('Could not save progress.'));
  });
}

function updateTemporary(game, runId, apply) {
  const key = game.id + ':' + runId;
  const current = temporaryProfiles.get(game.id) ?? initialProfile(game);
  const change = apply(current, temporaryRuns.get(key) ?? 0);
  temporaryProfiles.set(game.id, change.profile);
  if (change.credited !== undefined) temporaryRuns.set(key, change.credited);
  return { profile: snapshot(change.profile, false), status: change.status };
}

async function update(game, runId, apply) {
  const db = await openDatabase();
  const result = db
    ? await updatePersistent(db, game, runId, apply)
    : updateTemporary(game, runId, apply);
  if (db) channel?.postMessage(game.id);
  emit(game.id);
  return result;
}

export function saveRunProgress(id, runId, earned, score) {
  const game = gameFor(id);
  if (typeof runId !== 'string' || !runId || !Number.isSafeInteger(earned) || earned < 0 ||
      !Number.isSafeInteger(score) || score < 0) throw new Error('Invalid game progress.');
  return update(game, runId, (profile, credited) => {
    const delta = Math.max(0, earned - credited);
    const best = Math.max(profile.best, score);
    if (!delta && best === profile.best) return { profile };
    return {
      profile: { ...profile, balance: profile.balance + delta, best, revision: profile.revision + 1 },
      credited: delta ? earned : undefined,
    };
  });
}

export function chooseStyle(id, styleId) {
  const game = gameFor(id);
  const item = game.styles.find((style) => style.id === styleId);
  if (!item) throw new Error('Unknown style.');
  return update(game, null, (profile) => {
    if (profile.equipped === styleId) return { profile, status: 'equipped' };
    const owned = profile.owned.includes(styleId);
    if (!owned && profile.balance < item.price) return { profile, status: 'unaffordable' };
    return {
      profile: {
        ...profile,
        balance: profile.balance - (owned ? 0 : item.price),
        equipped: styleId,
        owned: owned ? profile.owned : [...profile.owned, styleId],
        revision: profile.revision + 1,
      },
      status: owned ? 'equipped' : 'bought',
    };
  });
}
