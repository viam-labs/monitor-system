import React, { useEffect, useMemo, useState } from 'react';
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

// All seven YAMNet dog-vocalization classes. Order controls:
// - stack order in the chart (bottom → top in this order)
// - legend render order
// - which short label the UI uses
const SOUND_CLASSES = [
  { key: 'Bark',          label: 'barks',    singular: 'bark',    noun: 'Barking',  color: '#0071e3' },
  { key: 'Yip',           label: 'yips',     singular: 'yip',     noun: 'Yipping',  color: '#30d158' },
  { key: 'Bow-wow',       label: 'bow-wows', singular: 'bow-wow', noun: 'Bow-wow',  color: '#af52de' },
  { key: 'Howl',          label: 'howls',    singular: 'howl',    noun: 'Howling',  color: '#ff2d55' },
  { key: 'Growling',      label: 'growls',   singular: 'growl',   noun: 'Growling', color: '#8e8e93' },
  { key: 'Whimper (dog)', label: 'whines',   singular: 'whine',   noun: 'Whining',  color: '#ff9f0a' },
  { key: 'Dog',           label: 'dog',      singular: 'dog',     noun: 'Dog',      color: '#aeaeb2' },
];

const CLASS_BY_KEY = Object.fromEntries(SOUND_CLASSES.map((c) => [c.key, c]));

function classOf(topClass) {
  return CLASS_BY_KEY[topClass] || CLASS_BY_KEY.Dog;
}

function bucketSounds(events, hours, bucketMinutes) {
  const now = Date.now();
  const start = now - hours * 60 * 60 * 1000;
  const size = bucketMinutes * 60 * 1000;
  const nBuckets = Math.ceil((hours * 60) / bucketMinutes);
  const buckets = new Array(nBuckets).fill(0).map((_, i) => ({
    ts: start + i * size,
    ...Object.fromEntries(SOUND_CLASSES.map((c) => [c.key, 0])),
  }));
  for (const e of events) {
    const t = e.at.getTime();
    if (t < start || t > now) continue;
    const idx = Math.min(buckets.length - 1, Math.floor((t - start) / size));
    const cls = classOf(e.topClass).key;
    buckets[idx][cls] += 1;
  }
  return buckets.map((b) => {
    const { ts, ...counts } = b;
    return { label: labelForBucket(new Date(ts), hours), ...counts };
  });
}

function labelForBucket(d, hours) {
  if (hours <= 1) return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (hours <= 24) return d.toLocaleTimeString([], { hour: 'numeric' });
  return d.toLocaleDateString([], { weekday: 'short' });
}

function InfoSheet({ onClose }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setOpen(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const close = React.useCallback(() => {
    setOpen(false);
    setTimeout(onClose, 180);
  }, [onClose]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [close]);

  return (
    <>
      <div className={'sounds-info-scrim' + (open ? ' on' : '')} onClick={close} />
      <div className={'sounds-info-sheet' + (open ? ' on' : '')} role="dialog" aria-modal="true">
        <div className="sounds-info-sheet__grab" aria-hidden="true" />
        <h2 className="sounds-info-sheet__title">How sounds are detected</h2>
        <p>
          A microphone in the crate feeds short audio clips through <b>YAMNet</b>,
          a classifier Google trained on 500+ sound categories.
        </p>
        <p>
          Any clip that scores above <b>0.5 confidence</b> on a dog-vocalization
          class is logged. The top-scoring class per clip decides the bucket.
          YAMNet distinguishes seven dog classes:
        </p>
        <p>
          <b>Bark</b> — sharp woof.<br />
          <b>Yip</b> — small-dog high-pitched bark.<br />
          <b>Bow-wow</b> — classic repeating bark.<br />
          <b>Howl</b> — prolonged howl.<br />
          <b>Growling</b> — growl.<br />
          <b>Whimper (dog)</b> — whine.<br />
          <b>Dog</b> — generic catch-all for dog-ish sounds that don't fit
          the above (noisier, more false positives).
        </p>
        <p>
          A 2-second debounce prevents one long bark from logging multiple times.
          Expect occasional false positives from TV, kids, or sirens.
        </p>
        <button type="button" className="sounds-info-sheet__close" onClick={close}>
          Got it
        </button>
      </div>
    </>
  );
}

export default function SoundsPage() {
  const ctx = useOutletContext();
  const navigate = useNavigate();
  const mobile = useMediaQuery('(max-width: 700px)');
  const [infoOpen, setInfoOpen] = useState(false);
  const {
    barkName, loading: connectionLoading, detectingFeatures, pendingProbes, bark,
  } = ctx;
  const stillProbing = !barkName && pendingProbes && pendingProbes.sensor > 0;

  const {
    lastBarkAt = '', history = [], historyLoading = false,
    rangeHours = 24, setRangeHours = () => {}, refreshHistory = () => {},
    historyError = null,
  } = bark || {};

  const RECENT_PAGE_SIZE = 5;
  const [recentPage, setRecentPage] = useState(0);

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

  const counts = useMemo(() => {
    const out = Object.fromEntries(SOUND_CLASSES.map((c) => [c.key, 0]));
    for (const e of history) out[classOf(e.topClass).key] += 1;
    return out;
  }, [history]);

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
  const nonZero = SOUND_CLASSES.filter((c) => counts[c.key] > 0);
  const ledeParts = [];
  if (nonZero.length === 0) {
    ledeParts.push(`quiet in ${activeRange.label}`);
  } else {
    for (const c of nonZero) {
      const n = counts[c.key];
      ledeParts.push(`${n} ${n === 1 ? c.singular : c.label}`);
    }
    ledeParts.push(`in ${activeRange.label}`);
  }
  if (rel) ledeParts.push(`last ${rel}`);
  const lede = ledeParts.join(' · ');

  const sorted = history.slice().sort((a, b) => a.at - b.at);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const loudest = sorted.reduce(
    (best, e) => (!best || e.score > best.score ? e : best),
    null,
  );

  const allRecent = history.slice().reverse();
  const totalPages = Math.max(1, Math.ceil(allRecent.length / RECENT_PAGE_SIZE));
  const safePage = Math.min(recentPage, totalPages - 1);
  const recent = allRecent.slice(
    safePage * RECENT_PAGE_SIZE,
    (safePage + 1) * RECENT_PAGE_SIZE,
  );
  const recentStart = allRecent.length === 0 ? 0 : safePage * RECENT_PAGE_SIZE + 1;
  const recentEnd = Math.min(allRecent.length, (safePage + 1) * RECENT_PAGE_SIZE);

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
                {SOUND_CLASSES.map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => setInfoOpen(true)}
                    title="How sounds are detected"
                  >
                    <i style={{ background: c.color }} />{c.label}
                  </button>
                ))}
                <button
                  type="button"
                  className="sounds__info"
                  onClick={() => setInfoOpen(true)}
                  aria-label="How sounds are detected"
                  title="How sounds are detected"
                >
                  ⓘ
                </button>
              </div>
              {historyError ? (
                <p className="sounds__empty" style={{ color: 'var(--danger, #d70015)' }}>
                  Cloud history unavailable: {historyError}
                </p>
              ) : history.length === 0 ? (
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
                      {SOUND_CLASSES.map((c, i) => (
                        <Bar
                          key={c.key}
                          dataKey={c.key}
                          stackId="s"
                          fill={c.color}
                          radius={i === SOUND_CLASSES.length - 1 ? [3, 3, 0, 0] : [0, 0, 0, 0]}
                        />
                      ))}
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
                  <span className="sounds-row__amt">{classOf(first.topClass).singular}</span>
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
                  <span className="sounds-row__amt">{classOf(loudest.topClass).singular}</span>
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
                  <span className="sounds-row__amt">{classOf(last.topClass).singular}</span>
                </div>
              ) : null}
            </div>

            <div className="sounds__col">
              <p className="sounds__sect">Recent events</p>
              {historyError && (
                <p className="sounds__empty" style={{ color: 'var(--danger)' }}>
                  {historyError}
                </p>
              )}
              {!historyError && allRecent.length === 0 ? (
                <p className="sounds__empty">No events yet.</p>
              ) : (
                recent.map((e, i) => {
                  const cls = classOf(e.topClass);
                  return (
                    <div key={`${e.at.getTime()}-${i}`} className="sounds-row">
                      <span
                        className="sounds-row__dot"
                        style={{ background: cls.color }}
                      />
                      <div className="sounds-row__tx">
                        <div className="sounds-row__nm">{cls.noun}</div>
                        <div className="sounds-row__sb">
                          {formatTime(e.at.getTime())} · {e.topClass} ({e.score.toFixed(2)})
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              {allRecent.length > RECENT_PAGE_SIZE && (
                <div className="sounds-pager">
                  <button
                    type="button"
                    onClick={() => setRecentPage((p) => Math.max(0, p - 1))}
                    disabled={safePage === 0}
                  >
                    ← Newer
                  </button>
                  <span className="sounds-pager__status">
                    {recentStart}–{recentEnd} of {allRecent.length}
                  </span>
                  <button
                    type="button"
                    onClick={() => setRecentPage((p) => Math.min(totalPages - 1, p + 1))}
                    disabled={safePage >= totalPages - 1}
                  >
                    Older →
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      <BottomTabBar />
      {infoOpen && <InfoSheet onClose={() => setInfoOpen(false)} />}
    </div>
  );
}
