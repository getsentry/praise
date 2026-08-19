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

/**
 * @param alt What to describe the gif as. Defaults to the text, which only
 *   suits a short praise -- see `composeApprove` for why typed text cannot be
 *   its own alt.
 */
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
 * Recognising our own writing by its shape rather than by remembering the last
 * write is what keeps a second click from stacking gifs: GitHub restores an
 * unsubmitted review body as a draft, so on the next page load the box arrives
 * already holding what we wrote, with no memory of having written it.
 *
 * A gif you pasted yourself matches neither test, so it is text like any other
 * and survives untouched.
 */
function stripOurGif(current: string, gifs: string[], approveComment: string): string {
  const start = current.lastIndexOf('\n\n![');
  const image = start === -1 ? (current.startsWith('![') ? current : undefined) : current.slice(start + 2);
  if (image === undefined) {
    return current;
  }

  // Either half is enough on its own. The url catches a gif written before the
  // praise was reworded; the alt catches one written before the gif was dropped
  // from the list, since every gif we write is captioned with the praise.
  const byUrl = gifs.some(gif => image.endsWith(`](${gif})`));
  const byAlt = approveComment !== '' && image.startsWith(`![${escapeAlt(approveComment)}](`);
  if (!byUrl && !byAlt) {
    return current;
  }

  return start === -1 ? '' : current.slice(0, start);
}

/**
 * Picks the body an Approve click should write, or `''` to leave the box alone.
 *
 * Two different jobs, split on whether you have written anything of your own.
 * With an empty box this is an ordinary praise. With your own words in it, the
 * praise would be putting words in your mouth, so only the gif goes underneath
 * -- and when there is no gif to add there is nothing to write at all.
 *
 * Your words cannot be the gif's alt text, tempting as it looks: alt text lives
 * inside `![...]`, which a newline in a multi-line comment closes early, leaving
 * the rest of what you wrote as literal markdown. The praise stands in instead
 * -- short, single-line, and the one thing here that actually describes the gif.
 *
 * @param approveComment The configured praise. Empty disables it, which still
 *   leaves a gif to append under typed text.
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
