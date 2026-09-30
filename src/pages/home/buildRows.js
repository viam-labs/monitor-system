import { formatRelative } from '../../lib/format';
import {
  celsiusToF,
  pickHumidity,
  pickTemperature,
} from '../thermostat/helpers';

const WATERER_DEFAULT_ML = 250;

function nextScheduled(schedules) {
  if (!schedules || schedules.length === 0) return null;
  const now = new Date();
  let best = null;
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
      if (bestFire === null || fire < bestFire) {
        bestFire = fire;
        best = { ...s, fireAt: fire };
      }
      break;
    }
  }
  return best;
}

function fmtTime(date) {
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function feederRow({ feeder }, navigate) {
  const next = nextScheduled(feeder?.schedules);
  const parts = [];
  if (next) {
    parts.push(`next meal ${fmtTime(next.fireAt)}`);
    if (typeof next.cups === 'number') parts.push(`${next.cups} cups`);
  } else if (feeder?.lastFedAt) {
    parts.push(`fed ${formatRelative(feeder.lastFedAt)}`);
  }
  return {
    key: 'feeder',
    icon: 'feeder',
    name: 'Feeder',
    subtitle: parts.join(' · ') || null,
    action: feeder?.feedNow ? {
      label: 'Feed',
      onClick: () => feeder.feedNow(),
      disabled: feeder.feeding || feeder.mutating,
    } : null,
    onClick: () => navigate('/feeder'),
  };
}

function watererRow({ waterer }, navigate) {
  const parts = [];
  const daily = waterer?.dailyTotal?.ml;
  if (typeof daily === 'number') parts.push(`${Math.round(daily)} ml today`);
  const lastAt = waterer?.lastDispense?.at;
  if (lastAt) parts.push(`last ${formatRelative(lastAt)}`);
  return {
    key: 'waterer',
    icon: 'waterer',
    name: 'Water',
    subtitle: parts.join(' · ') || null,
    action: waterer?.dispenseMl ? {
      label: 'Dispense',
      onClick: () => waterer.dispenseMl(WATERER_DEFAULT_ML),
      disabled: waterer.busy,
    } : null,
    onClick: () => navigate('/waterer'),
  };
}

function thermostatRow({ thermostat, thermostatController }, navigate) {
  const on = thermostatController?.position === 1;
  const tempC = pickTemperature(thermostat?.readings);
  const humidity = pickHumidity(thermostat?.readings);
  const parts = [];
  const tempF = celsiusToF(tempC);
  if (tempF != null) parts.push(`${Math.round(tempF)}°F`);
  if (humidity != null) parts.push(`${Math.round(humidity)}% humidity`);
  parts.push(on ? 'cooling' : 'off');
  return {
    key: 'thermostat',
    icon: 'thermostat',
    name: 'Thermostat',
    subtitle: parts.join(' · '),
    toggle: {
      on,
      onChange: (v) => thermostatController?.setAcOn?.(v),
      disabled: thermostatController?.busy,
    },
    onClick: () => navigate('/thermostat'),
  };
}

function curtainRow({ curtain }, navigate) {
  const pos = curtain?.position;
  const isOpen = pos != null && pos > 5;
  const parts = [];
  if (pos != null) parts.push(isOpen ? 'open' : 'closed');
  if (typeof curtain?.battery === 'number') parts.push(`${Math.round(curtain.battery)}% battery`);
  return {
    key: 'curtain',
    icon: 'curtain',
    name: 'Curtains',
    subtitle: parts.join(' · ') || null,
    toggle: {
      on: isOpen,
      onChange: (v) => (v ? curtain?.open?.() : curtain?.close?.()),
      disabled: curtain?.busy,
    },
    onClick: () => navigate('/curtain'),
  };
}

function inventoryRow({ inventory }, navigate) {
  const items = inventory?.items || [];
  const out = items.filter((i) => i.quantity === 0).length;
  const low = items.filter(
    (i) => i.quantity > 0 && i.threshold != null && i.quantity <= i.threshold,
  ).length;
  const parts = [];
  if (items.length > 0) {
    if (out === 0 && low === 0) {
      parts.push(`${items.length} items`);
    } else {
      if (out > 0) parts.push(`${out} item${out === 1 ? '' : 's'} out`);
      if (low > 0) parts.push(`${low} low`);
    }
  }
  return {
    key: 'inventory',
    icon: 'inventory',
    name: 'Inventory',
    subtitle: parts.join(' · ') || null,
    onClick: () => navigate('/inventory'),
  };
}

function barkRow({ bark }, navigate) {
  const count = bark?.history?.length ?? 0;
  const lastAt = bark?.lastBarkAt;
  const rel = lastAt ? formatRelative(lastAt) : null;
  let subtitle;
  if (count === 0) subtitle = 'quiet';
  else if (rel) subtitle = `${count} today · last ${rel}`;
  else subtitle = `${count} today`;
  return {
    key: 'bark',
    icon: 'bark',
    name: 'Barking',
    subtitle,
    onClick: () => navigate('/bark'),
  };
}

function doorRow({ door }, navigate) {
  const offline = !!door?.error && !door?.lastOpenedAt;
  const rel = door?.lastOpenedAt ? formatRelative(door.lastOpenedAt) : null;
  return {
    key: 'door',
    icon: 'door',
    name: 'Building door',
    subtitle: offline ? 'offline' : (rel ? `last opened ${rel}` : null),
    dead: offline,
    action: door?.unlock ? {
      label: 'Open',
      onClick: () => door.unlock(),
      disabled: offline || door.busy,
    } : null,
    onClick: () => navigate('/door'),
  };
}

export function buildRows(ctx, navigate) {
  const rows = [];
  if (ctx.feederName) rows.push(feederRow(ctx, navigate));
  if (ctx.watererName) rows.push(watererRow(ctx, navigate));
  if (ctx.acBotName && ctx.roomMeterName) rows.push(thermostatRow(ctx, navigate));
  if (ctx.curtainName) rows.push(curtainRow(ctx, navigate));
  if (ctx.inventoryName && ctx.inventoryStateSensorName) rows.push(inventoryRow(ctx, navigate));
  if (ctx.barkName) rows.push(barkRow(ctx, navigate));
  if (ctx.doorUnlockName) rows.push(doorRow(ctx, navigate));
  return rows;
}
