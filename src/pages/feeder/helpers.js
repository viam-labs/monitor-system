const FRACTION_LABELS = {
  0: '0',
  0.125: '⅛',
  0.25: '¼',
  0.375: '⅜',
  0.5: '½',
  0.625: '⅝',
  0.75: '¾',
  0.875: '⅞',
};

export function labelForCups(cups) {
  if (cups == null || Number.isNaN(cups)) return '';
  const whole = Math.floor(cups);
  const frac = Number((cups - whole).toFixed(3));
  const fracLabel = FRACTION_LABELS[frac];
  if (whole === 0) {
    if (fracLabel === undefined) return `${cups} cups`;
    return `${fracLabel} cup`;
  }
  if (frac === 0) return `${whole} cup${whole === 1 ? '' : 's'}`;
  if (fracLabel === undefined) return `${cups} cups`;
  return `${whole}${fracLabel} cups`;
}

// ⅛-cup steps up to 2 cups, then ¼-cup steps up to 4 cups.
export const CUP_OPTIONS = (() => {
  const out = [];
  for (let i = 1; i <= 16; i++) out.push(i * 0.125);
  for (let i = 9; i <= 16; i++) out.push(i * 0.25);
  return out;
})();

export function formatScheduleTime(hhmm) {
  if (!hhmm) return '';
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function formatVacationUntil(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

// PetSafe returns naive timestamps that are UTC. Date.parse of naive
// strings is browser-dependent, so append Z to force UTC.
export function parseServerTimestamp(raw) {
  if (raw == null) return NaN;
  if (typeof raw === 'number') {
    return raw < 1e12 ? raw * 1000 : raw;
  }
  if (typeof raw !== 'string') return NaN;
  const hasTz = /[Zz]|[+-]\d{2}:?\d{2}$/.test(raw);
  return Date.parse(hasTz ? raw : raw + 'Z');
}

export function extractLastFedTimestamp(lastFeeding, localLastFedAt) {
  const candidates = [];
  if (localLastFedAt) candidates.push(localLastFedAt);
  if (lastFeeding) {
    for (const key of ['created_at', 'timestamp', 'time', 'date']) {
      const ms = parseServerTimestamp(lastFeeding[key]);
      if (!Number.isNaN(ms)) candidates.push(ms);
    }
  }
  // Skip future timestamps — better to show nothing than "just now" for 3:51 PM at 1:24 PM.
  const nowMs = Date.now();
  const valid = candidates.filter(ms => ms <= nowMs + 60000);
  return valid.length ? Math.max(...valid) : null;
}

export function nowLocalDatetimeInput() {
  const d = new Date(Date.now() - new Date().getTimezoneOffset() * 60000);
  return d.toISOString().slice(0, 16);
}
