import type { KeyboardEvent } from 'react';
import { useRef, useState } from 'react';

/**
 * Row edit/delete mechanics shared by editable-list components (e.g.
 * PraiseList, GifList). Each consuming component owns its own add-input
 * state and JSX; this hook only manages an existing row's edit-in-place
 * state and deletion.
 */
export function useEditableList(items: string[], onChange: (items: string[]) => void) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [draft, setDraft] = useState('');
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

  function handleEditKeyDown(event: KeyboardEvent<HTMLInputElement>) {
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

  return {
    editingIndex,
    draft,
    setDraft,
    startEdit,
    commitEdit,
    deleteItem,
    handleEditKeyDown,
    handleEditBlur,
    addInputRef,
  };
}
