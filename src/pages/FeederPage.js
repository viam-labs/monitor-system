import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useFeeder } from '../hooks/useFeeder';

const CUP_OPTIONS = [0.125, 0.25, 0.5, 1];

function formatTime(ms) {
  if (!ms) return null;
  return new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export default function FeederPage() {
  const { client, feederName, loading: connectionLoading } = useOutletContext();
  const { status, loading, error, feeding, lastFedAt, feed, refresh } = useFeeder(client, feederName);
  const [cups, setCups] = useState(0.25);
  const [slow, setSlow] = useState(false);

  if (connectionLoading) {
    return (
      <div className="paw-loader" aria-label="Connecting">
        <span>🐾</span>
        <span>🐾</span>
        <span>🐾</span>
      </div>
    );
  }

  if (!feederName) {
    return (
      <div className="stub-page">
        <h1>Feeder</h1>
        <p>No feeder is configured on this machine.</p>
      </div>
    );
  }

  const foodStateClass = status
    ? `feeder-status__pill feeder-status__pill--${status.food_state}`
    : 'feeder-status__pill';

  return (
    <div className="feeder-page">
      <h1 className="feeder-page__title">{status?.name || 'Feeder'}</h1>

      <div className="feeder-status">
        {loading && !status && <p className="feeder-status__loading">Loading…</p>}
        {status && (
          <>
            <div className="feeder-status__row">
              <span className="feeder-status__label">Food</span>
              <span className={foodStateClass}>{status.food_state}</span>
            </div>
            <div className="feeder-status__row">
              <span className="feeder-status__label">Battery</span>
              <span className="feeder-status__value">{status.battery_level}%</span>
            </div>
            {status.cached && (
              <p className="feeder-status__meta">
                Cached — module refreshes at most once per 5 min.
              </p>
            )}
          </>
        )}
        {error && <p className="feeder-status__error">{error}</p>}
        <button
          type="button"
          className="feeder-status__refresh"
          onClick={refresh}
          disabled={loading || feeding}
        >
          Refresh
        </button>
      </div>

      <div className="feeder-controls">
        <div className="feeder-controls__section">
          <label className="feeder-controls__label">Amount</label>
          <div className="feeder-controls__cups">
            {CUP_OPTIONS.map(v => (
              <button
                key={v}
                type="button"
                className={
                  'feeder-controls__cup' +
                  (cups === v ? ' feeder-controls__cup--active' : '')
                }
                onClick={() => setCups(v)}
                disabled={feeding}
              >
                {v} cup{v === 1 ? '' : 's'}
              </button>
            ))}
          </div>
        </div>

        <label className="feeder-controls__slow">
          <input
            type="checkbox"
            checked={slow}
            onChange={e => setSlow(e.target.checked)}
            disabled={feeding}
          />
          Slow feed
        </label>

        <button
          type="button"
          className="feeder-controls__feed"
          onClick={() => feed(cups, slow)}
          disabled={feeding}
        >
          {feeding ? 'Feeding…' : `Feed ${cups} cup${cups === 1 ? '' : 's'}`}
        </button>

        {lastFedAt && (
          <p className="feeder-controls__last-fed">
            Last fed at {formatTime(lastFedAt)} from this device.
          </p>
        )}
      </div>
    </div>
  );
}
