// Analysis helpers. Everything runs in the browser on the user's own data.

export function toNumber(v) {
  if (v === null || v === undefined) return NaN;
  if (typeof v === 'number') return v;
  const s = String(v).trim().replace(/[$,%\s]/g, '').replace(/^\((.*)\)$/, '-$1');
  if (s === '') return NaN;
  return Number(s);
}

const DATE_RE = /^(\d{4}[-/]\d{1,2}([-/]\d{1,2})?|\d{1,2}\/\d{1,2}\/\d{2,4}|[A-Za-z]{3,9}\s+\d{4})$/;

export function profileColumns(columns, rows) {
  return columns.map((name) => {
    const values = rows.map((r) => r[name]);
    const filled = values.filter((v) => v !== '' && v !== undefined && v !== null);
    const nums = filled.map(toNumber).filter((n) => !Number.isNaN(n));
    const dates = filled.filter((v) => DATE_RE.test(String(v).trim()) && !Number.isNaN(Date.parse(normalizeDate(v))));
    let type = 'text';
    if (filled.length && dates.length / filled.length > 0.9) type = 'date';
    else if (filled.length && nums.length / filled.length > 0.9) type = 'number';
    const unique = new Set(filled.map(String)).size;
    const stats = type === 'number' && nums.length
      ? { min: Math.min(...nums), max: Math.max(...nums), mean: nums.reduce((a, b) => a + b, 0) / nums.length }
      : null;
    return { name, type, missing: values.length - filled.length, unique, stats, sample: filled.slice(0, 3) };
  });
}

function normalizeDate(v) {
  const s = String(v).trim();
  if (/^\d{4}[-/]\d{1,2}$/.test(s)) return s.replace('/', '-') + '-01';
  return s;
}

export function periodKey(v, grain = 'month') {
  const t = Date.parse(normalizeDate(v));
  if (Number.isNaN(t)) return null;
  const d = new Date(t);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + 1;
  if (grain === 'quarter') return `${y}-Q${Math.ceil(m / 3)}`;
  if (grain === 'year') return `${y}`;
  return `${y}-${String(m).padStart(2, '0')}`;
}

export function applyFilter(kpi, rows) {
  const filters = [...(kpi.filters || [])];
  if (kpi.filterCol) filters.push({ col: kpi.filterCol, op: kpi.filterOp, val: kpi.filterVal });
  const active = filters.filter((f) => f.col && f.val !== undefined && f.val !== '');
  if (!active.length) return rows;
  return rows.filter((r) => active.every((f) => {
    const eq = String(r[f.col] ?? '').toLowerCase() === String(f.val).toLowerCase();
    return f.op === 'not' ? !eq : eq;
  }));
}

// Compute a KPI over a set of rows.
export function computeKpi(kpi, allRows, dateCol) {
  if (!kpi || !kpi.column) return NaN;
  const rows = applyFilter(kpi, allRows);
  const vals = rows.map((r) => toNumber(r[kpi.column])).filter((n) => !Number.isNaN(n));
  switch (kpi.agg) {
    case 'share': {
      if (!rows.length) return NaN;
      const want = String(kpi.matchValue ?? '').toLowerCase();
      const hits = rows.filter((r) => String(r[kpi.column] ?? '').toLowerCase() === want).length;
      return (hits / rows.length) * 100;
    }
    case 'last': {
      if (!dateCol) return vals.length ? vals[vals.length - 1] : NaN;
      const sorted = rows
        .filter((r) => !Number.isNaN(toNumber(r[kpi.column])) && !Number.isNaN(Date.parse(normalizeDate(r[dateCol]))))
        .sort((a, b) => Date.parse(normalizeDate(a[dateCol])) - Date.parse(normalizeDate(b[dateCol])));
      return sorted.length ? toNumber(sorted[sorted.length - 1][kpi.column]) : NaN;
    }
    case 'count':
      return rows.filter((r) => r[kpi.column] !== '' && r[kpi.column] !== undefined).length;
    case 'avg':
      return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : NaN;
    case 'min':
      return vals.length ? Math.min(...vals) : NaN;
    case 'max':
      return vals.length ? Math.max(...vals) : NaN;
    case 'ratio': {
      const num = vals.reduce((a, b) => a + b, 0);
      const den = rows.map((r) => toNumber(r[kpi.denominator])).filter((n) => !Number.isNaN(n)).reduce((a, b) => a + b, 0);
      if (!den) return NaN;
      return (num / den) * (kpi.asPercent ? 100 : 1);
    }
    case 'sum':
    default:
      return vals.reduce((a, b) => a + b, 0);
  }
}

export function groupRows(rows, keyFn) {
  const map = new Map();
  rows.forEach((r) => {
    const k = keyFn(r);
    if (k === null || k === undefined || k === '') return;
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(r);
  });
  return map;
}

export function kpiSeries(kpi, rows, dateCol, grain) {
  if (!dateCol) return [];
  const groups = groupRows(rows, (r) => periodKey(r[dateCol], grain));
  return [...groups.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([label, rs]) => ({ label, value: computeKpi(kpi, rs, dateCol) }));
}

export function kpiBySegment(kpi, rows, segmentCol, dateCol) {
  if (!segmentCol) return [];
  const groups = groupRows(rows, (r) => r[segmentCol]);
  return [...groups.entries()]
    .map(([label, rs]) => ({ label, value: computeKpi(kpi, rs, dateCol), n: rs.length }))
    .sort((a, b) => b.value - a.value);
}

export function trendSummary(series) {
  const pts = series.filter((p) => Number.isFinite(p.value));
  if (pts.length < 2) return null;
  const first = pts[0].value;
  const last = pts[pts.length - 1].value;
  const change = last - first;
  const pct = first !== 0 ? (change / Math.abs(first)) * 100 : null;
  // Simple least-squares slope per period, used to flag direction honestly.
  const n = pts.length;
  const xs = pts.map((_, i) => i);
  const mx = (n - 1) / 2;
  const my = pts.reduce((a, p) => a + p.value, 0) / n;
  let num = 0, den = 0;
  pts.forEach((p, i) => { num += (xs[i] - mx) * (p.value - my); den += (xs[i] - mx) ** 2; });
  const slope = den ? num / den : 0;
  // How noisy is it? coefficient of variation of period-over-period changes.
  const deltas = pts.slice(1).map((p, i) => p.value - pts[i].value);
  const md = deltas.reduce((a, b) => a + b, 0) / deltas.length;
  const sd = Math.sqrt(deltas.reduce((a, d) => a + (d - md) ** 2, 0) / deltas.length);
  return { first, last, change, pct, slope, periods: n, volatility: sd, firstLabel: pts[0].label, lastLabel: pts[n - 1].label };
}

export function fmt(v, kpi) {
  if (v === null || v === undefined || Number.isNaN(v) || !Number.isFinite(v)) return '—';
  if (isPercent(kpi)) return v.toFixed(1) + '%';
  const sign = v < 0 ? '-' : '';
  const abs = Math.abs(v);
  let s;
  if (abs >= 1e6) s = (abs / 1e6).toFixed(2) + 'M';
  else if (abs >= 1e4) s = (abs / 1e3).toFixed(1) + 'K';
  else if (abs >= 100) s = Math.round(abs).toLocaleString();
  else if (abs >= 1) s = abs.toFixed(1);
  else s = abs.toFixed(3);
  return sign + (kpi?.unit || '') + s;
}

export function isPercent(kpi) {
  return kpi?.agg === 'share' || (kpi?.agg === 'ratio' && kpi?.asPercent);
}

export function isGood(kpi, value, target) {
  const t = toNumber(target);
  if (Number.isNaN(t) || Number.isNaN(value)) return null;
  return kpi.direction === 'down' ? value <= t : value >= t;
}

export function evaluateTrigger(trigger, value) {
  const t = toNumber(trigger.threshold);
  if (Number.isNaN(t) || Number.isNaN(value)) return null;
  return trigger.condition === 'above' ? value > t : value < t;
}
