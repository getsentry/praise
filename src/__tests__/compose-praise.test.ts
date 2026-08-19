import { composePraise } from '../lib/compose-praise';

/** A stand-in for `Math.random` that walks a fixed list, so picks are predictable. */
function pickSequence(...values: number[]): () => number {
  let call = 0;
  return () => values[call++ % values.length];
}

const GIF = 'https://media.giphy.com/media/abc/giphy.gif';
const OTHER_GIF = 'https://media.giphy.com/media/xyz/giphy.gif';

describe('composePraise', () => {
  test('returns nothing when there are no texts', () => {
    expect(composePraise([], [GIF], '', pickSequence(0))).toBe('');
  });

  test('returns the bare text when there are no gifs', () => {
    expect(composePraise(['LGTM 🚀'], [], '', pickSequence(0))).toBe('LGTM 🚀');
  });

  test('appends the gif as a markdown image below a blank line', () => {
    expect(composePraise(['LGTM 🚀'], [GIF], '', pickSequence(0))).toBe(`LGTM 🚀\n\n![LGTM 🚀](${GIF})`);
  });

  test('escapes brackets in the alt text so they cannot break the image syntax', () => {
    expect(composePraise(['Nice [work]'], [GIF], '', pickSequence(0))).toBe(
      `Nice [work]\n\n![Nice \\[work\\]](${GIF})`,
    );
  });

  test('escapes backslashes in the alt text', () => {
    const praise = String.raw`Back\slash`;
    const alt = String.raw`Back\\slash`;

    expect(composePraise([praise], [GIF], '', pickSequence(0))).toBe(`${praise}\n\n![${alt}](${GIF})`);
  });

  /** Escaping the brackets alone would let this backslash swallow the escape. */
  test('a backslash before a bracket cannot defeat the bracket escape', () => {
    const praise = String.raw`Nice \[work]`;
    const alt = String.raw`Nice \\\[work\]`;

    expect(composePraise([praise], [GIF], '', pickSequence(0))).toBe(`${praise}\n\n![${alt}](${GIF})`);
  });

  test('picks text and gif independently from the random source', () => {
    const result = composePraise(['first', 'second'], [GIF, OTHER_GIF], '', pickSequence(0.9, 0));

    expect(result).toBe(`second\n\n![second](${GIF})`);
  });

  test('tries again when the composed result matches what is already there', () => {
    const current = `LGTM\n\n![LGTM](${GIF})`;
    const result = composePraise(['LGTM'], [GIF, OTHER_GIF], current, pickSequence(0, 0, 0, 0.9));

    expect(result).toBe(`LGTM\n\n![LGTM](${OTHER_GIF})`);
  });

  test('falls back to the first entries when every candidate matches what is there', () => {
    const current = `LGTM\n\n![LGTM](${GIF})`;

    expect(composePraise(['LGTM'], [GIF], current, pickSequence(0))).toBe(current);
  });

  test('ignores a gif list holding only blanks', () => {
    expect(composePraise(['LGTM'], ['', '   '], '', pickSequence(0))).toBe('LGTM');
  });
});
