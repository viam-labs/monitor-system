import React, { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useCurtain } from '../hooks/useCurtain';

// SwitchBot semantics: 0 = fully open, 100 = fully closed. The UI is
// friendlier if we present it inverted: 100% "open" = fully open.
function apiToOpenPercent(slide) {
  if (typeof slide !== 'number') return null;
  return Math.max(0, Math.min(100, 100 - slide));
}

function openPercentToApi(openPct) {
  return Math.max(0, Math.min(100, 100 - openPct));
}

export default function CurtainPage() {
  const { client, curtainName, loading: connectionLoading } = useOutletContext();
  const c = useCurtain(client, curtainName);
  const { position, battery, moving, loading, error, busy } = c;

  const openPercent = apiToOpenPercent(position);
  const [sliderValue, setSliderValue] = useState(openPercent ?? 50);

  useEffect(() => {
    if (openPercent != null) setSliderValue(openPercent);
  }, [openPercent]);

  if (connectionLoading) {
    return (
      <div className="paw-loader" aria-label="Connecting">
        <span>🐾</span>
        <span>🐾</span>
        <span>🐾</span>
      </div>
    );
  }

  if (!curtainName) {
    return (
      <div className="stub-page">
        <h1>Curtain</h1>
        <p>
          No SwitchBot Curtain configured on this machine. Add a{' '}
          <code>viam:switchbot:curtain</code> generic component.
        </p>
      </div>
    );
  }

  const commitPosition = () => {
    if (sliderValue === openPercent) return;
    c.setSlidePosition(openPercentToApi(sliderValue));
  };

  return (
    <div className="feeder-page">
      <div className="feeder-topbar">
        <span className="feeder-meta">
          {loading && position == null ? 'Loading…' : ''}
        </span>
        <div className="feeder-topbar__actions">
          <button
            type="button"
            className="feeder-icon-button"
            onClick={c.refresh}
            disabled={loading || busy}
            aria-label="Refresh"
            title="Refresh"
          >
            ↻
          </button>
        </div>
      </div>

      {error && <p className="feeder-error feeder-error--banner">{error}</p>}

      <section className="feeder-card thermostat-readings">
        <div className="thermostat-temp">
          <span className="thermostat-temp__value">
            {openPercent != null ? openPercent : '—'}
          </span>
          <span className="thermostat-temp__unit">% open</span>
        </div>
        <div className="thermostat-secondary">
          {battery != null && (
            <span className="thermostat-secondary__item">{battery}% battery</span>
          )}
          {moving && (
            <span className="thermostat-secondary__item">moving…</span>
          )}
        </div>
      </section>

      <section className="feeder-card">
        <div className="feeder-card__header">
          <h2 className="feeder-card__title">Position</h2>
        </div>
        <div className="thermostat-buttons">
          <button
            type="button"
            className="thermostat-button"
            onClick={c.open}
            disabled={busy}
          >
            {busy ? 'Sending…' : 'Open'}
          </button>
          <button
            type="button"
            className="thermostat-button"
            onClick={c.pause}
            disabled={busy}
          >
            Pause
          </button>
          <button
            type="button"
            className="thermostat-button"
            onClick={c.close}
            disabled={busy}
          >
            Close
          </button>
        </div>

        <label className="curtain-slider">
          <span className="curtain-slider__label">
            Set to {sliderValue}% open
          </span>
          <input
            type="range"
            min="0"
            max="100"
            step="5"
            value={sliderValue}
            onChange={e => setSliderValue(Number(e.target.value))}
            onMouseUp={commitPosition}
            onTouchEnd={commitPosition}
            disabled={busy}
          />
        </label>

        <p className="feeder-meta feeder-meta--centered">
          Slide to a specific opening, release to send. 0% = fully closed, 100% = fully open.
        </p>
      </section>
    </div>
  );
}
