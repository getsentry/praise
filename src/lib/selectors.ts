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
  // The inline editor keeps Cancel in a footer that is a *sibling* of the editor
  // box, so the boundary never contains it. One step past is enough to reach it,
  // and it has to be the last: climbing on from there is how the walk reaches a
  // neighbouring editor, or the page's own toolbar, and takes the wrong Cancel.
  let steppedOut = false;

  for (let depth = 0; element && depth < 12; depth++) {
    const anchor = findAnchorButton(element);
    if (!anchor?.parentElement) {
      if (steppedOut) {
        return undefined;
      }

      if (element.matches(boundary)) {
        // Only into a wrapper holding this editor alone -- a shared one would
        // put a neighbour's Cancel in reach.
        const parent = element.parentElement;
        if (!parent || parent.querySelectorAll('textarea').length > 1) {
          return undefined;
        }
        steppedOut = true;
      }
      element = element.parentElement;
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

/**
 * The review dialog a textarea belongs to, if it is in one.
 *
 * Both lookups below scope through this: the diff toolbar carries its own
 * "Submit review" trigger, and clicking that posts a review nobody asked for.
 */
function reviewScope(textarea: HTMLTextAreaElement): HTMLElement | undefined {
  return textarea.closest<HTMLElement>(reviewDialog.join(',')) ?? textarea.form ?? undefined;
}

function radioLabel(radio: HTMLInputElement, scope: HTMLElement): string {
  const wrapping = radio.closest('label');
  const associated = radio.id ? scope.querySelector(`label[for="${CSS.escape(radio.id)}"]`) : null;
  const text = wrapping?.textContent ?? associated?.textContent ?? radio.getAttribute('aria-label') ?? '';

  return text.replace(/\s+/g, ' ').trim();
}

/**
 * The "Approve" verdict radio, or `undefined` when it cannot be used.
 *
 * Undefined is what stops an approval going out: GitHub disables this radio on
 * your own PR, and submitting without it posts a plain comment instead.
 *
 * The value is GitHub's own vocabulary on both the React and legacy markup; the
 * caption is only a fallback, being localised where the value is not.
 */
export function findApproveRadio(textarea: HTMLTextAreaElement): HTMLInputElement | undefined {
  const scope = reviewScope(textarea);
  if (!scope) {
    return undefined;
  }

  const radios = [...scope.querySelectorAll<HTMLInputElement>('input[type="radio"]')].filter(radio => !radio.disabled);

  return (
    radios.find(radio => radio.value.toLowerCase() === 'approve') ??
    radios.find(radio => radioLabel(radio, scope).toLowerCase() === 'approve')
  );
}

/**
 * The dialog's own "Submit review" button, if it is ready to be pressed.
 *
 * Anchored rather than exact: the caption carries its keyboard shortcut.
 */
export function findSubmitReviewButton(textarea: HTMLTextAreaElement): HTMLButtonElement | undefined {
  const scope = reviewScope(textarea);
  if (!scope) {
    return undefined;
  }

  for (const button of scope.querySelectorAll<HTMLButtonElement>('button')) {
    if (!button.disabled && /^submit review/i.test(buttonLabel(button))) {
      return button;
    }
  }

  return undefined;
}

/**
 * Captions GitHub gives the button that files a comment as part of a review.
 *
 * "Start a review" with none pending, "Add review comment" once one is -- so
 * clicking whichever is present needs no knowledge of the review state; GitHub's
 * own caption carries it.
 *
 * An allowlist, not "anything except single comment": the editor's primary
 * button is captioned plainly "Comment" and posts a standalone comment, so a
 * caption we do not recognise has to be left alone rather than pressed.
 *
 * Anchored rather than exact, like the review dialog's Submit: captions here
 * carry a keyboard shortcut too.
 */
const reviewCommentLabels = [/^start a review/i, /^add review comment/i];

/**
 * Whether Primer is rendering this button as unavailable.
 *
 * An empty editor's submit buttons arrive marked this way rather than
 * `disabled`, so the attribute is the only thing between us and clicking a
 * button that silently does nothing.
 */
function inactive(button: HTMLButtonElement): boolean {
  return button.dataset.inactive === 'true';
}

/**
 * The inline editor's own review-comment button, if it is ready to be pressed.
 *
 * Scoped through `findInsertionPoint`, so it can only ever return a button from
 * the same row our own button sits in -- the editor that let us in. Reaching
 * wider is how a neighbouring editor's footer, or the diff toolbar, gets
 * clicked.
 *
 * The review dialog is excluded outright: submitting a review there is the
 * Approve button's job, and it needs a verdict chosen first.
 */
export function findReviewCommentButton(textarea: HTMLTextAreaElement): HTMLButtonElement | undefined {
  if (praiseContext(textarea) !== 'comments') {
    return undefined;
  }

  const point = findInsertionPoint(textarea);
  if (!point) {
    return undefined;
  }

  for (const button of point.row.querySelectorAll<HTMLButtonElement>('button')) {
    if (!button.disabled && !inactive(button) && reviewCommentLabels.some(label => label.test(buttonLabel(button)))) {
      return button;
    }
  }

  return undefined;
}
