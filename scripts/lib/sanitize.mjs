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

const carrierTag = /<(?:input|meta)\b[^>]*>/gi;

const avatarUrl = /https:\/\/avatars\d*\.githubusercontent\.com\/[^"'\s>]*/gi;

/**
 * Blanks the payload of a tag whose name or id looks secret.
 *
 * Rewriting the whole tag rather than requiring the name to precede the payload:
 * attribute order varies, and a pattern that assumes one leaks the other. Both
 * carriers matter -- `<input name="authenticity_token" value>` and
 * `<meta name="csrf-token" content>` hide the secret one attribute away from the
 * name that identifies it, and the whole-document fallback capture includes head.
 */
function redactPayload(tag) {
  const identifier = /\b(?:name|id)="([^"]*)"/i.exec(tag);
  if (!identifier || !secretWord.test(identifier[1])) {
    return tag;
  }

  return tag.replace(/\b(value|content)="[^"]*"/i, '$1="REDACTED"');
}

export function sanitizeHtml(html) {
  return html
    .replace(carrierTag, redactPayload)
    .replace(secretAttribute, '$1="REDACTED"')
    .replace(avatarUrl, 'REDACTED_AVATAR');
}
