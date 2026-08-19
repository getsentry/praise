import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PraiseList } from '../lib/PraiseList';

/**
 * PraiseList is pure: it only reports changes through `onChange`. This
 * wrapper plays the role of the real caller, feeding committed items back in
 * as props, so tests can see the row list reflect a completed edit.
 */
function Wrapper({ initialItems, onChange }: { initialItems: string[]; onChange: (items: string[]) => void }) {
  const [items, setItems] = useState(initialItems);
  return (
    <PraiseList
      label="Test Praises"
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
  return screen.getByRole('textbox', { name: 'Add to Test Praises' });
}

function editInputFor(text: string): HTMLInputElement {
  return screen.getByRole('textbox', { name: `Edit "${text}"` });
}

function deleteButtonFor(text: string): HTMLElement {
  return screen.getByRole('button', { name: `Delete "${text}"` });
}

describe('PraiseList', () => {
  test('renders a heading with the given label', () => {
    renderList([]);

    expect(screen.getByRole('heading', { name: 'Test Praises' })).toBeInTheDocument();
  });

  test('renders one row per item, showing its text', () => {
    renderList(['LGTM', 'Nice work']);

    expect(rowTexts()).toEqual(['LGTM', 'Nice work']);
  });

  test('renders no rows for an empty list', () => {
    renderList([]);

    expect(rowTexts()).toEqual([]);
    expect(addInput()).toBeInTheDocument();
  });

  describe('adding', () => {
    test('pressing Enter in the add input appends the value and calls onChange', async () => {
      const user = userEvent.setup();
      const onChange = renderList(['LGTM']);

      await user.type(addInput(), 'Nice work{Enter}');

      expect(onChange).toHaveBeenCalledWith(['LGTM', 'Nice work']);
    });

    test('after adding, the add input clears and keeps focus', async () => {
      const user = userEvent.setup();
      renderList([]);

      await user.type(addInput(), 'Nice work{Enter}');

      expect(addInput()).toHaveValue('');
      expect(addInput()).toHaveFocus();
    });

    test('pressing Enter with a blank add input does nothing', async () => {
      const user = userEvent.setup();
      const onChange = renderList([]);

      await user.click(addInput());
      await user.keyboard('{Enter}');

      expect(onChange).not.toHaveBeenCalled();
      expect(rowTexts()).toEqual([]);
    });

    test('pressing Enter with a whitespace-only add input does nothing', async () => {
      const user = userEvent.setup();
      const onChange = renderList([]);

      await user.type(addInput(), '   {Enter}');

      expect(onChange).not.toHaveBeenCalled();
    });

    test('leading and trailing whitespace is trimmed before adding', async () => {
      const user = userEvent.setup();
      const onChange = renderList([]);

      await user.type(addInput(), '  Nice work  {Enter}');

      expect(onChange).toHaveBeenCalledWith(['Nice work']);
    });

    test('pressing Escape in the add input clears it without adding', async () => {
      const user = userEvent.setup();
      const onChange = renderList([]);

      await user.type(addInput(), 'Nice work{Escape}');

      expect(addInput()).toHaveValue('');
      expect(onChange).not.toHaveBeenCalled();
    });

    test('adding a duplicate value is allowed', async () => {
      const user = userEvent.setup();
      const onChange = renderList(['LGTM']);

      await user.type(addInput(), 'LGTM{Enter}');

      expect(onChange).toHaveBeenCalledWith(['LGTM', 'LGTM']);
    });
  });

  describe('editing', () => {
    test('clicking a row replaces it with an edit input seeded with the current text', async () => {
      const user = userEvent.setup();
      renderList(['LGTM']);

      await user.click(screen.getByRole('button', { name: 'LGTM' }));

      expect(editInputFor('LGTM')).toHaveValue('LGTM');
    });

    test('pressing Enter in the edit input commits the change and returns to static', async () => {
      const user = userEvent.setup();
      const onChange = renderList(['LGTM', 'Nice']);

      await user.click(screen.getByRole('button', { name: 'LGTM' }));
      const input = editInputFor('LGTM');
      await user.clear(input);
      await user.type(input, 'Great job{Enter}');

      expect(onChange).toHaveBeenCalledWith(['Great job', 'Nice']);
      expect(rowTexts()).toEqual(['Great job', 'Nice']);
    });

    test('blurring the edit input commits the change', async () => {
      const user = userEvent.setup();
      const onChange = renderList(['LGTM']);

      await user.click(screen.getByRole('button', { name: 'LGTM' }));
      const input = editInputFor('LGTM');
      await user.clear(input);
      await user.type(input, 'Great job');
      await user.tab();

      expect(onChange).toHaveBeenCalledWith(['Great job']);
      expect(rowTexts()).toEqual(['Great job']);
    });

    test('pressing Escape in the edit input reverts without calling onChange', async () => {
      const user = userEvent.setup();
      const onChange = renderList(['LGTM']);

      await user.click(screen.getByRole('button', { name: 'LGTM' }));
      const input = editInputFor('LGTM');
      await user.clear(input);
      await user.type(input, 'Great job{Escape}');

      expect(onChange).not.toHaveBeenCalled();
      expect(rowTexts()).toEqual(['LGTM']);
    });

    test('committing an empty value reverts instead of deleting the row', async () => {
      const user = userEvent.setup();
      const onChange = renderList(['LGTM']);

      await user.click(screen.getByRole('button', { name: 'LGTM' }));
      const input = editInputFor('LGTM');
      await user.clear(input);
      await user.type(input, '{Enter}');

      expect(onChange).not.toHaveBeenCalled();
      expect(rowTexts()).toEqual(['LGTM']);
    });

    test('committing a whitespace-only value reverts instead of deleting the row', async () => {
      const user = userEvent.setup();
      const onChange = renderList(['LGTM']);

      await user.click(screen.getByRole('button', { name: 'LGTM' }));
      const input = editInputFor('LGTM');
      await user.clear(input);
      await user.type(input, '   {Enter}');

      expect(onChange).not.toHaveBeenCalled();
      expect(rowTexts()).toEqual(['LGTM']);
    });

    test('committed values are trimmed', async () => {
      const user = userEvent.setup();
      const onChange = renderList(['LGTM']);

      await user.click(screen.getByRole('button', { name: 'LGTM' }));
      const input = editInputFor('LGTM');
      await user.clear(input);
      await user.type(input, '  Great job  {Enter}');

      expect(onChange).toHaveBeenCalledWith(['Great job']);
    });

    test('opening a second row for edit commits the first', async () => {
      const user = userEvent.setup();
      const onChange = renderList(['LGTM', 'Nice']);

      await user.click(screen.getByRole('button', { name: 'LGTM' }));
      const input = editInputFor('LGTM');
      await user.clear(input);
      await user.type(input, 'Great job');
      await user.click(screen.getByRole('button', { name: 'Nice' }));

      expect(onChange).toHaveBeenCalledWith(['Great job', 'Nice']);
      expect(editInputFor('Nice')).toHaveValue('Nice');
    });

    test('a blur commit still works after an earlier edit was committed with Enter', async () => {
      const user = userEvent.setup();
      const onChange = renderList(['LGTM', 'Nice']);

      await user.click(screen.getByRole('button', { name: 'LGTM' }));
      const first = editInputFor('LGTM');
      await user.clear(first);
      await user.type(first, 'Great job{Enter}');

      await user.click(screen.getByRole('button', { name: 'Nice' }));
      const second = editInputFor('Nice');
      await user.clear(second);
      await user.type(second, 'Thanks');
      await user.click(document.body);

      expect(onChange).toHaveBeenLastCalledWith(['Great job', 'Thanks']);
      expect(rowTexts()).toEqual(['Great job', 'Thanks']);
    });
  });

  describe('deleting', () => {
    test('clicking delete removes the item and calls onChange with the rest', async () => {
      const user = userEvent.setup();
      const onChange = renderList(['LGTM', 'Nice']);

      await user.click(deleteButtonFor('LGTM'));

      expect(onChange).toHaveBeenCalledWith(['Nice']);
    });

    test('after deleting, focus moves to the add input', async () => {
      const user = userEvent.setup();
      renderList(['LGTM']);

      await user.click(deleteButtonFor('LGTM'));

      expect(addInput()).toHaveFocus();
    });

    /*
     * Deleting while another row is open relies on blur landing before click,
     * so the delete is built from the committed list rather than the draft's
     * stale one. These pin that ordering in both directions.
     */
    test('deleting a later row keeps an edit in progress above it', async () => {
      const user = userEvent.setup();
      const onChange = renderList(['LGTM', 'Nice']);

      await user.click(screen.getByRole('button', { name: 'LGTM' }));
      const input = editInputFor('LGTM');
      await user.clear(input);
      await user.type(input, 'Great job');
      await user.click(deleteButtonFor('Nice'));

      expect(onChange).toHaveBeenLastCalledWith(['Great job']);
      expect(rowTexts()).toEqual(['Great job']);
    });

    test('deleting an earlier row keeps an edit in progress below it', async () => {
      const user = userEvent.setup();
      const onChange = renderList(['LGTM', 'Nice']);

      await user.click(screen.getByRole('button', { name: 'Nice' }));
      const input = editInputFor('Nice');
      await user.clear(input);
      await user.type(input, 'Thanks');
      await user.click(deleteButtonFor('LGTM'));

      expect(onChange).toHaveBeenLastCalledWith(['Thanks']);
      expect(rowTexts()).toEqual(['Thanks']);
    });
  });
});
