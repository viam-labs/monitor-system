import React, { useState } from 'react';
import CountEditor from './CountEditor';
import ThresholdEditor from './ThresholdEditor';
import ItemForm from './ItemForm';

export default function ItemRow({
  item, busy, dragHandle, wrapperRef, wrapperStyle,
  onIncrement, onDecrement, onSetQuantity, onSetThreshold, onSave, onDelete,
}) {
  const [expanded, setExpanded] = useState(false);
  const hasDrag = dragHandle !== undefined;

  return (
    <div
      ref={wrapperRef}
      style={wrapperStyle}
      className={'inventory-grid__card' + (hasDrag ? ' inventory-grid__card--with-drag' : '')}
    >
      {hasDrag && (
        <div className="inventory-grid__cell inventory-grid__cell--drag">{dragHandle}</div>
      )}
      <button
        type="button"
        className="inventory-grid__cell inventory-grid__cell--name inventory-grid__disclose"
        onClick={() => setExpanded(v => !v)}
        aria-expanded={expanded}
      >
        <span className={'automation-card__chevron' + (expanded ? ' automation-card__chevron--open' : '')}>›</span>
        <span className="inventory-grid__name-text">{item.name}</span>
      </button>
      <div className="inventory-grid__cell inventory-grid__cell--qty">
        <button
          type="button"
          className="feeder-icon-button"
          onClick={() => onDecrement(item.id)}
          disabled={busy || item.quantity === 0}
          aria-label={`Decrement ${item.name}`}
          title="−1"
        >
          −
        </button>
        <CountEditor
          quantity={item.quantity}
          busy={busy}
          onCommit={(q) => onSetQuantity(item.id, q)}
          name={item.name}
        />
        <button
          type="button"
          className="feeder-icon-button"
          onClick={() => onIncrement(item.id)}
          disabled={busy}
          aria-label={`Increment ${item.name}`}
          title="+1"
        >
          +
        </button>
      </div>
      <div className="inventory-grid__cell inventory-grid__cell--threshold">
        <ThresholdEditor
          threshold={item.threshold ?? null}
          busy={busy}
          onCommit={(v) => onSetThreshold(item.id, v)}
          name={item.name}
        />
      </div>

      {expanded && (
        <div className="inventory-grid__expanded">
          <ItemForm
            initial={item}
            busy={busy}
            submitLabel="Save"
            onSubmit={onSave}
          />
          <div className="automation-card__actions">
            <span className="automation-card__spacer" />
            <button
              type="button"
              className="feeder-icon-button feeder-icon-button--danger"
              onClick={() => onDelete(item.id, item.name)}
              disabled={busy}
              aria-label={`Delete ${item.name}`}
              title="Delete"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
