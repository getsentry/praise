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
 * Opens the inline editor on the first diff line that offers one.
 *
 * The trigger is only rendered while the row is hovered, so the hover has to be
 * simulated before it exists to click.
 */
const openDiffComment = `(() => {
  const rows = document.querySelectorAll('tr.diff-line-row, .diff-table tr');
  for (const row of rows) {
    for (const type of ['pointerover', 'mouseover', 'mouseenter', 'mousemove']) {
      row.dispatchEvent(new MouseEvent(type, { bubbles: true }));
      for (const cell of row.children) {
        cell.dispatchEvent(new MouseEvent(type, { bubbles: true }));
      }
    }

    const trigger = row.querySelector(
      'button[aria-label="Add comment" i], button[aria-label*="Add a comment" i], button.add-line-comment',
    );
    if (trigger) {
      trigger.click();
      return true;
    }
  }
  return false;
})()`;

/** GitHub redirects `/files` here, and the review trigger exists only on it. */
const changesTab = '/changes';

export const scenarios = {
  review: {
    description: 'the "Finish your review" dialog',
    navigateSuffix: changesTab,
    steps: [
      { name: 'open-review-menu', expression: clickByCaption('/Submit review|Review changes|Add your review/i') },
      { name: 'await-textarea', awaitSelector: 'textarea' },
    ],
  },
  'diff-comment': {
    description: 'an inline diff comment editor',
    navigateSuffix: changesTab,
    steps: [
      { name: 'open-diff-comment', expression: openDiffComment },
      { name: 'await-textarea', awaitSelector: 'textarea' },
    ],
  },
};
