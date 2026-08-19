import { sanitizeHtml } from './sanitize.mjs';

test('redacts CSRF tokens', () => {
  const html = '<input type="hidden" name="authenticity_token" value="s3cr3t-token-value">';

  expect(sanitizeHtml(html)).not.toContain('s3cr3t-token-value');
  expect(sanitizeHtml(html)).toContain('REDACTED');
});

test('redacts any attribute whose name looks like a secret', () => {
  const html = '<div data-csrf-token="abc123" data-session-id="xyz789"></div>';
  const result = sanitizeHtml(html);

  expect(result).not.toContain('abc123');
  expect(result).not.toContain('xyz789');
});

test('drops user avatars, which carry account identifiers', () => {
  const html = '<img src="https://avatars.githubusercontent.com/u/1402241?v=4" alt="x">';

  expect(sanitizeHtml(html)).not.toContain('avatars.githubusercontent.com');
});

test('keeps the structure the selectors depend on', () => {
  const html =
    '<div class="AddCommentEditor-module__Foo__a1b2c">' +
    '<textarea data-component="Textarea"></textarea>' +
    '<button>Cancel</button></div>';

  expect(sanitizeHtml(html)).toBe(html);
});
