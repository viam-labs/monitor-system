export const LOW_BATTERY_THRESHOLD = 20;

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

export const TEMP_OPTIONS_F = (() => {
  const out = [];
  for (let f = 55; f <= 95; f++) out.push(f);
  return out;
})();

export function celsiusToF(c) {
  if (c == null || Number.isNaN(c)) return null;
  return (c * 9) / 5 + 32;
}

export function fToC(f) {
  if (f == null || Number.isNaN(f)) return null;
  return ((f - 32) * 5) / 9;
}

export function pickTemperature(readings) {
  if (!readings) return null;
  for (const key of ['temperature', 'temperature_c', 'tempC', 'temp']) {
    const v = readings[key];
    if (typeof v === 'number' && !Number.isNaN(v)) return v;
  }
  return null;
}

export function pickHumidity(readings) {
  if (!readings) return null;
  for (const key of ['humidity', 'relative_humidity', 'humidity_pct']) {
    const v = readings[key];
    if (typeof v === 'number' && !Number.isNaN(v)) return v;
  }
  return null;
}

export function pickBattery(readings) {
  if (!readings) return null;
  for (const key of ['battery_pct', 'battery', 'batteryLevel']) {
    const v = readings[key];
    if (typeof v === 'number' && !Number.isNaN(v)) return v;
  }
  return null;
}

function daysIntersect(a, b) {
  const setA = new Set(a && a.length ? a : ALL_DAYS);
  const bs = b && b.length ? b : ALL_DAYS;
  return bs.some(d => setA.has(d));
}

// Opposite-action collision blocks, same-action collision warns.
export function findScheduledConflict(candidate, existing, ignoreId) {
  for (const other of existing || []) {
    if (!other || other.id === ignoreId) continue;
    if (other.kind !== 'scheduled') continue;
    if (other.enabled === false) continue;
    if (other.time !== candidate.time) continue;
    if (!daysIntersect(candidate.days_of_week, other.days_of_week)) continue;
    return {
      level: other.action === candidate.action ? 'warn' : 'block',
      other,
    };
  }
  return null;
}
