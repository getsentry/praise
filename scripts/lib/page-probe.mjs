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

  const editorSelector = '[role="dialog"], div[class*="AddCommentEditor"], div[class*="ReviewThread"]';

  const findCancel = scope => {
    for (const candidate of scope.querySelectorAll('button')) {
      if (caption(candidate) === 'Cancel') {
        return candidate;
      }
    }
    return undefined;
  };

  // Prefer our own button's editor. Falling back to the first Cancel on the page
  // is only for the case where the button is missing entirely -- the interesting
  // failure -- and picking the page's first Cancel then is fine, because there is
  // no placement to judge, just markup to capture.
  const ownEditor = button?.closest(editorSelector) ?? null;
  const cancel = (ownEditor && findCancel(ownEditor)) ?? findCancel(document);

  const editor = ownEditor
    ?? cancel?.closest(editorSelector)
    ?? cancel?.parentElement?.parentElement
    ?? null;

  const box = editor?.getBoundingClientRect();

  return JSON.stringify({
    buttonFound: Boolean(button),
    buttonLabel: button ? caption(button) : null,
    // The next sibling *or* the element containing Cancel: the extension inserts
    // before whatever \`findInsertionPoint\` picked, and that climbs to a wrapper
    // when Primer wraps the anchor -- so requiring Cancel itself would fail a
    // correct placement.
    beforeCancel: Boolean(
      button && cancel && button.nextElementSibling
        && (button.nextElementSibling === cancel || button.nextElementSibling.contains(cancel)),
    ),
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
