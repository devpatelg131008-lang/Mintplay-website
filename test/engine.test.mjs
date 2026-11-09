import assert from 'node:assert/strict';
import test from 'node:test';
import { createRun, orbitAim, reviveRun, SHOT_TICKS, stepRun, wrap } from '../shared/engine.js';

function advance(run, ticks) {
  for (let i = 0; i < ticks; i++) stepRun(run);
}

function fire(run) {
  stepRun(run, { tap: true });
  advance(run, SHOT_TICKS);
}

function drop(run, left) {
  run.x = left;
  stepRun(run, { tap: true });
  advance(run, 9);
}

test('free play has no elapsed-time end in any game', () => {
  for (const game of ['orbit', 'prism', 'helix']) {
    const run = createRun(game, 123);
    advance(run, 60 * 60 * 6);
    assert.equal(run.done, false, game);
    assert.equal(run.tick, 21600);
    assert.equal(run.score, 0);
  }
});

test('Orbit Pins consumes three hearts, then allows one preview revive', () => {
  const run = createRun('orbit', 95);
  fire(run);
  assert.equal(run.landed, 1);
  assert.ok(run.earned >= 1);
  for (const remaining of [2, 1, 0]) {
    advance(run, 24);
    run.pins = [{ angle: orbitAim(run), anchor: true }];
    fire(run);
    assert.equal(run.lives, remaining);
    assert.equal(run.done, remaining === 0);
  }
  const score = run.score;
  assert.equal(reviveRun(run), true);
  assert.equal(run.score, score);
  assert.equal(run.lives, 1);
  advance(run, 24);
  run.pins = [{ angle: orbitAim(run), anchor: true }];
  fire(run);
  assert.equal(run.done, true);
  assert.equal(reviveRun(run), false);
});

test('Orbit Pins rotates through different worlds and breaks after completing Level 5', () => {
  const run = createRun('orbit', 2796);
  const worlds = new Set([run.planet]);
  for (let attempt = 0; !run.breakPending && attempt < 50000; attempt++) {
    const aim = orbitAim(run);
    const clear = run.pins.every((pin) => Math.cos(pin.angle - aim) < Math.cos(.24));
    stepRun(run, { tap: clear && !run.shot });
    worlds.add(run.planet);
  }
  assert.ok(run.breakPending);
  assert.ok(worlds.size >= 3);
  assert.equal(run.level, 6);
  assert.equal(run.lives, 3);
  const tick = run.tick;
  advance(run, 120);
  assert.equal(run.tick, tick);
  run.breakPending = false;
  advance(run, 120);
  assert.equal(run.tick, tick + 120);
});

test('Prism Stack snaps perfect drops and cuts only the horizontal overhang', () => {
  const run = createRun('prism', 123);
  drop(run, .232);
  const perfect = run.blocks.at(-1);
  assert.equal(perfect.x, .225);
  assert.equal(perfect.w, .55);
  assert.equal(run.earned, 4);
  drop(run, .455);
  const cut = run.blocks.at(-1);
  assert.equal(cut.x, .455);
  assert.ok(Math.abs(cut.w - .32) < 1e-8);
  assert.ok(Math.abs(run.debris.w - .23) < 1e-8);
  assert.deepEqual(Object.keys(cut).sort(), ['floor', 'w', 'x']);
  drop(run, .055);
  assert.equal(run.done, true);
  assert.equal(run.floors, 2);
  assert.equal('lives' in run, false);
  assert.equal(reviveRun(run), true);
  drop(run, .455);
  assert.equal(run.floors, 3);
});

test('Prism Stack offers its break only at the first 15-floor milestone', () => {
  const run = createRun('prism', 123);
  for (let i = 0; i < 15; i++) drop(run, .225);
  assert.equal(run.floors, 15);
  assert.equal(run.breakPending, true);
  run.breakPending = false;
  drop(run, .225);
  assert.equal(run.floors, 16);
  assert.equal(run.breakPending, false);
});

function alignRing(run, angle) {
  const target = wrap(Math.PI / 2 - angle);
  let difference = wrap(target - run.rotation + Math.PI) - Math.PI;
  while (Math.abs(difference) > .53) {
    stepRun(run, { turn: Math.sign(difference) * .53 });
    difference = wrap(target - run.rotation + Math.PI) - Math.PI;
  }
  stepRun(run, { turn: difference });
}

function meetRing(run) {
  run.depth = run.ring - .012;
  run.speed = .04;
  stepRun(run);
}

test('Helix Drop bounces on safe platforms, clears gaps, and only loses on danger', () => {
  const run = createRun('helix', 4409);
  meetRing(run);
  assert.equal(run.ring, 0);
  assert.ok(run.speed < 0);
  for (let i = 0; i < 3; i++) {
    run.depth = run.ring - .78;
    run.speed = 0;
    alignRing(run, run.rings[0].center);
    meetRing(run);
    assert.equal(run.ring, i + 1);
  }
  assert.ok(run.earned >= 9);
  const currency = run.earned;
  run.depth = run.ring - .78;
  run.speed = 0;
  alignRing(run, run.rings[0].dangerCenter);
  meetRing(run);
  assert.equal(run.done, true);
  assert.equal('lives' in run, false);
  assert.equal(reviveRun(run), true);
  assert.equal(run.earned, currency);
  meetRing(run);
  assert.equal(run.ring, 4);
});

test('Helix Drop keeps generating rings beyond the first milestone', () => {
  const run = createRun('helix', 406);
  for (let i = 0; i < 65; i++) {
    run.depth = run.ring - .78;
    run.speed = 0;
    alignRing(run, run.rings[0].center);
    meetRing(run);
    assert.equal(run.ring, i + 1);
    assert.equal(run.rings.length, 8);
    assert.equal(run.breakPending, i === 9);
    run.breakPending = false;
  }
});
