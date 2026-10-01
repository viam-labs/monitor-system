import React, { useEffect, useRef, useState } from 'react';
import { ChevronRight } from 'lucide-react';

function InlineText({ value, placeholder, onCommit, disabled, className }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef(null);

  useEffect(() => { if (!editing) setDraft(value); }, [value, editing]);
  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const commit = () => {
    setEditing(false);
    const next = draft.trim();
    if (next && next !== value) onCommit(next);
    else setDraft(value);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); commit(); }
          if (e.key === 'Escape') { setDraft(value); setEditing(false); }
        }}
        disabled={disabled}
        className={className + ' inv-inline-input'}
        maxLength={60}
      />
    );
  }
  return (
    <button
      type="button"
      className={className + ' inv-inline-button'}
      onClick={() => !disabled && setEditing(true)}
      disabled={disabled}
    >
      {value || <span className="inv-inline-placeholder">{placeholder}</span>}
    </button>
  );
}

function InlineQty({ value, onCommit, disabled }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const inputRef = useRef(null);

  useEffect(() => { if (!editing) setDraft(String(value)); }, [value, editing]);
  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const commit = () => {
    setEditing(false);
    const next = Number(draft);
    if (!Number.isInteger(next) || next < 0) { setDraft(String(value)); return; }
    if (next !== value) onCommit(next);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="number"
        min="0"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); commit(); }
          if (e.key === 'Escape') { setDraft(String(value)); setEditing(false); }
        }}
        disabled={disabled}
        className="inv-qty-input"
      />
    );
  }
  return (
    <button
      type="button"
      className="inv-qty-value"
      onClick={() => !disabled && setEditing(true)}
      disabled={disabled}
      aria-label={`Set quantity (currently ${value})`}
    >
      {value}
    </button>
  );
}

export default function ItemRow({
  item, busy, dragHandle, wrapperRef, wrapperStyle,
  onIncrement, onDecrement, onSetQuantity, onSetName, onSetThreshold, onSetSlot, onDelete,
}) {
  const [expanded, setExpanded] = useState(false);
  const [threshold, setThreshold] = useState(
    item.threshold != null ? String(item.threshold) : '',
  );
  const [slot, setSlot] = useState(
    item.button?.slot != null ? String(item.button.slot) : '',
  );

  const out = item.quantity === 0;
  const low = !out && item.threshold != null && item.quantity <= item.threshold;

  const commitThreshold = () => {
    const next = threshold === '' ? null : Number(threshold);
    if (next === item.threshold) return;
    if (next !== null && (!Number.isFinite(next) || next < 0)) return;
    onSetThreshold(item.id, next);
  };

  const commitSlot = () => {
    const next = slot === '' ? null : Number(slot);
    if (next === (item.button?.slot ?? null)) return;
    if (next !== null && (!Number.isInteger(next) || next < 0)) return;
    onSetSlot(item.id, next);
  };

  return (
    <div
      ref={wrapperRef}
      style={wrapperStyle}
      className={'inv-ivw' + (expanded ? ' inv-ivw--open' : '')}
    >
      <div className="inv-row">
        {dragHandle || <span className="inv-grip" aria-hidden="true">⠿</span>}
        <InlineText
          value={item.name}
          placeholder="Name"
          onCommit={(next) => onSetName(item.id, next)}
          disabled={busy}
          className="inv-nm"
        />
        {out && <span className="inv-pill inv-pill--out">Out</span>}
        {low && <span className="inv-pill inv-pill--low">Low</span>}
        {item.package_qty != null && (
          <div className="inv-qty">
            <button
              type="button"
              className="inv-step"
              onClick={() => onDecrement(item.id)}
              disabled={busy || item.quantity === 0}
              aria-label={`Decrement ${item.name}`}
            >
              −
            </button>
            <InlineQty
              value={item.quantity}
              onCommit={(next) => onSetQuantity(item.id, next)}
              disabled={busy}
            />
            <button
              type="button"
              className="inv-step"
              onClick={() => onIncrement(item.id)}
              disabled={busy}
              aria-label={`Increment ${item.name}`}
            >
              +
            </button>
          </div>
        )}
        <button
          type="button"
          className="inv-chev"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          aria-label={expanded ? 'Collapse' : 'Expand'}
        >
          <ChevronRight size={15} strokeWidth={2} />
        </button>
      </div>
      {expanded && (
        <div className="inv-xp">
          <label>
            Low at
            <input
              type="number"
              min="0"
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              onBlur={commitThreshold}
              disabled={busy}
            />
          </label>
          <label>
            Deck slot
            <input
              type="number"
              min="0"
              value={slot}
              onChange={(e) => setSlot(e.target.value)}
              onBlur={commitSlot}
              disabled={busy}
            />
          </label>
          <button
            type="button"
            className="inv-del"
            onClick={() => onDelete(item.id, item.name)}
            disabled={busy}
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}
