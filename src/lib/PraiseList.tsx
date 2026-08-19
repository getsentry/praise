import React, { useRef, useState } from 'react';

type Props = { label: string; items: string[]; onChange: (items: string[]) => void };

/**
 * Editable list of praises. Purely presentational: it never touches storage,
 * it only reports the complete next array through `onChange` and lets the
 * caller decide what to persist.
 */
export const PraiseList = ({ label, items, onChange }: Props) => {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [draft, setDraft] = useState('');
  const [addValue, setAddValue] = useState('');
  const addInputRef = useRef<HTMLInputElement>(null);
  // Enter/Escape already resolve the edit; the blur that follows (e.g. from
  // moving focus elsewhere) must not resolve it a second time.
  const skipBlurRef = useRef(false);

  function commitEdit() {
    if (editingIndex === null) return;
    const trimmed = draft.trim();
    // An empty commit reverts rather than deletes: deletion has its own
    // button, and treating blank text as "delete" would be a silent second
    // path to the same result.
    if (trimmed !== '') {
      const next = [...items];
      next[editingIndex] = trimmed;
      onChange(next);
    }
    setEditingIndex(null);
  }

  function startEdit(index: number) {
    commitEdit();
    // Enter and Escape unmount the input without React firing blur, so the
    // flag they set would otherwise survive and swallow the next edit's blur.
    skipBlurRef.current = false;
    setEditingIndex(index);
    setDraft(items[index]);
  }

  function deleteItem(index: number) {
    onChange(items.filter((_, i) => i !== index));
    addInputRef.current?.focus();
  }

  function handleAddKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      const trimmed = addValue.trim();
      if (trimmed === '') return;
      onChange([...items, trimmed]);
      setAddValue('');
    } else if (event.key === 'Escape') {
      setAddValue('');
    }
  }

  function handleEditKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      skipBlurRef.current = true;
      commitEdit();
    } else if (event.key === 'Escape') {
      skipBlurRef.current = true;
      setEditingIndex(null);
    }
  }

  function handleEditBlur() {
    if (skipBlurRef.current) {
      skipBlurRef.current = false;
      return;
    }
    commitEdit();
  }

  return (
    <section className="praise-list">
      <h2>{label}</h2>
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
        placeholder="Add a praise…"
        aria-label={`Add to ${label}`}
        ref={addInputRef}
        value={addValue}
        onChange={event => {
          setAddValue(event.target.value);
        }}
        onKeyDown={handleAddKeyDown}
      />
    </section>
  );
};
