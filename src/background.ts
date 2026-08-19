import { computeSeed } from './lib/seed-defaults';

chrome.runtime.onInstalled.addListener(details => {
  if (details.reason !== chrome.runtime.OnInstalledReason.INSTALL) {
    return;
  }

  chrome.storage.sync.get(['reviews', 'comments'], items => {
    const seed = computeSeed(items);

    if (Object.keys(seed).length > 0) {
      void chrome.storage.sync.set(seed);
    }
  });
});
