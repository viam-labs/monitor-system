import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import TopNav from '../../components/TopNav';
import BottomTabBar from '../../components/BottomTabBar';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { PAGE_CAMERAS } from '../../appConfig';
import { formatTime } from '../../lib/format';
import { summarizeDays } from '../../components/DayPicker';
import ScheduleForm from './ScheduleForm';
import VacationForm from './VacationForm';
import {
  extractLastFedTimestamp,
  formatScheduleTime,
  formatVacationUntil,
  labelForCups,
} from './helpers';
import './Feeder.css';

function fmtDateTime(ms) {
  const d = new Date(ms);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const y = new Date(today); y.setDate(y.getDate() - 1);
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (d >= today) return `Today ${time}`;
  if (d >= y) return `Yesterday ${time}`;
  return `${d.toLocaleDateString([], { weekday: 'short' })} ${time}`;
}

function CamPreview({ cameras, streams, name }) {
  const videoRef = useRef(null);
  const cam = cameras?.find((c) => c.name === name);
  const stream = cam ? streams?.[cam.name] : null;

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !stream) return undefined;
    el.muted = true;
    el.srcObject = stream;
    el.play().catch(() => {});
    return undefined;
  }, [stream]);

  if (!cam) return null;
  return (
    <div className="feeder-cam">
      <video ref={videoRef} autoPlay playsInline muted />
      <span className="feeder-cam__tag">{cam.name}</span>
    </div>
  );
}

function ScheduleRow({ schedule, busy, onSave, onDelete, onToggleEnabled }) {
  const [expanded, setExpanded] = useState(false);
  const enabled = schedule.enabled !== false;
  const days = summarizeDays(schedule.days_of_week);
  const summary = `${formatScheduleTime(schedule.time)} · ${labelForCups(schedule.cups)}${days ? ` · ${days}` : ''}`;
  const skipping = !!schedule.skip_next_fire;
  return (
    <>
      <div className="feeder-row">
        <button
          type="button"
          className="feeder-row__act feeder-row__act--add"
          onClick={() => setExpanded((v) => !v)}
          style={{ background: 'none', color: 'inherit' }}
        >
          <div className="feeder-row__tx">
            <div className={'feeder-row__nm' + (enabled ? '' : ' feeder-row__nm--dim')}>
              {schedule.name || `Feed ${schedule.time}`}
              {skipping && <span className="feeder-row__badge">skip next</span>}
            </div>
            <div className="feeder-row__sb">{summary}</div>
          </div>
        </button>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          disabled={busy}
          className={'feeder-sw' + (enabled ? '' : ' feeder-sw--off')}
          onClick={(e) => { e.stopPropagation(); onToggleEnabled(schedule.id, !enabled); }}
          aria-label={`Enable ${schedule.name || schedule.time}`}
        />
      </div>
      {expanded && (
        <div className="feeder-row__expanded">
          <ScheduleForm
            initial={schedule}
            submitLabel="Save"
            saving={busy}
            onSave={onSave}
          />
          <div style={{ marginTop: 12, textAlign: 'right' }}>
            <button
              type="button"
              className="feeder-row__act feeder-row__act--danger"
              onClick={() => onDelete(schedule.id)}
              disabled={busy}
            >
              Delete
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export default function FeederPage() {
  const ctx = useOutletContext();
  const navigate = useNavigate();
  const mobile = useMediaQuery('(max-width: 700px)');
  const {
    cameras,
    streams,
    feederName,
    loading: connectionLoading,
    detectingFeatures,
    pendingProbes,
    feeder,
  } = ctx;
  const feederStillProbing = !feederName && pendingProbes && pendingProbes.generic > 0;
  const {
    status, schedules, lastFeeding, history,
    loading, error, feeding, pausing, mutating, lastFedAt,
  } = feeder;

  const target = status?.target_meal_cups ?? null;
  const [addOpen, setAddOpen] = useState(false);
  const [vacationOpen, setVacationOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [delayHours, setDelayHours] = useState(0);
  const [delayMinutes, setDelayMinutes] = useState(30);
  const [recentPage, setRecentPage] = useState(0);
  const RECENT_PAGE_SIZE = 5;

  const sortedSchedules = useMemo(
    () => (schedules || []).slice().sort((a, b) => (a.time || '').localeCompare(b.time || '')),
    [schedules],
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
    const todayDow = (today.getDay() + 6) % 7;
    return schedules.filter((s) => {
      if (s.enabled === false) return false;
      if (!s.time || !s.time.includes(':')) return false;
      const dows = s.days_of_week || [];
      if (dows.length && !dows.includes(todayDow)) return false;
      const [h, m] = s.time.split(':').map(Number);
      const fireToday = new Date(today);
      fireToday.setHours(h, m, 0, 0);
      if (fireToday.getTime() > nowMs) return false;
      const lastFiredMs = s.last_fired_at ? Date.parse(s.last_fired_at) : NaN;
      if (!Number.isNaN(lastFiredMs) && lastFiredMs >= fireToday.getTime()) return false;
      return nowMs - fireToday.getTime() > 30 * 60 * 1000;
    });
  }, [schedules]);

  const availability = {
    '/feeder': !!ctx.feederName,
    '/waterer': !!ctx.watererName,
    '/thermostat': !!(ctx.acBotName && ctx.roomMeterName),
    '/curtain': !!ctx.curtainName,
    '/inventory': !!(ctx.inventoryName && ctx.inventoryStateSensorName),
    '/bark': !!ctx.barkName,
    '/door': !!ctx.doorUnlockName,
  };

  if (connectionLoading || detectingFeatures || feederStillProbing) {
    return (
      <div className="feeder">
        <TopNav availability={availability} />
        <div className="feeder__body">
          <div className="feeder-loader">🐾 🐾 🐾</div>
        </div>
        <BottomTabBar />
      </div>
    );
  }

  if (!feederName) {
    return (
      <div className="feeder">
        <TopNav availability={availability} />
        <div className="feeder__body">
          <div className="feeder-stub">
            <h1 className="feeder__title">Feeder</h1>
            <p>No feeder is configured on this machine.</p>
          </div>
        </div>
        <BottomTabBar />
      </div>
    );
  }

  const scheduleEmpty = !schedules || schedules.length === 0;
  const paused = !!status?.pause_until;
  const isVacation = !!status?.pause_until && new Date(status.pause_until).getFullYear() < 2099;
  const pauseUntilLocal = isVacation ? formatVacationUntil(status.pause_until) : null;

  const lastFedTs = extractLastFedTimestamp(lastFeeding, lastFedAt);
  const lastFedLine = lastFedTs ? `Last fed at ${formatTime(lastFedTs)}` : null;

  const feedNowCups = nextScheduled?.cups ?? target;
  const feedNowLabel = feedNowCups != null
    ? `Feed ${labelForCups(feedNowCups)} now`
    : 'Feed now';
  const canFeedNow = !!(nextScheduled || target != null);

  const ledeParts = [];
  if (nextScheduled) {
    ledeParts.push(`next meal ${formatScheduleTime(nextScheduled.time)}`);
    if (typeof nextScheduled.cups === 'number') ledeParts.push(labelForCups(nextScheduled.cups));
  }
  if (typeof status?.hopper_cups === 'number') {
    ledeParts.push(`hopper ${status.hopper_cups} cups`);
  }
  const lede = ledeParts.join(' · ') || (feederName ? 'ready' : '');

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
  const handleFeedNow = async () => {
    if (!canFeedNow) return;
    try { await feeder.feedNow(); feeder.refreshHistory?.(); } catch { /* surfaced */ }
  };
  const handleSkipNext = async () => {
    if (!nextScheduled) return;
    if (!window.confirm(
      `Skip the ${formatScheduleTime(nextScheduled.time)} feeding? It will restore automatically after that time passes.`,
    )) return;
    try { await feeder.skipNext(); } catch { /* surfaced */ }
  };
  const moveNext = async (direction) => {
    if (moveTotalHours <= 0 || !nextScheduled) return;
    const hours = direction === 'earlier' ? -moveTotalHours : moveTotalHours;
    try {
      await feeder.delayNext(hours);
      setDelayHours(0); setDelayMinutes(30); setMoveOpen(false);
    } catch { /* surfaced */ }
  };
  const handleVacation = async (until) => {
    try { await feeder.pauseUntil(until); setVacationOpen(false); } catch { /* stay open */ }
  };

  const allRecent = (history || []).slice().reverse();
  const totalRecentPages = Math.max(1, Math.ceil(allRecent.length / RECENT_PAGE_SIZE));
  const safeRecentPage = Math.min(recentPage, totalRecentPages - 1);
  const recent = allRecent.slice(
    safeRecentPage * RECENT_PAGE_SIZE,
    (safeRecentPage + 1) * RECENT_PAGE_SIZE,
  );
  const recentStart = allRecent.length === 0 ? 0 : safeRecentPage * RECENT_PAGE_SIZE + 1;
  const recentEnd = Math.min(allRecent.length, (safeRecentPage + 1) * RECENT_PAGE_SIZE);

  return (
    <div className="feeder">
      <TopNav availability={availability} />
      <div className="feeder__body">
        <div className="feeder__wide">
          {mobile && (
            <button
              type="button"
              className="feeder__back"
              onClick={() => navigate('/')}
              aria-label="Back to Home"
            >
              <ChevronLeft />
              Home
            </button>
          )}
          <h1 className="feeder__title">Feeder</h1>
          <p className="feeder__lede">{lede}</p>

          {error && <div className="feeder__banner feeder__banner--missed">{error}</div>}
          {pauseUntilLocal && (
            <div className="feeder__banner feeder__banner--vacation">
              <span>Paused until {pauseUntilLocal}</span>
              <button
                type="button"
                className="feeder__secondary"
                onClick={() => feeder.pauseSchedule(false)}
                disabled={pausing}
                style={{ width: 'auto' }}
              >
                Resume
              </button>
            </div>
          )}
          {missedFeeds.length > 0 && (
            <div className="feeder__banner feeder__banner--missed">
              Missed {missedFeeds.length} scheduled feed{missedFeeds.length === 1 ? '' : 's'} today
              {missedFeeds.map((s) => ` (${formatScheduleTime(s.time)})`).join('')}
              . Pi may have been offline at fire time.
            </div>
          )}

          <div className="feeder__cols">
            <div className="feeder__col">
              <div className="feeder__block">
                <button
                  type="button"
                  className="feeder__primary"
                  onClick={handleFeedNow}
                  disabled={feeding || mutating || !canFeedNow}
                >
                  {feeding || mutating ? 'Feeding…' : feedNowLabel}
                </button>
                {lastFedLine && <p className="feeder__hint">{lastFedLine}</p>}
              </div>

              <div className="feeder__block">
                <p className="feeder__sect">Schedule</p>
                {loading && !schedules && <p className="feeder-empty">Loading…</p>}
                {scheduleEmpty && !addOpen && (
                  <p className="feeder-empty">No scheduled feedings yet.</p>
                )}
                {sortedSchedules.map((s) => (
                  <ScheduleRow
                    key={s.id || s.time}
                    schedule={s}
                    busy={mutating}
                    onSave={handleModify}
                    onDelete={handleDelete}
                    onToggleEnabled={handleToggleEnabled}
                  />
                ))}
                {addOpen ? (
                  <div className="feeder-row__expanded">
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
                    className="feeder-row__act feeder-row__act--add"
                    onClick={() => setAddOpen(true)}
                    disabled={mutating}
                  >
                    + Add feeding
                  </button>
                )}
              </div>

              {schedules && !scheduleEmpty && (
                <div className="feeder__block">
                  <p className="feeder__sect">Next feeding</p>
                  <div className="feeder-row">
                    <div className="feeder-row__tx">
                      <div className="feeder-row__nm">Skip next</div>
                      <div className="feeder-row__sb">later feedings still fire</div>
                    </div>
                    <button
                      type="button"
                      className="feeder-row__act"
                      onClick={handleSkipNext}
                      disabled={mutating || !nextScheduled}
                    >
                      Skip
                    </button>
                  </div>
                  {!moveOpen ? (
                    <div className="feeder-row">
                      <div className="feeder-row__tx">
                        <div className="feeder-row__nm">Move next</div>
                        <div className="feeder-row__sb">delay or advance by hours</div>
                      </div>
                      <button
                        type="button"
                        className="feeder-row__act"
                        onClick={() => setMoveOpen(true)}
                        disabled={mutating || !nextScheduled}
                      >
                        Move
                      </button>
                    </div>
                  ) : (
                    <div className="feeder-move">
                      <div className="feeder-row__nm">Move next by</div>
                      <div className="feeder-move__inputs">
                        <input
                          type="number" min="0" max="23"
                          value={delayHours}
                          onChange={(e) => setDelayHours(Math.max(0, Math.min(23, Number(e.target.value) || 0)))}
                          aria-label="Hours"
                          disabled={mutating}
                        />
                        <span>hr</span>
                        <input
                          type="number" min="0" max="59"
                          value={delayMinutes}
                          onChange={(e) => setDelayMinutes(Math.max(0, Math.min(59, Number(e.target.value) || 0)))}
                          aria-label="Minutes"
                          disabled={mutating}
                        />
                        <span>min</span>
                      </div>
                      <div className="feeder-move__buttons">
                        <button
                          type="button"
                          onClick={() => moveNext('earlier')}
                          disabled={mutating || moveTotalHours <= 0 || !canMoveEarlier}
                        >
                          ← Earlier
                        </button>
                        <button
                          type="button"
                          onClick={() => moveNext('later')}
                          disabled={mutating || moveTotalHours <= 0 || !canMoveLater}
                        >
                          Later →
                        </button>
                        <button
                          type="button"
                          onClick={() => setMoveOpen(false)}
                          disabled={mutating}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {schedules && !scheduleEmpty && (
                <div className="feeder__block">
                  <p className="feeder__sect">Pause</p>
                  <div className="feeder-row">
                    <div className="feeder-row__tx">
                      <div className="feeder-row__nm">Pause schedule</div>
                      <div className="feeder-row__sb">until you resume manually</div>
                    </div>
                    <button
                      type="button"
                      className="feeder-row__act"
                      onClick={() => feeder.pauseSchedule(!paused)}
                      disabled={pausing || isVacation}
                    >
                      {paused && !isVacation ? 'Resume' : 'Pause'}
                    </button>
                  </div>
                  {!vacationOpen ? (
                    <div className="feeder-row">
                      <div className="feeder-row__tx">
                        <div className="feeder-row__nm">Vacation</div>
                        <div className="feeder-row__sb">pause until a set date</div>
                      </div>
                      <button
                        type="button"
                        className="feeder-row__act"
                        onClick={() => setVacationOpen(true)}
                        disabled={mutating}
                      >
                        Set
                      </button>
                    </div>
                  ) : (
                    <div className="feeder-row__expanded">
                      <VacationForm
                        saving={mutating}
                        onSubmit={handleVacation}
                        onCancel={() => setVacationOpen(false)}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="feeder__col">
              <CamPreview
                cameras={cameras}
                streams={streams}
                name={PAGE_CAMERAS.feeder}
              />
              <div className="feeder__block">
                <p className="feeder__sect">Recent</p>
                {allRecent.length === 0 ? (
                  <p className="feeder-empty">No feedings recorded yet.</p>
                ) : (
                  recent.map((h, i) => {
                    const ms = h.at ? Date.parse(h.at) : NaN;
                    const when = Number.isNaN(ms) ? h.at : fmtDateTime(ms);
                    const cups = typeof h.cups === 'number' ? labelForCups(h.cups) : '';
                    return (
                      <div key={`${h.at}-${i}`} className="feeder-row">
                        <div className="feeder-row__tx">
                          <div className="feeder-row__nm">{when}</div>
                        </div>
                        <span className="feeder-row__amt">{cups}</span>
                      </div>
                    );
                  })
                )}
                {allRecent.length > RECENT_PAGE_SIZE && (
                  <div className="feeder-pager">
                    <button
                      type="button"
                      onClick={() => setRecentPage((p) => Math.max(0, p - 1))}
                      disabled={safeRecentPage === 0}
                    >
                      ← Newer
                    </button>
                    <span className="feeder-pager__status">
                      {recentStart}–{recentEnd} of {allRecent.length}
                    </span>
                    <button
                      type="button"
                      onClick={() => setRecentPage((p) => Math.min(totalRecentPages - 1, p + 1))}
                      disabled={safeRecentPage >= totalRecentPages - 1}
                    >
                      Older →
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      <BottomTabBar />
    </div>
  );
}
