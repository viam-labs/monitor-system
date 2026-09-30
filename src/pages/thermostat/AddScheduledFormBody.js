import React, { useState } from 'react';
import TimeSelect from '../../components/TimeSelect';
import DayPicker, { summarizeDays } from '../../components/DayPicker';
import { findScheduledConflict } from './helpers';

export default function AddScheduledFormBody({ busy, existing, onAdd, onCancel }) {
  const [name, setName] = useState('Scheduled');
  const [action, setAction] = useState('off');
  const [time, setTime] = useState('07:00');
  const [days, setDays] = useState([]);

  const conflict = findScheduledConflict(
    { time, action, days_of_week: days },
    existing,
    null,
  );

  const submit = (e) => {
    e.preventDefault();
    if (conflict?.level === 'block') return;
    onAdd({
      name: name.trim() || 'Scheduled',
      kind: 'scheduled',
      action,
      time,
      days_of_week: days,
      enabled: true,
    });
  };

  return (
    <form className="automation-card__form" onSubmit={submit}>
      <label className="automation-form__field">
        <span className="automation-form__label">Name</span>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          disabled={busy}
          maxLength={40}
          autoFocus
        />
      </label>

      <div className="automation-form__row">
        <label className="automation-form__field">
          <span className="automation-form__label">Action</span>
          <select
            className="cups-select"
            value={action}
            onChange={e => setAction(e.target.value)}
            disabled={busy}
          >
            <option value="on">Turn ON</option>
            <option value="off">Turn OFF</option>
          </select>
        </label>
        <label className="automation-form__field">
          <span className="automation-form__label">Time</span>
          <TimeSelect value={time} onChange={setTime} disabled={busy} />
        </label>
      </div>

      <div className="automation-form__field">
        <span className="automation-form__label">Days ({summarizeDays(days)})</span>
        <DayPicker value={days} onChange={setDays} disabled={busy} />
      </div>

      {conflict && (
        <p className={
          conflict.level === 'block'
            ? 'feeder-error feeder-error--banner'
            : 'feeder-meta'
        }>
          {conflict.level === 'block'
            ? `Conflicts with "${conflict.other.name}" — same time, opposite action.`
            : `Same time and action as "${conflict.other.name}"; second entry is redundant.`}
        </p>
      )}

      <div className="automation-card__actions">
        <button
          type="button"
          className="feeder-secondary-button"
          onClick={onCancel}
          disabled={busy}
        >
          Cancel
        </button>
        <span className="automation-card__spacer" />
        <button
          type="submit"
          className="feeder-primary-button feeder-primary-button--sm"
          disabled={busy || conflict?.level === 'block'}
        >
          {busy ? 'Adding…' : 'Add'}
        </button>
      </div>
    </form>
  );
}
