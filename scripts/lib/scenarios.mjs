/**
 * Driving the page into the states where our button exists.
 *
 * Navigation alone proves nothing: the button is only ever inside an open
 * comment editor, so each scenario has to open one. The two are separate
 * because `selectors.ts` reaches them by different routes -- `reviewDialog`
 * versus `diffCommentEditor` -- and a regression usually breaks one, not both.
 *
 * Steps are described here and executed by the CLI, so a failure can name the
 * step that failed. When GitHub moves its markup, that name is the diagnostic.
 */

/**
 * Clicks the first button whose visible caption matches.
 *
 * Matched loosely, not anchored: Primer nests captions, so `textContent`
 * concatenates them -- the review trigger reads "Submit reviewReview".
 */
const clickByCaption = pattern => `(() => {
  const caption = element => (element.textContent ?? '').replace(/\\s+/g, ' ').trim();
  for (const button of document.querySelectorAll('button, summary, a[role="button"]')) {
    if (${pattern}.test(caption(button))) {
      button.click();
      return true;
    }
  }
  return false;
})()`;

/**
 * The hover control that opens an inline comment, across GitHub's variants.
 *
 * The wait and the click share this one selector -- when they drifted apart, the
 * narrower wait timed out and reported a placement failure on a trigger that was
 * present and clickable.
 */
const diffCommentTrigger =
  'button[aria-label="Add comment" i], button[aria-label*="Add a comment" i], button.add-line-comment';

/** Opens the inline editor on the diff line the pointer is over. */
const openDiffComment = `(() => {
  const trigger = document.querySelector(${JSON.stringify(diffCommentTrigger)});
  if (!trigger) {
    return false;
  }
  trigger.click();
  return true;
})()`;

/** GitHub redirects `/files` here, and the review trigger exists only on it. */
const changesTab = '/changes';

/** Shared by `review` and `soft-nav-review`: both end at the same dialog. */
const openReviewSteps = [
  { name: 'open-review-menu', expression: clickByCaption('/Submit review|Review changes|Add your review/i') },
  { name: 'await-textarea', awaitSelector: 'textarea' },
];

/** Throws rather than silently probing the wrong page when the URL is not a PR. */
function parsePullUrl(url) {
  const { origin, pathname } = new URL(url);
  const match = pathname.match(/^\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
  if (!match) {
    throw new Error(`expected a pull request URL, got ${url}`);
  }
  const [, owner, repo, number] = match;
  return { origin, owner, repo, number, path: `/${owner}/${repo}/pull/${number}` };
}

/**
 * Clicks the PR list's link to one specific pull request.
 *
 * Matched by normalized pathname, not by number alone -- `/pull/2` is a
 * substring of `/pull/22`, and a loose match would click the wrong row.
 */
const clickPullLink = pullPath => `(() => {
  for (const link of document.querySelectorAll('a[href*="/pull/"]')) {
    if (new URL(link.href, location.origin).pathname.replace(/\\/$/, '') === ${JSON.stringify(pullPath)}) {
      link.click();
      return true;
    }
  }
  return false;
})()`;

/**
 * Clicks through to a PR's Files tab.
 *
 * Matched on href, not caption: the tab is a plain `<a>`, which
 * `clickByCaption` deliberately does not scan.
 */
const clickFilesTab = pullPath => `(() => {
  for (const link of document.querySelectorAll('a[href]')) {
    if (new URL(link.href, location.origin).pathname === ${JSON.stringify(`${pullPath}/files`)}) {
      link.click();
      return true;
    }
  }
  return false;
})()`;

export const scenarios = {
  review: {
    description: 'the "Finish your review" dialog',
    navigateSuffix: changesTab,
    steps: openReviewSteps,
  },
  'soft-nav-review': {
    description: 'the "Finish your review" dialog, reached by same-document navigation from the PR list',
    // Regression coverage for the bug a direct load can never reproduce: Chrome
    // only evaluates `content_scripts.matches` on a real document load, and
    // GitHub's own navigation between these pages is same-document, so a fix
    // that only works on the first load would still pass every other scenario.
    navigateTo: url => {
      const { origin, owner, repo } = parsePullUrl(url);
      return `${origin}/${owner}/${repo}/pulls`;
    },
    steps: url => {
      const { path } = parsePullUrl(url);
      return [
        { name: 'click-pr-link', expression: clickPullLink(path) },
        { name: 'await-pr-path', awaitExpression: `location.pathname.replace(/\\/$/, '') === ${JSON.stringify(path)}` },
        { name: 'click-files-tab', expression: clickFilesTab(path) },
        // GitHub redirects `/files` to `/changes`; either is the page the review trigger lives on.
        { name: 'await-changes-path', awaitExpression: `/\\/(files|changes)$/.test(location.pathname)` },
        ...openReviewSteps,
      ];
    },
  },
  'diff-comment': {
    description: 'an inline diff comment editor',
    navigateSuffix: changesTab,
    steps: [
      { name: 'await-diff', awaitSelector: 'tr.diff-line-row td.diff-text-cell' },
      { name: 'hover-diff-line', hoverSelector: 'tr.diff-line-row td.diff-text-cell' },
      // React renders the trigger after the hover lands, so wait for it rather
      // than clicking into the gap.
      { name: 'await-comment-trigger', awaitSelector: diffCommentTrigger },
      { name: 'open-diff-comment', expression: openDiffComment },
      { name: 'await-textarea', awaitSelector: 'textarea' },
    ],
  },
};
