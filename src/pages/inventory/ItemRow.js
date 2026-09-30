import React, { useState } from 'react';
import CountEditor from './CountEditor';
import ThresholdEditor from './ThresholdEditor';
import ItemForm from './ItemForm';
import { formatRelative } from '../../lib/format';

function routineStatus(routine) {
  if (!routine) return null;
  const last = routine.last_done_at;
  if (!last) return { actionable: true, label: 'never done' };
  const ms = Date.parse(last);
  if (Number.isNaN(ms)) return { actionable: true, label: 'never done' };
  const dueAt = ms + routine.interval_days * 24 * 60 * 60 * 1000;
  return { actionable: Date.now() >= dueAt, label: formatRelative(last) };
}

export default function ItemRow({
  item, busy, dragHandle, wrapperRef, wrapperStyle,
  onIncrement, onDecrement, onSetQuantity, onSetThreshold, onSave, onDelete, onMarkRoutineDone,
}) {
  const [expanded, setExpanded] = useState(false);
  const hasDrag = dragHandle !== undefined;
  const hasSupply = item.package_qty != null;
  const routine = routineStatus(item.routine);

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
        {hasSupply ? (
          <>
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
          </>
        ) : (
          <span className="inventory-row__count inventory-row__count--placeholder">—</span>
        )}
      </div>
      <div className="inventory-grid__cell inventory-grid__cell--threshold">
        {routine ? (
          <button
            type="button"
            className={
              'inventory-row__routine'
              + (routine.actionable ? ' inventory-row__routine--due' : ' inventory-row__routine--done')
            }
            onClick={() => onMarkRoutineDone(item.id)}
            disabled={busy}
            title={routine.actionable ? 'Mark done' : `Last done ${routine.label}`}
          >
            {routine.actionable ? 'Mark done' : routine.label}
          </button>
        ) : hasSupply ? (
          <ThresholdEditor
            threshold={item.threshold ?? null}
            busy={busy}
            onCommit={(v) => onSetThreshold(item.id, v)}
            name={item.name}
          />
        ) : null}
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
