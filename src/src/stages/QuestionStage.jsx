import { Field, Text, Area, StageHeader, Callout } from '../components/ui.jsx';

export default function QuestionStage({ state, update, stage }) {
  const q = state.question;
  const set = (patch) => update('question', patch);
  const setOpt = (i, v) => set({ options: q.options.map((o, j) => (j === i ? v : o)) });

  return (
    <div className="stage">
      <StageHeader stage={stage} index={0} />

      <Field label="The decision" hint="Write it as a choice someone has to make: “Should we…”, “Which…”, “Whether to…”." wide>
        <Area rows={2} value={q.decision} onChange={(v) => set({ decision: v })} placeholder="Should we … or …?" />
      </Field>

      <Field label="Context" hint="What is happening that makes this decision necessary now?" wide>
        <Area value={q.context} onChange={(v) => set({ context: v })} placeholder="What changed, who is asking, what is at stake…" />
      </Field>

      <div className="row">
        <Field label="Decision owner" hint="One accountable person or body.">
          <Text value={q.owner} onChange={(v) => set({ owner: v })} placeholder="e.g. CEO, VP Revenue, the board" />
        </Field>
        <Field label="Decide by" hint="When does this need to be settled?">
          <Text type="date" value={q.deadline} onChange={(v) => set({ deadline: v })} />
        </Field>
      </div>

      <div className="field wide">
        <span className="field-label">Options on the table</span>
        <span className="field-hint">At least two real alternatives. “Do nothing” and “wait for more information” count — if you name them.</span>
        {q.options.map((o, i) => (
          <div className="option-row" key={i}>
            <span className="option-letter">{String.fromCharCode(65 + i)}</span>
            <input value={o} placeholder={`Option ${String.fromCharCode(65 + i)}`} onChange={(e) => setOpt(i, e.target.value)} />
            {q.options.length > 2 && (
              <button className="icon-btn" aria-label="Remove option" onClick={() => set({ options: q.options.filter((_, j) => j !== i) })}>✕</button>
            )}
          </div>
        ))}
        {q.options.length < 5 && <button className="btn ghost small" onClick={() => set({ options: [...q.options, ''] })}>+ Add option</button>}
      </div>

      <Field label="Your initial lean (private hunch)" hint="Before looking at data, which option would you pick and why? You will compare this to your final decision." wide>
        <Area rows={2} value={q.initialLean} onChange={(v) => set({ initialLean: v })} placeholder="Right now I lean toward … because …" />
      </Field>

      <Field label="Stakes" hint="Money, people, reputation, reversibility. What does it cost to get this wrong?" wide>
        <Area rows={2} value={q.stakes} onChange={(v) => set({ stakes: v })} />
      </Field>

      <Field label="What would change your mind?" hint="Name the evidence that would make you choose differently. This is the most important field on the page." wide>
        <Area rows={2} value={q.changeMind} onChange={(v) => set({ changeMind: v })} placeholder="If we saw … we would choose … instead." />
      </Field>

      <Callout kind="tip" title="Why start here?">
        Teams that start with the data tend to answer the question the data happens to support. Framing the decision first tells you which data matters and which is noise.
      </Callout>
    </div>
  );
}
