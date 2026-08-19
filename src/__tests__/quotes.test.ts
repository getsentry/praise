import { APPROVE_QUOTES } from '../lib/quotes';

/**
 * A quote is dropped into a comment body and reused as a gif's markdown alt
 * text, so these are the caller's constraints, not style preferences.
 */
const MAX_LENGTH = 100;
const SEPARATOR = ' — ';

describe('APPROVE_QUOTES', () => {
  test('holds quotes', () => {
    expect(APPROVE_QUOTES.length).toBeGreaterThan(0);
  });

  test('every entry is a single line', () => {
    for (const quote of APPROVE_QUOTES) {
      expect(quote).not.toMatch(/[\r\n]/);
    }
  });

  test('every entry is trimmed', () => {
    for (const quote of APPROVE_QUOTES) {
      expect(quote).toBe(quote.trim());
      expect(quote.length).toBeGreaterThan(0);
    }
  });

  test('every entry fits a comment line', () => {
    for (const quote of APPROVE_QUOTES) {
      expect(quote.length).toBeLessThanOrEqual(MAX_LENGTH);
    }
  });

  test('every entry carries an inline attribution', () => {
    for (const quote of APPROVE_QUOTES) {
      expect(quote).toContain(SEPARATOR);

      const [text, ...rest] = quote.split(SEPARATOR);
      const author = rest.join(SEPARATOR);

      expect(text.trim()).not.toBe('');
      expect(author.trim()).not.toBe('');
    }
  });

  /** A leading marker would turn the comment into a heading, quote or list item. */
  test('no entry starts with a markdown marker', () => {
    for (const quote of APPROVE_QUOTES) {
      expect(quote).not.toMatch(/^[>#*\-+`|]/);
    }
  });

  test('no entry holds a backtick', () => {
    for (const quote of APPROVE_QUOTES) {
      expect(quote).not.toContain('`');
    }
  });

  test('holds no duplicates', () => {
    expect(new Set(APPROVE_QUOTES).size).toBe(APPROVE_QUOTES.length);
  });
});
