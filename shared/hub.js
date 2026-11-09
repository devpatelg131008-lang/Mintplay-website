import { readMintCoins } from './wallet.js';

const balance = document.querySelector('[data-coins]');
let latest = 0;

async function refresh() {
  const request = ++latest;
  const coins = await readMintCoins();
  if (request === latest) balance.textContent = coins.toLocaleString();
}

window.addEventListener('pageshow', refresh);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) void refresh();
});
void refresh();
