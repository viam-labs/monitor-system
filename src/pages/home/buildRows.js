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

function feederRow({ feeder }, navigate, mobile) {
  const next = nextScheduled(feeder?.schedules);
  let subtitle = null;
  if (next) {
    const timeStr = fmtTime(next.fireAt);
    if (mobile) {
      subtitle = `next ${timeStr}`;
    } else {
      const parts = [`next meal ${timeStr}`];
      if (typeof next.cups === 'number') parts.push(`${next.cups} cups`);
      subtitle = parts.join(' · ');
    }
  } else if (feeder?.lastFedAt) {
    subtitle = `fed ${formatRelative(feeder.lastFedAt)}`;
  }
  return {
    key: 'feeder',
    icon: 'feeder',
    name: 'Feeder',
    subtitle,
    action: feeder?.feedNow ? {
      label: 'Feed',
      onClick: () => feeder.feedNow(),
      disabled: feeder.feeding || feeder.mutating,
    } : null,
    onClick: () => navigate('/feeder'),
  };
}

function watererRow({ waterer }, navigate, mobile) {
  const daily = waterer?.dailyTotal?.ml;
  const lastAt = waterer?.lastDispense?.at;
  let subtitle = null;
  if (mobile) {
    if (typeof daily === 'number') subtitle = `${Math.round(daily)} ml today`;
    else if (lastAt) subtitle = `last ${formatRelative(lastAt)}`;
  } else {
    const parts = [];
    if (typeof daily === 'number') parts.push(`${Math.round(daily)} ml today`);
    if (lastAt) parts.push(`last ${formatRelative(lastAt)}`);
    subtitle = parts.join(' · ') || null;
  }
  return {
    key: 'waterer',
    icon: 'waterer',
    name: 'Water',
    subtitle,
    action: waterer?.dispenseMl ? {
      label: 'Dispense',
      onClick: () => waterer.dispenseMl(WATERER_DEFAULT_ML),
      disabled: waterer.busy,
    } : null,
    onClick: () => navigate('/waterer'),
  };
}

function thermostatRow({ thermostat }, navigate, mobile) {
  const on = thermostat?.position === 1;
  const tempC = pickTemperature(thermostat?.readings);
  const humidity = pickHumidity(thermostat?.readings);
  const tempF = celsiusToF(tempC);
  const parts = [];
  if (tempF != null) parts.push(`${Math.round(tempF)}°F`);
  if (!mobile && humidity != null) parts.push(`${Math.round(humidity)}% humidity`);
  parts.push(on ? 'cooling' : 'off');
  return {
    key: 'thermostat',
    icon: 'thermostat',
    name: 'Thermostat',
    subtitle: parts.join(' · '),
    toggle: {
      on,
      onChange: (v) => thermostat?.setAcOn?.(v),
      disabled: thermostat?.busy,
    },
    hideChevron: mobile,
    onClick: () => navigate('/thermostat'),
  };
}

function curtainRow({ curtain }, navigate, mobile) {
  const pos = curtain?.position;
  const isOpen = pos != null && pos > 5;
  const parts = [];
  if (pos != null) parts.push(isOpen ? 'open' : 'closed');
  if (typeof curtain?.battery === 'number') {
    parts.push(mobile ? `${Math.round(curtain.battery)}%` : `${Math.round(curtain.battery)}% battery`);
  }
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
    hideChevron: mobile,
    onClick: () => navigate('/curtain'),
  };
}

function inventoryRow({ inventory }, navigate, mobile) {
  const items = inventory?.items || [];
  const out = items.filter((i) => i.quantity === 0).length;
  const low = items.filter(
    (i) => i.quantity > 0 && i.threshold != null && i.quantity <= i.threshold,
  ).length;
  const parts = [];
  if (items.length > 0) {
    if (out === 0 && low === 0) {
      parts.push(`${items.length} items`);
    } else if (mobile) {
      if (out > 0) parts.push(`${out} out`);
      if (low > 0) parts.push(`${low} low`);
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

function doorRow({ door }, navigate, mobile) {
  const offline = !!door?.error && !door?.lastOpenedAt;
  const rel = door?.lastOpenedAt ? formatRelative(door.lastOpenedAt) : null;
  const action = !mobile && door?.unlock ? {
    label: 'Open',
    onClick: () => door.unlock(),
    disabled: offline || door.busy,
  } : null;
  return {
    key: 'door',
    icon: 'door',
    name: 'Building door',
    subtitle: offline ? 'offline' : (rel ? `last opened ${rel}` : null),
    dead: offline,
    action,
    onClick: () => navigate('/door'),
  };
}

export function buildRows(ctx, navigate, mobile = false) {
  const rows = [];
  if (ctx.feederName) rows.push(feederRow(ctx, navigate, mobile));
  if (ctx.watererName) rows.push(watererRow(ctx, navigate, mobile));
  if (ctx.acBotName && ctx.roomMeterName) rows.push(thermostatRow(ctx, navigate, mobile));
  if (ctx.curtainName) rows.push(curtainRow(ctx, navigate, mobile));
  if (ctx.inventoryName && ctx.inventoryStateSensorName) {
    rows.push(inventoryRow(ctx, navigate, mobile));
  }
  if (ctx.barkName) rows.push(barkRow(ctx, navigate));
  if (ctx.doorUnlockName) rows.push(doorRow(ctx, navigate, mobile));
  return rows;
}
