import React, { useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useFeeder } from '../hooks/useFeeder';

// Fraction labels for common cup amounts. Anything not in this map is
// rendered as the decimal (e.g., 3.125 -> "3.125 cups").
const FRACTION_LABELS = {
  0: '0',
  0.125: '⅛',
  0.25: '¼',
  0.375: '⅜',
  0.5: '½',
  0.625: '⅝',
  0.75: '¾',
  0.875: '⅞',
};

function labelForCups(cups) {
  if (cups == null || Number.isNaN(cups)) return '';
  const whole = Math.floor(cups);
  const frac = Number((cups - whole).toFixed(3));
  const fracLabel = FRACTION_LABELS[frac];
  if (whole === 0) {
    if (fracLabel === undefined) return `${cups} cups`;
    return `${fracLabel} cup`;
  }
  if (frac === 0) return `${whole} cup${whole === 1 ? '' : 's'}`;
  if (fracLabel === undefined) return `${cups} cups`;
  return `${whole}${fracLabel} cups`;
}

// ⅛-cup steps up to 2 cups, then ¼-cup steps up to 4 cups. Covers the
// realistic range for a Smart Feed without an unwieldy list.
const CUP_OPTIONS = (() => {
  const out = [];
  for (let i = 1; i <= 16; i++) out.push(i * 0.125);
  for (let i = 9; i <= 16; i++) out.push(i * 0.25);
  return out;
})();

function CupsSelect({ value, onChange, disabled, id, ariaLabel }) {
  return (
    <select
      id={id}
      aria-label={ariaLabel}
      className="cups-select"
      value={value}
      onChange={e => onChange(Number(e.target.value))}
      disabled={disabled}
    >
      {CUP_OPTIONS.map(v => (
        <option key={v} value={v}>{labelForCups(v)}</option>
      ))}
    </select>
  );
}

function formatTime(input) {
  if (input == null) return null;
  const ms = typeof input === 'string' ? Date.parse(input) : input;
  if (Number.isNaN(ms)) return null;
  return new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function formatScheduleTime(hhmm) {
  if (!hhmm) return '';
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function formatVacationUntil(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

function formatRelative(msAgo) {
  if (msAgo == null || Number.isNaN(msAgo)) return '';
  // Future timestamps mean something's wrong upstream (clock skew,
  // wrong tz assumption). Don't confidently print "in 2 hours".
  if (msAgo < -60000) return '';
  const sec = Math.max(0, Math.floor(msAgo / 1000));
  if (sec < 60) return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hr ago`;
  const day = Math.floor(hr / 24);
  return `${day} day${day === 1 ? '' : 's'} ago`;
}

// PetSafe returns timestamps without a timezone marker but the values
// are UTC. Date.parse of a naive string is browser-dependent (some
// parse as UTC, some as local), so force UTC here to avoid displaying
// times shifted by the local UTC offset.
function parseServerTimestamp(raw) {
  if (raw == null) return NaN;
  if (typeof raw === 'number') {
    return raw < 1e12 ? raw * 1000 : raw;
  }
  if (typeof raw !== 'string') return NaN;
  const hasTz = /[Zz]|[+-]\d{2}:?\d{2}$/.test(raw);
  return Date.parse(hasTz ? raw : raw + 'Z');
}

function extractLastFedTimestamp(lastFeeding, localLastFedAt) {
  const candidates = [];
  if (localLastFedAt) candidates.push(localLastFedAt);
  if (lastFeeding) {
    for (const key of ['created_at', 'timestamp', 'time', 'date']) {
      const ms = parseServerTimestamp(lastFeeding[key]);
      if (!Number.isNaN(ms)) candidates.push(ms);
    }
  }
  // Filter out timestamps meaningfully in the future — better to show
  // nothing than "3:51 PM · just now" when it's currently 1:24 PM.
  const nowMs = Date.now();
  const valid = candidates.filter(ms => ms <= nowMs + 60000);
  return valid.length ? Math.max(...valid) : null;
}

function nowLocalDatetimeInput() {
  const d = new Date(Date.now() - new Date().getTimezoneOffset() * 60000);
  return d.toISOString().slice(0, 16);
}

function ScheduleForm({ initialTime, initialCups, saving, onSave, onCancel }) {
  const [time, setTime] = useState(initialTime || '07:00');
  const [cups, setCups] = useState(initialCups ?? 1);

  const submit = (e) => {
    e.preventDefault();
    if (!time || !cups || cups <= 0) return;
    onSave(time, cups);
  };

  return (
    <form className="schedule-form" onSubmit={submit}>
      <div className="schedule-form__fields">
        <label className="schedule-form__field">
          <span className="schedule-form__label">Time</span>
          <input type="time" value={time} onChange={e => setTime(e.target.value)} required />
        </label>
        <label className="schedule-form__field">
          <span className="schedule-form__label">Amount</span>
          <CupsSelect value={cups} onChange={setCups} disabled={saving} ariaLabel="Cups" />
        </label>
      </div>
      <div className="schedule-form__actions">
        <button type="button" className="feeder-secondary-button" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
        <button type="submit" className="feeder-primary-button feeder-primary-button--sm" disabled={saving}>
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
        <button type="button" className="feeder-secondary-button" onClick={onCancel} disabled={saving}>
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
    lastFeeding,
    loading,
    error,
    feeding,
    pausing,
    mutating,
    schedulePaused,
    lastFedAt,
  } = feeder;

  const target = status?.target_meal_cups ?? null;
  const [editingId, setEditingId] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const [vacationOpen, setVacationOpen] = useState(false);
  const [delayHours, setDelayHours] = useState(0);
  const [delayMinutes, setDelayMinutes] = useState(30);

  const sortedSchedules = useMemo(
    () => (schedules || []).slice().sort((a, b) => (a.time || '').localeCompare(b.time || '')),
    [schedules]
  );

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

  const lastFedTs = extractLastFedTimestamp(lastFeeding, lastFedAt);
  const lastFedLine = lastFedTs
    ? `Last fed at ${formatTime(lastFedTs)} · ${formatRelative(Date.now() - lastFedTs)}`
    : null;

  const feedNowCaption = nextScheduled
    ? `Feeds ${labelForCups(nextScheduled.cups)} now and skips the ${formatScheduleTime(nextScheduled.time)} feeding.`
    : target != null
      ? `Feeds ${labelForCups(target)} now. No scheduled feedings to skip.`
      : 'Add a scheduled feeding or set target_meal_cups in your config first.';
  const canFeedNow = !!(nextScheduled || target != null);

  const moveTotalHours = Number(delayHours) + Number(delayMinutes) / 60;
  const shiftedLater = nextScheduled
    ? new Date(nextScheduled.fireAt.getTime() + moveTotalHours * 3600 * 1000)
    : null;
  const shiftedEarlier = nextScheduled
    ? new Date(nextScheduled.fireAt.getTime() - moveTotalHours * 3600 * 1000)
    : null;
  const nowMs = Date.now();
  const canMoveEarlier = !!shiftedEarlier && shiftedEarlier.getTime() > nowMs;
  const canMoveLater = !!shiftedLater;
  const movePreview = (() => {
    if (!nextScheduled) return 'No upcoming feedings to move.';
    if (moveTotalHours <= 0) return 'Enter an amount above.';
    const origLabel = formatScheduleTime(nextScheduled.time);
    if (canMoveEarlier) {
      return `Earlier: ${origLabel} → ${formatTime(shiftedEarlier.getTime())}. Later: ${origLabel} → ${formatTime(shiftedLater.getTime())}.`;
    }
    return `Later: ${origLabel} → ${formatTime(shiftedLater.getTime())}. (Earlier would land in the past.)`;
  })();

  const handleAdd = async (t, c) => {
    try { await feeder.addSchedule(t, c); setAddOpen(false); } catch { /* stay open */ }
  };
  const handleModify = async (id, t, c) => {
    try { await feeder.modifySchedule(id, t, c); setEditingId(null); } catch { /* stay open */ }
  };
  const handleDelete = async (id) => {
    if (!window.confirm('Delete this scheduled feeding?')) return;
    try { await feeder.deleteSchedule(id); } catch { /* surfaced */ }
  };
  const handleFeedNow = async () => {
    if (!canFeedNow) return;
    try { await feeder.feedNow(); } catch { /* surfaced */ }
  };
  const handleSkipNext = async () => {
    if (!nextScheduled) return;
    if (!window.confirm(
      `Skip the ${formatScheduleTime(nextScheduled.time)} feeding? It will restore automatically after that time passes.`
    )) return;
    try { await feeder.skipNext(); } catch { /* surfaced */ }
  };
  const moveNext = async (direction) => {
    if (moveTotalHours <= 0 || !nextScheduled) return;
    const hours = direction === 'earlier' ? -moveTotalHours : moveTotalHours;
    try {
      await feeder.delayNext(hours);
      setDelayHours(0);
      setDelayMinutes(30);
    } catch { /* surfaced */ }
  };
  const handleVacation = async (until) => {
    try { await feeder.pauseUntil(until); setVacationOpen(false); } catch { /* stay open */ }
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

      <section className="feeder-card feeder-card--hero">
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
        {lastFedLine && <p className="feeder-hero__last-fed">{lastFedLine}</p>}
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
              title={
                pauseUntilLocal
                  ? 'Vacation pause is active — use Resume in the banner above.'
                  : scheduleEmpty
                    ? 'Nothing to pause — add a scheduled feeding first.'
                    : undefined
              }
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
                            <span className="schedule-list__amount">{labelForCups(s.cups)}</span>
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
                  <span className="delay-row__label">Move next by</span>
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
                  </div>
                  <div className="delay-row__buttons">
                    <button
                      type="button"
                      className="move-button"
                      onClick={() => moveNext('earlier')}
                      disabled={mutating || moveTotalHours <= 0 || !canMoveEarlier}
                      title={
                        !canMoveEarlier && nextScheduled && moveTotalHours > 0
                          ? 'Moving earlier by that much would land in the past.'
                          : undefined
                      }
                    >
                      ← Earlier
                    </button>
                    <button
                      type="button"
                      className="move-button"
                      onClick={() => moveNext('later')}
                      disabled={mutating || moveTotalHours <= 0 || !canMoveLater}
                    >
                      Later →
                    </button>
                  </div>
                </div>
                <p className="feeder-meta">{movePreview}</p>
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

    </div>
  );
}
