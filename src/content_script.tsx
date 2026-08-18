import { setFieldText } from "text-field-edit";
import observe from "./lib/selector-observer";
import {
  findInsertionPoint,
  markdownTextarea,
  praiseContext,
} from "./lib/selectors";

const buttonClass = "sentry-pr-praise-button";

let commentPraises: string[] = [];
let reviewPraises: string[] = [];

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

loadPraises();
watchPraises();
setUpObserver();
watchNavigation();

function loadPraises(): void {
  chrome.storage.sync.get<{ reviews: string[]; comments: string[] }>(
    {
      reviews: [],
      comments: [],
    },
    (items: { reviews: string[]; comments: string[] }) => {
      reviewPraises = items.reviews;
      commentPraises = items.comments;
    },
  );
}

/** Picks up edits made in the options page without needing a reload. */
function watchPraises(): void {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "sync") {
      return;
    }

    if (changes.reviews) {
      reviewPraises = toPraises(changes.reviews.newValue);
    }
    if (changes.comments) {
      commentPraises = toPraises(changes.comments.newValue);
    }
  });
}

/** `chrome.storage` values are untyped, so verify the shape before using it. */
function toPraises(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

let observerController: AbortController | undefined;

/**
 * One observer, keyed on the comment body itself.
 *
 * Watching containers instead would double up: the review dialog and the inline
 * diff editor share wrapper class names, and some of those wrappers nest, so a
 * single editor could match twice.
 */
function setUpObserver(): void {
  observerController?.abort();
  observerController = new AbortController();

  observe(
    markdownTextarea,
    (element) => {
      addPraiseButton(element as HTMLTextAreaElement);
    },
    { signal: observerController.signal },
  );
}

/**
 * GitHub soft-navigates between the PR tabs, which tears down the stylesheet our
 * observer relies on. Re-arm on every transition.
 *
 * `pjax:*` is gone from GitHub's current bundles; `soft-nav:*` replaced it.
 */
function watchNavigation(): void {
  for (const event of [
    "soft-nav:payload",
    "soft-nav:end",
    "turbo:load",
    "statechange",
    "popstate",
  ]) {
    window.addEventListener(event, () => {
      setUpObserver();
    });
  }
}

/**
 * Adds the praise button to the left of a comment editor's Cancel button.
 *
 * @param attempt Which retry this is; see the note on waiting below.
 */
function addPraiseButton(textarea: HTMLTextAreaElement, attempt = 0): void {
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
        addPraiseButton(textarea, attempt + 1);
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

  const praises =
    context === "reviews" ? () => reviewPraises : () => commentPraises;

  const button = createButton(before);
  button.addEventListener("click", () => {
    setPraise(textarea, praises());
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
  const label = "PR";
  const template =
    neighbour.tagName === "BUTTON"
      ? (neighbour as HTMLButtonElement)
      : neighbour.querySelector("button");

  if (template) {
    const clone = template.cloneNode(true) as HTMLButtonElement;
    clone.type = "button";
    clone.disabled = false;
    for (const attribute of [
      "id",
      "aria-label",
      "aria-describedby",
      "data-variant",
      "disabled",
      "form",
      "name",
      "value",
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
        .forEach((element) => {
          element.remove();
        });
    } else {
      clone.textContent = label;
    }

    return clone;
  }

  const button = document.createElement("button");
  button.type = "button";
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
function toggleButton(
  textarea: HTMLTextAreaElement,
  button: HTMLElement,
): void {
  textarea.addEventListener("input", function () {
    // Keep the button around after our own write so it can be clicked again for
    // a different praise.
    if (this.value === lastWritten.get(textarea)) {
      return;
    }

    button.hidden = this.value.length > 0;
  });
}
