import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Options } from '../lib/Options';
import { type ChromeStorageMock, installChromeMock, uninstallChromeMock } from '../test-support/chrome-mock';

/** Must stay above the SAVE_DELAY_MS the component debounces writes by. */
const PAST_SAVE_DELAY_MS = 1000;

let storage: ChromeStorageMock;

function renderOptions(stored: Record<string, unknown> = {}) {
  storage = installChromeMock(stored);
  return render(<Options />);
}

/** Types with fake timers running, which user-event needs told about. */
function setupUser() {
  return userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
}

/** The two textareas, in document order: reviews first, then comments. */
function textareas(): HTMLTextAreaElement[] {
  return screen.getAllByRole('textbox');
}

/** Waits out the save debounce, so queued writes reach storage. */
function settle() {
  act(() => {
    jest.advanceTimersByTime(PAST_SAVE_DELAY_MS);
  });
}

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
  uninstallChromeMock();
  jest.clearAllMocks();
});

describe('Options', () => {
  test('renders a heading and a textarea for each praise list', async () => {
    renderOptions();

    expect(screen.getByRole('heading', { name: 'Review Praises' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Comment Praises' })).toBeInTheDocument();
    await waitFor(() => {
      expect(textareas()).toHaveLength(2);
    });
  });

  test('reads both keys from sync storage on mount, defaulting to empty lists', async () => {
    renderOptions();

    await waitFor(() => {
      expect(storage.get).toHaveBeenCalledTimes(1);
    });
    expect(storage.get.mock.calls[0][0]).toEqual({ reviews: [], comments: [] });
  });

  test('shows the stored praises, one per line', async () => {
    renderOptions({ reviews: ['LGTM 🚀', 'Ship it 🚢'], comments: ['Nice', 'Thanks'] });

    await waitFor(() => {
      expect(textareas()[0]).toHaveValue('LGTM 🚀\nShip it 🚢');
    });
    expect(textareas()[1]).toHaveValue('Nice\nThanks');
  });

  test('renders empty textareas when storage holds nothing', async () => {
    renderOptions();

    await waitFor(() => {
      expect(storage.get).toHaveBeenCalled();
    });
    expect(textareas()[0]).toHaveValue('');
    expect(textareas()[1]).toHaveValue('');
  });

  test('writes edited reviews back to storage, split on newlines', async () => {
    const user = setupUser();
    renderOptions({ reviews: ['LGTM'], comments: ['Nice'] });
    await waitFor(() => {
      expect(textareas()[0]).toHaveValue('LGTM');
    });

    await user.type(textareas()[0], '!');
    settle();

    expect(lastSet()).toEqual({ reviews: ['LGTM!'] });
    expect(textareas()[0]).toHaveValue('LGTM!');
  });

  test('editing reviews leaves the stored comments untouched', async () => {
    const user = setupUser();
    renderOptions({ reviews: ['LGTM'], comments: ['Nice'] });
    await waitFor(() => {
      expect(textareas()[0]).toHaveValue('LGTM');
    });

    await user.type(textareas()[0], '!');
    settle();

    expect(storage.set).toHaveBeenCalled();
    for (const [written] of storage.set.mock.calls) {
      expect(Object.keys(written)).toEqual(['reviews']);
    }
    expect(textareas()[1]).toHaveValue('Nice');
  });

  test('writes edited comments back to storage without touching reviews', async () => {
    const user = setupUser();
    renderOptions({ reviews: ['LGTM'], comments: ['Nice'] });
    await waitFor(() => {
      expect(textareas()[1]).toHaveValue('Nice');
    });

    await user.type(textareas()[1], '!');
    settle();

    expect(lastSet()).toEqual({ comments: ['Nice!'] });
    expect(textareas()[0]).toHaveValue('LGTM');
  });

  test('splits a multi-line edit into one entry per line and renders it back unchanged', async () => {
    const user = setupUser();
    renderOptions();
    await waitFor(() => {
      expect(storage.get).toHaveBeenCalled();
    });

    await user.type(textareas()[0], 'one{Enter}two');
    settle();

    expect(lastSet()).toEqual({ reviews: ['one', 'two'] });
    expect(textareas()[0]).toHaveValue('one\ntwo');
  });

  test('keeps a blank line as an empty entry, so the text round-trips', async () => {
    const user = setupUser();
    renderOptions();
    await waitFor(() => {
      expect(storage.get).toHaveBeenCalled();
    });

    await user.type(textareas()[0], 'one{Enter}{Enter}two');
    settle();

    expect(lastSet()).toEqual({ reviews: ['one', '', 'two'] });
    expect(textareas()[0]).toHaveValue('one\n\ntwo');
  });

  test('a trailing newline stores a trailing empty entry', async () => {
    const user = setupUser();
    renderOptions();
    await waitFor(() => {
      expect(storage.get).toHaveBeenCalled();
    });

    await user.type(textareas()[0], 'one{Enter}');
    settle();

    expect(lastSet()).toEqual({ reviews: ['one', ''] });
  });

  test('clearing a textarea stores no praises rather than one empty praise', async () => {
    const user = setupUser();
    renderOptions({ reviews: ['LGTM'], comments: [] });
    await waitFor(() => {
      expect(textareas()[0]).toHaveValue('LGTM');
    });

    await user.clear(textareas()[0]);
    settle();

    expect(lastSet()).toEqual({ reviews: [] });
  });

  test('writes once for a burst of typing rather than once per keystroke', async () => {
    const user = setupUser();
    renderOptions({ reviews: [], comments: [] });
    await waitFor(() => {
      expect(storage.get).toHaveBeenCalled();
    });

    await user.type(textareas()[0], 'LGTM');

    // Sync storage rejects writes past roughly 120 a minute, so a praise
    // must not cost one write per character.
    expect(storage.set).not.toHaveBeenCalled();
    settle();
    expect(storage.set).toHaveBeenCalledTimes(1);
    expect(lastSet()).toEqual({ reviews: ['LGTM'] });
  });

  test('saves the pending edit when the page is closed mid-debounce', async () => {
    const user = setupUser();
    renderOptions({ reviews: [], comments: [] });
    await waitFor(() => {
      expect(storage.get).toHaveBeenCalled();
    });

    await user.type(textareas()[0], 'LGTM');
    expect(storage.set).not.toHaveBeenCalled();

    act(() => {
      window.dispatchEvent(new Event('pagehide'));
    });

    expect(lastSet()).toEqual({ reviews: ['LGTM'] });
  });

  test('a cleared textarea stays empty, so the empty list round-trips', async () => {
    const user = setupUser();
    renderOptions({ reviews: ['LGTM'], comments: [] });
    await waitFor(() => {
      expect(textareas()[0]).toHaveValue('LGTM');
    });

    await user.clear(textareas()[0]);

    await waitFor(() => {
      expect(textareas()[0]).toHaveValue('');
    });
  });
});

/** The most recent `chrome.storage.sync.set` payload. */
function lastSet(): Record<string, unknown> {
  const { calls } = storage.set.mock;
  return calls[calls.length - 1][0];
}
