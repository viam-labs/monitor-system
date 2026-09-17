import React from 'react';

// 0=Mon..6=Sun to match Python's datetime.weekday() and the module.
export const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function summarizeDays(days) {
  if (!days || days.length === 0 || days.length === 7) return 'every day';
  const set = new Set(days);
  const weekdays = [0, 1, 2, 3, 4];
  const weekend = [5, 6];
  if (weekdays.every(d => set.has(d)) && !set.has(5) && !set.has(6)) return 'weekdays';
  if (weekend.every(d => set.has(d)) && days.length === 2) return 'weekends';
  return days.map(d => DAY_LABELS[d]).join(', ');
}

export default function DayPicker({ value, onChange, disabled }) {
  const set = new Set(value || []);
  const toggle = (d) => {
    const next = new Set(set);
    if (next.has(d)) next.delete(d);
    else next.add(d);
    onChange([...next].sort((a, b) => a - b));
  };
  return (
    <div className="day-picker">
      {DAY_LABELS.map((label, i) => (
        <button
          key={label}
          type="button"
          className={'day-picker__chip' + (set.has(i) ? ' day-picker__chip--on' : '')}
          onClick={() => toggle(i)}
          disabled={disabled}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
