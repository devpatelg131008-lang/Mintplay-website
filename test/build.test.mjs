import assert from 'node:assert/strict';
import { access, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { buildSites } from '../scripts/build.mjs';

const slugs = ['orbit-pins', 'prism-stack', 'helix-drop'];

async function output(t) {
  const path = await mkdtemp(join(tmpdir(), 'mint-play-test-'));
  t.after(() => rm(path, { recursive: true, force: true }));
  return path;
}

test('the default build links all three games and contains their assets', async (t) => {
  const folder = await output(t);
  const built = await buildSites({ env: {}, output: folder });
  assert.equal(built.count, 4);
  const hub = await readFile(join(folder, 'index.html'), 'utf8');
  assert.match(hub, /Mint Coins/);
  for (const slug of slugs) {
    assert.ok(hub.includes('href="./' + slug + '/"'));
    const page = await readFile(join(folder, slug, 'index.html'), 'utf8');
    assert.match(page, /href="\.\.\//);
    assert.match(page, /id="scene"/);
    assert.doesNotMatch(page, /time left|id="timer"|mint coins/i);
    assert.doesNotMatch(page, /\{\{/);
    await access(join(folder, slug, 'assets', 'engine.js'));
    await access(join(folder, slug, 'assets', 'progress.js'));
  }
  assert.doesNotMatch(hub, /sign in|drift circuit/i);
  await assert.rejects(access(join(folder, 'drift-circuit')));
});

test('each game builds as its own site, with a configurable hub link', async (t) => {
  const folder = await output(t);
  for (const slug of slugs) {
    const built = await buildSites({
      env: { MINT_SITE: slug, MINT_HUB_URL: 'https://mint.example/' }, output: folder,
    });
    assert.equal(built.count, 1);
    const page = await readFile(join(folder, 'index.html'), 'utf8');
    assert.match(page, /href="https:\/\/mint\.example\/"/);
    await access(join(folder, 'assets', 'play.js'));
  }
});

test('the hub-only build validates and uses the three supplied game addresses', async (t) => {
  const folder = await output(t);
  const env = {
    MINT_SITE: 'hub',
    MINT_ORBIT_PINS_URL: 'https://orbit.example/',
    MINT_PRISM_STACK_URL: 'https://prism.example/',
    MINT_HELIX_DROP_URL: 'https://helix.example/',
  };
  await buildSites({ env, output: folder });
  const hub = await readFile(join(folder, 'index.html'), 'utf8');
  for (const name of ['orbit', 'prism', 'helix']) assert.ok(hub.includes('href="https://' + name + '.example/"'));
  await assert.rejects(buildSites({ env: { MINT_SITE: 'hub' }, output: folder }), /Set MINT_ORBIT_PINS_URL/);
  await assert.rejects(buildSites({ env: { ...env, MINT_ORBIT_PINS_URL: 'javascript:void(0)' }, output: folder }), /must use HTTPS/);
});
