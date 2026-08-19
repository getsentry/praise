import { findApproveRadio, findSubmitReviewButton } from './selectors';

/**
 * Lets React re-render between the two clicks.
 *
 * Choosing a verdict rebuilds the dialog footer -- "Submit review" is disabled
 * until there is one -- so reading the button before the render lands finds the
 * stale, disabled one and the approval silently never goes out.
 */
function nextFrame(): Promise<void> {
  return new Promise(resolve => {
    requestAnimationFrame(() => {
      resolve();
    });
  });
}

/**
 * Chooses the Approve verdict and submits the review.
 *
 * Clicks rather than assigning `checked`: the radios are React-controlled, and a
 * direct assignment is reverted on the next render without the verdict ever
 * reaching React's state.
 *
 * Bails without submitting whenever either control is missing or disabled. The
 * dialog is left open with whatever we wrote in it, so the click degrades to
 * "filled the box for you" rather than posting something other than an approval.
 *
 * @returns Whether the review was submitted.
 */
export async function submitApproval(
  textarea: HTMLTextAreaElement,
  wait: () => Promise<void> = nextFrame,
): Promise<boolean> {
  const radio = findApproveRadio(textarea);
  if (!radio) {
    return false;
  }

  radio.click();
  await wait();

  const submit = findSubmitReviewButton(textarea);
  if (!submit) {
    return false;
  }

  submit.click();
  return true;
}
