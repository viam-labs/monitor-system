import React, { useMemo, useState } from 'react';
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

function formatVacationUntil(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

function nowLocalDatetimeInput() {
  // toISOString gives UTC. Adjust to local so <input type="datetime-local"> min
  // reflects the user's actual "now".
  const d = new Date(Date.now() - new Date().getTimezoneOffset() * 60000);
  return d.toISOString().slice(0, 16);
}

function ScheduleForm({ initialTime, initialCups, saving, onSave, onCancel }) {
  const [time, setTime] = useState(initialTime || '07:00');
  const [cups, setCups] = useState(initialCups ?? 1);

  const submit = (e) => {
    e.preventDefault();
    const n = Number(cups);
    if (!time || !n || n <= 0) return;
    onSave(time, n);
  };

  return (
    <form className="schedule-form" onSubmit={submit}>
      <div className="schedule-form__fields">
        <label className="schedule-form__field">
          <span className="schedule-form__label">Time</span>
          <input type="time" value={time} onChange={e => setTime(e.target.value)} required />
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

function VacationForm({ saving, onSubmit, onCancel }) {
  const [until, setUntil] = useState('');
  const submit = (e) => {
    e.preventDefault();
    if (!until) return;
    onSubmit(until);
  };
  return (
    <form className="vacation-form" onSubmit={submit}>
      <label className="vacation-form__field">
        <span className="vacation-form__label">Pause until</span>
        <input
          type="datetime-local"
          value={until}
          min={nowLocalDatetimeInput()}
          onChange={e => setUntil(e.target.value)}
          required
        />
      </label>
      <div className="vacation-form__actions">
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
          disabled={saving || !until}
        >
          {saving ? 'Pausing…' : 'Pause until this'}
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
  const [vacationOpen, setVacationOpen] = useState(false);
  const [delayHours, setDelayHours] = useState(0);
  const [delayMinutes, setDelayMinutes] = useState(30);

  const sortedSchedules = useMemo(
    () => (schedules || []).slice().sort((a, b) => (a.time || '').localeCompare(b.time || '')),
    [schedules]
  );

  // Find the next scheduled fire (spanning to tomorrow if today's are past)
  // so we can render Feed-Now and delay previews in local time.
  const nextScheduled = useMemo(() => {
    if (!schedules || schedules.length === 0) return null;
    const now = new Date();
    let best = null;
    let bestFire = null;
    for (const s of schedules) {
      if (!s.time || !s.time.includes(':')) continue;
      const [h, m] = s.time.split(':').map(Number);
      const fire = new Date();
      fire.setHours(h, m, 0, 0);
      if (fire <= now) fire.setDate(fire.getDate() + 1);
      if (bestFire === null || fire < bestFire) {
        bestFire = fire;
        best = { ...s, fireAt: fire };
      }
    }
    return best;
  }, [schedules]);

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
  const delayedIds = new Set(status?.delayed_schedule_ids || []);
  const skippedCount = status?.skipped_count || 0;
  const pauseUntilLocal = status?.pause_until ? formatVacationUntil(status.pause_until) : null;

  const feedNowCaption = nextScheduled
    ? `Feeds ${formatCups(nextScheduled.cups)} now and skips the ${formatScheduleTime(nextScheduled.time)} feeding (auto-restored after).`
    : target != null
      ? `Feeds ${formatCups(target)} now. No scheduled feedings to skip.`
      : 'Add a scheduled feeding or set target_meal_cups in your config first.';
  const canFeedNow = !!(nextScheduled || target != null);

  const delayTotal = Number(delayHours) + Number(delayMinutes) / 60;
  const delayPreview = (() => {
    if (!nextScheduled) return 'No upcoming feedings to delay.';
    if (delayTotal <= 0) return 'Enter a delay above.';
    const shifted = new Date(nextScheduled.fireAt.getTime() + delayTotal * 3600 * 1000);
    return `Feeding at ${formatScheduleTime(nextScheduled.time)} will move to ${formatTime(shifted.getTime())}.`;
  })();

  const handleAdd = async (t, c) => {
    try {
      await feeder.addSchedule(t, c);
      setAddOpen(false);
    } catch {
      // stay open
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
      // error surfaced in banner
    }
  };

  const handleFeedNow = async () => {
    if (!canFeedNow) return;
    try {
      await feeder.feedNow();
    } catch {
      // error surfaced in banner
    }
  };

  const handleSkipNext = async () => {
    if (!nextScheduled) return;
    if (
      !window.confirm(
        `Skip the ${formatScheduleTime(nextScheduled.time)} feeding? It will restore automatically after that time passes.`
      )
    ) return;
    try {
      await feeder.skipNext();
    } catch {
      // error surfaced in banner
    }
  };

  const handleDelay = async () => {
    if (delayTotal <= 0 || !nextScheduled) return;
    try {
      await feeder.delayNext(delayTotal);
      setDelayHours(0);
      setDelayMinutes(30);
    } catch {
      // error surfaced in banner
    }
  };

  const handleVacation = async (until) => {
    try {
      await feeder.pauseUntil(until);
      setVacationOpen(false);
    } catch {
      // stay open on error
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
            title="Refresh. Server caches for 5 minutes — rapid clicks return the cached value, they don't hammer PetSafe."
          >
            ↻
          </button>
        </div>
      </div>

      {error && <p className="feeder-error feeder-error--banner">{error}</p>}

      {pauseUntilLocal && (
        <div className="feeder-banner feeder-banner--vacation">
          <span>🌴 Paused until {pauseUntilLocal}</span>
          <button
            type="button"
            className="feeder-secondary-button"
            onClick={() => feeder.pauseSchedule(false)}
            disabled={pausing}
          >
            Resume now
          </button>
        </div>
      )}

      {skippedCount > 0 && (
        <div className="feeder-banner">
          {skippedCount} pending skip{skippedCount === 1 ? '' : 's'} — will restore automatically after each original time passes.
        </div>
      )}

      <section className="feeder-hero">
        <button
          type="button"
          className="feeder-hero__button"
          onClick={handleFeedNow}
          disabled={feeding || mutating || !canFeedNow}
        >
          <span aria-hidden="true" className="feeder-hero__emoji">🐶</span>
          <span>{mutating || feeding ? 'Feeding…' : 'Feed Now'}</span>
        </button>
        <p className="feeder-hero__caption">{feedNowCaption}</p>
      </section>

      <section className="feeder-card">
        <div className="feeder-card__header">
          <h2 className="feeder-card__title">Schedule</h2>
          <div className="feeder-card__actions">
            <button
              type="button"
              className={
                'feeder-secondary-button' +
                (schedulePaused ? ' feeder-secondary-button--active' : '')
              }
              onClick={() => feeder.pauseSchedule(!schedulePaused)}
              disabled={pausing || scheduleEmpty || !!pauseUntilLocal}
              title={pauseUntilLocal ? 'Vacation pause is active.' : undefined}
            >
              {schedulePaused ? 'Resume' : 'Pause'}
            </button>
            <button
              type="button"
              className="feeder-secondary-button"
              onClick={() => setVacationOpen(o => !o)}
              disabled={mutating || scheduleEmpty}
            >
              Vacation…
            </button>
          </div>
        </div>

        {vacationOpen && (
          <VacationForm
            saving={mutating}
            onSubmit={handleVacation}
            onCancel={() => setVacationOpen(false)}
          />
        )}

        {loading && !schedules && <p className="feeder-status__loading">Loading…</p>}
        {schedules && (
          <>
            {scheduleEmpty && !addOpen && (
              <p className="feeder-meta">No scheduled feedings yet.</p>
            )}
            {sortedSchedules.length > 0 && (
              <ul className="schedule-list">
                {sortedSchedules.map(s => {
                  const isDelayed = delayedIds.has(s.id);
                  return (
                    <li
                      key={s.id || s.time}
                      className={
                        'schedule-list__item' +
                        (isDelayed ? ' schedule-list__item--delayed' : '')
                      }
                    >
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
                            {isDelayed && (
                              <span className="schedule-list__badge">delayed</span>
                            )}
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
                  );
                })}
              </ul>
            )}

            {!scheduleEmpty && (
              <div className="quick-actions">
                <button
                  type="button"
                  className="feeder-secondary-button"
                  onClick={handleSkipNext}
                  disabled={mutating || !nextScheduled}
                >
                  Skip next feeding
                </button>
                <div className="delay-row">
                  <span className="delay-row__label">Delay next by</span>
                  <div className="delay-row__inputs">
                    <input
                      type="number"
                      min="0"
                      max="23"
                      value={delayHours}
                      onChange={e => setDelayHours(Math.max(0, Math.min(23, Number(e.target.value) || 0)))}
                      aria-label="Hours"
                      disabled={mutating}
                    />
                    <span className="delay-row__unit">hr</span>
                    <input
                      type="number"
                      min="0"
                      max="59"
                      value={delayMinutes}
                      onChange={e => setDelayMinutes(Math.max(0, Math.min(59, Number(e.target.value) || 0)))}
                      aria-label="Minutes"
                      disabled={mutating}
                    />
                    <span className="delay-row__unit">min</span>
                    <button
                      type="button"
                      className="feeder-primary-button feeder-primary-button--sm"
                      onClick={handleDelay}
                      disabled={mutating || delayTotal <= 0 || !nextScheduled}
                    >
                      Delay
                    </button>
                  </div>
                </div>
                <p className="feeder-meta">{delayPreview}</p>
              </div>
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
          <h2 className="feeder-card__title">Give a treat</h2>
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
          className="feeder-secondary-button feeder-secondary-button--full"
          onClick={() => feeder.feed(cups, slow)}
          disabled={feeding}
        >
          {feeding ? 'Feeding…' : `Give ${formatCups(cups)}`}
        </button>

        {lastFedAt && (
          <p className="feeder-meta feeder-meta--centered">
            Last fed at {formatTime(lastFedAt)} from this device.
          </p>
        )}
      </section>
    </div>
  );
}
