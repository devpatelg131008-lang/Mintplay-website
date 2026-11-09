export const TICKS_PER_SECOND = 60;
export const TAU = Math.PI * 2;

export const games = [
  {
    id: 'orbit', slug: 'orbit-pins', title: 'Orbit Pins',
    currency: 'Starbits', progress: 'Level', shop: 'Pin styles', freeLives: 3,
    styles: [
      { id: 'lime', name: 'Lime Dart', price: 0, colors: ['#d9fb83', '#73a92e', '#f5ffce'] },
      { id: 'peach', name: 'Peach Rocket', price: 14, colors: ['#ff9979', '#bd4b63', '#ffebba'] },
      { id: 'sherbet', name: 'Blue Sherbet', price: 32, colors: ['#86eaf4', '#485ec9', '#e2faff'] },
      { id: 'blossom', name: 'Blossom Bolt', price: 58, colors: ['#f9ace7', '#9145c0', '#fff1fc'] },
    ],
  },
  {
    id: 'prism', slug: 'prism-stack', title: 'Prism Stack',
    currency: 'Prism Chips', progress: 'Floors', shop: 'Block palettes',
    styles: [
      { id: 'candy', name: 'Candy Mix', price: 0, colors: ['#ff8d85', '#ffc953', '#95d97a', '#68cddd', '#c0a1f2', '#ff9ac2'] },
      { id: 'coast', name: 'Pool Party', price: 12, colors: ['#54c4cf', '#8fdaaa', '#a8a9ff', '#ffbc77', '#60a7e4', '#cef17a'] },
      { id: 'orchard', name: 'Fruit Stand', price: 26, colors: ['#fe8765', '#ffca4e', '#b9df65', '#f891a5', '#eaa563', '#ffdf90'] },
      { id: 'gem', name: 'Jelly Gems', price: 48, colors: ['#b687ec', '#fc8dd7', '#f7b359', '#87a7ed', '#91e5ca', '#ed9d9f'] },
    ],
  },
  {
    id: 'helix', slug: 'helix-drop', title: 'Helix Drop',
    currency: 'Drops', progress: 'Rings', shop: 'Ball styles',
    styles: [
      { id: 'pop', name: 'Peach Pop', price: 0, colors: ['#ffdf96', '#f68969', '#9a4769'] },
      { id: 'mint', name: 'Mint Marble', price: 12, colors: ['#e0ffbc', '#67d9ac', '#327c8d'] },
      { id: 'berry', name: 'Blueberry', price: 28, colors: ['#b3e5ff', '#7891f5', '#5357aa'] },
      { id: 'sun', name: 'Sunburst', price: 50, colors: ['#fff7a5', '#ffbf58', '#c16545'] },
    ],
  },
];

export const planetStyles = [
  { name: 'Lemon Moon', sky: ['#e0e2ff', '#bfb8fa', '#ffdaf1'], body: ['#fff5ac', '#f4b96f', '#cb71a3'], ring: '#fff9d0' },
  { name: 'Bubble Tide', sky: ['#c6f5f2', '#a8cbf6', '#e8e5ff'], body: ['#e4feff', '#76d5d8', '#6675d1'], ring: '#efffff' },
  { name: 'Berry Belt', sky: ['#ffe5f6', '#e6bcec', '#b4befa'], body: ['#ffe0f6', '#ef9bdd', '#8a70d5'], ring: '#fff1fc' },
  { name: 'Kiwi Cloud', sky: ['#effbd5', '#bce9dc', '#cbdfff'], body: ['#f4ffb7', '#aedc6a', '#419c9d'], ring: '#ffffe2' },
  { name: 'Peach Nebula', sky: ['#fff2cb', '#ffcfbf', '#e7c8f4'], body: ['#fff2ac', '#ffa185', '#ca75a3'], ring: '#fff8dc' },
];

export function gameById(id) {
  return games.find((game) => game.id === id);
}

export function randomFrom(seed) {
  let value = seed >>> 0;
  return () => {
    value = (value + 0x6d2b79f5) >>> 0;
    let mixed = Math.imul(value ^ (value >>> 15), value | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

export function wrap(angle) {
  return ((angle % TAU) + TAU) % TAU;
}

function angleGap(a, b) {
  const gap = wrap(a - b);
  return Math.min(gap, TAU - gap);
}

function show(run, text, color = 'good') {
  run.feedback = { text, color, until: run.tick + 68 };
}

function fail(run, reason) {
  run.done = true;
  run.reason = reason;
}

function orbitStage(run) {
  const level = run.level;
  const last = run.planet;
  run.planet = level === 1 ? 0 : (last + 1 + Math.floor(run.random() * 4)) % planetStyles.length;
  run.angle = wrap((level === 1 ? 0 : run.random()) * TAU);
  run.direction = level % 2 ? 1 : -1;
  run.stageTick = 0;
  run.remaining = 4 + Math.min(3, Math.floor((level - 1) / 2));
  const anchors = 1 + Math.min(4, Math.floor((level - 1) / 2));
  run.pins = Array.from({ length: anchors }, (_, index) => ({
    angle: index * TAU / anchors + .3, anchor: true,
  }));
  run.shot = 0;
  run.transition = 0;
  run.cooldown = 0;
  run.star = wrap(2.7 + run.random() * 1.5);
}

function orbitVelocity(run, future = 0) {
  const progress = run.stageTick + future;
  const speed = Math.min(2.22, .98 + run.level * .13) / TICKS_PER_SECOND;
  const wave = Math.sin(progress / 52);
  const pattern = (run.level - 1) % 4;
  const multiplier = pattern === 0 ? 1 : pattern === 1 ? 1 + wave * .36
    : pattern === 2 ? (Math.floor(progress / 155) % 2 ? -.78 : 1)
      : 1 + Math.max(0, Math.sin(progress / 27)) * .42;
  return run.direction * speed * multiplier;
}

export const SHOT_TICKS = 12;

export function orbitAim(run) {
  let predicted = run.angle;
  for (let i = 1; i <= SHOT_TICKS; i++) predicted += orbitVelocity(run, i);
  return wrap(Math.PI / 2 - predicted);
}

function updateOrbit(run, tap) {
  if (run.transition) {
    if (--run.transition === 0) {
      run.level++;
      orbitStage(run);
      if (run.level === 6) run.breakPending = true;
      show(run, planetStyles[run.planet].name);
    }
    return;
  }
  run.stageTick++;
  run.angle = wrap(run.angle + orbitVelocity(run));
  if (run.cooldown > 0) run.cooldown--;
  if (run.shot > 0 && --run.shot === 0) {
    const angle = wrap(Math.PI / 2 - run.angle);
    if (run.pins.some((pin) => angleGap(pin.angle, angle) < .18)) {
      run.lives--;
      run.streak = 0;
      run.cooldown = 24;
      run.impactTick = run.tick;
      if (run.lives === 0) fail(run, 'Out of lives');
      else show(run, 'Pin collision', 'warn');
      return;
    }

    run.pins.push({ angle, anchor: false });
    run.impactTick = run.tick;
    run.landed++;
    run.streak++;
    run.score += 15 + Math.min(25, (run.streak - 1) * 3);
    run.earned++;
    if (run.star !== null && angleGap(run.star, angle) < .32) {
      run.score += 30;
      run.earned += 3;
      run.star = null;
      show(run, 'Star hit +3');
    } else if (run.streak % 3 === 0) {
      run.earned += 2;
      show(run, 'Streak ×' + run.streak);
    }
    if (--run.remaining === 0) {
      run.score += 100 + run.level * 10;
      run.earned += 5;
      run.transition = 46;
      show(run, 'Planet cleared +5');
    }
  }
  if (tap && !run.transition && !run.shot && !run.cooldown) run.shot = SHOT_TICKS;
}

const DROP_TICKS = 9;
export function currentPiece(run) {
  const top = run.blocks.at(-1);
  return { x: run.x, w: top.w, floor: run.floors + 1 };
}

function placePrism(run, piece) {
  const top = run.blocks.at(-1);
  const offset = piece.x - top.x;
  if (Math.abs(offset) <= Math.min(.035, piece.w * .34)) {
    piece.x = top.x;
    run.streak++;
    run.score += 55 + Math.min(50, (run.streak - 1) * 10);
    run.earned += 2;
    show(run, run.streak > 1 ? 'Perfect ×' + run.streak : 'Perfect');
  } else {
    const left = Math.max(top.x, piece.x);
    const right = Math.min(top.x + top.w, piece.x + piece.w);
    run.streak = 0;
    if (right <= left) {
      run.debris = { ...piece, direction: Math.sign(offset), born: run.tick };
      fail(run, 'Missed the stack');
      return;
    }
    run.debris = {
      ...piece, x: offset < 0 ? piece.x : right,
      w: piece.w - (right - left), direction: Math.sign(offset), born: run.tick,
    };
    piece.x = left;
    piece.w = right - left;
  }
  run.blocks.push(piece);
  if (run.blocks.length > 34) run.blocks.shift();
  run.floors++;
  run.score += 100;
  run.earned += 2;
  if (run.floors % 5 === 0) {
    run.earned += 5;
    if (run.streak === 0) show(run, run.floors + ' floors +5');
  }
  run.direction *= -1;
  run.x = run.direction === 1 ? .055 : .945 - piece.w;
  if (run.floors === 15) run.breakPending = true;
}

function updateStack(run, tap) {
  run.camera += (run.floors - run.camera) * .11;
  if (run.drop) {
    if (--run.drop.left === 0) {
      placePrism(run, run.drop.piece);
      run.drop = null;
    }
    return;
  }
  if (tap) {
    run.drop = { piece: currentPiece(run), left: DROP_TICKS, total: DROP_TICKS };
    return;
  }
  const piece = currentPiece(run);
  run.x += run.direction * Math.min(.0091, .0047 + run.floors * .00020);
  const min = .035;
  const max = .965 - piece.w;
  if (run.x < min || run.x > max) {
    run.x = Math.max(min, Math.min(max, run.x));
    run.direction *= -1;
  }
}

function makeRing(run, index, previous) {
  const center = previous ? wrap(previous.center + (run.random() < .5 ? -1 : 1) * (.56 + run.random() * 2.02))
    : Math.PI / 2 + (run.random() < .5 ? -1 : 1) * 1.55;
  return {
    index, center, gap: Math.max(1.36, 2.53 - index * .072),
    danger: index < 3 ? 0 : .44 + Math.min(.42, index * .019),
    dangerCenter: wrap(center + Math.PI + (run.random() - .5) * .7),
  };
}

function fillRings(run) {
  while (run.rings.length < 8) {
    const previous = run.rings.at(-1);
    run.rings.push(makeRing(run, previous ? previous.index + 1 : run.ring, previous));
  }
}

export function ringSurface(ring, localAngle) {
  if (angleGap(ring.center, localAngle) < ring.gap / 2 - .055) return 'gap';
  if (ring.danger && angleGap(ring.dangerCenter, localAngle) < ring.danger / 2 + .027) return 'danger';
  return 'solid';
}

function updateHelix(run, turn) {
  run.rotation = wrap(run.rotation + Math.max(-.55, Math.min(.55, turn)));
  run.speed = Math.min(.14, run.speed + .0027);
  run.depth += run.speed;
  run.camera += (run.ring - run.camera) * .115;
  if (run.speed <= 0 || run.depth < run.ring) return;

  const ring = run.rings[0];
  const surface = ringSurface(ring, Math.PI / 2 - run.rotation);
  if (surface === 'gap') {
    run.rings.shift();
    run.ring++;
    run.streak++;
    run.earned += 3 + Math.min(3, run.streak - 1);
    run.score += 30 + Math.min(75, (run.streak - 1) * 15);
    run.impactTick = run.tick;
    if (run.streak >= 2) show(run, run.streak + '-ring combo');
    fillRings(run);
    if (run.ring === 10) run.breakPending = true;
  } else {
    run.depth = run.ring;
    run.impactTick = run.tick;
    run.streak = 0;
    if (surface === 'danger') fail(run, 'Hit a striped tile');
    else run.speed = -.066;
  }
}

export function createRun(id, seed) {
  if (!gameById(id) || !Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) {
    throw new Error('Invalid game or seed.');
  }
  const run = {
    id, tick: 0, score: 0, earned: 0, streak: 0, impactTick: -100,
    done: false, revived: false, breakPending: false, reason: '',
    random: randomFrom(seed), feedback: null,
  };
  if (id === 'orbit') {
    Object.assign(run, { level: 1, landed: 0, lives: gameById(id).freeLives });
    orbitStage(run);
  } else if (id === 'prism') {
    Object.assign(run, {
      blocks: [{ x: .225, w: .55, floor: 0 }], floors: 0,
      x: .055, direction: 1, camera: 0, drop: null, debris: null,
    });
  } else {
    Object.assign(run, { rings: [], ring: 0, rotation: 0, depth: -.78, camera: 0, speed: 0 });
    fillRings(run);
  }
  return run;
}

export function progressOf(run) {
  if (run.id === 'orbit') return run.level;
  if (run.id === 'prism') return run.floors;
  return run.ring;
}

export function stepRun(run, { tap = false, turn = 0 } = {}) {
  if (run.done || run.breakPending) return run;
  run.tick++;
  if (run.id === 'orbit') updateOrbit(run, tap);
  else if (run.id === 'prism') updateStack(run, tap);
  else updateHelix(run, turn);
  return run;
}

export function reviveRun(run) {
  if (!run.done || run.revived) return false;
  run.done = false;
  run.revived = true;
  run.reason = '';
  if (run.id === 'orbit') {
    run.lives = 1;
    run.cooldown = 10;
  } else if (run.id === 'prism') {
    run.x = run.blocks.at(-1).x;
    run.debris = null;
  } else {
    run.rotation = wrap(Math.PI / 2 - run.rings[0].center);
    run.depth = run.ring - .82;
    run.speed = 0;
  }
  show(run, 'Revived');
  return true;
}
