import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Options } from '../lib/Options';
import { type ChromeStorageMock, installChromeMock, uninstallChromeMock } from '../test-support/chrome-mock';

let storage: ChromeStorageMock;

function renderOptions(stored: Record<string, unknown> = {}) {
  storage = installChromeMock(stored);
  return render(<Options />);
}

function addInput(label: string): HTMLInputElement {
  return screen.getByRole('textbox', { name: `Add to ${label}` });
}

afterEach(() => {
  uninstallChromeMock();
  jest.clearAllMocks();
});

describe('Options', () => {
  test('renders a heading for each praise list', () => {
    renderOptions();

    expect(screen.getByRole('heading', { name: 'Review Praises' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Comment Praises' })).toBeInTheDocument();
  });

  test('reads both keys from sync storage on mount, defaulting to empty lists', async () => {
    renderOptions();

    await waitFor(() => {
      expect(storage.get).toHaveBeenCalledTimes(1);
    });
    expect(storage.get.mock.calls[0][0]).toEqual({ reviews: [], comments: [] });
  });

  test('shows the stored praises as rows', async () => {
    renderOptions({ reviews: ['LGTM', 'Ship it'], comments: ['Nice', 'Thanks'] });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'LGTM' })).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: 'Ship it' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Nice' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Thanks' })).toBeInTheDocument();
  });

  test('adding a praise persists it to the correct storage key', async () => {
    const user = userEvent.setup();
    renderOptions({ reviews: [], comments: [] });
    await waitFor(() => {
      expect(storage.get).toHaveBeenCalled();
    });

    await user.type(addInput('Review Praises'), 'LGTM{Enter}');

    expect(storage.set).toHaveBeenCalledWith({ reviews: ['LGTM'] });
  });

  test('editing one list writes only that list, leaving the other list untouched', async () => {
    const user = userEvent.setup();
    renderOptions({ reviews: ['LGTM'], comments: ['Nice'] });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'LGTM' })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: 'LGTM' }));
    const editInput = screen.getByRole('textbox', { name: 'Edit "LGTM"' });
    await user.clear(editInput);
    await user.type(editInput, 'Great job{Enter}');

    expect(storage.set).toHaveBeenCalledWith({ reviews: ['Great job'] });
    for (const [written] of storage.set.mock.calls) {
      expect(Object.keys(written)).toEqual(['reviews']);
    }
    expect(screen.getByRole('button', { name: 'Nice' })).toBeInTheDocument();
  });
});
