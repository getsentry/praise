# Hermetic DOM Tests for Praise Button Placement

**Date:** 2026-08-18
**Status:** Approved

## Problem

The extension injects a "PR" button into GitHub's PR review dialog and inline
diff comment editors. Placement depends on selectors in `src/lib/selectors.ts`
that target Primer React markup whose CSS-module class names carry a hash
rotating on every GitHub deploy. Nothing currently tests that the button lands
in the right place — the only test file, `src/__tests__/sum.ts`, contains two
empty test bodies that assert nothing.

We want a test that fails when the button stops appearing in the proper places,
running in CI on every PR.

## Prior Art: refined-github

Investigated at the user's request. Findings that shaped this design:

- refined-github uses **no browser automation** — vitest plus happy-dom. No
  Playwright, Puppeteer, Selenium, or Cypress in devDependencies. Its CI builds
  the extension and uploads it as an artifact but never loads it into a browser.
- Its closest analogue to what we want is
  `source/github-helpers/selectors.test.ts`: each selector export has a
  companion `selectorName_` array of `[expectedCount, url]` fixtures. The test
  `fetch()`es those real github.com pages (filesystem-cached under
  `test/.cache/*.html`), does `document.write(html)`, and asserts
  `$$optional(selector).length === expectedCount`.
- **That test is disabled** — `describe.concurrent.skip`, marked "broken"
  (refined-github issue 9314) because happy-dom cannot parse their selectors,
  with a note suggesting a move to jsdom or a real browser. Their `test.yml`
  additionally excludes `**/selectors*` from the vitest job, with a
  commented-out block referencing issue 7747 ("fails on CI, but not locally").

Conclusion: the closest prior art is both unbrowsered and switched off. We take
its idea — assert selectors against real GitHub markup — but with committed
fixtures instead of live `fetch`, which is the part that made theirs flaky.

## Constraints Established by Investigation

Verified empirically before designing, not assumed:

1. **Neither jsdom 30.0.1 nor happy-dom 20 fires `animationstart`**, and both
   report `getComputedStyle(el).animationName` as `"none"`/`""`. Therefore
   `src/lib/selector-observer.ts` — which works by registering a no-op CSS
   animation and listening for `animationstart` — **cannot be exercised in a
   simulated DOM at all**. Its mechanism _is_ the browser's style engine.
2. **`class*=` and `:where()` selectors work in both**, so the pure functions in
   `selectors.ts` are testable without a browser.
3. **`document.execCommand` does not exist in jsdom**, so `setFieldText` from
   `text-field-edit` throws `TypeError`. Stubbing `execCommand('insertText')`
   with a `setRangeText` + `InputEvent` implementation makes it work correctly,
   including repeated writes (verified: two successive `setFieldText` calls
   produced the right value and two `input` events).
4. **Jest 30 unbundles jsdom.** `jest-environment-jsdom` is not installed and
   `testEnvironment` is unset in `jest.config.js`, defaulting to `node`.

## Decisions

**Hermetic only.** CI never contacts live GitHub. No stored credentials, no
scheduled canary, no network in tests.

**No staleness automation.** Fixtures record when and where they came from in
their documentation; no cron job, no age assertion, no issue-opener.

**No browser in CI.** Jest and jsdom only.

## Scope: What This Suite Does and Does Not Catch

Stated explicitly because it is narrower than "a test that fails when the
buttons don't appear anymore on GitHub".

### Catches — build goes red

- A selector in `markdownTextarea`, `reviewDialog`, or `diffCommentEditor` that
  no longer matches the captured markup.
- `praiseContext()` admitting a textarea it should leave alone (PR description,
  edit-in-place boxes on the conversation tab), or refusing one it should claim.
- `findInsertionPoint()` climbing into a neighbouring editor's Cancel button,
  returning the flex column instead of the button row, or walking past its
  boundary to a page-level button.
- Regressions in button construction, click-to-fill, duplicate suppression, and
  hide-on-manual-typing.

### Does not catch

**GitHub redesigning its PR UI.** Fixtures are frozen HTML. When GitHub ships
new markup, this suite keeps passing green against the old DOM. Detection
remains human: a bug report, or someone re-capturing fixtures. This is the
accepted cost of the hermetic-only decision.

### Structurally out of reach in jsdom

- `selector-observer.ts` discovering a textarea (constraint 1 above).
- Anything visual: whether the button is actually beside Cancel on screen, sized
  correctly, and not clipped.

The residue is thinner than it sounds. Layer 1 asserts the `markdownTextarea`
selectors match the real fixture's textareas — the observer's _input_ — and
`selector-observer.ts` is an unmodified port of refined-github's
`source/helpers/selector-observer.tsx`. What goes untested is the animation
plumbing between two independently verified ends.

## Fixture Strategy

`test/fixtures/` holds sanitized HTML captured from a real, logged-in GitHub PR
page in two states: the "Finish your review" dialog open, and an inline diff
comment editor open.

**Sanitization is mandatory, not tidiness.** A logged-in PR page carries CSRF
tokens, session-scoped inline JSON, and usernames. Before any fixture is
committed: empty every `<script>` body, remove token-bearing `<meta>` tags,
and replace real usernames with placeholders.

**Pruning.** Real PR pages are multiple megabytes, mostly diff rows. Keep the
complete ancestor chain from `<html>` down to each editor — that chain is
exactly what `findInsertionPoint()` walks — and drop unrelated siblings.

**Capture requires a human.** Logging into GitHub is not something an
implementing agent can do. `test/fixtures/README.md` documents the procedure so
a maintainer can refresh fixtures, recording the source PR URL and capture date
for each file.

### Synthetic fallback

If real captures are unavailable when the suite is built, hand-authored
fixtures derived from the structure documented in `selectors.ts` unblock
implementation — but their value is materially lower, and this must not be
glossed over: **synthetic fixtures test our logic against our own assumptions,
not against GitHub's reality.** A synthetic fixture cannot detect that a
selector was wrong to begin with. Any synthetic fixture is labelled as such in
a header comment and in the README, and replacing it with a real capture is
tracked as follow-up work.

## Architecture

### A testable seam in the content script

`src/content_script.tsx` calls `loadPraises()`, `watchPraises()`,
`setUpObserver()`, and `watchNavigation()` at module top level, so importing it
in a test immediately touches `chrome.storage` and installs the observer. The
placement logic worth testing — `addPraiseButton`, `createButton`, `setPraise`,
`toggleButton` — is trapped behind that side-effecting import.

Extract those four functions into `src/lib/praise-button.ts`, taking the praise
list as an injected accessor instead of reading module-level `commentPraises` /
`reviewPraises`. `content_script.tsx` retains storage wiring, navigation
watching, and observer setup, and calls into the new module. The `lastWritten`
WeakMap and `decorated` WeakSet move with the functions that own them.

Behaviour is unchanged. This is the only production change in the design, and it
is what makes the placement layer testable.

### Two test layers

**Layer 1 — `src/lib/selectors.test.ts`.** Loads a fixture into jsdom and
asserts: each selector list matches the expected element count; `praiseContext()`
returns `"reviews"` inside the review dialog, `"comments"` inside the diff
editor, and `undefined` for the PR description textarea; `findInsertionPoint()`
returns a row whose `before` is that editor's own Cancel button.

**Layer 2 — `src/lib/praise-button.test.ts`.** Calls `addPraiseButton()` on a
fixture textarea and asserts: exactly one `.sentry-pr-praise-button` exists; it
sits immediately before Cancel; calling twice does not duplicate it; clicking
fills the textarea from the correct list; clicking again can produce a different
praise; typing manually hides the button while our own write does not.

### Test helpers

`src/lib/test-support/` holds two helpers, kept out of the test files so both
layers share one implementation:

- an `execCommand('insertText')` stub implemented via `setRangeText` plus a
  bubbling `InputEvent` (verified working with `setFieldText`);
- a minimal `chrome.storage` stub, sufficient for `content_script.tsx` imports.

## Config and CI

- Add `jest-environment-jsdom@^30` to devDependencies.
- Set `testEnvironment: "jsdom"` in `jest.config.js`.
- Delete `src/__tests__/sum.ts` — its two empty test bodies assert nothing and
  make the suite look covered when it is not.

**No new workflow.** `.github/workflows/test.yml` already runs `npm test` on
every pull request and every push to `main`. The suite is pure Node with no
browser, so it inherits that job unchanged: nothing to install, no xvfb, no
secrets, no flake surface.

## Rejected Alternatives

**Playwright extension E2E against fixtures.** Would cover
`selector-observer.ts` and real injection by loading `dist/` into Chromium via
`launchPersistentContext` with `channel: 'chromium'` (the default headless shell
cannot load extensions), serving fixtures through `context.route()` on a
`https://github.com/*/pull/*` URL so the content script's match pattern applies.
Rejected as out of scope for now; the design deliberately leaves the seam that
would make it addable later.

**Live authenticated canary.** The only approach that actually detects a GitHub
redesign. Rejected: requires credentials in repo secrets, a scratch PR to
operate on, cannot run on fork PRs, and carries ongoing secret upkeep.

**Unauthenticated live fetch (refined-github's approach).** Rejected on
mechanism: the review dialog and diff comment editor exist only after a
logged-in user interaction on a React-rendered page. An anonymous fetch of a
public PR returns a shell containing none of the insertion points we care about.
