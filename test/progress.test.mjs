import assert from 'node:assert/strict';
import test from 'node:test';
import { chooseStyle, readProfile, saveRunProgress } from '../shared/progress.js';
import { readMintCoins } from '../shared/wallet.js';

test('checkpoint retries credit only new earnings, independently per game', async () => {
  await saveRunProgress('orbit', 'one', 18, 200);
  await saveRunProgress('orbit', 'one', 18, 200);
  await saveRunProgress('orbit', 'one', 11, 100);
  await saveRunProgress('orbit', 'one', 24, 275);
  await saveRunProgress('prism', 'one', 6, 400);
  assert.equal((await readProfile('orbit')).balance, 24);
  assert.equal((await readProfile('orbit')).best, 275);
  assert.equal((await readProfile('prism')).balance, 6);
  assert.equal((await readProfile('helix')).balance, 0);
  assert.equal(await readMintCoins(), 2480);
});

test('styles cannot overspend and an owned style only costs once', async () => {
  const blocked = await chooseStyle('helix', 'mint');
  assert.equal(blocked.status, 'unaffordable');
  await saveRunProgress('helix', 'two', 19, 200);
  const purchases = await Promise.all([chooseStyle('helix', 'mint'), chooseStyle('helix', 'mint')]);
  assert.deepEqual(purchases.map((entry) => entry.status).sort(), ['bought', 'equipped']);
  await chooseStyle('helix', 'pop');
  await chooseStyle('helix', 'mint');
  const profile = await readProfile('helix');
  assert.equal(profile.balance, 7);
  assert.equal(profile.equipped, 'mint');
  assert.deepEqual(profile.owned, ['pop', 'mint']);
});
