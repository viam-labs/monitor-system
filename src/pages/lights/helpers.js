// Approximate CT → RGB swatch color, warm to cool, interpolated between
// perceptually chosen anchors (matches the mockup palette). We only use
// this for the UI dot, so good-enough beats physically accurate.
const CT_ANCHORS = [
  [2200, [255, 157, 61]],
  [2700, [255, 217, 160]],
  [3500, [255, 230, 196]],
  [4500, [250, 240, 220]],
  [5500, [234, 242, 255]],
  [6500, [207, 224, 255]],
];

function lerpChannel(a, b, t) {
  return Math.round(a + (b - a) * t);
}

export function ctToSwatch(kelvin, brightnessPct, on) {
  if (!on || kelvin == null) return '#dcdce0';
  const k = Math.max(CT_ANCHORS[0][0], Math.min(CT_ANCHORS.at(-1)[0], kelvin));
  let lo = CT_ANCHORS[0];
  let hi = CT_ANCHORS.at(-1);
  for (let i = 0; i < CT_ANCHORS.length - 1; i++) {
    if (k >= CT_ANCHORS[i][0] && k <= CT_ANCHORS[i + 1][0]) {
      lo = CT_ANCHORS[i];
      hi = CT_ANCHORS[i + 1];
      break;
    }
  }
  const span = hi[0] - lo[0] || 1;
  const t = (k - lo[0]) / span;
  const rgb = [0, 1, 2].map((ch) => lerpChannel(lo[1][ch], hi[1][ch], t));
  // Dim low-brightness swatches toward grey so the UI reflects the setting.
  const dim = typeof brightnessPct === 'number' ? Math.max(0.35, Math.min(1, brightnessPct / 100 + 0.35)) : 1;
  const final = rgb.map((c) => Math.round(220 + (c - 220) * dim));
  return `rgb(${final[0]}, ${final[1]}, ${final[2]})`;
}

export function formatTime12h(iso) {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  } catch {
    return '';
  }
}

export function summarizeSchedule(s) {
  const time = formatClock(s.time);
  const parts = [time];
  const minutes = Math.round((s.duration_s || 0) / 60);
  if (minutes > 0) parts.push(`over ${minutes} min`);
  return parts.join(' · ');
}

export function formatClock(hhmm) {
  if (!hhmm || !hhmm.includes(':')) return hhmm || '';
  const [h, m] = hhmm.split(':').map(Number);
  const suffix = h >= 12 ? 'pm' : 'am';
  const hour12 = ((h + 11) % 12) + 1;
  return `${hour12}:${String(m).padStart(2, '0')} ${suffix}`;
}
