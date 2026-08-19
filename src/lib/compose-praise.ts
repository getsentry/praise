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

/** @param alt Defaults to the text, which only suits a short praise. */
function build(text: string, gif: string | undefined, alt: string = text): string {
  return gif ? `${text}\n\n![${escapeAlt(alt)}](${gif})` : text;
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

/**
 * Removes a trailing gif of ours, leaving whatever it was sitting under.
 *
 * Matching on shape rather than remembering the last write is what stops gifs
 * stacking: GitHub restores an unsubmitted body as a draft, so after a reload
 * the box already holds what we wrote. A gif you pasted yourself matches
 * neither test and survives.
 */
function stripOurGif(current: string, gifs: string[], approveComment: string): string {
  // Only an image the body ends on. One with your text below it is yours to
  // keep, and slicing from its start would delete what you wrote.
  const body = current.trimEnd();
  const match = /(^|\n\n)!\[([\s\S]*)\]\(([^)]*)\)$/.exec(body);
  if (!match) {
    return current;
  }

  const [, , alt, url] = match;

  // Either half suffices: the url survives rewording the praise, the alt
  // survives dropping the gif from the list.
  if (!gifs.includes(url) && (approveComment === '' || alt !== escapeAlt(approveComment))) {
    return current;
  }

  return body.slice(0, match.index);
}

/**
 * Picks the body an Approve click should write, or `''` to leave the box alone.
 *
 * An empty box gets an ordinary praise. With your own words in it the praise
 * would be putting words in your mouth, so only the gif goes underneath.
 *
 * Your words cannot be the alt text: a newline closes `![...]` early and spills
 * the rest out as literal markdown. The praise stands in, being single-line.
 *
 * @param approveComment The configured praise. Empty still leaves a gif to
 *   append under typed text.
 * @param gifs Gif urls to choose from. Empty yields text on its own.
 * @param current What the textarea holds now, so a second click rerolls.
 * @param random Injected for tests; production passes nothing.
 */
export function composeApprove(
  approveComment: string,
  gifs: string[],
  current: string,
  random: () => number = Math.random,
): string {
  const usableGifs = gifs.filter(gif => gif.trim() !== '');
  const typed = stripOurGif(current, usableGifs, approveComment);

  if (typed === '' || typed === approveComment) {
    return composePraise(approveComment === '' ? [] : [approveComment], usableGifs, current, random);
  }

  if (usableGifs.length === 0) {
    return '';
  }

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const candidate = build(typed, pick(usableGifs, random), approveComment);
    if (candidate !== current) {
      return candidate;
    }
  }

  return build(typed, usableGifs[0], approveComment);
}
