import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useFeeder } from '../hooks/useFeeder';

const CUP_OPTIONS = [
  { value: 0.125, label: '⅛' },
  { value: 0.25, label: '¼' },
  { value: 0.5, label: '½' },
  { value: 1, label: '1' },
];

function formatTime(ms) {
  if (!ms) return null;
  return new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function formatScheduleTime(hhmm) {
  if (!hhmm) return '';
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function formatCups(cups) {
  if (cups == null) return '';
  if (cups === Math.floor(cups)) return `${cups} cup${cups === 1 ? '' : 's'}`;
  return `${cups} cups`;
}

function ScheduleForm({ initialTime, initialCups, saving, onSave, onCancel }) {
  const [time, setTime] = useState(initialTime || '07:00');
  const [cups, setCups] = useState(initialCups ?? 1);

  const submit = (e) => {
    e.preventDefault();
    const numCups = Number(cups);
    if (!time || !numCups || numCups <= 0) return;
    onSave(time, numCups);
  };

  return (
    <form className="schedule-form" onSubmit={submit}>
      <div className="schedule-form__fields">
        <label className="schedule-form__field">
          <span className="schedule-form__label">Time</span>
          <input
            type="time"
            value={time}
            onChange={e => setTime(e.target.value)}
            required
          />
        </label>
        <label className="schedule-form__field">
          <span className="schedule-form__label">Cups</span>
          <input
            type="number"
            step="0.125"
            min="0.125"
            max="12"
            value={cups}
            onChange={e => setCups(e.target.value)}
            required
          />
        </label>
      </div>
      <div className="schedule-form__actions">
        <button
          type="button"
          className="feeder-secondary-button"
          onClick={onCancel}
          disabled={saving}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="feeder-primary-button feeder-primary-button--sm"
          disabled={saving}
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  );
}

export default function FeederPage() {
  const { client, feederName, loading: connectionLoading } = useOutletContext();
  const feeder = useFeeder(client, feederName);
  const {
    status,
    schedules,
    loading,
    error,
    feeding,
    pausing,
    mutating,
    schedulePaused,
    lastFedAt,
  } = feeder;

  const target = status?.target_meal_cups ?? null;
  const [cupsOverride, setCupsOverride] = useState(null);
  const cups = cupsOverride ?? target ?? 0.25;
  const [slow, setSlow] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [addOpen, setAddOpen] = useState(false);

  if (connectionLoading) {
    return (
      <div className="paw-loader" aria-label="Connecting">
        <span>🐾</span>
        <span>🐾</span>
        <span>🐾</span>
      </div>
    );
  }

  if (!feederName) {
    return (
      <div className="stub-page">
        <h1>Feeder</h1>
        <p>No feeder is configured on this machine.</p>
      </div>
    );
  }

  const foodStateClass = status
    ? `feeder-status__pill feeder-status__pill--${status.food_state}`
    : 'feeder-status__pill';

  const scheduleEmpty = !schedules || schedules.length === 0;
  const sortedSchedules = (schedules || [])
    .slice()
    .sort((a, b) => (a.time || '').localeCompare(b.time || ''));

  const handleAdd = async (t, c) => {
    try {
      await feeder.addSchedule(t, c);
      setAddOpen(false);
    } catch {
      // stay open; error is surfaced in the top bar
    }
  };

  const handleModify = async (id, t, c) => {
    try {
      await feeder.modifySchedule(id, t, c);
      setEditingId(null);
    } catch {
      // stay open
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this scheduled feeding?')) return;
    try {
      await feeder.deleteSchedule(id);
    } catch {
      // error surfaced in top bar
    }
  };

  return (
    <div className="feeder-page">
      <div className="feeder-topbar">
        {status ? (
          <span className={foodStateClass}>Food {status.food_state}</span>
        ) : (
          loading && <span className="feeder-meta">Loading…</span>
        )}
        <div className="feeder-topbar__actions">
          {status?.cached && <span className="feeder-topbar__cached">cached</span>}
          <button
            type="button"
            className="feeder-icon-button"
            onClick={feeder.refresh}
            disabled={loading || feeding || mutating}
            aria-label="Refresh"
            title="Refresh"
          >
            ↻
          </button>
        </div>
      </div>
      {error && <p className="feeder-error feeder-error--banner">{error}</p>}

      <section className="feeder-card">
        <div className="feeder-card__header">
          <h2 className="feeder-card__title">Schedule</h2>
          <button
            type="button"
            className={
              'feeder-secondary-button' +
              (schedulePaused ? ' feeder-secondary-button--active' : '')
            }
            onClick={() => feeder.pauseSchedule(!schedulePaused)}
            disabled={pausing || scheduleEmpty}
          >
            {schedulePaused ? 'Resume' : 'Pause'}
          </button>
        </div>
        {loading && !schedules && <p className="feeder-status__loading">Loading…</p>}
        {schedules && (
          <>
            {scheduleEmpty && !addOpen && (
              <p className="feeder-meta">No scheduled feedings yet.</p>
            )}
            {sortedSchedules.length > 0 && (
              <ul className="schedule-list">
                {sortedSchedules.map(s => (
                  <li key={s.id || s.time} className="schedule-list__item">
                    {editingId === s.id ? (
                      <ScheduleForm
                        initialTime={s.time}
                        initialCups={s.cups}
                        saving={mutating}
                        onSave={(t, c) => handleModify(s.id, t, c)}
                        onCancel={() => setEditingId(null)}
                      />
                    ) : (
                      <>
                        <div className="schedule-list__body">
                          <span className="schedule-list__time">
                            {formatScheduleTime(s.time)}
                          </span>
                          <span className="schedule-list__amount">{formatCups(s.cups)}</span>
                        </div>
                        <div className="schedule-list__actions">
                          <button
                            type="button"
                            className="feeder-icon-button"
                            onClick={() => setEditingId(s.id)}
                            aria-label="Edit"
                            title="Edit"
                            disabled={mutating}
                          >
                            ✎
                          </button>
                          <button
                            type="button"
                            className="feeder-icon-button feeder-icon-button--danger"
                            onClick={() => handleDelete(s.id)}
                            aria-label="Delete"
                            title="Delete"
                            disabled={mutating}
                          >
                            ✕
                          </button>
                        </div>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {addOpen ? (
              <ScheduleForm
                initialTime="07:00"
                initialCups={target ?? 1}
                saving={mutating}
                onSave={handleAdd}
                onCancel={() => setAddOpen(false)}
              />
            ) : (
              <button
                type="button"
                className="feeder-secondary-button feeder-secondary-button--full"
                onClick={() => setAddOpen(true)}
                disabled={mutating}
              >
                + Add feeding
              </button>
            )}
          </>
        )}
      </section>

      <section className="feeder-card feeder-card--controls">
        <div className="feeder-card__header">
          <h2 className="feeder-card__title">Manual feed</h2>
        </div>
        <div className="feeder-controls__cups" role="radiogroup" aria-label="Amount">
          {CUP_OPTIONS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={cups === value}
              className={
                'feeder-controls__cup' +
                (cups === value ? ' feeder-controls__cup--active' : '')
              }
              onClick={() => setCupsOverride(value)}
              disabled={feeding}
            >
              {label}
            </button>
          ))}
        </div>

        <label className="feeder-controls__slow">
          <input
            type="checkbox"
            checked={slow}
            onChange={e => setSlow(e.target.checked)}
            disabled={feeding}
          />
          Slow feed
        </label>

        <button
          type="button"
          className="feeder-primary-button"
          onClick={() => feeder.feed(cups, slow)}
          disabled={feeding}
        >
          {feeding ? 'Feeding…' : `Feed ${formatCups(cups)}`}
          <span aria-hidden="true" className="feeder-primary-button__emoji">🐶</span>
        </button>

        {target != null && (
          <p className="feeder-meta feeder-meta--centered">
            Default meal is {formatCups(target)}.
          </p>
        )}
        {lastFedAt && (
          <p className="feeder-meta feeder-meta--centered">
            Last fed at {formatTime(lastFedAt)} from this device.
          </p>
        )}
      </section>
    </div>
  );
}
