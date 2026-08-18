# Shared code style with sentry-javascript

Date: 2026-08-18

## Goal

Enforce the same code style as
[getsentry/sentry-javascript](https://github.com/getsentry/sentry-javascript) in
this repository, via a formatter, a linter, a CI gate, and a pre-commit hook.

## Background

Upstream `sentry-javascript` has moved off ESLint/Prettier to the oxc toolchain:
`oxfmt` for formatting (`.oxfmtrc.json`) and `oxlint` for linting
(`.oxlintrc.json` extending `.oxlintrc.base.json`).

This repository currently has `prettier@3` with **no configuration file** (so
double quotes, 80 columns), a `style` script, no linter, and no git hooks. CI
consists of `build.yml` and `test.yml`. The `.editorconfig` at the root is 60
lines of `cpp_*` settings inherited from the `chrome-extension-typescript-starter`
template; nothing reads it.

Source is small: 4 TypeScript files, 223 lines total.

## Decisions

| Question | Decision |
|---|---|
| Fidelity to upstream | Same toolchain, adapted rules |
| Pre-commit hook | husky + lint-staged, auto-fix mode |
| CI structure | Separate `lint.yml` workflow |
| Strictness | Full strictness; fix the violations |
| Reformat landing | Separate reformat commit + `.git-blame-ignore-revs` |

## Design

### 1. Formatter — `.oxfmtrc.json`

Upstream's settings verbatim, with local ignore patterns:

```json
{
  "$schema": "./node_modules/oxfmt/configuration_schema.json",
  "arrowParens": "avoid",
  "printWidth": 120,
  "proseWrap": "always",
  "singleQuote": true,
  "trailingComma": "all",
  "ignorePatterns": ["dist/**", "node_modules/**", "package-lock.json"],
  "overrides": [{ "files": ["*.md", "*.mdc"], "options": { "proseWrap": "preserve" } }]
}
```

Formatting output is therefore byte-identical to `sentry-javascript`.

**`package-lock.json` MUST be in `ignorePatterns`.** Verified: `oxfmt` rewrites
it from 6525 to 6275 lines, and npm rewrites it back on the next install —
without this exclusion the formatter and npm fight permanently.

### 2. Linter — `.oxlintrc.json`

A single flat file (upstream's base/leaf split exists to serve a monorepo; there
is one package here). It carries upstream's base rules and its TS/JS/test
override blocks, with four documented departures:

| Upstream | Here | Why |
|---|---|---|
| `jsPlugins: @sentry/eslint-plugin-sdk` + 4 `sdk/*` rules | dropped | SDK-specific; extra dependency, no benefit |
| `no-restricted-globals: [window, document, location, navigator]` on `src/**` | dropped | This is a Chrome extension; `document` is used legitimately in 5 places |
| `plugins: [..., "vitest"]` + ~10 `vitest/*` disables | `react` instead | This repo uses jest; the vitest rules are dead config |
| ~15 vendored/integration override blocks | dropped | Those paths do not exist here |

Everything else carries over: `no-console`, `no-alert`, `no-param-reassign`,
`prefer-template`, `no-bitwise`, `complexity: 33`, `max-lines: 300`,
`typescript/no-explicit-any`, `consistent-type-imports`, `no-floating-promises`
(with `ignoreVoid: true`), `unbound-method`, `prefer-optional-chain`,
`await-thenable`, `no-deprecated`, and the `^_` unused-vars pattern. Test
overrides retarget to `**/__tests__/**`; the config override retargets to
`webpack/**`.

`"options": { "typeAware": true }` is kept, which **requires the
`oxlint-tsgolint` package** as a devDependency. Verified: without that binary,
`oxlint` exits with `Failed to find tsgolint executable` and lints nothing.

### 3. `.editorconfig`

Replace the 60-line `cpp_*` file with upstream's 9-line version: `root = true`,
2-space indent, utf-8, trim trailing whitespace, insert final newline, and
`*.md` exempt from whitespace trimming.

### 4. `package.json`

Add devDependencies: `oxlint@^1.78`, `oxfmt@^0.63`, `oxlint-tsgolint`,
`husky@^9`, `lint-staged@^17`. Remove `prettier`.

Scripts mirror upstream, using `&&` for the composites rather than adding
`npm-run-all` for two scripts:

```
"format":       "oxfmt . --write"
"format:check": "oxfmt . --check"
"lint":         "oxlint . --deny-warnings"
"lint:fix":     "oxlint . --fix --deny-warnings"
"verify":       "npm run format:check && npm run lint"
"fix":          "npm run format && npm run lint:fix"
"prepare":      "husky"
```

The existing `style` script is removed; `format` replaces it.

`--deny-warnings` is required for the full strictness this spec calls for.
Verified: some rules default to warning severity (e.g. `react/jsx-key`), and
`oxlint` exits 0 on warnings — without this flag a missing-`key` bug passes CI.
Also verified: the real sources pass with `--deny-warnings`, so strictness costs
no extra fixes.

### 5. CI — `.github/workflows/lint.yml`

A separate workflow, structurally cloned from the existing `test.yml` so the
repository has one CI idiom: same `on:` triggers (push to `main`, all pull
requests), `permissions: contents: read`, a `lint-`prefixed `concurrency`
group cancelling in-progress runs for pull requests, `actions/checkout@v7`,
`actions/setup-node@v7` with node 26 and npm caching, then `npm ci`.

`format:check` runs **before** `lint`, so a merely-unformatted pull request
reports the cheap failure instead of a wall of lint errors. Both are separate
steps rather than the composite `verify`, so the GitHub UI names which one
failed.

`HUSKY=0` is set as a job-level `env`: `npm ci` triggers `prepare`, which runs
`husky`, which is pointless in CI and can warn.

`typecheck` is deliberately not added here — `build.yml` already runs
`tsc --noEmit` via `npm run build`.

### 6. Pre-commit hook

`husky@9` + `lint-staged@17` in auto-fix mode. `.husky/pre-commit` contains
`npx lint-staged`. `package.json` gains:

```json
"lint-staged": {
  "*.{ts,tsx,js,jsx,mjs,cjs}": ["oxfmt --write", "oxlint --fix"],
  "*.{json,md,css,html}": ["oxfmt --write"]
}
```

The hook's `oxlint --fix` deliberately omits `--deny-warnings`: the hook should
auto-fix and let warnings through so a commit is never blocked on a warning,
while CI holds the strict line. Non-JS globs get formatter-only treatment because
`oxlint` has nothing to say
about CSS, HTML, or JSON. Verified: `oxlint` accepts explicit file paths with
`typeAware: true` and exits 0; a single-file run takes 0.14s, so the hook is
imperceptible. lint-staged re-stages what the tools rewrite, so auto-fixes land
in the commit being made. The escape hatch is `git commit --no-verify`, and CI
still catches anything skipped that way.

### 7. Lint violations to fix

Verified by running the adapted config against the real sources: exactly six
errors, **none auto-fixable** (`oxlint --fix` leaves all six).

| Location | Rule | Fix |
|---|---|---|
| `src/background.ts:32` | `no-floating-promises` | `void chrome.storage.sync.set(seed)` |
| `src/options.tsx:25` | `no-floating-promises` | `void` prefix |
| `src/options.tsx:31` | `no-floating-promises` | `void` prefix |
| `src/options.tsx:44` | `no-unsafe-member-access` | type the `onChange` parameter `React.ChangeEvent<HTMLTextAreaElement>` |
| `src/options.tsx:53` | `no-unsafe-member-access` | same |
| `src/content_script.tsx:111` | `no-unsafe-member-access` | `CustomEvent<Record<string, unknown>>` instead of bare `CustomEvent` |

These are not cosmetic: the three `no-unsafe-member-access` hits are `any`
flowing through real event handlers, and the `void`s make fire-and-forget
storage writes explicit.

Verified in a scratch copy with all six applied: `oxlint` exits 0, `oxfmt
--check` exits 0, and the two are stable together — formatting does not
reintroduce lint errors.

### 8. Commits and blame

Three commits:

1. `build: adopt oxlint and oxfmt` — configs, `package.json`, `.editorconfig`,
   `lint.yml`, `.husky/`, and the six hand fixes. Green on its own.
2. `style: reformat with oxfmt` — mechanical only, produced by `npm run format`.
   Nothing hand-edited.
3. `build: add .git-blame-ignore-revs` — the new file containing commit 2's SHA,
   with a header comment mirroring upstream's.

Measured scope of commit 2: the 4 source files (~103 changed lines — double to
single quotes, `(event) =>` to `event =>`, 80 to 120 column wrapping), plus
`tsconfig.json` and `public/manifest.json` (4-space to 2-space; both verified
still valid JSON), `public/style.css` and `public/options.html` (indentation,
`<!DOCTYPE>` to `<!doctype>`, self-closing tags), the three `webpack/*.js`
files, `jest.config.js`, and `CONTRIBUTING.md`. `README.md` already conforms.

The HTML/CSS/manifest changes fall outside `src/` and beyond a literal reading
of "code formatting", but are included deliberately: a formatter that skips
files it can handle invites drift. Chrome does not care about JSON whitespace.

### 9. Documentation

`.git-blame-ignore-revs` is not picked up automatically. `CONTRIBUTING.md`
(which already has a Development section) gains a "Code style" section covering:
the shared configuration with `sentry-javascript`, `npm run fix` and `npm run
verify`, the pre-commit hook, and `git config blame.ignoreRevsFile
.git-blame-ignore-revs`.

## Verification

The work is done when, from a clean checkout:

- `npm ci` installs cleanly and sets up the git hook
- `npm run verify` exits 0 (i.e. clean under `--deny-warnings`)
- `npm run build` still succeeds (`tsc --noEmit` clean)
- `npm test` still passes
- a deliberately misformatted staged file is fixed by the pre-commit hook
- `public/manifest.json` and `tsconfig.json` remain valid JSON

## Out of scope

- Adopting upstream's `@sentry/eslint-plugin-sdk` rules
- Bringing over `.madgerc`, `.size-limit.js`, or nx task orchestration
- Any behavioral change to the extension
