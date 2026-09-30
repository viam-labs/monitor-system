import React, { useEffect, useRef, useState } from 'react';

export default function ThresholdEditor({ threshold, busy, onCommit, name }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(threshold == null ? '' : String(threshold));
  const inputRef = useRef(null);

  useEffect(() => {
    if (!editing) setDraft(threshold == null ? '' : String(threshold));
  }, [threshold, editing]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed === '') {
      if (threshold != null) onCommit(null);
    } else {
      const n = Number(trimmed);
      if (Number.isInteger(n) && n >= 0 && n !== threshold) onCommit(n);
    }
    setEditing(false);
  };

  const cancel = () => {
    setDraft(threshold == null ? '' : String(threshold));
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
        placeholder="—"
        aria-label={`Set threshold for ${name}`}
      />
    );
  }

  return (
    <button
      type="button"
      className="inventory-row__count inventory-row__count--button"
      onClick={() => setEditing(true)}
      disabled={busy}
      aria-label={`Edit threshold for ${name} (currently ${threshold ?? 'unset'})`}
      title="Edit threshold"
    >
      {threshold == null ? '—' : threshold}
    </button>
  );
}
