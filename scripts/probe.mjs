#!/usr/bin/env node
/**
 * Drives a live GitHub PR page and reports where the praise button landed.
 *
 * Attaches to the browser `npm run dev` already runs -- it never launches one
 * of its own, because the whole point is to test the build that is loaded
 * there, in the profile that is logged in.
 *
 * Strictly read-only: it opens editors and looks at them. Nothing here submits
 * a review or a comment.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { parseArgs } from './lib/args.mjs';
import { CDP_PORT, closeTab, connect, openTab, ProbeConnectionError } from './lib/cdp.mjs';
import { inspectExpression, pageStateExpression } from './lib/page-probe.mjs';
import { sanitizeHtml } from './lib/sanitize.mjs';
import { scenarios } from './lib/scenarios.mjs';

const OUTPUT_DIR = '.probe';

const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

/**
 * Runs teardown that must not be able to wedge the process.
 *
 * `cdp.mjs` registers a request in its pending map *before* writing it to the
 * socket, and a WebSocket that has already closed accepts `send` silently. So a
 * call made after the browser went away leaves a promise that never settles --
 * silence rather than a rejection, which `catch` cannot rescue. Teardown is
 * best-effort by nature, so race it against a deadline and carry on.
 */
async function bestEffort(work, timeoutMs = 3000) {
  let timer;
  const deadline = new Promise(resolve => {
    timer = setTimeout(resolve, timeoutMs);
  });

  try {
    await Promise.race([Promise.resolve(work()).catch(() => {}), deadline]);
  } finally {
    clearTimeout(timer);
  }
}

async function evaluate(connection, sessionId, expression) {
  const response = await connection.send(
    'Runtime.evaluate',
    { expression, returnByValue: true, awaitPromise: true },
    sessionId,
  );

  if (response.exceptionDetails) {
    throw new Error(response.exceptionDetails.exception?.description ?? 'in-page exception');
  }

  return response.result.value;
}

/** Polls until the selector appears, because React mounts editors late. */
async function waitForSelector(connection, sessionId, selector, timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const found = await evaluate(connection, sessionId, `Boolean(document.querySelector(${JSON.stringify(selector)}))`);
    if (found) {
      return true;
    }
    await delay(250);
  }

  return false;
}

/**
 * Waits until the tab is genuinely showing the page we asked for.
 *
 * `Target.createTarget` resolves once the tab exists, not once it has
 * navigated, so the first evaluations can land on the initial `about:blank`:
 * a real document, empty title, no markup. Waiting on the landmark alone would
 * usually cover that, but it says nothing about whether parsing finished, so
 * the gate is three-part -- a committed URL, a parsed document, and the
 * landmark itself.
 */
async function waitForPage(connection, sessionId, selector, timeoutMs = 15_000) {
  const expression = `JSON.stringify({
    url: location.href,
    readyState: document.readyState,
    found: Boolean(document.querySelector(${JSON.stringify(selector)})),
  })`;
  const deadline = Date.now() + timeoutMs;
  let last;

  while (Date.now() < deadline) {
    last = JSON.parse(await evaluate(connection, sessionId, expression));
    if (last.url !== 'about:blank' && last.readyState !== 'loading' && last.found) {
      return last;
    }
    await delay(250);
  }

  return last;
}

async function main() {
  const { scenario, url, error } = parseArgs(process.argv.slice(2));
  if (error) {
    console.error(error);
    process.exit(1);
  }

  const plan = scenarios[scenario];
  let connection;
  try {
    connection = await connect();
  } catch (cause) {
    if (cause instanceof ProbeConnectionError) {
      console.error(
        `No browser listening on port ${CDP_PORT}.\n` +
          'Start the dev harness first, in another terminal:\n\n  npm run dev\n',
      );
      process.exit(1);
    }
    throw cause;
  }

  const target = plan.navigateSuffix ? url.replace(/\/*$/, '') + plan.navigateSuffix : url;
  const { targetId, sessionId } = await openTab(connection, target);
  const verdict = { scenario, url: target, buttonFound: false, beforeCancel: false };

  try {
    // GitHub renders progressively and our content script retries for two
    // seconds; give both room before touching anything.
    const loaded = await waitForPage(connection, sessionId, 'main');
    await delay(2000);

    const state = JSON.parse(await evaluate(connection, sessionId, pageStateExpression));
    if (!state.loggedIn) {
      console.error(
        'That profile is not logged into GitHub, so no review dialog or diff\n' +
          'editor exists to test. Log in once in the window `npm run dev` opens;\n' +
          '--keep-profile-changes will remember it.\n',
      );
      verdict.error = 'notLoggedIn';
      // The landing URL is the tell when the login page is what answered.
      verdict.landedOn = loaded?.url ?? state.url;
      await writeVerdict(verdict);
      process.exitCode = 1;
      return;
    }

    verdict.user = state.user;

    for (const step of plan.steps) {
      if (step.awaitSelector) {
        if (!(await waitForSelector(connection, sessionId, step.awaitSelector))) {
          verdict.error = `step "${step.name}" timed out waiting for ${step.awaitSelector}`;
          break;
        }
        continue;
      }

      const worked = await evaluate(connection, sessionId, step.expression);
      if (!worked) {
        verdict.error = `step "${step.name}" found nothing to click -- GitHub's markup may have moved`;
        break;
      }
      await delay(1500);
    }

    // Inspect regardless of whether the steps succeeded: when they fail, the
    // capture is the diagnostic.
    const inspection = JSON.parse(await evaluate(connection, sessionId, inspectExpression));
    Object.assign(verdict, {
      buttonFound: inspection.buttonFound,
      beforeCancel: inspection.beforeCancel,
      buttonLabel: inspection.buttonLabel,
      insertionPoint: inspection.insertionPoint,
    });

    await mkdir(OUTPUT_DIR, { recursive: true });

    const html = inspection.editorHtml ?? (await evaluate(connection, sessionId, 'document.documentElement.outerHTML'));
    await writeFile(`${OUTPUT_DIR}/editor.html`, sanitizeHtml(html));

    const clip = inspection.rect && inspection.rect.width > 0 ? { ...inspection.rect, scale: 1 } : undefined;
    const screenshot = await connection.send(
      'Page.captureScreenshot',
      { format: 'png', captureBeyondViewport: Boolean(clip), ...(clip ? { clip } : {}) },
      sessionId,
    );
    await writeFile(`${OUTPUT_DIR}/editor.png`, Buffer.from(screenshot.data, 'base64'));

    await writeVerdict(verdict);
    report(verdict, plan);
    // Set the code rather than exiting here: `process.exit` inside `try` skips
    // the `finally` below, which would leak the tab on every run.
    process.exitCode = verdict.beforeCancel ? 0 : 1;
  } finally {
    // Escape closes the editor we opened, so the browser is left as we found it.
    await bestEffort(() =>
      evaluate(
        connection,
        sessionId,
        `document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })), true`,
      ),
    );
    await bestEffort(() => closeTab(connection, targetId));
    connection.close();
  }
}

async function writeVerdict(verdict) {
  await mkdir(OUTPUT_DIR, { recursive: true });
  await writeFile(`${OUTPUT_DIR}/verdict.json`, `${JSON.stringify(verdict, null, 2)}\n`);
}

function report(verdict, plan) {
  if (verdict.beforeCancel) {
    console.log(`PASS -- the praise button sits before Cancel in ${plan.description}.`);
  } else if (verdict.buttonFound) {
    console.error(`FAIL -- the button exists but is not before Cancel in ${plan.description}.`);
  } else {
    console.error(`FAIL -- no praise button in ${plan.description}. ${verdict.error ?? ''}`);
  }

  console.log(`Artifacts: ${OUTPUT_DIR}/verdict.json, ${OUTPUT_DIR}/editor.png, ${OUTPUT_DIR}/editor.html`);
}

await main();
