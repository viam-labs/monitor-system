import React, { useEffect, useState } from 'react';

export default function ConfirmModal({
  title,
  body,
  picker,
  confirmLabel,
  destructive,
  busy,
  onConfirm,
  onClose,
}) {
  const [value, setValue] = useState(picker?.defaultValue);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleBackdrop = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  const label = typeof confirmLabel === 'function' ? confirmLabel(value) : confirmLabel;

  const handleConfirm = async () => {
    try {
      await onConfirm(value);
    } finally {
      onClose();
    }
  };

  return (
    <div className="cm-backdrop" onClick={handleBackdrop} role="dialog" aria-modal="true">
      <div className="cm-card">
        <h2 className="cm-title">{title}</h2>
        {body && <p className="cm-body">{body}</p>}
        {picker && (
          <select
            className="cm-picker"
            value={value ?? ''}
            onChange={(e) => setValue(Number(e.target.value))}
            disabled={busy}
          >
            {picker.options.map((opt) => (
              <option key={opt} value={opt}>
                {opt}{picker.unit ? ` ${picker.unit}` : ''}
              </option>
            ))}
          </select>
        )}
        <div className="cm-actions">
          <button
            type="button"
            className="cm-btn cm-btn--cancel"
            onClick={onClose}
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
            {busy ? 'Working…' : label}
          </button>
        </div>
      </div>
    </div>
  );
}
