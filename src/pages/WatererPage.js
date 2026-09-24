import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import Toggle from '../components/Toggle';
import TimeSelect from '../components/TimeSelect';
import DayPicker, { summarizeDays } from '../components/DayPicker';
import { useCameraStreams } from '../hooks/useCameraStreams';

const CAMERA_NAME = 'waterer';

function WatererCamera({ client, camera }) {
  const cameras = useMemo(() => (camera ? [camera] : []), [camera]);
  const streams = useCameraStreams(client, cameras);
  const stream = camera ? streams[camera.name] : null;
  const videoRef = useRef(null);

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !stream) return;
    el.muted = true;
    el.srcObject = stream;
    el.play().catch(() => {});
  }, [stream]);

  if (!camera) return null;

  return (
    <section className="feeder-card waterer-camera">
      <video ref={videoRef} autoPlay playsInline muted />
    </section>
  );
}

const DEFAULT_DOSE_ML = 250;
const DOSE_OPTIONS_ML = [50, 100, 150, 200, 250, 300, 350, 400];

function formatClock(hhmm) {
  if (!hhmm) return '';
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function formatRelative(iso) {
  if (!iso) return null;
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return null;
  const diffSec = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (diffSec < 60) return 'just now';
  const min = Math.round(diffSec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr} hr ago`;
  const day = Math.round(hr / 24);
  return `${day} day${day === 1 ? '' : 's'} ago`;
}

function ScheduleForm({ initial, busy, submitLabel, onSubmit, onCancel }) {
  const [name, setName] = useState(initial.name || 'Dispense');
  const [time, setTime] = useState(initial.time || '08:00');
  const [doseMl, setDoseMl] = useState(
    typeof initial.dose_ml === 'number' ? String(initial.dose_ml) : String(DEFAULT_DOSE_ML)
  );
  const [days, setDays] = useState(initial.days_of_week || []);

  const submit = (e) => {
    e.preventDefault();
    if (!time) return;
    const ml = Number(doseMl);
    if (!Number.isFinite(ml) || ml <= 0) return;
    const payload = {
      name: name.trim() || 'Dispense',
      time,
      dose_ml: ml,
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
          <span className="automation-form__label">Time</span>
          <TimeSelect
            value={time}
            onChange={setTime}
            disabled={busy}
          />
        </label>
        <label className="automation-form__field">
          <span className="automation-form__label">Amount</span>
          <select
            className="cups-select"
            value={doseMl}
            onChange={e => setDoseMl(e.target.value)}
            disabled={busy}
          >
            {!DOSE_OPTIONS_ML.includes(Number(doseMl)) && doseMl !== '' && (
              <option value={doseMl}>{doseMl} ml</option>
            )}
            {DOSE_OPTIONS_ML.map(ml => (
              <option key={ml} value={ml}>{ml} ml</option>
            ))}
          </select>
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
  const summary = `${schedule.dose_ml} ml · ${formatClock(schedule.time)} · ${summarizeDays(schedule.days_of_week)}`;

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

export default function WatererPage() {
  const {
    client,
    cameras,
    watererName,
    loading: connectionLoading,
    detectingFeatures,
    pendingProbes,
    waterer: w,
  } = useOutletContext();
  const watererCamera = useMemo(
    () => (cameras || []).find(c => c.name === CAMERA_NAME) || null,
    [cameras],
  );
  const watererStillProbing = !watererName && pendingProbes && pendingProbes.generic > 0;
  const {
    mlPerSecond,
    maxDailyMl,
    dailyTotal,
    lastDispense,
    schedules,
    loading,
    error,
    busy,
  } = w;
  const [addOpen, setAddOpen] = useState(false);
  const [dispenseMl, setDispenseMl] = useState(DEFAULT_DOSE_ML);

  if (connectionLoading || detectingFeatures || watererStillProbing) {
    return (
      <div className="paw-loader" aria-label="Connecting">
        <span>🐾</span>
        <span>🐾</span>
        <span>🐾</span>
      </div>
    );
  }

  if (!watererName) {
    return (
      <div className="stub-page">
        <h1>Waterer</h1>
        <p>
          No waterer configured on this machine. Add a{' '}
          <code>viam:waterer:pump</code> generic component pointed at a switch
          controlling the pump.
        </p>
      </div>
    );
  }

  const handleAdd = async (payload) => {
    try {
      await w.addSchedule(payload);
      setAddOpen(false);
    } catch {
      // stay open
    }
  };

  const handleSave = async (payload) => {
    try {
      await w.updateSchedule(payload);
    } catch {
      // surfaced
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this schedule?')) return;
    try {
      await w.deleteSchedule(id);
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
    w.reorderSchedules(nextIds).catch(() => {});
  };

  const handleDispense = async () => {
    try { await w.dispenseMl(dispenseMl); } catch { /* surfaced */ }
  };

  const dailyTotalMl = dailyTotal && typeof dailyTotal.ml === 'number'
    ? Math.round(dailyTotal.ml)
    : 0;
  const lastDispenseRel = lastDispense ? formatRelative(lastDispense.at) : null;
  const lastDispenseMl = lastDispense && typeof lastDispense.ml === 'number'
    ? Math.round(lastDispense.ml)
    : null;

  return (
    <div className="feeder-page">
      {error && <p className="feeder-error feeder-error--banner">{error}</p>}

      <section className="feeder-card thermostat-readings">
        <button
          type="button"
          className="feeder-icon-button thermostat-readings__refresh"
          onClick={w.refresh}
          disabled={loading || busy}
          aria-label="Refresh"
          title="Refresh"
        >
          ↻
        </button>
        <div className="thermostat-temp">
          <span className="thermostat-temp__value">{dailyTotalMl} ml</span>
          <span className="thermostat-temp__label">today</span>
        </div>
        <div className="thermostat-secondary">
          {maxDailyMl != null && (
            <span className="thermostat-secondary__item">
              cap {Math.round(maxDailyMl)} ml/day
            </span>
          )}
          {mlPerSecond != null && (
            <span className="thermostat-secondary__item">
              {mlPerSecond.toFixed(1)} ml/sec
            </span>
          )}
          {lastDispenseRel && (
            <span className="thermostat-secondary__item">
              last {lastDispenseMl != null ? `${lastDispenseMl} ml ` : ''}{lastDispenseRel}
            </span>
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
            onToggle={w.setScheduleEnabled}
            onSave={handleSave}
            onDelete={handleDelete}
            onMoveUp={(id) => handleMove(id, 'up')}
            onMoveDown={(id) => handleMove(id, 'down')}
          />
        ))}

        {addOpen ? (
          <div className="automation-card automation-card--add">
            <ScheduleForm
              initial={{ time: '08:00', dose_ml: DEFAULT_DOSE_ML, days_of_week: [], enabled: true, name: 'Dispense' }}
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

      <section className="feeder-card">
        <label className="automation-form__field">
          <span className="automation-form__label">Amount</span>
          <select
            className="cups-select"
            value={dispenseMl}
            onChange={e => setDispenseMl(Number(e.target.value))}
            disabled={busy}
          >
            {DOSE_OPTIONS_ML.map(ml => (
              <option key={ml} value={ml}>{ml} ml</option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="curtain-action curtain-action--open"
          onClick={handleDispense}
          disabled={busy}
        >
          {busy ? 'Dispensing…' : `Dispense ${dispenseMl} ml`}
        </button>
      </section>

      <WatererCamera client={client} camera={watererCamera} />
    </div>
  );
}
