import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Options } from '../lib/Options';
import { type ChromeStorageMock, installChromeMock, uninstallChromeMock } from '../test-support/chrome-mock';

let storage: ChromeStorageMock;

function renderOptions(stored: Record<string, unknown> = {}) {
  storage = installChromeMock(stored);
  return render(<Options />);
}

/** The two textareas, in document order: reviews first, then comments. */
function textareas(): HTMLTextAreaElement[] {
  return screen.getAllByRole('textbox');
}

afterEach(() => {
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
    const user = userEvent.setup();
    renderOptions({ reviews: ['LGTM'], comments: ['Nice'] });
    await waitFor(() => {
      expect(textareas()[0]).toHaveValue('LGTM');
    });

    await user.type(textareas()[0], '!');

    await waitFor(() => {
      expect(storage.set).toHaveBeenCalled();
    });
    expect(lastSet()).toEqual({ reviews: ['LGTM!'] });
    expect(textareas()[0]).toHaveValue('LGTM!');
  });

  test('editing reviews leaves the stored comments untouched', async () => {
    const user = userEvent.setup();
    renderOptions({ reviews: ['LGTM'], comments: ['Nice'] });
    await waitFor(() => {
      expect(textareas()[0]).toHaveValue('LGTM');
    });

    await user.type(textareas()[0], '!');

    await waitFor(() => {
      expect(storage.set).toHaveBeenCalled();
    });
    for (const [written] of storage.set.mock.calls) {
      expect(Object.keys(written)).toEqual(['reviews']);
    }
    expect(textareas()[1]).toHaveValue('Nice');
  });

  test('writes edited comments back to storage without touching reviews', async () => {
    const user = userEvent.setup();
    renderOptions({ reviews: ['LGTM'], comments: ['Nice'] });
    await waitFor(() => {
      expect(textareas()[1]).toHaveValue('Nice');
    });

    await user.type(textareas()[1], '!');

    await waitFor(() => {
      expect(storage.set).toHaveBeenCalled();
    });
    expect(lastSet()).toEqual({ comments: ['Nice!'] });
    expect(textareas()[0]).toHaveValue('LGTM');
  });

  test('splits a multi-line edit into one entry per line and renders it back unchanged', async () => {
    const user = userEvent.setup();
    renderOptions();
    await waitFor(() => {
      expect(storage.get).toHaveBeenCalled();
    });

    await user.type(textareas()[0], 'one{Enter}two');

    await waitFor(() => {
      expect(lastSet()).toEqual({ reviews: ['one', 'two'] });
    });
    expect(textareas()[0]).toHaveValue('one\ntwo');
  });

  test('keeps a blank line as an empty entry, so the text round-trips', async () => {
    const user = userEvent.setup();
    renderOptions();
    await waitFor(() => {
      expect(storage.get).toHaveBeenCalled();
    });

    await user.type(textareas()[0], 'one{Enter}{Enter}two');

    await waitFor(() => {
      expect(lastSet()).toEqual({ reviews: ['one', '', 'two'] });
    });
    expect(textareas()[0]).toHaveValue('one\n\ntwo');
  });

  test('a trailing newline stores a trailing empty entry', async () => {
    const user = userEvent.setup();
    renderOptions();
    await waitFor(() => {
      expect(storage.get).toHaveBeenCalled();
    });

    await user.type(textareas()[0], 'one{Enter}');

    await waitFor(() => {
      expect(lastSet()).toEqual({ reviews: ['one', ''] });
    });
  });

  test('clearing a textarea stores a single empty string, not an empty list', async () => {
    const user = userEvent.setup();
    renderOptions({ reviews: ['LGTM'], comments: [] });
    await waitFor(() => {
      expect(textareas()[0]).toHaveValue('LGTM');
    });

    await user.clear(textareas()[0]);

    // Documents current behaviour: `''.split(/\n/)` yields `['']`, so the
    // stored list holds one empty praise rather than no praises at all.
    await waitFor(() => {
      expect(lastSet()).toEqual({ reviews: [''] });
    });
  });
});

/** The most recent `chrome.storage.sync.set` payload. */
function lastSet(): Record<string, unknown> {
  const { calls } = storage.set.mock;
  return calls[calls.length - 1][0];
}
