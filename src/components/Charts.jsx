import { fmt } from '../lib/analysis.js';

// Hand-built SVG charts: no chart library, readable in light and dark themes.

export function LineChart({ series, kpi, target, height = 220, targetLabel = 'target', zero = false }) {
  const pts = series.filter((p) => Number.isFinite(p.value));
  if (pts.length < 2) return <div className="chart-empty">Not enough periods to draw a trend.</div>;
  const W = 640, H = height, padL = 56, padR = 16, padT = 16, padB = 34;
  const t = Number(target);
  const vals = pts.map((p) => p.value).concat(Number.isFinite(t) && target !== '' ? [t] : []);
  let min = Math.min(...vals), max = Math.max(...vals);
  if (zero) min = Math.min(0, min);
  if (min === max) { min -= 1; max += 1; }
  const pad = (max - min) * 0.12;
  min -= pad; max += pad;
  const x = (i) => padL + (i * (W - padL - padR)) / (pts.length - 1);
  const y = (v) => padT + (1 - (v - min) / (max - min)) * (H - padT - padB);
  const path = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const area = `${path} L${x(pts.length - 1)},${H - padB} L${x(0)},${H - padB} Z`;
  const ticks = 4;
  const labelEvery = Math.ceil(pts.length / 8);

  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${kpi?.name || 'KPI'} over time`}>
      {[...Array(ticks + 1)].map((_, i) => {
        const v = min + ((max - min) * i) / ticks;
        return (
          <g key={i}>
            <line x1={padL} x2={W - padR} y1={y(v)} y2={y(v)} className="grid" />
            <text x={padL - 8} y={y(v) + 4} className="axis" textAnchor="end">{fmt(v, kpi)}</text>
          </g>
        );
      })}
      <path d={area} className="area" />
      <path d={path} className="line" />
      {Number.isFinite(t) && target !== '' && (
        <g>
          <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} className="target" />
          <text x={W - padR} y={y(t) - 6} textAnchor="end" className="target-label">{targetLabel} {fmt(t, kpi)}</text>
        </g>
      )}
      {zero && min < 0 && <line x1={padL} x2={W - padR} y1={y(0)} y2={y(0)} className="zero" />}
      {pts.map((p, i) => (
        <g key={p.label}>
          <circle cx={x(i)} cy={y(p.value)} r="3.5" className={`dot ${p.forecast ? 'forecast' : ''}`}><title>{`${p.label}: ${fmt(p.value, kpi)}`}</title></circle>
          {i % labelEvery === 0 || i === pts.length - 1 ? (
            <text x={x(i)} y={H - 12} textAnchor="middle" className="axis">{p.label}</text>
          ) : null}
        </g>
      ))}
    </svg>
  );
}

export function BarChart({ data, kpi, target }) {
  const rows = data.filter((d) => Number.isFinite(d.value)).slice(0, 12);
  if (!rows.length) return <div className="chart-empty">No segment values to compare.</div>;
  const t = Number(target);
  const hasT = Number.isFinite(t) && target !== '';
  const max = Math.max(...rows.map((r) => r.value), hasT ? t : 0) * 1.08 || 1;
  const min = Math.min(0, ...rows.map((r) => r.value));
  const W = 640, rowH = 30, padL = 140, padR = 70;
  const H = rows.length * rowH + 16;
  const x = (v) => padL + ((v - min) / (max - min)) * (W - padL - padR);

  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${kpi?.name || 'KPI'} by segment`}>
      {rows.map((r, i) => {
        const good = hasT ? (kpi.direction === 'down' ? r.value <= t : r.value >= t) : null;
        return (
          <g key={r.label} transform={`translate(0, ${8 + i * rowH})`}>
            <text x={padL - 10} y={rowH / 2 + 1} textAnchor="end" className="axis strong" dominantBaseline="middle">
              {String(r.label).length > 20 ? String(r.label).slice(0, 19) + '…' : r.label}
            </text>
            <rect x={x(Math.min(0, r.value))} y={5} height={rowH - 12} width={Math.max(2, Math.abs(x(r.value) - x(0)))} rx="3"
              className={good === null ? 'bar' : good ? 'bar good' : 'bar bad'}>
              <title>{`${r.label}: ${fmt(r.value, kpi)} (${r.n} rows)`}</title>
            </rect>
            <text x={x(Math.max(0, r.value)) + 6} y={rowH / 2 + 1} className="axis" dominantBaseline="middle">{fmt(r.value, kpi)}</text>
          </g>
        );
      })}
      {hasT && <line x1={x(t)} x2={x(t)} y1={2} y2={H - 4} className="target" />}
    </svg>
  );
}

export function Sparkline({ values, width = 90, height = 24 }) {
  const v = values.filter(Number.isFinite);
  if (v.length < 2) return null;
  const min = Math.min(...v), max = Math.max(...v);
  const r = max - min || 1;
  const d = v.map((x, i) => `${i ? 'L' : 'M'}${((i / (v.length - 1)) * (width - 4) + 2).toFixed(1)},${(height - 2 - ((x - min) / r) * (height - 4)).toFixed(1)}`).join(' ');
  const up = v[v.length - 1] >= v[0];
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className={`spark ${up ? 'up' : 'down'}`} aria-hidden="true">
      <path d={d} />
    </svg>
  );
}
