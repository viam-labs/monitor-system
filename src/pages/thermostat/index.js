import React, { useState } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import TopNav from '../../components/TopNav';
import BottomTabBar from '../../components/BottomTabBar';
import { useMediaQuery } from '../../hooks/useMediaQuery';
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
import './Thermostat.css';

export default function ThermostatPage() {
  const ctx = useOutletContext();
  const navigate = useNavigate();
  const mobile = useMediaQuery('(max-width: 700px)');
  const {
    acBotName, roomMeterName, thermostatName,
    loading: connectionLoading, detectingFeatures, pendingProbes,
    thermostat: t, thermostatController: ctrl,
  } = ctx;
  const thermostatStillProbing =
    !!acBotName && !roomMeterName && pendingProbes && pendingProbes.sensor > 0;
  const { position, readings, error, busy } = t;
  const [addOpen, setAddOpen] = useState(false);

  const availability = {
    '/feeder': !!ctx.feederName,
    '/waterer': !!ctx.watererName,
    '/thermostat': !!(ctx.acBotName && ctx.roomMeterName),
    '/curtain': !!ctx.curtainName,
    '/inventory': !!(ctx.inventoryName && ctx.inventoryStateSensorName),
    '/bark': !!ctx.barkName,
    '/air': !!ctx.airName,
    '/door': !!ctx.doorUnlockName,
  };

  if (connectionLoading || detectingFeatures || thermostatStillProbing) {
    return (
      <div className="thermostat">
        <TopNav availability={availability} />
        <div className="thermostat__body">
          <div className="thermostat-loader">🐾 🐾 🐾</div>
        </div>
        <BottomTabBar />
      </div>
    );
  }

  if (!acBotName || !roomMeterName) {
    return (
      <div className="thermostat">
        <TopNav availability={availability} />
        <div className="thermostat__body">
          <div className="thermostat-stub">
            <h1 className="thermostat__title">Thermostat</h1>
            <p>Needs a SwitchBot switch and a SwitchBot sensor (meter) configured on this machine.</p>
          </div>
        </div>
        <BottomTabBar />
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
    try { await ctrl.updateAutomation(payload); } catch { /* surfaced */ }
  };
  const handleAddAutomation = async (payload) => {
    try { await ctrl.addAutomation(payload); setAddOpen(false); } catch { /* stay open */ }
  };
  const handleDeleteAutomation = async (id) => {
    if (!window.confirm('Delete this automation?')) return;
    try { await ctrl.deleteAutomation(id); } catch { /* surfaced */ }
  };
  const handleMove = (id, direction) => {
    const idx = automations.findIndex((a) => a.id === id);
    if (idx < 0) return;
    const swapWith = direction === 'up' ? idx - 1 : idx + 1;
    if (swapWith < 0 || swapWith >= automations.length) return;
    const nextIds = automations.map((a) => a.id);
    [nextIds[idx], nextIds[swapWith]] = [nextIds[swapWith], nextIds[idx]];
    ctrl.reorderAutomations(nextIds).catch(() => {});
  };

  const meta = [];
  if (humidity != null) meta.push(`${Math.round(humidity)}% humidity`);
  if (battery != null) meta.push(`${Math.round(battery)}% battery`);
  const metaLine = meta.join(' · ');

  const lastActionAt = ctrl.status?.last_action_at;
  const lede = lastActionAt
    ? `automation last acted at ${formatTime(lastActionAt)}`
    : (on ? 'cooling' : 'off');

  return (
    <div className="thermostat">
      <TopNav availability={availability} />
      <div className="thermostat__body">
        <div className="thermostat__wide">
          {mobile && (
            <button
              type="button"
              className="thermostat__back"
              onClick={() => navigate('/')}
              aria-label="Back to Home"
            >
              <ChevronLeft size={17} />
              Home
            </button>
          )}
          <h1 className="thermostat__title">Thermostat</h1>
          <p className="thermostat__lede">{lede}</p>

          {combinedError && <div className="thermostat__banner">{combinedError}</div>}

          <div className="thermostat__cols">
            <div className="thermostat__col">
              <div className="thermostat__block">
                <div className="thermostat__stat">
                  {tempF != null ? Math.round(tempF) : '—'}
                  <small>°F</small>
                </div>
                {metaLine && (
                  <div className={'thermostat__meta' + (batteryLow ? ' thermostat__meta--low' : '')}>
                    {batteryLow && '⚠ '}{metaLine}
                  </div>
                )}
              </div>
              <div className="thermostat__block">
                <div className="thermo-row">
                  <div className="thermo-row__tx">
                    <div className="thermo-row__nm">Thermostat</div>
                    <div className="thermo-row__sb">{on ? 'cooling' : 'off'}</div>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={on}
                    disabled={busy}
                    className={'thermo-sw' + (on ? '' : ' thermo-sw--off')}
                    onClick={() => t.setAcOn(!on)}
                    aria-label={on ? 'Turn thermostat off' : 'Turn thermostat on'}
                  />
                </div>
              </div>
            </div>

            <div className="thermostat__col">
              {thermostatName && ctrl.status && (
                <div className="thermostat__block">
                  <p className="thermostat__sect">Automations</p>
                  {automations.length === 0 && !addOpen && (
                    <p className="thermostat-empty">No automations yet.</p>
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
                      className="thermo-row__act"
                      onClick={() => setAddOpen(true)}
                      disabled={ctrl.busy}
                    >
                      + Add automation
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      <BottomTabBar />
    </div>
  );
}
