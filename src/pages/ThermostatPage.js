import React from 'react';
import { useOutletContext } from 'react-router-dom';
import { useThermostat } from '../hooks/useThermostat';

function celsiusToF(c) {
  if (c == null || Number.isNaN(c)) return null;
  return (c * 9) / 5 + 32;
}

function formatTime(ms) {
  if (ms == null) return null;
  return new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function pickTemperature(readings) {
  if (!readings) return null;
  // SwitchBot meter is celsius; keys vary across firmware / hub setups.
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

export default function ThermostatPage() {
  const { client, acBotName, roomMeterName, loading: connectionLoading } = useOutletContext();
  const t = useThermostat(client, acBotName, roomMeterName);
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
          Needs a SwitchBot switch named <code>ac_bot</code> and a SwitchBot
          sensor named <code>room_meter</code> on this machine.
        </p>
      </div>
    );
  }

  const tempC = pickTemperature(readings);
  const tempF = celsiusToF(tempC);
  const humidity = pickHumidity(readings);
  const on = position === 1;
  const off = position === 0;

  return (
    <div className="feeder-page">
      <div className="feeder-topbar">
        <span className="feeder-meta">
          {loading && !readings ? 'Loading…' : 'Room meter'}
        </span>
        <div className="feeder-topbar__actions">
          <button
            type="button"
            className="feeder-icon-button"
            onClick={t.refresh}
            disabled={loading || busy}
            aria-label="Refresh"
            title="Refresh"
          >
            ↻
          </button>
        </div>
      </div>

      {error && <p className="feeder-error feeder-error--banner">{error}</p>}

      <section className="feeder-card thermostat-readings">
        <div className="thermostat-temp">
          <span className="thermostat-temp__value">
            {tempF != null ? Math.round(tempF) : '—'}
          </span>
          <span className="thermostat-temp__unit">°F</span>
        </div>
        <div className="thermostat-secondary">
          {tempC != null && (
            <span className="thermostat-secondary__item">
              {tempC.toFixed(1)}°C
            </span>
          )}
          {humidity != null && (
            <span className="thermostat-secondary__item">
              {Math.round(humidity)}% humidity
            </span>
          )}
        </div>
      </section>

      <section className="feeder-card">
        <div className="feeder-card__header">
          <h2 className="feeder-card__title">Air conditioner</h2>
          <span className={
            'thermostat-state' +
            (on ? ' thermostat-state--on' : off ? ' thermostat-state--off' : '')
          }>
            {on ? 'ON' : off ? 'OFF' : 'unknown'}
          </span>
        </div>

        <div className="thermostat-controls">
          <button
            type="button"
            className={
              'thermostat-power' +
              (on ? ' thermostat-power--on' : '')
            }
            onClick={() => t.setAcOn(!on)}
            disabled={busy || position == null}
          >
            {busy ? 'Sending…' : on ? 'Turn OFF' : 'Turn ON'}
          </button>
        </div>

        {lastActionAt && (
          <p className="feeder-meta feeder-meta--centered">
            Last set at {formatTime(lastActionAt)} from this device.
          </p>
        )}
        <p className="feeder-meta feeder-meta--centered">
          Commanded state — reflects what Viam last told the Bot to press,
          not whether the A/C is actually running.
        </p>
      </section>
    </div>
  );
}
