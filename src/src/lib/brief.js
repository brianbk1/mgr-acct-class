import { kpiSeries, kpiBySegment, trendSummary, fmt, computeKpi } from './analysis.js';
import { STAGES, stageScore } from './stages.js';
import { fileLabel } from './workspace.js';

function kpiFacts(state) {
  return state.kpis.filter((k) => k.column && state.data.files[k.file]).map((k) => {
    const f = state.data.files[k.file];
    const overall = computeKpi(k, f.rows, f.dateCol);
    const series = f.dateCol ? kpiSeries(k, f.rows, f.dateCol, state.analysis.grain) : [];
    const tr = trendSummary(series);
    const segCol = state.analysis.segments?.[k.id];
    const seg = segCol ? kpiBySegment(k, f.rows, segCol, f.dateCol) : [];
    return { k, f, overall, tr, seg, segCol };
  });
}

function filesList(state) {
  return state.data.order.map((key) => state.data.files[key]).filter(Boolean);
}

// Compact, numbers-only context for the optional AI coach. Raw rows never leave the browser.
export function coachContext(state, stageId) {
  const q = state.question;
  const lines = [
    `Current stage: ${stageId}`,
    `Decision question: ${q.decision || '(not written)'}`,
    `Context: ${q.context || '-'}`,
    `Options: ${q.options.filter(Boolean).join(' | ') || '-'}`,
    `Initial lean: ${q.initialLean || '-'}`,
    `What would change their mind: ${q.changeMind || '-'}`,
    `Data files: ${filesList(state).map((f) => `${f.name} (${f.rows.length} rows)`).join(', ') || 'none'}`,
    `Data source: ${state.data.source || '-'}; known gaps: ${state.data.gaps || '-'}`,
  ];
  kpiFacts(state).forEach(({ k, f, overall, tr, seg, segCol }) => {
    lines.push(`KPI "${k.name}" from ${f.name} (${k.type}, ${k.direction === 'down' ? 'lower is better' : 'higher is better'}, target ${k.target || 'none'}): overall ${fmt(overall, k)}` +
      (tr ? `; ${tr.firstLabel} ${fmt(tr.first, k)} → ${tr.lastLabel} ${fmt(tr.last, k)}, typical period-to-period swing ${fmt(tr.volatility, k)}` : '') +
      (seg.length ? `; by ${segCol}: ${seg.slice(0, 6).map((s) => `${s.label} ${fmt(s.value, k)}`).join(', ')}` : ''));
  });
  if (state.evidence?.length) lines.push(`Pinned evidence: ${state.evidence.map((e) => `${e.label} = ${e.value} [${e.fileName}]`).join('; ')}`);
  const a = state.analysis, d = state.decision;
  if (a.observations) lines.push(`User observations: ${a.observations}`);
  if (a.assumptions) lines.push(`User assumptions: ${a.assumptions}`);
  if (a.alternatives) lines.push(`Alternative explanations: ${a.alternatives}`);
  if (d.choice) lines.push(`Decision: ${d.choice} (confidence ${d.confidence}%, ${d.reversibility} door). Rationale: ${d.rationale}`);
  if (d.biggestRisk) lines.push(`Biggest risk: ${d.biggestRisk}`);
  if (d.invest) lines.push(`Investment allocation: ${d.invest}`);
  if (d.premortem) lines.push(`Pre-mortem: ${d.premortem}`);
  if (state.pivot.triggers.length) lines.push(`Pivot triggers: ${state.pivot.triggers.map((t) => `${state.kpis.find((k) => k.id === t.kpiId)?.name} ${t.condition} ${t.threshold} → ${t.action}`).join('; ')}`);
  return lines.join('\n');
}

export function buildBoardUpdate(state) {
  const d = state.decision, a = state.analysis, p = state.pivot;
  const facts = kpiFacts(state);
  const t = p.triggers[0];
  const tk = t && state.kpis.find((k) => k.id === t.kpiId);
  const out = [];
  out.push(`# Board update — ${state.question.decision || 'Decision'}`);
  out.push(`_${new Date().toLocaleDateString()} · ${state.question.owner || ''}_\n`);
  out.push(`**1. Our answer to the question.** ${a.soWhat || '—'}`);
  out.push(`\n**2. CEO dashboard KPIs.** ${facts.map(({ k, tr, overall }) => `${k.name} (now ${fmt(tr ? tr.last : overall, k)}${k.target ? `, target ${fmt(Number(k.target), k)}` : ''})`).join('; ') || '—'}`);
  out.push(`\n**3. Biggest risk.** ${d.biggestRisk || '—'}`);
  out.push(`\n**4. Recommendation and where the next dollars go.** ${d.choice || '—'}. ${d.invest || ''}`);
  out.push(`\n**5. What we would change in the current plan.** ${d.planChanges || '—'}`);
  out.push(`\n**6. What would make us pivot.** ${t ? `If ${tk?.name} is ${t.condition} ${t.threshold} for ${t.periods || 1} check-in(s), we will ${t.action}.` : '—'}`);
  if (state.evidence?.length) {
    out.push(`\n**Evidence** (${state.evidence.length} data points from ${new Set(state.evidence.map((e) => e.file)).size} files)`);
    state.evidence.forEach((e) => out.push(`- ${e.label}: **${e.value}** — _${e.fileName}_${e.note ? ` (${e.note})` : ''}`));
  }
  out.push(`\nConfidence: ${d.confidence}% · ${d.reversibility === 'one-way' ? 'Hard to reverse' : 'Reversible'}`);
  return out.join('\n');
}

export function buildBrief(state) {
  const q = state.question, d = state.decision, m = state.measurement, p = state.pivot, a = state.analysis;
  const facts = kpiFacts(state);
  const out = [];
  out.push(`# Decision Brief`);
  out.push(`_Generated ${new Date().toLocaleDateString()} with Decision Loop_\n`);
  out.push(`## 1. Question`);
  out.push(`**${q.decision || '(decision not framed)'}**\n`);
  out.push(`- Owner: ${q.owner || '—'}  \n- Decide by: ${q.deadline || '—'}`);
  if (q.context) out.push(`\n${q.context}`);
  out.push(`\n**Options considered**`);
  q.options.filter(Boolean).forEach((o, i) => out.push(`${i + 1}. ${o}`));
  if (q.initialLean) out.push(`\nInitial lean before analysis: ${q.initialLean}`);
  if (q.stakes) out.push(`\nStakes: ${q.stakes}`);
  if (q.changeMind) out.push(`\nWhat would change our mind: ${q.changeMind}`);

  out.push(`\n## 2. Data`);
  filesList(state).forEach((f) => out.push(`- ${fileLabel(f)} — ${f.name} (${f.rows.length} rows)`));
  out.push(`- Source: ${state.data.source || '—'}\n- As of: ${state.data.asOf || '—'}`);
  if (state.data.gaps) out.push(`- Known gaps: ${state.data.gaps}`);

  out.push(`\n## 3. KPIs`);
  out.push(`| KPI | Source | Type | Better | Current | Target | Why it matters |\n|---|---|---|---|---|---|---|`);
  facts.forEach(({ k, f, overall, tr }) => {
    out.push(`| ${k.name} | ${f.name} | ${k.type} | ${k.direction === 'down' ? 'lower' : 'higher'} | ${fmt(tr ? tr.last : overall, k)} | ${k.target ? fmt(Number(k.target), k) : '—'} | ${k.why || ''} |`);
  });

  out.push(`\n## 4. Analysis`);
  facts.forEach(({ k, tr, seg, segCol }) => {
    if (tr) out.push(`- **${k.name}**: ${fmt(tr.first, k)} (${tr.firstLabel}) → ${fmt(tr.last, k)} (${tr.lastLabel}); typical swing ${fmt(tr.volatility, k)} per period.`);
    if (seg.length) out.push(`  - By ${segCol}: ${seg.map((s) => `${s.label} ${fmt(s.value, k)}`).join(', ')}`);
  });
  if (state.evidence?.length) {
    out.push(`\n**Pinned evidence**`);
    state.evidence.forEach((e) => out.push(`- ${e.label}: ${e.value} — ${e.fileName}${e.note ? ` (${e.note})` : ''}`));
  }
  if (a.observations) out.push(`\n**What the data shows:** ${a.observations}`);
  if (a.assumptions) out.push(`\n**Assumptions:** ${a.assumptions}`);
  if (a.alternatives) out.push(`\n**Alternative explanations:** ${a.alternatives}`);
  if (a.soWhat) out.push(`\n**So what:** ${a.soWhat}`);

  out.push(`\n## 5. Decision`);
  out.push(`**${d.choice || '(not yet decided)'}**\n`);
  out.push(`- Confidence: ${d.confidence}%\n- Reversibility: ${d.reversibility === 'one-way' ? 'One-way door (hard to reverse)' : 'Two-way door (reversible)'}`);
  if (d.rationale) out.push(`\n**Rationale:** ${d.rationale}`);
  if (d.biggestRisk) out.push(`\n**Biggest risk:** ${d.biggestRisk}`);
  if (d.invest) out.push(`\n**Resource allocation:** ${d.invest}`);
  if (d.planChanges) out.push(`\n**Changes to the current plan:** ${d.planChanges}`);
  if (d.premortem) out.push(`\n**Pre-mortem:** ${d.premortem}`);
  if (d.notChosen) out.push(`\n**To those who favored another option:** ${d.notChosen}`);

  out.push(`\n## 6. Measurement plan`);
  out.push(`- Owner: ${m.owner || '—'}\n- Cadence: ${m.cadence}\n- First check-in: ${m.firstCheck || '—'}\n- Reviewed in: ${m.reviewForum || '—'}`);
  out.push(`\n| KPI | Baseline | Target | By |\n|---|---|---|---|`);
  state.kpis.forEach((k) => {
    const pl = m.plan[k.id] || {};
    out.push(`| ${k.name} | ${pl.baseline || '—'} | ${pl.target || '—'} | ${pl.by || '—'} |`);
  });

  out.push(`\n## 7. Pivot triggers`);
  p.triggers.forEach((t) => {
    const k = state.kpis.find((x) => x.id === t.kpiId);
    out.push(`- If **${k?.name || '?'}** is ${t.condition} **${t.threshold}** for ${t.periods || 1} check-in(s) → ${t.action}`);
  });
  if (p.checkins.length) {
    out.push(`\n**Check-in log**`);
    p.checkins.forEach((c) => out.push(`- ${c.date}: ${state.kpis.map((k) => `${k.name} ${c.values[k.id] ?? '—'}`).join(', ')}${c.note ? ` — ${c.note}` : ''}`));
  }
  if (p.status) out.push(`\nCurrent call: **${p.status}**`);
  if (p.learnings) out.push(`\n**Learnings for the next loop:** ${p.learnings}`);

  out.push(`\n---\n**Process quality**`);
  STAGES.forEach((s) => {
    const sc = stageScore(s, state);
    out.push(`- ${s.label}: ${sc.done}/${sc.total} checks`);
  });
  return out.join('\n');
}
