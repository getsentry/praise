# Contributing

## Project Structure

- src/typescript: TypeScript source files
- dist: Chrome Extension directory
- dist/js: Generated JavaScript files

## Setup

```sh
npm install
```

## Code style

Code formatting and linting use the [oxc toolchain](https://oxc.rs), shared with [getsentry/sentry-javascript](https://github.com/getsentry/sentry-javascript).

Auto-format and fix lint errors:

```sh
npm run fix
```

Check formatting and lint without changing files (run in CI):

```sh
npm run verify
```

A pre-commit hook automatically formats and fixes staged files. To skip it:

```sh
git commit --no-verify
```

## Import as Visual Studio Code project

...

## Build

```sh
npm run build
```

## Build in watch mode

### terminal

```sh
npm run watch
```

### Visual Studio Code

Run watch mode.

type `Ctrl + Shift + B`

## Test

```sh
npm test
```

Selector and placement tests run in Jest against jsdom, using HTML fixtures
hand-written from the structure documented in `src/lib/selectors.ts`. They are
currently synthetic -- see `test/fixtures/README.md` for provenance and how to
replace them with real captures. They fail when the praise button stops
landing beside each editor's Cancel button. There are 25 tests across 4 suites.

They do not detect GitHub redesigning its PR pages -- the fixtures are frozen
snapshots. See `test/fixtures/README.md` for what that means and how to refresh
them.

`src/lib/selector-observer.ts` has no tests: it works by listening for CSS
`animationstart`, which neither jsdom nor happy-dom implements.

`tsconfig.json` includes `"node"` in its `types` array, and `@types/node` is a
devDependency, because the fixture loader reads files from disk with
`node:fs`. This matters because `npm test` alone won't catch a type error in a
test file -- `@swc/jest` strips types without checking them -- so `npm run
build`, which runs `tsc --noEmit` over all of `src/`, is the check that
actually does.

## Load extension to chrome

Load `dist` directory
