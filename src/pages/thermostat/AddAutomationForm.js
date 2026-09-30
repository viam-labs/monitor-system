import React, { useState } from 'react';
import AddHysteresisFormBody from './AddHysteresisFormBody';
import AddScheduledFormBody from './AddScheduledFormBody';

export default function AddAutomationForm({ busy, existing, onAdd, onCancel }) {
  const [kind, setKind] = useState('hysteresis');
  return (
    <div className="automation-card automation-card--add">
      <div className="automation-form__row">
        <label className="automation-form__field">
          <span className="automation-form__label">Type</span>
          <select
            className="cups-select"
            value={kind}
            onChange={e => setKind(e.target.value)}
            disabled={busy}
          >
            <option value="hysteresis">Temperature (hysteresis)</option>
            <option value="scheduled">Scheduled on/off</option>
          </select>
        </label>
      </div>
      {kind === 'hysteresis'
        ? <AddHysteresisFormBody busy={busy} onAdd={onAdd} onCancel={onCancel} />
        : <AddScheduledFormBody busy={busy} existing={existing} onAdd={onAdd} onCancel={onCancel} />}
    </div>
  );
}
