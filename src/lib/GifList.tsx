import type { ChangeEvent, KeyboardEvent } from 'react';
import { useState } from 'react';
import { useEditableList } from './useEditableList';

type Props = {
  label: string;
  items: string[];
  onChange: (items: string[]) => void;
  /** For callers that supply their own heading; `label` still names the controls. */
  hideHeading?: boolean;
};

const LOAD_TIMEOUT_MS = 8000;
const ADD_ERROR_ID = 'gif-add-error';

/**
 * Editable list of GIF urls. Purely presentational: it never touches
 * storage, it only reports the complete next array through `onChange` and
 * lets the caller decide what to persist. Unlike PraiseList, adding a value
 * is validated asynchronously: it must end with `.gif` and must actually
 * load as an image before it is accepted.
 */
export const GifList = ({ label, items, onChange, hideHeading = false }: Props) => {
  const [addValue, setAddValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const { editingIndex, draft, setDraft, startEdit, deleteItem, handleEditKeyDown, handleEditBlur, addInputRef } =
    useEditableList(items, onChange);

  function handleAddChange(event: ChangeEvent<HTMLInputElement>) {
    setAddValue(event.target.value);
    if (error) setError(null);
  }

  function handleAddKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      const trimmed = addValue.trim();
      if (trimmed === '') return;
      if (!trimmed.toLowerCase().endsWith('.gif')) {
        setError('URL must end with .gif');
        return;
      }

      setIsChecking(true);
      const img = new Image();
      const timeoutId = setTimeout(() => {
        img.onload = null;
        img.onerror = null;
        setError("Couldn't load an image from that URL");
        setIsChecking(false);
      }, LOAD_TIMEOUT_MS);

      img.onload = () => {
        clearTimeout(timeoutId);
        onChange([...items, trimmed]);
        setAddValue('');
        setError(null);
        setIsChecking(false);
        addInputRef.current?.focus();
      };
      img.onerror = () => {
        clearTimeout(timeoutId);
        setError("Couldn't load an image from that URL");
        setIsChecking(false);
      };
      img.src = trimmed;
    } else if (event.key === 'Escape') {
      setAddValue('');
      setError(null);
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
              {/*
               * Decorative: the row's own text already carries the url, so an
               * alt would just repeat it to a screen reader. A broken url
               * shows as a broken image, which is the feedback the user wants.
               */}
              <img className="praise-preview" src={item} alt="" loading="lazy" />
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
        placeholder="Add gif…"
        aria-label={`Add to ${label}`}
        ref={addInputRef}
        value={addValue}
        disabled={isChecking}
        aria-describedby={error ? ADD_ERROR_ID : undefined}
        onChange={handleAddChange}
        onKeyDown={handleAddKeyDown}
      />
      {error && (
        <p className="praise-add-error" id={ADD_ERROR_ID} role="alert">
          {error}
        </p>
      )}
    </Wrapper>
  );
};
