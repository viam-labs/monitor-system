import React, { useState } from 'react';
import TimeSelect from '../../components/TimeSelect';
import ScheduleFormShell from '../../components/ScheduleFormShell';

const K_MIN = 2200;
const K_MAX = 6500;

function clampPct(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
}
function clampK(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return K_MIN;
  return Math.max(K_MIN, Math.min(K_MAX, n));
}
function clampMin(v) {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return 1;
  return Math.max(1, Math.round(n));
}

export default function ScheduleForm({ initial, busy, submitLabel, onSubmit, onCancel }) {
  const [name, setName] = useState(initial.name || 'Schedule');
  const [time, setTime] = useState(initial.time || '06:30');
  const [days, setDays] = useState(initial.days_of_week || []);
  const [minutes, setMinutes] = useState(
    Math.max(1, Math.round((initial.duration_s ?? 1800) / 60)),
  );
  const [startPct, setStartPct] = useState(initial.start_brightness_pct ?? 1);
  const [startK, setStartK] = useState(initial.start_color_temp_k ?? 2200);
  const [targetPct, setTargetPct] = useState(initial.target_brightness_pct ?? 80);
  const [targetK, setTargetK] = useState(initial.target_color_temp_k ?? 4000);

  const submit = (e) => {
    e.preventDefault();
    if (!time) return;
    const payload = {
      name: name.trim() || 'Schedule',
      time,
      days_of_week: days,
      duration_s: clampMin(minutes) * 60,
      start_brightness_pct: clampPct(startPct),
      start_color_temp_k: clampK(startK),
      target_brightness_pct: clampPct(targetPct),
      target_color_temp_k: clampK(targetK),
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
        <span className="automation-form__label">Time</span>
        <TimeSelect value={time} onChange={setTime} disabled={busy} />
      </label>
      <label className="automation-form__field">
        <span className="automation-form__label">Over (min)</span>
        <input
          type="number"
          min="1"
          max="360"
          value={minutes}
          onChange={(e) => setMinutes(e.target.value)}
          disabled={busy}
        />
      </label>
      <label className="automation-form__field">
        <span className="automation-form__label">Start brightness (%)</span>
        <input
          type="number"
          min="0"
          max="100"
          value={startPct}
          onChange={(e) => setStartPct(e.target.value)}
          disabled={busy}
        />
      </label>
      <label className="automation-form__field">
        <span className="automation-form__label">Start temp (K)</span>
        <input
          type="number"
          min={K_MIN}
          max={K_MAX}
          step="50"
          value={startK}
          onChange={(e) => setStartK(e.target.value)}
          disabled={busy}
        />
      </label>
      <label className="automation-form__field">
        <span className="automation-form__label">Target brightness (%)</span>
        <input
          type="number"
          min="0"
          max="100"
          value={targetPct}
          onChange={(e) => setTargetPct(e.target.value)}
          disabled={busy}
        />
      </label>
      <label className="automation-form__field">
        <span className="automation-form__label">Target temp (K)</span>
        <input
          type="number"
          min={K_MIN}
          max={K_MAX}
          step="50"
          value={targetK}
          onChange={(e) => setTargetK(e.target.value)}
          disabled={busy}
        />
      </label>
    </ScheduleFormShell>
  );
}
