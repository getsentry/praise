import { findReviewCommentButton } from './selectors';

function nextFrame(): Promise<void> {
  return new Promise(resolve => {
    requestAnimationFrame(() => {
      resolve();
    });
  });
}

/**
 * Starts a review with the comment, or adds it to the pending one -- GitHub's
 * caption decides which, so both are the same click.
 *
 * Waits first: an empty editor renders its submit buttons inactive, and the
 * praise only activates them once React has re-rendered on it.
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
