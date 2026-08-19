import { act, renderHook } from '@testing-library/react';
import { useDebouncedStorageWrite } from '../lib/use-debounced-storage-write';
import { type ChromeStorageMock, installChromeMock, uninstallChromeMock } from '../test-support/chrome-mock';

const DELAY = 500;

let storage: ChromeStorageMock;

beforeEach(() => {
  jest.useFakeTimers();
  storage = installChromeMock();
});

afterEach(() => {
  jest.useRealTimers();
  uninstallChromeMock();
  jest.clearAllMocks();
});

function renderWrite() {
  return renderHook(() => useDebouncedStorageWrite(DELAY));
}

/** Calls the returned `save` inside act, as a component would. */
function save(result: { current: (patch: Record<string, unknown>) => void }, patch: Record<string, unknown>) {
  act(() => {
    result.current(patch);
  });
}

/** Runs pending timers inside act, so React state settles with them. */
function advance(ms: number) {
  act(() => {
    jest.advanceTimersByTime(ms);
  });
}

describe('useDebouncedStorageWrite', () => {
  test('does not write before the delay has elapsed', () => {
    const { result } = renderWrite();

    save(result, { reviews: ['LGTM'] });
    advance(DELAY - 1);

    expect(storage.set).not.toHaveBeenCalled();
  });

  test('writes once the delay has elapsed', () => {
    const { result } = renderWrite();

    save(result, { reviews: ['LGTM'] });
    advance(DELAY);

    expect(storage.set).toHaveBeenCalledTimes(1);
    expect(storage.set).toHaveBeenCalledWith({ reviews: ['LGTM'] });
  });

  test('collapses a burst of saves into a single write of the last value', () => {
    const { result } = renderWrite();

    save(result, { reviews: ['L'] });
    advance(100);
    save(result, { reviews: ['LG'] });
    advance(100);
    save(result, { reviews: ['LGTM'] });
    advance(DELAY);

    expect(storage.set).toHaveBeenCalledTimes(1);
    expect(storage.set).toHaveBeenCalledWith({ reviews: ['LGTM'] });
  });

  test('merges saves of different keys into one write', () => {
    const { result } = renderWrite();

    save(result, { reviews: ['LGTM'] });
    advance(100);
    save(result, { comments: ['Nice'] });
    advance(DELAY);

    expect(storage.set).toHaveBeenCalledTimes(1);
    expect(storage.set).toHaveBeenCalledWith({ reviews: ['LGTM'], comments: ['Nice'] });
  });

  test('starts a fresh window after a write, rather than writing twice', () => {
    const { result } = renderWrite();

    save(result, { reviews: ['one'] });
    advance(DELAY);
    save(result, { reviews: ['two'] });
    advance(DELAY);

    expect(storage.set).toHaveBeenCalledTimes(2);
    expect(storage.set).toHaveBeenNthCalledWith(1, { reviews: ['one'] });
    expect(storage.set).toHaveBeenNthCalledWith(2, { reviews: ['two'] });
  });

  test('writes the pending value when the page goes away', () => {
    const { result } = renderWrite();

    save(result, { reviews: ['LGTM'] });
    act(() => {
      window.dispatchEvent(new Event('pagehide'));
    });

    expect(storage.set).toHaveBeenCalledTimes(1);
    expect(storage.set).toHaveBeenCalledWith({ reviews: ['LGTM'] });
  });

  test('does not write the same value again after the page goes away', () => {
    const { result } = renderWrite();

    save(result, { reviews: ['LGTM'] });
    act(() => {
      window.dispatchEvent(new Event('pagehide'));
    });
    advance(DELAY);

    expect(storage.set).toHaveBeenCalledTimes(1);
  });

  test('writes nothing when the page goes away with no pending edit', () => {
    renderWrite();

    act(() => {
      window.dispatchEvent(new Event('pagehide'));
    });

    expect(storage.set).not.toHaveBeenCalled();
  });

  test('writes the pending value on unmount', () => {
    const { result, unmount } = renderWrite();

    save(result, { reviews: ['LGTM'] });
    unmount();

    expect(storage.set).toHaveBeenCalledTimes(1);
    expect(storage.set).toHaveBeenCalledWith({ reviews: ['LGTM'] });
  });

  test('stops listening once unmounted', () => {
    const { unmount } = renderWrite();

    unmount();
    act(() => {
      window.dispatchEvent(new Event('pagehide'));
    });

    expect(storage.set).not.toHaveBeenCalled();
  });

  test('does not write a stale value after unmount', () => {
    const { result, unmount } = renderWrite();

    save(result, { reviews: ['LGTM'] });
    unmount();
    advance(DELAY);

    expect(storage.set).toHaveBeenCalledTimes(1);
  });
});
