// Kept out of background.ts, away from chrome.storage, so the seeding rule is
// unit-testable.

export const DEFAULT_REVIEWS = ['LGTM 🚀', 'Ship it 🚢', 'RSLGTM 🏆', 'Good job 👏'];

export const DEFAULT_COMMENTS = [
  'This is awesome 👏 ',
  'Thanks for improving this 🚢:',
  'I like this a lot 🚀',
  'You deserve a 🥇',
  'Best change ever 💯',
  '🏆 Developer of the year 🏆',
  'This code makes my day ☀️',
  'You rock 🎸. Thanks.',
  '🌮  to you!',
  'Oh yeah 💪',
];

/** Values are `unknown`: storage is shared with the options page and older versions. */
export type StoredSettings = { reviews?: unknown; comments?: unknown };

/** Keys to write back. A key is absent when it needs no seeding. */
export type SeedPatch = { reviews?: string[]; comments?: string[] };

function needsSeeding(value: unknown): boolean {
  return !Array.isArray(value) || value.length === 0;
}

/** Empty result means "write nothing". Arrays are copied so callers can't corrupt the defaults. */
export function computeSeed(items: StoredSettings): SeedPatch {
  const seed: SeedPatch = {};

  if (needsSeeding(items.reviews)) {
    seed.reviews = [...DEFAULT_REVIEWS];
  }
  if (needsSeeding(items.comments)) {
    seed.comments = [...DEFAULT_COMMENTS];
  }

  return seed;
}
