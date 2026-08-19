import React, { useEffect, useState } from 'react';

type Props = { heading: string; label: string; value: string; onChange: (value: string) => void };

/**
 * Single-value counterpart to `PraiseList`. Purely presentational: it never
 * touches storage, it only reports the committed value through `onChange`.
 *
 * Commits on blur and Enter rather than on every keystroke -- `chrome.storage.sync`
 * caps writes per minute, and typing a praise would spend that budget on
 * intermediate values nobody wants saved.
 */
export const PraiseText = ({ heading, label, value, onChange }: Props) => {
  const [draft, setDraft] = useState(value);

  // The stored value lands a tick after mount, so the draft has to follow it.
  useEffect(() => {
    setDraft(value);
  }, [value]);

  function commit() {
    const trimmed = draft.trim();
    // Blank reverts rather than clears: an approval with no comment would leave
    // the button doing nothing, with no hint as to why.
    if (trimmed === '') {
      setDraft(value);
      return;
    }
    if (trimmed !== value) {
      onChange(trimmed);
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      commit();
    } else if (event.key === 'Escape') {
      setDraft(value);
    }
  }

  return (
    <section className="praise-list">
      <h2>{heading}</h2>
      <label htmlFor="praise-text-input">{label}</label>
      <input
        id="praise-text-input"
        className="praise-add"
        value={draft}
        onChange={event => {
          setDraft(event.target.value);
        }}
        onKeyDown={handleKeyDown}
        onBlur={commit}
      />
    </section>
  );
};
