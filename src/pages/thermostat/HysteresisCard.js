import React, { useEffect, useState } from 'react';
import Toggle from '../../components/Toggle';
import TimeSelect from '../../components/TimeSelect';
import DayPicker, { summarizeDays } from '../../components/DayPicker';
import { formatClock } from '../../lib/format';
import { celsiusToF, fToC, TEMP_OPTIONS_F } from './helpers';

export default function HysteresisCard({
  automation,
  isActive,
  isFirst,
  isLast,
  busy,
  onToggle,
  onSave,
  onDelete,
  onMoveUp,
  onMoveDown,
}) {
  const [expanded, setExpanded] = useState(false);
  const onF = Math.round(celsiusToF(automation.on_temp_c));
  const offF = Math.round(celsiusToF(automation.off_temp_c));

  const [name, setName] = useState(automation.name);
  const [onInput, setOnInput] = useState(String(onF));
  const [offInput, setOffInput] = useState(String(offF));
  const [startInput, setStartInput] = useState(automation.active_start || '');
  const [endInput, setEndInput] = useState(automation.active_end || '');
  const [days, setDays] = useState(automation.days_of_week || []);

  useEffect(() => setName(automation.name), [automation.name]);
  useEffect(() => setOnInput(String(onF)), [onF]);
  useEffect(() => setOffInput(String(offF)), [offF]);
  useEffect(() => setStartInput(automation.active_start || ''), [automation.active_start]);
  useEffect(() => setEndInput(automation.active_end || ''), [automation.active_end]);
  useEffect(() => setDays(automation.days_of_week || []), [automation.days_of_week]);

  const savedDays = automation.days_of_week || [];
  const daysDirty =
    days.length !== savedDays.length ||
    days.some((d, i) => d !== savedDays[i]);
  const dirty =
    name !== automation.name ||
    onInput !== String(onF) ||
    offInput !== String(offF) ||
    (startInput || '') !== (automation.active_start || '') ||
    (endInput || '') !== (automation.active_end || '') ||
    daysDirty;

  const modeText = automation.mode === 'cooling' ? 'Cooling' : 'Heating';
  const hoursText = automation.active_start && automation.active_end
    ? `${formatClock(automation.active_start)}–${formatClock(automation.active_end)}`
    : 'always';
  const summaryLines = [
    `${modeText} · on ${onF}° / off ${offF}°`,
    `${hoursText} · ${summarizeDays(savedDays)}`,
  ];

  const submit = (e) => {
    e.preventDefault();
    const onFVal = Number(onInput);
    const offFVal = Number(offInput);
    if (!Number.isFinite(onFVal) || !Number.isFinite(offFVal) || onFVal === offFVal) return;
    const start = startInput || null;
    const end = endInput || null;
    if ((start === null) !== (end === null)) return;
    const trimmedName = name.trim() || automation.name;
    onSave({
      id: automation.id,
      name: trimmedName,
      kind: 'hysteresis',
      on_temp_c: fToC(onFVal),
      off_temp_c: fToC(offFVal),
      active_start: start,
      active_end: end,
      days_of_week: days,
    });
  };

  const previewMode = (() => {
    const onN = Number(onInput);
    const offN = Number(offInput);
    if (!Number.isFinite(onN) || !Number.isFinite(offN) || onN === offN) return null;
    return onN > offN ? 'Cooling' : 'Heating';
  })();

  return (
    <div className={'automation-card' + (isActive ? ' automation-card--active' : '')}>
      <div className="automation-card__header">
        <button
          type="button"
          className="automation-card__disclose"
          onClick={() => setExpanded(v => !v)}
          aria-expanded={expanded}
        >
          <span className={'automation-card__chevron' + (expanded ? ' automation-card__chevron--open' : '')}>›</span>
          <span className="automation-card__name">{automation.name}</span>
        </button>
        <Toggle
          checked={automation.enabled}
          onChange={(v) => onToggle(automation.id, v)}
          disabled={busy}
          ariaLabel={`Enable ${automation.name}`}
        />
      </div>

      <div className="automation-card__summary">
        {summaryLines.map((line, i) => (
          <div key={i}>{line}</div>
        ))}
      </div>

      {expanded && (
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

          <div className="automation-form__section-title">Thresholds</div>
          <div className="automation-form__row">
            <label className="automation-form__field">
              <span className="automation-form__label">Turn on at</span>
              <select
                className="cups-select"
                value={onInput}
                onChange={e => setOnInput(e.target.value)}
                disabled={busy}
              >
                {TEMP_OPTIONS_F.map(f => (
                  <option key={f} value={f}>{f}°F</option>
                ))}
              </select>
            </label>
            <label className="automation-form__field">
              <span className="automation-form__label">Turn off at</span>
              <select
                className="cups-select"
                value={offInput}
                onChange={e => setOffInput(e.target.value)}
                disabled={busy}
              >
                {TEMP_OPTIONS_F.map(f => (
                  <option key={f} value={f}>{f}°F</option>
                ))}
              </select>
            </label>
          </div>
          {previewMode && previewMode !== modeText && (
            <p className="feeder-meta">Would be: <strong>{previewMode}</strong></p>
          )}

          <div className="automation-form__section-title">Active hours</div>
          <div className="automation-form__row">
            <label className="automation-form__field">
              <span className="automation-form__label">From</span>
              <TimeSelect
                value={startInput}
                onChange={setStartInput}
                disabled={busy}
                allowBlank
                blankLabel="Always"
              />
            </label>
            <label className="automation-form__field">
              <span className="automation-form__label">Until</span>
              <TimeSelect
                value={endInput}
                onChange={setEndInput}
                disabled={busy}
                allowBlank
                blankLabel="Always"
              />
            </label>
          </div>
          <p className="feeder-meta">
            {(!startInput && !endInput)
              ? 'Always active (both blank).'
              : 'Blank both to always be active.'}
          </p>

          <div className="automation-form__section-title">Days ({summarizeDays(days)})</div>
          <DayPicker value={days} onChange={setDays} disabled={busy} />

          <div className="automation-card__actions">
            <button
              type="button"
              className="feeder-icon-button"
              onClick={() => onMoveUp(automation.id)}
              disabled={busy || isFirst}
              aria-label="Move up"
              title="Move up (higher precedence)"
            >
              ↑
            </button>
            <button
              type="button"
              className="feeder-icon-button"
              onClick={() => onMoveDown(automation.id)}
              disabled={busy || isLast}
              aria-label="Move down"
              title="Move down"
            >
              ↓
            </button>
            <button
              type="button"
              className="feeder-icon-button feeder-icon-button--danger"
              onClick={() => onDelete(automation.id)}
              disabled={busy}
              aria-label="Delete automation"
              title="Delete"
            >
              ✕
            </button>
            <span className="automation-card__spacer" />
            <button
              type="submit"
              className="feeder-primary-button feeder-primary-button--sm"
              disabled={busy || !dirty}
            >
              {busy ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
