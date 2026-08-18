/**
 * A `chrome.storage.sync` stand-in.
 *
 * Only what the content script touches on load: a `get` that hands back defaults
 * merged with our values, and an `onChanged` listener registry that records
 * without dispatching.
 */
export function installChromeStub(
  praises: { reviews?: string[]; comments?: string[] } = {},
): void {
  const stored = {
    reviews: praises.reviews ?? [],
    comments: praises.comments ?? [],
  };

  (globalThis as unknown as { chrome: unknown }).chrome = {
    storage: {
      sync: {
        get: (
          _defaults: unknown,
          callback: (items: typeof stored) => void,
        ): void => {
          callback(stored);
        },
      },
      onChanged: {
        addListener: (): void => {},
      },
    },
  };
}
