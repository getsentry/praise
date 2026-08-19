# Agent Probe for Live PR Pages — Design

**Status:** approved, not yet implemented
**Date:** 2026-08-19

> **Delete this file in the PR that lands the work.** Promote anything durable
> into `CONTRIBUTING.md` first — see [Lifecycle](#lifecycle). This repo has
> dropped specs before merge twice already (`63780f7`, `1717fba`).

## Problem

Verifying a change to this extension currently costs: `npm run build`, open
Chrome, re-install the unpacked extension, navigate to a PR, open the review
dialog, look. Every iteration. When an agent makes the change, the human does
all of that and reports back by screenshot, so the agent never sees the thing it
is being asked to fix.

The failures are concentrated where a simulated DOM cannot reach them. GitHub's
PR pages are Primer React with class names that carry a hash rotating on every
deploy, and the review dialog mounts its footer _after_ the textarea — which is
why `addPraiseButton` retries. The existing plan for hermetic jsdom tests
(`6af26e0`) reached the same conclusion in its own words: a synthetic fixture
"cannot reveal that a selector was wrong in the first place."

So the loop must close against **real GitHub markup, with the real extension
loaded, in a real browser.**

## Goal

An agent can, unattended, drive a live GitHub PR page with the current build of
the extension installed, and report whether the praise button landed correctly.

**Non-goal:** a pass/fail suite in CI. This is an interactive probe. The `.probe/`
HTML captures are what would make a real suite possible later, but that is a
separate decision.

## Prior art: Refined GitHub

The largest extension solving this same problem
([refined-github](https://github.com/refined-github/refined-github)) was
surveyed. Findings:

- `npx web-ext run --target=chromium` is their documented dev loop. `web-ext`
  loads the unpacked build and **auto-reloads the extension when the build
  output changes**.
- The profile is dedicated and persistent: `test/web-ext-profile/`, gitignored
  except a `.gitkeep`. Log in once; the session survives across runs.
- Automated tests are vitest + happy-dom — unit tests on helpers and snapshot
  tests on feature metadata. Same hermetic ceiling described above.
- **They have no browser automation verifying features against real GitHub.**
  Verification is a human looking at the page; screenshots are hand-captured.
  Their `CLAUDE.md` and `agents.md` contain a prank, not guidance.

So the probe below is not a solved problem being re-solved — it is an extension
of their setup, justified by having an agent in the loop where they have a
human. Their dev-loop mechanics (web-ext, dedicated persistent profile) are
adopted wholesale; only the CDP probe is new.

## Verified constraints

Established empirically on this machine on 2026-08-19, with a throwaway spike
that was cleaned up. An implementer can rely on these without re-testing.

- **`web-ext@10.6.0` drives the browser over `--remote-debugging-pipe`, not a
  port.** The agent therefore cannot attach unless `--remote-debugging-port` is
  added via `--args`. Confirmed in the runner source
  (`lib/extension-runners/chromium.js`).
- **Pipe and port coexist.** With `--args=--remote-debugging-port=9222`, CDP
  answered on 9222 (`Chrome/151.0.7922.137`) while web-ext kept control. This
  was the load-bearing unknown; it works.
- **The extension loads.** The service worker appeared as a CDP target
  (`chrome-extension://<id>/js/background.js`), and a driven tab reached PR #22
  and returned page state.
- **`--keep-profile-changes` requires a user-data-dir on Chromium** or it throws.
  An empty directory qualifies, so `test/web-ext-profile` works from scratch.
- **Node 26 has built-in `fetch` and `WebSocket`.** The probe itself needs zero
  dependencies — no Playwright, no Puppeteer, no CDP client library.
- **A fresh profile is not logged in.** The spike returned `loggedIn: false`, so
  no review dialog and no diff editor existed. Hence the one-time login below.

## Decisions

**Chrome, not Brave.** Both were considered; Brave was verified working via
`--chromium-binary`. Chrome wins because it is web-ext's default target (no
binary path to hardcode) and is what users run.

**A dedicated `test/web-ext-profile`, not the live Chrome profile.** Chromium
locks a profile to one running instance, so using the real one means quitting
Chrome for every probe run — the exact friction being removed. web-ext's
alternative (copying the profile to a temp dir when `--keep-profile-changes` is
omitted) would duplicate ~76 MB of live cookies for every site into `/tmp`, and
is rejected on that basis. The dedicated profile also means the agent's browser
never holds a session that can approve or merge as the user.

**Cost: one manual GitHub login**, inside the window web-ext opens, re-done only
when the session expires. Accepted explicitly.

**Read-only.** The probe never clicks Submit, Approve, or Comment. Anything that
submits is a separate, explicit decision, not a flag added quietly later.

## The loop

Once, ever:

```sh
npm install
npm run dev      # a Chrome window opens; log into GitHub in it
```

Once per session: `npm run dev`, left running. Your own Chrome is unaffected —
separate profile, separate window.

Every iteration, with no manual steps:

1. Human pastes a complaint (screenshot or sentence).
2. Agent edits `src/`.
3. webpack rebuilds `dist/` → web-ext auto-reloads the extension in the live
   browser.
4. Agent runs `npm run probe -- review`.
5. Agent reads `.probe/verdict.json` for pass/fail, `.probe/editor.png` to see
   what the human would see, `.probe/editor.html` for the real markup.
6. Agent iterates from step 2.

## Components

### `npm run dev`

Runs two processes concurrently:

```
webpack --config webpack/webpack.dev.js --watch
web-ext run --target=chromium \
  --chromium-profile=test/web-ext-profile \
  --keep-profile-changes \
  --profile-create-if-missing \
  --source-dir=dist \
  --args=--remote-debugging-port=9222
```

This repo has no process runner today. Add `npm-run-all` as a devDependency and
express the pair as `run-p watch web-ext` — matching how refined-github composes
its own `watch` script — rather than backgrounding with `&`, which leaves an
orphaned browser when the terminal closes. `web-ext` must not start before the
first build completes, since `--source-dir=dist` must exist: on a clean checkout
`dev` therefore runs `npm run build` once before `run-p`.

`--keep-profile-changes` disables auto-update and permits silent remote
connections for that profile. It is a development profile only; this must be
stated in `CONTRIBUTING.md`.

### `scripts/probe.mjs`

Zero dependencies. Attaches to CDP on 9222, opens a tab, drives it to the
requested state, writes artifacts, closes the tab.

```sh
npm run probe -- [scenario] [url]
```

Defaults: scenario `review`, url `https://github.com/getsentry/praise/pull/22`.

**Scenarios.** The button only exists inside an open editor, so navigation alone
proves nothing. Both are needed because `selectors.ts` resolves them by
different paths (`reviewDialog` vs `diffCommentEditor`):

| Scenario       | Steps                                                               |
| -------------- | ------------------------------------------------------------------- |
| `review`       | Open the PR → click "Review changes" → await the dialog             |
| `diff-comment` | Files tab → hover a diff line → click `+` → await the inline editor |

**Artifacts**, written to a gitignored `.probe/`:

| File           | Purpose                                                             |
| -------------- | ------------------------------------------------------------------- |
| `verdict.json` | `{scenario, url, buttonFound, beforeCancel, insertionPoint, error}` |
| `editor.png`   | Screenshot of the editor region                                     |
| `editor.html`  | Sanitized dump of the editor subtree                                |

`beforeCancel` is the actual invariant in `selectors.ts` — the button sits
immediately before Cancel — not merely "a button exists somewhere on the page."

`editor.html` is the compounding artifact: it is **real GitHub markup**, the
thing `6af26e0` correctly identified as unobtainable synthetically. Every probe
run harvests one for free.

### Failure behavior

Each failure is distinct and must be reported as itself, never collapsed into
"the button is missing":

- **Port 9222 unreachable** → print "run `npm run dev`", exit non-zero. Never
  launch a browser of its own.
- **Not logged in** → say so, point at the one-time login. Do not report the
  button as absent.
- **Scenario cannot reach its state** (GitHub markup moved) → dump the page HTML
  anyway and name the step that failed. That dump is the diagnostic.

## File structure

**Created:**

| Path                            | Responsibility                          |
| ------------------------------- | --------------------------------------- |
| `scripts/probe.mjs`             | CDP driver, scenarios, artifact writing |
| `test/web-ext-profile/.gitkeep` | Persistent dev profile (RG's layout)    |

**Modified:**

| Path              | Change                                                                |
| ----------------- | --------------------------------------------------------------------- |
| `package.json`    | `dev` + `probe` scripts; `web-ext` and `npm-run-all` devDependencies  |
| `.gitignore`      | `.probe/`, `test/web-ext-profile/*`, `!test/web-ext-profile/.gitkeep` |
| `CONTRIBUTING.md` | The loop, the one-time login, the dev-profile warning                 |

**Unchanged:** `src/`, all three CI workflows, `jest.config.js`. No test runner
and no CI assertions are part of this work.

## Limits

Stated so nobody mistakes the probe for more than it is:

- It verifies the button _lands_ correctly in a live editor. Whether it _looks_
  right is the PNG and human judgement.
- When GitHub changes its markup, the scenario steps break alongside the
  extension. The probe names the failing step so the two can be told apart, but
  the scenarios need occasional maintenance.
- The login expires and must be redone by hand.
- Nothing here runs in CI, so nothing here prevents a regression from merging.

## Lifecycle

Delete this file in the PR that lands the work. Before deleting, promote to
`CONTRIBUTING.md` anything durable that the diff cannot express — chiefly _why_
the profile is dedicated and _why_ the probe is read-only. Reasoning about
selector fragility belongs in comments in `src/lib/selectors.ts`, which already
carries it well.

Specs describe an intermediate design and rot once merged: `6af26e0` still
describes a `src/lib/praise-button.ts` extraction that never landed, which would
mislead the next reader. The code is the truth after merge.
