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

import { mkdir, rm, writeFile } from 'node:fs/promises';
import { parseArgs } from './lib/args.mjs';
import { CDP_PORT, closeTab, connect, openTab, ProbeConnectionError } from './lib/cdp.mjs';
import { BUTTON_CLASS, inspectExpression, pageStateExpression } from './lib/page-probe.mjs';
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

/**
 * Moves the real pointer over an element.
 *
 * Dispatching MouseEvents from a script does not set hover state, so controls
 * that only render on hover -- the diff's own "Add comment" button -- never
 * appear. `Input.dispatchMouseEvent` goes through the browser's input pipeline,
 * which does.
 */
async function hover(connection, sessionId, selector) {
  const box = await evaluate(
    connection,
    sessionId,
    `(() => {
      const element = document.querySelector(${JSON.stringify(selector)});
      const rect = element?.getBoundingClientRect();
      return rect && rect.width > 0 && rect.height > 0
        ? JSON.stringify({ x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 })
        : null;
    })()`,
  );

  if (!box) {
    return false;
  }

  const { x, y } = JSON.parse(box);
  await connection.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: 'none' }, sessionId);
  return true;
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
  const verdict = { scenario, url: target, buttonFound: false, beforeCancel: false };

  // Opened inside the `try`: an open socket keeps the event loop alive, so a
  // throw from here with the connection still open hangs the process rather than
  // failing it.
  let targetId;
  let sessionId;

  try {
    // Stale artifacts are worse than none: a reader cannot tell last run's
    // capture from this one's, and a crash verdict sitting beside a previous
    // success's screenshot reads as evidence for it. Clear all three, inside the
    // `try` so a filesystem error still reaches the socket cleanup below.
    await clearArtifacts();

    ({ targetId, sessionId } = await openTab(connection, target));

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

      if (step.hoverSelector) {
        if (!(await hover(connection, sessionId, step.hoverSelector))) {
          verdict.error = `step "${step.name}" found nothing matching ${step.hoverSelector} to hover`;
          break;
        }
        await delay(1000);
        continue;
      }

      const worked = await evaluate(connection, sessionId, step.expression);
      if (!worked) {
        verdict.error = `step "${step.name}" found nothing to click -- GitHub's markup may have moved`;
        break;
      }
      await delay(1500);
    }

    // The content script retries placement for about two seconds, because the
    // footer it anchors to mounts after the textarea. Wait for the button rather
    // than inspecting the instant an editor appears -- otherwise a slow footer
    // reads as a missing button. A timeout here is not an error: absence is a
    // real result, and the capture below is what explains it.
    await waitForSelector(connection, sessionId, `.${BUTTON_CLASS}`, 4000);

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

    report(verdict, plan);
    // Set the code rather than exiting here: `process.exit` inside `try` skips
    // the `finally` below, which would leak the tab on every run.
    process.exitCode = verdict.beforeCancel ? 0 : 1;
  } catch (error) {
    // The verdict is the probe's output, so a crash belongs in it rather than
    // only on stderr -- an agent reads the file, not the terminal.
    verdict.error = `probe crashed: ${error instanceof Error ? error.message : String(error)}`;
    process.exitCode = 1;
    console.error(verdict.error);
  } finally {
    // The tab may not exist: `openTab` itself can throw, and then there is
    // nothing to tidy but the socket.
    if (sessionId) {
      // Escape closes the editor we opened, so the browser is left as we found it.
      await bestEffort(() =>
        evaluate(
          connection,
          sessionId,
          `document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })), true`,
        ),
      );
    }
    if (targetId) {
      await bestEffort(() => closeTab(connection, targetId));
    }
    connection.close();

    // Last, so it happens on every path. After a crash this may be the only
    // artifact -- the capture is written earlier and a crash can precede it.
    await bestEffort(() => writeVerdict(verdict));
  }
}

const ARTIFACTS = ['verdict.json', 'editor.png', 'editor.html'];

/** Drops every artifact from the previous run, so none can be mistaken for this one's. */
async function clearArtifacts() {
  await mkdir(OUTPUT_DIR, { recursive: true });
  await Promise.all(ARTIFACTS.map(name => rm(`${OUTPUT_DIR}/${name}`, { force: true })));
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
