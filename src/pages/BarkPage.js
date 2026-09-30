import React, { useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer,
} from 'recharts';
import { formatRelative } from '../lib/format';

const RANGES = [
  { label: '1h', hours: 1, bucketMinutes: 5 },
  { label: '24h', hours: 24, bucketMinutes: 60 },
  { label: '7d', hours: 24 * 7, bucketMinutes: 60 * 24 },
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

export default function BarkPage() {
  const {
    barkName, loading: connectionLoading, detectingFeatures, pendingProbes, bark,
  } = useOutletContext();
  const stillProbing =
    !barkName && pendingProbes && pendingProbes.sensor > 0;

  // All hooks must be called unconditionally per React rules-of-hooks.
  // bark may be undefined here on first render; guard with defaults.
  const {
    lastBarkAt = '', history = [], historyLoading = false,
    rangeHours = 24, setRangeHours = () => {}, refreshHistory = () => {},
  } = bark || {};

  const activeRange = RANGES.find((r) => r.hours === rangeHours) || RANGES[1];
  const data = useMemo(
    () => bucketBarks(history, activeRange.hours, activeRange.bucketMinutes),
    [history, activeRange],
  );
  const ticks = useMemo(() => {
    if (data.length < 3) return data.map((d) => d.label);
    return [data[0].label, data[Math.floor(data.length / 2)].label, data[data.length - 1].label];
  }, [data]);

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
    <div className="feeder-page feeder-page--wide">
      <section className="feeder-card bark-card">
        <button
          type="button"
          className="feeder-icon-button thermostat-readings__refresh"
          onClick={refreshHistory}
          disabled={historyLoading}
          aria-label="Refresh"
          title="Refresh"
        >
          ↻
        </button>
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
        </div>

        <div className="bark-stats">
          <div className="bark-stat">
            <span className="bark-stat__value">{totalInRange}</span>
            <span className="bark-stat__label">in {activeRange.label}</span>
          </div>
          <div className="bark-stat">
            <span className="bark-stat__value">{formatRelative(lastBarkAt) ?? 'never'}</span>
            <span className="bark-stat__label">last bark</span>
          </div>
        </div>

        <div className="bark-chart">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
              <XAxis
                dataKey="label"
                stroke="var(--text-muted)"
                fontSize={11}
                ticks={ticks}
              />
              <YAxis allowDecimals={false} stroke="var(--text-muted)" fontSize={11} width={28} />
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
