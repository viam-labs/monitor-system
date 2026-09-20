import React, { useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import Toggle from '../components/Toggle';
import TimeSelect from '../components/TimeSelect';
import DayPicker, { summarizeDays } from '../components/DayPicker';

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

function ScheduleForm({ initial, submitLabel, saving, onSave, onCancel }) {
  const [name, setName] = useState(initial.name || '');
  const [time, setTime] = useState(initial.time || '07:00');
  const [cups, setCups] = useState(initial.cups ?? 1);
  const [days, setDays] = useState(initial.days_of_week || []);

  const submit = (e) => {
    e.preventDefault();
    if (!time || !cups || cups <= 0) return;
    const payload = {
      time,
      cups,
      days_of_week: days,
      name: name.trim() || undefined,
    };
    if (initial.id) payload.id = initial.id;
    onSave(payload);
  };

  return (
    <form className="automation-card__form" onSubmit={submit}>
      <label className="automation-form__field">
        <span className="automation-form__label">Name</span>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          disabled={saving}
          placeholder={`Feed ${time}`}
          maxLength={40}
        />
      </label>

      <div className="automation-form__row">
        <label className="automation-form__field">
          <span className="automation-form__label">Time</span>
          <TimeSelect value={time} onChange={setTime} disabled={saving} />
        </label>
        <label className="automation-form__field">
          <span className="automation-form__label">Amount</span>
          <CupsSelect value={cups} onChange={setCups} disabled={saving} ariaLabel="Cups" />
        </label>
      </div>

      <div className="automation-form__field">
        <span className="automation-form__label">Days ({summarizeDays(days)})</span>
        <DayPicker value={days} onChange={setDays} disabled={saving} />
      </div>

      <div className="automation-card__actions">
        {onCancel && (
          <button type="button" className="feeder-secondary-button" onClick={onCancel} disabled={saving}>
            Cancel
          </button>
        )}
        <span className="automation-card__spacer" />
        <button type="submit" className="feeder-primary-button feeder-primary-button--sm" disabled={saving}>
          {saving ? 'Saving…' : submitLabel}
        </button>
      </div>
    </form>
  );
}

function ScheduleCard({ schedule, busy, onSave, onDelete, onToggleEnabled, onSetSkip }) {
  const [expanded, setExpanded] = useState(false);
  const enabled = schedule.enabled !== false;
  const skipping = !!schedule.skip_next_fire;
  const delayedUntil = schedule.delayed_until;
  const summary =
    `${formatScheduleTime(schedule.time)} · ${labelForCups(schedule.cups)} · ` +
    summarizeDays(schedule.days_of_week);

  return (
    <div className={'automation-card' + (enabled ? '' : ' automation-card--disabled')}>
      <div className="automation-card__header">
        <button
          type="button"
          className="automation-card__disclose"
          onClick={() => setExpanded(v => !v)}
          aria-expanded={expanded}
        >
          <span className={'automation-card__chevron' + (expanded ? ' automation-card__chevron--open' : '')}>›</span>
          <span className="automation-card__name">
            {schedule.name || `Feed ${schedule.time}`}
          </span>
          {skipping && <span className="automation-card__badge">skip next</span>}
          {delayedUntil && (
            <span className="automation-card__badge">
              delayed → {formatTime(delayedUntil)}
            </span>
          )}
        </button>
        <Toggle
          checked={enabled}
          onChange={(v) => onToggleEnabled(schedule.id, v)}
          disabled={busy}
          ariaLabel={`Enable ${schedule.name || schedule.time}`}
        />
      </div>

      <div className="automation-card__summary">{summary}</div>

      {expanded && (
        <>
          <ScheduleForm
            initial={schedule}
            submitLabel="Save"
            saving={busy}
            onSave={onSave}
          />
          <div className="automation-card__actions">
            <label className="automation-card__inline-toggle">
              <Toggle
                checked={skipping}
                onChange={(v) => onSetSkip(schedule.id, v)}
                disabled={busy}
                ariaLabel="Skip next fire"
              />
              <span className="automation-card__inline-toggle-label">Skip next fire</span>
            </label>
            <span className="automation-card__spacer" />
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
  const {
    feederName,
    loading: connectionLoading,
    detectingFeatures,
    pendingProbes,
    feeder,
  } = useOutletContext();
  const feederStillProbing = !feederName && pendingProbes && pendingProbes.generic > 0;
  const {
    status,
    schedules,
    lastFeeding,
    loading,
    error,
    feeding,
    pausing,
    mutating,
    lastFedAt,
  } = feeder;

  const target = status?.target_meal_cups ?? null;
  const [addOpen, setAddOpen] = useState(false);
  const [vacationOpen, setVacationOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
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
      if (s.enabled === false) continue;
      if (!s.time || !s.time.includes(':')) continue;
      const dows = s.days_of_week || [];
      const [h, m] = s.time.split(':').map(Number);
      for (let offset = 0; offset < 8; offset++) {
        const fire = new Date(now);
        fire.setDate(now.getDate() + offset);
        fire.setHours(h, m, 0, 0);
        if (fire <= now) continue;
        if (dows.length && !dows.includes((fire.getDay() + 6) % 7)) continue;
        if (bestFire === null || fire < bestFire) {
          bestFire = fire;
          best = { ...s, fireAt: fire };
        }
        break;
      }
    }
    return best;
  }, [schedules]);

  const missedFeeds = useMemo(() => {
    if (!schedules) return [];
    const nowMs = Date.now();
    const today = new Date();
    // Backend uses Mon=0..Sun=6; JS getDay() is Sun=0..Sat=6.
    const todayDow = (today.getDay() + 6) % 7;
    return schedules.filter(s => {
      if (s.enabled === false) return false;
      if (!s.time || !s.time.includes(':')) return false;
      const dows = s.days_of_week || [];
      if (dows.length && !dows.includes(todayDow)) return false;
      const [h, m] = s.time.split(':').map(Number);
      const fireToday = new Date(today);
      fireToday.setHours(h, m, 0, 0);
      if (fireToday.getTime() > nowMs) return false;
      const lastFiredMs = s.last_fired_at ? Date.parse(s.last_fired_at) : NaN;
      if (!Number.isNaN(lastFiredMs) && lastFiredMs >= fireToday.getTime()) {
        return false;
      }
      return nowMs - fireToday.getTime() > 30 * 60 * 1000;
    });
  }, [schedules]);

  if (connectionLoading || detectingFeatures || feederStillProbing) {
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
  const paused = !!status?.pause_until;
  // pause_until year 2099+ = indefinite pause (from Pause button). Show
  // the vacation banner only for a real date the user picked.
  const isVacation = !!status?.pause_until &&
    new Date(status.pause_until).getFullYear() < 2099;
  const pauseUntilLocal = isVacation ? formatVacationUntil(status.pause_until) : null;

  const lastFedTs = extractLastFedTimestamp(lastFeeding, lastFedAt);
  const lastFedLine = lastFedTs
    ? `Last fed at ${formatTime(lastFedTs)}`
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
  const movePreviewLines = (() => {
    if (!nextScheduled) return ['No upcoming feedings to move.'];
    if (moveTotalHours <= 0) return ['Enter an amount above.'];
    const origLabel = formatScheduleTime(nextScheduled.time);
    const laterLine = `Later: ${origLabel} → ${formatTime(shiftedLater.getTime())}.`;
    if (canMoveEarlier) {
      const earlierLine = `Earlier: ${origLabel} → ${formatTime(shiftedEarlier.getTime())}.`;
      return [earlierLine, laterLine];
    }
    return [laterLine, '(Earlier would land in the past.)'];
  })();

  const handleAdd = async (payload) => {
    try { await feeder.addSchedule(payload); setAddOpen(false); } catch { /* stay open */ }
  };
  const handleModify = async (payload) => {
    try { await feeder.modifySchedule(payload); } catch { /* surfaced */ }
  };
  const handleDelete = async (id) => {
    if (!window.confirm('Delete this scheduled feeding?')) return;
    try { await feeder.deleteSchedule(id); } catch { /* surfaced */ }
  };
  const handleToggleEnabled = async (id, enabled) => {
    try { await feeder.setScheduleEnabled(id, enabled); } catch { /* surfaced */ }
  };
  const handleSetSkip = async (id, skip) => {
    try { await feeder.setSkipNext(id, skip); } catch { /* surfaced */ }
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
      setMoveOpen(false);
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

      {missedFeeds.length > 0 && (
        <div className="feeder-banner feeder-banner--missed">
          Missed {missedFeeds.length} scheduled feed{missedFeeds.length === 1 ? '' : 's'} today
          {missedFeeds.map(s => ` (${formatScheduleTime(s.time)})`).join('')}
          . Pi may have been offline at fire time.
        </div>
      )}

      <section className="feeder-card">
        <div className="feeder-card__header">
          <h2 className="feeder-card__title">Schedule</h2>
          <div className="feeder-card__actions">
            <button
              type="button"
              className={
                'feeder-secondary-button' +
                (paused ? ' feeder-secondary-button--active' : '')
              }
              onClick={() => feeder.pauseSchedule(!paused)}
              disabled={pausing || scheduleEmpty || isVacation}
              title={
                isVacation
                  ? 'Vacation pause is active — use Resume in the banner above.'
                  : scheduleEmpty
                    ? 'Nothing to pause — add a scheduled feeding first.'
                    : undefined
              }
            >
              {paused ? 'Resume' : 'Pause'}
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
            {sortedSchedules.map(s => (
              <ScheduleCard
                key={s.id || s.time}
                schedule={s}
                busy={mutating}
                onSave={handleModify}
                onDelete={handleDelete}
                onToggleEnabled={handleToggleEnabled}
                onSetSkip={handleSetSkip}
              />
            ))}

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
                {!moveOpen ? (
                  <button
                    type="button"
                    className="feeder-secondary-button"
                    onClick={() => setMoveOpen(true)}
                    disabled={mutating || !nextScheduled}
                  >
                    Move next by…
                  </button>
                ) : (
                  <div className="delay-row">
                    <div className="delay-row__header">
                      <span className="delay-row__label">Move next by</span>
                      <button
                        type="button"
                        className="feeder-icon-button"
                        onClick={() => setMoveOpen(false)}
                        aria-label="Cancel"
                        title="Cancel"
                        disabled={mutating}
                      >
                        ✕
                      </button>
                    </div>
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
                    <div className="move-preview">
                      {movePreviewLines.map((line, i) => (
                        <p key={i} className="feeder-meta">{line}</p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {addOpen ? (
              <div className="automation-card automation-card--add">
                <ScheduleForm
                  initial={{ time: '07:00', cups: target ?? 1, days_of_week: [] }}
                  submitLabel="Add"
                  saving={mutating}
                  onSave={handleAdd}
                  onCancel={() => setAddOpen(false)}
                />
              </div>
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
    </div>
  );
}
