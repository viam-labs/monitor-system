import React, { useState } from 'react';
import TimeSelect from '../../components/TimeSelect';
import DayPicker, { summarizeDays } from '../../components/DayPicker';
import { fToC, TEMP_OPTIONS_F } from './helpers';

export default function AddHysteresisFormBody({ busy, onAdd, onCancel }) {
  const [name, setName] = useState('Automation');
  const [onInput, setOnInput] = useState('78');
  const [offInput, setOffInput] = useState('74');
  const [startInput, setStartInput] = useState('');
  const [endInput, setEndInput] = useState('');
  const [days, setDays] = useState([]);

  const submit = (e) => {
    e.preventDefault();
    const onFVal = Number(onInput);
    const offFVal = Number(offInput);
    if (!Number.isFinite(onFVal) || !Number.isFinite(offFVal) || onFVal === offFVal) return;
    if ((startInput === '') !== (endInput === '')) return;
    onAdd({
      name: name.trim() || 'Automation',
      kind: 'hysteresis',
      on_temp_c: fToC(onFVal),
      off_temp_c: fToC(offFVal),
      active_start: startInput || null,
      active_end: endInput || null,
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
          <span className="automation-form__label">Turn on at</span>
          <select
            className="cups-select"
            value={onInput}
            onChange={e => setOnInput(e.target.value)}
            disabled={busy}
          >
            {TEMP_OPTIONS_F.map(f => (
              <option key={f} value={f}>{f}°F</option>
            ))}
          </select>
        </label>
        <label className="automation-form__field">
          <span className="automation-form__label">Turn off at</span>
          <select
            className="cups-select"
            value={offInput}
            onChange={e => setOffInput(e.target.value)}
            disabled={busy}
          >
            {TEMP_OPTIONS_F.map(f => (
              <option key={f} value={f}>{f}°F</option>
            ))}
          </select>
        </label>
      </div>

      <div className="automation-form__row">
        <label className="automation-form__field">
          <span className="automation-form__label">Active from</span>
          <TimeSelect
            value={startInput}
            onChange={setStartInput}
            disabled={busy}
            allowBlank
            blankLabel="Always"
          />
        </label>
        <label className="automation-form__field">
          <span className="automation-form__label">Until</span>
          <TimeSelect
            value={endInput}
            onChange={setEndInput}
            disabled={busy}
            allowBlank
            blankLabel="Always"
          />
        </label>
      </div>

      <div className="automation-form__field">
        <span className="automation-form__label">Days ({summarizeDays(days)})</span>
        <DayPicker value={days} onChange={setDays} disabled={busy} />
      </div>

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
          disabled={busy}
        >
          {busy ? 'Adding…' : 'Add'}
        </button>
      </div>
    </form>
  );
}
