import React, { useMemo, useState } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
  ReferenceArea, ResponsiveContainer,
} from 'recharts';
import TopNav from '../../components/TopNav';
import BottomTabBar from '../../components/BottomTabBar';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { formatRelative } from '../../lib/format';
import './Air.css';

const RANGES = [
  { label: '6h', hours: 6 },
  { label: '24h', hours: 24 },
  { label: '7d', hours: 24 * 7 },
];

const CO2_BANDS = [
  { min: 0,    max: 700,   color: '#30d158' },
  { min: 700,  max: 1000,  color: '#0071e3' },
  { min: 1000, max: 1400,  color: '#ff9500' },
  { min: 1400, max: 5000,  color: '#ff3b30' },
];

const HUMIDITY_BANDS = [
  { min: 0,  max: 30, color: '#ff9500' },
  { min: 30, max: 50, color: '#30d158' },
  { min: 50, max: 60, color: '#0071e3' },
  { min: 60, max: 100, color: '#ff9500' },
];

function co2Status(ppm) {
  if (ppm == null) return { label: '—', tone: 'muted' };
  if (ppm < 700)   return { label: 'Fine',      tone: 'good' };
  if (ppm < 1000)  return { label: 'Elevated',  tone: 'ok' };
  if (ppm < 1400)  return { label: 'High',      tone: 'warn' };
  return { label: 'Very high', tone: 'bad' };
}

function humidityStatus(rh) {
  if (rh == null) return { label: '—', tone: 'muted' };
  if (rh < 30)  return { label: 'Dry',       tone: 'warn' };
  if (rh < 50)  return { label: 'Fine',      tone: 'good' };
  if (rh < 60)  return { label: 'Elevated',  tone: 'ok' };
  return { label: 'Humid', tone: 'warn' };
}

function cToF(c) {
  if (typeof c !== 'number') return null;
  return (c * 9 / 5) + 32;
}

function bandMaxFor(bands, values) {
  const dataMax = values.length > 0 ? Math.max(...values) : 0;
  const topBand = bands[bands.length - 1].min;
  return Math.max(dataMax * 1.1, topBand + 50);
}

function AirChart({ data, dataKey, bands, dataMin, unit }) {
  if (data.length === 0) {
    return <div className="air-chart air-chart--empty">Collecting data…</div>;
  }
  const values = data.map((d) => d[dataKey]);
  const yMax = bandMaxFor(bands, values);
  const yMin = Math.min(dataMin, ...values);
  return (
    <div className="air-chart">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
          <XAxis dataKey="label" stroke="#6e6e73" fontSize={11} minTickGap={30} />
          <YAxis
            domain={[yMin, yMax]}
            stroke="#6e6e73"
            fontSize={11}
            width={40}
          />
          <Tooltip
            formatter={(v) => [`${Math.round(v)}${unit}`, dataKey === 'co2' ? 'CO₂' : 'Humidity']}
            contentStyle={{
              background: '#ffffff',
              border: '1px solid rgba(0,0,0,0.1)',
              borderRadius: 6,
              fontSize: 12,
            }}
          />
          {bands.map((b) => (
            <ReferenceArea
              key={`${b.min}-${b.max}`}
              y1={b.min}
              y2={Math.min(b.max, yMax)}
              fill={b.color}
              fillOpacity={0.08}
              stroke="none"
            />
          ))}
          <Line
            type="monotone"
            dataKey={dataKey}
            stroke="#1d1d1f"
            strokeWidth={1.75}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function AirPage() {
  const ctx = useOutletContext();
  const navigate = useNavigate();
  const mobile = useMediaQuery('(max-width: 700px)');
  const {
    airName, loading: connectionLoading, detectingFeatures, pendingProbes, air,
  } = ctx;
  const stillProbing = !airName && pendingProbes && pendingProbes.sensor > 0;

  const {
    co2Ppm, temperatureC, relativeHumidity, lastReadAt,
    history = [], historyLoading = false, historyError = null,
    rangeHours = 24, setRangeHours = () => {}, refreshHistory = () => {},
  } = air || {};

  const activeRange = RANGES.find((r) => r.hours === rangeHours) || RANGES[1];

  const chartData = useMemo(
    () => history.map((e) => ({
      ts: e.at.getTime(),
      label: labelForTick(e.at, activeRange.hours),
      co2: e.co2,
      humidity: e.humidity,
    })),
    [history, activeRange.hours],
  );

  const co2Delta1h = useMemo(() => {
    if (history.length < 2) return null;
    const nowMs = history[history.length - 1].at.getTime();
    const hourAgoMs = nowMs - 60 * 60 * 1000;
    let anchor = null;
    for (const e of history) {
      if (e.at.getTime() <= hourAgoMs) anchor = e;
      else break;
    }
    if (!anchor) return null;
    const latest = history[history.length - 1];
    return Math.round(latest.co2 - anchor.co2);
  }, [history]);

  const availability = {
    '/feeder': !!ctx.feederName,
    '/waterer': !!ctx.watererName,
    '/thermostat': !!(ctx.acBotName && ctx.roomMeterName),
    '/curtain': !!ctx.curtainName,
    '/inventory': !!(ctx.inventoryName && ctx.inventoryStateSensorName),
    '/bark': !!ctx.barkName,
    '/door': !!ctx.doorUnlockName,
    '/air': !!ctx.airName,
  };

  if (connectionLoading || detectingFeatures || stillProbing) {
    return (
      <div className="air">
        <TopNav availability={availability} />
        <div className="air__body">
          <div className="air-loader">🐾 🐾 🐾</div>
        </div>
        <BottomTabBar />
      </div>
    );
  }

  if (!airName) {
    return (
      <div className="air">
        <TopNav availability={availability} />
        <div className="air__body">
          <div className="air-stub">
            <h1 className="air__title">Air</h1>
            <p>No air sensor configured on this machine.</p>
          </div>
        </div>
        <BottomTabBar />
      </div>
    );
  }

  const co2 = co2Status(co2Ppm);
  const hum = humidityStatus(relativeHumidity);
  const tempF = cToF(temperatureC);
  const lastReadLabel = lastReadAt ? formatRelative(new Date(lastReadAt).toISOString()) : null;
  const lede = `living room · reading every 5 minutes`;

  const co2Subtitle = co2Delta1h != null
    ? `carbon dioxide · ${co2Delta1h >= 0 ? 'up' : 'down'} ${Math.abs(co2Delta1h)} in the last hour`
    : 'carbon dioxide';
  const humSubtitle = tempF != null
    ? `relative humidity · ${Math.round(tempF)}°F`
    : 'relative humidity';

  const sensorStale = lastReadAt != null && Date.now() - lastReadAt > 15 * 60 * 1000;

  return (
    <div className="air">
      <TopNav availability={availability} />
      <div className="air__body">
        <div className="air__wide">
          {mobile && (
            <button
              type="button"
              className="air__back"
              onClick={() => navigate('/')}
              aria-label="Back to Home"
            >
              <ChevronLeft size={17} />
              Home
            </button>
          )}
          <h1 className="air__title">Air</h1>
          <p className="air__lede">{lede}</p>

          <div className="air__seg">
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

          <div className="air__cards">
            <div className="air-card">
              <div className={`air-card__badge air-card__badge--${co2.tone}`}>{co2.label}</div>
              <div className="air-card__value">
                {co2Ppm != null ? <><b>{Math.round(co2Ppm)}</b>ppm</> : <>—</>}
              </div>
              <div className="air-card__sub">{co2Subtitle}</div>
            </div>
            <div className="air-card">
              <div className={`air-card__badge air-card__badge--${hum.tone}`}>{hum.label}</div>
              <div className="air-card__value">
                {relativeHumidity != null ? <><b>{Math.round(relativeHumidity)}</b>%</> : <>—</>}
              </div>
              <div className="air-card__sub">{humSubtitle}</div>
            </div>
          </div>

          {historyError && (
            <p className="air__err">Cloud history unavailable: {historyError}</p>
          )}

          <div className="air__chartblock">
            <p className="air__sect">Carbon dioxide</p>
            <AirChart data={chartData} dataKey="co2" bands={CO2_BANDS} dataMin={400} unit=" ppm" />
            <p className="air__legend">
              <span style={{ color: CO2_BANDS[0].color }}>■</span> under 700
              <span style={{ color: CO2_BANDS[1].color, marginLeft: 10 }}>■</span> 700–1000
              <span style={{ color: CO2_BANDS[2].color, marginLeft: 10 }}>■</span> 1000–1400
              <span style={{ color: CO2_BANDS[3].color, marginLeft: 10 }}>■</span> over 1400
            </p>
          </div>

          <div className="air__chartblock">
            <p className="air__sect">Humidity</p>
            <AirChart data={chartData} dataKey="humidity" bands={HUMIDITY_BANDS} dataMin={0} unit="%" />
            <p className="air__legend">
              <span style={{ color: HUMIDITY_BANDS[0].color }}>■</span> under 30% dry
              <span style={{ color: HUMIDITY_BANDS[1].color, marginLeft: 10 }}>■</span> 30–50% good
              <span style={{ color: HUMIDITY_BANDS[2].color, marginLeft: 10 }}>■</span> 50–60% high
              <span style={{ color: HUMIDITY_BANDS[3].color, marginLeft: 10 }}>■</span> over 60%
            </p>
          </div>

          <div className="air__chartblock">
            <p className="air__sect">Sensor</p>
            <div className="air-row">
              <div className="air-row__tx">
                <div className="air-row__nm">SCD-41</div>
                <div className="air-row__sb">
                  living room shelf
                  {lastReadLabel ? ` · last read ${lastReadLabel}` : ''}
                </div>
              </div>
              <span className={`air-row__amt air-row__amt--${sensorStale ? 'warn' : 'ok'}`}>
                {sensorStale ? 'stale' : 'ok'}
              </span>
            </div>
          </div>
        </div>
      </div>
      <BottomTabBar />
    </div>
  );
}

function labelForTick(d, hours) {
  if (hours <= 6) return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (hours <= 24) return d.toLocaleTimeString([], { hour: 'numeric' });
  return d.toLocaleDateString([], { weekday: 'short' });
}
