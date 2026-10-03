import { Field, Area, StageHeader, Callout, Select } from '../components/ui.jsx';
import { LineChart, BarChart } from '../components/Charts.jsx';
import { Stat } from '../components/WorkspaceKit.jsx';
import EvidenceBoard from '../components/EvidenceBoard.jsx';
import { kpiSeries, kpiBySegment, trendSummary, computeKpi, fmt, profileColumns } from '../lib/analysis.js';

export default function AnalysisStage({ state, update, setState, stage, openWorkspace }) {
  const a = state.analysis;
  const set = (patch) => update('analysis', patch);
  const kpis = state.kpis.filter((k) => k.column && state.data.files[k.file]);

  return (
    <div className="stage">
      <StageHeader stage={stage} index={3} />

      {state.question.initialLean && (
        <Callout kind="note" title="Your lean before the data">
          “{state.question.initialLean}” — keep it in view. Notice whether you are testing it or defending it.
        </Callout>
      )}

      {!kpis.length && <Callout kind="warn" title="No KPIs yet">Define at least one KPI in the previous step to see trends and breakdowns here. You can still pin evidence from the CRM workspace.</Callout>}

      <div className="row tight">
        <span className="muted">Time grouping</span>
        <div className="seg-toggle">
          {['month', 'quarter', 'year'].map((g) => <button key={g} className={a.grain === g ? 'on' : ''} onClick={() => set({ grain: g })}>{g}</button>)}
        </div>
        <button className="btn small" onClick={openWorkspace}>Open CRM workspace to find evidence →</button>
      </div>

      {kpis.map((k) => {
        const f = state.data.files[k.file];
        const series = f.dateCol ? kpiSeries(k, f.rows, f.dateCol, a.grain) : [];
        const tr = trendSummary(series);
        const segCols = profileColumns(f.columns, f.rows).filter((p) => p.type === 'text' && p.unique > 1 && p.unique <= 40).map((p) => p.name);
        const segCol = a.segments?.[k.id] || '';
        const seg = segCol ? kpiBySegment(k, f.rows, segCol, f.dateCol) : [];
        const overall = computeKpi(k, f.rows, f.dateCol);
        const signal = tr && tr.volatility > 0 ? Math.abs(tr.change) / tr.volatility : null;
        const improving = tr ? (k.direction === 'down' ? tr.change < 0 : tr.change > 0) : null;

        return (
          <div key={k.id} className="analysis-card">
            <div className="analysis-head">
              <div>
                <h3>{k.name || k.column}</h3>
                <span className="muted small">{f.name} · {k.type} · {k.direction === 'down' ? 'lower is better' : 'higher is better'}</span>
              </div>
            </div>

            <div className="stats compact">
              <Stat label={`${k.name}: ${f.dateCol ? 'whole period' : 'overall'}`} value={fmt(overall, k)} file={k.file} fileName={f.name} />
              {tr && <Stat label={`${k.name}: ${tr.firstLabel} → ${tr.lastLabel}`} value={`${fmt(tr.first, k)} → ${fmt(tr.last, k)}`} sub={tr.pct !== null ? `${tr.pct >= 0 ? '+' : ''}${tr.pct.toFixed(1)}%` : ''} tone={improving ? 'good' : 'warn'} file={k.file} fileName={f.name} />}
              {tr && <Stat label={`${k.name}: typical swing per ${a.grain}`} value={fmt(tr.volatility, k)} sub={signal !== null ? `Total change ≈ ${signal.toFixed(1)}× a typical swing` : ''} file={k.file} fileName={f.name} />}
            </div>

            {series.length > 1 ? (
              <LineChart series={series} kpi={k} target={k.target} />
            ) : (
              <p className="muted small">{f.dateCol ? 'Only one period in the data.' : 'This file has no time column, so there is no trend. Set one in the Data step if it exists.'}</p>
            )}
            {signal !== null && (
              <p className="read-note">
                {signal < 1.5
                  ? 'Caution: the overall change is small relative to normal period-to-period movement. This may be noise.'
                  : signal < 3
                    ? 'The change is noticeable but not overwhelming compared with normal variation. Look for a second source that agrees.'
                    : 'The change is large relative to normal variation — likely a real shift. Now ask what caused it.'}
              </p>
            )}

            <div className="row tight">
              <span className="field-label">Break down by</span>
              <Select value={segCol} onChange={(v) => set({ segments: { ...a.segments, [k.id]: v } })} options={segCols} placeholder="(choose a segment)" />
            </div>
            {seg.length > 0 && (
              <>
                <BarChart data={seg} kpi={k} target={k.target} />
                <div className="seg-pins">
                  {seg.slice(0, 8).map((s) => (
                    <Stat key={s.label} label={`${k.name} — ${segCol}: ${s.label}`} value={fmt(s.value, k)} sub={`${s.n} rows`} file={k.file} fileName={f.name} />
                  ))}
                </div>
              </>
            )}
          </div>
        );
      })}

      <EvidenceBoard state={state} setState={setState} />

      <Field label="What the data shows" hint="Facts only. Numbers, directions, comparisons. Cite pinned evidence. No “because” yet." wide>
        <Area rows={4} value={a.observations} onChange={(v) => set({ observations: v })} placeholder="Cash … / Win rate by source … / Adoption in … fell from … to …" />
      </Field>
      <Field label="What you are assuming" hint="What has to be true for your reading to hold? e.g. ‘the forecast months are realistic’, ‘health score predicts churn’." wide>
        <Area rows={3} value={a.assumptions} onChange={(v) => set({ assumptions: v })} />
      </Field>
      <Field label="Other explanations" hint="What else could produce the same pattern? Seasonality, a pricing change, a data definition change, one big customer…" wide>
        <Area rows={3} value={a.alternatives} onChange={(v) => set({ alternatives: v })} />
      </Field>
      <Field label="So what? Your answer to the question" hint="In two or three sentences: given the evidence, what is your answer — and how sure are you?" wide>
        <Area rows={3} value={a.soWhat} onChange={(v) => set({ soWhat: v })} />
      </Field>
    </div>
  );
}
