import React, { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useThermostat } from '../hooks/useThermostat';
import { useThermostatController } from '../hooks/useThermostatController';

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

function AutomationCard({ status, busy, onEnable, onSaveThresholds, onSaveHours }) {
  // Threshold form (°F in the UI, converted to °C when saving)
  const onF = status.on_temp_c != null ? Math.round(celsiusToF(status.on_temp_c)) : 75;
  const offF = status.off_temp_c != null ? Math.round(celsiusToF(status.off_temp_c)) : 72;
  const [onInput, setOnInput] = useState(String(onF));
  const [offInput, setOffInput] = useState(String(offF));

  useEffect(() => {
    setOnInput(String(onF));
    setOffInput(String(offF));
    // Sync when server-side values change (e.g., another device saved).
  }, [onF, offF]);

  const [startInput, setStartInput] = useState(status.active_start || '');
  const [endInput, setEndInput] = useState(status.active_end || '');

  useEffect(() => {
    setStartInput(status.active_start || '');
    setEndInput(status.active_end || '');
  }, [status.active_start, status.active_end]);

  const thresholdsDirty =
    onInput !== String(onF) || offInput !== String(offF);
  const hoursDirty =
    (startInput || '') !== (status.active_start || '') ||
    (endInput || '') !== (status.active_end || '');

  const submitThresholds = async (e) => {
    e.preventDefault();
    const onFVal = Number(onInput);
    const offFVal = Number(offInput);
    if (!Number.isFinite(onFVal) || !Number.isFinite(offFVal) || onFVal === offFVal) return;
    try {
      await onSaveThresholds(fToC(onFVal), fToC(offFVal));
    } catch {
      // Error surfaced by hook.
    }
  };

  const submitHours = async (e) => {
    e.preventDefault();
    // Both empty = always active.
    const start = startInput || '';
    const end = endInput || '';
    if ((start === '') !== (end === '')) return;
    try {
      await onSaveHours(start || null, end || null);
    } catch {
      // Error surfaced by hook.
    }
  };

  const previewMode = (() => {
    const onN = Number(onInput);
    const offN = Number(offInput);
    if (!Number.isFinite(onN) || !Number.isFinite(offN) || onN === offN) return null;
    return onN > offN ? 'Cooling' : 'Heating';
  })();
  const activeMode = status.mode === 'cooling' ? 'Cooling' : status.mode === 'heating' ? 'Heating' : null;

  return (
    <section className="feeder-card">
      <div className="feeder-card__header">
        <h2 className="feeder-card__title">Automation</h2>
        <label className="automation-toggle">
          <input
            type="checkbox"
            checked={!!status.enabled}
            onChange={e => onEnable(e.target.checked)}
            disabled={busy}
          />
          <span>{status.enabled ? 'On' : 'Off'}</span>
        </label>
      </div>

      {activeMode && (
        <p className="feeder-meta">
          Mode: <strong>{activeMode}</strong>
          {status.within_active_window === false && ' · outside active hours'}
        </p>
      )}

      <form className="automation-form" onSubmit={submitThresholds}>
        <div className="automation-form__row">
          <label className="automation-form__field">
            <span className="automation-form__label">Turn on at</span>
            <div className="automation-form__input-with-unit">
              <input
                type="number"
                inputMode="numeric"
                value={onInput}
                onChange={e => setOnInput(e.target.value)}
                disabled={busy}
                required
              />
              <span>°F</span>
            </div>
          </label>
          <label className="automation-form__field">
            <span className="automation-form__label">Turn off at</span>
            <div className="automation-form__input-with-unit">
              <input
                type="number"
                inputMode="numeric"
                value={offInput}
                onChange={e => setOffInput(e.target.value)}
                disabled={busy}
                required
              />
              <span>°F</span>
            </div>
          </label>
        </div>
        <div className="automation-form__footer">
          {previewMode && (
            <span className="feeder-meta">Would be: <strong>{previewMode}</strong></span>
          )}
          <button
            type="submit"
            className="feeder-primary-button feeder-primary-button--sm"
            disabled={busy || !thresholdsDirty}
          >
            {busy ? 'Saving…' : 'Save thresholds'}
          </button>
        </div>
      </form>

      <form className="automation-form" onSubmit={submitHours}>
        <div className="automation-form__row">
          <label className="automation-form__field">
            <span className="automation-form__label">Active from</span>
            <input
              type="time"
              value={startInput}
              onChange={e => setStartInput(e.target.value)}
              disabled={busy}
            />
          </label>
          <label className="automation-form__field">
            <span className="automation-form__label">Until</span>
            <input
              type="time"
              value={endInput}
              onChange={e => setEndInput(e.target.value)}
              disabled={busy}
            />
          </label>
        </div>
        <div className="automation-form__footer">
          <span className="feeder-meta">
            {(!startInput && !endInput) ? 'Always active (both blank).' : 'Blank both to always be active.'}
          </span>
          <button
            type="submit"
            className="feeder-primary-button feeder-primary-button--sm"
            disabled={busy || !hoursDirty}
          >
            {busy ? 'Saving…' : 'Save hours'}
          </button>
        </div>
      </form>

      {status.last_action_at && (
        <p className="feeder-meta">
          Automation last acted at {formatTime(status.last_action_at)}
          {status.last_action_position === 1 ? ' (on)' : status.last_action_position === 0 ? ' (off)' : ''}.
        </p>
      )}
    </section>
  );
}

export default function ThermostatPage() {
  const { client, acBotName, roomMeterName, thermostatName, loading: connectionLoading } = useOutletContext();
  const t = useThermostat(client, acBotName, roomMeterName);
  const ctrl = useThermostatController(client, thermostatName);
  const { position, readings, loading, error, busy, lastActionAt } = t;

  if (connectionLoading) {
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
        <p>
          Needs a SwitchBot switch and a SwitchBot sensor (meter) configured
          on this machine.
        </p>
      </div>
    );
  }

  const tempC = pickTemperature(readings);
  const tempF = celsiusToF(tempC);
  const humidity = pickHumidity(readings);
  const on = position === 1;
  const off = position === 0;
  const combinedError = error || ctrl.error;

  return (
    <div className="feeder-page">
      <div className="feeder-topbar">
        <span className="feeder-meta">
          {loading && !readings ? 'Loading…' : ''}
        </span>
        <div className="feeder-topbar__actions">
          <button
            type="button"
            className="feeder-icon-button"
            onClick={() => { t.refresh(); ctrl.refresh(); }}
            disabled={loading || busy || ctrl.busy}
            aria-label="Refresh"
            title="Refresh"
          >
            ↻
          </button>
        </div>
      </div>

      {combinedError && <p className="feeder-error feeder-error--banner">{combinedError}</p>}

      <section className="feeder-card thermostat-readings">
        <div className="thermostat-temp">
          <span className="thermostat-temp__value">
            {tempF != null ? Math.round(tempF) : '—'}
          </span>
          <span className="thermostat-temp__unit">°F</span>
        </div>
        {humidity != null && (
          <div className="thermostat-secondary">
            <span className="thermostat-secondary__item">
              {Math.round(humidity)}% humidity
            </span>
          </div>
        )}
      </section>

      <section className="feeder-card">
        <div className="feeder-card__header">
          <h2 className="feeder-card__title">Bot</h2>
          <span className={
            'thermostat-state' +
            (on ? ' thermostat-state--on' : off ? ' thermostat-state--off' : '')
          }>
            {on ? 'ON' : off ? 'OFF' : 'unknown'}
          </span>
        </div>

        <div className="thermostat-buttons">
          <button
            type="button"
            className={
              'thermostat-button' +
              (on ? ' thermostat-button--active' : '')
            }
            onClick={() => t.setAcOn(true)}
            disabled={busy}
          >
            {busy && position !== 1 ? 'Sending…' : 'On'}
          </button>
          <button
            type="button"
            className={
              'thermostat-button' +
              (off ? ' thermostat-button--active' : '')
            }
            onClick={() => t.setAcOn(false)}
            disabled={busy}
          >
            {busy && position !== 0 ? 'Sending…' : 'Off'}
          </button>
        </div>

        {lastActionAt && (
          <p className="feeder-meta feeder-meta--centered">
            Last set at {formatTime(lastActionAt)} from this device.
          </p>
        )}
        <p className="feeder-meta feeder-meta--centered">
          Commanded state — reflects what Viam last told the Bot to press,
          not what the appliance is actually doing. Whether "on" means A/C
          or heat depends on the mode the physical remote is in.
        </p>
      </section>

      {thermostatName && ctrl.status && (
        <AutomationCard
          status={ctrl.status}
          busy={ctrl.busy}
          onEnable={ctrl.setEnabled}
          onSaveThresholds={ctrl.setThresholds}
          onSaveHours={ctrl.setActiveHours}
        />
      )}
    </div>
  );
}
