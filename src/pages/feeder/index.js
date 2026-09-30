import React, { useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import PageCamera from '../../components/PageCamera';
import { PAGE_CAMERAS } from '../../appConfig';
import { formatTime } from '../../lib/format';
import ScheduleCard from './ScheduleCard';
import ScheduleForm from './ScheduleForm';
import VacationForm from './VacationForm';
import {
  extractLastFedTimestamp,
  formatScheduleTime,
  formatVacationUntil,
  labelForCups,
} from './helpers';

export default function FeederPage() {
  const {
    cameras,
    streams,
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
        </div>

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

      {schedules && !scheduleEmpty && (
        <section className="feeder-card">
          <div className="feeder-card__header">
            <h2 className="feeder-card__title">Pause</h2>
          </div>
          <div className="feeder-action">
            <button
              type="button"
              className={
                'feeder-secondary-button feeder-secondary-button--full' +
                (paused ? ' feeder-secondary-button--active' : '')
              }
              onClick={() => feeder.pauseSchedule(!paused)}
              disabled={pausing || isVacation}
              title={
                isVacation
                  ? 'Vacation pause is active — use Resume in the banner above.'
                  : undefined
              }
            >
              {paused ? 'Resume schedule' : 'Pause schedule'}
            </button>
            <p className="feeder-action__desc">
              Stop all scheduled feedings until you manually resume.
            </p>
          </div>
          <div className="feeder-action">
            {!vacationOpen ? (
              <>
                <button
                  type="button"
                  className="feeder-secondary-button feeder-secondary-button--full"
                  onClick={() => setVacationOpen(true)}
                  disabled={mutating}
                >
                  Vacation…
                </button>
                <p className="feeder-action__desc">
                  Pause automatically until a specific date and time.
                </p>
              </>
            ) : (
              <VacationForm
                saving={mutating}
                onSubmit={handleVacation}
                onCancel={() => setVacationOpen(false)}
              />
            )}
          </div>
        </section>
      )}

      {schedules && !scheduleEmpty && (
        <section className="feeder-card">
          <div className="feeder-card__header">
            <h2 className="feeder-card__title">Next feeding</h2>
          </div>
          <div className="feeder-action">
            <button
              type="button"
              className="feeder-secondary-button feeder-secondary-button--full"
              onClick={handleSkipNext}
              disabled={mutating || !nextScheduled}
            >
              Skip next feeding
            </button>
            <p className="feeder-action__desc">
              Skip only the very next scheduled feeding. Later feedings still fire normally.
            </p>
          </div>
          <div className="feeder-action">
            {!moveOpen ? (
              <>
                <button
                  type="button"
                  className="feeder-secondary-button feeder-secondary-button--full"
                  onClick={() => setMoveOpen(true)}
                  disabled={mutating || !nextScheduled}
                >
                  Move next by…
                </button>
                <p className="feeder-action__desc">
                  Delay or advance the next scheduled feeding by hours.
                </p>
              </>
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
        </section>
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

      <PageCamera
        cameras={cameras}
        streams={streams}
        cameraName={PAGE_CAMERAS.feeder}
      />
    </div>
  );
}
