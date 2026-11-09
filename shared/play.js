import { createRun, gameById, progressOf, reviveRun, stepRun, TICKS_PER_SECOND } from './engine.js';
import { chooseStyle, readProfile, saveRunProgress, watchProfiles } from './progress.js';
import { drawScene } from './scenes.js';

const byId = (id) => document.getElementById(id);
const game = gameById(document.body.dataset.game);
const controls = byId('panel-text').textContent;
const field = byId('game-frame');
const canvas = byId('scene');
const ctx = canvas.getContext('2d', { alpha: false });
const overlay = byId('overlay');
const action = byId('action');
const replay = byId('replay');
const pauseButton = byId('pause');
const retry = byId('retry');
const hint = byId('game-hint');
const lives = byId('lives');
const results = byId('results');
const status = byId('save-status');
const shop = byId('shop');
const shopStatus = byId('shop-status');
const styleList = byId('style-list');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const tickMs = 1000 / TICKS_PER_SECOND;
const format = new Intl.NumberFormat();
const heartPath = 'M12 20.6 4.5 13c-4.3-4.5 2.5-10.8 7.5-5.2 5-5.6 11.8.7 7.5 5.2Z';

const defaultStyle = game.styles[0];
let equipped = defaultStyle;
let profile = { balance: 0, best: 0, owned: [defaultStyle.id], equipped: defaultStyle.id, revision: -1 };
let run = createRun(game.id, 71003);
let runId;
let phase = 'ready';
let needsPaint = true;
let lastFrame = performance.now();
let bank = 0;
let size = [0, 0];
let tap = false;
let turn = 0;
let pointer;
let lastEarned = 0;
let saving = false;
let buying = false;
const keys = new Set();
const pending = new Map();

function setText(element, value) {
  if (element.textContent !== value) element.textContent = value;
}

function renderStyleList() {
  for (const tile of styleList.children) {
    const item = game.styles.find((entry) => entry.id === tile.dataset.style);
    const button = tile.querySelector('button');
    const owned = profile.owned.includes(item.id);
    const selected = profile.equipped === item.id;
    button.disabled = buying || selected || (!owned && profile.balance < item.price);
    setText(button, selected ? 'Equipped' : owned ? 'Equip' : 'Buy · ' + item.price);
    button.setAttribute('aria-label', button.textContent + ' · ' + item.name);
    tile.classList.toggle('equipped', selected);
  }
}

function renderProfile(next) {
  if (next.revision < profile.revision) return;
  profile = next;
  equipped = game.styles.find((item) => item.id === profile.equipped) ?? defaultStyle;
  needsPaint = true;
  setText(byId('balance'), format.format(profile.balance));
  setText(byId('shop-balance'), format.format(profile.balance));
  setText(byId('best'), format.format(profile.best));
  renderStyleList();
  if (next.persistent === false && retry.hidden) setText(status, 'Progress saves for this tab.');
}

async function refreshProfile() {
  try {
    renderProfile(await readProfile(game.id));
  } catch {
    // Leave the last successful snapshot visible.
  }
}

for (const style of game.styles) {
  const tile = document.createElement('div');
  tile.className = 'style-tile';
  tile.dataset.style = style.id;
  const sample = document.createElement('div');
  sample.className = 'style-sample';
  sample.setAttribute('aria-hidden', 'true');
  style.colors.slice(0, 3).forEach((color, index) => sample.style.setProperty('--swatch-' + (index + 1), color));
  const name = document.createElement('strong');
  name.textContent = style.name;
  const button = document.createElement('button');
  button.className = 'button buy-style';
  button.type = 'button';
  button.addEventListener('click', async () => {
    if (buying) return;
    buying = true;
    renderStyleList();
    try {
      const result = await chooseStyle(game.id, style.id);
      renderProfile(result.profile);
      shopStatus.textContent = result.status === 'unaffordable' ? 'Balance changed.' : style.name + ' equipped.';
    } catch {
      shopStatus.textContent = 'Could not save this style. Try again.';
    } finally {
      buying = false;
      renderStyleList();
    }
  });
  tile.append(sample, name, button);
  styleList.append(tile);
}
renderProfile(profile);

watchProfiles((id) => {
  if (id === game.id) void refreshProfile();
});
window.addEventListener('pageshow', refreshProfile);
void refreshProfile();

async function flushProgress() {
  if (saving || !pending.size) return;
  saving = true;
  retry.hidden = true;
  try {
    while (pending.size) {
      const [id, entry] = pending.entries().next().value;
      const result = await saveRunProgress(game.id, id, entry.earned, entry.score);
      if (pending.get(id) === entry) pending.delete(id);
      renderProfile(result.profile);
    }
    status.textContent = profile.persistent ? '' : 'Progress saves for this tab.';
  } catch {
    status.textContent = 'Progress could not be saved.';
    retry.hidden = false;
  } finally {
    saving = false;
  }
}

function checkpoint() {
  if (run.earned === lastEarned) return;
  lastEarned = run.earned;
  pending.set(runId, { earned: run.earned, score: run.score });
  void flushProgress();
}

function resize() {
  if (!ctx) return;
  const { width, height } = canvas.getBoundingClientRect();
  const ratio = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.max(1, Math.round(width * ratio));
  canvas.height = Math.max(1, Math.round(height * ratio));
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  size = [width, height];
  needsPaint = true;
}

let renderedLives = -1;
function updateHud() {
  setText(byId('score'), format.format(run.score));
  setText(byId('progress'), format.format(progressOf(run)));
  const feedback = phase === 'running' && run.feedback?.until > run.tick ? run.feedback : null;
  setText(hint, feedback?.text ?? '');
  hint.classList.toggle('warn', feedback?.color === 'warn');
  if (game.freeLives && renderedLives !== run.lives) {
    renderedLives = run.lives;
    lives.setAttribute('aria-label', run.lives + ' lives left');
    lives.innerHTML = Array.from({ length: game.freeLives }, (_, index) =>
      '<svg viewBox="0 0 24 24" aria-hidden="true" class="' + (index < run.lives ? 'full' : '') +
      '"><path d="' + heartPath + '"/></svg>').join('');
  }
}

function clearInput() {
  if (pointer && field.hasPointerCapture(pointer.id)) field.releasePointerCapture(pointer.id);
  pointer = undefined;
  keys.clear();
  tap = false;
  turn = 0;
}

function activate() {
  phase = 'running';
  lastFrame = performance.now();
  bank = 0;
  clearInput();
  overlay.hidden = true;
  byId('control-note').hidden = false;
  pauseButton.hidden = false;
  field.focus({ preventScroll: true });
  updateHud();
}

function freshRun() {
  const random = crypto.getRandomValues(new Uint32Array(5));
  runId = Array.from(random.subarray(1), (part) => part.toString(16).padStart(8, '0')).join('');
  run = createRun(game.id, random[0]);
  lastEarned = 0;
  activate();
}

function showPanel(next, { title, text, label, stats = false, preview = false, again = false }) {
  phase = next;
  clearInput();
  const heading = byId('panel-title');
  heading.textContent = title;
  heading.hidden = !title;
  const description = byId('panel-text');
  description.textContent = text || '';
  description.hidden = !text;
  byId('panel-badge').hidden = !preview;
  results.hidden = !stats;
  if (stats) {
    byId('result-score').textContent = format.format(run.score);
    byId('result-coins').textContent = '+' + format.format(run.earned);
  }
  action.textContent = label;
  replay.hidden = !again;
  pauseButton.hidden = true;
  byId('control-note').hidden = true;
  overlay.dataset.phase = next;
  overlay.hidden = false;
  if (document.hasFocus() && !shop.open) action.focus({ preventScroll: true });
  needsPaint = true;
  updateHud();
}

function pause() {
  if (phase === 'running') showPanel('paused', { title: 'Paused', label: 'Resume' });
}

function finish() {
  showPanel('lost', {
    title: run.reason, label: run.revived ? 'Play again' : 'Watch ad to revive',
    stats: true, preview: !run.revived, again: !run.revived,
  });
}

const breakTitles = { orbit: 'Level 5 cleared', prism: '15 floors stacked', helix: '10 rings cleared' };
function showBreak() {
  showPanel('break', { title: breakTitles[game.id], label: 'Continue', preview: true });
}

function frame(now) {
  const elapsed = Math.max(0, Math.min(75, now - lastFrame));
  lastFrame = now;
  if (phase === 'running' && !document.hidden) {
    bank += elapsed;
    while (bank >= tickMs && !run.done && !run.breakPending) {
      const gesture = Math.max(-.44, Math.min(.44, turn));
      const arrow = Number(keys.has('right')) - Number(keys.has('left'));
      stepRun(run, { tap, turn: gesture + arrow * .061 });
      turn -= gesture;
      tap = false;
      bank -= tickMs;
    }
    checkpoint();
    updateHud();
    if (run.done) finish();
    else if (run.breakPending) showBreak();
  }
  if (size[0] && size[1] &&
      (needsPaint || phase === 'running' || (phase === 'ready' && !reducedMotion.matches))) {
    drawScene(ctx, size[0], size[1], run, reducedMotion.matches ? 0 : now, equipped);
    needsPaint = false;
  }
  requestAnimationFrame(frame);
}

if (ctx) {
  new ResizeObserver(resize).observe(field);
  resize();
  requestAnimationFrame(frame);
} else {
  action.disabled = true;
  status.textContent = 'Canvas is unavailable in this browser.';
}
lives.hidden = !game.freeLives;
updateHud();

action.addEventListener('click', () => {
  if (phase === 'paused') activate();
  else if (phase === 'break') {
    run.breakPending = false;
    activate();
  } else if (phase === 'lost' && reviveRun(run)) activate();
  else if (phase === 'ready' || phase === 'lost') freshRun();
});
replay.addEventListener('click', freshRun);
pauseButton.addEventListener('click', pause);
retry.addEventListener('click', flushProgress);
byId('styles').addEventListener('click', () => {
  pause();
  shopStatus.textContent = '';
  shop.showModal();
  void refreshProfile();
});
shop.addEventListener('click', (event) => {
  if (event.target === shop) shop.close();
});
field.addEventListener('contextmenu', (event) => event.preventDefault());
field.addEventListener('pointerdown', (event) => {
  if (phase !== 'running' || !event.isPrimary || event.button !== 0) return;
  event.preventDefault();
  if (game.id !== 'helix') {
    tap = true;
    return;
  }
  field.setPointerCapture(event.pointerId);
  pointer = { id: event.pointerId, x: event.clientX };
});
field.addEventListener('pointermove', (event) => {
  if (phase !== 'running' || pointer?.id !== event.pointerId) return;
  const delta = event.clientX - pointer.x;
  pointer.x = event.clientX;
  turn += delta * 8.2 / field.clientWidth;
});
function endPointer(event) {
  if (pointer?.id === event.pointerId) pointer = undefined;
}
field.addEventListener('pointerup', endPointer);
field.addEventListener('pointercancel', endPointer);
field.addEventListener('lostpointercapture', endPointer);

const turnKeys = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right' };
window.addEventListener('keydown', (event) => {
  if (shop.open) return;
  if (event.code === 'Escape' && ['running', 'paused'].includes(phase)) {
    if (phase === 'running') pause();
    else activate();
    return;
  }
  if (phase !== 'running' || event.target.closest?.('button, a')) return;
  if (game.id === 'helix' && turnKeys[event.code]) {
    event.preventDefault();
    keys.add(turnKeys[event.code]);
  } else if (game.id !== 'helix' && event.code === 'Space') {
    event.preventDefault();
    if (!event.repeat) tap = true;
  }
});
window.addEventListener('keyup', (event) => keys.delete(turnKeys[event.code]));
window.addEventListener('blur', pause);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) pause();
  else {
    void refreshProfile();
    void flushProgress();
  }
});
