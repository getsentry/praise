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

/**
 * GifList validates a new url by actually loading it as an image before
 * accepting it. These tests aren't exercising that validation (gif-list.test
 * covers it directly) so this fake `Image` just succeeds asynchronously,
 * matching what a real image load would eventually do.
 */
class AutoLoadingImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;

  set src(_value: string) {
    setTimeout(() => this.onload?.());
  }
}

let originalImage: typeof Image;

beforeEach(() => {
  originalImage = globalThis.Image;
  // @ts-expect-error -- test double, doesn't need to implement the full Image interface
  globalThis.Image = AutoLoadingImage;
});

afterEach(() => {
  globalThis.Image = originalImage;
  uninstallChromeMock();
  jest.clearAllMocks();
});

describe('Options', () => {
  test('renders a heading for each section', () => {
    renderOptions();

    expect(screen.getByRole('heading', { name: 'PR Approval', level: 2 })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Praising PR Review Comments', level: 2 })).toBeInTheDocument();
  });

  test('nests GIFs under PR Approval as a subheading', () => {
    renderOptions();

    expect(screen.getByRole('heading', { name: 'GIFs', level: 3 })).toBeInTheDocument();

    // Between the two top-level sections, so the gifs sit with the review they
    // attach to rather than trailing the whole page.
    const headings = screen.getAllByRole('heading').map(heading => heading.textContent);
    expect(headings).toEqual(['PR Approval', 'Quotes', 'GIFs', 'Praising PR Review Comments']);
  });

  test('reads every key from sync storage on mount, defaulting gifs on and quotes off', async () => {
    renderOptions();

    await waitFor(() => {
      expect(storage.get).toHaveBeenCalledTimes(1);
    });
    expect(storage.get.mock.calls[0][0]).toEqual({
      approveComment: '',
      comments: [],
      approveGifs: [],
      approveGifsEnabled: true,
      approveQuotesEnabled: false,
    });
  });

  test('shows the stored comment praises as rows', async () => {
    renderOptions({ comments: ['Nice', 'Thanks'] });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Nice' })).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: 'Thanks' })).toBeInTheDocument();
  });

  test('adding a comment praise persists it to the comments key', async () => {
    const user = userEvent.setup();
    renderOptions({ comments: [] });
    await waitFor(() => {
      expect(storage.get).toHaveBeenCalled();
    });

    await user.type(addInput('Praising PR Review Comments'), 'Nice{Enter}');

    expect(storage.set).toHaveBeenCalledWith({ comments: ['Nice'] });
  });

  test('editing the comment list writes only that key', async () => {
    const user = userEvent.setup();
    renderOptions({ approveComment: 'LGTM', comments: ['Nice'] });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Nice' })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: 'Nice' }));
    const editInput = screen.getByRole('textbox', { name: 'Edit "Nice"' });
    await user.clear(editInput);
    await user.type(editInput, 'Great job{Enter}');

    expect(storage.set).toHaveBeenCalledWith({ comments: ['Great job'] });
    for (const [written] of storage.set.mock.calls) {
      expect(Object.keys(written)).toEqual(['comments']);
    }
  });
});

describe('Options / approve comment', () => {
  function field(): HTMLInputElement {
    return screen.getByRole('textbox', { name: 'PR Approval Comment' });
  }

  test('is a single textbox, not a list', async () => {
    renderOptions({ approveComment: 'LGTM 🚀' });

    await waitFor(() => {
      expect(field()).toHaveValue('LGTM 🚀');
    });
    // A list would offer these; a single text must not.
    expect(screen.queryByRole('textbox', { name: 'Add to PR Approval Comment' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete "LGTM 🚀"' })).not.toBeInTheDocument();
  });

  test('persists the edited praise on Enter', async () => {
    const user = userEvent.setup();
    renderOptions({ approveComment: 'LGTM 🚀' });
    await waitFor(() => {
      expect(field()).toHaveValue('LGTM 🚀');
    });

    await user.clear(field());
    await user.type(field(), 'Ship it 🚢{Enter}');

    expect(storage.set).toHaveBeenCalledWith({ approveComment: 'Ship it 🚢' });
  });

  test('persists the edited praise on blur', async () => {
    const user = userEvent.setup();
    renderOptions({ approveComment: 'LGTM 🚀' });
    await waitFor(() => {
      expect(field()).toHaveValue('LGTM 🚀');
    });

    await user.clear(field());
    await user.type(field(), 'Ship it 🚢');
    await user.tab();

    expect(storage.set).toHaveBeenCalledWith({ approveComment: 'Ship it 🚢' });
  });

  /** Typing writes once, on commit -- `chrome.storage.sync` caps writes per minute. */
  test('does not write on every keystroke', async () => {
    const user = userEvent.setup();
    renderOptions({ approveComment: '' });
    await waitFor(() => {
      expect(storage.get).toHaveBeenCalled();
    });

    await user.type(field(), 'Ship it');

    expect(storage.set).not.toHaveBeenCalled();
  });

  test('reverts to the stored praise when left blank', async () => {
    const user = userEvent.setup();
    renderOptions({ approveComment: 'LGTM 🚀' });
    await waitFor(() => {
      expect(field()).toHaveValue('LGTM 🚀');
    });

    await user.clear(field());
    await user.tab();

    expect(storage.set).not.toHaveBeenCalled();
    expect(field()).toHaveValue('LGTM 🚀');
  });

  test('Escape abandons the edit', async () => {
    const user = userEvent.setup();
    renderOptions({ approveComment: 'LGTM 🚀' });
    await waitFor(() => {
      expect(field()).toHaveValue('LGTM 🚀');
    });

    await user.clear(field());
    await user.type(field(), 'Ship it{Escape}');

    expect(field()).toHaveValue('LGTM 🚀');
    expect(storage.set).not.toHaveBeenCalled();
  });
});

describe('Options / approve gifs', () => {
  /** Pico renders the toggle as `role="switch"`, so it is not a `checkbox` to the a11y tree. */
  function toggle(): HTMLInputElement {
    return screen.getByRole('switch', { name: 'Add a GIF to your PR Approval Comment' });
  }

  test('shows the stored gifs as rows', async () => {
    const gif = 'https://media.giphy.com/media/abc/giphy.gif';
    renderOptions({ approveGifs: [gif] });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: gif })).toBeInTheDocument();
    });
  });

  test('shows a preview image for each gif', async () => {
    const gif = 'https://media.giphy.com/media/abc/giphy.gif';
    const other = 'https://media.giphy.com/media/xyz/giphy.gif';
    const { container } = renderOptions({ approveGifs: [gif, other] });

    await waitFor(() => {
      expect(container.querySelectorAll('img.praise-preview')).toHaveLength(2);
    });
    const previews = [...container.querySelectorAll('img.praise-preview')];
    expect(previews.map(image => image.getAttribute('src'))).toEqual([gif, other]);
  });

  test('shows no previews for the comment praise list', async () => {
    const { container } = renderOptions({ comments: ['Nice'], approveGifs: [] });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Nice' })).toBeInTheDocument();
    });
    expect(container.querySelectorAll('img.praise-preview')).toHaveLength(0);
  });

  test('reflects the stored toggle state', async () => {
    renderOptions({ approveGifsEnabled: false });

    await waitFor(() => {
      expect(toggle()).not.toBeChecked();
    });
  });

  test('defaults the toggle to on when storage holds nothing', async () => {
    renderOptions();

    await waitFor(() => {
      expect(toggle()).toBeChecked();
    });
  });

  test('persists the toggle without touching the gif list', async () => {
    const user = userEvent.setup();
    renderOptions({ approveGifs: ['https://media.giphy.com/media/abc/giphy.gif'], approveGifsEnabled: true });
    await waitFor(() => {
      expect(toggle()).toBeChecked();
    });

    await user.click(toggle());

    expect(storage.set).toHaveBeenCalledWith({ approveGifsEnabled: false });
    expect(toggle()).not.toBeChecked();
  });

  test('adding a gif persists it to the gif key alone', async () => {
    const user = userEvent.setup();
    const gif = 'https://media.giphy.com/media/abc/giphy.gif';
    renderOptions({ approveComment: 'LGTM', approveGifs: [] });
    await waitFor(() => {
      expect(storage.get).toHaveBeenCalled();
    });

    await user.type(addInput('GIFs'), `${gif}{Enter}`);

    await waitFor(() => {
      expect(storage.set).toHaveBeenCalledWith({ approveGifs: [gif] });
    });
  });

  /** Turning gifs off must not read as "your list is gone". */
  test('keeps the gif list editable while the toggle is off', async () => {
    const user = userEvent.setup();
    const gif = 'https://media.giphy.com/media/abc/giphy.gif';
    renderOptions({ approveGifsEnabled: false, approveGifs: [] });
    await waitFor(() => {
      expect(toggle()).not.toBeChecked();
    });

    await user.type(addInput('GIFs'), `${gif}{Enter}`);

    await waitFor(() => {
      expect(storage.set).toHaveBeenCalledWith({ approveGifs: [gif] });
    });
  });
});

describe('Options / approve quotes', () => {
  function toggle(): HTMLInputElement {
    return screen.getByRole('switch', { name: 'Add a random quote below your PR Approval Comment' });
  }

  test('nests Quotes under PR Approval as a subheading', () => {
    renderOptions();

    expect(screen.getByRole('heading', { name: 'Quotes', level: 3 })).toBeInTheDocument();
  });

  /** A toggle only -- the quote list is curated in the repo, not editable here. */
  test('offers no quote list to edit', async () => {
    renderOptions();

    await waitFor(() => {
      expect(toggle()).toBeInTheDocument();
    });
    expect(screen.queryByRole('textbox', { name: 'Add to Quotes' })).not.toBeInTheDocument();
  });

  test('defaults the toggle to off when storage holds nothing', async () => {
    renderOptions();

    await waitFor(() => {
      expect(storage.get).toHaveBeenCalled();
    });
    expect(toggle()).not.toBeChecked();
  });

  test('reflects the stored toggle state', async () => {
    renderOptions({ approveQuotesEnabled: true });

    await waitFor(() => {
      expect(toggle()).toBeChecked();
    });
  });

  test('persists the toggle without touching any other key', async () => {
    const user = userEvent.setup();
    renderOptions({ approveComment: 'LGTM 🚀' });
    await waitFor(() => {
      expect(storage.get).toHaveBeenCalled();
    });

    await user.click(toggle());

    expect(storage.set).toHaveBeenCalledWith({ approveQuotesEnabled: true });
    expect(toggle()).toBeChecked();
  });

  /** Quotes pause the approval comment rather than replace it, so it stays editable. */
  test('keeps the approval comment editable while quotes are on', async () => {
    const user = userEvent.setup();
    renderOptions({ approveComment: 'LGTM 🚀', approveQuotesEnabled: true });
    const field = () => screen.getByRole('textbox', { name: 'PR Approval Comment' });
    await waitFor(() => {
      expect(field()).toHaveValue('LGTM 🚀');
    });

    expect(field()).toBeEnabled();

    await user.clear(field());
    await user.type(field(), 'Ship it 🚢{Enter}');

    expect(storage.set).toHaveBeenCalledWith({ approveComment: 'Ship it 🚢' });
  });
});
