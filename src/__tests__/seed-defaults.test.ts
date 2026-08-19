import {
  computeSeed,
  DEFAULT_APPROVE_COMMENT,
  DEFAULT_APPROVE_GIFS,
  DEFAULT_COMMENTS,
  type StoredSettings,
} from '../lib/seed-defaults';

/**
 * Settings that need no seeding, so each case below can assert on the exact set
 * of keys the patch carries.
 */
const SEEDED = {
  approveComment: 'Nice one',
  approveGifs: ['https://media.giphy.com/media/abc/giphy.gif'],
  approveGifsEnabled: false,
};

describe('DEFAULT_APPROVE_COMMENT / DEFAULT_COMMENTS / DEFAULT_APPROVE_GIFS', () => {
  test('DEFAULT_APPROVE_COMMENT is the single canonical approve body', () => {
    expect(DEFAULT_APPROVE_COMMENT).toBe('LGTM 🚀');
  });

  test('DEFAULT_COMMENTS holds ten non-empty strings', () => {
    expect(DEFAULT_COMMENTS).toHaveLength(10);
    for (const comment of DEFAULT_COMMENTS) {
      expect(typeof comment).toBe('string');
      expect(comment.length).toBeGreaterThan(0);
    }
  });

  test('DEFAULT_APPROVE_GIFS holds direct giphy media urls', () => {
    expect(DEFAULT_APPROVE_GIFS.length).toBeGreaterThan(0);
    for (const gif of DEFAULT_APPROVE_GIFS) {
      expect(gif).toMatch(/^https:\/\/media\.giphy\.com\/media\/[\w-]+\/giphy\.gif$/);
    }
  });

  test('DEFAULT_APPROVE_GIFS holds no duplicates', () => {
    expect(new Set(DEFAULT_APPROVE_GIFS).size).toBe(DEFAULT_APPROVE_GIFS.length);
  });
});

describe('computeSeed', () => {
  test('seeds every key for empty storage', () => {
    const patch = computeSeed({});

    expect(Object.keys(patch).sort()).toEqual(['approveComment', 'approveGifs', 'approveGifsEnabled', 'comments']);
    expect(patch.approveComment).toBe(DEFAULT_APPROVE_COMMENT);
    expect(patch.comments).toEqual(DEFAULT_COMMENTS);
    expect(patch.approveGifs).toEqual(DEFAULT_APPROVE_GIFS);
    expect(patch.approveGifsEnabled).toBe(true);
  });

  test('seeds nothing when every key already holds a usable value', () => {
    const patch = computeSeed({ comments: ['great'], ...SEEDED });

    expect(Object.keys(patch)).toEqual([]);
    expect(patch).toEqual({});
  });

  test('seeds only comments when the approve comment is set', () => {
    const patch = computeSeed({ ...SEEDED });

    expect(Object.keys(patch)).toEqual(['comments']);
    expect(patch.comments).toEqual(DEFAULT_COMMENTS);
  });

  test('seeds only the approve comment when comments are set', () => {
    const patch = computeSeed({
      comments: ['great'],
      approveGifs: SEEDED.approveGifs,
      approveGifsEnabled: false,
    });

    expect(Object.keys(patch)).toEqual(['approveComment']);
    expect(patch.approveComment).toBe(DEFAULT_APPROVE_COMMENT);
  });

  /** Seeding runs on update too, so an emptied list must stay emptied. */
  test('leaves comments holding an empty array alone', () => {
    const patch = computeSeed({ comments: [], ...SEEDED });

    expect(Object.keys(patch)).toEqual([]);
  });

  test('seeds keys holding the wrong type', () => {
    for (const stored of [
      { approveComment: 42, comments: '' },
      { approveComment: null, comments: undefined },
      { approveComment: ['LGTM'], comments: 42 },
      { approveComment: {}, comments: {} },
    ] as StoredSettings[]) {
      const patch = computeSeed({ approveGifs: SEEDED.approveGifs, approveGifsEnabled: false, ...stored });

      expect(Object.keys(patch).sort()).toEqual(['approveComment', 'comments']);
      expect(patch.approveComment).toBe(DEFAULT_APPROVE_COMMENT);
      expect(patch.comments).toEqual(DEFAULT_COMMENTS);
    }
  });

  test('treats a blank approve comment as unseeded', () => {
    const patch = computeSeed({ comments: ['great'], ...SEEDED, approveComment: '   ' });

    expect(patch.approveComment).toBe(DEFAULT_APPROVE_COMMENT);
  });

  test('a populated key stays absent even when another is garbage', () => {
    const patch = computeSeed({ comments: 'not an array', ...SEEDED });

    expect(Object.keys(patch)).toEqual(['comments']);
    expect(patch.comments).toEqual(DEFAULT_COMMENTS);
  });

  test('does not mutate its input', () => {
    const stored: StoredSettings = { reviews: [], comments: 'LGTM' };
    const snapshot = { reviews: stored.reviews, comments: stored.comments };

    computeSeed(stored);

    expect(stored).toEqual(snapshot);
    expect(stored.reviews).toBe(snapshot.reviews);
    expect(stored.reviews).toEqual([]);
    expect(stored.comments).toBe('LGTM');
    expect(Object.keys(stored).sort()).toEqual(['comments', 'reviews']);
  });

  test('repeated calls return equal patches', () => {
    expect(computeSeed({})).toEqual(computeSeed({}));
    expect(computeSeed({}).approveComment).toBe(DEFAULT_APPROVE_COMMENT);
    expect(computeSeed({}).comments).toEqual(DEFAULT_COMMENTS);
    expect(computeSeed({}).approveGifs).toEqual(DEFAULT_APPROVE_GIFS);
  });

  test('returns copies, so editing a patch leaves the defaults intact', () => {
    const patch = computeSeed({});

    expect(patch.comments).not.toBe(DEFAULT_COMMENTS);
    expect(patch.approveGifs).not.toBe(DEFAULT_APPROVE_GIFS);

    patch.comments?.push('mutated');
    patch.approveGifs?.push('mutated');

    expect(DEFAULT_COMMENTS).not.toContain('mutated');
    expect(DEFAULT_APPROVE_GIFS).not.toContain('mutated');
    expect(computeSeed({}).comments).toEqual(DEFAULT_COMMENTS);
    expect(computeSeed({}).approveGifs).toEqual(DEFAULT_APPROVE_GIFS);
  });

  test('returned arrays carry the defaults contents', () => {
    const patch = computeSeed({});

    expect(patch.comments).toEqual([...DEFAULT_COMMENTS]);
    expect(patch.approveGifs).toEqual([...DEFAULT_APPROVE_GIFS]);
    expect(patch.comments).toHaveLength(DEFAULT_COMMENTS.length);
    expect(patch.approveGifs).toHaveLength(DEFAULT_APPROVE_GIFS.length);
  });
});

describe('computeSeed / migrating the old reviews list', () => {
  const rest = { comments: ['great'], approveGifs: SEEDED.approveGifs, approveGifsEnabled: false };

  test('carries a customised praise over from the old list', () => {
    const patch = computeSeed({ reviews: ['Beautiful work ✨', 'Ship it'], ...rest });

    expect(patch.approveComment).toBe('Beautiful work ✨');
  });

  test('skips blank and non-string entries when carrying over', () => {
    const patch = computeSeed({ reviews: [null, '', '  ', 7, 'Real praise'], ...rest } as StoredSettings);

    expect(patch.approveComment).toBe('Real praise');
  });

  test('falls back to the default when the old list holds nothing usable', () => {
    for (const reviews of [[], ['   '], [42], 'not an array', null]) {
      const patch = computeSeed({ reviews, ...rest } as StoredSettings);

      expect(patch.approveComment).toBe(DEFAULT_APPROVE_COMMENT);
    }
  });

  /** The new key wins outright; the old list is only a fallback. */
  test('leaves an existing approve comment alone', () => {
    const patch = computeSeed({ reviews: ['Old praise'], approveComment: 'Current praise', ...rest });

    expect(patch.approveComment).toBeUndefined();
    expect(Object.keys(patch)).toEqual([]);
  });

  test('never writes the old key back', () => {
    const patch = computeSeed({ reviews: ['Beautiful work ✨'], ...rest });

    expect(patch).not.toHaveProperty('reviews');
  });
});

describe('computeSeed / gif settings', () => {
  const populated = { approveComment: 'LGTM', comments: ['great'] };

  test('seeds the gif list when it is missing or not a list', () => {
    for (const stored of [{}, { approveGifs: 'nope' }, { approveGifs: null }, { approveGifs: 42 }]) {
      const patch = computeSeed({ ...populated, approveGifsEnabled: true, ...stored });

      expect(patch.approveGifs).toEqual(DEFAULT_APPROVE_GIFS);
    }
  });

  /**
   * The bug this guards: seeding runs on update, so treating "empty" as
   * "unseeded" handed the defaults back to anyone who had deleted every gif.
   */
  test('leaves an emptied gif list empty', () => {
    const patch = computeSeed({ ...populated, approveGifs: [], approveGifsEnabled: true });

    expect(patch.approveGifs).toBeUndefined();
    expect(Object.keys(patch)).toEqual([]);
  });

  test('leaves a populated gif list alone', () => {
    const patch = computeSeed({ ...populated, ...SEEDED });

    expect(patch.approveGifs).toBeUndefined();
  });

  test('seeds the toggle to enabled when it is missing', () => {
    const patch = computeSeed({ ...populated, approveGifs: SEEDED.approveGifs });

    expect(Object.keys(patch)).toEqual(['approveGifsEnabled']);
    expect(patch.approveGifsEnabled).toBe(true);
  });

  /** The whole point of the toggle: an explicit `false` must survive seeding. */
  test('leaves the toggle alone when it is already false', () => {
    const patch = computeSeed({ ...populated, ...SEEDED });

    expect(patch.approveGifsEnabled).toBeUndefined();
    expect(Object.keys(patch)).toEqual([]);
  });

  test('leaves the toggle alone when it is already true', () => {
    const patch = computeSeed({ ...populated, approveGifs: SEEDED.approveGifs, approveGifsEnabled: true });

    expect(patch.approveGifsEnabled).toBeUndefined();
  });

  test('reseeds the toggle when it holds a non-boolean', () => {
    for (const value of ['true', 0, null, {}]) {
      const patch = computeSeed({ ...populated, approveGifs: SEEDED.approveGifs, approveGifsEnabled: value });

      expect(patch.approveGifsEnabled).toBe(true);
    }
  });
});
