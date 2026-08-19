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

### Comments

- Do not add comments to internal code that merely restate what the code does
- Comment only to explain non-obvious _why_ (rationale, workaround, gotcha)

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

## Load extension to chrome

Load `dist` directory
