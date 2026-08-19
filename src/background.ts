import { computeSeed, STORED_KEYS } from './lib/seed-defaults';

chrome.runtime.onInstalled.addListener(details => {
  // Updates seed too, not just fresh installs: keys added by a later version --
  // the gif list and its toggle -- would otherwise never reach anyone who
  // already had the extension. `computeSeed` only fills what is absent, so
  // existing praises survive.
  const { INSTALL, UPDATE } = chrome.runtime.OnInstalledReason;
  if (details.reason !== INSTALL && details.reason !== UPDATE) {
    return;
  }

  chrome.storage.sync.get(STORED_KEYS, items => {
    const seed = computeSeed(items);

    if (Object.keys(seed).length > 0) {
      void chrome.storage.sync.set(seed);
    }
  });
});
