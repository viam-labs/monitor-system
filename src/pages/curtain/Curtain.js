import React, { useState } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import TopNav from '../../components/TopNav';
import BottomTabBar from '../../components/BottomTabBar';
import TimeSelect from '../../components/TimeSelect';
import ScheduleFormShell from '../../components/ScheduleFormShell';
import { summarizeDays } from '../../components/DayPicker';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { formatClock } from '../../lib/format';
import './Curtain.css';

const LOW_BATTERY_THRESHOLD = 20;

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
    initial.action === 'position' ? 'open' : (initial.action || 'open'),
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
      <label className="automation-form__field">
        <span className="automation-form__label">Action</span>
        <select
          className="cups-select"
          value={action}
          onChange={(e) => setAction(e.target.value)}
          disabled={busy}
        >
          <option value="open">Open</option>
          <option value="close">Close</option>
        </select>
      </label>
      <label className="automation-form__field">
        <span className="automation-form__label">Time</span>
        <TimeSelect value={time} onChange={setTime} disabled={busy} />
      </label>
    </ScheduleFormShell>
  );
}

function ScheduleRow({ schedule, busy, onSave, onDelete, onToggleEnabled }) {
  const [expanded, setExpanded] = useState(false);
  const enabled = schedule.enabled !== false;
  const days = summarizeDays(schedule.days_of_week);
  const summary = `${summarizeAction(schedule)} · ${formatClock(schedule.time)}${days ? ` · ${days}` : ''}`;
  return (
    <>
      <div className="curtain-row">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          style={{ background: 'none', border: 'none', padding: 0, flex: 1, textAlign: 'left', cursor: 'pointer' }}
        >
          <div className="curtain-row__tx">
            <div className={'curtain-row__nm' + (enabled ? '' : ' curtain-row__nm--dim')}>{schedule.name}</div>
            <div className="curtain-row__sb">{summary}</div>
          </div>
        </button>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          disabled={busy}
          className={'curtain-sw' + (enabled ? '' : ' curtain-sw--off')}
          onClick={(e) => { e.stopPropagation(); onToggleEnabled(schedule.id, !enabled); }}
          aria-label={`Enable ${schedule.name}`}
        />
      </div>
      {expanded && (
        <div className="curtain-row__expanded">
          <ScheduleForm
            initial={schedule}
            busy={busy}
            submitLabel="Save"
            onSubmit={onSave}
          />
          <div style={{ marginTop: 12, textAlign: 'right' }}>
            <button
              type="button"
              className="curtain-row__act--danger"
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

export default function CurtainPage() {
  const ctx = useOutletContext();
  const navigate = useNavigate();
  const mobile = useMediaQuery('(max-width: 700px)');
  const {
    curtainName,
    loading: connectionLoading,
    detectingFeatures,
    pendingProbes,
    curtain: c,
  } = ctx;
  const curtainStillProbing = !curtainName && pendingProbes && pendingProbes.generic > 0;
  const { position, battery, moving, schedules, error, busy } = c;
  const [addOpen, setAddOpen] = useState(false);

  const availability = {
    '/feeder': !!ctx.feederName,
    '/waterer': !!ctx.watererName,
    '/thermostat': !!(ctx.acBotName && ctx.roomMeterName),
    '/curtain': !!ctx.curtainName,
    '/inventory': !!(ctx.inventoryName && ctx.inventoryStateSensorName),
    '/bark': !!ctx.barkName,
    '/air': !!ctx.airName,
    '/door': !!ctx.doorUnlockName,
  };

  if (connectionLoading || detectingFeatures || curtainStillProbing) {
    return (
      <div className="curtain">
        <TopNav availability={availability} />
        <div className="curtain__body">
          <div className="curtain-loader">🐾 🐾 🐾</div>
        </div>
        <BottomTabBar />
      </div>
    );
  }

  if (!curtainName) {
    return (
      <div className="curtain">
        <TopNav availability={availability} />
        <div className="curtain__body">
          <div className="curtain-stub">
            <h1 className="curtain__title">Curtain</h1>
            <p>No SwitchBot Curtain configured on this machine.</p>
          </div>
        </div>
        <BottomTabBar />
      </div>
    );
  }

  const isOpen = typeof position === 'number' && position < 50;
  const stateLabel = typeof position !== 'number' ? '—' : isOpen ? 'open' : 'closed';
  const batteryLow = battery != null && battery <= LOW_BATTERY_THRESHOLD;

  const ledeParts = [stateLabel];
  if (battery != null) ledeParts.push(`${battery}% battery`);
  if (moving) ledeParts.push('moving…');
  const lede = ledeParts.join(' · ');

  const handleAdd = async (payload) => {
    try { await c.addSchedule(payload); setAddOpen(false); } catch { /* stay open */ }
  };
  const handleSave = async (payload) => {
    try { await c.updateSchedule(payload); } catch { /* surfaced */ }
  };
  const handleDelete = async (id) => {
    if (!window.confirm('Delete this schedule?')) return;
    try { await c.deleteSchedule(id); } catch { /* surfaced */ }
  };

  return (
    <div className="curtain">
      <TopNav availability={availability} />
      <div className="curtain__body">
        <div className="curtain__one">
          {mobile && (
            <button
              type="button"
              className="curtain__back"
              onClick={() => navigate('/')}
              aria-label="Back to Home"
            >
              <ChevronLeft size={17} />
              Home
            </button>
          )}
          <h1 className="curtain__title">Curtains</h1>
          <p className={'curtain__lede' + (batteryLow ? ' curtain__lede--low' : '')}>
            {batteryLow && '⚠ '}{lede}
          </p>

          {error && <div className="curtain__banner">{error}</div>}

          <div className="curtain__block">
            <button
              type="button"
              className="curtain__primary"
              onClick={isOpen ? c.close : c.open}
              disabled={busy}
            >
              {busy ? 'Sending…' : (isOpen ? 'Close' : 'Open')}
            </button>
          </div>

          <div className="curtain__block">
            <p className="curtain__sect">Schedules</p>
            {schedules.length === 0 && !addOpen && (
              <p className="curtain-empty">No schedules yet.</p>
            )}
            {schedules.map((s) => (
              <ScheduleRow
                key={s.id}
                schedule={s}
                busy={busy}
                onSave={handleSave}
                onDelete={handleDelete}
                onToggleEnabled={c.setScheduleEnabled}
              />
            ))}
            {addOpen ? (
              <div className="curtain-row__expanded">
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
                className="curtain-row__act--add"
                onClick={() => setAddOpen(true)}
                disabled={busy}
              >
                + Add schedule
              </button>
            )}
          </div>
        </div>
      </div>
      <BottomTabBar />
    </div>
  );
}
