// Kept out of content_script.tsx, away from the DOM, so the composition rule is
// unit-testable.

/** How many times to reroll before accepting a repeat of what is already there. */
const MAX_ATTEMPTS = 10;

/**
 * Brackets would close the image's alt text early and leave the rest of the
 * praise as literal markdown, so hand them to the renderer escaped.
 *
 * Backslashes go first, and for the same reason: escaping only the brackets
 * lets a backslash already in the praise consume the one we add, handing the
 * renderer the bare bracket we meant to defuse.
 */
function escapeAlt(text: string): string {
  return text.replace(/[\\[\]]/g, '\\$&');
}

function pick<T>(items: T[], random: () => number): T {
  return items[Math.floor(random() * items.length)];
}

function build(text: string, gif: string | undefined): string {
  return gif ? `${text}\n\n![${escapeAlt(text)}](${gif})` : text;
}

/**
 * Picks a praise, and a gif to go under it when any are configured.
 *
 * @param texts Praise bodies to choose from. Empty means "write nothing".
 * @param gifs Gif URLs to choose from. Empty -- which is also how a disabled
 *   toggle arrives here -- yields text on its own.
 * @param current What the textarea holds now, so a second click can offer
 *   something different.
 * @param random Injected for tests; production passes nothing.
 */
export function composePraise(
  texts: string[],
  gifs: string[],
  current: string,
  random: () => number = Math.random,
): string {
  if (texts.length === 0) {
    return '';
  }

  // A blank entry would render as a broken image, and an all-blank list should
  // behave the same as an empty one rather than silently disabling the reroll.
  const usableGifs = gifs.filter(gif => gif.trim() !== '');

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const candidate = build(pick(texts, random), usableGifs.length > 0 ? pick(usableGifs, random) : undefined);
    if (candidate !== current) {
      return candidate;
    }
  }

  // Only reachable when there is nothing else to offer, e.g. one praise and one
  // gif. Repeating beats writing nothing on a click the user asked for.
  return build(texts[0], usableGifs[0]);
}
