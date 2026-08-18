# Implementation plan — shared code style with sentry-javascript

Spec: `docs/superpowers/specs/2026-08-18-code-formatting-design.md`

Read the spec section named in each task; it holds the exact values.

## Global Constraints

- **Formatting must stay byte-identical to upstream `sentry-javascript`.** The
  `.oxfmtrc.json` option values are copied verbatim from upstream and must not be
  "improved": `arrowParens: avoid`, `printWidth: 120`, `proseWrap: always`,
  `singleQuote: true`, `trailingComma: all`.
- **`package-lock.json` must be in `.oxfmtrc.json`'s `ignorePatterns`.** Without
  it, `oxfmt` and npm permanently fight over the file.
- **`oxlint-tsgolint` must be a devDependency.** `typeAware: true` silently lints
  nothing without it.
- **`--deny-warnings` on the `lint` and `lint:fix` scripts.** Some rules default
  to warning severity and `oxlint` exits 0 on warnings.
- Do not add `@sentry/eslint-plugin-sdk`, `no-restricted-globals`, the `vitest`
  plugin, or upstream's vendored-path overrides. See the spec's departures table.
- Do not change extension behavior. This work is tooling plus mechanical
  formatting plus six typed-safety fixes only.
- Node 26 and npm, matching the existing `test.yml` and `build.yml`.
- Never run `npm run format` (the repo-wide reformat) before Task 5. Tasks 1-4
  must not contain reformatting churn.
- Verify with real command output. Never claim a command passed without running
  it.

## Task 1 — Toolchain dependencies and configuration

Implements spec sections 1, 2, 3, 4.

1. Remove the `prettier` devDependency and the `style` script from
   `package.json`.
2. Add devDependencies and install so `package-lock.json` updates:
   `oxlint@^1.78`, `oxfmt@^0.63`, `oxlint-tsgolint`.
   (husky and lint-staged arrive in Task 3, not here.)
3. Add the scripts `format`, `format:check`, `lint`, `lint:fix`, `verify`, `fix`
   exactly as the spec's section 4 lists them, including `--deny-warnings`.
4. Create `.oxfmtrc.json` with the spec's section 1 content verbatim.
5. Create `.oxlintrc.json` per spec section 2: `plugins: ["typescript",
   "import", "jsdoc", "react"]`, `options.typeAware: true`, the base rules, the
   TS/JS/test/config override blocks, `env` with `es2017`/`browser`/`node`, and
   `ignorePatterns` for `dist/**`, `node_modules/**`, `coverage/**`. Test
   overrides target `**/__tests__/**`, `**/*.test.ts`, `**/*.test.tsx`; the
   config override targets `*.config.js` and `webpack/**`.
6. Replace `.editorconfig` with upstream's 9-line version (spec section 3).

**Verification.** `npm ci` succeeds. `npx oxlint --version` and `npx oxfmt
--version` both print. `npm run lint` runs and reports exactly the four errors
listed in spec section 7 — not zero (which would mean the config is inert), not
a `Failed to find tsgolint executable` message. `npm run format:check` exits
non-zero and lists files. `npm test` and `npm run build` still pass.

Do NOT fix the four lint errors in this task, and do NOT run `npm run format`.
Leaving `lint` red here is correct.

Commit: `build: add oxlint and oxfmt configuration`

## Task 2 — Fix the four lint violations

Implements spec section 7. Read its table for the exact locations and fixes.

Apply all four fixes: one `void` prefix in `src/background.ts`, two `void`
prefixes in `src/options.tsx`, and a parameterized
`CustomEvent<Record<string, unknown>>` in `src/content_script.tsx`.

Do not add explicit types to the `TextareaAutosize` `onChange` parameters — an
earlier spec draft called for that, but the parameter is already properly typed
by the package's own `.d.ts` and no rule fires there. See the correction note in
spec section 7.

Constraints: no behavior change; do not silence any rule with a disable comment
or a config edit to make an error disappear; do not reformat.

**Verification.** `npm run lint` exits 0. `npm run build` succeeds
(`tsc --noEmit` clean). `npm test` passes. Paste the actual command output in
the report.

Commit: `fix: resolve oxlint type-safety violations`

## Task 3 — CI workflow and pre-commit hook

Implements spec sections 5 and 6. Two files plus a `package.json` change.

1. Add `husky@^9` and `lint-staged@^17` as devDependencies, plus the
   `"prepare": "husky"` script, and the `lint-staged` block from spec section 6.
2. Create `.husky/pre-commit` containing `npx lint-staged`. Ensure it is
   executable.
3. Create `.github/workflows/lint.yml` per spec section 5. Mirror the existing
   `.github/workflows/test.yml` structure — read that file first and match its
   idiom for `on`, `permissions`, `concurrency`, checkout and setup-node pinning.
   `format:check` runs before `lint`, as separate steps. Set `HUSKY=0` as a
   job-level `env`.

**Verification.** `npx husky --help` or equivalent confirms install; `.husky/`
exists and `git config core.hooksPath` is set by `prepare`. Prove the hook works
end-to-end: create a throwaway file with deliberately wrong formatting (double
quotes, 4-space indent), `git add` it, `git commit`, and confirm the committed
content came out formatted — then remove the throwaway file and its commit so it
does not reach the branch (`git reset --hard` back to the pre-test commit, or
delete-and-amend). Report the before/after content. Validate `lint.yml` parses as
YAML.

Commit: `build: enforce style via CI and a pre-commit hook`

## Task 4 — Document the code style

Implements spec section 9. Add a "Code style" section to `CONTRIBUTING.md`,
placed alongside the existing Development content and matching the file's
existing heading level and tone.

Cover: the configuration is shared with `getsentry/sentry-javascript` (link it);
`npm run fix` to auto-fix and `npm run verify` to check; the pre-commit hook runs
automatically and `--no-verify` skips it; and `git config blame.ignoreRevsFile
.git-blame-ignore-revs` as a local one-time setup so the reformat commit does not
pollute blame.

Do not run `npm run format` — Task 5 will format this file.

**Verification.** The section renders as valid Markdown; the commands quoted in
it match the actual scripts in `package.json`.

Commit: `docs: document the code style workflow`

## Task 5 — Repo-wide reformat and blame-ignore file

Implements spec section 8. This task must run last, after every config is final.

1. Run `npm run format`. Do not hand-edit anything it touches.
2. Verify `package-lock.json` is untouched (`git diff --stat` must not list it).
   If it appears, `ignorePatterns` is wrong — stop and report.
3. Verify `public/manifest.json` and `tsconfig.json` are still valid JSON.
4. Commit the mechanical result alone: `style: reformat with oxfmt`.
5. Create `.git-blame-ignore-revs` containing that commit's full 40-character
   SHA, preceded by a comment naming the commit, with a short header explaining
   the file (mirror upstream's header wording).
6. Commit the new file separately: `build: add .git-blame-ignore-revs`.

**Verification.** After the reformat: `npm run verify` exits 0, `npm test`
passes, `npm run build` succeeds. `git show --stat` for the reformat commit
contains no `package-lock.json`. Confirm the SHA in `.git-blame-ignore-revs`
resolves to the reformat commit (`git cat-file -t <sha>` prints `commit`) and
that its subject is the reformat commit's. Report the reformat commit's file list.

Expected scope (from the spec's measurement): the 4 source files, `tsconfig.json`,
`public/manifest.json`, `public/style.css`, `public/options.html`, three
`webpack/*.js`, `jest.config.js`, `CONTRIBUTING.md`. `README.md` already conforms.
A materially different file list means something is wrong — report it.
