/**
 * A minimal fake of the slice of `chrome.storage.sync` that the options page
 * uses. Lives outside `__tests__/` on purpose: jest's default `testMatch`
 * treats every file under `__tests__/` as a suite.
 */

type StorageItems = Record<string, unknown>;

export interface ChromeStorageMock {
  /** Values the fake reports back, layered over the defaults passed to `get`. */
  stored: StorageItems;
  get: jest.Mock<void, [StorageItems, (items: StorageItems) => void]>;
  set: jest.Mock<Promise<void>, [StorageItems]>;
}

/**
 * Installs the fake on `globalThis.chrome` and returns it. Call from
 * `beforeEach`; the returned object is fresh each time.
 */
export function installChromeMock(stored: StorageItems = {}): ChromeStorageMock {
  const mock: ChromeStorageMock = {
    stored: { ...stored },
    get: jest.fn((defaults: StorageItems, callback: (items: StorageItems) => void) => {
      // Real `chrome.storage.sync.get` resolves on a later tick, so the fake
      // does too — the component must cope with rendering before values land.
      const items = { ...defaults, ...mock.stored };
      void Promise.resolve().then(() => {
        callback(items);
      });
    }),
    set: jest.fn((items: StorageItems) => {
      Object.assign(mock.stored, items);
      return Promise.resolve();
    }),
  };

  (globalThis as { chrome?: unknown }).chrome = {
    storage: { sync: { get: mock.get, set: mock.set } },
  };

  return mock;
}

/** Removes the fake again, so suites cannot leak state into one another. */
export function uninstallChromeMock(): void {
  delete (globalThis as { chrome?: unknown }).chrome;
}
