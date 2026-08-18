# Hermetic DOM Tests for Praise Button Placement — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Jest + jsdom test suite that fails when the praise button stops landing immediately before the Cancel button in GitHub's PR review dialog and inline diff comment editors.

**Architecture:** Extract the button placement logic out of `src/content_script.tsx` (whose top-level side effects make it unimportable in tests) into `src/lib/praise-button.ts` with the praise list injected. Then test two layers against committed, sanitized HTML fixtures captured from real GitHub PR pages: selector/placement resolution in `selectors.test.ts`, and button injection and interaction in `praise-button.test.ts`. No browser, no network, no credentials — the existing `npm test` CI job picks it all up unchanged.

**Tech Stack:** TypeScript 7 (strict), Jest 30 with `@swc/jest`, `jest-environment-jsdom` 30, `text-field-edit`, Prettier 3 (defaults, no config file).

**Spec:** `docs/superpowers/specs/2026-08-18-hermetic-dom-tests-design.md` — read it before starting. It records why the approach is hermetic, what the suite deliberately cannot catch, and the four empirical constraints below.

## Global Constraints

- **Node 26, npm 11.** CI uses `node-version: '26'` (`.github/workflows/test.yml`).
- **`jest-environment-jsdom@^30`** is the only new dependency. Do not add Playwright, Puppeteer, vitest, happy-dom, or any testing-library package.
- **No network access in any test.** No `fetch`, no live github.com. The suite must pass with networking disabled.
- **No credentials, no secrets, no new CI workflow.** `.github/workflows/test.yml` already runs `npm test` on every PR and push to `main`.
- **jsdom cannot fire `animationstart`** and reports `getComputedStyle(el).animationName` as `"none"`. Verified on jsdom 30.0.1 and happy-dom 20. Therefore **do not write tests for `src/lib/selector-observer.ts`** — it is untestable in a simulated DOM by construction. Do not modify that file.
- **`document.execCommand` does not exist in jsdom**, so `setFieldText` throws `TypeError: document.execCommand is not a function`. Task 2 builds the stub that fixes this. Every test touching `setPraise` must install it.
- **`class*=` and `:where()` selectors do work in jsdom**, so `selectors.ts` needs no changes to be testable.
- **Behaviour must not change.** Task 1 is a pure refactor. Do not fix, improve, or restyle the placement logic while moving it — if you spot a genuine bug, note it and keep going.
- **Naming:** the button class is `sentry-pr-praise-button`, the label is `Praise`, the anchor caption is `Cancel`. Exact strings.
- **Style:** run `npm run style` (Prettier) before each commit. Match the existing comment voice in `src/lib/selectors.ts` — explain _why_, use `--` for asides, avoid restating the code.
- **Commit messages:** imperative mood, capitalized, no type prefix — matching this repo's history (`Scope praise button to review and diff comments`, `Add MIT LICENSE file`). Do **not** use Conventional Commits.

---

## Prerequisite: fixtures need a human (read before Task 3)

Tasks 3–6 test against HTML captured from a **real, logged-in GitHub PR page**. An implementing agent cannot log into GitHub, so it cannot produce real fixtures.

**Task 3 therefore builds synthetic fixtures and labels them as such**, and Task 7 documents how a maintainer replaces them. The spec is blunt about the cost, and so should you be: a synthetic fixture tests our logic against our own assumptions, so it cannot reveal that a selector was wrong in the first place. Do not describe the suite as validating against real GitHub markup until real captures land.

If real captures _are_ already present in `test/fixtures/` when you start, use them and skip the synthetic generation in Task 3.

---

## File Structure

**Created:**

| Path                                  | Responsibility                                                                                                                   |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/praise-button.ts`            | Button placement, construction, praise-setting, hide-on-typing. Pure DOM; no `chrome.*`, no observer, no top-level side effects. |
| `src/lib/test-support/execCommand.ts` | Installs a jsdom `execCommand('insertText')` stub so `setFieldText` works.                                                       |
| `src/lib/test-support/chrome.ts`      | Minimal `chrome.storage` stub.                                                                                                   |
| `src/lib/test-support/fixtures.ts`    | Loads a fixture HTML file into the jsdom document.                                                                               |
| `test/fixtures/review-dialog.html`    | PR page with the "Finish your review" dialog open.                                                                               |
| `test/fixtures/diff-comment.html`     | PR page with an inline diff comment editor open.                                                                                 |
| `test/fixtures/README.md`             | Provenance of each fixture and the capture/sanitize procedure.                                                                   |
| `src/lib/selectors.test.ts`           | Layer 1: selector matching, `praiseContext`, `findInsertionPoint`.                                                               |
| `src/lib/praise-button.test.ts`       | Layer 2: injection, duplicate suppression, click, hide-on-typing.                                                                |

**Modified:**

| Path                           | Change                                                                                                                              |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| `src/content_script.tsx:1-270` | Keep storage/navigation/observer wiring (lines 1–109); move placement logic (lines 110–270) to `praise-button.ts` and call into it. |
| `jest.config.js`               | Add `testEnvironment: "jsdom"`; add `test` to `roots`.                                                                              |
| `package.json`                 | Add `jest-environment-jsdom` devDependency.                                                                                         |

**Deleted:** `src/__tests__/sum.ts` — two empty test bodies that assert nothing.

---

### Task 1: Extract placement logic into `src/lib/praise-button.ts`

Pure refactor. No test is written here — the module is currently untestable, which is the entire reason for this task; Tasks 4–6 test it. The gate for this task is `npm run build` plus manual verification in Chrome.

**Files:**

- Create: `src/lib/praise-button.ts`
- Modify: `src/content_script.tsx:1-270`

**Interfaces:**

- Consumes: `findInsertionPoint`, `markdownTextarea`, `praiseContext` from `./selectors` (unchanged).
- Produces:

  ```typescript
  export const buttonClass = 'sentry-pr-praise-button';
  export type PraiseSource = (context: 'reviews' | 'comments') => string[];
  export function addPraiseButton(textarea: HTMLTextAreaElement, getPraises: PraiseSource, attempt?: number): void;
  ```

  `getPraises` is called at click time, not at decoration time, so edits made in the options page take effect without re-rendering the editor. Tasks 4–6 depend on these exact names and this signature.

- [ ] **Step 1: Create `src/lib/praise-button.ts` with the moved code**

Move `buttonClass` (line 9), `lastWritten` (lines 14–22, with its comment), `decorated` (lines 24–25, with its comment), `addPraiseButton` (lines 110–162), `createButton` (lines 164–219), `setPraise` (lines 221–250), and `toggleButton` (lines 252–270) verbatim — comments included. Then apply exactly these changes:

Add at the top:

```typescript
import { setFieldText } from 'text-field-edit';
import { findInsertionPoint, praiseContext } from './selectors';
```

Export `buttonClass`, and add the module docstring plus the injection type:

```typescript
/**
 * Places the praise button inside a comment editor.
 *
 * Split out from the content script so it can be tested: importing the content
 * script runs its storage and observer wiring at module load, which needs a
 * browser. Everything here is plain DOM work against an editor it is handed.
 */

/**
 * Supplies the praise list for a context, read at click time.
 *
 * A function rather than an array so edits in the options page apply to buttons
 * that already exist -- the content script closes over its own mutable state,
 * and tests pass a literal.
 */
export type PraiseSource = (context: 'reviews' | 'comments') => string[];
```

Change `addPraiseButton`'s signature and the two places inside it that used module-level state:

```typescript
export function addPraiseButton(
  textarea: HTMLTextAreaElement,
  getPraises: PraiseSource,
  attempt = 0,
): void {
```

Its recursive retry call becomes:

```typescript
setTimeout(() => {
  addPraiseButton(textarea, getPraises, attempt + 1);
}, 100);
```

And the praise lookup — replacing the old `context === "reviews" ? () => reviewPraises : () => commentPraises` line — becomes:

```typescript
const button = createButton(before);
button.addEventListener('click', () => {
  setPraise(textarea, getPraises(context));
});
```

Keep `createButton`, `setPraise`, and `toggleButton` unexported — they are internal to this module. Do not otherwise alter any logic: the retry cap of 20, the depth limit, the `decorated` bookkeeping, and the `lastWritten` comparison all stay exactly as they are.

- [ ] **Step 2: Rewrite `src/content_script.tsx` to delegate**

The file keeps its storage wiring, navigation watching, and observer setup and loses the placement logic. Full new contents:

```typescript
import observe from './lib/selector-observer';
import { addPraiseButton, type PraiseSource } from './lib/praise-button';
import { markdownTextarea } from './lib/selectors';

let commentPraises: string[] = [];
let reviewPraises: string[] = [];

/** Read at click time, so options-page edits reach existing buttons. */
const getPraises: PraiseSource = context => (context === 'reviews' ? reviewPraises : commentPraises);

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
```

Note the file no longer imports `setFieldText`, `findInsertionPoint`, or `praiseContext` — those moved. It has no JSX and never did, but leave it as `.tsx` so the webpack entry in `webpack/` keeps resolving.

- [ ] **Step 3: Verify it compiles and bundles**

Run: `npm run build`
Expected: PASS — `tsc --noEmit` clean, webpack writes `dist/js/content_script.js`. If TypeScript complains about an unused import, you left a stale one behind in either file.

- [ ] **Step 4: Verify behaviour is unchanged in Chrome**

This task has no automated gate, so check it by hand — the refactor is only correct if the button still works:

1. `chrome://extensions` → reload the unpacked `dist` folder.
2. Open any GitHub PR → **Files changed** → click a diff line's `+` to open an inline comment editor. Confirm the `Praise` button appears immediately left of **Cancel**, and clicking it inserts a praise.
3. Click **Review changes** → **Comment** to open the review dialog. Confirm the `Praise` button appears there too, drawing from the reviews list.
4. Type manually in either editor and confirm the button hides.

If you cannot run Chrome, say so explicitly in your report rather than claiming the step passed.

- [ ] **Step 5: Commit**

```bash
npm run style
git add src/lib/praise-button.ts src/content_script.tsx
git commit -m "Extract praise button placement into its own module"
```

---

### Task 2: Test environment — jsdom, `execCommand` stub, chrome stub

Sets up the harness Tasks 3–6 need. The `execCommand` stub is the load-bearing piece: without it every `setPraise` test throws.

**Files:**

- Create: `src/lib/test-support/execCommand.ts`, `src/lib/test-support/chrome.ts`
- Modify: `jest.config.js`, `package.json`
- Delete: `src/__tests__/sum.ts`
- Test: `src/lib/test-support/execCommand.test.ts`

**Interfaces:**

- Produces:

  ```typescript
  // execCommand.ts
  export function installExecCommand(): void;
  // chrome.ts
  export function installChromeStub(praises?: { reviews?: string[]; comments?: string[] }): void;
  ```

- [ ] **Step 1: Install the jsdom environment and configure Jest**

```bash
npm install --save-dev jest-environment-jsdom@^30
```

Then rewrite `jest.config.js` — `roots` gains `test` so fixture files resolve from either location, and `testEnvironment` switches from the default `node`:

```javascript
module.exports = {
  roots: ['src', 'test'],
  // The extension is all DOM work, and Jest 30 no longer bundles jsdom.
  testEnvironment: 'jsdom',
  transform: {
    '^.+\\.tsx?$': [
      '@swc/jest',
      {
        jsc: { parser: { syntax: 'typescript', tsx: true } },
      },
    ],
  },
};
```

Delete the placeholder suite, which asserts nothing and makes coverage look real:

```bash
git rm src/__tests__/sum.ts
```

- [ ] **Step 2: Write the failing test for the `execCommand` stub**

Create `src/lib/test-support/execCommand.test.ts`:

```typescript
import { setFieldText } from 'text-field-edit';
import { installExecCommand } from './execCommand';

/**
 * `setFieldText` is how we write into React-controlled textareas, so if the stub
 * is wrong every placement test fails for an unrelated-looking reason.
 */
test('setFieldText replaces the value and fires input, repeatably', () => {
  installExecCommand();

  const textarea = document.createElement('textarea');
  document.body.append(textarea);

  let inputEvents = 0;
  textarea.addEventListener('input', () => {
    inputEvents++;
  });

  textarea.focus();
  setFieldText(textarea, 'Nice work!');
  expect(textarea.value).toBe('Nice work!');
  expect(inputEvents).toBe(1);

  // Clicking the button a second time must replace, not append.
  setFieldText(textarea, 'Great catch!');
  expect(textarea.value).toBe('Great catch!');
  expect(inputEvents).toBe(2);
});
```

- [ ] **Step 3: Run it to make sure it fails**

Run: `npx jest src/lib/test-support/execCommand.test.ts`
Expected: FAIL — `Cannot find module './execCommand'`.

- [ ] **Step 4: Write the stub**

Create `src/lib/test-support/execCommand.ts`:

```typescript
/**
 * Gives jsdom just enough `execCommand` for `text-field-edit` to work.
 *
 * jsdom implements no `execCommand` at all, so `setFieldText` throws before it
 * writes anything. We only need `insertText`, and only over the current
 * selection: `setRangeText` plus a bubbling `input` event is what a real browser
 * does, and it is what React's own change tracking listens for.
 */
export function installExecCommand(): void {
  document.execCommand = (command: string, _showUi?: boolean, value?: string): boolean => {
    if (command !== 'insertText') {
      return false;
    }

    const element = document.activeElement;
    if (!(element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement)) {
      return false;
    }

    const start = element.selectionStart ?? element.value.length;
    const end = element.selectionEnd ?? element.value.length;
    element.setRangeText(value ?? '', start, end, 'end');
    element.dispatchEvent(
      new InputEvent('input', {
        bubbles: true,
        inputType: 'insertText',
        data: value ?? '',
      }),
    );

    return true;
  };
}
```

- [ ] **Step 5: Run it to make sure it passes**

Run: `npx jest src/lib/test-support/execCommand.test.ts`
Expected: PASS, 1 test.

If it fails with `value: ""`, the culprit is focus — `setFieldText` selects the whole field before inserting, and the stub reads `document.activeElement`, so the textarea must be attached to `document.body` and focused.

- [ ] **Step 6: Write the chrome stub**

Create `src/lib/test-support/chrome.ts`. Nothing in Tasks 3–6 imports `content_script.tsx`, so this exists only so a future test can:

```typescript
/**
 * A `chrome.storage.sync` stand-in.
 *
 * Only what the content script touches on load: a `get` that hands back defaults
 * merged with our values, and an `onChanged` listener registry that records
 * without dispatching.
 */
export function installChromeStub(praises: { reviews?: string[]; comments?: string[] } = {}): void {
  const stored = {
    reviews: praises.reviews ?? [],
    comments: praises.comments ?? [],
  };

  (globalThis as unknown as { chrome: unknown }).chrome = {
    storage: {
      sync: {
        get: (_defaults: unknown, callback: (items: typeof stored) => void): void => {
          callback(stored);
        },
      },
      onChanged: {
        addListener: (): void => {},
      },
    },
  };
}
```

- [ ] **Step 7: Confirm the whole suite is green**

Run: `npm test`
Expected: PASS — 1 suite, 1 test. The old `sum.ts` suite is gone.

- [ ] **Step 8: Commit**

```bash
npm run style
git add jest.config.js package.json package-lock.json src/lib/test-support
git add -u src/__tests__/sum.ts
git commit -m "Set up jsdom test environment with an execCommand stub"
```

---

### Task 3: Fixtures and loader

**Files:**

- Create: `test/fixtures/review-dialog.html`, `test/fixtures/diff-comment.html`, `src/lib/test-support/fixtures.ts`
- Test: `src/lib/test-support/fixtures.test.ts`

**Interfaces:**

- Produces:

  ```typescript
  export type FixtureName = 'review-dialog' | 'diff-comment';
  export function loadFixture(name: FixtureName): void;
  ```

  `loadFixture` replaces the current document's contents. Tasks 4–6 call it in `beforeEach`.

- [ ] **Step 1: Write the failing test for the loader**

Create `src/lib/test-support/fixtures.test.ts`:

```typescript
import { loadFixture } from './fixtures';

test('review-dialog fixture has a dialog containing a textarea and Cancel', () => {
  loadFixture('review-dialog');

  const dialog = document.querySelector('[role="dialog"]');
  expect(dialog).not.toBeNull();
  expect(dialog!.querySelector('textarea')).not.toBeNull();
  expect([...dialog!.querySelectorAll('button')].map(button => button.textContent?.trim())).toContain('Cancel');
});

test('diff-comment fixture has an editor containing a textarea and Cancel', () => {
  loadFixture('diff-comment');

  const editor = document.querySelector('div[class*="AddCommentEditor"]');
  expect(editor).not.toBeNull();
  expect(editor!.querySelector('textarea')).not.toBeNull();
  expect([...editor!.querySelectorAll('button')].map(button => button.textContent?.trim())).toContain('Cancel');
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `npx jest src/lib/test-support/fixtures.test.ts`
Expected: FAIL — `Cannot find module './fixtures'`.

- [ ] **Step 3: Write the loader**

Create `src/lib/test-support/fixtures.ts`:

```typescript
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export type FixtureName = 'review-dialog' | 'diff-comment';

/**
 * Replaces the document with a captured GitHub page.
 *
 * `documentElement.innerHTML` rather than `document.write`, which refined-github
 * uses: `write` needs an open parser, and re-running it across tests in one
 * jsdom document is unreliable. This also keeps `document` identity stable, so
 * modules holding a reference to it stay valid.
 */
export function loadFixture(name: FixtureName): void {
  const html = readFileSync(join(__dirname, '../../../test/fixtures', `${name}.html`), 'utf8');

  const body = /<body[^>]*>([\s\S]*)<\/body>/i.exec(html);
  document.documentElement.innerHTML = `<head></head><body>${body ? body[1] : html}</body>`;
}
```

- [ ] **Step 4: Create the fixtures**

If real sanitized captures already exist in `test/fixtures/`, skip to Step 5.

Otherwise write synthetic fixtures reproducing the structure documented in `src/lib/selectors.ts`. **Label them clearly** — the header comment is not decoration, it is the difference between an honest and a misleading suite.

`test/fixtures/review-dialog.html`. The nesting matters: the footer holding Cancel is a **sibling** of the dialog body, not an ancestor of the textarea, so only the dialog element contains both. The `#praise-decoy` textarea outside the dialog exists so Task 4 can prove `praiseContext()` rejects it.

```html
<!--
  SYNTHETIC FIXTURE -- not captured from GitHub.

  Hand-written from the structure described in src/lib/selectors.ts. It can show
  that our placement logic behaves as designed; it cannot show that the selectors
  match what GitHub actually serves. Replace with a real capture -- see README.md.
-->
<!doctype html>
<html lang="en">
  <body>
    <div id="repo-content-pjax-container">
      <textarea
        id="praise-decoy"
        class="MarkdownInput-module__textArea__a1b2c"
        placeholder="Leave a comment"
      ></textarea>

      <div data-component="Dialog" role="dialog" aria-modal="true" aria-label="Finish your review">
        <div data-component="Dialog.Header">
          <button type="button" aria-label="Close">
            <span data-component="leadingVisual"></span>
          </button>
        </div>
        <div data-component="Dialog.Body">
          <div class="MarkdownEditor-module__container__d4e5f">
            <textarea class="MarkdownInput-module__textArea__a1b2c" placeholder="Leave a comment"></textarea>
          </div>
        </div>
        <div class="ReviewMenuFooter-module__Footer__g6h7i">
          <div class="ReviewMenuFooter-module__ButtonRow__j8k9l">
            <button type="button" class="Button-module__button__m0n1o">
              <span data-component="text">Cancel</span>
            </button>
            <button type="submit" class="ReviewMenuFooter-module__SubmitReviewButton__p2q3r" data-variant="primary">
              <span data-component="text">Submit review</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </body>
</html>
```

`test/fixtures/diff-comment.html`. Two editors, deliberately: `findInsertionPoint()` must take each editor's _own_ Cancel, and a single-editor fixture cannot catch a walk that climbs into its neighbour. The page-level "Submit review" button outside both editors guards the boundary check.

```html
<!--
  SYNTHETIC FIXTURE -- not captured from GitHub.

  Hand-written from the structure described in src/lib/selectors.ts. It can show
  that our placement logic behaves as designed; it cannot show that the selectors
  match what GitHub actually serves. Replace with a real capture -- see README.md.

  Two editors on purpose: the insertion walk must find each editor's own Cancel,
  which a single-editor fixture cannot demonstrate.
-->
<!doctype html>
<html lang="en">
  <body>
    <div data-testid="diff-view">
      <button type="button" class="Button-module__button__m0n1o">
        <span data-component="text">Submit review</span>
      </button>

      <div class="DiffLine-module__row__s4t5u" data-line="12">
        <div class="AddCommentEditor-module__container__v6w7x" data-editor="1">
          <div class="MarkdownEditor-module__container__d4e5f">
            <textarea class="MarkdownInput-module__textArea__a1b2c" placeholder="Leave a comment"></textarea>
          </div>
          <div class="AddCommentEditor-module__buttonRow__y8z9a">
            <button type="button" class="Button-module__button__m0n1o">
              <span data-component="text">Cancel</span>
            </button>
            <button type="button" class="Button-module__button__m0n1o" data-variant="primary">
              <span data-component="text">Add single comment</span>
            </button>
          </div>
        </div>
      </div>

      <div class="DiffLine-module__row__s4t5u" data-line="34">
        <div class="AddCommentEditor-module__container__v6w7x" data-editor="2">
          <div class="MarkdownEditor-module__container__d4e5f">
            <textarea class="MarkdownInput-module__textArea__a1b2c" placeholder="Leave a comment"></textarea>
          </div>
          <div class="AddCommentEditor-module__buttonRow__y8z9a">
            <button type="button" class="Button-module__button__m0n1o">
              <span data-component="text">Cancel</span>
            </button>
            <button type="button" class="Button-module__button__m0n1o" data-variant="primary">
              <span data-component="text">Add single comment</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </body>
</html>
```

- [ ] **Step 5: Run the loader tests**

Run: `npx jest src/lib/test-support/fixtures.test.ts`
Expected: PASS, 2 tests.

- [ ] **Step 6: Commit**

```bash
npm run style
git add test/fixtures src/lib/test-support/fixtures.ts src/lib/test-support/fixtures.test.ts
git commit -m "Add PR page fixtures and a fixture loader"
```

---

### Task 4: Layer 1 — selector and insertion point tests

**Files:**

- Test: `src/lib/selectors.test.ts`

**Interfaces:**

- Consumes: `loadFixture` from `./test-support/fixtures` (Task 3); `markdownTextarea`, `reviewDialog`, `diffCommentEditor`, `praiseContext`, `findInsertionPoint` from `./selectors` (existing, unchanged).

- [ ] **Step 1: Write the failing tests**

Create `src/lib/selectors.test.ts`:

```typescript
import { loadFixture } from './test-support/fixtures';
import { diffCommentEditor, findInsertionPoint, markdownTextarea, praiseContext, reviewDialog } from './selectors';

/** The caption `findInsertionPoint` anchors to, and the one we assert against. */
function label(element: Element | null | undefined): string {
  return (element?.textContent ?? '').replace(/\s+/g, ' ').trim();
}

describe('review dialog', () => {
  beforeEach(() => {
    loadFixture('review-dialog');
  });

  test('the dialog selectors find the dialog', () => {
    expect(document.querySelectorAll(reviewDialog.join(',')).length).toBe(1);
  });

  test('the textarea selectors find both editors on the page', () => {
    // Deliberately broad -- these match every markdown editor, which is why
    // praiseContext() has to do the filtering.
    expect(document.querySelectorAll(markdownTextarea.join(',')).length).toBe(2);
  });

  test('the dialog textarea is a review', () => {
    const textarea = document.querySelector<HTMLTextAreaElement>('[role="dialog"] textarea')!;
    expect(praiseContext(textarea)).toBe('reviews');
  });

  test('a textarea outside the dialog is left alone', () => {
    const textarea = document.querySelector<HTMLTextAreaElement>('#praise-decoy')!;
    expect(praiseContext(textarea)).toBeUndefined();
  });

  test("the insertion point is the row holding the dialog's Cancel", () => {
    const textarea = document.querySelector<HTMLTextAreaElement>('[role="dialog"] textarea')!;

    const insertionPoint = findInsertionPoint(textarea);

    expect(insertionPoint).toBeDefined();
    expect(label(insertionPoint!.before)).toBe('Cancel');
    // The row, not the flex column above it: inserting into the column is what
    // put the button below the textarea at full width.
    expect(insertionPoint!.row).toBe(insertionPoint!.before.parentElement);
    expect(label(insertionPoint!.row)).toContain('Submit review');
  });
});

describe('diff comment editor', () => {
  beforeEach(() => {
    loadFixture('diff-comment');
  });

  test('the editor selectors find both editors', () => {
    expect(document.querySelectorAll(diffCommentEditor.join(',')).length).toBe(2);
  });

  test('a diff textarea is a comment', () => {
    const textarea = document.querySelector<HTMLTextAreaElement>('[data-editor="1"] textarea')!;
    expect(praiseContext(textarea)).toBe('comments');
  });

  test.each([['1'], ['2']])("editor %s anchors to its own Cancel, not its neighbour's", editor => {
    const container = document.querySelector<HTMLElement>(`[data-editor="${editor}"]`)!;
    const textarea = container.querySelector<HTMLTextAreaElement>('textarea')!;

    const insertionPoint = findInsertionPoint(textarea);

    expect(insertionPoint).toBeDefined();
    expect(label(insertionPoint!.before)).toBe('Cancel');
    // The real regression risk: climbing out and taking the other editor's
    // button, or the diff toolbar's page-level "Submit review".
    expect(container.contains(insertionPoint!.before)).toBe(true);
  });
});
```

- [ ] **Step 2: Run them**

Run: `npx jest src/lib/selectors.test.ts`
Expected: PASS, 9 tests (the `test.each` counts as two).

These test existing, working code, so they should pass immediately — that is expected for characterization tests and is not a reason to weaken them. If one fails, do **not** edit the test to match: either the fixture misrepresents GitHub's structure (fix the fixture) or you have found a real bug in `selectors.ts` (report it, do not fix it here).

- [ ] **Step 3: Commit**

```bash
npm run style
git add src/lib/selectors.test.ts
git commit -m "Test selector matching and insertion point resolution"
```

---

### Task 5: Layer 2 — button injection

**Files:**

- Test: `src/lib/praise-button.test.ts`

**Interfaces:**

- Consumes: `addPraiseButton`, `buttonClass`, `PraiseSource` from `./praise-button` (Task 1); `installExecCommand` (Task 2); `loadFixture` (Task 3).

- [ ] **Step 1: Write the failing tests**

Create `src/lib/praise-button.test.ts`:

```typescript
import { addPraiseButton, buttonClass, type PraiseSource } from './praise-button';
import { installExecCommand } from './test-support/execCommand';
import { loadFixture } from './test-support/fixtures';

const reviewPraises = ['Great review!', 'Sharp eye!'];
const commentPraises = ['Nice work!', 'Good call!'];

const praises: PraiseSource = context => (context === 'reviews' ? reviewPraises : commentPraises);

function label(element: Element | null | undefined): string {
  return (element?.textContent ?? '').replace(/\s+/g, ' ').trim();
}

function buttons(scope: ParentNode = document): HTMLElement[] {
  return [...scope.querySelectorAll<HTMLElement>(`.${buttonClass}`)];
}

beforeEach(() => {
  installExecCommand();
});

describe('in the review dialog', () => {
  let textarea: HTMLTextAreaElement;

  beforeEach(() => {
    loadFixture('review-dialog');
    textarea = document.querySelector<HTMLTextAreaElement>('[role="dialog"] textarea')!;
  });

  test('one button is added, immediately before Cancel', () => {
    addPraiseButton(textarea, praises);

    expect(buttons()).toHaveLength(1);
    const button = buttons()[0];
    expect(label(button)).toBe('Praise');
    expect(label(button.nextElementSibling)).toBe('Cancel');
  });

  test('re-decorating the same textarea does not add a second button', () => {
    // React re-renders constantly, so this path is hit in normal use.
    addPraiseButton(textarea, praises);
    addPraiseButton(textarea, praises);

    expect(buttons()).toHaveLength(1);
  });

  test('clicking fills the textarea from the reviews list', () => {
    addPraiseButton(textarea, praises);
    buttons()[0].click();

    expect(reviewPraises).toContain(textarea.value);
  });

  test('a textarea outside the dialog gets no button', () => {
    const decoy = document.querySelector<HTMLTextAreaElement>('#praise-decoy')!;

    addPraiseButton(decoy, praises);

    expect(buttons()).toHaveLength(0);
  });
});

describe('in a diff comment editor', () => {
  let container: HTMLElement;
  let textarea: HTMLTextAreaElement;

  beforeEach(() => {
    loadFixture('diff-comment');
    container = document.querySelector<HTMLElement>('[data-editor="1"]')!;
    textarea = container.querySelector<HTMLTextAreaElement>('textarea')!;
  });

  test('the button lands in the editor it belongs to', () => {
    addPraiseButton(textarea, praises);

    expect(buttons()).toHaveLength(1);
    expect(container.contains(buttons()[0])).toBe(true);
    expect(label(buttons()[0].nextElementSibling)).toBe('Cancel');
  });

  test('clicking fills the textarea from the comments list', () => {
    addPraiseButton(textarea, praises);
    buttons()[0].click();

    expect(commentPraises).toContain(textarea.value);
  });

  test('decorating one editor leaves the other untouched', () => {
    addPraiseButton(textarea, praises);

    const other = document.querySelector<HTMLElement>('[data-editor="2"]')!;
    expect(buttons(other)).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run them**

Run: `npx jest src/lib/praise-button.test.ts`
Expected: PASS, 7 tests.

If the click tests fail with an empty `value`, the `execCommand` stub is not seeing a focused field — check `installExecCommand()` runs in `beforeEach` before `addPraiseButton`.

If "immediately before Cancel" fails, inspect what `nextElementSibling` actually is. Primer sometimes wraps a button in a tooltip element, and `findInsertionPoint` walks up single-child wrappers to compensate; a fixture without those wrappers can still be right, but the assertion tells you which shape you built.

- [ ] **Step 3: Commit**

```bash
npm run style
git add src/lib/praise-button.test.ts
git commit -m "Test praise button injection and placement"
```

---

### Task 6: Layer 2 — click behaviour and hide-on-typing

Split from Task 5 because these test the write path — `setPraise` and `toggleButton` — rather than placement. A reviewer could reasonably accept the placement tests and reject these.

**Files:**

- Modify: `src/lib/praise-button.test.ts` (append)

**Interfaces:**

- Consumes: everything Task 5 consumes. No new exports.

- [ ] **Step 1: Append the failing tests**

Add to the end of `src/lib/praise-button.test.ts`:

```typescript
describe('writing praises', () => {
  let textarea: HTMLTextAreaElement;

  beforeEach(() => {
    loadFixture('diff-comment');
    textarea = document.querySelector<HTMLTextAreaElement>('[data-editor="1"] textarea')!;
    addPraiseButton(textarea, praises);
  });

  test('clicking again can produce a different praise', () => {
    const button = buttons()[0];

    button.click();
    const first = textarea.value;

    // setPraise retries up to 10 times for a value different from the current
    // one, so with two praises available a change is effectively certain.
    button.click();

    expect(textarea.value).not.toBe(first);
    expect(commentPraises).toContain(textarea.value);
  });

  test('our own write leaves the button visible', () => {
    const button = buttons()[0];

    button.click();

    // The whole point of tracking what we wrote: the input event our write fires
    // is indistinguishable from the user's, and clicking again must stay possible.
    expect(button.hidden).toBe(false);
  });

  test('typing manually hides the button', () => {
    const button = buttons()[0];

    textarea.value = 'I typed this myself';
    textarea.dispatchEvent(new Event('input', { bubbles: true }));

    expect(button.hidden).toBe(true);
  });

  test('clearing the field brings the button back', () => {
    const button = buttons()[0];

    textarea.value = 'typed';
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    textarea.value = '';
    textarea.dispatchEvent(new Event('input', { bubbles: true }));

    expect(button.hidden).toBe(false);
  });

  test('an empty praise list writes nothing', () => {
    loadFixture('diff-comment');
    const empty = document.querySelector<HTMLTextAreaElement>('[data-editor="1"] textarea')!;
    addPraiseButton(empty, () => []);

    buttons()[0].click();

    expect(empty.value).toBe('');
  });
});
```

- [ ] **Step 2: Run them**

Run: `npx jest src/lib/praise-button.test.ts`
Expected: PASS, 12 tests total (7 from Task 5, 5 new).

The "different praise" test has a theoretical flake ceiling: `setPraise` retries 10 times for a value differing from the current one, so with two praises the odds of a repeat are about 1 in 1024. If you see it fail, that is a real bug in the retry loop, not noise.

- [ ] **Step 3: Confirm the whole suite and the build are green**

Run: `npm test && npm run build`
Expected: PASS — 4 suites, 24 tests, and a clean typecheck and bundle.

- [ ] **Step 4: Commit**

```bash
npm run style
git add src/lib/praise-button.test.ts
git commit -m "Test praise writing and hide-on-typing behaviour"
```

---

### Task 7: Document fixture provenance and the capture procedure

The suite's honest value depends on someone being able to replace synthetic fixtures with real ones. Undocumented, that never happens.

**Files:**

- Create: `test/fixtures/README.md`
- Modify: `CONTRIBUTING.md`

- [ ] **Step 1: Write the fixture README**

Create `test/fixtures/README.md`:

```markdown
# Test fixtures

HTML snapshots of GitHub PR pages, used by `src/lib/selectors.test.ts` and
`src/lib/praise-button.test.ts` to check the praise button still lands beside
each editor's Cancel button.

| File                 | State captured                               | Source    | Captured |
| -------------------- | -------------------------------------------- | --------- | -------- |
| `review-dialog.html` | "Finish your review" dialog open             | synthetic | —        |
| `diff-comment.html`  | Inline diff comment editor open, two editors | synthetic | —        |

## What these tests can and cannot tell you

They fail when **our** code stops placing the button correctly against the
markup recorded here.

They do **not** fail when GitHub redesigns its PR pages. These files are frozen,
so the suite keeps passing against markup that may no longer exist. Nothing
watches live GitHub -- the extension breaking in the real world reaches us via a
bug report, not CI.

Fixtures marked `synthetic` are hand-written from the structure described in
`src/lib/selectors.ts`. They test our logic against our own assumptions, so they
cannot reveal that a selector was wrong to begin with. Replacing them with real
captures is worthwhile.

## Capturing a real fixture

Needs a logged-in browser, so it cannot be automated in CI.

1. Open a PR with a reasonably small diff. `Files changed`.
2. For `diff-comment.html`: click the `+` on a diff line to open the inline
   comment editor. Open a second one on another line -- two editors is what lets
   the tests prove the insertion walk uses each editor's _own_ Cancel.
   For `review-dialog.html`: click `Review changes` -> `Comment`.
3. In devtools, select the outermost element containing every editor plus the
   page-level buttons, then right-click -> Copy -> Copy outerHTML.
4. Paste into the fixture file inside `<!doctype html><html lang="en"><body>`.
5. **Sanitize before committing.** A logged-in page carries credentials:
   - empty every `<script>` body,
   - delete `<meta>` tags holding CSRF or session tokens,
   - replace real usernames and avatar URLs with placeholders.
6. Prune the bulk. Keep the complete ancestor chain from the root down to each
   editor -- that chain is what `findInsertionPoint()` walks -- and delete
   unrelated diff rows and sidebars. Keep at least one markdown textarea that
   sits _outside_ both regions, so the tests can show `praiseContext()` leaves
   it alone.
7. Update the table above with the PR URL and date, and drop the `synthetic`
   note from the file's header comment.
8. `npm test`. Failures now are informative: either the capture is pruned too
   aggressively, or a selector in `src/lib/selectors.ts` is genuinely stale --
   which is exactly what these fixtures exist to surface.
```

- [ ] **Step 2: Point CONTRIBUTING.md at the tests**

`CONTRIBUTING.md` currently documents a stale structure (`src/typescript`) and never mentions tests. Append:

````markdown
## Test

```sh
npm test
```

Selector and placement tests run in Jest against jsdom, using HTML fixtures
captured from real GitHub PR pages. They fail when the praise button stops
landing beside each editor's Cancel button.

They do not detect GitHub redesigning its PR pages -- the fixtures are frozen
snapshots. See `test/fixtures/README.md` for what that means and how to refresh
them.

`src/lib/selector-observer.ts` has no tests: it works by listening for CSS
`animationstart`, which neither jsdom nor happy-dom implements.
````

- [ ] **Step 3: Verify the suite still passes**

Run: `npm test`
Expected: PASS, 24 tests. Documentation only, so nothing should move.

- [ ] **Step 4: Commit**

```bash
git add test/fixtures/README.md CONTRIBUTING.md
git commit -m "Document fixture provenance and the capture procedure"
```

---

## Definition of Done

- [ ] `npm test` passes: 4 suites, 24 tests.
- [ ] `npm run build` passes — clean `tsc --noEmit` and a written bundle.
- [ ] `src/__tests__/sum.ts` is gone.
- [ ] The extension still works when loaded unpacked in Chrome: the `Praise` button appears left of `Cancel` in both a diff comment editor and the review dialog, clicking inserts a praise, and typing manually hides it.
- [ ] `test/fixtures/README.md` records each fixture's provenance, and any synthetic fixture is labelled as such in both the README and its own header comment.
- [ ] No new dependency beyond `jest-environment-jsdom`.
- [ ] No test touches the network.

## Deliberately Not Done

State these plainly in your final report rather than letting them read as oversights:

- **`selector-observer.ts` is untested.** jsdom fires no `animationstart` (verified on jsdom 30.0.1 and happy-dom 20). Covering it needs a real browser engine.
- **Nothing detects a GitHub redesign.** Hermetic by decision — see the spec's rejected alternatives for the live-canary option and why it was declined.
- **No visual assertions.** Whether the button is correctly sized, positioned, and unclipped on screen is not checked.
- **If fixtures are synthetic, the selectors are unvalidated against real GitHub markup.** The suite guards our logic, not our assumptions.
