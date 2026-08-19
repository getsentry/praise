/**
 * @jest-environment-options {"url": "https://github.com/"}
 */

/** The module body runs on import: if it throws, no praise button ever appears. */

import { installChromeMock, uninstallChromeMock } from '../test-support/chrome-mock';

describe('content script module initialisation', () => {
  beforeEach(() => {
    // Style tags from selector-observer persist on the jsdom document across
    // tests (unlike the module registry, which jest.resetModules clears), so
    // without this a leftover keyframes tag from an earlier test would make a
    // later "did it arm" assertion pass for the wrong reason.
    document.head.innerHTML = '';
    document.body.innerHTML = '';

    const mock = installChromeMock();

    // `watchPraises` subscribes at import time, which the options suites never hit.
    (globalThis as { chrome?: unknown }).chrome = {
      storage: {
        sync: { get: mock.get, set: mock.set },
        onChanged: { addListener: jest.fn() },
      },
    };
  });

  afterEach(() => {
    uninstallChromeMock();
    jest.resetModules();
    // Restored so other tests in this suite aren't affected by a PR URL set here.
    window.history.replaceState(null, '', 'https://github.com/');
  });

  it('does not throw while evaluating its module body', async () => {
    await expect(import('../content_script')).resolves.toBeDefined();
  });

  it('arms the selector observer on a PR page', async () => {
    window.history.replaceState(null, '', 'https://github.com/owner/repo/pull/22');

    await import('../content_script');

    // The keyframes tag is the only observable proof it armed.
    const styles = [...document.querySelectorAll('style')].map(style => style.textContent ?? '');

    expect(styles.some(text => text.includes('praise-selector-observer'))).toBe(true);
  });

  it('does not arm the selector observer off a PR page', async () => {
    // The environment's base URL, https://github.com/, is not a PR page.
    await import('../content_script');

    const styles = [...document.querySelectorAll('style')].map(style => style.textContent ?? '');

    expect(styles.some(text => text.includes('praise-selector-observer'))).toBe(false);
  });
});
