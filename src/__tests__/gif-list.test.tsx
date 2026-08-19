import { useState } from 'react';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GifList } from '../lib/GifList';

/**
 * GifList is pure: it only reports changes through `onChange`. This wrapper
 * plays the role of the real caller, feeding committed items back in as
 * props, so tests can see the row list reflect a completed edit.
 */
function Wrapper({ initialItems, onChange }: { initialItems: string[]; onChange: (items: string[]) => void }) {
  const [items, setItems] = useState(initialItems);
  return (
    <GifList
      label="Test Gifs"
      items={items}
      onChange={next => {
        setItems(next);
        onChange(next);
      }}
    />
  );
}

function renderList(items: string[] = []) {
  const onChange = jest.fn();
  render(<Wrapper initialItems={items} onChange={onChange} />);
  return onChange;
}

/** The visible rows, in document order. */
function rowTexts(): string[] {
  return screen.queryAllByRole('button', { name: /^(?!Delete)/ }).map(button => button.textContent ?? '');
}

function addInput(): HTMLInputElement {
  return screen.getByRole('textbox', { name: 'Add to Test Gifs' });
}

function editInputFor(text: string): HTMLInputElement {
  return screen.getByRole('textbox', { name: `Edit "${text}"` });
}

function deleteButtonFor(text: string): HTMLElement {
  return screen.getByRole('button', { name: `Delete "${text}"` });
}

/** Fake `Image` instances created by the component, captured for manual resolution. */
class FakeImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  src = '';

  constructor() {
    fakeImages.push(this);
  }
}

let fakeImages: FakeImage[] = [];
let originalImage: typeof Image;

beforeEach(() => {
  fakeImages = [];
  originalImage = globalThis.Image;
  // @ts-expect-error -- test double, doesn't need to implement the full Image interface
  globalThis.Image = FakeImage;
});

afterEach(() => {
  globalThis.Image = originalImage;
});

function lastImage(): FakeImage {
  const image = fakeImages[fakeImages.length - 1];
  if (!image) throw new Error('no Image was constructed');
  return image;
}

describe('GifList', () => {
  test('renders one row per item, showing its text', () => {
    renderList(['a.gif', 'b.gif']);

    expect(rowTexts()).toEqual(['a.gif', 'b.gif']);
  });

  test('renders no rows for an empty list', () => {
    renderList([]);

    expect(rowTexts()).toEqual([]);
    expect(addInput()).toBeInTheDocument();
  });

  test('each row renders its image preview with the item url as src', () => {
    renderList(['a.gif']);

    const img = document.querySelector('img.praise-preview');
    expect(img).toHaveAttribute('src', 'a.gif');
    expect(img).toHaveAttribute('alt', '');
  });

  describe('adding', () => {
    test('Enter with a non-.gif URL shows an error and does not call onChange', async () => {
      const user = userEvent.setup();
      const onChange = renderList([]);

      await user.type(addInput(), 'https://example.com/not-a-gif{Enter}');

      expect(await screen.findByRole('alert')).toHaveTextContent('Must be a valid http(s) URL ending in .gif');
      expect(onChange).not.toHaveBeenCalled();
      expect(fakeImages).toHaveLength(0);
    });

    test('Enter with a non-http(s) scheme is rejected even if it ends in .gif', async () => {
      const user = userEvent.setup();
      const onChange = renderList([]);

      await user.type(addInput(), 'javascript:alert(1)//x.gif{Enter}');

      expect(await screen.findByRole('alert')).toHaveTextContent('Must be a valid http(s) URL ending in .gif');
      expect(onChange).not.toHaveBeenCalled();
      expect(fakeImages).toHaveLength(0);
    });

    test('Enter with a .gif URL disables the input while checking, then adds it on load', async () => {
      const user = userEvent.setup();
      const onChange = renderList([]);

      await user.type(addInput(), 'https://example.com/nice.gif{Enter}');

      expect(addInput()).toBeDisabled();
      expect(onChange).not.toHaveBeenCalled();

      act(() => {
        lastImage().onload?.();
      });

      expect(onChange).toHaveBeenCalledWith(['https://example.com/nice.gif']);
      expect(addInput()).toHaveValue('');
      expect(addInput()).not.toBeDisabled();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    test('Enter with a .gif URL shows an error on load failure and does not call onChange', async () => {
      const user = userEvent.setup();
      const onChange = renderList([]);

      await user.type(addInput(), 'https://example.com/nice.gif{Enter}');
      act(() => {
        lastImage().onerror?.();
      });

      expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't load an image from that URL");
      expect(onChange).not.toHaveBeenCalled();
      expect(addInput()).not.toBeDisabled();
    });

    test('resubmitting the same failed URL without editing it clears the stale error while re-checking', async () => {
      const user = userEvent.setup();
      renderList([]);

      await user.type(addInput(), 'https://example.com/nice.gif{Enter}');
      act(() => {
        lastImage().onerror?.();
      });
      expect(await screen.findByRole('alert')).toBeInTheDocument();

      await user.keyboard('{Enter}');

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(addInput()).toBeDisabled();
    });

    test('a load that neither succeeds nor fails within 8s is treated as a failure', async () => {
      jest.useFakeTimers();
      const user = userEvent.setup({ delay: null });
      const onChange = renderList([]);

      await user.type(addInput(), 'https://example.com/nice.gif{Enter}');
      const image = lastImage();

      act(() => {
        jest.advanceTimersByTime(8000);
      });

      expect(screen.getByRole('alert')).toHaveTextContent("Couldn't load an image from that URL");
      expect(onChange).not.toHaveBeenCalled();
      expect(addInput()).not.toBeDisabled();

      // A late real event after the timeout already resolved it must be a no-op.
      expect(image.onload).toBeNull();
      expect(image.onerror).toBeNull();

      jest.useRealTimers();
    });

    test('typing after an error clears the error', async () => {
      const user = userEvent.setup();
      renderList([]);

      await user.type(addInput(), 'not-a-gif{Enter}');
      expect(await screen.findByRole('alert')).toBeInTheDocument();

      await user.type(addInput(), 'x');

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    test('a delete made while a load check is pending is not reverted when the check later succeeds', async () => {
      const user = userEvent.setup();
      const onChange = renderList(['a.gif']);

      await user.type(addInput(), 'https://example.com/nice.gif{Enter}');
      await user.click(deleteButtonFor('a.gif'));
      expect(onChange).toHaveBeenLastCalledWith([]);

      act(() => {
        lastImage().onload?.();
      });

      expect(onChange).toHaveBeenLastCalledWith(['https://example.com/nice.gif']);
      expect(rowTexts()).toEqual(['https://example.com/nice.gif']);
    });

    test('Escape clears both the value and the error', async () => {
      const user = userEvent.setup();
      const onChange = renderList([]);

      await user.type(addInput(), 'not-a-gif');
      await user.keyboard('{Enter}');
      expect(await screen.findByRole('alert')).toBeInTheDocument();

      await user.keyboard('{Escape}');

      expect(addInput()).toHaveValue('');
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe('editing and deleting', () => {
    test('clicking a row replaces it with an edit input seeded with the current text', async () => {
      const user = userEvent.setup();
      renderList(['a.gif']);

      await user.click(screen.getByRole('button', { name: 'a.gif' }));

      expect(editInputFor('a.gif')).toHaveValue('a.gif');
    });

    test('pressing Enter in the edit input commits the change', async () => {
      const user = userEvent.setup();
      const onChange = renderList(['a.gif']);

      await user.click(screen.getByRole('button', { name: 'a.gif' }));
      const input = editInputFor('a.gif');
      await user.clear(input);
      await user.type(input, 'b.gif{Enter}');

      expect(onChange).toHaveBeenCalledWith(['b.gif']);
      expect(rowTexts()).toEqual(['b.gif']);
    });

    test('clicking delete removes the item and calls onChange with the rest', async () => {
      const user = userEvent.setup();
      const onChange = renderList(['a.gif', 'b.gif']);

      await user.click(deleteButtonFor('a.gif'));

      expect(onChange).toHaveBeenCalledWith(['b.gif']);
    });

    test('after deleting, focus moves to the add input', async () => {
      const user = userEvent.setup();
      renderList(['a.gif']);

      await user.click(deleteButtonFor('a.gif'));

      expect(addInput()).toHaveFocus();
    });
  });
});
