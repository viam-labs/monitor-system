import React from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import {
  Utensils, Droplet, DoorClosed, Thermometer, Blinds, Package, Activity, ChevronRight,
} from 'lucide-react';
import CameraHero from '../components/CameraHero';
import { formatRelative } from '../lib/format';
import './Home.css';

const WATERER_DEFAULT_ML = 250;

function nextScheduledLabel(schedules) {
  if (!schedules || schedules.length === 0) return null;
  const now = new Date();
  let bestFire = null;
  for (const s of schedules) {
    if (s.enabled === false) continue;
    if (!s.time || !s.time.includes(':')) continue;
    const [h, m] = s.time.split(':').map(Number);
    const dows = s.days_of_week || [];
    for (let offset = 0; offset < 8; offset++) {
      const fire = new Date(now);
      fire.setDate(now.getDate() + offset);
      fire.setHours(h, m, 0, 0);
      if (fire <= now) continue;
      if (dows.length && !dows.includes((fire.getDay() + 6) % 7)) continue;
      if (bestFire === null || fire < bestFire) bestFire = fire;
      break;
    }
  }
  if (!bestFire) return null;
  return bestFire.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function ActionLink({ label, onClick, disabled }) {
  return (
    <button
      type="button"
      className="home-row__link"
      disabled={disabled}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
    >
      {label}
    </button>
  );
}

function IosToggle({ on, onChange, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      className={'ios-toggle' + (on ? ' ios-toggle--on' : '')}
      onClick={(e) => { e.stopPropagation(); onChange(!on); }}
    >
      <span className="ios-toggle__thumb" />
    </button>
  );
}

function HomeRow({ icon: Icon, name, subtitle, action, toggle, onClick, disabled }) {
  const clickable = !disabled && !!onClick;
  return (
    <div
      className={'home-row' + (disabled ? ' home-row--disabled' : '')}
      onClick={clickable ? onClick : undefined}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={
        clickable
          ? (e) => { if (e.key === 'Enter') onClick(); }
          : undefined
      }
    >
      <span className="home-row__icon"><Icon size={22} strokeWidth={1.75} /></span>
      <div className="home-row__labels">
        <span className="home-row__name">{name}</span>
        {subtitle && <span className="home-row__subtitle">{subtitle}</span>}
      </div>
      {action && <div className="home-row__action">{action}</div>}
      {toggle}
      {clickable && <ChevronRight size={18} className="home-row__chevron" />}
    </div>
  );
}

export default function Home() {
  const ctx = useOutletContext();
  const navigate = useNavigate();
  const {
    cameras, streams,
    feeder, waterer, thermostat, thermostatController, curtain, door, inventory, bark,
    feederName, watererName, acBotName, roomMeterName, curtainName, doorUnlockName,
    inventoryName, inventoryStateSensorName, barkName,
  } = ctx;

  const rows = [];

  if (feederName) {
    const nextTime = nextScheduledLabel(feeder?.schedules);
    let sub = null;
    if (nextTime) sub = `next meal ${nextTime}`;
    else if (feeder?.lastFedAt) sub = `fed ${formatRelative(feeder.lastFedAt)}`;
    rows.push({
      key: 'feeder',
      icon: Utensils,
      name: 'Feeder',
      subtitle: sub,
      action: feeder?.feedNow && (
        <ActionLink
          label="Feed"
          onClick={() => feeder.feedNow()}
          disabled={feeder.feeding || feeder.mutating}
        />
      ),
      onClick: () => navigate('/feeder'),
    });
  }

  if (watererName) {
    const lastAt = waterer?.lastDispense?.at;
    const rel = lastAt ? formatRelative(lastAt) : null;
    rows.push({
      key: 'waterer',
      icon: Droplet,
      name: 'Water',
      subtitle: rel ? `dispensed ${rel}` : null,
      action: waterer?.dispenseMl && (
        <ActionLink
          label="Dispense"
          onClick={() => waterer.dispenseMl(WATERER_DEFAULT_ML)}
          disabled={waterer.busy}
        />
      ),
      onClick: () => navigate('/waterer'),
    });
  }

  if (doorUnlockName) {
    const rel = door?.lastOpenedAt ? formatRelative(door.lastOpenedAt) : null;
    rows.push({
      key: 'door',
      icon: DoorClosed,
      name: 'Building door',
      subtitle: rel ? `opened ${rel}` : null,
      action: door?.unlock && (
        <ActionLink
          label="Unlock"
          onClick={() => door.unlock()}
          disabled={door.busy}
        />
      ),
      onClick: () => navigate('/door'),
    });
  }

  if (acBotName && roomMeterName) {
    const on = thermostatController?.position === 1;
    const temp = thermostat?.readings?.temperature_f;
    let sub;
    if (temp != null) sub = `${Math.round(temp)}°F · ${on ? 'cooling' : 'off'}`;
    else sub = on ? 'cooling' : 'off';
    rows.push({
      key: 'thermostat',
      icon: Thermometer,
      name: 'Thermostat',
      subtitle: sub,
      toggle: (
        <IosToggle
          on={on}
          onChange={(v) => thermostatController?.setAcOn?.(v)}
          disabled={thermostatController?.busy}
        />
      ),
      onClick: () => navigate('/thermostat'),
    });
  }

  if (curtainName) {
    const pos = curtain?.position;
    const isOpen = pos != null && pos > 5;
    rows.push({
      key: 'curtain',
      icon: Blinds,
      name: 'Curtains',
      subtitle: pos != null ? (isOpen ? 'open' : 'closed') : null,
      toggle: (
        <IosToggle
          on={isOpen}
          onChange={(v) => (v ? curtain?.open?.() : curtain?.close?.())}
          disabled={curtain?.busy}
        />
      ),
      onClick: () => navigate('/curtain'),
    });
  }

  if (inventoryName && inventoryStateSensorName) {
    const items = inventory?.items || [];
    const low = items.filter(
      (i) => i.threshold != null && i.quantity != null && i.quantity <= i.threshold,
    ).length;
    let sub = null;
    if (items.length > 0) {
      sub = low > 0 ? `${low} item${low === 1 ? '' : 's'} low` : `${items.length} items`;
    }
    rows.push({
      key: 'inventory',
      icon: Package,
      name: 'Inventory',
      subtitle: sub,
      onClick: () => navigate('/inventory'),
    });
  }

  if (barkName) {
    const count24 = bark?.history?.length ?? 0;
    const lastAt = bark?.lastBarkAt;
    const lastMs = lastAt ? Date.parse(lastAt) : NaN;
    const quietSince = !Number.isNaN(lastMs)
      ? new Date(lastMs).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
      : null;
    let sub;
    if (count24 > 0) {
      sub = quietSince
        ? `${count24} today · quiet since ${quietSince}`
        : `${count24} today`;
    } else {
      sub = 'quiet';
    }
    rows.push({
      key: 'bark',
      icon: Activity,
      name: 'Barking',
      subtitle: sub,
      onClick: () => navigate('/bark'),
    });
  }

  return (
    <div className="home">
      <CameraHero cameras={cameras || []} streams={streams || {}} />
      {rows.length > 0 && (
        <section className="home__card">
          {rows.map((r, i) => (
            <React.Fragment key={r.key}>
              {i > 0 && <div className="home__divider" />}
              <HomeRow {...r} />
            </React.Fragment>
          ))}
        </section>
      )}
    </div>
  );
}
