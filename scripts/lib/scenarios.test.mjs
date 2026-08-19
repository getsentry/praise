/**
 * `soft-nav-review` is the only scenario whose target and steps depend on the
 * URL the CLI was given, so that derivation is worth testing in isolation from
 * the browser the rest of the scenario needs.
 */

import { scenarios } from './scenarios.mjs';

const prUrl = 'https://github.com/getsentry/praise/pull/22';

test('navigates to the PR list, not the PR itself', () => {
  expect(scenarios['soft-nav-review'].navigateTo(prUrl)).toBe('https://github.com/getsentry/praise/pulls');
});

test('rejects a URL that is not a pull request', () => {
  expect(() => scenarios['soft-nav-review'].navigateTo('https://github.com/getsentry/praise/issues/22')).toThrow(
    /pull request/,
  );
});

test('builds steps that target the PR from the given URL', () => {
  const steps = scenarios['soft-nav-review'].steps(prUrl);
  const names = steps.map(step => step.name);

  expect(names).toEqual([
    'click-pr-link',
    'await-pr-path',
    'click-files-tab',
    'await-changes-path',
    'open-review-menu',
    'await-textarea',
  ]);

  // The click and the wait must agree on the same path, or the wait can pass on
  // a page the click never actually reached.
  expect(steps[0].expression).toContain('/getsentry/praise/pull/22');
  expect(steps[1].awaitExpression).toContain('/getsentry/praise/pull/22');
});

test('reaches the Files tab by href rather than by caption', () => {
  // The tab is a plain `<a>`, which `clickByCaption` does not scan, so a
  // caption-matched click finds nothing on a real page.
  const [, , filesTab] = scenarios['soft-nav-review'].steps(prUrl);

  expect(filesTab.expression).toContain('/getsentry/praise/pull/22/files');
  expect(filesTab.expression).toContain('a[href]');
});

test('ends on the same review-opening steps the direct-load scenario uses', () => {
  const softNavSteps = scenarios['soft-nav-review'].steps(prUrl);
  const reviewSteps = scenarios.review.steps;

  expect(softNavSteps.slice(-reviewSteps.length)).toEqual(reviewSteps);
});
