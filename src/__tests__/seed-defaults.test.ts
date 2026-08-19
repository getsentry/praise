import { computeSeed, DEFAULT_COMMENTS, DEFAULT_REVIEWS, type StoredSettings } from '../lib/seed-defaults';

describe('DEFAULT_REVIEWS / DEFAULT_COMMENTS', () => {
  test('DEFAULT_REVIEWS holds the four canonical review bodies', () => {
    expect(DEFAULT_REVIEWS).toEqual(['LGTM 🚀', 'Ship it 🚢', 'RSLGTM 🏆', 'Good job 👏']);
  });

  test('DEFAULT_COMMENTS holds ten non-empty strings', () => {
    expect(DEFAULT_COMMENTS).toHaveLength(10);
    for (const comment of DEFAULT_COMMENTS) {
      expect(typeof comment).toBe('string');
      expect(comment.length).toBeGreaterThan(0);
    }
  });
});

describe('computeSeed', () => {
  test('seeds both keys for empty storage', () => {
    const patch = computeSeed({});

    expect(Object.keys(patch).sort()).toEqual(['comments', 'reviews']);
    expect(patch.reviews).toEqual(DEFAULT_REVIEWS);
    expect(patch.comments).toEqual(DEFAULT_COMMENTS);
  });

  test('seeds nothing when both keys hold non-empty arrays', () => {
    const patch = computeSeed({ reviews: ['nice'], comments: ['great'] });

    expect(Object.keys(patch)).toEqual([]);
    expect(patch).toEqual({});
  });

  test('seeds only comments when reviews is populated', () => {
    const patch = computeSeed({ reviews: ['nice'] });

    expect(Object.keys(patch)).toEqual(['comments']);
    expect(patch.comments).toEqual(DEFAULT_COMMENTS);
  });

  test('seeds only reviews when comments is populated', () => {
    const patch = computeSeed({ comments: ['great'] });

    expect(Object.keys(patch)).toEqual(['reviews']);
    expect(patch.reviews).toEqual(DEFAULT_REVIEWS);
  });

  test('seeds both keys when both hold empty arrays', () => {
    const patch = computeSeed({ reviews: [], comments: [] });

    expect(Object.keys(patch).sort()).toEqual(['comments', 'reviews']);
    expect(patch.reviews).toEqual(DEFAULT_REVIEWS);
    expect(patch.comments).toEqual(DEFAULT_COMMENTS);
  });

  test('seeds keys holding strings instead of arrays', () => {
    const stored: StoredSettings = { reviews: 'LGTM', comments: '' };
    const patch = computeSeed(stored);

    expect(Object.keys(patch).sort()).toEqual(['comments', 'reviews']);
    expect(patch.reviews).toEqual(DEFAULT_REVIEWS);
    expect(patch.comments).toEqual(DEFAULT_COMMENTS);
  });

  test('seeds keys holding null or undefined', () => {
    const stored: StoredSettings = { reviews: null, comments: undefined };
    const patch = computeSeed(stored);

    expect(Object.keys(patch).sort()).toEqual(['comments', 'reviews']);
    expect(patch.reviews).toEqual(DEFAULT_REVIEWS);
    expect(patch.comments).toEqual(DEFAULT_COMMENTS);
  });

  test('seeds keys holding objects, numbers or booleans', () => {
    const stored: StoredSettings = { reviews: { 0: 'LGTM', length: 1 }, comments: 42 };
    const patch = computeSeed(stored);

    expect(Object.keys(patch).sort()).toEqual(['comments', 'reviews']);
    expect(patch.reviews).toEqual(DEFAULT_REVIEWS);
    expect(patch.comments).toEqual(DEFAULT_COMMENTS);

    const other = computeSeed({ reviews: true, comments: {} } as StoredSettings);
    expect(Object.keys(other).sort()).toEqual(['comments', 'reviews']);
  });

  test('a populated key stays absent even when the other is garbage', () => {
    const patch = computeSeed({ reviews: ['nice'], comments: 'not an array' });

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
    expect(computeSeed({}).reviews).toEqual(DEFAULT_REVIEWS);
    expect(computeSeed({}).comments).toEqual(DEFAULT_COMMENTS);
  });

  test('returns copies, so editing a patch leaves the defaults intact', () => {
    const patch = computeSeed({});

    expect(patch.reviews).not.toBe(DEFAULT_REVIEWS);
    expect(patch.comments).not.toBe(DEFAULT_COMMENTS);

    patch.reviews?.push('mutated');
    patch.comments?.push('mutated');

    expect(DEFAULT_REVIEWS).not.toContain('mutated');
    expect(DEFAULT_COMMENTS).not.toContain('mutated');
    expect(computeSeed({}).reviews).toEqual(DEFAULT_REVIEWS);
    expect(computeSeed({}).comments).toEqual(DEFAULT_COMMENTS);
  });

  test('returned arrays carry the defaults contents', () => {
    const patch = computeSeed({});

    expect(patch.reviews).toEqual([...DEFAULT_REVIEWS]);
    expect(patch.comments).toEqual([...DEFAULT_COMMENTS]);
    expect(patch.reviews).toHaveLength(DEFAULT_REVIEWS.length);
    expect(patch.comments).toHaveLength(DEFAULT_COMMENTS.length);
  });
});
