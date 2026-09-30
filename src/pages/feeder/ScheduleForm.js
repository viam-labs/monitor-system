import React, { useState } from 'react';
import TimeSelect from '../../components/TimeSelect';
import DayPicker, { summarizeDays } from '../../components/DayPicker';
import CupsSelect from './CupsSelect';

export default function ScheduleForm({ initial, submitLabel, saving, onSave, onCancel }) {
  const [name, setName] = useState(initial.name || '');
  const [time, setTime] = useState(initial.time || '07:00');
  const [cups, setCups] = useState(initial.cups ?? 1);
  const [days, setDays] = useState(initial.days_of_week || []);

  const submit = (e) => {
    e.preventDefault();
    if (!time || !cups || cups <= 0) return;
    const payload = {
      time,
      cups,
      days_of_week: days,
      name: name.trim() || undefined,
    };
    if (initial.id) payload.id = initial.id;
    onSave(payload);
  };

  return (
    <form className="automation-card__form" onSubmit={submit}>
      <label className="automation-form__field">
        <span className="automation-form__label">Name</span>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          disabled={saving}
          placeholder={`Feed ${time}`}
          maxLength={40}
        />
      </label>

      <div className="automation-form__row">
        <label className="automation-form__field">
          <span className="automation-form__label">Time</span>
          <TimeSelect value={time} onChange={setTime} disabled={saving} />
        </label>
        <label className="automation-form__field">
          <span className="automation-form__label">Amount</span>
          <CupsSelect value={cups} onChange={setCups} disabled={saving} ariaLabel="Cups" />
        </label>
      </div>

      <div className="automation-form__field">
        <span className="automation-form__label">Days ({summarizeDays(days)})</span>
        <DayPicker value={days} onChange={setDays} disabled={saving} />
      </div>

      <div className="automation-card__actions">
        {onCancel && (
          <button type="button" className="feeder-secondary-button" onClick={onCancel} disabled={saving}>
            Cancel
          </button>
        )}
        <span className="automation-card__spacer" />
        <button type="submit" className="feeder-primary-button feeder-primary-button--sm" disabled={saving}>
          {saving ? 'Saving…' : submitLabel}
        </button>
      </div>
    </form>
  );
}
