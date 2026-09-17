import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useFeeder } from '../hooks/useFeeder';

const CUP_OPTIONS = [
  { value: 0.125, label: '⅛' },
  { value: 0.25, label: '¼' },
  { value: 0.5, label: '½' },
  { value: 1, label: '1' },
];

function formatTime(ms) {
  if (!ms) return null;
  return new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function formatScheduleTime(hhmm) {
  if (!hhmm) return '';
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function formatCups(cups) {
  if (cups == null) return '';
  if (cups === Math.floor(cups)) return `${cups} cup${cups === 1 ? '' : 's'}`;
  return `${cups} cups`;
}

export default function FeederPage() {
  const { client, feederName, loading: connectionLoading } = useOutletContext();
  const feeder = useFeeder(client, feederName);
  const { status, schedules, loading, error, feeding, pausing, schedulePaused, lastFedAt } = feeder;

  const target = status?.target_meal_cups ?? null;
  const [cupsOverride, setCupsOverride] = useState(null);
  const cups = cupsOverride ?? target ?? 0.25;
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
      <h1 className="feeder-page__title">
        <span aria-hidden="true">🦴</span> {status?.name || 'Feeder'}
      </h1>

      <section className="feeder-card">
        {loading && !status && <p className="feeder-status__loading">Loading…</p>}
        {status && (
          <>
            <div className="feeder-row">
              <span className="feeder-row__label">Food</span>
              <span className={foodStateClass}>{status.food_state}</span>
            </div>
            {target != null && (
              <div className="feeder-row">
                <span className="feeder-row__label">Target meal</span>
                <span className="feeder-row__value">{formatCups(target)}</span>
              </div>
            )}
            {status.cached && (
              <p className="feeder-meta">
                Cached — refreshes at most once per 5 min.
              </p>
            )}
          </>
        )}
        {error && <p className="feeder-error">{error}</p>}
        <button
          type="button"
          className="feeder-secondary-button"
          onClick={feeder.refresh}
          disabled={loading || feeding}
        >
          Refresh
        </button>
      </section>

      <section className="feeder-card">
        <div className="feeder-card__header">
          <h2 className="feeder-card__title">Schedule</h2>
          <button
            type="button"
            className={
              'feeder-secondary-button' +
              (schedulePaused ? ' feeder-secondary-button--active' : '')
            }
            onClick={() => feeder.pauseSchedule(!schedulePaused)}
            disabled={pausing || !schedules}
          >
            {schedulePaused ? 'Resume' : 'Pause'}
          </button>
        </div>
        {loading && !schedules && <p className="feeder-status__loading">Loading…</p>}
        {schedules && schedules.length === 0 && (
          <p className="feeder-meta">No scheduled feedings.</p>
        )}
        {schedules && schedules.length > 0 && (
          <ul className="schedule-list">
            {schedules
              .slice()
              .sort((a, b) => (a.time || '').localeCompare(b.time || ''))
              .map(s => (
                <li key={s.id || s.time} className="schedule-list__item">
                  <span className="schedule-list__time">{formatScheduleTime(s.time)}</span>
                  <span className="schedule-list__amount">{formatCups(s.cups)}</span>
                </li>
              ))}
          </ul>
        )}
      </section>

      <section className="feeder-card feeder-card--controls">
        <div className="feeder-card__header">
          <h2 className="feeder-card__title">Manual feed</h2>
        </div>
        <div className="feeder-controls__cups" role="radiogroup" aria-label="Amount">
          {CUP_OPTIONS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={cups === value}
              className={
                'feeder-controls__cup' +
                (cups === value ? ' feeder-controls__cup--active' : '')
              }
              onClick={() => setCupsOverride(value)}
              disabled={feeding}
            >
              {label}
            </button>
          ))}
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
          className="feeder-primary-button"
          onClick={() => feeder.feed(cups, slow)}
          disabled={feeding}
        >
          {feeding ? 'Feeding…' : `Feed ${formatCups(cups)}`}
          <span aria-hidden="true" className="feeder-primary-button__emoji">🐶</span>
        </button>

        {lastFedAt && (
          <p className="feeder-meta feeder-meta--centered">
            Last fed at {formatTime(lastFedAt)} from this device.
          </p>
        )}
      </section>
    </div>
  );
}
