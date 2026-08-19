# Agent Probe for Live PR Pages — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an agent drive a live GitHub PR page with the current build of the extension loaded, and report whether the praise button landed immediately before Cancel — with no human rebuild, reinstall, or manual navigation.

**Architecture:** `npm run dev` runs webpack in watch mode alongside `web-ext run`, which loads `dist/` unpacked into Chrome on a dedicated persistent profile and auto-reloads the extension on every rebuild. `--args=--remote-debugging-port=9222` opens a CDP port that web-ext does not itself use. `npm run probe` attaches to that port with zero dependencies (Node 26 has `fetch` and `WebSocket`), opens a tab, drives it into the review dialog or an inline diff editor, and writes three artifacts to `.probe/`.

**Tech Stack:** Node 26 (built-in `fetch`/`WebSocket`), `web-ext` 10.6.0, `npm-run-all2` 9.0.3, Jest 30 with `@swc/jest`, Chrome DevTools Protocol 1.3.

**Spec:** `docs/superpowers/specs/2026-08-19-agent-probe-design.md` — read it before starting. It records why the profile is dedicated, why the probe is read-only, and what this deliberately cannot catch.

## Global Constraints

- **Node 26.** All three CI workflows pin `node-version: '26'`. The probe relies on global `fetch` and `WebSocket`, both stable in Node 26.
- **Two new devDependencies only:** `web-ext@^10.6.0` and `npm-run-all2@^9.0.3`. Do **not** add Playwright, Puppeteer, `chrome-remote-interface`, `ws`, or `jest-environment-jsdom`.
- **`npm-run-all2`, not `npm-run-all`.** The original is unmaintained since 2018; the fork provides the same `run-p` binary.
- **No changes to `src/`.** This is dev tooling. If a genuine extension bug surfaces while probing, note it and keep going — fixing it is separate work.
- **No changes to `.github/workflows/`.** Nothing here runs in CI.
- **The probe is read-only.** It must never click Submit, Approve, Comment, or Close. No `--submit` flag, not even disabled.
- **CDP port is 9222** everywhere. Hardcode it as a named constant, not scattered literals.
- **Style:** run `npm run fix` before each commit (oxfmt + oxlint). Match the comment voice in `src/lib/selectors.ts` — explain _why_, use `--` for asides, do not restate the code.
- **Commit messages:** Conventional Commits, as the recent history uses (`feat:`, `docs:`, `build:`, `chore:`). Do **not** use the bare-imperative style described in the stale `6af26e0` plan.
- **The button contract:** class `sentry-pr-praise-button`, label `Praise`, anchor caption `Cancel`. Exact strings, from `src/lib/praise-button` behaviour in `src/content_script.tsx` and `src/lib/selectors.ts`.

---

## Prerequisite: one manual login (read before Task 6)

Tasks 1–5 need no browser. **Task 6 is the first that needs a logged-in GitHub session**, and an implementing agent cannot log into GitHub.

At Task 6, stop and ask the human to run `npm run dev` and log in once in the Chrome window that opens. The session persists in `test/web-ext-profile/` via `--keep-profile-changes`. Until that happens, the probe correctly reports `notLoggedIn` and there is nothing to debug.

Do not describe the probe as verified against real GitHub until a logged-in run has produced a `verdict.json` with `buttonFound: true`.

---

## File Structure

**Created:**

| Path                            | Responsibility                                                       |
| ------------------------------- | -------------------------------------------------------------------- |
| `scripts/probe.mjs`             | CLI entry: parse args, run scenario, write artifacts, set exit code. |
| `scripts/lib/args.mjs`          | Pure argument parsing and defaults.                                  |
| `scripts/lib/cdp.mjs`           | Minimal CDP client over WebSocket: connect, send, attach, close.     |
| `scripts/lib/page-probe.mjs`    | The in-page expression source and its result shape.                  |
| `scripts/lib/scenarios.mjs`     | The `review` and `diff-comment` step sequences.                      |
| `scripts/lib/sanitize.mjs`      | Strips tokens and user content from captured HTML.                   |
| `scripts/lib/args.test.mjs`     | Tests for arg parsing.                                               |
| `scripts/lib/sanitize.test.mjs` | Tests for sanitization.                                              |
| `test/web-ext-profile/.gitkeep` | Persistent dev profile directory (refined-github's layout).          |

**Modified:**

| Path              | Change                                                           |
| ----------------- | ---------------------------------------------------------------- |
| `package.json`    | `dev`, `web-ext`, `probe` scripts; two devDependencies.          |
| `jest.config.js`  | Add `scripts` to `roots`; transform and match `.mjs`.            |
| `.gitignore`      | `.probe/`, `test/web-ext-profile/*` with a `.gitkeep` exception. |
| `CONTRIBUTING.md` | The loop, the one-time login, the dev-profile warning.           |

**Deleted at the end (Task 8):** `docs/superpowers/specs/2026-08-19-agent-probe-design.md` and this plan.

---

### Task 1: Dev harness — dependencies, scripts, ignores

Gets `npm run dev` opening Chrome with the extension loaded. No probe yet. There is no test to write here: the deliverable is a browser window, gated by human observation.

**Files:**

- Modify: `package.json`
- Modify: `.gitignore`
- Create: `test/web-ext-profile/.gitkeep`

**Interfaces:**

- Produces: `npm run dev`, and a CDP endpoint on `http://127.0.0.1:9222` that every later task attaches to.

- [ ] **Step 1: Install the two devDependencies**

```bash
npm install --save-dev web-ext@^10.6.0 npm-run-all2@^9.0.3
```

- [ ] **Step 2: Add the scripts to `package.json`**

Add these three entries to `"scripts"`, immediately after `"watch"`:

```json
    "dev": "npm run build && run-p watch web-ext",
    "web-ext": "web-ext run --target=chromium --chromium-profile=test/web-ext-profile --keep-profile-changes --profile-create-if-missing --source-dir=dist --start-url=https://github.com/getsentry/praise/pull/22 --args=--remote-debugging-port=9222",
    "probe": "node scripts/probe.mjs",
```

`dev` builds once before `run-p` because `--source-dir=dist` must already exist when `web-ext` starts. `--args=--remote-debugging-port=9222` is what opens the port the probe attaches to — web-ext itself drives the browser over `--remote-debugging-pipe`, so without this flag there is no port to connect to.

- [ ] **Step 3: Create the profile directory**

```bash
mkdir -p test/web-ext-profile && touch test/web-ext-profile/.gitkeep
```

- [ ] **Step 4: Update `.gitignore`**

Append to the existing file (which currently holds `npm-debug.log`, `node_modules/`, `dist/`, `tmp/`):

```gitignore

# Probe artifacts and the browser profile it drives.
.probe/
test/web-ext-profile/*
!test/web-ext-profile/.gitkeep
```

- [ ] **Step 5: Verify the harness starts**

Run `npm run dev`. Expected: webpack compiles, a Chrome window opens on PR #22, and the terminal prints `Running web extension from .../dist`.

In a second terminal, confirm the port is live:

```bash
curl -s http://127.0.0.1:9222/json/version
```

Expected: JSON containing `"Browser": "Chrome/..."` and a `webSocketDebuggerUrl`. If this fails, nothing downstream can work — stop and report.

Confirm the extension loaded:

```bash
curl -s http://127.0.0.1:9222/json | grep -c "chrome-extension://"
```

Expected: at least `1` (the background service worker). Leave `npm run dev` running; stop it with Ctrl-C when done.

- [ ] **Step 6: Commit**

```bash
npm run fix
git add package.json package-lock.json .gitignore test/web-ext-profile/.gitkeep
git commit -m "build: add web-ext dev harness with a CDP port"
```

---

### Task 2: Jest runs `.mjs`, and argument parsing

The probe's pure logic gets real tests. Jest needs to transform `.mjs` first — verified working with `@swc/jest` and no ESM flags.

**Files:**

- Modify: `jest.config.js`
- Create: `scripts/lib/args.mjs`
- Test: `scripts/lib/args.test.mjs`
- Delete: `src/__tests__/sum.ts`

**Interfaces:**

- Produces:

  ```javascript
  export const DEFAULT_URL = 'https://github.com/getsentry/praise/pull/22';
  export const SCENARIOS = ['review', 'diff-comment'];
  export function parseArgs(argv): { scenario: string, url: string, error?: string };
  ```

  `argv` is `process.argv.slice(2)`. Arguments are positional and order-independent: anything starting with `http` is the URL, anything else is the scenario. On an unknown scenario, `error` is set and the caller exits non-zero.

- [ ] **Step 1: Update `jest.config.js`**

Replace the whole file:

```javascript
module.exports = {
  roots: ['src', 'scripts'],
  moduleFileExtensions: ['ts', 'tsx', 'mjs', 'js'],
  testMatch: ['**/__tests__/**/*.ts', '**/*.test.mjs'],
  transform: {
    '^.+\\.(tsx?|mjs)$': [
      '@swc/jest',
      {
        jsc: { parser: { syntax: 'typescript', tsx: true } },
      },
    ],
  },
};
```

- [ ] **Step 2: Write the failing test**

Create `scripts/lib/args.test.mjs`:

```javascript
import { DEFAULT_URL, parseArgs } from './args.mjs';

test('defaults to the review scenario on the test PR', () => {
  expect(parseArgs([])).toEqual({ scenario: 'review', url: DEFAULT_URL });
});

test('takes the scenario as a positional argument', () => {
  expect(parseArgs(['diff-comment'])).toEqual({
    scenario: 'diff-comment',
    url: DEFAULT_URL,
  });
});

test('takes a URL in either position', () => {
  const url = 'https://github.com/getsentry/praise/pull/7';

  expect(parseArgs([url])).toEqual({ scenario: 'review', url });
  expect(parseArgs(['diff-comment', url])).toEqual({ scenario: 'diff-comment', url });
  expect(parseArgs([url, 'diff-comment'])).toEqual({ scenario: 'diff-comment', url });
});

test('reports an unknown scenario rather than guessing', () => {
  const result = parseArgs(['reviw']);

  expect(result.error).toContain('reviw');
  expect(result.error).toContain('review');
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx jest scripts/lib/args.test.mjs`
Expected: FAIL — cannot find module `./args.mjs`.

- [ ] **Step 4: Write the implementation**

Create `scripts/lib/args.mjs`:

```javascript
/**
 * Argument parsing for the probe CLI.
 *
 * Positional and order-independent -- the two things a caller passes are a
 * scenario name and a PR URL, and they are never confusable: only one of them
 * starts with `http`.
 */

export const DEFAULT_URL = 'https://github.com/getsentry/praise/pull/22';

export const SCENARIOS = ['review', 'diff-comment'];

export function parseArgs(argv) {
  let scenario;
  let url;

  for (const argument of argv) {
    if (argument.startsWith('http')) {
      url = argument;
    } else {
      scenario = argument;
    }
  }

  const chosen = scenario ?? 'review';
  if (!SCENARIOS.includes(chosen)) {
    return {
      scenario: chosen,
      url: url ?? DEFAULT_URL,
      error: `Unknown scenario "${chosen}". Expected one of: ${SCENARIOS.join(', ')}.`,
    };
  }

  return { scenario: chosen, url: url ?? DEFAULT_URL };
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx jest`
Expected: PASS — the four new tests, plus the existing suite still green.

- [ ] **Step 6: Delete the placeholder test file**

`src/__tests__/sum.ts` contains two empty test bodies that assert nothing.

```bash
git rm src/__tests__/sum.ts
```

Run `npx jest` again. Expected: PASS, four tests, one suite.

- [ ] **Step 7: Commit**

```bash
npm run fix
git add jest.config.js scripts/lib/args.mjs scripts/lib/args.test.mjs
git commit -m "test: run jest over .mjs and parse probe arguments"
```

---

### Task 3: HTML sanitization

Captured HTML is committed-adjacent (it lands in `.probe/`, and the spec expects it to graduate into fixtures), so it must not carry tokens or private content.

**Files:**

- Create: `scripts/lib/sanitize.mjs`
- Test: `scripts/lib/sanitize.test.mjs`

**Interfaces:**

- Produces: `export function sanitizeHtml(html: string): string`

- [ ] **Step 1: Write the failing test**

Create `scripts/lib/sanitize.test.mjs`:

```javascript
import { sanitizeHtml } from './sanitize.mjs';

test('redacts CSRF tokens', () => {
  const html = '<input type="hidden" name="authenticity_token" value="s3cr3t-token-value">';

  expect(sanitizeHtml(html)).not.toContain('s3cr3t-token-value');
  expect(sanitizeHtml(html)).toContain('REDACTED');
});

test('redacts any attribute whose name looks like a secret', () => {
  const html = '<div data-csrf-token="abc123" data-session-id="xyz789"></div>';
  const result = sanitizeHtml(html);

  expect(result).not.toContain('abc123');
  expect(result).not.toContain('xyz789');
});

test('drops user avatars, which carry account identifiers', () => {
  const html = '<img src="https://avatars.githubusercontent.com/u/1402241?v=4" alt="x">';

  expect(sanitizeHtml(html)).not.toContain('avatars.githubusercontent.com');
});

test('keeps the structure the selectors depend on', () => {
  const html =
    '<div class="AddCommentEditor-module__Foo__a1b2c">' +
    '<textarea data-component="Textarea"></textarea>' +
    '<button>Cancel</button></div>';

  expect(sanitizeHtml(html)).toBe(html);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest scripts/lib/sanitize.test.mjs`
Expected: FAIL — cannot find module `./sanitize.mjs`.

- [ ] **Step 3: Write the implementation**

Create `scripts/lib/sanitize.mjs`:

```javascript
/**
 * Removes secrets and account identifiers from captured markup.
 *
 * These captures are the point of the probe -- real GitHub markup is the one
 * thing a synthetic fixture cannot provide -- so they are meant to be read,
 * shared, and eventually committed as fixtures. Class names and structure must
 * survive untouched, because they are exactly what `selectors.ts` matches on.
 */

const secretAttribute = /\b([\w-]*(?:token|csrf|session|auth|nonce)[\w-]*)="[^"]*"/gi;

const avatarUrl = /https:\/\/avatars\d*\.githubusercontent\.com\/[^"'\s>]*/gi;

export function sanitizeHtml(html) {
  return html.replace(secretAttribute, '$1="REDACTED"').replace(avatarUrl, 'REDACTED_AVATAR');
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest`
Expected: PASS, all suites.

- [ ] **Step 5: Commit**

```bash
npm run fix
git add scripts/lib/sanitize.mjs scripts/lib/sanitize.test.mjs
git commit -m "feat: redact secrets from captured probe markup"
```

---

### Task 4: Minimal CDP client

The transport. No unit test — its entire behaviour is I/O against a running browser, so the gate is a live smoke check against the harness from Task 1.

**Files:**

- Create: `scripts/lib/cdp.mjs`

**Interfaces:**

- Produces:

  ```javascript
  export const CDP_PORT = 9222;
  export class ProbeConnectionError extends Error {}
  export async function connect(): Promise<Connection>
  // Connection: { send(method, params?, sessionId?), close() }
  export async function openTab(connection, url): Promise<{ targetId, sessionId }>
  export async function closeTab(connection, targetId): Promise<void>
  ```

  `send` resolves to the CDP `result` object and rejects on a CDP `error`. `connect` throws `ProbeConnectionError` when the port is unreachable — Task 6 turns that into the "run `npm run dev`" message.

- [ ] **Step 1: Write `scripts/lib/cdp.mjs`**

```javascript
/**
 * A minimal Chrome DevTools Protocol client.
 *
 * Node 26 ships `fetch` and `WebSocket`, so this needs no dependency -- and a
 * dependency would be a poor trade here, since we use four methods of a
 * protocol that is stable at 1.3.
 *
 * web-ext drives the same browser over `--remote-debugging-pipe`, which is a
 * separate channel: the two coexist, and this one is ours.
 */

export const CDP_PORT = 9222;

/** Thrown when the browser is not reachable, so the CLI can explain the fix. */
export class ProbeConnectionError extends Error {}

export async function connect() {
  let version;
  try {
    const response = await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`);
    version = await response.json();
  } catch (cause) {
    throw new ProbeConnectionError(`No browser on port ${CDP_PORT}`, { cause });
  }

  const socket = new WebSocket(version.webSocketDebuggerUrl);
  const pending = new Map();
  let nextId = 0;

  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    const waiting = pending.get(message.id);
    if (!waiting) {
      // An event rather than a response. We subscribe to none, so ignore it.
      return;
    }

    pending.delete(message.id);
    if (message.error) {
      waiting.reject(new Error(`${message.method ?? 'CDP'}: ${message.error.message}`));
    } else {
      waiting.resolve(message.result);
    }
  });

  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener(
      'error',
      () => {
        reject(new ProbeConnectionError(`Could not open a CDP socket on port ${CDP_PORT}`));
      },
      { once: true },
    );
  });

  socket.addEventListener('close', () => {
    for (const waiting of pending.values()) {
      waiting.reject(new ProbeConnectionError('The browser closed the CDP connection'));
    }
    pending.clear();
  });

  return {
    send(method, params = {}, sessionId) {
      const id = ++nextId;
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
      });
    },
    close() {
      socket.close();
    },
  };
}

/** Opens a tab and attaches to it, returning the ids later calls need. */
export async function openTab(connection, url) {
  const { targetId } = await connection.send('Target.createTarget', { url });
  const { sessionId } = await connection.send('Target.attachToTarget', {
    targetId,
    flatten: true,
  });

  await connection.send('Page.enable', {}, sessionId);
  await connection.send('Runtime.enable', {}, sessionId);

  return { targetId, sessionId };
}

export async function closeTab(connection, targetId) {
  await connection.send('Target.closeTarget', { targetId });
}
```

- [ ] **Step 2: Smoke-check against the live browser**

Start `npm run dev` in a second terminal if it is not already running, then:

```bash
node --input-type=module -e "
import { connect, openTab, closeTab } from './scripts/lib/cdp.mjs';
const c = await connect();
const { targetId, sessionId } = await openTab(c, 'https://example.com');
const r = await c.send('Runtime.evaluate', { expression: 'document.title', returnByValue: true }, sessionId);
console.log('TITLE:', r.result.value);
await closeTab(c, targetId);
c.close();
"
```

Expected: `TITLE: Example Domain`, and the tab it opened closes itself.

- [ ] **Step 3: Verify the failure path**

Stop `npm run dev` (Ctrl-C), then run the same command.
Expected: it throws `ProbeConnectionError: No browser on port 9222` — not a hang, and not an unhandled `fetch` error.

- [ ] **Step 4: Commit**

```bash
npm run fix
git add scripts/lib/cdp.mjs
git commit -m "feat: add a dependency-free CDP client for the probe"
```

---

### Task 5: The in-page probe expression

What actually gets asked of the page. It runs inside the browser, so it is a string of source rather than an imported function — and it must answer the real invariant, not merely "a button exists".

**Files:**

- Create: `scripts/lib/page-probe.mjs`

**Interfaces:**

- Consumes: nothing.
- Produces:

  ```javascript
  export const BUTTON_CLASS = 'sentry-pr-praise-button';
  export const pageStateExpression: string;   // → { url, loggedIn, user }
  export const inspectExpression: string;     // → InspectResult
  ```

  `InspectResult` is `{ buttonFound, beforeCancel, buttonLabel, insertionPoint, editorHtml, rect }`, where `rect` is `{x, y, width, height}` of the editor for screenshot clipping, or `null`. Task 6 consumes exactly these names.

- [ ] **Step 1: Write `scripts/lib/page-probe.mjs`**

```javascript
/**
 * Expressions evaluated inside the page.
 *
 * These are source strings rather than functions because they execute in the
 * browser, not here. Each returns JSON so `Runtime.evaluate` can hand it back
 * by value.
 *
 * The check that matters is `beforeCancel`, not `buttonFound`: the contract in
 * `selectors.ts` is that our button sits immediately before Cancel, and a
 * button that landed anywhere else is the exact bug this probe exists to catch.
 */

export const BUTTON_CLASS = 'sentry-pr-praise-button';

export const pageStateExpression = `JSON.stringify({
  url: location.href,
  loggedIn: Boolean(document.querySelector('meta[name="user-login"]')?.content),
  user: document.querySelector('meta[name="user-login"]')?.content ?? null,
})`;

export const inspectExpression = `(() => {
  const buttonClass = ${JSON.stringify(BUTTON_CLASS)};
  const button = document.querySelector('.' + buttonClass);

  const caption = element => (element.textContent ?? '').replace(/\\s+/g, ' ').trim();

  // The editor is whatever contains the Cancel button we anchor to, so find
  // Cancel first and work outwards -- that way the capture is meaningful even
  // when our own button is missing entirely, which is the interesting case.
  let cancel;
  for (const candidate of document.querySelectorAll('button')) {
    if (caption(candidate) === 'Cancel') {
      cancel = candidate;
      break;
    }
  }

  const editor = cancel?.closest('[role="dialog"], div[class*="AddCommentEditor"], div[class*="ReviewThread"]')
    ?? cancel?.parentElement?.parentElement
    ?? null;

  const box = editor?.getBoundingClientRect();

  return JSON.stringify({
    buttonFound: Boolean(button),
    buttonLabel: button ? caption(button) : null,
    // nextElementSibling rather than index arithmetic: it is the same relation
    // \`before.before(button)\` establishes, so it fails exactly when we regress.
    beforeCancel: Boolean(button && cancel && button.nextElementSibling === cancel),
    insertionPoint: cancel
      ? {
          rowTag: cancel.parentElement?.tagName ?? null,
          rowChildren: cancel.parentElement?.children.length ?? 0,
          siblingCaptions: [...(cancel.parentElement?.children ?? [])].map(caption),
        }
      : null,
    editorHtml: editor?.outerHTML ?? null,
    rect: box
      ? { x: box.x, y: box.y, width: box.width, height: box.height }
      : null,
  });
})()`;
```

- [ ] **Step 2: Sanity-check the expression parses**

```bash
node --input-type=module -e "
import { inspectExpression, pageStateExpression } from './scripts/lib/page-probe.mjs';
new Function('return ' + inspectExpression);
new Function('return ' + pageStateExpression);
console.log('both expressions parse');
"
```

Expected: `both expressions parse`. This catches escaping mistakes in the template literal without needing a browser.

- [ ] **Step 3: Commit**

```bash
npm run fix
git add scripts/lib/page-probe.mjs
git commit -m "feat: add the in-page inspection expressions"
```

---

### Task 6: Scenarios and the CLI

Wires everything into `npm run probe`. **This is the first task that needs a logged-in browser** — see the prerequisite above.

**Files:**

- Create: `scripts/lib/scenarios.mjs`
- Create: `scripts/probe.mjs`

**Interfaces:**

- Consumes: `parseArgs`, `DEFAULT_URL` from `./lib/args.mjs`; `connect`, `openTab`, `closeTab`, `ProbeConnectionError`, `CDP_PORT` from `./lib/cdp.mjs`; `inspectExpression`, `pageStateExpression` from `./lib/page-probe.mjs`; `sanitizeHtml` from `./lib/sanitize.mjs`.
- Produces: `.probe/verdict.json`, `.probe/editor.png`, `.probe/editor.html`; exit code 0 when `beforeCancel` is true, 1 otherwise.

- [ ] **Step 1: Write `scripts/lib/scenarios.mjs`**

```javascript
/**
 * Driving the page into the states where our button exists.
 *
 * Navigation alone proves nothing: the button is only ever inside an open
 * comment editor, so each scenario has to open one. The two are separate
 * because `selectors.ts` reaches them by different routes -- `reviewDialog`
 * versus `diffCommentEditor` -- and a regression usually breaks one, not both.
 *
 * Steps are described here and executed by the CLI, so a failure can name the
 * step that failed. When GitHub moves its markup, that name is the diagnostic.
 */

/** Clicks the first button whose visible caption matches, in the page. */
const clickByCaption = pattern => `(() => {
  const caption = element => (element.textContent ?? '').replace(/\\s+/g, ' ').trim();
  for (const button of document.querySelectorAll('button, summary, a[role="button"]')) {
    if (${pattern}.test(caption(button))) {
      button.click();
      return true;
    }
  }
  return false;
})()`;

/** Opens the inline editor on the first diff line that offers one. */
const openDiffComment = `(() => {
  const trigger = document.querySelector(
    'button[aria-label*="Add a comment" i], button[data-testid*="add-line-comment" i], td.blob-code button.add-line-comment',
  );
  if (!trigger) {
    return false;
  }
  trigger.click();
  return true;
})()`;

export const scenarios = {
  review: {
    description: 'the "Finish your review" dialog',
    steps: [
      { name: 'open-review-menu', expression: clickByCaption('/^(Review changes|Add your review)$/i') },
      { name: 'await-textarea', awaitSelector: 'textarea' },
    ],
  },
  'diff-comment': {
    description: 'an inline diff comment editor',
    // The files tab is a separate URL rather than a click, so the CLI navigates
    // there first; soft navigation would race the observer re-arming.
    navigateSuffix: '/files',
    steps: [
      { name: 'open-diff-comment', expression: openDiffComment },
      { name: 'await-textarea', awaitSelector: 'textarea' },
    ],
  },
};
```

- [ ] **Step 2: Write `scripts/probe.mjs`**

```javascript
#!/usr/bin/env node
/**
 * Drives a live GitHub PR page and reports where the praise button landed.
 *
 * Attaches to the browser `npm run dev` already runs -- it never launches one
 * of its own, because the whole point is to test the build that is loaded
 * there, in the profile that is logged in.
 *
 * Strictly read-only: it opens editors and looks at them. Nothing here submits
 * a review or a comment.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { parseArgs } from './lib/args.mjs';
import { CDP_PORT, closeTab, connect, openTab, ProbeConnectionError } from './lib/cdp.mjs';
import { inspectExpression, pageStateExpression } from './lib/page-probe.mjs';
import { sanitizeHtml } from './lib/sanitize.mjs';
import { scenarios } from './lib/scenarios.mjs';

const OUTPUT_DIR = '.probe';

const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

async function evaluate(connection, sessionId, expression) {
  const response = await connection.send(
    'Runtime.evaluate',
    { expression, returnByValue: true, awaitPromise: true },
    sessionId,
  );

  if (response.exceptionDetails) {
    throw new Error(response.exceptionDetails.exception?.description ?? 'in-page exception');
  }

  return response.result.value;
}

/** Polls until the selector appears, because React mounts editors late. */
async function waitForSelector(connection, sessionId, selector, timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const found = await evaluate(connection, sessionId, `Boolean(document.querySelector(${JSON.stringify(selector)}))`);
    if (found) {
      return true;
    }
    await delay(250);
  }

  return false;
}

async function main() {
  const { scenario, url, error } = parseArgs(process.argv.slice(2));
  if (error) {
    console.error(error);
    process.exit(1);
  }

  const plan = scenarios[scenario];
  let connection;
  try {
    connection = await connect();
  } catch (cause) {
    if (cause instanceof ProbeConnectionError) {
      console.error(
        `No browser listening on port ${CDP_PORT}.\n` +
          'Start the dev harness first, in another terminal:\n\n  npm run dev\n',
      );
      process.exit(1);
    }
    throw cause;
  }

  const target = plan.navigateSuffix ? url.replace(/\/*$/, '') + plan.navigateSuffix : url;
  const { targetId, sessionId } = await openTab(connection, target);
  const verdict = { scenario, url: target, buttonFound: false, beforeCancel: false };

  try {
    // GitHub renders progressively and our content script retries for two
    // seconds; give both room before touching anything.
    await waitForSelector(connection, sessionId, 'main', 15_000);
    await delay(2000);

    const state = JSON.parse(await evaluate(connection, sessionId, pageStateExpression));
    if (!state.loggedIn) {
      console.error(
        'That profile is not logged into GitHub, so no review dialog or diff\n' +
          'editor exists to test. Log in once in the window `npm run dev` opens;\n' +
          '--keep-profile-changes will remember it.\n',
      );
      verdict.error = 'notLoggedIn';
      await writeVerdict(verdict);
      process.exitCode = 1;
      return;
    }

    verdict.user = state.user;

    for (const step of plan.steps) {
      if (step.awaitSelector) {
        if (!(await waitForSelector(connection, sessionId, step.awaitSelector))) {
          verdict.error = `step "${step.name}" timed out waiting for ${step.awaitSelector}`;
          break;
        }
        continue;
      }

      const worked = await evaluate(connection, sessionId, step.expression);
      if (!worked) {
        verdict.error = `step "${step.name}" found nothing to click -- GitHub's markup may have moved`;
        break;
      }
      await delay(1500);
    }

    // Inspect regardless of whether the steps succeeded: when they fail, the
    // capture is the diagnostic.
    const inspection = JSON.parse(await evaluate(connection, sessionId, inspectExpression));
    Object.assign(verdict, {
      buttonFound: inspection.buttonFound,
      beforeCancel: inspection.beforeCancel,
      buttonLabel: inspection.buttonLabel,
      insertionPoint: inspection.insertionPoint,
    });

    await mkdir(OUTPUT_DIR, { recursive: true });

    const html = inspection.editorHtml ?? (await evaluate(connection, sessionId, 'document.documentElement.outerHTML'));
    await writeFile(`${OUTPUT_DIR}/editor.html`, sanitizeHtml(html));

    const clip = inspection.rect && inspection.rect.width > 0 ? { ...inspection.rect, scale: 1 } : undefined;
    const screenshot = await connection.send(
      'Page.captureScreenshot',
      { format: 'png', captureBeyondViewport: Boolean(clip), ...(clip ? { clip } : {}) },
      sessionId,
    );
    await writeFile(`${OUTPUT_DIR}/editor.png`, Buffer.from(screenshot.data, 'base64'));

    await writeVerdict(verdict);
    report(verdict, plan);
    // Set the code rather than exiting here: `process.exit` inside `try` skips
    // the `finally` below, which would leak the tab on every run.
    process.exitCode = verdict.beforeCancel ? 0 : 1;
  } finally {
    // Escape closes the editor we opened, so the browser is left as we found it.
    await evaluate(
      connection,
      sessionId,
      `document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })), true`,
    ).catch(() => {});
    await closeTab(connection, targetId).catch(() => {});
    connection.close();
  }
}

async function writeVerdict(verdict) {
  await mkdir(OUTPUT_DIR, { recursive: true });
  await writeFile(`${OUTPUT_DIR}/verdict.json`, `${JSON.stringify(verdict, null, 2)}\n`);
}

function report(verdict, plan) {
  if (verdict.beforeCancel) {
    console.log(`PASS -- the praise button sits before Cancel in ${plan.description}.`);
  } else if (verdict.buttonFound) {
    console.error(`FAIL -- the button exists but is not before Cancel in ${plan.description}.`);
  } else {
    console.error(`FAIL -- no praise button in ${plan.description}. ${verdict.error ?? ''}`);
  }

  console.log(`Artifacts: ${OUTPUT_DIR}/verdict.json, ${OUTPUT_DIR}/editor.png, ${OUTPUT_DIR}/editor.html`);
}

await main();
```

- [ ] **Step 3: Verify the not-running failure path**

With `npm run dev` **stopped**:

```bash
npm run probe
```

Expected: prints `No browser listening on port 9222` and the `npm run dev` instruction; exits 1. It must not hang and must not launch a browser.

- [ ] **Step 4: Ask the human to log in**

Stop here and ask:

> "Please run `npm run dev` and log into GitHub in the Chrome window it opens, then tell me when you're done. It's a one-time step — the session persists in `test/web-ext-profile/`."

Do not continue until they confirm. Without a login the next step cannot pass, and reporting otherwise would be false.

- [ ] **Step 5: Run the review scenario**

```bash
npm run probe -- review
```

Expected: `PASS -- the praise button sits before Cancel in the "Finish your review" dialog.`, exit 0, and three files in `.probe/`.

Check `.probe/verdict.json` shows `"beforeCancel": true`, and open `.probe/editor.png` to confirm it shows the dialog with the Praise button.

If it fails, read `.probe/editor.html` — that capture is the diagnostic, and it is real GitHub markup. Report what it shows rather than guessing.

- [ ] **Step 6: Run the diff-comment scenario**

```bash
npm run probe -- diff-comment
```

Expected: PASS, exit 0. If the step `open-diff-comment` reports finding nothing to click, the selectors in `scripts/lib/scenarios.mjs` need updating against what `.probe/editor.html` actually contains — fix them there, not in `src/`.

- [ ] **Step 7: Commit**

```bash
npm run fix
git add scripts/probe.mjs scripts/lib/scenarios.mjs
git commit -m "feat: probe live PR pages for praise button placement"
```

---

### Task 7: Document the loop

**Files:**

- Modify: `CONTRIBUTING.md`

- [ ] **Step 1: Add the section**

Insert after the existing "Build in watch mode" section and before "Load extension to chrome":

````markdown
## Fast feedback loop

`npm run watch` plus a manual reinstall is the slow path. `npm run dev` runs the
build in watch mode _and_ a Chrome instance with the extension already loaded,
reloading it on every rebuild:

```sh
npm run dev
```

**First run only:** log into GitHub in the window that opens. The session is
kept in `test/web-ext-profile/` and lasts for weeks.

With that running, check a live PR page from another terminal:

```sh
npm run probe                  # the review dialog on the test PR
npm run probe -- diff-comment  # an inline diff comment editor
npm run probe -- review https://github.com/getsentry/praise/pull/7
```

It exits 0 only when the praise button sits immediately before Cancel, and
writes three files to `.probe/`:

| File           | What it is                          |
| -------------- | ----------------------------------- |
| `verdict.json` | The result, for scripts and agents  |
| `editor.png`   | A screenshot of the editor          |
| `editor.html`  | The editor's real markup, sanitized |

`editor.html` is worth keeping when something breaks: GitHub's Primer class
names carry a hash that rotates on every deploy, so a real capture is the only
reliable record of what the page actually looked like.

The probe is read-only — it opens editors and inspects them, and never submits
a review or comment.

> The profile `npm run dev` uses runs with `--keep-profile-changes`, which
> disables auto-updates and allows silent remote connections. Use it for
> development only, not for browsing.
````

- [ ] **Step 2: Verify the commands in the docs actually work**

Run each command block exactly as written above. Expected: all behave as documented. Fix the docs if any drifted.

- [ ] **Step 3: Commit**

```bash
npm run fix
git add CONTRIBUTING.md
git commit -m "docs: describe the probe-based feedback loop"
```

---

### Task 8: Retire the spec and plan

The spec's own Lifecycle section calls for this: specs describe an intermediate design and mislead once merged. `6af26e0` is the cautionary example — it still describes a `src/lib/praise-button.ts` extraction that never landed.

**Files:**

- Delete: `docs/superpowers/specs/2026-08-19-agent-probe-design.md`
- Delete: `docs/superpowers/plans/2026-08-19-agent-probe.md`

- [ ] **Step 1: Confirm the durable reasoning survived**

Check that `CONTRIBUTING.md` now carries: why the profile is dedicated, that the probe is read-only, and why real captures matter. If any is missing, add it before deleting — that is the whole point of this task.

- [ ] **Step 2: Delete both documents**

```bash
git rm docs/superpowers/specs/2026-08-19-agent-probe-design.md
git rm docs/superpowers/plans/2026-08-19-agent-probe.md
```

- [ ] **Step 3: Final verification**

```bash
npm run verify && npx jest && npm run build
```

Expected: all three pass.

- [ ] **Step 4: Commit**

```bash
git commit -m "docs: drop the design and plan documents from this branch"
```

---

## Verification

The work is done when, with `npm run dev` running and logged in:

- `npm run probe -- review` exits 0 and reports PASS.
- `npm run probe -- diff-comment` exits 0 and reports PASS.
- `npm run probe` with the harness stopped exits 1 with the "run `npm run dev`" message.
- `npx jest`, `npm run verify`, and `npm run build` all pass.
- `git status` is clean, and `.probe/` and the profile contents are untracked.

## What this deliberately does not do

- Nothing runs in CI, so nothing here stops a regression from merging.
- It verifies the button _lands_ correctly, not that it _looks_ right — that is the PNG and human judgement.
- When GitHub changes its markup, the scenario steps break alongside the extension. The probe names the failing step so the two can be told apart, but the scenarios in `scripts/lib/scenarios.mjs` need occasional maintenance.
- The login expires eventually and must be redone by hand.
