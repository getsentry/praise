import { computeSeed } from './lib/seed-defaults';

chrome.runtime.onInstalled.addListener(details => {
  // Updates seed too, not just fresh installs: keys added by a later version --
  // the gif list and its toggle -- would otherwise never reach anyone who
  // already had the extension. `computeSeed` only fills what is absent, so
  // existing praises survive.
  const { INSTALL, UPDATE } = chrome.runtime.OnInstalledReason;
  if (details.reason !== INSTALL && details.reason !== UPDATE) {
    return;
  }

  // `reviews` is read but never written: it is the pre-`approveComment` list, kept
  // only so `computeSeed` can carry a customised entry over.
  const keys = ['reviews', 'approveComment', 'comments', 'approveGifs', 'approveGifsEnabled'];
  chrome.storage.sync.get(keys, items => {
    const seed = computeSeed(items);

    if (Object.keys(seed).length > 0) {
      void chrome.storage.sync.set(seed);
    }
  });
});
