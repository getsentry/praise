/**
 * Selectors for GitHub's PR comment and review UI.
 *
 * GitHub's PR pages are Primer React components whose CSS-module class names
 * carry a hash that rotates on every deploy (`ReviewMenu-module__Foo__a1b2c`).
 * So prefer, in order:
 *
 *   1. `data-component` attributes -- hard-coded in Primer's source, never hashed.
 *   2. `class*=` on the un-hashed prefix.
 *   3. Legacy Rails/Turbo markup, still served to viewers without the
 *      `prx_files` / `react_data_router_pull_request_files` flags.
 *
 * We deliberately anchor on the textarea and on button captions, not on container
 * classes. The editor is built from several nested wrappers whose names overlap
 * between the review dialog and the inline diff editor -- and one of them,
 * `ReviewMenuFooter-module__SubmitReviewButton`, names a *button* rather than a
 * row -- so container matching produced both duplicate and nested buttons.
 */

/** A markdown comment body. Real <textarea>, but React-controlled. */
export const markdownTextarea = [
  'textarea[class*="MarkdownInput-module__textArea"]',
  'textarea[data-component="Textarea"]',
  'textarea[placeholder="Leave a comment"]',
  // Legacy views.
  "textarea#pull_request_review_body",
  "textarea#new_comment_field",
  "#files textarea",
];

/** The "Finish your review" modal, used to tell reviews from inline comments. */
export const reviewDialog = [
  '[data-component="Dialog"][role="dialog"]',
  '[role="dialog"][aria-modal="true"]',
  "#review-changes-modal", // legacy
];

/**
 * The button we sit to the left of.
 *
 * Cancel has no id, aria-label or data-testid, so we match the accessible name.
 *
 * Requiring Cancel specifically -- rather than accepting any of the editor's
 * buttons -- is also what keeps the praise button out of editors it doesn't
 * belong in. The PR conversation composer ("Add a comment") has only
 * "Close pull request" and "Comment", no Cancel, because it is always open
 * rather than opened for a single reply. Praise is for reviews and diff
 * comments, so no Cancel means no button.
 */
const anchorLabel = "Cancel";

/**
 * Finds the Cancel button within `scope`, if it has one.
 *
 * The dialog header's `aria-label="Close"` X button has no text, so it can never
 * be mistaken for it.
 */
function findAnchorButton(scope: HTMLElement): HTMLElement | undefined {
  const buttons = scope.querySelectorAll<HTMLElement>("button");

  for (const button of buttons) {
    if (buttonLabel(button) === anchorLabel) {
      return button;
    }
  }

  return undefined;
}

function buttonLabel(button: HTMLElement): string {
  return (button.textContent ?? "").replace(/\s+/g, " ").trim();
}

export type InsertionPoint = {
  /** The button row to inject into. */
  row: HTMLElement;
  /** The element to insert before. */
  before: HTMLElement;
};

/**
 * Outermost elements the walk may consider.
 *
 * The buttons are searched for *within* the boundary too -- in the review dialog
 * the footer is a sibling of `Dialog.Body`, so only the dialog itself contains
 * both the textarea and Cancel. Stopping here keeps us from reaching further out
 * and grabbing a button that belongs to the page, such as the diff toolbar's own
 * "Submit review".
 */
const editorBoundary = [...reviewDialog, "form", "#files"];

/**
 * Finds where to put our button: immediately before the editor's Cancel button.
 *
 * Walks up from the textarea until an ancestor contains a button we recognise,
 * then inserts into *that button's own parent* -- the button row -- rather than
 * into the ancestor we searched from. Inserting into the ancestor is what put the
 * button below the textarea at full width, since the ancestor is a flex column
 * whose children stretch.
 *
 * @param textarea The comment body.
 */
export function findInsertionPoint(
  textarea: HTMLTextAreaElement,
): InsertionPoint | undefined {
  const boundary = editorBoundary.join(",");
  let element: HTMLElement | null = textarea.parentElement;

  for (let depth = 0; element && depth < 12; depth++) {
    const anchor = findAnchorButton(element);
    if (!anchor?.parentElement) {
      // Search the boundary itself, then stop.
      element = element.matches(boundary) ? null : element.parentElement;
      continue;
    }

    // Primer sometimes wraps a button in a tooltip or layout element. Insert
    // before that wrapper so we become a sibling of the visible buttons, not of
    // the wrapper's internals.
    let before: HTMLElement = anchor;
    while (
      before.parentElement &&
      before.parentElement !== element &&
      before.parentElement.children.length === 1
    ) {
      before = before.parentElement;
    }

    return { row: before.parentElement!, before };
  }

  return undefined;
}
