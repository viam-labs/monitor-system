import React, { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useThermostat } from '../hooks/useThermostat';
import { useThermostatController } from '../hooks/useThermostatController';
import Toggle from '../components/Toggle';
import TimeSelect from '../components/TimeSelect';

function celsiusToF(c) {
  if (c == null || Number.isNaN(c)) return null;
  return (c * 9) / 5 + 32;
}

function fToC(f) {
  if (f == null || Number.isNaN(f)) return null;
  return ((f - 32) * 5) / 9;
}

function formatTime(input) {
  if (input == null) return null;
  const ms = typeof input === 'string' ? Date.parse(input) : input;
  if (Number.isNaN(ms)) return null;
  return new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function formatClock(hhmm) {
  if (!hhmm) return '';
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

// Common house-temperature range in Fahrenheit — covers cooling
// setpoints (65-85), heating setpoints (55-75), and everything in
// between. Rendered as a dropdown instead of a number spinner for
// consistent dark styling.
const TEMP_OPTIONS_F = (() => {
  const out = [];
  for (let f = 55; f <= 95; f++) out.push(f);
  return out;
})();

function pickTemperature(readings) {
  if (!readings) return null;
  for (const key of ['temperature', 'temperature_c', 'tempC', 'temp']) {
    const v = readings[key];
    if (typeof v === 'number' && !Number.isNaN(v)) return v;
  }
  return null;
}

function pickHumidity(readings) {
  if (!readings) return null;
  for (const key of ['humidity', 'relative_humidity', 'humidity_pct']) {
    const v = readings[key];
    if (typeof v === 'number' && !Number.isNaN(v)) return v;
  }
  return null;
}

function pickBattery(readings) {
  if (!readings) return null;
  for (const key of ['battery_pct', 'battery', 'batteryLevel']) {
    const v = readings[key];
    if (typeof v === 'number' && !Number.isNaN(v)) return v;
  }
  return null;
}

const LOW_BATTERY_THRESHOLD = 20;

function AutomationCard({
  automation,
  isActive,
  isFirst,
  isLast,
  busy,
  onToggle,
  onSave,
  onDelete,
  onMoveUp,
  onMoveDown,
}) {
  const [expanded, setExpanded] = useState(false);
  const onF = Math.round(celsiusToF(automation.on_temp_c));
  const offF = Math.round(celsiusToF(automation.off_temp_c));

  const [name, setName] = useState(automation.name);
  const [onInput, setOnInput] = useState(String(onF));
  const [offInput, setOffInput] = useState(String(offF));
  const [startInput, setStartInput] = useState(automation.active_start || '');
  const [endInput, setEndInput] = useState(automation.active_end || '');

  useEffect(() => setName(automation.name), [automation.name]);
  useEffect(() => setOnInput(String(onF)), [onF]);
  useEffect(() => setOffInput(String(offF)), [offF]);
  useEffect(() => setStartInput(automation.active_start || ''), [automation.active_start]);
  useEffect(() => setEndInput(automation.active_end || ''), [automation.active_end]);

  const dirty =
    name !== automation.name ||
    onInput !== String(onF) ||
    offInput !== String(offF) ||
    (startInput || '') !== (automation.active_start || '') ||
    (endInput || '') !== (automation.active_end || '');

  const modeText = automation.mode === 'cooling' ? 'Cooling' : 'Heating';
  const hoursText = automation.active_start && automation.active_end
    ? `${formatClock(automation.active_start)}–${formatClock(automation.active_end)}`
    : 'always';
  const summary = `${modeText} · on ${onF}° / off ${offF}° · ${hoursText}`;

  const submit = (e) => {
    e.preventDefault();
    const onFVal = Number(onInput);
    const offFVal = Number(offInput);
    if (!Number.isFinite(onFVal) || !Number.isFinite(offFVal) || onFVal === offFVal) return;
    const start = startInput || null;
    const end = endInput || null;
    if ((start === null) !== (end === null)) return;
    const trimmedName = name.trim() || automation.name;
    onSave({
      id: automation.id,
      name: trimmedName,
      on_temp_c: fToC(onFVal),
      off_temp_c: fToC(offFVal),
      active_start: start,
      active_end: end,
    });
  };

  const previewMode = (() => {
    const onN = Number(onInput);
    const offN = Number(offInput);
    if (!Number.isFinite(onN) || !Number.isFinite(offN) || onN === offN) return null;
    return onN > offN ? 'Cooling' : 'Heating';
  })();

  return (
    <div className={'automation-card' + (isActive ? ' automation-card--active' : '')}>
      <div className="automation-card__header">
        <button
          type="button"
          className="automation-card__disclose"
          onClick={() => setExpanded(v => !v)}
          aria-expanded={expanded}
        >
          <span className={'automation-card__chevron' + (expanded ? ' automation-card__chevron--open' : '')}>›</span>
          <span className="automation-card__name">{automation.name}</span>
          {isActive && <span className="automation-card__badge">active</span>}
        </button>
        <Toggle
          checked={automation.enabled}
          onChange={(v) => onToggle(automation.id, v)}
          disabled={busy}
          ariaLabel={`Enable ${automation.name}`}
        />
      </div>

      <div className="automation-card__summary">{summary}</div>

      {expanded && (
        <form className="automation-card__form" onSubmit={submit}>
          <label className="automation-form__field">
            <span className="automation-form__label">Name</span>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              disabled={busy}
              maxLength={40}
            />
          </label>

          <div className="automation-form__section-title">Thresholds</div>
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
          {previewMode && previewMode !== modeText && (
            <p className="feeder-meta">Would be: <strong>{previewMode}</strong></p>
          )}

          <div className="automation-form__section-title">Active hours</div>
          <div className="automation-form__row">
            <label className="automation-form__field">
              <span className="automation-form__label">From</span>
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
          <p className="feeder-meta">
            {(!startInput && !endInput)
              ? 'Always active (both blank).'
              : 'Blank both to always be active.'}
          </p>

          <div className="automation-card__actions">
            <button
              type="button"
              className="feeder-icon-button"
              onClick={() => onMoveUp(automation.id)}
              disabled={busy || isFirst}
              aria-label="Move up"
              title="Move up (higher precedence)"
            >
              ↑
            </button>
            <button
              type="button"
              className="feeder-icon-button"
              onClick={() => onMoveDown(automation.id)}
              disabled={busy || isLast}
              aria-label="Move down"
              title="Move down"
            >
              ↓
            </button>
            <button
              type="button"
              className="feeder-icon-button feeder-icon-button--danger"
              onClick={() => onDelete(automation.id)}
              disabled={busy}
              aria-label="Delete automation"
              title="Delete"
            >
              ✕
            </button>
            <span className="automation-card__spacer" />
            <button
              type="submit"
              className="feeder-primary-button feeder-primary-button--sm"
              disabled={busy || !dirty}
            >
              {busy ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function AddAutomationForm({ busy, onAdd, onCancel }) {
  const [name, setName] = useState('Automation');
  const [onInput, setOnInput] = useState('78');
  const [offInput, setOffInput] = useState('74');
  const [startInput, setStartInput] = useState('');
  const [endInput, setEndInput] = useState('');

  const submit = (e) => {
    e.preventDefault();
    const onFVal = Number(onInput);
    const offFVal = Number(offInput);
    if (!Number.isFinite(onFVal) || !Number.isFinite(offFVal) || onFVal === offFVal) return;
    if ((startInput === '') !== (endInput === '')) return;
    onAdd({
      name: name.trim() || 'Automation',
      on_temp_c: fToC(onFVal),
      off_temp_c: fToC(offFVal),
      active_start: startInput || null,
      active_end: endInput || null,
      enabled: true,
    });
  };

  return (
    <form className="automation-card automation-card--add" onSubmit={submit}>
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

export default function ThermostatPage() {
  const { client, acBotName, roomMeterName, thermostatName, loading: connectionLoading, detectingFeatures } = useOutletContext();
  const t = useThermostat(client, acBotName, roomMeterName);
  const ctrl = useThermostatController(client, thermostatName);
  const { position, readings, loading, error, busy, lastSetAt, lastSetPosition } = t;
  const [addOpen, setAddOpen] = useState(false);

  if (connectionLoading || detectingFeatures) {
    return (
      <div className="paw-loader" aria-label="Connecting">
        <span>🐾</span>
        <span>🐾</span>
        <span>🐾</span>
      </div>
    );
  }

  if (!acBotName || !roomMeterName) {
    return (
      <div className="stub-page">
        <h1>Thermostat</h1>
        <p>Needs a SwitchBot switch and a SwitchBot sensor (meter) configured on this machine.</p>
      </div>
    );
  }

  const tempC = pickTemperature(readings);
  const tempF = celsiusToF(tempC);
  const humidity = pickHumidity(readings);
  const battery = pickBattery(readings);
  const batteryLow = battery != null && battery <= LOW_BATTERY_THRESHOLD;
  const on = position === 1;
  const combinedError = error || ctrl.error;

  const automations = ctrl.status?.automations || [];
  const activeId = ctrl.status?.active_id || null;
  const activeAutomation = automations.find(a => a.id === activeId) || null;

  const handleSaveAutomation = async (payload) => {
    try {
      await ctrl.updateAutomation(payload);
    } catch {
      // surfaced
    }
  };

  const handleAddAutomation = async (payload) => {
    try {
      await ctrl.addAutomation(payload);
      setAddOpen(false);
    } catch {
      // stay open
    }
  };

  const handleDeleteAutomation = async (id) => {
    if (!window.confirm('Delete this automation?')) return;
    try {
      await ctrl.deleteAutomation(id);
    } catch {
      // surfaced
    }
  };

  const handleMove = (id, direction) => {
    const idx = automations.findIndex(a => a.id === id);
    if (idx < 0) return;
    const swapWith = direction === 'up' ? idx - 1 : idx + 1;
    if (swapWith < 0 || swapWith >= automations.length) return;
    const nextIds = automations.map(a => a.id);
    [nextIds[idx], nextIds[swapWith]] = [nextIds[swapWith], nextIds[idx]];
    ctrl.reorderAutomations(nextIds).catch(() => {});
  };

  const refreshBoth = () => {
    t.refresh();
    ctrl.refresh();
  };

  return (
    <div className="feeder-page">
      {combinedError && <p className="feeder-error feeder-error--banner">{combinedError}</p>}

      <section className="feeder-card thermostat-readings">
        <button
          type="button"
          className="feeder-icon-button thermostat-readings__refresh"
          onClick={refreshBoth}
          disabled={loading || busy || ctrl.busy}
          aria-label="Refresh"
          title="Refresh"
        >
          ↻
        </button>
        <div className="thermostat-temp">
          <span className="thermostat-temp__value">
            {tempF != null ? Math.round(tempF) : '—'}
          </span>
          <span className="thermostat-temp__unit">°F</span>
        </div>
        {(humidity != null || battery != null) && (
          <div className="thermostat-secondary">
            {humidity != null && (
              <span className="thermostat-secondary__item">
                {Math.round(humidity)}% humidity
              </span>
            )}
            {battery != null && (
              <span
                className={
                  'thermostat-secondary__item battery-pill' +
                  (batteryLow ? ' battery-pill--low' : '')
                }
                title={batteryLow ? 'Meter battery is low — charge soon.' : undefined}
              >
                {batteryLow && <span aria-hidden="true">⚠</span>}
                {Math.round(battery)}% battery
              </span>
            )}
          </div>
        )}
      </section>

      <section className="feeder-card">
        <div className="feeder-card__header">
          <h2 className="feeder-card__title">Bot</h2>
          <Toggle
            checked={on}
            onChange={(v) => t.setAcOn(v)}
            disabled={busy}
            label={on ? 'On' : 'Off'}
          />
        </div>
        {lastSetAt && (
          <p className="feeder-meta feeder-meta--centered">
            Last set {lastSetPosition === 1 ? 'ON' : lastSetPosition === 0 ? 'OFF' : ''}{' '}
            at {formatTime(lastSetAt)}.
          </p>
        )}
        <p className="feeder-meta feeder-meta--centered">
          Commanded state — reflects what Viam last told the Bot to press,
          not what the appliance is actually doing. Whether "on" means A/C
          or heat depends on the mode the physical remote is in.
        </p>
      </section>

      {thermostatName && ctrl.status && (
        <section className="feeder-card">
          <div className="feeder-card__header">
            <h2 className="feeder-card__title">Automations</h2>
            {activeAutomation && (
              <span className="feeder-meta">
                Active: <strong>{activeAutomation.name}</strong>
              </span>
            )}
          </div>

          {automations.length === 0 && !addOpen && (
            <p className="feeder-meta">No automations yet.</p>
          )}

          {automations.map((auto, i) => (
            <AutomationCard
              key={auto.id}
              automation={auto}
              isActive={auto.id === activeId}
              isFirst={i === 0}
              isLast={i === automations.length - 1}
              busy={ctrl.busy}
              onToggle={ctrl.setAutomationEnabled}
              onSave={handleSaveAutomation}
              onDelete={handleDeleteAutomation}
              onMoveUp={(id) => handleMove(id, 'up')}
              onMoveDown={(id) => handleMove(id, 'down')}
            />
          ))}

          {addOpen ? (
            <AddAutomationForm
              busy={ctrl.busy}
              onAdd={handleAddAutomation}
              onCancel={() => setAddOpen(false)}
            />
          ) : (
            <button
              type="button"
              className="feeder-secondary-button feeder-secondary-button--full"
              onClick={() => setAddOpen(true)}
              disabled={ctrl.busy}
            >
              + Add automation
            </button>
          )}

          {ctrl.status.last_action_at && (
            <p className="feeder-meta automation-last-action">
              Automation last acted at {formatTime(ctrl.status.last_action_at)}
              {ctrl.status.last_action_position === 1
                ? ' (on)'
                : ctrl.status.last_action_position === 0
                  ? ' (off)'
                  : ''}
              .
            </p>
          )}
        </section>
      )}
    </div>
  );
}
