import { formatRelative } from '../../lib/format';
import {
  celsiusToF,
  pickHumidity,
  pickTemperature,
} from '../thermostat/helpers';

const WATER_DEFAULT_ML = 100;
const WATER_STEP_ML = 50;
const WATER_MIN_ML = 50;
const WATER_MAX_ML = 500;

const FEED_STEP_CUPS = 0.25;
const FEED_MIN_CUPS = 0.25;
const FEED_MAX_CUPS = 3;
const FEED_FALLBACK_CUPS = 1;

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
  const feedCups = next?.cups ?? feeder?.status?.target_meal_cups ?? null;
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
  const canFeed = !!feeder?.feed;
  const defaultCups = feedCups ?? FEED_FALLBACK_CUPS;
  return {
    key: 'feeder',
    icon: 'feeder',
    name: 'Feeder',
    subtitle,
    action: canFeed ? {
      label: 'Feed',
      disabled: feeder.feeding || feeder.mutating,
      confirm: {
        title: 'Feed Zion',
        amount: {
          value: defaultCups,
          unit: 'cups',
          step: FEED_STEP_CUPS,
          min: FEED_MIN_CUPS,
          max: FEED_MAX_CUPS,
        },
        hint: 'Dispensed over about 7 minutes.',
        confirmLabel: 'Feed',
        onConfirm: (cups) => feeder.feed(cups),
      },
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
      disabled: waterer.busy,
      confirm: {
        title: 'Dispense water',
        amount: {
          value: WATER_DEFAULT_ML,
          unit: 'ml',
          step: WATER_STEP_ML,
          min: WATER_MIN_ML,
          max: WATER_MAX_ML,
        },
        hint: 'Takes about 6 seconds.',
        confirmLabel: 'Dispense',
        onConfirm: (ml) => waterer.dispenseMl(ml),
      },
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
  // SwitchBot slide_position: 0 = fully open, 100 = fully closed.
  const isOpen = typeof pos === 'number' && pos < 50;
  const parts = [];
  if (typeof pos === 'number') parts.push(isOpen ? 'open' : 'closed');
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
  const history = bark?.history ?? [];
  const lastAt = bark?.lastBarkAt;
  const rel = lastAt ? formatRelative(lastAt) : null;
  let subtitle;
  if (history.length === 0) {
    subtitle = 'quiet';
  } else {
    const n = history.length;
    subtitle = rel
      ? `${n} sound${n === 1 ? '' : 's'} · last ${rel}`
      : `${n} sound${n === 1 ? '' : 's'}`;
  }
  return {
    key: 'bark',
    icon: 'bark',
    name: 'Sounds',
    subtitle,
    onClick: () => navigate('/bark'),
  };
}

function airRow({ air }, navigate) {
  const ppm = air?.co2Ppm;
  const rh = air?.relativeHumidity;
  const parts = [];
  if (typeof ppm === 'number') parts.push(`${Math.round(ppm)} ppm`);
  if (typeof rh === 'number') parts.push(`${Math.round(rh)}% humidity`);
  return {
    key: 'air',
    icon: 'air',
    name: 'Air',
    subtitle: parts.length ? parts.join(' · ') : null,
    onClick: () => navigate('/air'),
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
  if (ctx.airName) rows.push(airRow(ctx, navigate));
  if (ctx.doorUnlockName) rows.push(doorRow(ctx, navigate, mobile));
  return rows;
}
