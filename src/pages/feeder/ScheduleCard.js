import React, { useState } from 'react';
import Toggle from '../../components/Toggle';
import { summarizeDays } from '../../components/DayPicker';
import { formatTime } from '../../lib/format';
import ScheduleForm from './ScheduleForm';
import { formatScheduleTime, labelForCups } from './helpers';

export default function ScheduleCard({ schedule, busy, onSave, onDelete, onToggleEnabled, onSetSkip }) {
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
