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
