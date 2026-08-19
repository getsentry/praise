import { findApproveRadio, findSubmitReviewButton } from './selectors';

/** Choosing a verdict rebuilds the footer, so Submit can only be read after it. */
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
 * Clicks rather than assigning `checked`, which React reverts on the next
 * render. Bails without submitting when either control is missing or disabled,
 * leaving the dialog open rather than posting something that is not an approval.
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
