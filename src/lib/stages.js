import { kpiSeries, computeKpi } from './analysis.js';

const filled = (s) => typeof s === 'string' && s.trim().length > 0;
const words = (s) => (filled(s) ? s.trim().split(/\s+/).length : 0);

// Each stage: what it is, why it matters, coaching questions, common traps,
// and quality gates that tell the user whether their thinking is ready to move on.
export const STAGES = [
  {
    id: 'question',
    label: 'Question',
    tagline: 'Frame the decision before you touch the data.',
    principle: 'A good question names a choice, an owner, a deadline and real alternatives. Data cannot rescue a vague question.',
    coach: [
      'What will actually be different on Monday morning depending on what you decide?',
      'If you could only choose one option, which would you pick today, and why? Write it down now so you can notice if the data changes your mind.',
      'Is there an option nobody in the room has said out loud — including “do nothing” or “wait”?',
      'Who has to live with this decision, and have they framed the problem the same way you have?',
    ],
    traps: [
      { name: 'Topic, not a decision', tip: '“Our churn” is a topic. “Should we fund onboarding instead of a price increase?” is a decision.' },
      { name: 'Single-option framing', tip: '“Should we do X?” hides the alternatives. Name at least two real paths.' },
      { name: 'No deadline', tip: 'Without a date, analysis expands to fill all available time.' },
    ],
    gates: (s) => [
      { label: 'Phrased as a choice (Should we / Which / Whether…)', ok: /\b(should|which|whether|choose|decide|pick)\b/i.test(s.question.decision) },
      { label: 'Decision owner named', ok: filled(s.question.owner) },
      { label: 'Decision deadline set', ok: filled(s.question.deadline) },
      { label: 'At least two real options', ok: s.question.options.filter(filled).length >= 2 },
      { label: 'You wrote what would change your mind', ok: words(s.question.changeMind) >= 6 },
    ],
  },
  {
    id: 'data',
    label: 'Data',
    tagline: 'Gather the evidence — and know its limits.',
    principle: 'Data is a sample of reality collected by someone, for some purpose, with gaps. Know who, what and when before you trust it.',
    coach: [
      'If you could have any dataset in the world for this decision, what would it be? How far is what you have from that?',
      'Who collected this data, and what were they rewarded for? Could that shape what got recorded?',
      'What is missing — customers who left, schools that opted out, deals that never got logged?',
      'Is this data recent enough to describe the world you are deciding about?',
    ],
    traps: [
      { name: 'Survivorship', tip: 'Data on current customers says little about why the others left.' },
      { name: 'Using what is easy', tip: 'The dataset you have is not automatically the dataset you need.' },
      { name: 'Undefined fields', tip: 'Does “active” mean logged in, paid, or under contract? Confirm definitions before computing anything.' },
    ],
    gates: (s) => [
      { label: 'Data loaded', ok: Object.keys(s.data.files).length > 0 },
      { label: 'Source documented', ok: filled(s.data.source) },
      { label: '“As of” date recorded', ok: filled(s.data.asOf) },
      { label: 'Quality checklist reviewed (3 of 4)', ok: Object.values(s.data.checks || {}).filter(Boolean).length >= 3 },
      { label: 'Data gaps named', ok: words(s.data.gaps) >= 5 },
    ],
  },
  {
    id: 'kpi',
    label: 'KPI',
    tagline: 'Decide what “better” means — in numbers.',
    principle: 'Pick a few measures tied directly to the decision. Pair a lagging outcome with a leading signal you can act on sooner.',
    coach: [
      'If this KPI improved and nothing else did, would you be happy? If not, it is not the right KPI.',
      'Which measure moves first — weeks before the outcome you care about?',
      'How could someone hit this target while making the business worse? (That is your counter-metric.)',
      'Who owns each number, and do they believe it?',
    ],
    traps: [
      { name: 'Too many KPIs', tip: 'Ten KPIs is a dashboard, not a decision. Two to four is usually right.' },
      { name: 'Only lagging measures', tip: 'Revenue tells you what already happened. You need an early signal to steer.' },
      { name: 'Targets without baselines', tip: 'A target only means something relative to where you are now. The Analysis step shows you the baseline.' },
    ],
    gates: (s) => [
      { label: '2–4 KPIs defined', ok: s.kpis.filter((k) => k.column && k.file).length >= 2 && s.kpis.length <= 4 },
      { label: 'At least one leading indicator', ok: s.kpis.some((k) => k.type === 'leading' && k.column) },
      { label: 'At least one lagging outcome', ok: s.kpis.some((k) => k.type === 'lagging' && k.column) },
      { label: 'Every KPI explains why it matters', ok: s.kpis.length > 0 && s.kpis.every((k) => words(k.why) >= 4) },
    ],
  },
  {
    id: 'analysis',
    label: 'Analysis',
    tagline: 'Separate what the data shows from what you believe.',
    principle: 'The tool computes the numbers. You supply the interpretation, the assumptions and the competing explanations.',
    coach: [
      'What is the simplest explanation for this pattern? What is the second simplest?',
      'Is the change bigger than the normal month-to-month noise? Look at the volatility figure before you believe the trend.',
      'Which segment is driving the overall number? Averages hide where the problem lives.',
      'Do the files agree with each other? Check one number two ways — e.g., revenue in the financials vs. ARR in the accounts list.',
      'Correlation check: could something else cause both things you are seeing move together?',
      'What would you expect to see if your preferred option were wrong? Do you see it?',
    ],
    traps: [
      { name: 'Confirmation bias', tip: 'Looking only for the chart that supports what you wanted to do anyway.' },
      { name: 'Reading noise as signal', tip: 'A two-month move in a volatile metric is often nothing.' },
      { name: 'Simpson’s paradox', tip: 'A trend can reverse when you split by segment. Always check the breakdown.' },
      { name: 'Unverified AI summaries', tip: 'If an AI tool gives you a number, find the row it came from and pin it. Unpinned claims do not go in the board update.' },
    ],
    gates: (s) => [
      { label: 'At least 5 evidence points pinned', ok: (s.evidence || []).length >= 5 },
      { label: 'Evidence drawn from 3+ different files', ok: new Set((s.evidence || []).map((e) => e.file)).size >= 3 },
      { label: 'A KPI broken down by segment', ok: Object.values(s.analysis.segments || {}).some(filled) },
      { label: 'Observations written (facts only)', ok: words(s.analysis.observations) >= 15 },
      { label: 'Assumptions made explicit', ok: words(s.analysis.assumptions) >= 8 },
      { label: 'At least one alternative explanation', ok: words(s.analysis.alternatives) >= 8 },
    ],
  },
  {
    id: 'decision',
    label: 'Decision',
    tagline: 'Commit — with your confidence and risks on the record.',
    principle: 'Management judgment means choosing under uncertainty. Record why, how sure you are, and how this could go wrong.',
    coach: [
      'Did the analysis change your mind from what you wrote at the start? If not, did it really test your view?',
      'Is this a one-way door (hard to reverse) or a two-way door? Two-way doors deserve speed; one-way doors deserve care.',
      'Pre-mortem: it is a year from now and this failed. What is the most likely story?',
      'What would you tell the people who favored the option you did not choose?',
    ],
    traps: [
      { name: 'Waiting for certainty', tip: 'You will rarely have it. A decision with a measurement plan beats a perfect analysis that arrives too late.' },
      { name: 'Overconfidence', tip: 'If you are 95% sure, ask what evidence would make you 70% sure — and whether you have looked.' },
      { name: 'Unrecorded reasoning', tip: 'If you do not write down why, you cannot learn from the outcome. Hindsight will rewrite it for you.' },
    ],
    gates: (s) => [
      { label: 'Option chosen', ok: filled(s.decision.choice) },
      { label: 'Biggest risk named', ok: words(s.decision.biggestRisk) >= 6 },
      { label: 'Resource allocation stated', ok: words(s.decision.invest) >= 6 },
      { label: 'Rationale links to the analysis', ok: words(s.decision.rationale) >= 20 },
      { label: 'Confidence recorded', ok: Number.isFinite(s.decision.confidence) },
      { label: 'Pre-mortem completed', ok: words(s.decision.premortem) >= 10 },
      { label: 'Message to those who disagreed', ok: words(s.decision.notChosen) >= 8 },
    ],
  },
  {
    id: 'measurement',
    label: 'Measurement',
    tagline: 'Decide now how you will know if it is working.',
    principle: 'Set baselines, targets and check-in dates before results arrive — so the results cannot quietly move the goalposts.',
    coach: [
      'What is the earliest point you could reasonably see a signal? Put a check-in there.',
      'How big a change is meaningful versus normal noise? Use the volatility from Analysis.',
      'Who will pull the numbers, and will they pull them the same way each time?',
      'What would “working, but slower than hoped” look like? Decide now how you would treat it.',
    ],
    traps: [
      { name: 'Moving goalposts', tip: 'Targets set after results come in are not targets.' },
      { name: 'Checking too late', tip: 'If the first review is at the end, you have no chance to adjust.' },
      { name: 'Vanity measures', tip: 'Activity (sessions held, emails sent) is not impact unless it is linked to the outcome.' },
    ],
    gates: (s) => [
      { label: 'Every KPI has a baseline', ok: s.kpis.length > 0 && s.kpis.every((k) => filled(String(s.measurement.plan[k.id]?.baseline ?? ''))) },
      { label: 'Every KPI has a target', ok: s.kpis.length > 0 && s.kpis.every((k) => filled(String(s.measurement.plan[k.id]?.target ?? k.target ?? ''))) },
      { label: 'Measurement owner named', ok: filled(s.measurement.owner) },
      { label: 'First check-in date set', ok: filled(s.measurement.firstCheck) },
    ],
  },
  {
    id: 'pivot',
    label: 'Pivot',
    tagline: 'Pre-commit to what you will do if reality disagrees.',
    principle: 'Decide your pivot triggers while you are calm. Then log results honestly and let the triggers — not your ego — call it.',
    coach: [
      'What result would make you stop? Not “reconsider” — stop.',
      'Are your triggers tied to the leading indicator, so you hear bad news early?',
      'When a trigger fires, who has the authority to act on it?',
      'What did you learn that changes how you will frame the next question?',
    ],
    traps: [
      { name: 'Sunk cost', tip: '“We have already invested so much” is not a reason to continue.' },
      { name: 'Vague triggers', tip: '“If it is not working” will never fire. Use a number and a date.' },
      { name: 'Pivoting on noise', tip: 'One bad month is not a trend. Require the trigger to hold for a set number of check-ins.' },
    ],
    gates: (s) => [
      { label: 'At least one numeric pivot trigger', ok: s.pivot.triggers.some((t) => t.kpiId && filled(String(t.threshold)) && filled(t.action)) },
      { label: 'A trigger watches a leading indicator', ok: s.pivot.triggers.some((t) => s.kpis.find((k) => k.id === t.kpiId)?.type === 'leading') },
      { label: 'At least one check-in logged', ok: s.pivot.checkins.length > 0 },
      { label: 'Learnings captured for the next loop', ok: words(s.pivot.learnings) >= 10 },
    ],
  },
];

export function stageScore(stage, state) {
  const g = stage.gates(state);
  return { done: g.filter((x) => x.ok).length, total: g.length, gates: g };
}

export function emptyState() {
  return {
    question: { decision: '', context: '', owner: '', deadline: '', options: ['', ''], stakes: '', changeMind: '', initialLean: '' },
    data: { files: {}, order: [], active: '', source: '', asOf: '', checks: {}, gaps: '' },
    evidence: [],
    deck: null,
    kpis: [],
    analysis: { grain: 'month', segments: {}, observations: '', assumptions: '', alternatives: '', soWhat: '' },
    decision: { choice: '', rationale: '', confidence: 60, reversibility: 'two-way', biggestRisk: '', invest: '', planChanges: '', premortem: '', notChosen: '' },
    measurement: { plan: {}, owner: '', cadence: 'monthly', firstCheck: '', reviewForum: '' },
    pivot: { triggers: [], checkins: [], learnings: '', status: '' },
  };
}

// Baseline helper used by Measurement: the latest full period, if a time column is set.
export function kpiFile(kpi, state) {
  return state.data.files[kpi.file] || null;
}

export function latestBaseline(kpi, state) {
  const f = kpiFile(kpi, state);
  if (!f) return null;
  if (!f.dateCol) { const v = computeKpi(kpi, f.rows); return Number.isFinite(v) ? v : null; }
  const series = kpiSeries(kpi, f.rows, f.dateCol, state.analysis.grain);
  const last = series.filter((p) => Number.isFinite(p.value)).pop();
  return last ? last.value : null;
}
