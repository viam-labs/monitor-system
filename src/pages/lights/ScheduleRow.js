import React, { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { summarizeDays } from '../../components/DayPicker';
import { ctToSwatch, formatClock } from './helpers';
import ScheduleForm from './ScheduleForm';

export default function ScheduleRow({ schedule, busy, onSave, onDelete, onToggleEnabled }) {
  const [expanded, setExpanded] = useState(false);
  const enabled = schedule.enabled !== false;
  const time = formatClock(schedule.time);
  const days = summarizeDays(schedule.days_of_week);
  const minutes = Math.round((schedule.duration_s || 0) / 60);
  const sub = [time, days || 'every day', `over ${minutes} min`].filter(Boolean).join(' · ');

  const startSwatch = ctToSwatch(schedule.start_color_temp_k, schedule.start_brightness_pct, true);
  const endSwatch = ctToSwatch(schedule.target_color_temp_k, schedule.target_brightness_pct, true);

  return (
    <div className="lights-ivw">
      <div className="lights-inv">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="lights-inv__btn"
        >
          <div className="lights-inv__tx">
            <div className={'lights-inv__nm' + (enabled ? '' : ' lights-inv__nm--dim')}>
              {schedule.name || 'Schedule'}
            </div>
            <div className="lights-inv__sb">{sub}{enabled ? '' : ' · paused'}</div>
          </div>
        </button>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          disabled={busy}
          className={'lights-sw' + (enabled ? '' : ' lights-sw--off')}
          onClick={(e) => { e.stopPropagation(); onToggleEnabled(schedule.id, !enabled); }}
          aria-label={`Enable ${schedule.name || 'schedule'}`}
        />
        <ChevronRight
          className={'lights-inv__chev' + (expanded ? ' lights-inv__chev--open' : '')}
          size={15}
          strokeWidth={2}
          onClick={() => setExpanded((v) => !v)}
        />
      </div>
      {expanded && (
        <div className="lights-xp">
          <div className="lights-ramp">
            <span className="lights-swatch-sm" style={{ background: startSwatch }} />
            <span className="lights-ramp__t">
              {Math.round(schedule.start_brightness_pct ?? 0)}% · {Math.round(schedule.start_color_temp_k ?? 0).toLocaleString()} K
            </span>
            <svg className="lights-ramp__arr" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
            <span className="lights-swatch-sm" style={{ background: endSwatch }} />
            <span className="lights-ramp__t">
              {Math.round(schedule.target_brightness_pct ?? 0)}% · {Math.round(schedule.target_color_temp_k ?? 0).toLocaleString()} K
            </span>
          </div>
          <ScheduleForm
            initial={schedule}
            busy={busy}
            submitLabel="Save"
            onSubmit={onSave}
          />
          <div className="lights-xp__footer">
            <button
              type="button"
              className="lights-row__act--danger"
              onClick={() => onDelete(schedule.id)}
              disabled={busy}
            >
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
