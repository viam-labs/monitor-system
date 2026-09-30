import React, { useEffect, useRef, useState } from 'react';

export default function CountEditor({ quantity, busy, onCommit, name }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(quantity));
  const inputRef = useRef(null);

  useEffect(() => {
    if (!editing) setDraft(String(quantity));
  }, [quantity, editing]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const commit = () => {
    const q = Number(draft);
    if (Number.isInteger(q) && q >= 0 && q !== quantity) onCommit(q);
    setEditing(false);
  };

  const cancel = () => {
    setDraft(String(quantity));
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="number"
        min="0"
        step="1"
        inputMode="numeric"
        className="inventory-row__count inventory-row__count--input"
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => {
          if (e.key === 'Enter') { e.preventDefault(); commit(); }
          else if (e.key === 'Escape') { e.preventDefault(); cancel(); }
        }}
        disabled={busy}
        aria-label={`Set count for ${name}`}
      />
    );
  }

  return (
    <button
      type="button"
      className="inventory-row__count inventory-row__count--button"
      onClick={() => setEditing(true)}
      disabled={busy}
      aria-label={`Edit count for ${name} (currently ${quantity})`}
      title="Edit count"
    >
      {quantity}
    </button>
  );
}
