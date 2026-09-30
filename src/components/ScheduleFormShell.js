import React from 'react';
import DayPicker, { summarizeDays } from './DayPicker';

export default function ScheduleFormShell({
  name, onNameChange, nameMaxLength = 40,
  days, onDaysChange,
  busy, submitLabel, onSubmit, onCancel,
  children,
}) {
  return (
    <form className="automation-card__form" onSubmit={onSubmit}>
      <label className="automation-form__field">
        <span className="automation-form__label">Name</span>
        <input
          type="text"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          disabled={busy}
          maxLength={nameMaxLength}
        />
      </label>

      <div className="automation-form__row">{children}</div>

      <div className="automation-form__field">
        <span className="automation-form__label">Days ({summarizeDays(days)})</span>
        <DayPicker value={days} onChange={onDaysChange} disabled={busy} />
      </div>

      <div className="automation-card__actions">
        {onCancel && (
          <button
            type="button"
            className="feeder-secondary-button"
            onClick={onCancel}
            disabled={busy}
          >
            Cancel
          </button>
        )}
        <span className="automation-card__spacer" />
        <button
          type="submit"
          className="feeder-primary-button feeder-primary-button--sm"
          disabled={busy}
        >
          {busy ? 'Saving…' : submitLabel}
        </button>
      </div>
    </form>
  );
}
