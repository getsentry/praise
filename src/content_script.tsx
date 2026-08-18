import observe from './lib/selector-observer';
import { addPraiseButton, type PraiseSource } from './lib/praise-button';
import { markdownTextarea } from './lib/selectors';

let commentPraises: string[] = [];
let reviewPraises: string[] = [];

/** Read at click time, so options-page edits reach existing buttons. */
const getPraises: PraiseSource = (context) =>
  context === "reviews" ? reviewPraises : commentPraises;

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
    if (areaName !== 'sync') {
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
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
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
    element => {
      addPraiseButton(element as HTMLTextAreaElement, getPraises);
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
  for (const event of ['soft-nav:payload', 'soft-nav:end', 'turbo:load', 'statechange', 'popstate']) {
    window.addEventListener(event, () => {
      setUpObserver();
    });
  }
}
