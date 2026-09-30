import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import Toggle from '../../components/Toggle';
import { formatTime } from '../../lib/format';
import AutomationCard from './AutomationCard';
import AddAutomationForm from './AddAutomationForm';
import {
  LOW_BATTERY_THRESHOLD,
  celsiusToF,
  pickBattery,
  pickHumidity,
  pickTemperature,
} from './helpers';

export default function ThermostatPage() {
  const {
    acBotName, roomMeterName, thermostatName,
    loading: connectionLoading, detectingFeatures, pendingProbes,
    thermostat: t, thermostatController: ctrl,
  } = useOutletContext();
  const thermostatStillProbing =
    !!acBotName && !roomMeterName && pendingProbes && pendingProbes.sensor > 0;
  const { position, readings, loading, error, busy } = t;
  const [addOpen, setAddOpen] = useState(false);

  if (connectionLoading || detectingFeatures || thermostatStillProbing) {
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
          <h2 className="feeder-card__title">Thermostat {on ? 'On' : 'Off'}</h2>
          <Toggle
            checked={on}
            onChange={(v) => t.setAcOn(v)}
            disabled={busy}
            ariaLabel={on ? 'Turn thermostat off' : 'Turn thermostat on'}
          />
        </div>
      </section>

      {thermostatName && ctrl.status && (
        <section className="feeder-card">
          <div className="feeder-card__header">
            <h2 className="feeder-card__title">Automations</h2>
          </div>

          {automations.length === 0 && !addOpen && (
            <p className="feeder-meta">No automations yet.</p>
          )}

          {automations.map((auto, i) => (
            <AutomationCard
              key={auto.id}
              automation={auto}
              allAutomations={automations}
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
              existing={automations}
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
