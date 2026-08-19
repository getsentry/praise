import { sanitizeHtml } from './sanitize.mjs';

test('redacts CSRF tokens', () => {
  const html = '<input type="hidden" name="authenticity_token" value="s3cr3t-token-value">';

  expect(sanitizeHtml(html)).not.toContain('s3cr3t-token-value');
  expect(sanitizeHtml(html)).toContain('REDACTED');
});

test('redacts the value whichever side of the name it sits on', () => {
  const html = '<input type="hidden" value="s3cr3t-leak" name="authenticity_token">';

  expect(sanitizeHtml(html)).not.toContain('s3cr3t-leak');
});

test('redacts the CSRF token in the document head', () => {
  const html = '<meta name="csrf-token" content="LIVE-TOKEN-abc123">';

  expect(sanitizeHtml(html)).not.toContain('LIVE-TOKEN-abc123');
});

test('leaves an ordinary meta tag alone', () => {
  const html = '<meta name="viewport" content="width=device-width">';

  expect(sanitizeHtml(html)).toBe(html);
});

test('leaves an ordinary input value alone', () => {
  const html = '<input type="text" name="title" value="Fix the thing">';

  expect(sanitizeHtml(html)).toBe(html);
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
