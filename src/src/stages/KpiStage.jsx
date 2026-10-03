import { Field, Text, Area, Select, StageHeader, Callout } from '../components/ui.jsx';
import { computeKpi, fmt } from '../lib/analysis.js';
import { fileLabel } from '../lib/workspace.js';

const AGGS = [
  { value: 'sum', label: 'Sum' },
  { value: 'avg', label: 'Average' },
  { value: 'count', label: 'Count of rows' },
  { value: 'ratio', label: 'Ratio (this ÷ another column)' },
  { value: 'share', label: '% of rows matching a value' },
  { value: 'last', label: 'Latest value (by time)' },
  { value: 'min', label: 'Minimum' },
  { value: 'max', label: 'Maximum' },
];

// Candidate measures for recognized files. Offered as a menu — the user still chooses and justifies.
const STARTERS = {
  financials: [
    { name: 'Ending cash (actuals)', column: 'ending_cash', agg: 'last', filters: [{ col: 'actual_or_forecast', op: 'eq', val: 'Actual' }],  direction: 'up', type: 'lagging', unit: '$' },
    { name: 'Revenue (actuals)', column: 'total_revenue', agg: 'sum', filters: [{ col: 'actual_or_forecast', op: 'eq', val: 'Actual' }],  direction: 'up', type: 'lagging', unit: '$' },
    { name: 'Gross margin (actuals)', column: 'gross_margin_pct', agg: 'avg', filters: [{ col: 'actual_or_forecast', op: 'eq', val: 'Actual' }],  direction: 'up', type: 'lagging' },
    { name: 'Cash change / burn (actuals)', column: 'monthly_cash_change', agg: 'sum', filters: [{ col: 'actual_or_forecast', op: 'eq', val: 'Actual' }],  direction: 'up', type: 'lagging', unit: '$' },
  ],
  opportunities: [
    { name: 'Win rate', column: 'status', agg: 'share', matchValue: 'Won', filters: [{ col: 'status', op: 'not', val: 'Open' }], direction: 'up', type: 'leading' },
    { name: 'Renewal win rate', column: 'status', agg: 'share', matchValue: 'Won', filters: [{ col: 'status', op: 'not', val: 'Open' }, { col: 'opportunity_type', op: 'eq', val: 'Renewal' }], direction: 'up', type: 'leading' },
    { name: 'Closed-won bookings', column: 'amount', agg: 'sum', filters: [{ col: 'status', op: 'eq', val: 'Won' }], direction: 'up', type: 'lagging', unit: '$' },
    { name: 'Weighted open pipeline', column: 'weighted_pipeline', agg: 'sum', filters: [{ col: 'status', op: 'eq', val: 'Open' }], direction: 'up', type: 'leading', unit: '$' },
  ],
  usage: [
    { name: 'Product adoption rate', column: 'active_users', agg: 'ratio', denominator: 'licensed_users', asPercent: true, direction: 'up', type: 'leading' },
    { name: 'AI Coach users', column: 'ai_coach_users', agg: 'sum', direction: 'up', type: 'leading' },
    { name: 'Avg time-to-value (days)', column: 'avg_time_to_value_days', agg: 'avg', direction: 'down', type: 'leading' },
  ],
  accounts: [
    { name: 'Contracted ARR', column: 'contract_arr', agg: 'sum', direction: 'up', type: 'lagging', unit: '$' },
    { name: 'ARR at high churn risk', column: 'contract_arr', agg: 'sum', filters: [{ col: 'churn_risk', op: 'eq', val: 'High' }], direction: 'down', type: 'leading', unit: '$' },
    { name: 'Average health score', column: 'health_score', agg: 'avg', direction: 'up', type: 'leading' },
    { name: 'Contribution margin', column: 'est_annual_contribution', agg: 'ratio', denominator: 'contract_arr', asPercent: true, direction: 'up', type: 'lagging' },
  ],
  campaigns: [
    { name: 'Bookings per marketing dollar', column: 'bookings', agg: 'ratio', denominator: 'spend', direction: 'up', type: 'lagging' },
    { name: 'Opportunities from marketing', column: 'opportunities', agg: 'sum', direction: 'up', type: 'leading' },
  ],
  activity: [
    { name: 'Demos completed', column: 'demos_completed', agg: 'sum', direction: 'up', type: 'leading' },
  ],
};

let seq = 0;
const newId = () => `k${Date.now().toString(36)}${(seq++).toString(36)}`;

export default function KpiStage({ state, setState, stage }) {
  const files = state.data.order.map((k) => state.data.files[k]).filter(Boolean);
  const setKpis = (fn) => setState((s) => ({ ...s, kpis: fn(s.kpis) }));
  const patch = (id, p) => setKpis((ks) => ks.map((k) => (k.id === id ? { ...k, ...p } : k)));
  const add = (base) => setKpis((ks) => [...ks, { id: newId(), name: '', file: files[0]?.key || '', column: '', agg: 'sum', direction: 'up', target: '', type: 'lagging', why: '', unit: '', filters: [], ...base }]);

  const starters = files.flatMap((f) => (STARTERS[f.kind] || [])
    .filter((s) => f.columns.includes(s.column))
    .map((s) => ({ ...s, file: f.key, fileName: f.name })))
    .filter((s) => !state.kpis.some((k) => k.name === s.name && k.file === s.file));

  if (!files.length) {
    return (
      <div className="stage">
        <StageHeader stage={stage} index={2} />
        <Callout kind="warn" title="Load data first">KPIs are built from your data files. Go back to the Data step and load at least one file.</Callout>
      </div>
    );
  }

  return (
    <div className="stage">
      <StageHeader stage={stage} index={2} />

      {state.kpis.length === 0 && (
        <Callout kind="tip" title="Choose few, choose well">
          Start by asking: if you could only watch one number for the next six months, which would tell you whether this decision is working? Then add the earliest warning signal for it.
        </Callout>
      )}

      {state.kpis.map((k, i) => {
        const f = state.data.files[k.file];
        const cols = f?.columns || [];
        const value = f ? computeKpi(k, f.rows, f.dateCol) : NaN;
        return (
          <div key={k.id} className="kpi-card">
            <div className="kpi-card-head">
              <span className="kpi-index">KPI {i + 1}</span>
              <input className="kpi-name" value={k.name} placeholder="Name this KPI" onChange={(e) => patch(k.id, { name: e.target.value })} />
              <span className="kpi-value" title="Current value across the whole file">{fmt(value, k)}</span>
              <button className="icon-btn" aria-label="Remove KPI" onClick={() => setKpis((ks) => ks.filter((x) => x.id !== k.id))}>✕</button>
            </div>
            <div className="row three">
              <Field label="Data file">
                <Select value={k.file} onChange={(v) => patch(k.id, { file: v, column: '', denominator: '', filters: [] })} options={files.map((x) => ({ value: x.key, label: `${fileLabel(x)} (${x.name})` }))} />
              </Field>
              <Field label="Calculation">
                <Select value={k.agg} onChange={(v) => patch(k.id, { agg: v })} options={AGGS} />
              </Field>
              <Field label={k.agg === 'ratio' ? 'Numerator column' : 'Column'}>
                <Select value={k.column} onChange={(v) => patch(k.id, { column: v })} options={cols} placeholder="Choose…" />
              </Field>
            </div>
            {k.agg === 'ratio' && (
              <div className="row three">
                <Field label="Denominator column">
                  <Select value={k.denominator} onChange={(v) => patch(k.id, { denominator: v })} options={cols} placeholder="Choose…" />
                </Field>
                <label className="field inline-check">
                  <input type="checkbox" checked={!!k.asPercent} onChange={(e) => patch(k.id, { asPercent: e.target.checked })} /> Show as %
                </label>
              </div>
            )}
            {k.agg === 'share' && (
              <div className="row three">
                <Field label="Counts as a match when the value equals">
                  <Select value={k.matchValue} onChange={(v) => patch(k.id, { matchValue: v })} options={f ? [...new Set(f.rows.map((r) => r[k.column]).filter(Boolean))].slice(0, 50) : []} placeholder="Choose…" />
                </Field>
              </div>
            )}
            <div className="filters-edit">
              <span className="field-label">Only include rows where…</span>
              {(k.filters || []).map((flt, fi) => (
                <div key={fi} className="filter-row">
                  <select value={flt.col} onChange={(e) => patch(k.id, { filters: k.filters.map((x, j) => (j === fi ? { ...x, col: e.target.value, val: '' } : x)) })}>
                    <option value="">column…</option>
                    {cols.map((c) => <option key={c}>{c}</option>)}
                  </select>
                  <select value={flt.op || 'eq'} onChange={(e) => patch(k.id, { filters: k.filters.map((x, j) => (j === fi ? { ...x, op: e.target.value } : x)) })}>
                    <option value="eq">is</option>
                    <option value="not">is not</option>
                  </select>
                  <select value={flt.val} onChange={(e) => patch(k.id, { filters: k.filters.map((x, j) => (j === fi ? { ...x, val: e.target.value } : x)) })}>
                    <option value="">value…</option>
                    {f && flt.col && [...new Set(f.rows.map((r) => r[flt.col]).filter(Boolean))].slice(0, 60).map((v) => <option key={v}>{v}</option>)}
                  </select>
                  <button className="icon-btn" aria-label="Remove filter" onClick={() => patch(k.id, { filters: k.filters.filter((_, j) => j !== fi) })}>✕</button>
                </div>
              ))}
              {(k.filters || []).length < 3 && <button className="btn ghost small" onClick={() => patch(k.id, { filters: [...(k.filters || []), { col: '', op: 'eq', val: '' }] })}>+ Add filter</button>}
            </div>
            <div className="row four">
              <Field label="Better is">
                <Select value={k.direction} onChange={(v) => patch(k.id, { direction: v })} options={[{ value: 'up', label: 'Higher' }, { value: 'down', label: 'Lower' }]} />
              </Field>
              <Field label="Type" hint="Leading = moves early. Lagging = the outcome.">
                <Select value={k.type} onChange={(v) => patch(k.id, { type: v })} options={[{ value: 'leading', label: 'Leading indicator' }, { value: 'lagging', label: 'Lagging outcome' }]} />
              </Field>
              <Field label="Target (optional now)">
                <Text value={k.target} onChange={(v) => patch(k.id, { target: v })} placeholder="e.g. 90" />
              </Field>
              <Field label="Unit prefix">
                <Text value={k.unit} onChange={(v) => patch(k.id, { unit: v })} placeholder="$" />
              </Field>
            </div>
            <Field label="Why does this KPI matter for this decision?" hint="If you cannot connect it to the question in one sentence, drop it." wide>
              <Area rows={2} value={k.why} onChange={(v) => patch(k.id, { why: v })} />
            </Field>
          </div>
        );
      })}

      <div className="kpi-actions">
        <button className="btn" onClick={() => add({})} disabled={state.kpis.length >= 6}>+ Define a KPI from scratch</button>
        {state.kpis.length >= 5 && <span className="muted small">That is a lot of KPIs. Which ones would you actually act on?</span>}
      </div>

      {starters.length > 0 && (
        <div className="starters">
          <span className="field-label">Candidate measures found in your files</span>
          <span className="field-hint">A menu, not a recommendation. Adding one leaves “why it matters” blank on purpose — you have to make the case.</span>
          <div className="starter-grid">
            {starters.map((s) => (
              <button key={`${s.file}-${s.name}`} className="starter" onClick={() => add({ ...s, fileName: undefined })} disabled={state.kpis.length >= 6}>
                <span className={`tag ${s.type}`}>{s.type}</span>
                <strong>{s.name}</strong>
                <small>{s.fileName}</small>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
