import { useState } from 'react';
import { Field, Area, StageHeader, Callout, Select } from '../components/ui.jsx';
import { evaluateTrigger, toNumber, isGood } from '../lib/analysis.js';

export default function PivotStage({ state, update, stage, restartLoop }) {
  const p = state.pivot;
  const set = (patch) => update('pivot', patch);
  const kpis = state.kpis;
  const [draft, setDraft] = useState({ date: '', values: {}, note: '' });

  const addTrigger = () => set({ triggers: [...p.triggers, { kpiId: kpis[0]?.id || '', condition: 'below', threshold: '', periods: 2, action: '' }] });
  const patchTrigger = (i, patch) => set({ triggers: p.triggers.map((t, j) => (j === i ? { ...t, ...patch } : t)) });

  const logCheckin = () => {
    if (!draft.date) return;
    set({ checkins: [...p.checkins, draft].sort((a, b) => (a.date < b.date ? -1 : 1)) });
    setDraft({ date: '', values: {}, note: '' });
  };

  // Which triggers have fired for N consecutive check-ins?
  const fired = p.triggers.map((t) => {
    const recent = p.checkins.slice(-(Number(t.periods) || 1));
    if (recent.length < (Number(t.periods) || 1)) return false;
    return recent.every((c) => evaluateTrigger(t, toNumber(c.values[t.kpiId])) === true);
  });
  const anyFired = fired.some(Boolean);
  const last = p.checkins[p.checkins.length - 1];
  const onTrack = last ? kpis.map((k) => isGood(k, toNumber(last.values[k.id]), state.measurement.plan[k.id]?.target ?? k.target)).filter((x) => x !== null) : [];
  const suggestion = !last ? null : anyFired ? 'Pivot' : onTrack.length && onTrack.every(Boolean) ? 'Persevere' : 'Adjust';

  return (
    <div className="stage">
      <StageHeader stage={stage} index={6} />

      <h3 className="sub">Pivot triggers — decide now, while you are calm</h3>
      {p.triggers.map((t, i) => (
        <div key={i} className={`trigger ${fired[i] ? 'fired' : ''}`}>
          <span>If</span>
          <Select value={t.kpiId} onChange={(v) => patchTrigger(i, { kpiId: v })} options={kpis.map((k) => ({ value: k.id, label: k.name || k.column }))} />
          <span>is</span>
          <Select value={t.condition} onChange={(v) => patchTrigger(i, { condition: v })} options={[{ value: 'below', label: 'below' }, { value: 'above', label: 'above' }]} />
          <input className="short" value={t.threshold} placeholder="value" onChange={(e) => patchTrigger(i, { threshold: e.target.value })} />
          <span>for</span>
          <input className="short" type="number" min="1" value={t.periods} onChange={(e) => patchTrigger(i, { periods: e.target.value })} />
          <span>check-ins in a row, we will</span>
          <input className="grow" value={t.action} placeholder="stop / scale back / switch to option B / escalate to…" onChange={(e) => patchTrigger(i, { action: e.target.value })} />
          <button className="icon-btn" aria-label="Remove trigger" onClick={() => set({ triggers: p.triggers.filter((_, j) => j !== i) })}>✕</button>
          {fired[i] && <span className="badge bad">Fired</span>}
        </div>
      ))}
      <button className="btn ghost small" onClick={addTrigger} disabled={!kpis.length}>+ Add a pivot trigger</button>

      <h3 className="sub">Check-in log</h3>
      <p className="muted">Record actual results at each check-in. The tool tells you which triggers fired; you make the call.</p>
      {kpis.length > 0 && (
        <div className="table-scroll">
          <table className="grid-table">
            <thead>
              <tr><th>Date</th>{kpis.map((k) => <th key={k.id}>{k.name || k.column}<div className="muted small">target {state.measurement.plan[k.id]?.target || k.target || '—'}</div></th>)}<th>Note</th><th></th></tr>
            </thead>
            <tbody>
              {p.checkins.map((c, i) => (
                <tr key={i}>
                  <td>{c.date}</td>
                  {kpis.map((k) => {
                    const ok = isGood(k, toNumber(c.values[k.id]), state.measurement.plan[k.id]?.target ?? k.target);
                    return <td key={k.id} className={ok === null ? '' : ok ? 'pos' : 'neg'}>{c.values[k.id] ?? '—'}</td>;
                  })}
                  <td className="muted">{c.note}</td>
                  <td><button className="icon-btn" aria-label="Delete check-in" onClick={() => set({ checkins: p.checkins.filter((_, j) => j !== i) })}>✕</button></td>
                </tr>
              ))}
              <tr className="draft">
                <td><input type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} /></td>
                {kpis.map((k) => <td key={k.id}><input value={draft.values[k.id] || ''} onChange={(e) => setDraft({ ...draft, values: { ...draft.values, [k.id]: e.target.value } })} /></td>)}
                <td><input value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} placeholder="what happened" /></td>
                <td><button className="btn small" onClick={logCheckin} disabled={!draft.date}>Log</button></td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {suggestion && (
        <Callout kind={suggestion === 'Pivot' ? 'warn' : suggestion === 'Persevere' ? 'tip' : 'note'} title={`The rules you set say: ${suggestion}`}>
          {suggestion === 'Pivot' && 'At least one pre-committed trigger has fired. Before overriding it, write down what you know now that you did not know when you set it.'}
          {suggestion === 'Persevere' && 'All KPIs with targets are on track at the latest check-in. Keep going, and keep checking the leading indicator.'}
          {suggestion === 'Adjust' && 'No trigger has fired, but not everything is on track. Adjust execution before you question the decision itself.'}
        </Callout>
      )}

      <div className="field wide">
        <span className="field-label">Your call</span>
        <div className="seg-toggle">
          {['Persevere', 'Adjust', 'Pivot', 'Too early to tell'].map((s) => <button key={s} className={p.status === s ? 'on' : ''} onClick={() => set({ status: s })}>{s}</button>)}
        </div>
      </div>

      <Field label="What did you learn?" hint="About the business, the data, and your own judgment. This is what makes the next loop better." wide>
        <Area rows={4} value={p.learnings} onChange={(v) => set({ learnings: v })} />
      </Field>

      <div className="loop-again">
        <div>
          <strong>Close the loop</strong>
          <p className="muted">A pivot is a new question. Start the next loop with what you learned — your data and KPIs carry over.</p>
        </div>
        <button className="btn primary" onClick={restartLoop}>Start the next loop →</button>
      </div>
    </div>
  );
}
