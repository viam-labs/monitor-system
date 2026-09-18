import React, { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useThermostat } from '../hooks/useThermostat';
import { useThermostatController } from '../hooks/useThermostatController';
import Toggle from '../components/Toggle';
import TimeSelect from '../components/TimeSelect';
import DayPicker, { summarizeDays } from '../components/DayPicker';

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

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

function daysIntersect(a, b) {
  const setA = new Set(a && a.length ? a : ALL_DAYS);
  const bs = b && b.length ? b : ALL_DAYS;
  return bs.some(d => setA.has(d));
}

// Compare a proposed scheduled automation to existing ones. Returns
// { level: 'block'|'warn', other } when it collides (same time +
// overlapping days) with another scheduled entry: opposite action is
// a hard block, same action is a warning. null when there's no clash.
function findScheduledConflict(candidate, existing, ignoreId) {
  for (const other of existing || []) {
    if (!other || other.id === ignoreId) continue;
    if (other.kind !== 'scheduled') continue;
    if (other.enabled === false) continue;
    if (other.time !== candidate.time) continue;
    if (!daysIntersect(candidate.days_of_week, other.days_of_week)) continue;
    return {
      level: other.action === candidate.action ? 'warn' : 'block',
      other,
    };
  }
  return null;
}

function AutomationCard(props) {
  if (props.automation?.kind === 'scheduled') {
    return <ScheduledCard {...props} />;
  }
  return <HysteresisCard {...props} />;
}

function HysteresisCard({
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
  const [days, setDays] = useState(automation.days_of_week || []);

  useEffect(() => setName(automation.name), [automation.name]);
  useEffect(() => setOnInput(String(onF)), [onF]);
  useEffect(() => setOffInput(String(offF)), [offF]);
  useEffect(() => setStartInput(automation.active_start || ''), [automation.active_start]);
  useEffect(() => setEndInput(automation.active_end || ''), [automation.active_end]);
  useEffect(() => setDays(automation.days_of_week || []), [automation.days_of_week]);

  const savedDays = automation.days_of_week || [];
  const daysDirty =
    days.length !== savedDays.length ||
    days.some((d, i) => d !== savedDays[i]);
  const dirty =
    name !== automation.name ||
    onInput !== String(onF) ||
    offInput !== String(offF) ||
    (startInput || '') !== (automation.active_start || '') ||
    (endInput || '') !== (automation.active_end || '') ||
    daysDirty;

  const modeText = automation.mode === 'cooling' ? 'Cooling' : 'Heating';
  const hoursText = automation.active_start && automation.active_end
    ? `${formatClock(automation.active_start)}–${formatClock(automation.active_end)}`
    : 'always';
  const summaryLines = [
    `${modeText} · on ${onF}° / off ${offF}°`,
    `${hoursText} · ${summarizeDays(savedDays)}`,
  ];

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
      kind: 'hysteresis',
      on_temp_c: fToC(onFVal),
      off_temp_c: fToC(offFVal),
      active_start: start,
      active_end: end,
      days_of_week: days,
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
        </button>
        <Toggle
          checked={automation.enabled}
          onChange={(v) => onToggle(automation.id, v)}
          disabled={busy}
          ariaLabel={`Enable ${automation.name}`}
        />
      </div>

      <div className="automation-card__summary">
        {summaryLines.map((line, i) => (
          <div key={i}>{line}</div>
        ))}
      </div>

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

          <div className="automation-form__section-title">Days ({summarizeDays(days)})</div>
          <DayPicker value={days} onChange={setDays} disabled={busy} />

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

function ScheduledCard({
  automation,
  allAutomations,
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
  const [name, setName] = useState(automation.name);
  const [action, setAction] = useState(automation.action || 'off');
  const [time, setTime] = useState(automation.time || '07:00');
  const [days, setDays] = useState(automation.days_of_week || []);

  useEffect(() => setName(automation.name), [automation.name]);
  useEffect(() => setAction(automation.action || 'off'), [automation.action]);
  useEffect(() => setTime(automation.time || '07:00'), [automation.time]);
  useEffect(() => setDays(automation.days_of_week || []), [automation.days_of_week]);

  const savedDays = automation.days_of_week || [];
  const daysDirty =
    days.length !== savedDays.length || days.some((d, i) => d !== savedDays[i]);
  const dirty =
    name !== automation.name ||
    action !== (automation.action || 'off') ||
    time !== (automation.time || '07:00') ||
    daysDirty;

  const conflict = findScheduledConflict(
    { time, action, days_of_week: days },
    allAutomations,
    automation.id,
  );

  const summaryLines = [
    `Turn ${(automation.action || 'off').toUpperCase()} at ${formatClock(automation.time)}`,
    summarizeDays(savedDays),
  ];

  const submit = (e) => {
    e.preventDefault();
    if (conflict?.level === 'block') return;
    onSave({
      id: automation.id,
      name: name.trim() || automation.name,
      kind: 'scheduled',
      action,
      time,
      days_of_week: days,
    });
  };

  return (
    <div className="automation-card">
      <div className="automation-card__header">
        <button
          type="button"
          className="automation-card__disclose"
          onClick={() => setExpanded(v => !v)}
          aria-expanded={expanded}
        >
          <span className={'automation-card__chevron' + (expanded ? ' automation-card__chevron--open' : '')}>›</span>
          <span className="automation-card__name">{automation.name}</span>
        </button>
        <Toggle
          checked={automation.enabled}
          onChange={(v) => onToggle(automation.id, v)}
          disabled={busy}
          ariaLabel={`Enable ${automation.name}`}
        />
      </div>

      <div className="automation-card__summary">
        {summaryLines.map((line, i) => (
          <div key={i}>{line}</div>
        ))}
      </div>

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
              disabled={busy || !dirty || conflict?.level === 'block'}
            >
              {busy ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function AddAutomationForm({ busy, existing, onAdd, onCancel }) {
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

function AddHysteresisFormBody({ busy, onAdd, onCancel }) {
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

function AddScheduledFormBody({ busy, existing, onAdd, onCancel }) {
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

export default function ThermostatPage() {
  const {
    client, acBotName, roomMeterName, thermostatName,
    loading: connectionLoading, detectingFeatures, pendingProbes,
  } = useOutletContext();
  const thermostatStillProbing =
    !!acBotName && !roomMeterName && pendingProbes && pendingProbes.sensor > 0;
  const t = useThermostat(client, acBotName, roomMeterName);
  const ctrl = useThermostatController(client, thermostatName);
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
