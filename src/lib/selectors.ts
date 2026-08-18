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
 * Placement is decided in two steps, because neither alone is enough:
 *
 *   - `praiseContext()` checks the textarea is inside the review dialog or a diff
 *     comment editor. This is what keeps us off the rest of the page.
 *   - `findInsertionPoint()` then walks up to that editor's own Cancel button.
 *
 * The walk deliberately keys on the textarea and the button caption rather than
 * on container classes: the editor is built from nested wrappers whose names
 * overlap between the review dialog and the inline editor -- and one of them,
 * `ReviewMenuFooter-module__SubmitReviewButton`, names a *button* rather than a
 * row -- so container matching produced duplicate and nested buttons.
 */

/**
 * A markdown comment body. Real <textarea>, but React-controlled.
 *
 * These match any Primer markdown editor on the page, including ones we want
 * nothing to do with, so every hit must still pass `praiseContext()`.
 */
export const markdownTextarea = [
  'textarea[class*="MarkdownInput-module__textArea"]',
  'textarea[data-component="Textarea"]',
  'textarea[placeholder="Leave a comment"]',
  // Legacy views.
  'textarea#pull_request_review_body',
  '#files textarea',
];

/** The "Finish your review" modal, used to tell reviews from inline comments. */
export const reviewDialog = [
  '[data-component="Dialog"][role="dialog"]',
  '[role="dialog"][aria-modal="true"]',
  '#review-changes-modal', // legacy
];

/**
 * The inline "Add a comment" editor on a diff line, and the review threads it
 * turns into.
 */
export const diffCommentEditor = [
  'div[class*="AddCommentEditor"]',
  '[data-testid="review-thread"]',
  'div[class*="ReviewThread"]',
  '#files', // legacy
];

/**
 * Which praise list an editor should draw from, or `undefined` if it should be
 * left alone.
 *
 * The textarea selectors above match any Primer markdown editor on the page, so
 * membership of one of these two regions is what limits us to review and diff
 * comments. Without it we would also decorate the PR description editor and
 * edit-in-place boxes on the conversation tab, none of which are praise.
 */
export function praiseContext(textarea: HTMLTextAreaElement): 'reviews' | 'comments' | undefined {
  if (textarea.closest(reviewDialog.join(','))) {
    return 'reviews';
  }

  if (textarea.closest(diffCommentEditor.join(','))) {
    return 'comments';
  }

  // Legacy review summary, which sits outside both regions.
  if (textarea.id === 'pull_request_review_body') {
    return 'reviews';
  }

  return undefined;
}

/**
 * The button we sit to the left of.
 *
 * Cancel has no id, aria-label or data-testid, so we match the accessible name.
 * Insisting on Cancel rather than any of the editor's buttons also keeps us out
 * of always-open composers, which have no Cancel because they were never opened
 * for a single reply.
 */
const anchorLabel = 'Cancel';

/**
 * Finds the Cancel button within `scope`, if it has one.
 *
 * The dialog header's `aria-label="Close"` X button has no text, so it can never
 * be mistaken for it.
 */
function findAnchorButton(scope: HTMLElement): HTMLElement | undefined {
  const buttons = scope.querySelectorAll<HTMLElement>('button');

  for (const button of buttons) {
    if (buttonLabel(button) === anchorLabel) {
      return button;
    }
  }

  return undefined;
}

function buttonLabel(button: HTMLElement): string {
  return (button.textContent ?? '').replace(/\s+/g, ' ').trim();
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
 *
 * These are the same regions `praiseContext()` admits, so the walk can never
 * leave the editor that let us in. `#files` on its own would not do: on React
 * pages the inline editor is not inside a `form` or `#files`, so without the
 * per-editor roots the walk could climb into a *neighbouring* editor and take
 * its Cancel -- which is likely exactly when a footer is still mounting and the
 * editor's own Cancel has not appeared yet.
 */
const editorBoundary = [...reviewDialog, ...diffCommentEditor, 'form'];

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
export function findInsertionPoint(textarea: HTMLTextAreaElement): InsertionPoint | undefined {
  const boundary = editorBoundary.join(',');
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
    //
    // Carrying the parent along rather than reading it back at the end is what
    // makes the row non-null without an assertion: `anchor` came from
    // `element.querySelectorAll`, so it is a descendant of `element` and the
    // loop only climbs while the next parent is still below `element`. `before`
    // therefore always has a parent -- but only `row` being a separate binding
    // lets the types say so.
    let before: HTMLElement = anchor;
    let row: HTMLElement = anchor.parentElement;

    while (row !== element && row.parentElement && row.children.length === 1) {
      before = row;
      row = row.parentElement;
    }

    return { row, before };
  }

  return undefined;
}
