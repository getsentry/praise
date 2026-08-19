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

None of them load the extension, so none of them can tell you the button
actually appears — two bugs that broke it everywhere passed all of them. For
anything affecting placement, drive a real PR page with `npm run probe`; see
[the fast feedback loop](CONTRIBUTING.md#fast-feedback-loop).

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
