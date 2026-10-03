import { Field, Area, StageHeader, Callout } from '../components/ui.jsx';

export default function DecisionStage({ state, update, stage }) {
  const d = state.decision;
  const q = state.question;
  const set = (patch) => update('decision', patch);
  const options = q.options.filter((o) => o.trim());
  const changed = q.initialLean && d.choice && !q.initialLean.toLowerCase().includes(d.choice.toLowerCase().slice(0, 20));

  return (
    <div className="stage">
      <StageHeader stage={stage} index={4} />

      <div className="field wide">
        <span className="field-label">Which option are you choosing?</span>
        <span className="field-hint">Pick one of your framed options, or write a new one if the analysis revealed a better path.</span>
        <div className="choice-grid">
          {options.map((o, i) => (
            <button key={i} className={`choice ${d.choice === o ? 'on' : ''}`} onClick={() => set({ choice: o })}>
              <span className="option-letter">{String.fromCharCode(65 + i)}</span>{o}
            </button>
          ))}
        </div>
        <input value={options.includes(d.choice) ? '' : d.choice} placeholder="…or describe a different option" onChange={(e) => set({ choice: e.target.value })} />
      </div>

      {q.initialLean && d.choice && (
        <Callout kind={changed ? 'tip' : 'note'} title="Before vs. after">
          You started out leaning: “{q.initialLean}”. {changed ? 'Your choice looks different now — say in your rationale what changed your mind.' : 'You landed where you started. Make sure your rationale shows the analysis could have changed your mind.'}
        </Callout>
      )}

      <Field label="Rationale" hint="Connect the choice to specific evidence. ‘Because X (data point) and Y (data point), despite Z.’" wide>
        <Area rows={4} value={d.rationale} onChange={(v) => set({ rationale: v })} />
      </Field>

      <div className="row">
        <div className="field">
          <span className="field-label">Confidence: <strong>{d.confidence}%</strong></span>
          <span className="field-hint">How likely is it this turns out to be the right call?</span>
          <input type="range" min="10" max="99" value={d.confidence} onChange={(e) => set({ confidence: Number(e.target.value) })} />
          <span className="muted small">{d.confidence >= 90 ? 'Very high. What evidence did you look for that could have proved you wrong?' : d.confidence <= 40 ? 'Low. That is fine if the decision is reversible and well-measured.' : 'A realistic range for most management decisions.'}</span>
        </div>
        <div className="field">
          <span className="field-label">Reversibility</span>
          <div className="seg-toggle">
            <button className={d.reversibility === 'two-way' ? 'on' : ''} onClick={() => set({ reversibility: 'two-way' })}>Two-way door</button>
            <button className={d.reversibility === 'one-way' ? 'on' : ''} onClick={() => set({ reversibility: 'one-way' })}>One-way door</button>
          </div>
          <span className="muted small">{d.reversibility === 'one-way' ? 'Hard to undo. Slow down, widen input, stage the commitment if you can.' : 'Easy to undo. Move quickly and let measurement do the work.'}</span>
        </div>
      </div>

      <Field label="Biggest financial or operating risk" hint="The one thing most likely to hurt the business, whether or not you make this decision." wide>
        <Area rows={2} value={d.biggestRisk} onChange={(v) => set({ biggestRisk: v })} />
      </Field>
      <Field label="Where the resources go" hint="Be specific about money, people and time. e.g. ‘$100K: $X to …, $Y to …’ — and what you will not fund." wide>
        <Area rows={3} value={d.invest} onChange={(v) => set({ invest: v })} />
      </Field>
      <Field label="What you would change in the current plan" hint="Assumptions to revise, hires to move, spend to cut or re-time." wide>
        <Area rows={3} value={d.planChanges} onChange={(v) => set({ planChanges: v })} />
      </Field>
      <Field label="Pre-mortem" hint="It is a year from now and this decision failed. Write the most likely story of why." wide>
        <Area rows={3} value={d.premortem} onChange={(v) => set({ premortem: v })} placeholder="It failed because …" />
      </Field>
      <Field label="To the people who favored another option" hint="What would you say to them? This tests whether you understood their case." wide>
        <Area rows={2} value={d.notChosen} onChange={(v) => set({ notChosen: v })} />
      </Field>
    </div>
  );
}
