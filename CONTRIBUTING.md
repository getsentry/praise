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

When a scenario stops finding what it clicks, that capture is where to look —
both scenarios drive `/changes` (GitHub redirects `/files` there), and the
markup they reach for has moved before.

The probe is read-only — it opens editors and inspects them, and never submits
a review or comment.

> The profile `npm run dev` uses runs with `--keep-profile-changes`, which
> disables auto-updates and allows silent remote connections. Use it for
> development only, not for browsing.

## Load extension to chrome

Load `dist` directory
