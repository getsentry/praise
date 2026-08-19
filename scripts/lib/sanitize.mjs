/**
 * Removes secrets and account identifiers from captured markup.
 *
 * These captures are the point of the probe -- real GitHub markup is the one
 * thing a synthetic fixture cannot provide -- so they are meant to be read,
 * shared, and eventually committed as fixtures. Class names and structure must
 * survive untouched, because they are exactly what `selectors.ts` matches on.
 */

const secretAttribute = /\b([\w-]*(?:token|csrf|session|auth|nonce)[\w-]*)="[^"]*"/gi;

/** An input whose name or id looks secret is hiding the secret in its value. */
const secretInputValue =
  /(<input\b[^>]*\b(?:name|id)="[^"]*(?:token|csrf|session|auth|nonce)[^"]*"[^>]*\bvalue=)"[^"]*"/gi;

const avatarUrl = /https:\/\/avatars\d*\.githubusercontent\.com\/[^"'\s>]*/gi;

export function sanitizeHtml(html) {
  // secretInputValue must run first: it redacts a `value=` that sits next to a
  // secret-looking `name=`/`id=`, which is a different attribute than the one
  // secretAttribute's single pattern would catch on that same tag.
  return html
    .replace(secretInputValue, '$1"REDACTED"')
    .replace(secretAttribute, '$1="REDACTED"')
    .replace(avatarUrl, 'REDACTED_AVATAR');
}
