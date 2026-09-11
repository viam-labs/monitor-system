import React from 'react';

// Emoji signals the current mode:
//   🐾  auto — following the pawprints
//   👆  manual — you tap
export default function ModeToggle({ mode, onToggle }) {
  const isAuto = mode === 'auto';
  return (
    <button
      type="button"
      className="mode-toggle"
      onClick={onToggle}
      aria-label={isAuto ? 'Switch to manual mode' : 'Switch to auto mode'}
      title={isAuto ? 'Auto — following motion' : 'Manual — tap a feed to focus'}
    >
      {isAuto ? '🐾' : '👆'}
    </button>
  );
}
