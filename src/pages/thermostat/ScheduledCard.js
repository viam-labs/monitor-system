import React, { useEffect, useState } from 'react';
import Toggle from '../../components/Toggle';
import TimeSelect from '../../components/TimeSelect';
import DayPicker, { summarizeDays } from '../../components/DayPicker';
import { formatClock } from '../../lib/format';
import { findScheduledConflict } from './helpers';

export default function ScheduledCard({
  automation,
  allAutomations,
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
  const [name, setName] = useState(automation.name);
  const [action, setAction] = useState(automation.action || 'off');
  const [time, setTime] = useState(automation.time || '07:00');
  const [days, setDays] = useState(automation.days_of_week || []);

  useEffect(() => setName(automation.name), [automation.name]);
  useEffect(() => setAction(automation.action || 'off'), [automation.action]);
  useEffect(() => setTime(automation.time || '07:00'), [automation.time]);
  useEffect(() => setDays(automation.days_of_week || []), [automation.days_of_week]);

  const savedDays = automation.days_of_week || [];
  const daysDirty =
    days.length !== savedDays.length || days.some((d, i) => d !== savedDays[i]);
  const dirty =
    name !== automation.name ||
    action !== (automation.action || 'off') ||
    time !== (automation.time || '07:00') ||
    daysDirty;

  const conflict = findScheduledConflict(
    { time, action, days_of_week: days },
    allAutomations,
    automation.id,
  );

  const summaryLines = [
    `Turn ${(automation.action || 'off').toUpperCase()} at ${formatClock(automation.time)}`,
    summarizeDays(savedDays),
  ];

  const submit = (e) => {
    e.preventDefault();
    if (conflict?.level === 'block') return;
    onSave({
      id: automation.id,
      name: name.trim() || automation.name,
      kind: 'scheduled',
      action,
      time,
      days_of_week: days,
    });
  };

  return (
    <div className="automation-card">
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

          <div className="automation-form__row">
            <label className="automation-form__field">
              <span className="automation-form__label">Action</span>
              <select
                className="cups-select"
                value={action}
                onChange={e => setAction(e.target.value)}
                disabled={busy}
              >
                <option value="on">Turn ON</option>
                <option value="off">Turn OFF</option>
              </select>
            </label>
            <label className="automation-form__field">
              <span className="automation-form__label">Time</span>
              <TimeSelect value={time} onChange={setTime} disabled={busy} />
            </label>
          </div>

          <div className="automation-form__field">
            <span className="automation-form__label">Days ({summarizeDays(days)})</span>
            <DayPicker value={days} onChange={setDays} disabled={busy} />
          </div>

          {conflict && (
            <p className={
              conflict.level === 'block'
                ? 'feeder-error feeder-error--banner'
                : 'feeder-meta'
            }>
              {conflict.level === 'block'
                ? `Conflicts with "${conflict.other.name}" — same time, opposite action.`
                : `Same time and action as "${conflict.other.name}"; second entry is redundant.`}
            </p>
          )}

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
              disabled={busy || !dirty || conflict?.level === 'block'}
            >
              {busy ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
