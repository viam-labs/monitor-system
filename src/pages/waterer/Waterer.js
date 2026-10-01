import React, { useEffect, useRef, useState } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import TopNav from '../../components/TopNav';
import BottomTabBar from '../../components/BottomTabBar';
import TimeSelect from '../../components/TimeSelect';
import ScheduleFormShell from '../../components/ScheduleFormShell';
import { summarizeDays } from '../../components/DayPicker';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { PAGE_CAMERAS } from '../../appConfig';
import { formatClock, formatRelative } from '../../lib/format';
import './Waterer.css';

const DEFAULT_DOSE_ML = 250;
const DOSE_OPTIONS_ML = [50, 100, 150, 200, 250, 300, 350, 400];

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
    <div className="waterer-cam">
      <video ref={videoRef} autoPlay playsInline muted />
      <span className="waterer-cam__tag">{cam.name}</span>
    </div>
  );
}

function ScheduleFields({ time, setTime, doseMl, setDoseMl, busy }) {
  return (
    <>
      <label className="automation-form__field">
        <span className="automation-form__label">Time</span>
        <TimeSelect value={time} onChange={setTime} disabled={busy} />
      </label>
      <label className="automation-form__field">
        <span className="automation-form__label">Amount</span>
        <select
          className="cups-select"
          value={doseMl}
          onChange={(e) => setDoseMl(e.target.value)}
          disabled={busy}
        >
          {!DOSE_OPTIONS_ML.includes(Number(doseMl)) && doseMl !== '' && (
            <option value={doseMl}>{doseMl} ml</option>
          )}
          {DOSE_OPTIONS_ML.map((ml) => (
            <option key={ml} value={ml}>{ml} ml</option>
          ))}
        </select>
      </label>
    </>
  );
}

function ScheduleForm({ initial, busy, submitLabel, onSubmit, onCancel }) {
  const [name, setName] = useState(initial.name || 'Dispense');
  const [time, setTime] = useState(initial.time || '08:00');
  const [doseMl, setDoseMl] = useState(
    typeof initial.dose_ml === 'number' ? String(initial.dose_ml) : String(DEFAULT_DOSE_ML),
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
    <ScheduleFormShell
      name={name}
      onNameChange={setName}
      days={days}
      onDaysChange={setDays}
      busy={busy}
      submitLabel={submitLabel}
      onSubmit={submit}
      onCancel={onCancel}
    >
      <ScheduleFields time={time} setTime={setTime} doseMl={doseMl} setDoseMl={setDoseMl} busy={busy} />
    </ScheduleFormShell>
  );
}

function ScheduleRow({ schedule, busy, onSave, onDelete, onToggleEnabled }) {
  const [expanded, setExpanded] = useState(false);
  const enabled = schedule.enabled !== false;
  const days = summarizeDays(schedule.days_of_week);
  const summary = `${formatClock(schedule.time)} · ${schedule.dose_ml} ml${days ? ` · ${days}` : ''}`;
  return (
    <>
      <div className="waterer-row">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          style={{ background: 'none', border: 'none', padding: 0, flex: 1, textAlign: 'left', cursor: 'pointer' }}
        >
          <div className="waterer-row__tx">
            <div className={'waterer-row__nm' + (enabled ? '' : ' waterer-row__nm--dim')}>{schedule.name}</div>
            <div className="waterer-row__sb">{summary}</div>
          </div>
        </button>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          disabled={busy}
          className={'waterer-sw' + (enabled ? '' : ' waterer-sw--off')}
          onClick={(e) => { e.stopPropagation(); onToggleEnabled(schedule.id, !enabled); }}
          aria-label={`Enable ${schedule.name}`}
        />
      </div>
      {expanded && (
        <div className="waterer-row__expanded">
          <ScheduleForm
            initial={schedule}
            busy={busy}
            submitLabel="Save"
            onSubmit={onSave}
          />
          <div style={{ marginTop: 12, textAlign: 'right' }}>
            <button
              type="button"
              className="waterer-row__act--danger"
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

export default function WatererPage() {
  const ctx = useOutletContext();
  const navigate = useNavigate();
  const mobile = useMediaQuery('(max-width: 700px)');
  const {
    cameras, streams, watererName,
    loading: connectionLoading, detectingFeatures, pendingProbes,
    waterer: w,
  } = ctx;
  const watererStillProbing = !watererName && pendingProbes && pendingProbes.generic > 0;
  const {
    mlPerSecond, maxDailyMl, dailyTotal, lastDispense, schedules, history,
    error, busy,
  } = w;
  const [addOpen, setAddOpen] = useState(false);
  const [dispenseMl, setDispenseMl] = useState(DEFAULT_DOSE_ML);
  const [recentPage, setRecentPage] = useState(0);
  const RECENT_PAGE_SIZE = 5;

  const availability = {
    '/feeder': !!ctx.feederName,
    '/waterer': !!ctx.watererName,
    '/thermostat': !!(ctx.acBotName && ctx.roomMeterName),
    '/curtain': !!ctx.curtainName,
    '/inventory': !!(ctx.inventoryName && ctx.inventoryStateSensorName),
    '/bark': !!ctx.barkName,
    '/door': !!ctx.doorUnlockName,
  };

  if (connectionLoading || detectingFeatures || watererStillProbing) {
    return (
      <div className="waterer">
        <TopNav availability={availability} />
        <div className="waterer__body">
          <div className="waterer-loader">🐾 🐾 🐾</div>
        </div>
        <BottomTabBar />
      </div>
    );
  }

  if (!watererName) {
    return (
      <div className="waterer">
        <TopNav availability={availability} />
        <div className="waterer__body">
          <div className="waterer-stub">
            <h1 className="waterer__title">Waterer</h1>
            <p>No waterer configured on this machine.</p>
          </div>
        </div>
        <BottomTabBar />
      </div>
    );
  }

  const dailyTotalMl = dailyTotal && typeof dailyTotal.ml === 'number' ? Math.round(dailyTotal.ml) : 0;
  const lastDispenseRel = lastDispense ? formatRelative(lastDispense.at) : null;
  const lastDispenseMl = lastDispense && typeof lastDispense.ml === 'number' ? Math.round(lastDispense.ml) : null;

  const ledeParts = [];
  ledeParts.push(`${dailyTotalMl} ml today`);
  if (maxDailyMl != null) ledeParts.push(`cap ${Math.round(maxDailyMl)} ml`);
  if (lastDispenseRel) {
    ledeParts.push(`last ${lastDispenseMl != null ? `${lastDispenseMl} ml ` : ''}${lastDispenseRel}`);
  }
  const lede = ledeParts.join(' · ');

  const handleAdd = async (payload) => {
    try { await w.addSchedule(payload); setAddOpen(false); } catch { /* stay open */ }
  };
  const handleSave = async (payload) => {
    try { await w.updateSchedule(payload); } catch { /* surfaced */ }
  };
  const handleDelete = async (id) => {
    if (!window.confirm('Delete this schedule?')) return;
    try { await w.deleteSchedule(id); } catch { /* surfaced */ }
  };
  const handleDispense = async () => {
    try { await w.dispenseMl(dispenseMl); w.refreshHistory?.(); } catch { /* surfaced */ }
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
    <div className="waterer">
      <TopNav availability={availability} />
      <div className="waterer__body">
        <div className="waterer__wide">
          {mobile && (
            <button
              type="button"
              className="waterer__back"
              onClick={() => navigate('/')}
              aria-label="Back to Home"
            >
              <ChevronLeft size={17} />
              Home
            </button>
          )}
          <h1 className="waterer__title">Waterer</h1>
          <p className="waterer__lede">{lede}</p>

          {error && <div className="waterer__banner">{error}</div>}

          <div className="waterer__cols">
            <div className="waterer__col">
              <div className="waterer__block">
                <select
                  className="waterer__dose"
                  value={dispenseMl}
                  onChange={(e) => setDispenseMl(Number(e.target.value))}
                  disabled={busy}
                >
                  {DOSE_OPTIONS_ML.map((ml) => (
                    <option key={ml} value={ml}>{ml} ml</option>
                  ))}
                </select>
                <button
                  type="button"
                  className="waterer__primary"
                  onClick={handleDispense}
                  disabled={busy}
                >
                  {busy ? 'Dispensing…' : `Dispense ${dispenseMl} ml`}
                </button>
                {mlPerSecond != null && (
                  <p className="waterer__hint">Flow rate {mlPerSecond.toFixed(1)} ml/sec.</p>
                )}
              </div>

              <div className="waterer__block">
                <p className="waterer__sect">Schedules</p>
                {schedules.length === 0 && !addOpen && (
                  <p className="waterer-empty">No schedules yet.</p>
                )}
                {schedules.map((s) => (
                  <ScheduleRow
                    key={s.id}
                    schedule={s}
                    busy={busy}
                    onSave={handleSave}
                    onDelete={handleDelete}
                    onToggleEnabled={w.setScheduleEnabled}
                  />
                ))}
                {addOpen ? (
                  <div className="waterer-row__expanded">
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
                    className="waterer-row__act--add"
                    onClick={() => setAddOpen(true)}
                    disabled={busy}
                  >
                    + Add schedule
                  </button>
                )}
              </div>
            </div>

            <div className="waterer__col">
              <CamPreview cameras={cameras} streams={streams} name={PAGE_CAMERAS.waterer} />
              <div className="waterer__block">
                <p className="waterer__sect">Recent</p>
                {allRecent.length === 0 ? (
                  <p className="waterer-empty">No dispenses recorded yet.</p>
                ) : (
                  recent.map((h, i) => {
                    const ms = h.at ? Date.parse(h.at) : NaN;
                    const when = Number.isNaN(ms) ? h.at : fmtDateTime(ms);
                    const ml = typeof h.ml === 'number' ? `${Math.round(h.ml)} ml` : '';
                    return (
                      <div key={`${h.at}-${i}`} className="waterer-row">
                        <div className="waterer-row__tx">
                          <div className="waterer-row__nm">{when}</div>
                          <div className="waterer-row__sb">{h.cause === 'scheduled' ? 'scheduled' : 'manual'}</div>
                        </div>
                        <span className="waterer-row__amt">{ml}</span>
                      </div>
                    );
                  })
                )}
                {allRecent.length > RECENT_PAGE_SIZE && (
                  <div className="waterer-pager">
                    <button
                      type="button"
                      onClick={() => setRecentPage((p) => Math.max(0, p - 1))}
                      disabled={safeRecentPage === 0}
                    >
                      ← Newer
                    </button>
                    <span className="waterer-pager__status">
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
