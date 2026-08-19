import { DEFAULT_URL, parseArgs } from './args.mjs';

test('defaults to the review scenario on the test PR', () => {
  expect(parseArgs([])).toEqual({ scenario: 'review', url: DEFAULT_URL });
});

test('takes the scenario as a positional argument', () => {
  expect(parseArgs(['diff-comment'])).toEqual({
    scenario: 'diff-comment',
    url: DEFAULT_URL,
  });
});

test('takes a URL in either position', () => {
  const url = 'https://github.com/getsentry/praise/pull/7';

  expect(parseArgs([url])).toEqual({ scenario: 'review', url });
  expect(parseArgs(['diff-comment', url])).toEqual({ scenario: 'diff-comment', url });
  expect(parseArgs([url, 'diff-comment'])).toEqual({ scenario: 'diff-comment', url });
});

test('accepts the soft-nav regression scenario', () => {
  expect(parseArgs(['soft-nav-review'])).toEqual({
    scenario: 'soft-nav-review',
    url: DEFAULT_URL,
  });
});

test('reports an unknown scenario rather than guessing', () => {
  const result = parseArgs(['reviw']);

  expect(result.error).toContain('reviw');
  expect(result.error).toContain('review');
});
