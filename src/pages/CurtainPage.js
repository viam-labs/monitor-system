import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useCurtain } from '../hooks/useCurtain';
import Toggle from '../components/Toggle';
import TimeSelect from '../components/TimeSelect';
import DayPicker, { summarizeDays } from '../components/DayPicker';

const LOW_BATTERY_THRESHOLD = 20;

function formatClock(hhmm) {
  if (!hhmm) return '';
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function summarizeAction(schedule) {
  switch (schedule.action) {
    case 'open': return 'Open';
    case 'close': return 'Close';
    case 'position': return `Set to ${100 - Number(schedule.position)}% open`;
    default: return schedule.action;
  }
}

function ScheduleForm({ initial, busy, submitLabel, onSubmit, onCancel }) {
  const [name, setName] = useState(initial.name || 'Schedule');
  const [action, setAction] = useState(
    initial.action === 'position' ? 'open' : (initial.action || 'open')
  );
  const [time, setTime] = useState(initial.time || '07:00');
  const [days, setDays] = useState(initial.days_of_week || []);

  const submit = (e) => {
    e.preventDefault();
    if (!time) return;
    const payload = {
      name: name.trim() || 'Schedule',
      action,
      time,
      days_of_week: days,
      enabled: initial.enabled !== false,
    };
    if (initial.id) payload.id = initial.id;
    onSubmit(payload);
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
            <option value="open">Open</option>
            <option value="close">Close</option>
          </select>
        </label>
        <label className="automation-form__field">
          <span className="automation-form__label">Time</span>
          <TimeSelect
            value={time}
            onChange={setTime}
            disabled={busy}
          />
        </label>
      </div>

      <div className="automation-form__field">
        <span className="automation-form__label">Days ({summarizeDays(days)})</span>
        <DayPicker value={days} onChange={setDays} disabled={busy} />
      </div>

      <div className="automation-card__actions">
        {onCancel && (
          <button
            type="button"
            className="feeder-secondary-button"
            onClick={onCancel}
            disabled={busy}
          >
            Cancel
          </button>
        )}
        <span className="automation-card__spacer" />
        <button
          type="submit"
          className="feeder-primary-button feeder-primary-button--sm"
          disabled={busy}
        >
          {busy ? 'Saving…' : submitLabel}
        </button>
      </div>
    </form>
  );
}

function ScheduleCard({ schedule, isFirst, isLast, busy, onToggle, onSave, onDelete, onMoveUp, onMoveDown }) {
  const [expanded, setExpanded] = useState(false);
  const summary = `${summarizeAction(schedule)} · ${formatClock(schedule.time)} · ${summarizeDays(schedule.days_of_week)}`;

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
          <span className="automation-card__name">{schedule.name}</span>
        </button>
        <Toggle
          checked={schedule.enabled !== false}
          onChange={(v) => onToggle(schedule.id, v)}
          disabled={busy}
          ariaLabel={`Enable ${schedule.name}`}
        />
      </div>

      <div className="automation-card__summary">{summary}</div>

      {expanded && (
        <>
          <ScheduleForm
            initial={schedule}
            busy={busy}
            submitLabel="Save"
            onSubmit={onSave}
          />
          <div className="automation-card__actions">
            <button
              type="button"
              className="feeder-icon-button"
              onClick={() => onMoveUp(schedule.id)}
              disabled={busy || isFirst}
              aria-label="Move up"
              title="Move up"
            >
              ↑
            </button>
            <button
              type="button"
              className="feeder-icon-button"
              onClick={() => onMoveDown(schedule.id)}
              disabled={busy || isLast}
              aria-label="Move down"
              title="Move down"
            >
              ↓
            </button>
            <button
              type="button"
              className="feeder-icon-button feeder-icon-button--danger"
              onClick={() => onDelete(schedule.id)}
              disabled={busy}
              aria-label="Delete schedule"
              title="Delete"
            >
              ✕
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default function CurtainPage() {
  const {
    client,
    curtainName,
    loading: connectionLoading,
    detectingFeatures,
    pendingProbes,
  } = useOutletContext();
  const curtainStillProbing = !curtainName && pendingProbes && pendingProbes.generic > 0;
  const c = useCurtain(client, curtainName);
  const { position, battery, moving, schedules, loading, error, busy } = c;
  const [addOpen, setAddOpen] = useState(false);

  // SwitchBot slide_position: 0 = fully open, 100 = fully closed. Anything
  // below the midpoint reads as "open" for the binary UI.
  const isOpen = typeof position === 'number' && position < 50;
  const stateLabel = typeof position !== 'number' ? '—' : isOpen ? 'Open' : 'Closed';
  const batteryLow = battery != null && battery <= LOW_BATTERY_THRESHOLD;

  if (connectionLoading || detectingFeatures || curtainStillProbing) {
    return (
      <div className="paw-loader" aria-label="Connecting">
        <span>🐾</span>
        <span>🐾</span>
        <span>🐾</span>
      </div>
    );
  }

  if (!curtainName) {
    return (
      <div className="stub-page">
        <h1>Curtain</h1>
        <p>
          No SwitchBot Curtain configured on this machine. Add a{' '}
          <code>viam:switchbot:curtain</code> generic component.
        </p>
      </div>
    );
  }

  const handleAdd = async (payload) => {
    try {
      await c.addSchedule(payload);
      setAddOpen(false);
    } catch {
      // stay open
    }
  };

  const handleSave = async (payload) => {
    try {
      await c.updateSchedule(payload);
    } catch {
      // surfaced
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this schedule?')) return;
    try {
      await c.deleteSchedule(id);
    } catch {
      // surfaced
    }
  };

  const handleMove = (id, direction) => {
    const idx = schedules.findIndex(s => s.id === id);
    if (idx < 0) return;
    const swapWith = direction === 'up' ? idx - 1 : idx + 1;
    if (swapWith < 0 || swapWith >= schedules.length) return;
    const nextIds = schedules.map(s => s.id);
    [nextIds[idx], nextIds[swapWith]] = [nextIds[swapWith], nextIds[idx]];
    c.reorderSchedules(nextIds).catch(() => {});
  };

  return (
    <div className="feeder-page">
      {error && <p className="feeder-error feeder-error--banner">{error}</p>}

      <section className="feeder-card thermostat-readings">
        <button
          type="button"
          className="feeder-icon-button thermostat-readings__refresh"
          onClick={c.refresh}
          disabled={loading || busy}
          aria-label="Refresh"
          title="Refresh"
        >
          ↻
        </button>
        <div className="thermostat-temp">
          <span className="thermostat-temp__value">{stateLabel}</span>
        </div>
        {(battery != null || moving) && (
          <div className="thermostat-secondary">
            {battery != null && (
              <span
                className={
                  'thermostat-secondary__item battery-pill' +
                  (batteryLow ? ' battery-pill--low' : '')
                }
                title={batteryLow ? 'Curtain battery is low — charge soon.' : undefined}
              >
                {batteryLow && <span aria-hidden="true">⚠</span>}
                {battery}% battery
              </span>
            )}
            {moving && (
              <span className="thermostat-secondary__item">moving…</span>
            )}
          </div>
        )}
      </section>

      <section className="feeder-card">
        <div className="thermostat-buttons">
          {isOpen ? (
            <button
              type="button"
              className="thermostat-button"
              onClick={c.close}
              disabled={busy}
            >
              {busy ? 'Sending…' : 'Close'}
            </button>
          ) : (
            <button
              type="button"
              className="thermostat-button"
              onClick={c.open}
              disabled={busy}
            >
              {busy ? 'Sending…' : 'Open'}
            </button>
          )}
        </div>
      </section>

      <section className="feeder-card">
        <div className="feeder-card__header">
          <h2 className="feeder-card__title">Schedules</h2>
        </div>

        {schedules.length === 0 && !addOpen && (
          <p className="feeder-meta">No schedules yet.</p>
        )}

        {schedules.map((s, i) => (
          <ScheduleCard
            key={s.id}
            schedule={s}
            isFirst={i === 0}
            isLast={i === schedules.length - 1}
            busy={busy}
            onToggle={c.setScheduleEnabled}
            onSave={handleSave}
            onDelete={handleDelete}
            onMoveUp={(id) => handleMove(id, 'up')}
            onMoveDown={(id) => handleMove(id, 'down')}
          />
        ))}

        {addOpen ? (
          <div className="automation-card automation-card--add">
            <ScheduleForm
              initial={{ action: 'open', time: '07:00', days_of_week: [], enabled: true, name: 'Schedule' }}
              busy={busy}
              submitLabel="Add"
              onSubmit={handleAdd}
              onCancel={() => setAddOpen(false)}
            />
          </div>
        ) : (
          <button
            type="button"
            className="feeder-secondary-button feeder-secondary-button--full"
            onClick={() => setAddOpen(true)}
            disabled={busy}
          >
            + Add schedule
          </button>
        )}
      </section>
    </div>
  );
}
