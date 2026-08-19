import { composeApprove, composePraise } from '../lib/compose-praise';

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

describe('composeApprove', () => {
  test('composes praise and gif when the box is empty', () => {
    expect(composeApprove('LGTM 🚀', [GIF], '', pickSequence(0))).toBe(`LGTM 🚀\n\n![LGTM 🚀](${GIF})`);
  });

  test('writes nothing when there is no approve comment and no typed text', () => {
    expect(composeApprove('', [GIF], '', pickSequence(0))).toBe('');
  });

  test('rerolls the gif when the box still holds what we wrote', () => {
    const current = `LGTM\n\n![LGTM](${GIF})`;

    expect(composeApprove('LGTM', [GIF, OTHER_GIF], current, pickSequence(0, 0, 0, 0.9))).toBe(
      `LGTM\n\n![LGTM](${OTHER_GIF})`,
    );
  });

  /** The point of the function: your words survive, the praise stays out. */
  test('keeps the typed text and adds only a gif below it', () => {
    expect(composeApprove('LGTM 🚀', [GIF], 'nice refactor', pickSequence(0))).toBe(
      `nice refactor\n\n![LGTM 🚀](${GIF})`,
    );
  });

  test('leaves typed text untouched when there are no gifs', () => {
    expect(composeApprove('LGTM 🚀', [], 'nice refactor', pickSequence(0))).toBe('');
  });

  test('leaves typed text untouched when the gif list holds only blanks', () => {
    expect(composeApprove('LGTM', ['', '  '], 'nice refactor', pickSequence(0))).toBe('');
  });

  test('still adds a gif under typed text when no approve comment is configured', () => {
    expect(composeApprove('', [GIF], 'nice', pickSequence(0))).toBe(`nice\n\n![](${GIF})`);
  });

  /** A newline in the alt closes the image early. */
  test('never uses multi-line typed text as the alt text', () => {
    const typed = 'first line\n\nsecond line';

    expect(composeApprove('LGTM', [GIF], typed, pickSequence(0))).toBe(`${typed}\n\n![LGTM](${GIF})`);
  });

  test('escapes the praise when it stands in as alt text', () => {
    expect(composeApprove('Nice [work]', [GIF], 'thanks', pickSequence(0))).toBe(
      `thanks\n\n![Nice \\[work\\]](${GIF})`,
    );
  });

  /** GitHub restores an unsubmitted body as a draft, so this is the common case. */
  test('replaces our own gif rather than stacking a second one under it', () => {
    const current = `nice refactor\n\n![LGTM](${GIF})`;

    expect(composeApprove('LGTM', [GIF, OTHER_GIF], current, pickSequence(0.9))).toBe(
      `nice refactor\n\n![LGTM](${OTHER_GIF})`,
    );
  });

  test('treats a restored praise-and-gif draft as ours, not as typed text', () => {
    const current = `LGTM\n\n![LGTM](${GIF})`;

    expect(composeApprove('LGTM', [OTHER_GIF], current, pickSequence(0))).toBe(`LGTM\n\n![LGTM](${OTHER_GIF})`);
  });

  test('strips our gif even when it is the entire body', () => {
    expect(composeApprove('LGTM', [GIF], `![LGTM](${GIF})`, pickSequence(0))).toBe(`LGTM\n\n![LGTM](${GIF})`);
  });

  /** The strip must take the last image, not span from an earlier one of yours. */
  test('keeps an image of yours sitting above our gif', () => {
    const mine = '![mine](https://example.com/mine.gif)';
    const current = `look\n\n${mine}\n\n![LGTM](${GIF})`;

    expect(composeApprove('LGTM', [GIF, OTHER_GIF], current, pickSequence(0.9))).toBe(
      `look\n\n${mine}\n\n![LGTM](${OTHER_GIF})`,
    );
  });

  /** The alt is escaped, so a bracketed praise must still be recognised as ours. */
  test('recognises our own gif when the praise contains brackets', () => {
    const current = `Nice [work]\n\n![Nice \\[work\\]](${GIF})`;

    expect(composeApprove('Nice [work]', [OTHER_GIF], current, pickSequence(0))).toBe(
      `Nice [work]\n\n![Nice \\[work\\]](${OTHER_GIF})`,
    );
  });

  /** Anything below our gif is yours, and deleting it would be silent data loss. */
  test('keeps text written below our gif', () => {
    const current = `LGTM\n\n![LGTM](${GIF})\n\nalso nice tests`;

    expect(composeApprove('LGTM', [GIF, OTHER_GIF], current, pickSequence(0.9))).toContain('also nice tests');
  });

  /** Trailing whitespace must not defeat the url match once the alt has stopped matching. */
  test('recognises our gif by url despite trailing whitespace', () => {
    const current = `LGTM\n\n![LGTM](${GIF})\n`;

    expect(composeApprove('Looks great', [GIF], current, pickSequence(0))).toBe(`LGTM\n\n![Looks great](${GIF})`);
  });

  /** A gif you pasted yourself is your text, and must not be eaten. */
  test('leaves a gif that is not one of the configured ones alone', () => {
    const mine = 'look\n\n![mine](https://example.com/mine.gif)';

    expect(composeApprove('LGTM', [GIF], mine, pickSequence(0))).toBe(`${mine}\n\n![LGTM](${GIF})`);
  });
});
