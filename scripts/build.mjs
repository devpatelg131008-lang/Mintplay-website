import { copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { games } from '../shared/engine.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const shared = join(root, 'shared');
const siteNames = ['all', 'hub', ...games.map((game) => game.slug)];
const urlSettings = {
  'orbit-pins': 'MINT_ORBIT_PINS_URL',
  'prism-stack': 'MINT_PRISM_STACK_URL',
  'helix-drop': 'MINT_HELIX_DROP_URL',
};
const media = ['mark.svg', 'MintDisplay-Bold.ttf', 'Outfit-400.ttf', 'Outfit-600.ttf', 'Outfit-OFL.txt'];
const covers = games.map((game) => game.slug + '.svg');

function configuredUrl(env, name) {
  if (!env[name]?.trim()) return '';
  let url;
  try {
    url = new URL(env[name].trim());
  } catch {
    throw new Error(name + ' must be a full website URL.');
  }
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if ((url.protocol !== 'https:' && !(loopback && url.protocol === 'http:')) ||
      url.username || url.password) {
    throw new Error(name + ' must use HTTPS or a local HTTP address.');
  }
  return url.href;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);
}

function fillTemplate(template, values) {
  return template.replace(/\{\{([a-z-]+)\}\}/g, (_, token) => {
    if (!Object.hasOwn(values, token)) throw new Error('Unresolved page field ' + token);
    return escapeHtml(values[token]);
  });
}

async function writeSite(page, folder, javascript, images) {
  const assets = join(folder, 'assets');
  await mkdir(join(assets, 'media'), { recursive: true });
  await Promise.all([
    writeFile(join(folder, 'index.html'), page),
    ...['mint.css', ...javascript].map((name) =>
      copyFile(join(shared, name), join(assets, name))),
    ...[...media, ...images].map((name) =>
      copyFile(join(shared, 'media', name), join(assets, 'media', name))),
  ]);
}

export async function buildSites({ env = process.env, output = join(root, 'dist') } = {}) {
  const target = env.MINT_SITE || 'all';
  if (!siteNames.includes(target)) throw new Error('MINT_SITE must be one of ' + siteNames.join(', '));
  const combined = target === 'all';
  const jobs = [];

  if (combined || target === 'hub') {
    const destinations = {};
    for (const game of games) {
      const setting = urlSettings[game.slug];
      destinations[game.slug] = configuredUrl(env, setting) || (combined ? './' + game.slug + '/' : '');
      if (!destinations[game.slug]) throw new Error('Set ' + setting + ' for the hub-only build.');
    }
    const template = await readFile(join(root, 'sites', 'hub', 'index.html'), 'utf8');
    jobs.push({ page: fillTemplate(template, destinations), folder: output, scripts: ['hub.js', 'wallet.js'], images: covers });
  }

  const selectedGames = games.filter((game) => combined || game.slug === target);
  if (selectedGames.length) {
    const template = await readFile(join(shared, 'game.html'), 'utf8');
    const hub = combined ? '../' : configuredUrl(env, 'MINT_HUB_URL');
    for (const game of selectedGames) {
      const site = JSON.parse(await readFile(join(root, 'sites', game.slug, 'site.json'), 'utf8'));
      if (site.id !== game.id) throw new Error('Unexpected game ID for ' + game.slug);
      const page = fillTemplate(template, {
        'game-id': game.id,
        'game-title': game.title,
        'game-progress': game.progress,
        'game-start': game.id === 'orbit' ? 1 : 0,
        'game-currency': game.currency,
        'game-shop': game.shop,
        'game-controls': site.controls,
        'game-keys': site.keys || '',
        'hub-url': hub || '#',
        'hub-hidden': hub ? '' : 'hidden',
      });
      jobs.push({
        page, folder: combined ? join(output, game.slug) : output,
        scripts: ['engine.js', 'scenes.js', 'play.js', 'progress.js'], images: [],
      });
    }
  }

  await rm(output, { recursive: true, force: true });
  await Promise.all(jobs.map(({ page, folder, scripts, images }) =>
    writeSite(page, folder, scripts, images)));
  return { output, target, count: jobs.length };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const built = await buildSites();
  console.log(`Built ${built.count} site${built.count === 1 ? '' : 's'} in dist/`);
}
