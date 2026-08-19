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

/** Clicks the first button whose visible caption matches, in the page. */
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

/** Opens the inline editor on the first diff line that offers one. */
const openDiffComment = `(() => {
  const trigger = document.querySelector(
    'button[aria-label*="Add a comment" i], button[data-testid*="add-line-comment" i], td.blob-code button.add-line-comment',
  );
  if (!trigger) {
    return false;
  }
  trigger.click();
  return true;
})()`;

export const scenarios = {
  review: {
    description: 'the "Finish your review" dialog',
    steps: [
      { name: 'open-review-menu', expression: clickByCaption('/^(Review changes|Add your review)$/i') },
      { name: 'await-textarea', awaitSelector: 'textarea' },
    ],
  },
  'diff-comment': {
    description: 'an inline diff comment editor',
    // The files tab is a separate URL rather than a click, so the CLI navigates
    // there first; soft navigation would race the observer re-arming.
    navigateSuffix: '/files',
    steps: [
      { name: 'open-diff-comment', expression: openDiffComment },
      { name: 'await-textarea', awaitSelector: 'textarea' },
    ],
  },
};
