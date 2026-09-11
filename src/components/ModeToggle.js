import React from 'react';

// Emoji shows the destination mode — the mode you'll switch to when
// clicked — matching the convention for icon-only toggle buttons
// (like a mute icon that shows 🔇 when unmuted). So:
//   currently auto -> button shows 👆 (click to go manual)
//   currently manual -> button shows 🐾 (click to go auto)
export default function ModeToggle({ mode, onToggle }) {
  const isAuto = mode === 'auto';
  return (
    <button
      type="button"
      className="mode-toggle"
      onClick={onToggle}
      aria-label={isAuto ? 'Switch to manual mode' : 'Switch to auto mode'}
      title={isAuto ? 'Switch to manual — tap a feed to focus' : 'Switch to auto — follow motion'}
    >
      {isAuto ? '👆' : '🐾'}
    </button>
  );
}
