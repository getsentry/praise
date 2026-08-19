/**
 * `beforeCancel` is the probe's whole verdict, so it has to reject the
 * misplacement it exists to catch while tolerating Primer's wrappers. The
 * expression runs in the browser; jsdom is close enough for the DOM relation.
 */

import { BUTTON_CLASS, inspectExpression } from './page-probe.mjs';

/**
 * Evaluates the real in-page expression against `html`.
 *
 * The expression is a source string because it normally runs in the browser, so
 * exercising the actual shipped code means compiling it here.
 */
function inspect(html) {
  document.body.innerHTML = html;

  // oxlint-disable-next-line typescript/no-implied-eval
  return JSON.parse(new Function(`return ${inspectExpression}`)());
}

const praise = `<button class="${BUTTON_CLASS}">Praise</button>`;

test('accepts the button directly before Cancel', () => {
  expect(inspect(`<div role="dialog">${praise}<button>Cancel</button></div>`).beforeCancel).toBe(true);
});

test('accepts a wrapper Primer put around Cancel', () => {
  const html = `<div role="dialog">${praise}<span><button>Cancel</button></span></div>`;

  expect(inspect(html).beforeCancel).toBe(true);
});

test('rejects the full-width placement above the footer', () => {
  // The failure the probe exists for: a sibling that *contains* Cancel but is a
  // whole column, not a wrapper.
  const html =
    `<div role="dialog">${praise}` +
    '<div class="Footer"><div><button>Cancel</button><button>Comment</button></div></div></div>';

  expect(inspect(html).beforeCancel).toBe(false);
});

test('rejects the button after Cancel', () => {
  expect(inspect(`<div role="dialog"><button>Cancel</button>${praise}</div>`).beforeCancel).toBe(false);
});

test('reports a missing button without claiming placement', () => {
  const result = inspect('<div role="dialog"><button>Cancel</button></div>');

  expect(result.buttonFound).toBe(false);
  expect(result.beforeCancel).toBe(false);
  // The capture is the diagnostic when the button is missing, so it must exist.
  expect(result.editorHtml).toContain('Cancel');
});
