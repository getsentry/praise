import type { KeyboardEvent } from 'react';
import { useState } from 'react';
import { useEditableList } from './useEditableList';

type Props = {
  label: string;
  items: string[];
  onChange: (items: string[]) => void;
  /** For callers that supply their own heading; `label` still names the controls. */
  hideHeading?: boolean;
};

/**
 * Editable list of praises. Purely presentational: it never touches storage,
 * it only reports the complete next array through `onChange` and lets the
 * caller decide what to persist.
 */
export const PraiseList = ({ label, items, onChange, hideHeading = false }: Props) => {
  const [addValue, setAddValue] = useState('');
  const { editingIndex, draft, setDraft, startEdit, deleteItem, handleEditKeyDown, handleEditBlur, addInputRef } =
    useEditableList(items, onChange);

  function handleAddKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      const trimmed = addValue.trim();
      if (trimmed === '') return;
      onChange([...items, trimmed]);
      setAddValue('');
    } else if (event.key === 'Escape') {
      setAddValue('');
    }
  }

  const Wrapper = hideHeading ? 'div' : 'section';

  return (
    <Wrapper className={hideHeading ? undefined : 'praise-list'}>
      {!hideHeading && <h2>{label}</h2>}
      <ul className="praise-items">
        {items.map((item, index) =>
          editingIndex === index ? (
            <li className="praise-item" key={index}>
              <input
                className="praise-edit"
                aria-label={`Edit "${item}"`}
                value={draft}
                onChange={event => {
                  setDraft(event.target.value);
                }}
                onKeyDown={handleEditKeyDown}
                onBlur={handleEditBlur}
                autoFocus
              />
            </li>
          ) : (
            <li className="praise-item" key={index}>
              <button
                type="button"
                className="praise-text"
                onClick={() => {
                  startEdit(index);
                }}
              >
                {item}
              </button>
              <button
                type="button"
                className="praise-delete"
                aria-label={`Delete "${item}"`}
                onClick={() => {
                  deleteItem(index);
                }}
              >
                ×
              </button>
            </li>
          ),
        )}
      </ul>
      <input
        className="praise-add"
        placeholder="Add a comment…"
        aria-label={`Add to ${label}`}
        ref={addInputRef}
        value={addValue}
        onChange={event => {
          setAddValue(event.target.value);
        }}
        onKeyDown={handleAddKeyDown}
      />
    </Wrapper>
  );
};
