import React, { useEffect, useState } from 'react';

function round(v) {
  return Math.round(v * 100) / 100;
}

function fmt(v) {
  const r = round(v);
  return Number.isInteger(r) ? String(r) : String(r);
}

export default function ConfirmModal({
  title,
  hint,
  amount,
  confirmLabel,
  destructive,
  busy,
  onConfirm,
  onClose,
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(amount?.value ?? null);

  const close = React.useCallback(() => {
    if (busy) return;
    setOpen(false);
    setTimeout(onClose, 180);
  }, [busy, onClose]);

  useEffect(() => {
    const id = requestAnimationFrame(() => setOpen(true));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [close]);

  const handleBackdrop = (e) => {
    if (e.target === e.currentTarget) close();
  };

  const step = (dir) => {
    if (!amount) return;
    const next = round(value + dir * amount.step);
    const clamped = Math.max(amount.min, Math.min(amount.max, next));
    setValue(clamped);
  };

  const handleConfirm = async () => {
    try {
      await onConfirm(amount ? value : undefined);
    } finally {
      setOpen(false);
      setTimeout(onClose, 180);
    }
  };

  const canDec = amount ? round(value - amount.step) >= amount.min : false;
  const canInc = amount ? round(value + amount.step) <= amount.max : false;

  return (
    <>
      <div className={'cm-scrim' + (open ? ' on' : '')} onClick={handleBackdrop} />
      <div className={'cm-sheet' + (open ? ' on' : '')} role="dialog" aria-modal="true">
        <div className="cm-grab" aria-hidden="true" />
        <div className="cm-title">{title}</div>
        {amount && (
          <div className="cm-amt">
            <button
              type="button"
              className="cm-step"
              onClick={() => step(-1)}
              disabled={busy || !canDec}
              aria-label="Decrease"
            >
              −
            </button>
            <div className="cm-amt__value">
              <b>{fmt(value)}</b>
              <span>{amount.unit}</span>
            </div>
            <button
              type="button"
              className="cm-step"
              onClick={() => step(1)}
              disabled={busy || !canInc}
              aria-label="Increase"
            >
              +
            </button>
          </div>
        )}
        {hint && <p className="cm-hint">{hint}</p>}
        <div className="cm-actions">
          <button
            type="button"
            className="cm-btn cm-btn--cancel"
            onClick={close}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            type="button"
            className={'cm-btn cm-btn--primary' + (destructive ? ' cm-btn--danger' : '')}
            onClick={handleConfirm}
            disabled={busy}
          >
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </>
  );
}
