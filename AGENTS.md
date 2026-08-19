# AGENTS.md

PRaise is a Chrome extension (Manifest V3) that adds a one-click praise button to GitHub PR review and comment boxes. TypeScript + React, bundled with webpack.

## Layout

- `src/content_script.tsx` — injected into GitHub pages
- `src/background.ts` — service worker
- `src/options.tsx`, `src/lib/Options.tsx` — options page
- `src/lib/` — shared modules (keep logic here so it is testable)
- `src/__tests__/` — Jest tests
- `public/` — `manifest.json` and static assets
- `dist/` — build output, never edit by hand

## Commands

```sh
npm test          # jest
npm run typecheck # tsc --noEmit
npm run verify    # format + lint check (CI)
npm run fix       # auto-format and fix lint
npm run build     # typecheck + production bundle
```

Run `npm test`, `npm run typecheck`, and `npm run verify` before proposing changes.

## Checking the button on a real PR

None of the commands above load the extension, so none of them can tell you the
button actually appears — two bugs that broke it everywhere passed all of them.
Verify placement changes against a live page:

```sh
npm run dev                    # leave running; opens Chrome with the extension
npm run probe                  # review dialog
npm run probe -- diff-comment  # inline diff editor
```

`npm run probe` exits 0 only when the button sits immediately before Cancel, and
writes `.probe/verdict.json` plus a sanitized `editor.html` — read that capture
when a step stops finding what it clicks, rather than guessing at selectors. It
needs a one-time GitHub login; see `CONTRIBUTING.md`.

## Code style

- Formatting and linting come from the oxc toolchain (`oxfmt`, `oxlint`); do not hand-format.
- Comments explain non-obvious _why_ only — never restate the code.
- Put new logic in `src/lib/` with a test rather than inline in the entry points.

## Commits

Keep commit messages short and precise.

- Conventional Commits: `type: summary` (`feat`, `fix`, `refactor`, `test`, `docs`, `perf`, `build`, `style`).
- Subject in imperative mood, lower case, no trailing period, ideally under 60 characters.
- Body only when the _why_ is not obvious from the subject. No filler, no change logs.

Example: `fix: store no praises for an empty textarea`

## Pull requests

Same standard as commits: short and precise.

- Title follows the Conventional Commit format of the change.
- Description is a few lines at most — what changed and why. Skip boilerplate sections.
- One logical change per PR.

See `CONTRIBUTING.md` for setup and build details.
