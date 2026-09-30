import React, { useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer,
} from 'recharts';

const RANGES = [
  { label: '1h', hours: 1, bucketMinutes: 5 },
  { label: '24h', hours: 24, bucketMinutes: 60 },
  { label: '7d', hours: 24 * 7, bucketMinutes: 60 * 6 },
];

function bucketBarks(events, hours, bucketMinutes) {
  const now = Date.now();
  const start = now - hours * 60 * 60 * 1000;
  const size = bucketMinutes * 60 * 1000;
  const nBuckets = Math.ceil((hours * 60) / bucketMinutes);

  const buckets = new Array(nBuckets).fill(0).map((_, i) => ({
    ts: start + i * size,
    count: 0,
  }));

  for (const e of events) {
    const t = e.at.getTime();
    if (t < start || t > now) continue;
    const idx = Math.min(buckets.length - 1, Math.floor((t - start) / size));
    buckets[idx].count += 1;
  }
  return buckets.map((b) => ({
    label: labelForBucket(new Date(b.ts), hours, bucketMinutes),
    count: b.count,
  }));
}

function labelForBucket(d, hours, bucketMinutes) {
  if (hours <= 1) {
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
  if (hours <= 24) {
    return d.toLocaleTimeString([], { hour: 'numeric' });
  }
  return d.toLocaleDateString([], { weekday: 'short' });
}

function formatRelative(iso) {
  if (!iso) return 'never';
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return 'never';
  const diffSec = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (diffSec < 60) return 'just now';
  const min = Math.round(diffSec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr} hr ago`;
  const day = Math.round(hr / 24);
  return `${day} day${day === 1 ? '' : 's'} ago`;
}

export default function BarkPage() {
  const {
    barkName, loading: connectionLoading, detectingFeatures, pendingProbes, bark,
  } = useOutletContext();
  const stillProbing =
    !barkName && pendingProbes && pendingProbes.sensor > 0;

  // All hooks must be called unconditionally per React rules-of-hooks.
  // bark may be undefined here on first render; guard with defaults.
  const {
    lastBarkAt = '', sessionCount = 0, history = [], historyLoading = false,
    rangeHours = 24, setRangeHours = () => {}, refreshHistory = () => {},
  } = bark || {};

  const activeRange = RANGES.find((r) => r.hours === rangeHours) || RANGES[1];
  const data = useMemo(
    () => bucketBarks(history, activeRange.hours, activeRange.bucketMinutes),
    [history, activeRange],
  );

  if (connectionLoading || detectingFeatures || stillProbing) {
    return (
      <div className="paw-loader" aria-label="Connecting">
        <span>🐾</span><span>🐾</span><span>🐾</span>
      </div>
    );
  }

  if (!barkName) {
    return (
      <div className="stub-page">
        <h1>Bark detection</h1>
        <p>
          No bark detector configured on this machine. Add a{' '}
          <code>joseph:bark-detector:sensor</code> paired with an audio_in and
          an event-queue sensor.
        </p>
      </div>
    );
  }

  const totalInRange = history.length;

  return (
    <div className="feeder-page">
      <section className="feeder-card">
        <div className="feeder-card__header">
          <h2 className="feeder-card__title">Barks in the last {activeRange.label}</h2>
          <div className="bark-range-select">
            {RANGES.map((r) => (
              <button
                key={r.label}
                type="button"
                className={
                  'feeder-secondary-button feeder-secondary-button--sm'
                  + (r.hours === rangeHours ? ' feeder-secondary-button--active' : '')
                }
                onClick={() => setRangeHours(r.hours)}
              >
                {r.label}
              </button>
            ))}
            <button
              type="button"
              className="feeder-icon-button"
              onClick={refreshHistory}
              disabled={historyLoading}
              aria-label="Refresh"
              title="Refresh"
            >
              ↻
            </button>
          </div>
        </div>

        <div className="bark-stats">
          <div className="bark-stat">
            <span className="bark-stat__value">{totalInRange}</span>
            <span className="bark-stat__label">in {activeRange.label}</span>
          </div>
          <div className="bark-stat">
            <span className="bark-stat__value">{sessionCount}</span>
            <span className="bark-stat__label">since page load</span>
          </div>
          <div className="bark-stat">
            <span className="bark-stat__value">{formatRelative(lastBarkAt)}</span>
            <span className="bark-stat__label">last bark</span>
          </div>
        </div>

        <div className="bark-chart">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
              <XAxis dataKey="label" stroke="var(--text-muted)" fontSize={11} />
              <YAxis allowDecimals={false} stroke="var(--text-muted)" fontSize={11} />
              <Tooltip
                contentStyle={{
                  background: 'var(--bg)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: 6,
                }}
              />
              <Bar dataKey="count" fill="#f4a261" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  );
}
