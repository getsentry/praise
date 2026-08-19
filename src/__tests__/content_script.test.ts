/** The module body runs on import: if it throws, no praise button ever appears. */

import { installChromeMock, uninstallChromeMock } from '../test-support/chrome-mock';

describe('content script module initialisation', () => {
  beforeEach(() => {
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
  });

  it('does not throw while evaluating its module body', async () => {
    await expect(import('../content_script')).resolves.toBeDefined();
  });

  it('arms the selector observer', async () => {
    await import('../content_script');

    // The keyframes tag is the only observable proof it armed.
    const styles = [...document.querySelectorAll('style')].map(style => style.textContent ?? '');

    expect(styles.some(text => text.includes('praise-selector-observer'))).toBe(true);
  });
});
