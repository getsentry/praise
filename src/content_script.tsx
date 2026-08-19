import { setFieldText } from 'text-field-edit';
import { submitApproval } from './lib/approve';
import { composeApprove, composePraise } from './lib/compose-praise';
import { isPullRequestUrl } from './lib/pr-url';
import { submitReviewComment } from './lib/review-comment';
import observe from './lib/selector-observer';
import { findInsertionPoint, markdownTextarea, praiseContext } from './lib/selectors';

/**
 * Not yet in TypeScript's DOM lib. Only the member we use.
 */
type NavigationApi = {
  addEventListener(type: 'navigatesuccess', listener: () => void): void;
};

const buttonClass = 'sentry-pr-praise-button';

let commentPraises: string[] = [];
let approveComment = '';
let approveGifs: string[] = [];
let approveGifsEnabled = true;

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
 * Lets a re-arm cancel the previous observer.
 *
 * Declared above the calls below, not beside `setUpObserver`: `let` does not
 * hoist, so a declaration further down leaves this in the temporal dead zone
 * and `setUpObserver()` throws at module load.
 */
let observerController: AbortController | undefined;

loadPraises();
watchPraises();
syncObserver();
watchNavigation();

type Stored = { approveComment: string; comments: string[]; approveGifs: string[]; approveGifsEnabled: boolean };

function loadPraises(): void {
  chrome.storage.sync.get<Stored>(
    {
      approveComment: '',
      comments: [],
      approveGifs: [],
      approveGifsEnabled: true,
    },
    (items: Stored) => {
      approveComment = items.approveComment;
      commentPraises = items.comments;
      approveGifs = items.approveGifs;
      approveGifsEnabled = items.approveGifsEnabled;
    },
  );
}

/** Picks up edits made in the options page without needing a reload. */
function watchPraises(): void {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'sync') {
      return;
    }

    if (changes.approveComment) {
      approveComment = typeof changes.approveComment.newValue === 'string' ? changes.approveComment.newValue : '';
    }
    if (changes.comments) {
      commentPraises = toPraises(changes.comments.newValue);
    }
    if (changes.approveGifs) {
      approveGifs = toPraises(changes.approveGifs.newValue);
    }
    if (changes.approveGifsEnabled) {
      // Anything that is not an explicit `false` leaves gifs on, matching the
      // seeded default.
      approveGifsEnabled = changes.approveGifsEnabled.newValue !== false;
    }
  });
}

/** `chrome.storage` values are untyped, so verify the shape before using it. */
function toPraises(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

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
    element => {
      addPraiseButton(element as HTMLTextAreaElement);
    },
    { signal: observerController.signal },
  );
}

/**
 * Arms or disarms the observer to match the current URL.
 *
 * The manifest now injects on all of github.com, not just PR pages, so the
 * script has to gate itself at runtime -- both on load and on every soft
 * navigation -- instead of relying on Chrome's `matches` filtering.
 */
function syncObserver(): void {
  if (isPullRequestUrl(location.href)) {
    setUpObserver();
  } else {
    observerController?.abort();
    observerController = undefined;
  }
}

/**
 * GitHub soft-navigates between the PR tabs, which tears down the stylesheet our
 * observer relies on. Re-sync on every transition.
 *
 * `pjax:*` is gone from GitHub's current bundles; `soft-nav:*` replaced it.
 * `navigatesuccess` is included too: it's a platform event rather than a
 * GitHub-private one, so unlike the others it won't rot on GitHub's next
 * deploy.
 */
function watchNavigation(): void {
  for (const event of ['soft-nav:payload', 'soft-nav:end', 'turbo:load', 'statechange', 'popstate']) {
    window.addEventListener(event, () => {
      syncObserver();
    });
  }

  (window as unknown as { navigation?: NavigationApi }).navigation?.addEventListener('navigatesuccess', () => {
    syncObserver();
  });
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

  const button = createButton(before, context === 'reviews' ? 'Approve' : 'Praise');

  if (context === 'reviews') {
    button.addEventListener('click', () => {
      void approve(textarea);
    });
  } else {
    button.addEventListener('click', () => {
      void praise(textarea);
    });

    // Approve stays visible instead: typing your own text is exactly when it
    // adds nothing but the gif.
    toggleButton(textarea, button);
  }

  before.before(button);
}

/**
 * Builds the button, matching GitHub's own styling where possible.
 *
 * Cloning a neighbouring button inherits whatever Primer classes are current
 * instead of hardcoding hashed class names, which go stale on every deploy.
 */
function createButton(neighbour: HTMLElement, label: string): HTMLButtonElement {
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
 * Fills a diff comment box with a random praise and files it as part of a review.
 *
 * Submitting only after a real write is what keeps an unconfigured praise list
 * from posting a blank comment: `composePraise` yields `''` when there is
 * nothing to say, and `write` reports having left the box alone.
 *
 * A failed submit is deliberately silent. The praise is still in the box, which
 * is the same bargain Approve strikes when the verdict is out of reach: better a
 * draft to finish by hand than a standalone comment nobody asked for.
 */
async function praise(textarea: HTMLTextAreaElement): Promise<void> {
  // Gifs ride along with approve comments only; a diff comment stays plain text.
  if (write(textarea, composePraise(commentPraises, [], textarea.value))) {
    await submitReviewComment(textarea);
  }
}

/**
 * Fills the review box and approves the pull request.
 *
 * The write stands on its own: when the verdict is out of reach -- your own PR
 * being the everyday case -- the box is left filled rather than the click doing
 * nothing at all.
 */
async function approve(textarea: HTMLTextAreaElement): Promise<void> {
  const gifs = approveGifsEnabled ? approveGifs : [];

  write(textarea, composeApprove(approveComment, gifs, textarea.value));

  await submitApproval(textarea);
}

/**
 * Treats `''` as "leave the box as it is".
 *
 * @returns Whether anything was written.
 */
function write(textarea: HTMLTextAreaElement, newText: string): boolean {
  if (newText === '') {
    return false;
  }

  lastWritten.set(textarea, newText);

  // The textarea is React-controlled, so assigning `value` directly would be
  // reverted on the next render. `setFieldText` writes via `execCommand`, which
  // fires a trusted `input` event React honours -- and keeps native undo.
  setFieldText(textarea, newText);

  return true;
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
