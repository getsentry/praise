import { findReviewCommentButton } from './selectors';

/** The button activates on React's render of the praise, so it can only be read after it. */
function nextFrame(): Promise<void> {
  return new Promise(resolve => {
    requestAnimationFrame(() => {
      resolve();
    });
  });
}

/**
 * Files the comment as part of a review, starting one if none is pending.
 *
 * Which of the two it is, GitHub decides -- the caption is its own record of
 * whether a review is open, so joining an existing review and starting a fresh
 * one are the same click.
 *
 * Waits before looking, like `submitApproval`: an empty editor renders both
 * submit buttons inactive, and the praise we just wrote only activates them once
 * React has re-rendered on it. Reading in the same tick finds the button as it
 * was before the write.
 *
 * @returns Whether the comment was submitted. `false` leaves the editor open
 *   with the praise in it rather than posting a standalone comment.
 */
export async function submitReviewComment(
  textarea: HTMLTextAreaElement,
  wait: () => Promise<void> = nextFrame,
): Promise<boolean> {
  await wait();

  const button = findReviewCommentButton(textarea);
  if (!button) {
    return false;
  }

  button.click();
  return true;
}
