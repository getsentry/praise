import { approveBodies, composeApprove, composePraise } from '../lib/compose-praise';

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
    expect(composeApprove(['LGTM 🚀'], [GIF], '', pickSequence(0))).toBe(`LGTM 🚀\n\n![LGTM 🚀](${GIF})`);
  });

  test('writes nothing when there is no approve comment and no typed text', () => {
    expect(composeApprove([], [GIF], '', pickSequence(0))).toBe('');
  });

  test('rerolls the gif when the box still holds what we wrote', () => {
    const current = `LGTM\n\n![LGTM](${GIF})`;

    expect(composeApprove(['LGTM'], [GIF, OTHER_GIF], current, pickSequence(0, 0, 0, 0.9))).toBe(
      `LGTM\n\n![LGTM](${OTHER_GIF})`,
    );
  });

  /** The point of the function: your words survive, the praise stays out. */
  test('keeps the typed text and adds only a gif below it', () => {
    expect(composeApprove(['LGTM 🚀'], [GIF], 'nice refactor', pickSequence(0))).toBe(
      `nice refactor\n\n![LGTM 🚀](${GIF})`,
    );
  });

  test('leaves typed text untouched when there are no gifs', () => {
    expect(composeApprove(['LGTM 🚀'], [], 'nice refactor', pickSequence(0))).toBe('');
  });

  test('leaves typed text untouched when the gif list holds only blanks', () => {
    expect(composeApprove(['LGTM'], ['', '  '], 'nice refactor', pickSequence(0))).toBe('');
  });

  test('still adds a gif under typed text when no approve comment is configured', () => {
    expect(composeApprove([], [GIF], 'nice', pickSequence(0))).toBe(`nice\n\n![](${GIF})`);
  });

  /** A newline in the alt closes the image early. */
  test('never uses multi-line typed text as the alt text', () => {
    const typed = 'first line\n\nsecond line';

    expect(composeApprove(['LGTM'], [GIF], typed, pickSequence(0))).toBe(`${typed}\n\n![LGTM](${GIF})`);
  });

  test('escapes the praise when it stands in as alt text', () => {
    expect(composeApprove(['Nice [work]'], [GIF], 'thanks', pickSequence(0))).toBe(
      `thanks\n\n![Nice \\[work\\]](${GIF})`,
    );
  });

  /** GitHub restores an unsubmitted body as a draft, so this is the common case. */
  test('replaces our own gif rather than stacking a second one under it', () => {
    const current = `nice refactor\n\n![LGTM](${GIF})`;

    expect(composeApprove(['LGTM'], [GIF, OTHER_GIF], current, pickSequence(0, 0.9))).toBe(
      `nice refactor\n\n![LGTM](${OTHER_GIF})`,
    );
  });

  test('treats a restored praise-and-gif draft as ours, not as typed text', () => {
    const current = `LGTM\n\n![LGTM](${GIF})`;

    expect(composeApprove(['LGTM'], [OTHER_GIF], current, pickSequence(0))).toBe(`LGTM\n\n![LGTM](${OTHER_GIF})`);
  });

  test('strips our gif even when it is the entire body', () => {
    expect(composeApprove(['LGTM'], [GIF], `![LGTM](${GIF})`, pickSequence(0))).toBe(`LGTM\n\n![LGTM](${GIF})`);
  });

  /** The strip must take the last image, not span from an earlier one of yours. */
  test('keeps an image of yours sitting above our gif', () => {
    const mine = '![mine](https://example.com/mine.gif)';
    const current = `look\n\n${mine}\n\n![LGTM](${GIF})`;

    expect(composeApprove(['LGTM'], [GIF, OTHER_GIF], current, pickSequence(0, 0.9))).toBe(
      `look\n\n${mine}\n\n![LGTM](${OTHER_GIF})`,
    );
  });

  /** The alt is escaped, so a bracketed praise must still be recognised as ours. */
  test('recognises our own gif when the praise contains brackets', () => {
    const current = `Nice [work]\n\n![Nice \\[work\\]](${GIF})`;

    expect(composeApprove(['Nice [work]'], [OTHER_GIF], current, pickSequence(0))).toBe(
      `Nice [work]\n\n![Nice \\[work\\]](${OTHER_GIF})`,
    );
  });

  /** Anything below our gif is yours, and deleting it would be silent data loss. */
  test('keeps text written below our gif', () => {
    const current = `LGTM\n\n![LGTM](${GIF})\n\nalso nice tests`;

    expect(composeApprove(['LGTM'], [GIF, OTHER_GIF], current, pickSequence(0, 0.9))).toContain('also nice tests');
  });

  /** Trailing whitespace must not defeat the url match once the alt has stopped matching. */
  test('recognises our gif by url despite trailing whitespace', () => {
    const current = `LGTM\n\n![LGTM](${GIF})\n`;

    expect(composeApprove(['Looks great'], [GIF], current, pickSequence(0))).toBe(`LGTM\n\n![Looks great](${GIF})`);
  });

  /** A gif you pasted yourself is your text, and must not be eaten. */
  test('leaves a gif that is not one of the configured ones alone', () => {
    const mine = 'look\n\n![mine](https://example.com/mine.gif)';

    expect(composeApprove(['LGTM'], [GIF], mine, pickSequence(0))).toBe(`${mine}\n\n![LGTM](${GIF})`);
  });

  /** A fresh pick every click means our own earlier text must not read as prose. */
  test('rerolls to another candidate when the box holds one of them', () => {
    const quotes = ['first quote', 'second quote'];
    const current = `first quote\n\n![first quote](${GIF})`;

    expect(composeApprove(quotes, [GIF], current, pickSequence(0.9))).toBe(`second quote\n\n![second quote](${GIF})`);
  });

  test('rerolls to another candidate with no gifs configured', () => {
    expect(composeApprove(['first quote', 'second quote'], [], 'first quote', pickSequence(0.9))).toBe('second quote');
  });

  /** The alt was picked on an earlier click, so it need not be the current pick. */
  test('recognises our gif by an alt matching any candidate', () => {
    const current = `nice refactor\n\n![second quote](${OTHER_GIF})`;

    expect(composeApprove(['first quote', 'second quote'], [GIF], current, pickSequence(0))).toBe(
      `nice refactor\n\n![first quote](${GIF})`,
    );
  });

  test('writes nothing when the candidate list holds only blanks', () => {
    expect(composeApprove(['', '   '], [GIF], '', pickSequence(0))).toBe('');
  });

  test('treats a candidate list of only blanks like an empty one under typed text', () => {
    expect(composeApprove(['', '   '], [GIF], 'nice', pickSequence(0))).toBe(`nice\n\n![](${GIF})`);
  });
  /** A quote sits under the comment, so a body can span lines while an alt cannot. */
  test('uses only the first line of a multi-line body as the alt text', () => {
    expect(composeApprove(['LGTM 🚀\n\nSimplicity. — Someone'], [GIF], '', pickSequence(0))).toBe(
      `LGTM 🚀\n\nSimplicity. — Someone\n\n![LGTM 🚀](${GIF})`,
    );
  });

  test('rerolls a multi-line body, gif and all', () => {
    const bodies = ['LGTM\n\nfirst quote', 'LGTM\n\nsecond quote'];
    const current = `LGTM\n\nfirst quote\n\n![LGTM](${GIF})`;

    expect(composeApprove(bodies, [GIF, OTHER_GIF], current, pickSequence(0.9))).toBe(
      `LGTM\n\nsecond quote\n\n![LGTM](${OTHER_GIF})`,
    );
  });

  test('recognises our gif by an alt matching a body first line', () => {
    const current = `nice refactor\n\n![LGTM](${OTHER_GIF})`;

    expect(composeApprove(['LGTM\n\nfirst quote'], [GIF], current, pickSequence(0))).toBe(
      `nice refactor\n\n![LGTM](${GIF})`,
    );
  });
});

describe('approveBodies', () => {
  test('yields the comment on its own when no quotes are configured', () => {
    expect(approveBodies('LGTM 🚀', [])).toEqual(['LGTM 🚀']);
  });

  test('puts each quote under the comment', () => {
    expect(approveBodies('LGTM 🚀', ['first quote', 'second quote'])).toEqual([
      'LGTM 🚀\n\nfirst quote',
      'LGTM 🚀\n\nsecond quote',
    ]);
  });

  /** Nothing to sit under, so the quote stands alone rather than under a blank line. */
  test('yields the quote alone when the comment is blank', () => {
    expect(approveBodies('', ['first quote'])).toEqual(['first quote']);
  });

  test('yields the comment alone when a quote is blank', () => {
    expect(approveBodies('LGTM 🚀', ['  '])).toEqual(['LGTM 🚀']);
  });
});
