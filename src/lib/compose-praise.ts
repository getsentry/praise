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
 * A body may span lines -- a quote sits under the approval comment -- but an alt
 * cannot: a newline closes `![...]` early and spills the rest out as literal
 * markdown. The first line stands in for the whole.
 */
function firstLine(text: string): string {
  return text.split('\n', 1)[0];
}

/** @param alt Defaults to the text. Only its first line is used. */
function build(text: string, gif: string | undefined, alt: string = text): string {
  return gif ? `${text}\n\n![${escapeAlt(firstLine(alt))}](${gif})` : text;
}

/**
 * Bodies an Approve click may write: the approval comment, with a quote under it
 * for each configured quote.
 *
 * @param quotes Empty -- which is also how a disabled toggle arrives here --
 *   yields the comment on its own.
 */
export function approveBodies(approveComment: string, quotes: string[]): string[] {
  if (quotes.length === 0) {
    return [approveComment];
  }

  return quotes.map(quote => [approveComment, quote].filter(part => part.trim() !== '').join('\n\n'));
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
function stripOurGif(current: string, gifs: string[], approveTexts: string[]): string {
  // The last image only, and only if the body ends on it. Scanning for the
  // first would span an image of yours above ours; an image with your text
  // below it is yours to keep.
  const body = current.trimEnd();
  const at = body.lastIndexOf('\n\n![');
  const image = at === -1 ? (body.startsWith('![') ? body : undefined) : body.slice(at + 2);

  // Alt text arrives escaped, so `\\.` is what lets a bracket in the praise
  // through without ending the alt early.
  const match = image === undefined ? null : /^!\[((?:\\.|[^\\\]])*)\]\(([^)]*)\)$/.exec(image);
  if (!match) {
    return current;
  }

  const [, alt, url] = match;

  // Either half suffices: the url survives rewording the praise, the alt
  // survives dropping the gif from the list. Any candidate counts, because the
  // alt was written by an earlier click that may have picked a different one.
  if (!gifs.includes(url) && !approveTexts.some(text => alt === escapeAlt(firstLine(text)))) {
    return current;
  }

  return at === -1 ? '' : body.slice(0, at);
}

/**
 * Picks the body an Approve click should write, or `''` to leave the box alone.
 *
 * An empty box gets an ordinary praise. With your own words in it the praise
 * would be putting words in your mouth, so only the gif goes underneath.
 *
 * Your words cannot be the alt text: a newline closes `![...]` early and spills
 * the rest out as literal markdown. A praise's first line stands in.
 *
 * @param approveTexts Bodies an Approve click may write, one of which is picked;
 *   see `approveBodies`. Empty -- or all blank -- means "write nothing", but
 *   still leaves a gif to append under typed text.
 * @param gifs Gif urls to choose from. Empty yields text on its own.
 * @param current What the textarea holds now, so a second click rerolls.
 * @param random Injected for tests; production passes nothing.
 */
export function composeApprove(
  approveTexts: string[],
  gifs: string[],
  current: string,
  random: () => number = Math.random,
): string {
  const usableGifs = gifs.filter(gif => gif.trim() !== '');
  // Blank entries would be written as an empty body, and an all-blank list
  // should behave like an empty one. Dropping them also keeps an empty alt from
  // matching every gif in stripOurGif.
  const usableTexts = approveTexts.filter(text => text.trim() !== '');
  const typed = stripOurGif(current, usableGifs, usableTexts);

  // Membership, not equality: the pick differs per click, so an earlier praise
  // of ours would otherwise be mistaken for words you typed.
  if (typed === '' || usableTexts.includes(typed)) {
    return composePraise(usableTexts, usableGifs, current, random);
  }

  if (usableGifs.length === 0) {
    return '';
  }

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const alt = usableTexts.length > 0 ? pick(usableTexts, random) : '';
    const candidate = build(typed, pick(usableGifs, random), alt);
    if (candidate !== current) {
      return candidate;
    }
  }

  return build(typed, usableGifs[0], usableTexts[0] ?? '');
}
