import React from 'react';

// iOS-style toggle switch. Wraps a checkbox for accessibility so it
// still works with keyboard + screen readers.
export default function Toggle({ checked, onChange, disabled, label, ariaLabel }) {
  const inner = (
    <>
      <input
        type="checkbox"
        checked={!!checked}
        onChange={e => onChange(e.target.checked)}
        disabled={disabled}
        aria-label={label ? undefined : ariaLabel}
      />
      <span className="toggle__track" aria-hidden="true">
        <span className="toggle__thumb" />
      </span>
      {label && <span className="toggle__label">{label}</span>}
    </>
  );
  return <label className={'toggle' + (disabled ? ' toggle--disabled' : '')}>{inner}</label>;
}
