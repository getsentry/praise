/**
 * Removes secrets and account identifiers from captured markup.
 *
 * These captures are the point of the probe -- real GitHub markup is the one
 * thing a synthetic fixture cannot provide -- so they are meant to be read,
 * shared, and eventually committed as fixtures. Class names and structure must
 * survive untouched, because they are exactly what `selectors.ts` matches on.
 */

const secretWord = /token|csrf|session|auth|nonce/i;

const secretAttribute = /\b([\w-]*(?:token|csrf|session|auth|nonce)[\w-]*)="[^"]*"/gi;

const inputTag = /<input\b[^>]*>/gi;

const avatarUrl = /https:\/\/avatars\d*\.githubusercontent\.com\/[^"'\s>]*/gi;

/**
 * Blanks an input's `value` when its name or id looks secret.
 *
 * Rewriting the whole tag rather than matching `name` before `value` -- the two
 * appear in either order, and a pattern that assumes one leaks the other.
 */
function redactInputValue(tag) {
  const identifier = /\b(?:name|id)="([^"]*)"/i.exec(tag);
  if (!identifier || !secretWord.test(identifier[1])) {
    return tag;
  }

  return tag.replace(/\bvalue="[^"]*"/i, 'value="REDACTED"');
}

export function sanitizeHtml(html) {
  return html
    .replace(inputTag, redactInputValue)
    .replace(secretAttribute, '$1="REDACTED"')
    .replace(avatarUrl, 'REDACTED_AVATAR');
}
