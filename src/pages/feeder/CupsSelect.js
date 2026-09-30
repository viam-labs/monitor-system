import React from 'react';
import { CUP_OPTIONS, labelForCups } from './helpers';

export default function CupsSelect({ value, onChange, disabled, id, ariaLabel }) {
  return (
    <select
      id={id}
      aria-label={ariaLabel}
      className="cups-select"
      value={value}
      onChange={e => onChange(Number(e.target.value))}
      disabled={disabled}
    >
      {CUP_OPTIONS.map(v => (
        <option key={v} value={v}>{labelForCups(v)}</option>
      ))}
    </select>
  );
}
