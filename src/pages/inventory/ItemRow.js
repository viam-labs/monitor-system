import React, { useState } from 'react';
import { ChevronRight } from 'lucide-react';

export default function ItemRow({
  item, busy, dragHandle, wrapperRef, wrapperStyle,
  onIncrement, onDecrement, onSetThreshold, onSetSlot, onDelete,
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
        <span className="inv-nm">{item.name}</span>
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
            <b>{item.quantity}</b>
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
