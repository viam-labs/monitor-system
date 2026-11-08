import React, { useEffect, useRef, useState } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Lightbulb, Sun } from 'lucide-react';
import TopNav from '../../components/TopNav';
import BottomTabBar from '../../components/BottomTabBar';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import ScheduleRow from './ScheduleRow';
import ScheduleForm from './ScheduleForm';
import { ctToSwatch, formatTime12h } from './helpers';
import './Lights.css';

const K_MIN = 2200;
const K_MAX = 6500;

const PRESETS = [
  { label: 'Reading', pct: 80, k: 3500 },
  { label: 'Evening', pct: 40, k: 2500 },
  { label: 'Nightlight', pct: 5, k: 2200 },
  { label: 'Bright', pct: 100, k: 4500 },
];

function Slider({ value, min, max, step, onCommit, disabled, ariaLabel, trackClass = '' }) {
  const [local, setLocal] = useState(value);
  const pending = useRef(null);

  useEffect(() => {
    if (pending.current === null) setLocal(value);
  }, [value]);

  const handleInput = (e) => {
    const v = Number(e.target.value);
    setLocal(v);
    pending.current = v;
  };
  const commit = () => {
    if (pending.current !== null) {
      const v = pending.current;
      pending.current = null;
      onCommit(v);
    }
  };

  const pct = max > min ? ((local - min) / (max - min)) * 100 : 0;

  return (
    <div className={'lights-slider ' + trackClass}>
      <div className="lights-slider__track">
        {!trackClass.includes('lights-slider__track--ct') && (
          <div className="lights-slider__fill" style={{ width: `${pct}%` }} />
        )}
        <div className="lights-slider__knob" style={{ left: `${pct}%` }} />
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={local}
        disabled={disabled}
        onChange={handleInput}
        onMouseUp={commit}
        onTouchEnd={commit}
        onKeyUp={commit}
        aria-label={ariaLabel}
        className="lights-slider__input"
      />
    </div>
  );
}

function BulbPanel({ name, bulb, busy, onSet, onPreset }) {
  const readings = bulb?.readings || {};
  const on = readings.state === 'ON';
  const pct = typeof readings.brightness_pct === 'number' ? Math.round(readings.brightness_pct) : null;
  const k = typeof readings.color_temp_k === 'number' ? Math.round(readings.color_temp_k) : null;
  const swatchColor = ctToSwatch(k, pct, on);

  const health = bulb?.health;
  const unhealthy = health && health !== 'ok';

  return (
    <>
      <div className="lights__block">
        <div className="lights-state">
          <div className="lights-state__swatch" style={{ background: swatchColor }} />
          <div className="lights-state__meta">
            <div className="lights-state__stat">
              {pct != null ? pct : '—'}<small>%</small>
            </div>
            <div className="lights-state__sub">
              {k != null ? `${k.toLocaleString()} K` : '—'}
              {!unhealthy && k != null && <> · {warmth(k)}</>}
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={on}
            disabled={!!busy || !!unhealthy}
            className={'lights-sw' + (on ? '' : ' lights-sw--off')}
            onClick={() => onSet({ on: !on })}
            aria-label={`Turn ${on ? 'off' : 'on'} ${name}`}
          />
        </div>
      </div>

      <div className="lights__block">
        <p className="lights__sect">
          <Sun size={14} strokeWidth={1.7} style={{ verticalAlign: '-2px', marginRight: 6 }} />
          Brightness
        </p>
        <Slider
          value={pct ?? 0}
          min={0}
          max={100}
          step={1}
          disabled={!!busy || !!unhealthy}
          onCommit={(v) => onSet({ brightness_pct: v, on: v > 0 })}
          ariaLabel="Brightness"
        />
        <div className="lights-slider__value">{pct != null ? `${pct}%` : '—'}</div>
      </div>

      <div className="lights__block">
        <p className="lights__sect">Color temperature</p>
        <Slider
          value={k ?? K_MIN}
          min={K_MIN}
          max={K_MAX}
          step={50}
          disabled={!!busy || !!unhealthy}
          onCommit={(v) => onSet({ color_temp_k: v })}
          ariaLabel="Color temperature"
          trackClass="lights-slider__track--ct"
        />
        <div className="lights-ctends">
          <span>{K_MIN.toLocaleString()} K warm</span>
          <span>{K_MAX.toLocaleString()} K daylight</span>
        </div>
      </div>

      <div className="lights__block">
        <p className="lights__sect">Presets</p>
        <div className="lights-chips">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              className="lights-chip"
              disabled={!!busy || !!unhealthy}
              onClick={() => onPreset(p)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

function warmth(k) {
  if (k <= 2700) return 'warm white';
  if (k <= 3500) return 'soft white';
  if (k <= 4500) return 'neutral';
  if (k <= 5500) return 'cool white';
  return 'daylight';
}

export default function LightsPage() {
  const ctx = useOutletContext();
  const navigate = useNavigate();
  const mobile = useMediaQuery('(max-width: 700px)');
  const {
    lightNames = [],
    pendingProbes,
    detectingFeatures,
    loading: connectionLoading,
    lights,
  } = ctx;
  const lightsStillProbing = lightNames.length === 0 && pendingProbes && pendingProbes.generic > 0;

  const [activeIdx, setActiveIdx] = useState(0);
  const [addOpen, setAddOpen] = useState(false);

  const availability = {
    '/feeder': !!ctx.feederName,
    '/waterer': !!ctx.watererName,
    '/thermostat': !!(ctx.acBotName && ctx.roomMeterName),
    '/curtain': !!ctx.curtainName,
    '/lights': lightNames.length > 0,
    '/inventory': !!(ctx.inventoryName && ctx.inventoryStateSensorName),
    '/bark': !!ctx.barkName,
    '/air': !!ctx.airName,
    '/door': !!ctx.doorUnlockName,
  };

  if (connectionLoading || detectingFeatures || lightsStillProbing) {
    return (
      <div className="lights">
        <TopNav availability={availability} />
        <div className="lights__body">
          <div className="lights-loader">🐾 🐾 🐾</div>
        </div>
        <BottomTabBar />
      </div>
    );
  }

  if (lightNames.length === 0) {
    return (
      <div className="lights">
        <TopNav availability={availability} />
        <div className="lights__body">
          <div className="lights-stub">
            <h1 className="lights__title">Lights</h1>
            <p>No lights configured on this machine.</p>
            <p className="lights__hint">
              Pair a Zigbee bulb in zigbee2mqtt and add a
              {' '}<code>viam:zigbee2mqtt:light</code>{' '}
              component to this part.
            </p>
          </div>
        </div>
        <BottomTabBar />
      </div>
    );
  }

  const idx = Math.min(activeIdx, lightNames.length - 1);
  const activeName = lightNames[idx];
  const activeBulb = lights.bulbs[activeName];
  const busy = !!lights.busy?.[activeName];
  const others = lightNames.filter((_, i) => i !== idx).map((n) => ({ name: n, bulb: lights.bulbs[n] }));
  const schedules = Array.isArray(activeBulb?.schedules) ? activeBulb.schedules : [];

  const anyOn = lightNames.some((n) => lights.bulbs[n]?.readings?.state === 'ON');
  const onCount = lightNames.filter((n) => lights.bulbs[n]?.readings?.state === 'ON').length;
  const offCount = lightNames.length - onCount;
  const ledeParts = [];
  if (onCount) ledeParts.push(`${onCount} on`);
  if (offCount) ledeParts.push(`${offCount} off`);
  const lede = ledeParts.join(' · ') || (anyOn ? 'on' : 'off');

  const handleSet = (patch) => lights.setBulb(activeName, patch);
  const handlePreset = (p) => lights.setBulb(activeName, {
    on: true,
    brightness_pct: p.pct,
    color_temp_k: p.k,
  });
  const handleAddSchedule = async (payload) => {
    try {
      await lights.addSchedule(activeName, payload);
      setAddOpen(false);
    } catch { /* surfaced */ }
  };
  const handleModifySchedule = async (payload) => {
    try { await lights.modifySchedule(activeName, payload); } catch { /* surfaced */ }
  };
  const handleDeleteSchedule = async (id) => {
    if (!window.confirm('Delete this schedule?')) return;
    try { await lights.deleteSchedule(activeName, id); } catch { /* surfaced */ }
  };
  const handleToggleSchedule = (id, enabled) => lights.setScheduleEnabled(activeName, id, enabled);

  return (
    <div className="lights">
      <TopNav availability={availability} />
      <div className="lights__body">
        <div className="lights__cols">
          <div className="lights__left">
            {mobile && (
              <button
                type="button"
                className="lights__back"
                onClick={() => navigate('/')}
                aria-label="Back to Home"
              >
                <ChevronLeft size={17} />
                Home
              </button>
            )}
            <h1 className="lights__title">Lights</h1>
            <p className="lights__lede">{lede}</p>

            {lightNames.length > 1 && (
              <div className="lights-seg">
                {lightNames.map((n, i) => {
                  const b = lights.bulbs[n];
                  const nOn = b?.readings?.state === 'ON';
                  return (
                    <button
                      type="button"
                      key={n}
                      className={'lights-seg__item' + (i === idx ? ' lights-seg__item--on' : '')}
                      onClick={() => setActiveIdx(i)}
                    >
                      {n}
                      {nOn && <em> · on</em>}
                    </button>
                  );
                })}
              </div>
            )}

            {activeBulb?.health && activeBulb.health !== 'ok' && activeBulb.message && (
              <div className="lights__banner">{activeBulb.message}</div>
            )}

            <BulbPanel
              name={activeName}
              bulb={activeBulb}
              busy={busy}
              onSet={handleSet}
              onPreset={handlePreset}
            />
          </div>

          <div className="lights__right">
            <p className="lights__sect">Schedules</p>
            {schedules.length === 0 && !addOpen && (
              <p className="lights-empty">No schedules yet.</p>
            )}
            {schedules.map((s) => (
              <ScheduleRow
                key={s.id}
                schedule={s}
                busy={busy}
                onSave={handleModifySchedule}
                onDelete={handleDeleteSchedule}
                onToggleEnabled={handleToggleSchedule}
              />
            ))}
            {addOpen ? (
              <div className="lights-row__expanded">
                <ScheduleForm
                  initial={{
                    name: 'Schedule',
                    time: '06:30',
                    days_of_week: [],
                    duration_s: 1800,
                    start_brightness_pct: 1,
                    start_color_temp_k: 2200,
                    target_brightness_pct: 80,
                    target_color_temp_k: 4000,
                    enabled: true,
                  }}
                  busy={busy}
                  submitLabel="Add"
                  onSubmit={handleAddSchedule}
                  onCancel={() => setAddOpen(false)}
                />
              </div>
            ) : (
              <button
                type="button"
                className="lights-row__act--add"
                onClick={() => setAddOpen(true)}
                disabled={busy}
              >
                + Add schedule
              </button>
            )}

            {others.length > 0 && (
              <>
                <p className="lights__sect lights__sect--spaced">Other lights</p>
                {others.map(({ name, bulb }) => {
                  const nOn = bulb?.readings?.state === 'ON';
                  const unhealthy = bulb?.health && bulb.health !== 'ok';
                  const sub = unhealthy
                    ? bulb.message
                    : (nOn ? `on · ${Math.round(bulb?.readings?.brightness_pct ?? 0)}%` : 'off');
                  return (
                    <div
                      key={name}
                      className={'lights-other' + (unhealthy ? ' lights-other--dead' : '')}
                      role="button"
                      tabIndex={0}
                      onClick={() => setActiveIdx(lightNames.indexOf(name))}
                      onKeyDown={(e) => { if (e.key === 'Enter') setActiveIdx(lightNames.indexOf(name)); }}
                    >
                      <Lightbulb size={19} strokeWidth={1.6} className="lights-other__ic" />
                      <div className="lights-other__tx">
                        <div className="lights-other__nm">{name}</div>
                        <div className="lights-other__sb">{sub}</div>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={nOn}
                        disabled={!!unhealthy}
                        className={'lights-sw lights-sw--sm' + (nOn ? '' : ' lights-sw--off')}
                        onClick={(e) => {
                          e.stopPropagation();
                          lights.setBulb(name, { on: !nOn });
                        }}
                      />
                      <ChevronRight className="lights-other__chev" size={15} strokeWidth={2} />
                    </div>
                  );
                })}
              </>
            )}

            <p className="lights__sect lights__sect--spaced">Connection</p>
            {lightNames.map((n) => {
              const b = lights.bulbs[n];
              const h = b?.health || 'loading';
              const okish = h === 'ok';
              return (
                <div key={n} className={'lights-conn' + (!okish ? ' lights-conn--dim' : '')}>
                  <div className="lights-conn__tx">
                    <div className="lights-conn__nm">{n}</div>
                    <div className="lights-conn__sb">
                      {b?.last_state_at ? `last state ${formatTime12h(b.last_state_at)}` : 'waiting for first state'}
                    </div>
                  </div>
                  <span className="lights-conn__status">{okish ? 'ok' : (b?.message || h)}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <BottomTabBar />
    </div>
  );
}
