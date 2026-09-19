import React from 'react';
import { useOutletContext } from 'react-router-dom';
import { useDoorUnlock } from '../hooks/useDoorUnlock';

const LOW_BATTERY_THRESHOLD = 20;

function formatRelative(iso) {
  if (!iso) return null;
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return null;
  const diffSec = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (diffSec < 60) return 'just now';
  const min = Math.round(diffSec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr} hr ago`;
  const day = Math.round(hr / 24);
  return `${day} day${day === 1 ? '' : 's'} ago`;
}

function formatAbsolute(iso) {
  if (!iso) return null;
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return null;
  return new Date(ms).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });
}

export default function DoorUnlockPage() {
  const {
    client,
    doorUnlockName,
    loading: connectionLoading,
    detectingFeatures,
    pendingProbes,
  } = useOutletContext();
  const doorStillProbing =
    !doorUnlockName && pendingProbes && pendingProbes.generic > 0;

  const d = useDoorUnlock(client, doorUnlockName);
  const { lastOpenedAt, battery, loading, error, busy } = d;
  const batteryLow = battery != null && battery <= LOW_BATTERY_THRESHOLD;

  if (connectionLoading || detectingFeatures || doorStillProbing) {
    return (
      <div className="paw-loader" aria-label="Connecting">
        <span>🐾</span>
        <span>🐾</span>
        <span>🐾</span>
      </div>
    );
  }

  if (!doorUnlockName) {
    return (
      <div className="stub-page">
        <h1>Building Door</h1>
        <p>
          No clicker configured on this machine. Add a{' '}
          <code>viam:switchbot:clicker</code> generic component pointed at the
          SwitchBot Bot on your intercom's unlock button.
        </p>
      </div>
    );
  }

  const handleOpen = async () => {
    try { await d.unlock(); } catch { /* surfaced via error */ }
  };

  const lastOpenedRel = formatRelative(lastOpenedAt);
  const lastOpenedAbs = formatAbsolute(lastOpenedAt);

  return (
    <div className="feeder-page">
      {error && <p className="feeder-error feeder-error--banner">{error}</p>}

      <section className="feeder-card thermostat-readings">
        <button
          type="button"
          className="feeder-icon-button thermostat-readings__refresh"
          onClick={d.refresh}
          disabled={loading || busy}
          aria-label="Refresh"
          title="Refresh"
        >
          ↻
        </button>
        <div className="thermostat-temp">
          <span className="thermostat-temp__value">Building Door</span>
        </div>
        {(battery != null || lastOpenedAbs) && (
          <div className="thermostat-secondary">
            {battery != null && (
              <span
                className={
                  'thermostat-secondary__item battery-pill' +
                  (batteryLow ? ' battery-pill--low' : '')
                }
                title={batteryLow ? 'Clicker battery is low — charge soon.' : undefined}
              >
                {batteryLow && <span aria-hidden="true">⚠</span>}
                {battery}% battery
              </span>
            )}
            {lastOpenedRel && (
              <span
                className="thermostat-secondary__item"
                title={lastOpenedAbs}
              >
                Last opened {lastOpenedRel}
              </span>
            )}
          </div>
        )}
      </section>

      <section className="feeder-card">
        <button
          type="button"
          className="curtain-action curtain-action--open"
          onClick={handleOpen}
          disabled={busy}
        >
          {busy ? 'Opening…' : 'Open'}
        </button>
      </section>
    </div>
  );
}
