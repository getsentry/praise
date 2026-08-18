/**
 * Places the praise button inside a comment editor.
 *
 * Split out from the content script so it can be tested: importing the content
 * script runs its storage and observer wiring at module load, which needs a
 * browser. Everything here is plain DOM work against an editor it is handed.
 */

import { setFieldText } from 'text-field-edit';
import { findInsertionPoint, praiseContext } from './selectors';

export const buttonClass = 'sentry-pr-praise-button';

/**
 * The text we last wrote into a given textarea.
 *
 * `setFieldText` fires a real `input` event -- that is the whole point, it is how
 * React learns about the new value -- so we can't tell our own writes from the
 * user's by looking at the event. Comparing against the value we wrote is
 * timing-independent, unlike a flag set around the call.
 */
const lastWritten = new WeakMap<HTMLTextAreaElement, string>();

/** Textareas we've already given a button, so re-renders don't add a second. */
const decorated = new WeakSet<HTMLTextAreaElement>();

/**
 * Supplies the praise list for a context, read at click time.
 *
 * A function rather than an array so edits in the options page apply to buttons
 * that already exist -- the content script closes over its own mutable state,
 * and tests pass a literal.
 */
export type PraiseSource = (context: 'reviews' | 'comments') => string[];

/**
 * Adds the praise button to the left of a comment editor's Cancel button.
 *
 * @param attempt Which retry this is; see the note on waiting below.
 */
export function addPraiseButton(textarea: HTMLTextAreaElement, getPraises: PraiseSource, attempt = 0): void {
  if (decorated.has(textarea)) {
    return;
  }

  // The textarea selectors match every markdown editor on the page, so check
  // this one is a review or diff comment before going further. Anything else --
  // the PR description, editing an existing conversation comment -- is left
  // alone, including its retries.
  const context = praiseContext(textarea);
  if (!context) {
    decorated.add(textarea);
    return;
  }

  // The review dialog mounts its footer after the textarea, and the observer
  // only ever reports an element once, so retry rather than skipping this
  // editor forever. Still bail rather than fall back to a bad position: a
  // missing button beats a misplaced one.
  const insertionPoint = findInsertionPoint(textarea);
  if (!insertionPoint) {
    if (attempt < 20 && textarea.isConnected) {
      setTimeout(() => {
        addPraiseButton(textarea, getPraises, attempt + 1);
      }, 100);
    }
    return;
  }

  const { row, before } = insertionPoint;
  if (row.querySelector(`.${buttonClass}`)) {
    decorated.add(textarea);
    return;
  }

  decorated.add(textarea);

  const button = createButton(before);
  button.addEventListener('click', () => {
    setPraise(textarea, getPraises(context));
  });

  before.before(button);
  toggleButton(textarea, button);
}

/**
 * Builds the button, matching GitHub's own styling where possible.
 *
 * Cloning a neighbouring button inherits whatever Primer classes are current
 * instead of hardcoding hashed class names, which go stale on every deploy.
 */
function createButton(neighbour: HTMLElement): HTMLButtonElement {
  const label = 'Praise';
  const template =
    neighbour.tagName === 'BUTTON' ? (neighbour as HTMLButtonElement) : neighbour.querySelector('button');

  if (template) {
    const clone = template.cloneNode(true) as HTMLButtonElement;
    clone.type = 'button';
    clone.disabled = false;
    for (const attribute of [
      'id',
      'aria-label',
      'aria-describedby',
      'data-variant',
      'disabled',
      'form',
      'name',
      'value',
    ]) {
      clone.removeAttribute(attribute);
    }
    clone.classList.add(buttonClass);

    // Primer wraps the caption in its own element; replacing the whole
    // textContent would drop the layout wrappers with it.
    const caption = clone.querySelector('[data-component="text"]');
    if (caption) {
      caption.textContent = label;
      clone
        .querySelectorAll(
          '[data-component="leadingVisual"], [data-component="trailingVisual"], [data-component="trailingAction"]',
        )
        .forEach(element => {
          element.remove();
        });
    } else {
      clone.textContent = label;
    }

    return clone;
  }

  const button = document.createElement('button');
  button.type = 'button';
  button.className = buttonClass;
  button.textContent = label;
  return button;
}

/**
 * Sets a random praise on the textarea.
 *
 * @param textarea The textarea to put the praise.
 * @param praises The praises to randomly pick.
 */
function setPraise(textarea: HTMLTextAreaElement, praises: string[]): void {
  if (praises.length === 0) {
    return;
  }

  let newText = praises[0];
  // Try for a different praise than the current one, but don't spin when there
  // is only one to choose from.
  for (let attempt = 0; attempt < 10; attempt++) {
    const candidate = praises[Math.floor(Math.random() * praises.length)];
    if (candidate !== textarea.value) {
      newText = candidate;
      break;
    }
  }

  lastWritten.set(textarea, newText);

  // The textarea is React-controlled, so assigning `value` directly would be
  // reverted on the next render. `setFieldText` writes via `execCommand`, which
  // fires a trusted `input` event React honours -- and keeps native undo.
  setFieldText(textarea, newText);
}

/**
 * Hide the button when the user enters manual text.
 *
 * @param textarea The textarea to put the praise.
 * @param button The button belonging to that textarea.
 */
function toggleButton(textarea: HTMLTextAreaElement, button: HTMLElement): void {
  textarea.addEventListener('input', function () {
    // Keep the button around after our own write so it can be clicked again for
    // a different praise.
    if (this.value === lastWritten.get(textarea)) {
      return;
    }

    button.hidden = this.value.length > 0;
  });
}
