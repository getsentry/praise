# Test fixtures

HTML fixtures representing GitHub PR pages, used by `src/lib/selectors.test.ts`
and `src/lib/praise-button.test.ts` to check the praise button still lands
beside each editor's Cancel button. See the table below for where each one
came from.

| File | State represented | Source | Captured |
|---|---|---|---|
| `review-dialog.html` | "Finish your review" dialog open | synthetic | — |
| `diff-comment.html` | Inline diff comment editor open, two editors | synthetic | — |

## What these tests can and cannot tell you

They fail when **our** code stops placing the button correctly against the
markup recorded here.

They do **not** fail when GitHub redesigns its PR pages. These files are frozen,
so the suite keeps passing against markup that may no longer exist. Nothing
watches live GitHub -- the extension breaking in the real world reaches us via a
bug report, not CI.

Fixtures marked `synthetic` are hand-written from the structure described in
`src/lib/selectors.ts`. They test our logic against our own assumptions, so they
cannot reveal that a selector was wrong to begin with. Replacing them with real
captures is worthwhile.

## Capturing a real fixture

Needs a logged-in browser, so it cannot be automated in CI.

1. Open a PR with a reasonably small diff. `Files changed`.
2. For `diff-comment.html`: click the `+` on a diff line to open the inline
   comment editor. Open a second one on another line -- two editors is what lets
   the tests prove the insertion walk uses each editor's *own* Cancel.
   For `review-dialog.html`: click `Review changes` -> `Comment`.
3. In devtools, select the outermost element containing every editor plus the
   page-level buttons, then right-click -> Copy -> Copy outerHTML.
4. Paste into the fixture file inside `<!doctype html><html lang="en"><body>`.
5. **Sanitize before committing.** A logged-in page carries credentials:
   - empty every `<script>` body,
   - delete `<meta>` tags holding CSRF or session tokens,
   - replace real usernames and avatar URLs with placeholders.
6. Prune the bulk. Keep the complete ancestor chain from the root down to each
   editor -- that chain is what `findInsertionPoint()` walks -- and delete
   unrelated diff rows and sidebars. Keep at least one markdown textarea that
   sits *outside* both regions, so the tests can show `praiseContext()` leaves
   it alone.
7. Update the table above with the PR URL and date, and drop the `synthetic`
   note from the file's header comment.
8. `npm test`. Failures now are informative: either the capture is pruned too
   aggressively, or a selector in `src/lib/selectors.ts` is genuinely stale --
   which is exactly what these fixtures exist to surface.
