export const STARTING_COINS = 2480;

export function readMintCoins() {
  return new Promise((resolve) => {
    let request;
    try {
      request = globalThis.indexedDB?.open('mint-play-preview-v1', 1);
    } catch {
      resolve(STARTING_COINS);
      return;
    }
    if (!request) {
      resolve(STARTING_COINS);
      return;
    }
    // Keep the hub compatible with balances saved by the original Mint Play preview.
    request.onupgradeneeded = () => {
      request.result.createObjectStore('wallet');
      request.result.createObjectStore('receipts');
    };
    request.onerror = request.onblocked = () => resolve(STARTING_COINS);
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction('wallet');
      const saved = transaction.objectStore('wallet').get('balance');
      saved.onsuccess = () => resolve(saved.result?.coins ?? STARTING_COINS);
      saved.onerror = () => resolve(STARTING_COINS);
      transaction.oncomplete = transaction.onabort = () => db.close();
    };
  });
}
