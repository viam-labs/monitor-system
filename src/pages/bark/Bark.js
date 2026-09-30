import React, { useMemo } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer,
} from 'recharts';
import TopNav from '../../components/TopNav';
import BottomTabBar from '../../components/BottomTabBar';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { formatRelative } from '../../lib/format';
import './Bark.css';

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

function labelForBucket(d, hours) {
  if (hours <= 1) return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (hours <= 24) return d.toLocaleTimeString([], { hour: 'numeric' });
  return d.toLocaleDateString([], { weekday: 'short' });
}

export default function BarkPage() {
  const ctx = useOutletContext();
  const navigate = useNavigate();
  const mobile = useMediaQuery('(max-width: 700px)');
  const {
    barkName, loading: connectionLoading, detectingFeatures, pendingProbes, bark,
  } = ctx;
  const stillProbing = !barkName && pendingProbes && pendingProbes.sensor > 0;

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

  const availability = {
    '/feeder': !!ctx.feederName,
    '/waterer': !!ctx.watererName,
    '/thermostat': !!(ctx.acBotName && ctx.roomMeterName),
    '/curtain': !!ctx.curtainName,
    '/inventory': !!(ctx.inventoryName && ctx.inventoryStateSensorName),
    '/bark': !!ctx.barkName,
    '/door': !!ctx.doorUnlockName,
  };

  if (connectionLoading || detectingFeatures || stillProbing) {
    return (
      <div className="bark">
        <TopNav availability={availability} />
        <div className="bark__body">
          <div className="bark-loader">🐾 🐾 🐾</div>
        </div>
        <BottomTabBar />
      </div>
    );
  }

  if (!barkName) {
    return (
      <div className="bark">
        <TopNav availability={availability} />
        <div className="bark__body">
          <div className="bark-stub">
            <h1 className="bark__title">Barking</h1>
            <p>No bark detector configured on this machine.</p>
          </div>
        </div>
        <BottomTabBar />
      </div>
    );
  }

  const totalInRange = history.length;
  const rel = formatRelative(lastBarkAt);
  const ledeParts = [`${totalInRange} bark${totalInRange === 1 ? '' : 's'} in ${activeRange.label}`];
  if (rel) ledeParts.push(`last ${rel}`);
  const lede = ledeParts.join(' · ');

  return (
    <div className="bark">
      <TopNav availability={availability} />
      <div className="bark__body">
        <div className="bark__wide">
          {mobile && (
            <button
              type="button"
              className="bark__back"
              onClick={() => navigate('/')}
              aria-label="Back to Home"
            >
              <ChevronLeft size={17} />
              Home
            </button>
          )}
          <h1 className="bark__title">Barking</h1>
          <p className="bark__lede">{lede}</p>

          <div className="bark__seg">
            {RANGES.map((r) => (
              <button
                key={r.label}
                type="button"
                className={r.hours === rangeHours ? 'on' : ''}
                onClick={() => setRangeHours(r.hours)}
              >
                {r.label}
              </button>
            ))}
            <button type="button" onClick={refreshHistory} disabled={historyLoading}>↻</button>
          </div>

          {totalInRange === 0 ? (
            <p className="bark__empty">Quiet.</p>
          ) : (
            <div className="bark__chart">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                  <XAxis dataKey="label" stroke="#6e6e73" fontSize={11} ticks={ticks} />
                  <YAxis allowDecimals={false} stroke="#6e6e73" fontSize={11} width={28} />
                  <Tooltip
                    contentStyle={{
                      background: '#ffffff',
                      border: '1px solid rgba(0,0,0,0.1)',
                      borderRadius: 6,
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="count" fill="#0071e3" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
      <BottomTabBar />
    </div>
  );
}
