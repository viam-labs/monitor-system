import React, { useMemo } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer,
} from 'recharts';
import TopNav from '../../components/TopNav';
import BottomTabBar from '../../components/BottomTabBar';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { formatRelative, formatTime } from '../../lib/format';
import './Sounds.css';

const RANGES = [
  { label: '1h', hours: 1, bucketMinutes: 5 },
  { label: '24h', hours: 24, bucketMinutes: 60 },
  { label: '7d', hours: 24 * 7, bucketMinutes: 60 * 24 },
];

const WHINE_CLASSES = new Set(['Whimper (dog)']);

function categorize(topClass) {
  return WHINE_CLASSES.has(topClass) ? 'whine' : 'bark';
}

function bucketSounds(events, hours, bucketMinutes) {
  const now = Date.now();
  const start = now - hours * 60 * 60 * 1000;
  const size = bucketMinutes * 60 * 1000;
  const nBuckets = Math.ceil((hours * 60) / bucketMinutes);
  const buckets = new Array(nBuckets).fill(0).map((_, i) => ({
    ts: start + i * size,
    barks: 0,
    whines: 0,
  }));
  for (const e of events) {
    const t = e.at.getTime();
    if (t < start || t > now) continue;
    const idx = Math.min(buckets.length - 1, Math.floor((t - start) / size));
    if (categorize(e.topClass) === 'whine') buckets[idx].whines += 1;
    else buckets[idx].barks += 1;
  }
  return buckets.map((b) => ({
    label: labelForBucket(new Date(b.ts), hours),
    barks: b.barks,
    whines: b.whines,
  }));
}

function labelForBucket(d, hours) {
  if (hours <= 1) return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (hours <= 24) return d.toLocaleTimeString([], { hour: 'numeric' });
  return d.toLocaleDateString([], { weekday: 'short' });
}

export default function SoundsPage() {
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

  const chartData = useMemo(
    () => bucketSounds(history, activeRange.hours, activeRange.bucketMinutes),
    [history, activeRange],
  );
  const ticks = useMemo(() => {
    if (chartData.length < 3) return chartData.map((d) => d.label);
    return [
      chartData[0].label,
      chartData[Math.floor(chartData.length / 2)].label,
      chartData[chartData.length - 1].label,
    ];
  }, [chartData]);

  const barkCount = history.filter((e) => categorize(e.topClass) === 'bark').length;
  const whineCount = history.length - barkCount;

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
      <div className="sounds">
        <TopNav availability={availability} />
        <div className="sounds__body">
          <div className="sounds-loader">🐾 🐾 🐾</div>
        </div>
        <BottomTabBar />
      </div>
    );
  }

  if (!barkName) {
    return (
      <div className="sounds">
        <TopNav availability={availability} />
        <div className="sounds__body">
          <div className="sounds-stub">
            <h1 className="sounds__title">Sounds</h1>
            <p>No sound detector configured on this machine.</p>
          </div>
        </div>
        <BottomTabBar />
      </div>
    );
  }

  const rel = formatRelative(lastBarkAt);
  const ledeParts = [];
  if (barkCount > 0 || whineCount > 0) {
    ledeParts.push(`${barkCount} bark${barkCount === 1 ? '' : 's'}`);
    ledeParts.push(`${whineCount} whine${whineCount === 1 ? '' : 's'}`);
    ledeParts.push(`in ${activeRange.label}`);
  } else {
    ledeParts.push(`quiet in ${activeRange.label}`);
  }
  if (rel) ledeParts.push(`last ${rel}`);
  const lede = ledeParts.join(' · ');

  // Today: first/loudest/last within the current range.
  const sorted = history.slice().sort((a, b) => a.at - b.at);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const loudest = sorted.reduce(
    (best, e) => (!best || e.score > best.score ? e : best),
    null,
  );

  const recent = history.slice().reverse().slice(0, 25);

  return (
    <div className="sounds">
      <TopNav availability={availability} />
      <div className="sounds__body">
        <div className="sounds__wide">
          {mobile && (
            <button
              type="button"
              className="sounds__back"
              onClick={() => navigate('/')}
              aria-label="Back to Home"
            >
              <ChevronLeft size={17} />
              Home
            </button>
          )}
          <h1 className="sounds__title">Sounds</h1>
          <p className="sounds__lede">{lede}</p>

          <div className="sounds__seg">
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

          <div className="sounds__cols">
            <div className="sounds__col">
              <div className="sounds__legend">
                <span><i className="k1" />Barks</span>
                <span><i className="k2" />Whines</span>
              </div>
              {history.length === 0 ? (
                <p className="sounds__empty">Quiet.</p>
              ) : (
                <div className="sounds__chart">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
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
                      <Bar dataKey="barks" stackId="s" fill="#0071e3" radius={[0, 0, 0, 0]} />
                      <Bar dataKey="whines" stackId="s" fill="#ff9f0a" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
              <p className="sounds__sect">Summary</p>
              {first ? (
                <div className="sounds-row">
                  <div className="sounds-row__tx">
                    <div className="sounds-row__nm">First sound</div>
                    <div className="sounds-row__sb">{formatTime(first.at.getTime())}</div>
                  </div>
                  <span className="sounds-row__amt">{categorize(first.topClass)}</span>
                </div>
              ) : null}
              {loudest ? (
                <div className="sounds-row">
                  <div className="sounds-row__tx">
                    <div className="sounds-row__nm">Loudest</div>
                    <div className="sounds-row__sb">
                      {formatTime(loudest.at.getTime())} · score {loudest.score.toFixed(2)}
                    </div>
                  </div>
                  <span className="sounds-row__amt">{categorize(loudest.topClass)}</span>
                </div>
              ) : null}
              {last ? (
                <div className="sounds-row">
                  <div className="sounds-row__tx">
                    <div className="sounds-row__nm">Last sound</div>
                    <div className="sounds-row__sb">
                      {formatTime(last.at.getTime())}
                      {rel ? ` · quiet for ${rel.replace(' ago', '')}` : ''}
                    </div>
                  </div>
                  <span className="sounds-row__amt">{categorize(last.topClass)}</span>
                </div>
              ) : null}
            </div>

            <div className="sounds__col">
              <p className="sounds__sect">Recent events</p>
              {recent.length === 0 ? (
                <p className="sounds__empty">No events yet.</p>
              ) : (
                recent.map((e, i) => {
                  const kind = categorize(e.topClass);
                  return (
                    <div key={`${e.at.getTime()}-${i}`} className="sounds-row">
                      <span className={`sounds-row__dot sounds-row__dot--${kind}`} />
                      <div className="sounds-row__tx">
                        <div className="sounds-row__nm">
                          {kind === 'whine' ? 'Whining' : 'Barking'}
                        </div>
                        <div className="sounds-row__sb">
                          {formatTime(e.at.getTime())} · {e.topClass} ({e.score.toFixed(2)})
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
      <BottomTabBar />
    </div>
  );
}
