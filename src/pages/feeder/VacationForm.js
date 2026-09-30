import React, { useState } from 'react';
import { nowLocalDatetimeInput } from './helpers';

export default function VacationForm({ saving, onSubmit, onCancel }) {
  const [until, setUntil] = useState('');
  const submit = (e) => {
    e.preventDefault();
    if (!until) return;
    onSubmit(until);
  };
  return (
    <form className="vacation-form" onSubmit={submit}>
      <label className="vacation-form__field">
        <span className="vacation-form__label">Pause until</span>
        <input
          type="datetime-local"
          value={until}
          min={nowLocalDatetimeInput()}
          onChange={e => setUntil(e.target.value)}
          required
        />
      </label>
      <div className="vacation-form__actions">
        <button type="button" className="feeder-secondary-button" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
        <button
          type="submit"
          className="feeder-primary-button feeder-primary-button--sm"
          disabled={saving || !until}
        >
          {saving ? 'Pausing…' : 'Pause until this'}
        </button>
      </div>
    </form>
  );
}
