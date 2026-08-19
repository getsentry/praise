import { useCallback, useEffect, useRef } from 'react';

type StoragePatch = Record<string, unknown>;

/**
 * Returns a `save` that batches `chrome.storage.sync` writes.
 *
 * The options page saves on every keystroke, and sync storage allows only
 * about 120 writes a minute before it starts rejecting them. Debouncing turns
 * a burst of typing into one write. Patches are merged by key, so editing one
 * field does not discard an unwritten edit to another.
 *
 * A pending write is flushed when the page goes away, so the last keystrokes
 * survive an options page closed straight after typing.
 */
export function useDebouncedStorageWrite(delayMs: number) {
  const pending = useRef<StoragePatch>({});
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const flush = useCallback(() => {
    clearTimeout(timer.current);
    if (Object.keys(pending.current).length === 0) return;

    void chrome.storage.sync.set(pending.current);
    pending.current = {};
  }, []);

  useEffect(() => {
    // `pagehide` covers the tab being closed, where unmount cleanup never runs.
    window.addEventListener('pagehide', flush);
    return () => {
      window.removeEventListener('pagehide', flush);
      flush();
    };
  }, [flush]);

  return useCallback(
    (patch: StoragePatch) => {
      pending.current = { ...pending.current, ...patch };
      clearTimeout(timer.current);
      timer.current = setTimeout(flush, delayMs);
    },
    [delayMs, flush],
  );
}
