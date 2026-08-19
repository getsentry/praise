// Kept out of background.ts, away from chrome.storage, so the seeding rule is
// unit-testable.

/** An approval posts one comment, so this is a single string rather than a list. */
export const DEFAULT_APPROVE_COMMENT = 'LGTM 🚀';

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

/**
 * Direct media urls rather than giphy page links: only the former render as an
 * image in a GitHub comment.
 */
export const DEFAULT_APPROVE_GIFS = [
  'https://media.giphy.com/media/111ebonMs90YLu/giphy.gif',
  'https://media.giphy.com/media/mgqefqwSbToPe/giphy.gif',
  'https://media.giphy.com/media/NEvPzZ8bd1V4Y/giphy.gif',
  'https://media.giphy.com/media/JPsFUPp3vLS5q/giphy.gif',
  'https://media.giphy.com/media/2HMUYBYrhg4Gk/giphy.gif',
  'https://media.giphy.com/media/1SfxXOJ0Q2Xni/giphy.gif',
  'https://media.giphy.com/media/143vPc6b08locw/giphy.gif',
  'https://media.giphy.com/media/pwQdvTbFhds3e/giphy.gif',
  'https://media.giphy.com/media/iP3GyAWP9NrlpI0Ilt/giphy.gif',
];

/** Values are `unknown`: storage is shared with the options page and older versions. */
export type StoredSettings = {
  /** Superseded by `approveComment`; still read so an older list can be migrated. */
  reviews?: unknown;
  approveComment?: unknown;
  comments?: unknown;
  approveGifs?: unknown;
  approveGifsEnabled?: unknown;
};

/** Keys to write back. A key is absent when it needs no seeding. */
export type SeedPatch = {
  approveComment?: string;
  comments?: string[];
  approveGifs?: string[];
  approveGifsEnabled?: boolean;
};

function needsSeeding(value: unknown): boolean {
  return !Array.isArray(value) || value.length === 0;
}

function usableText(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '';
}

/**
 * A toggle needs its own rule. The list test treats "empty" as unseeded, which
 * for a boolean would read `false` as missing and switch gifs back on for
 * anyone who deliberately turned them off.
 */
function needsToggleSeeding(value: unknown): boolean {
  return typeof value !== 'boolean';
}

/** Empty result means "write nothing". Arrays are copied so callers can't corrupt the defaults. */
export function computeSeed(items: StoredSettings): SeedPatch {
  const seed: SeedPatch = {};

  if (!usableText(items.approveComment)) {
    // Earlier versions kept a list of review praises. Carry the first entry
    // over so a customised one survives the move to a single approve comment.
    const carried = Array.isArray(items.reviews) ? items.reviews.find(usableText) : undefined;
    seed.approveComment = carried ?? DEFAULT_APPROVE_COMMENT;
  }
  if (needsSeeding(items.comments)) {
    seed.comments = [...DEFAULT_COMMENTS];
  }
  if (needsSeeding(items.approveGifs)) {
    seed.approveGifs = [...DEFAULT_APPROVE_GIFS];
  }
  if (needsToggleSeeding(items.approveGifsEnabled)) {
    seed.approveGifsEnabled = true;
  }

  return seed;
}
