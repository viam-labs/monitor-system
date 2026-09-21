import React, { useMemo } from 'react';

// 15-minute HH:MM values. Native <input type="time"> looks fine on
// desktop but on iOS/mobile the picker chrome fights the dark theme
// and ends up looking washed out — a plain <select> matches the
// existing temperature dropdowns.
const TIME_VALUES = (() => {
  const out = [];
  for (let h = 0; h < 24; h++) {
    for (const m of [0, 15, 30, 45]) {
      out.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    }
  }
  return out;
})();

function formatLabel(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export default function TimeSelect({
  value,
  onChange,
  disabled,
  allowBlank = false,
  blankLabel = '—',
  className = '',
}) {
  const options = useMemo(() => TIME_VALUES.map(v => ({ v, label: formatLabel(v) })), []);

  // If the caller has an off-grid value (e.g., 07:05 from an older
  // config), include it as an extra option so we round-trip it losslessly.
  const extra = value && !TIME_VALUES.includes(value) ? value : null;

  return (
    <select
      className={('cups-select ' + className).trim()}
      value={value || ''}
      onChange={e => onChange(e.target.value)}
      disabled={disabled}
    >
      {allowBlank && <option value="">{blankLabel}</option>}
      {extra && <option value={extra}>{formatLabel(extra)}</option>}
      {options.map(o => (
        <option key={o.v} value={o.v}>{o.label}</option>
      ))}
    </select>
  );
}
