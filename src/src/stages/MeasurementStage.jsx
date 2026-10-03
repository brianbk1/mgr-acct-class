import { Field, Text, Select, StageHeader, Callout } from '../components/ui.jsx';
import { latestBaseline } from '../lib/stages.js';
import { fmt } from '../lib/analysis.js';

export default function MeasurementStage({ state, update, stage }) {
  const m = state.measurement;
  const set = (patch) => update('measurement', patch);
  const setPlan = (id, p) => set({ plan: { ...m.plan, [id]: { ...(m.plan[id] || {}), ...p } } });

  return (
    <div className="stage">
      <StageHeader stage={stage} index={5} />

      {!state.kpis.length && <Callout kind="warn" title="No KPIs to measure">Go back to the KPI step and define the measures this decision should move.</Callout>}

      {state.kpis.length > 0 && (
        <div className="table-scroll">
          <table className="grid-table measure">
            <thead>
              <tr><th>KPI</th><th>Latest value in data</th><th>Baseline</th><th>Target</th><th>Target date</th></tr>
            </thead>
            <tbody>
              {state.kpis.map((k) => {
                const base = latestBaseline(k, state);
                const pl = m.plan[k.id] || {};
                return (
                  <tr key={k.id}>
                    <td><strong>{k.name || k.column}</strong><div className="muted small">{k.type} · {k.direction === 'down' ? 'lower is better' : 'higher is better'}</div></td>
                    <td>
                      {fmt(base, k)}
                      {base !== null && !pl.baseline && <button className="link small" onClick={() => setPlan(k.id, { baseline: String(Number(base.toFixed(2))) })}>use as baseline</button>}
                    </td>
                    <td><input value={pl.baseline || ''} onChange={(e) => setPlan(k.id, { baseline: e.target.value })} placeholder="baseline" /></td>
                    <td><input value={pl.target ?? (k.target || '')} onChange={(e) => setPlan(k.id, { target: e.target.value })} placeholder="target" /></td>
                    <td><input type="date" value={pl.by || ''} onChange={(e) => setPlan(k.id, { by: e.target.value })} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="row">
        <Field label="Who owns the measurement?" hint="The person who pulls the numbers and calls the review.">
          <Text value={m.owner} onChange={(v) => set({ owner: v })} />
        </Field>
        <Field label="Cadence">
          <Select value={m.cadence} onChange={(v) => set({ cadence: v })} options={['weekly', 'biweekly', 'monthly', 'quarterly']} />
        </Field>
      </div>
      <div className="row">
        <Field label="First check-in" hint="The earliest point a signal could reasonably appear.">
          <Text type="date" value={m.firstCheck} onChange={(v) => set({ firstCheck: v })} />
        </Field>
        <Field label="Reviewed where?" hint="Leadership meeting, board update, ops review…">
          <Text value={m.reviewForum} onChange={(v) => set({ reviewForum: v })} />
        </Field>
      </div>

      <Callout kind="tip" title="Lock it before results arrive">
        Export your decision brief after this step. A dated record of the baseline and target protects you from moving the goalposts — and protects the team from having them moved on them.
      </Callout>
    </div>
  );
}
