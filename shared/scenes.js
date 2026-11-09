import { currentPiece, orbitAim, planetStyles, randomFrom, ringSurface, SHOT_TICKS, TAU } from './engine.js';

function linear(ctx, x0, y0, x1, y1, colors) {
  const gradient = ctx.createLinearGradient(x0, y0, x1, y1);
  colors.forEach((color, index) => gradient.addColorStop(index / (colors.length - 1), color));
  return gradient;
}

function radial(ctx, x, y, radius, colors) {
  const gradient = ctx.createRadialGradient(x - radius * .26, y - radius * .36, 0, x, y, radius * 1.12);
  colors.forEach((color, index) => gradient.addColorStop(index / (colors.length - 1), color));
  return gradient;
}

function disk(ctx, x, y, radius, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, TAU);
  ctx.fill();
}

function ellipse(ctx, x, y, rx, ry, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
  ctx.fill();
}

function rectangle(ctx, x, y, w, h, radius, color) {
  if (w <= 0 || h <= 0) return;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, Math.min(radius, w / 2, h / 2));
  ctx.fillStyle = color;
  ctx.fill();
}

function sparkle(ctx, x, y, radius, color) {
  ctx.beginPath();
  for (let n = 0; n < 8; n++) {
    const angle = n * Math.PI / 4;
    const size = n % 2 ? radius * .27 : radius;
    ctx.lineTo(x + Math.cos(angle) * size, y + Math.sin(angle) * size);
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

const starRandom = randomFrom(80421);
const dust = Array.from({ length: 67 }, () => [starRandom(), starRandom(), starRandom()]);
const paletteRandom = randomFrom(97501);
const hills = Array.from({ length: 19 }, (_, i) => ({
  x: i / 18, h: paletteRandom(), color: paletteRandom(),
}));

function speckles(ctx, w, h, now, light = '#ffffff', dark = '#8b6ed0') {
  for (const [x, y, tone] of dust) {
    const dx = (x * w + Math.sin(now / 5800 + y * 9) * (8 + tone * 12) + w) % w;
    const dy = y * h + Math.cos(now / 4100 + x * 5) * 5;
    ctx.globalAlpha = .22 + tone * .53;
    if (tone > .89) sparkle(ctx, dx, dy, 3 + tone * 4, light);
    else disk(ctx, dx, dy, .65 + tone * 1.45, tone > .43 ? light : dark);
  }
  ctx.globalAlpha = 1;
}

function spray(ctx, x, y, elapsed, color, spread = 1) {
  if (elapsed < 0 || elapsed > 28) return;
  ctx.save();
  ctx.globalAlpha = 1 - elapsed / 29;
  for (let i = 0; i < 10; i++) {
    const angle = i * 2.399 + x;
    const distance = (10 + (i % 4) * 6 + elapsed * 1.55) * spread;
    const px = x + Math.cos(angle) * distance;
    const py = y + Math.sin(angle) * distance + elapsed * .35;
    if (i % 3 === 0) sparkle(ctx, px, py, 5 - elapsed * .08, color);
    else disk(ctx, px, py, 1.4 + (i % 3), color);
  }
  ctx.restore();
}

function ringStroke(ctx, x, y, rx, ry, start, end, width, color, tilt) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, tilt, start, end);
  ctx.lineWidth = width;
  ctx.strokeStyle = color;
  ctx.stroke();
}

function drawDart(ctx, x, y, angle, length, colors) {
  const [body, edge, light] = colors;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(length * .22, -length * .24, length * .52, -length * .15);
  ctx.lineTo(length * .84, -length * .23);
  ctx.lineTo(length * .76, 0);
  ctx.lineTo(length * .84, length * .23);
  ctx.lineTo(length * .52, length * .15);
  ctx.quadraticCurveTo(length * .22, length * .24, 0, 0);
  ctx.closePath();
  ctx.fillStyle = linear(ctx, 0, -length * .21, 0, length * .21, [light, body, edge]);
  ctx.fill();
  ctx.lineWidth = 1.3;
  ctx.strokeStyle = edge;
  ctx.stroke();
  disk(ctx, length * .33, 0, length * .068, light);
  ctx.restore();
}

function paintPlanet(ctx, x, y, radius, planet, angle) {
  ellipse(ctx, x + 1, y + radius * .84, radius * .93, radius * .22, '#6559a02d');
  ringStroke(ctx, x, y, radius * 1.57, radius * .38, Math.PI, TAU, radius * .14, '#7e68aa43', -.25);
  ringStroke(ctx, x, y - 2, radius * 1.57, radius * .38, Math.PI, TAU, radius * .078, planet.ring, -.25);
  disk(ctx, x, y, radius, radial(ctx, x, y, radius, planet.body));

  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, TAU);
  ctx.clip();
  ctx.translate(x, y);
  ctx.rotate(angle * .58);
  for (let band = -3; band < 4; band++) {
    const dy = band * radius * .29;
    ctx.beginPath();
    ctx.moveTo(-radius * 1.25, dy);
    ctx.bezierCurveTo(-radius * .27, dy - radius * .28, radius * .34, dy + radius * .23, radius * 1.25, dy - radius * .08);
    ctx.lineWidth = radius * (band % 2 ? .10 : .045);
    ctx.strokeStyle = band % 2 ? '#fff9' : '#6852ae31';
    ctx.stroke();
  }
  for (const [dx, dy, size] of [[-.43, -.34, .15], [.36, .38, .23], [.17, -.52, .08], [-.18, .61, .10]]) {
    ellipse(ctx, dx * radius, dy * radius, size * radius, size * radius * .52, '#fff6');
  }
  ctx.restore();
  ringStroke(ctx, x, y, radius * 1.57, radius * .38, 0, Math.PI, radius * .13, '#8c72aa52', -.25);
  ringStroke(ctx, x, y - 2, radius * 1.57, radius * .38, 0, Math.PI, radius * .076, planet.ring, -.25);
  ringStroke(ctx, x - 2, y - 2, radius * .96, radius * .96, 3.38, 4.89, 1.8, '#fff9', 0);
}

function orbit(ctx, w, h, run, now, style) {
  const planet = planetStyles[run.planet];
  ctx.fillStyle = linear(ctx, 0, 0, w * .34, h, planet.sky);
  ctx.fillRect(0, 0, w, h);
  speckles(ctx, w, h, now);
  const x = w / 2;
  const y = h * .405;
  const launchY = h * .83;
  const radius = Math.min(w * .224, h * .215, 118) * (run.transition ? 1 + Math.sin(run.transition / 46 * Math.PI) * .065 : 1);

  for (let i = 0; i < 3; i++) {
    const rx = w * (.27 + i * .068);
    ringStroke(ctx, x, y + 2, rx, h * (.21 + i * .051), 0, TAU, 1, '#fff7', -.23);
  }
  const t = now * .00035;
  disk(ctx, w * .17 + Math.cos(t) * 11, h * .26, Math.min(w * .052, 34), '#fff9');
  ellipse(ctx, w * .87, h * .65 + Math.sin(t) * 12, Math.min(w * .088, 51), Math.min(w * .049, 28), '#fff7');
  sparkle(ctx, w * .82, h * .23, 12, '#fff9');
  sparkle(ctx, w * .14, h * .68, 9, '#fff9');

  const safe = run.level > 2 || !run.pins.some((pin) => Math.cos(pin.angle - orbitAim(run)) > Math.cos(.18));
  ctx.beginPath();
  ctx.setLineDash([3, 7]);
  ctx.moveTo(x, y + radius + 3);
  ctx.lineTo(x, launchY);
  ctx.lineWidth = 2;
  ctx.strokeStyle = safe ? '#fff9' : '#ae426b85';
  ctx.stroke();
  ctx.setLineDash([]);
  paintPlanet(ctx, x, y, radius, planet, run.angle);

  if (run.star !== null) {
    const a = run.star + run.angle;
    const px = x + Math.cos(a) * (radius + 9);
    const py = y + Math.sin(a) * (radius + 9);
    disk(ctx, px, py, 13 + Math.sin(now / 190) * 2, '#fff2a980');
    sparkle(ctx, px, py, 10, '#fff6a0');
    sparkle(ctx, px, py, 4, '#ffffff');
  }
  for (const pin of run.pins) {
    const a = pin.angle + run.angle;
    drawDart(ctx, x + Math.cos(a) * radius * .96, y + Math.sin(a) * radius * .96, a,
      Math.max(21, radius * .36), pin.anchor ? ['#e4caef', '#775e9c', '#fff0fb'] : style.colors);
  }

  ellipse(ctx, x, launchY + 31, 30, 6, '#62549a3a');
  rectangle(ctx, x - 26, launchY + 18, 52, 9, 6, '#ffffffa0');
  rectangle(ctx, x - 18, launchY + 16, 36, 5, 3, style.colors[1]);
  if (!run.transition && !run.done) {
    const shot = run.shot ? (1 - run.shot / SHOT_TICKS) : 0;
    const py = launchY - (launchY - y - radius) * shot;
    if (shot) {
      ctx.fillStyle = linear(ctx, x, py, x, py + 26, ['#fffffff0', '#ffffff00']);
      ctx.fillRect(x - 2, py, 4, 26);
    }
    if (!run.cooldown) drawDart(ctx, x, py - (shot ? 0 : 10), Math.PI / 2, 31, style.colors);
  }
  spray(ctx, x, y + radius, run.tick - run.impactTick,
    run.cooldown || run.done ? '#ba4978' : '#fffadd');
  if (run.transition) spray(ctx, x, y, 46 - run.transition, '#fffbe1', 2.1);

  const spacing = 15;
  const first = x - (run.remaining - 1) * spacing / 2;
  for (let i = 0; i < run.remaining; i++) disk(ctx, first + i * spacing, h * .944, 3.4, '#514479b2');
}

function cloud(ctx, x, y, scale, color) {
  ellipse(ctx, x, y, scale * 1.45, scale * .34, color);
  ellipse(ctx, x - scale * .38, y - scale * .18, scale * .66, scale * .44, color);
  ellipse(ctx, x + scale * .29, y - scale * .25, scale * .61, scale * .54, color);
}

function mix(a, b, factor) {
  const channel = (offset) => Math.round(
    parseInt(a.slice(offset, offset + 2), 16) * (1 - factor) +
    parseInt(b.slice(offset, offset + 2), 16) * factor,
  );
  return 'rgb(' + [channel(1), channel(3), channel(5)].join(',') + ')';
}

const towerSkies = [
  ['#93dff4', '#fff2b6', '#b6e5b4', '#74cbbd'],
  ['#b7b7fa', '#ffdec6', '#f5b7cb', '#acbce9'],
  ['#ffbeca', '#fff2a9', '#f8cd92', '#f4ad9a'],
  ['#98e2d9', '#ffecc2', '#a9d6eb', '#8dd7b4'],
];

function towerScenery(ctx, w, h, camera, now) {
  const sequence = camera / 8;
  const index = Math.floor(sequence) % towerSkies.length;
  const next = towerSkies[(index + 1) % towerSkies.length];
  const colors = towerSkies[index].map((color, i) => mix(color, next[i], sequence % 1));
  ctx.fillStyle = linear(ctx, 0, 0, 0, h, colors.slice(0, 2));
  ctx.fillRect(0, 0, w, h);
  disk(ctx, w * .8, h * .22, Math.min(w * .112, 73), '#fff0a8');
  disk(ctx, w * .8, h * .22, Math.min(w * .089, 56), '#fff8cf');
  for (let i = 0; i < 7; i++) {
    const scale = 21 + (i % 4) * 10;
    const x = ((w * (i / 6) + now / (220 + i * 24)) % (w + 2 * scale)) - scale;
    cloud(ctx, x, h * (.15 + i % 4 * .125) + Math.sin(camera * .25 + i) * 11,
      scale, i % 2 ? '#fffaf0c9' : '#ffffff9f');
  }
  ctx.fillStyle = colors[2];
  ctx.beginPath();
  ctx.moveTo(0, h);
  ctx.lineTo(0, h * .75);
  ctx.bezierCurveTo(w * .2, h * .45, w * .30, h * .96, w * .56, h * .78);
  ctx.bezierCurveTo(w * .77, h * .59, w * .90, h * .56, w, h * .69);
  ctx.lineTo(w, h);
  ctx.fill();
  ctx.fillStyle = colors[3];
  ctx.beginPath();
  ctx.moveTo(0, h * .88);
  ctx.bezierCurveTo(w * .20, h * .73, w * .32, h * .95, w * .65, h * .865);
  ctx.quadraticCurveTo(w * .84, h * .765, w, h * .85);
  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.fill();
  for (const shrub of hills) {
    const x = shrub.x * w;
    const y = h * (.95 - shrub.h * .06);
    const radius = 4 + 15 * shrub.h;
    disk(ctx, x, y, radius, shrub.color > .55 ? '#eef8ba' : '#ffffff71');
    if (shrub.h > .62) sparkle(ctx, x, y - radius * .4, radius * .49, '#fffcee');
  }
  speckles(ctx, w, h * .74, now, '#fffbe7', '#76a9c780');
}

function prismBlock(ctx, x, y, w, h, color, ghost = false) {
  rectangle(ctx, x, y, w, h, 5, color);
  rectangle(ctx, x, y, w, h, 5, ghost ? '#ffffff24' : linear(ctx, x, y, x, y + h, ['#ffffff40', '#ffffff00', '#563b5a20']));
  if (w > 12) {
    rectangle(ctx, x + 4, y + 3, w - 8, 2, 2, '#ffffff8a');
    rectangle(ctx, x + 4, y + h - 4, w - 8, 2, 2, '#593e5b23');
  }
  if (w > 66) {
    const center = x + w / 2;
    sparkle(ctx, center, y + h * .52, h * .24, '#ffffff9e');
    disk(ctx, center - 11, y + h * .52, 1.4, '#ffffff80');
    disk(ctx, center + 11, y + h * .52, 1.4, '#ffffff80');
  }
}

function stack(ctx, w, h, run, now, style) {
  towerScenery(ctx, w, h, run.camera, now);
  const board = Math.min(w - 25, 563);
  const margin = (w - board) / 2;
  const row = Math.max(20, Math.min(31, board * .077));
  const camera = Math.max(0, run.camera - 4);
  const bottom = h * .865;
  const rowY = (floor) => bottom - (floor - camera) * row;
  const top = run.blocks.at(-1);
  const next = run.drop?.piece ?? currentPiece(run);
  const floorY = rowY(next.floor);
  const lift = run.drop ? run.drop.left / run.drop.total : 1;
  const pieceY = floorY - lift * row * 1.65;
  const color = (floor) => style.colors[floor % style.colors.length];
  ellipse(ctx, w / 2, bottom + row - 1, board * .36, row * .28, '#437f7640');

  for (const block of run.blocks) {
    const y = rowY(block.floor);
    if (y > h) continue;
    prismBlock(ctx, margin + block.x * board, y, block.w * board, row - 1, color(block.floor));
  }

  if (!run.done) {
    const left = margin + top.x * board;
    const right = left + top.w * board;
    ctx.beginPath();
    ctx.setLineDash([3, 4]);
    ctx.moveTo(left, floorY + row * .9);
    ctx.lineTo(left, floorY - row * 1.75);
    ctx.moveTo(right, floorY + row * .9);
    ctx.lineTo(right, floorY - row * 1.75);
    ctx.strokeStyle = '#41375f56';
    ctx.lineWidth = 1.3;
    ctx.stroke();
    ctx.setLineDash([]);
    if (run.floors < 4) {
      ctx.strokeStyle = '#fff9';
      ctx.lineWidth = 1.4;
      ctx.strokeRect(left, floorY + 1, Math.max(0, right - left), row - 2);
    }
    prismBlock(ctx, margin + next.x * board, pieceY, next.w * board, row - 1, color(next.floor), !run.drop);
  }

  if (run.debris) {
    const block = run.debris;
    const age = run.tick - block.born;
    if (age < 39) {
      const x = margin + block.x * board + age * block.direction * .91 + block.w * board / 2;
      const y = rowY(block.floor) + age * age * .12;
      ctx.save();
      ctx.translate(x, y + row / 2);
      ctx.rotate(age * .044 * block.direction);
      ctx.globalAlpha = 1 - age / 43;
      prismBlock(ctx, -block.w * board / 2, -row / 2, block.w * board, row - 1, color(block.floor));
      ctx.restore();
    }
  }
  if (run.streak && run.feedback?.until > run.tick) {
    spray(ctx, margin + (top.x + top.w * .5) * board, rowY(top.floor) + row / 2,
      68 - (run.feedback.until - run.tick), '#fff7c0');
  }
}

function sectorPath(ctx, x, y, rx, ry, inner, start, end) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, start, end);
  ctx.ellipse(x, y, inner, ry * inner / rx, 0, end, start, true);
  ctx.closePath();
}

const ringColors = [
  ['#a0e7e1', '#5ba8bb'], ['#bba6fc', '#876bd0'], ['#ffce81', '#e5a058'],
  ['#9edf98', '#69b799'], ['#ffaabe', '#dd769c'],
];

function platform(ctx, ring, rotation, x, y, rx, ry, front) {
  const start = front ? 0 : Math.PI;
  const color = ringColors[ring.index % ringColors.length];
  const inner = rx * .31;
  const segments = 62;
  const step = Math.PI / segments;
  let offset = start;
  let active = ringSurface(ring, start + step / 2 - rotation);
  for (let i = 1; i <= segments; i++) {
    const edge = start + i * step;
    const next = i < segments ? ringSurface(ring, edge + step / 2 - rotation) : null;
    if (next === active) continue;
    if (active !== 'gap') {
      const danger = active === 'danger';
      sectorPath(ctx, x, y + 5, rx, ry, inner, offset, edge);
      ctx.fillStyle = danger ? '#b44163' : color[1];
      ctx.fill();
      sectorPath(ctx, x, y, rx, ry, inner, offset, edge);
      ctx.fillStyle = danger ? '#e56887' : color[0];
      ctx.fill();
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = '#ffffff68';
      ctx.stroke();
      if (danger) {
        ctx.save();
        ctx.clip();
        ctx.strokeStyle = '#ffefc7c4';
        ctx.lineWidth = 2.2;
        for (let dx = -rx - 14; dx <= rx + 14; dx += 7) {
          ctx.beginPath();
          ctx.moveTo(x + dx, y - ry - 3);
          ctx.lineTo(x + dx + 18, y + ry + 3);
          ctx.stroke();
        }
        ctx.restore();
      }
    }
    offset = edge;
    active = next;
  }
}

function helix(ctx, w, h, run, now, style) {
  ctx.fillStyle = linear(ctx, 0, 0, w * .3, h, ['#bfe9fb', '#dbe0fa', '#fff1d9']);
  ctx.fillRect(0, 0, w, h);
  speckles(ctx, w, h, now, '#fffaf0', '#7e90d1');
  const x = w / 2;
  const head = h * .36;
  const radius = Math.min(w * .31, h * .28, 147);
  const oval = radius * .255;
  const separation = Math.min(h * .191, 93);
  const floorY = (depth) => head + (depth - run.camera) * separation;
  const ballY = floorY(run.depth) + oval - radius * .12;
  const ballSize = Math.max(9, radius * .123);
  const startY = floorY(run.ring) - separation * .88;
  const endY = h + 15;
  for (let i = 0; i < 5; i++) {
    const y = (h * (.14 + i * .23) - run.camera * (8 + i) % h + h) % h;
    const px = i % 2 ? w * .89 : w * .13;
    cloud(ctx, px + Math.sin(now / 4800 + i) * 14, y, 20 + i * 3, '#ffffff99');
  }

  for (const ring of [...run.rings].reverse()) {
    const y = floorY(ring.index);
    if (y < -40 || y > h + oval + 6) continue;
    platform(ctx, ring, run.rotation, x, y, radius, oval, false);
  }
  const pillar = radius * .225;
  rectangle(ctx, x - pillar, startY, pillar * 2, endY - startY, pillar * .48,
    linear(ctx, x - pillar, 0, x + pillar, 0, ['#8d89cf', '#f5f4ff', '#d4c5f4', '#a093dc']));
  ellipse(ctx, x, startY + 3, pillar, pillar * .27, '#fffaff');
  ctx.save();
  ctx.globalAlpha = .36;
  for (let i = 0; i < 7; i++) {
    const lineY = floorY(run.ring + i) + Math.sin(run.rotation) * 7;
    rectangle(ctx, x - pillar, lineY - 8, pillar * 2, 3, 1, '#786bb6');
  }
  ctx.restore();

  for (const ring of [...run.rings].reverse()) {
    const y = floorY(ring.index);
    if (y < -40 || y > h + oval + 6) continue;
    platform(ctx, ring, run.rotation, x, y, radius, oval, true);
  }
  const landingY = floorY(run.ring) + oval;
  if (landingY > ballY + 9) {
    ctx.beginPath();
    ctx.setLineDash([3, 6]);
    ctx.moveTo(x, ballY + ballSize);
    ctx.lineTo(x, landingY + 6);
    ctx.strokeStyle = '#62558b5e';
    ctx.lineWidth = 1.7;
    ctx.stroke();
    ctx.setLineDash([]);
  }
  if (run.speed > .06) {
    const trail = linear(ctx, x, ballY - 38, x, ballY, ['#ffffff00', '#ffffffbf']);
    rectangle(ctx, x - ballSize * .53, ballY - 37, ballSize * 1.06, 35, 9, trail);
  }
  ellipse(ctx, x + 1, landingY + 1, ballSize * .86, ballSize * .28, '#61407736');
  disk(ctx, x, ballY, ballSize, radial(ctx, x, ballY, ballSize, style.colors));
  disk(ctx, x - ballSize * .31, ballY - ballSize * .34, ballSize * .22, '#ffffffae');
  spray(ctx, x, ballY, run.tick - run.impactTick, run.done ? '#b9446e' : '#fff7e1');
}

const painters = { orbit, prism: stack, helix };

export function drawScene(ctx, width, height, run, now, style) {
  painters[run.id](ctx, width, height, run, now, style);
}
