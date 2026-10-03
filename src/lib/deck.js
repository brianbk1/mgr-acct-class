// Deck building: chart presets from CRM data, an AI-ready data brief, slide templates,
// a parser for AI-written outlines, and citation counting.
import {
  accountsSummary, pipelineSummary, campaignsByChannel, usageByMonth, financialSummary,
  teamSummary, planPressureTest, activityByRep, asOfDate, money, pct, num,
} from './crm.js';
import { toNumber } from './analysis.js';
import { fileLabel } from './workspace.js';

let seq = 0;
export const slideId = () => `s${Date.now().toString(36)}${(seq++).toString(36)}`;

// ---------------------------------------------------------------- Charts
// Each preset returns { title, type: 'line' | 'bar', labels, values, unit: '$' | '%' | '', source, reference? }
export const CHARTS = [
  { id: 'cash', label: 'Ending cash by month (vs. reserve)', needs: 'financials' },
  { id: 'revenue', label: 'Revenue by month', needs: 'financials' },
  { id: 'ebitda', label: 'EBITDA by month', needs: 'financials' },
  { id: 'plan', label: '2027 plan scenarios vs. 2026 revenue', needs: 'plan' },
  { id: 'winrate_source', label: 'Win rate by lead source', needs: 'opportunities' },
  { id: 'won_source', label: 'Closed-won $ by lead source', needs: 'opportunities' },
  { id: 'won_rep', label: 'Closed-won $ by sales rep', needs: 'opportunities' },
  { id: 'lost', label: 'Why deals are lost', needs: 'opportunities' },
  { id: 'channel_roi', label: 'Bookings per marketing $ by channel', needs: 'campaigns' },
  { id: 'adoption', label: 'Product adoption by month', needs: 'usage' },
  { id: 'arr_segment', label: 'ARR by customer segment', needs: 'accounts' },
  { id: 'arr_risk', label: 'ARR by churn risk', needs: 'accounts' },
  { id: 'arr_industry', label: 'ARR by industry', needs: 'accounts' },
  { id: 'team_cost', label: 'Team cost by department', needs: 'employees' },
];

export function availableCharts(state) {
  return CHARTS.filter((c) => state.data.files[c.needs]);
}

export function chartData(id, state) {
  const F = state.data.files;
  const company = F.company?.rows[0];
  const src = (k) => F[k]?.name || '';
  switch (id) {
    case 'cash': case 'revenue': case 'ebitda': {
      if (!F.financials) return null;
      const s = financialSummary(F.financials.rows, company);
      const key = { cash: '_cash', revenue: '_rev', ebitda: '_ebitda' }[id];
      return {
        title: { cash: 'Ending cash by month', revenue: 'Revenue by month', ebitda: 'EBITDA by month' }[id],
        type: id === 'revenue' ? 'bar' : 'line',
        labels: s.rows.map((r) => r.month.slice(0, 7) + (r._actual ? '' : '*')),
        values: s.rows.map((r) => r[key]),
        unit: '$',
        reference: id === 'cash' && Number.isFinite(s.reserve) ? { value: s.reserve, label: 'Reserve target' } : null,
        note: s.rows.some((r) => !r._actual) ? '* forecast month' : '',
        source: src('financials'),
      };
    }
    case 'plan': {
      if (!F.plan) return null;
      const fin = F.financials ? financialSummary(F.financials.rows, company) : null;
      const labels = [], values = [];
      if (fin) { labels.push('2026 (act.+fcst)'); values.push(fin.fyRevenue); }
      F.plan.rows.forEach((r) => { labels.push(r.scenario); values.push(toNumber(r.projected_revenue)); });
      return { title: '2027 revenue scenarios vs. 2026', type: 'bar', labels, values, unit: '$', source: [src('plan'), fin && src('financials')].filter(Boolean).join(', ') };
    }
    case 'winrate_source': case 'won_source': case 'won_rep': case 'lost': {
      if (!F.opportunities) return null;
      const p = pipelineSummary(F.opportunities.rows);
      if (id === 'lost') return { title: 'Lost deals by reason', type: 'bar', labels: p.lostReasons.map((r) => r.key), values: p.lostReasons.map((r) => r.count), unit: '', source: src('opportunities') };
      const g = id === 'won_rep' ? p.byRep : p.bySource;
      const rows = [...g].sort((a, b) => (id === 'winrate_source' ? b.winRate - a.winRate : b.wonAmt - a.wonAmt));
      return {
        title: { winrate_source: 'Win rate by lead source', won_source: 'Closed-won bookings by lead source', won_rep: 'Closed-won bookings by sales rep' }[id],
        type: 'bar', labels: rows.map((r) => r.key),
        values: rows.map((r) => (id === 'winrate_source' ? r.winRate * 100 : r.wonAmt)),
        unit: id === 'winrate_source' ? '%' : '$', source: src('opportunities'),
      };
    }
    case 'channel_roi': {
      if (!F.campaigns) return null;
      const ch = campaignsByChannel(F.campaigns.rows);
      return { title: 'Bookings per marketing dollar, by channel', type: 'bar', labels: ch.map((c) => c.key), values: ch.map((c) => c.bookingRoi), unit: 'x', source: src('campaigns') };
    }
    case 'adoption': {
      if (!F.usage) return null;
      const m = usageByMonth(F.usage.rows);
      return { title: 'Product adoption rate (active ÷ licensed users)', type: 'line', labels: m.map((r) => r.label), values: m.map((r) => r.adoption * 100), unit: '%', source: src('usage') };
    }
    case 'arr_segment': case 'arr_industry': case 'arr_risk': {
      if (!F.accounts) return null;
      const s = accountsSummary(F.accounts.rows, asOfDate(state));
      if (id === 'arr_risk') {
        const order = ['High', 'Medium', 'Low'];
        const by = {};
        F.accounts.rows.forEach((r) => { by[r.churn_risk] = (by[r.churn_risk] || 0) + toNumber(r.contract_arr); });
        const keys = Object.keys(by).sort((a, b) => order.indexOf(a) - order.indexOf(b));
        return { title: 'Contracted ARR by churn risk', type: 'bar', labels: keys, values: keys.map((k) => by[k]), unit: '$', source: src('accounts') };
      }
      const g = id === 'arr_segment' ? s.bySegment : s.byIndustry;
      return { title: id === 'arr_segment' ? 'Contracted ARR by segment' : 'Contracted ARR by industry', type: 'bar', labels: g.map((r) => r.key), values: g.map((r) => r.arr), unit: '$', source: src('accounts') };
    }
    case 'team_cost': {
      if (!F.employees) return null;
      const t = teamSummary(F.employees.rows);
      return { title: 'Annual team cost by department (incl. planned hires)', type: 'bar', labels: t.byDept.map((d) => d.key), values: t.byDept.map((d) => d.cost), unit: '$', source: src('employees') };
    }
    default: return null;
  }
}

export function fmtUnit(v, unit) {
  if (!Number.isFinite(v)) return '—';
  if (unit === '$') return money(v);
  if (unit === '%') return `${v.toFixed(1)}%`;
  if (unit === 'x') return `${v.toFixed(1)}×`;
  return num(v, Math.abs(v) < 10 ? 1 : 0);
}

// ---------------------------------------------------------------- Data brief for AI
export function buildDataBrief(state) {
  const F = state.data.files;
  const company = F.company?.rows[0];
  const L = [];
  const files = state.data.order.map((k) => F[k]).filter(Boolean);
  L.push(`DATA BRIEF (computed from ${files.length} files: ${files.map((f) => f.name).join(', ')})`);
  if (company) {
    L.push(`\n## Company (${F.company.name})`);
    Object.entries(company).forEach(([k, v]) => L.push(`- ${k}: ${v}`));
  }
  if (F.financials) {
    const s = financialSummary(F.financials.rows, company);
    L.push(`\n## Financials (${F.financials.name})`);
    L.push(`- 2026 revenue: ${money(s.ytdRevenue)} actual YTD (${s.actualMonths} months); ${money(s.fyRevenue)} full year incl. forecast${Number.isFinite(s.target) ? ` vs ${money(s.target)} target` : ''}`);
    L.push(`- Average gross margin (actual months): ${pct(s.avgGm)}; EBITDA YTD: ${money(s.ytdEbitda)}; average monthly cash change: ${money(s.avgBurn)}`);
    L.push(`- Latest actual ending cash (${s.lastActual?.month?.slice(0, 7)}): ${money(s.cash)}; reserve target ${money(s.reserve)}; forecast year-end cash ${money(s.yearEndCash)}${s.breach ? `; first month below reserve: ${s.breach.month.slice(0, 7)}` : ''}`);
    L.push(`- Monthly: ${s.rows.map((r) => `${r.month.slice(0, 7)}${r._actual ? '' : '(fcst)'} rev ${money(r._rev)}, EBITDA ${money(r._ebitda)}, cash ${money(r._cash)}`).join('; ')}`);
  }
  if (F.accounts) {
    const s = accountsSummary(F.accounts.rows, asOfDate(state));
    L.push(`\n## Accounts (${F.accounts.name})`);
    L.push(`- ${s.count} accounts, contracted ARR ${money(s.totalArr)}; avg health ${num(s.avgHealth, 1)}, avg adoption ${pct(s.avgAdoption)}, avg NPS ${num(s.avgNps, 0)}, avg discount ${pct(s.avgDiscount)}`);
    L.push(`- ARR at medium/high churn risk: ${money(s.riskyArr)} (${s.riskyCount} accounts); high-risk accounts: ${s.highRisk.map((a) => `${a.account_name} (${money(a._arr)}, health ${num(a._health)}, renews ${a.renewal_date})`).join('; ') || 'none'}`);
    L.push(`- Accounts under 40% contribution margin: ${s.lowMargin.length} (${money(s.lowMarginArr)} ARR): ${s.lowMargin.slice(0, 8).map((a) => `${a.account_name} ${pct(a._margin, 0)}`).join(', ')}`);
    L.push(`- Top 10% of accounts hold ${pct(s.top10Share, 0)} of ARR`);
    L.push(`- By segment: ${s.bySegment.map((g) => `${g.key} ${g.count} accts, ${money(g.arr)}, health ${num(g.health, 0)}, margin ${pct(g.margin, 0)}`).join('; ')}`);
    L.push(`- By industry: ${s.byIndustry.map((g) => `${g.key} ${money(g.arr)} (${g.count})`).join('; ')}`);
    L.push(`- By CS owner: ${s.byOwner.map((g) => `${g.key} ${g.count} accts, ${money(g.arr)}, ${num(g.cs, 0)} CS hrs/90d`).join('; ')}`);
  }
  if (F.opportunities) {
    const p = pipelineSummary(F.opportunities.rows);
    L.push(`\n## Pipeline (${F.opportunities.name})`);
    L.push(`- ${p.total} opportunities: ${p.won.length} won (${money(p.wonAmt)}), ${p.lost.length} lost, ${p.open.length} open (${money(p.openAmt)}; weighted ${money(p.weighted)}). Win rate ${pct(p.winRate, 0)}; avg won deal ${money(p.avgWon)}; avg discount on won ${pct(p.avgDiscWon)}`);
    const g = (rows) => rows.map((r) => `${r.key}: win ${pct(r.winRate, 0)} (${r.won}W/${r.lost}L), won ${money(r.wonAmt)}, open weighted ${money(r.weighted)}`).join('; ');
    L.push(`- By source: ${g(p.bySource)}`);
    L.push(`- By type: ${g(p.byType)}`);
    L.push(`- By product: ${g(p.byProduct)}`);
    L.push(`- By rep: ${g(p.byRep)}`);
    L.push(`- Lost reasons: ${p.lostReasons.map((r) => `${r.key} ${r.count}`).join(', ')}`);
    L.push(`- Open deals 30+ days in stage: ${p.staleOpen.length}`);
  }
  if (F.campaigns) {
    const ch = campaignsByChannel(F.campaigns.rows);
    L.push(`\n## Marketing (${F.campaigns.name})`);
    ch.forEach((c) => L.push(`- ${c.key}: ${c.campaigns} campaigns, spend ${money(c.spend)}, ${num(c.opps)} opps, ${num(c.wins)} wins, bookings ${money(c.bookings)} (${num(c.bookingRoi, 1)}x), CAC ${money(c.cac)}, cycle ${num(c.cycle, 0)} days`));
    L.push(`- Note: campaign-attributed bookings may not reconcile to CRM closed-won.`);
  }
  if (F.activity) {
    L.push(`\n## Sales activity (${F.activity.name})`);
    activityByRep(F.activity.rows, F.opportunities?.rows).forEach((r) => L.push(`- ${r.key}: per week ${num(r.perWeek.calls, 0)} calls, ${num(r.perWeek.meetings, 1)} meetings, ${num(r.perWeek.demos, 1)} demos, ${num(r.perWeek.proposals, 1)} proposals; demo→proposal ${pct(r.demoToProposal, 0)}`));
  }
  if (F.usage) {
    const m = usageByMonth(F.usage.rows);
    L.push(`\n## Product usage (${F.usage.name})`);
    L.push(`- Monthly: ${m.map((r) => `${r.label} adoption ${pct(r.adoption)}, AI Coach users ${num(r.aiCoach)}, Analytics Pro users ${num(r.analytics)}, TTV ${num(r.ttv, 1)}d, tickets ${num(r.tickets)}`).join('; ')}`);
  }
  if (F.employees) {
    const t = teamSummary(F.employees.rows);
    L.push(`\n## Team (${F.employees.name})`);
    L.push(`- ${t.active.length} active, fully-loaded cost ${money(t.activeCost)}/yr; ${t.planned.length} planned hires ${money(t.plannedCost)}/yr: ${t.planned.map((r) => `${r.role} (${r.start_date}, ${r.business_case})`).join('; ')}`);
  }
  if (F.plan) {
    const t = planPressureTest(state);
    L.push(`\n## 2027 plan scenarios (${F.plan.name})`);
    F.plan.rows.forEach((r) => L.push(`- ${Object.entries(r).map(([k, v]) => `${k}: ${v}`).join(', ')}`));
    L.push(`- 2026 evidence: renewal win rate in CRM ${pct(t.evidence.renewalWinRate, 0)}; gross margin ${pct(t.evidence.grossMargin)}`);
  }
  Object.values(F).filter((f) => f.kind === 'generic').forEach((f) => {
    L.push(`\n## ${f.name}: ${f.rows.length} rows; columns ${f.columns.join(', ')}`);
  });
  if (state.evidence?.length) {
    L.push(`\n## Evidence the team pinned`);
    state.evidence.forEach((e) => L.push(`- ${e.label}: ${e.value} (${e.fileName})${e.note ? ` — team note: ${e.note}` : ''}`));
  }
  return L.join('\n');
}

// ---------------------------------------------------------------- Scorecard auto-fill
export function autoScorecard(state) {
  const F = state.data.files;
  const company = F.company?.rows[0];
  const rows = [];
  const fin = F.financials ? financialSummary(F.financials.rows, company) : null;
  const fn = (k) => F[k]?.name || '';
  const sign = (v, f) => (Number.isFinite(v) ? `${v >= 0 ? '+' : '-'}${f(Math.abs(v))}` : '');
  if (fin) {
    rows.push({ kpi: '2026 revenue (actual + forecast)', basis: `${fn('financials')} · full year`, value: money(fin.fyRevenue), compare: Number.isFinite(fin.target) ? money(fin.target) : '—', change: Number.isFinite(fin.vsTarget) ? sign(fin.vsTarget, money) : '', rag: Number.isFinite(fin.vsTarget) ? (fin.vsTarget >= 0 ? 'G' : 'R') : '' });
    const goal = company ? toNumber(company['2027_revenue_goal']) : NaN;
    if (Number.isFinite(goal)) rows.push({ kpi: '2027 revenue goal', basis: `${fn('company')} vs 2026`, value: money(goal), compare: money(fin.fyRevenue), change: `+${pct(goal / fin.fyRevenue - 1, 0)} needed`, rag: '' });
    rows.push({ kpi: `Ending cash (${fin.lastActual?.month?.slice(0, 7) || 'latest'})`, basis: `${fn('financials')} · latest actual`, value: money(fin.cash), compare: Number.isFinite(fin.reserve) ? `${money(fin.reserve)} reserve` : '—', change: Number.isFinite(fin.reserve) ? sign(fin.cash - fin.reserve, money) : '', rag: Number.isFinite(fin.reserve) ? (fin.cash >= fin.reserve ? 'G' : 'R') : '' });
    rows.push({ kpi: 'Average monthly cash change', basis: `${fn('financials')} · actual months`, value: money(fin.avgBurn), compare: '$0', change: sign(fin.avgBurn, money), rag: fin.avgBurn >= 0 ? 'G' : 'R' });
    const planGm = F.plan ? toNumber(F.plan.rows.find((r) => /management/i.test(r.scenario))?.gross_margin_pct) : NaN;
    rows.push({ kpi: 'Gross margin', basis: `${fn('financials')} · actual avg`, value: pct(fin.avgGm), compare: Number.isFinite(planGm) ? `${pct(planGm, 0)} plan` : '—', change: Number.isFinite(planGm) ? `${fin.avgGm >= planGm ? '+' : '-'}${num(Math.abs(fin.avgGm - planGm) * 100, 1)} pts` : '', rag: Number.isFinite(planGm) ? (fin.avgGm >= planGm ? 'G' : 'Y') : '' });
  }
  if (F.accounts) {
    const a = accountsSummary(F.accounts.rows, asOfDate(state));
    rows.push({ kpi: 'Contracted ARR', basis: `${fn('accounts')} · ${a.count} accounts`, value: money(a.totalArr), compare: '—', change: '', rag: '' });
    const share = a.riskyArr / a.totalArr;
    rows.push({ kpi: 'ARR at medium/high churn risk', basis: `${fn('accounts')}`, value: money(a.riskyArr), compare: '—', change: `${pct(share, 0)} of ARR`, rag: share > 0.25 ? 'R' : share > 0.1 ? 'Y' : 'G' });
  }
  if (F.opportunities) {
    const p = pipelineSummary(F.opportunities.rows);
    rows.push({ kpi: 'Win rate (closed deals)', basis: `${fn('opportunities')}`, value: pct(p.winRate, 0), compare: '—', change: `${p.won.length}W / ${p.lost.length}L`, rag: '' });
    const t = planPressureTest(state);
    const planRenew = F.plan ? toNumber(F.plan.rows.find((r) => /management/i.test(r.scenario))?.renewal_rate) : NaN;
    if (Number.isFinite(t.evidence.renewalWinRate)) rows.push({ kpi: 'Renewal win rate', basis: `${fn('opportunities')} · renewals`, value: pct(t.evidence.renewalWinRate, 0), compare: Number.isFinite(planRenew) ? `${pct(planRenew, 0)} plan` : '—', change: Number.isFinite(planRenew) ? `${t.evidence.renewalWinRate >= planRenew ? '+' : '-'}${num(Math.abs(t.evidence.renewalWinRate - planRenew) * 100, 0)} pts` : '', rag: Number.isFinite(planRenew) ? (t.evidence.renewalWinRate >= planRenew ? 'G' : 'R') : '' });
    rows.push({ kpi: 'Open pipeline (weighted)', basis: `${fn('opportunities')}`, value: money(p.weighted), compare: money(p.openAmt), change: `${p.open.length} open deals`, rag: '' });
  }
  if (F.usage) {
    const m = usageByMonth(F.usage.rows);
    const f = m[0], l = m[m.length - 1];
    rows.push({ kpi: `Product adoption (${l.label})`, basis: `${fn('usage')}`, value: pct(l.adoption), compare: `${pct(f.adoption)} (${f.label})`, change: `${l.adoption >= f.adoption ? '+' : '-'}${num(Math.abs(l.adoption - f.adoption) * 100, 1)} pts`, rag: l.adoption >= f.adoption ? 'G' : 'R' });
  }
  return rows;
}

// Numbers students can drop onto a slide: computed CRM metrics plus anything they pinned.
export function metricOptions(state) {
  const out = autoScorecard(state).map((r, i) => ({
    id: `m${i}`, label: r.kpi, value: r.value,
    sub: [r.compare && r.compare !== '—' ? `vs ${r.compare}` : r.change, r.basis.split(' · ')[0]].filter(Boolean).join(' · '),
    source: r.basis.split(' · ')[0], tone: r.rag === 'G' ? 'good' : r.rag === 'R' ? 'bad' : 'neutral',
  }));
  (state.evidence || []).forEach((e) => out.push({ id: e.id, label: e.label, value: String(e.value).split(/[ ,(]/)[0] || e.value, full: e.value, sub: e.fileName, source: e.fileName, tone: 'neutral', pinned: true }));
  return out;
}

// ---------------------------------------------------------------- Templates
const S = (layout, eyebrow, title, hint, extra = {}) => ({ layout, eyebrow, title, hint, ...extra });
export const TEMPLATES = {
  board: {
    label: 'Board update — 6 questions (visual)',
    slides: [
      S('summary', 'Executive summary', 'Our recommendation in one sentence', 'Write your recommendation as the headline. The six tiles fill themselves from your question slides (their headlines and first big number) — type in a tile only to override it.', { items: [{}, {}, {}, {}, {}, {}], takeaway: '' }),
      S('bignumbers', 'Key numbers', 'The three numbers that matter most', 'Three big numbers that prove your recommendation (use “Insert a number from the CRM”).', { items: [{ icon: 'cash' }, { icon: 'alert' }, { icon: 'target' }] }),
      S('hero', 'Question 1 · Growth plan', 'Is the 2027 growth plan realistic?', 'Headline = yes / no / partly. Two numbers beside the chart that prove it.', { chart: 'plan', stats: [{}, {}] }),
      S('bignumbers', 'Question 2 · CEO dashboard', 'Three KPIs for the CEO dashboard', 'Pick the three KPIs the CEO should watch. Insert each from the CRM, then say what it tells the CEO.', { items: [{ icon: 'chart' }, { icon: 'people' }, { icon: 'cash' }] }),
      S('hero', 'Question 3 · Biggest risk', 'Our biggest financial or operating risk', 'Name one risk in the headline. Show its size and timing.', { chart: 'cash', stats: [{}, {}] }),
      S('allocation', 'Question 4 · Investment', 'Where we would invest the next $100,000', 'Two to four amounts that add up to $100K, each with the data point behind it.', { items: [{}, {}, {}] }),
      S('compare', 'Question 5 · Plan changes', 'What we would change in the current plan', 'Each row: what the plan says → what you would change it to → the data point.', { rows: [{ icon: 'flag' }, { icon: 'people' }, { icon: 'cash' }] }),
      S('kpis', 'Question 6 · Pivot trigger', 'The data point that would change our recommendation', 'One metric, a threshold and a date — and what you would do if it hits.', { kpis: [], spotlight: {} }),
      S('twocharts', 'Supporting evidence', 'What else the data shows', 'Optional. Two charts that back up your recommendation, with one-line captions.', { chart: 'won_source', chart2: 'arr_risk', captions: ['', ''] }),
    ],
  },
  detailed: {
    label: 'Board update — detailed (more text)',
    slides: [
      S('summary', 'Executive summary', 'Our recommendation in one sentence', 'Fills itself from your question slides; type in a tile to override.', { items: [{}, {}, {}, {}, {}, {}] }),
      S('cards', 'Key findings', 'What the data tells us', 'Four short cards: plan realism, biggest risk, where the $100K goes, what changes.', { cards: [{ tone: 'neutral' }, { tone: 'bad' }, { tone: 'good' }, { tone: 'neutral' }] }),
      S('scorecard', 'Business scorecard', 'Where the business stands today', 'Pre-filled from the CRM. Check every row and adjust the status colors.', { auto: 'scorecard', subtitle: '2026 actuals and forecast vs. targets' }),
      S('chart', 'Question 1 · Growth plan', 'Is the 2027 growth plan realistic?', 'The two or three numbers that prove your answer.', { chart: 'plan', stats: [{}, {}, {}] }),
      S('kpis', 'Question 2 · CEO dashboard', 'Three KPIs for the CEO dashboard', 'KPI, value, target, source.', { kpis: [{}, {}, {}], spotlight: {} }),
      S('chart', 'Question 3 · Biggest risk', 'Our biggest financial or operating risk', 'Size and timing of the risk.', { chart: 'cash', stats: [{}, {}] }),
      S('decisions', 'Question 4 · Investment', 'Where we would invest the next $100,000', 'Up to three allocations with “why now”.', { items: [{}, {}, {}] }),
      S('cards', 'Question 5 · Plan changes', 'What we would change in the current plan', 'Assumptions, hires, spend.', { cards: [{}, {}, {}] }),
      S('kpis', 'Question 6 · Pivot trigger', 'The data point that would change our recommendation', 'Metric, threshold, date, action.', { kpis: [], spotlight: {} }),
      S('narrative', 'Management reflection', 'What we see under the noise', 'Optional reflection and ask.', { paragraphs: ['', ''] }),
    ],
  },
  blank: { label: 'Blank (title slide only)', slides: [] },
};

function fillSlide(t, state) {
  const base = { id: slideId(), kind: 'content', verified: false, notes: '', takeaway: '', subtitle: '', ...JSON.parse(JSON.stringify(t)) };
  if (t.auto === 'scorecard') base.rows = autoScorecard(state);
  if (base.chart && !state.data.files[CHARTS.find((c) => c.id === base.chart)?.needs]) base.chart = '';
  ['cards', 'stats', 'kpis', 'items', 'rows', 'points'].forEach((k) => { if (base[k] && t.auto !== 'scorecard') base[k] = base[k].map((x) => ({ title: '', body: '', tone: 'neutral', label: '', value: '', delta: '', note: '', sub: '', why: '', amount: '', from: '', to: '', answer: '', ...x })); });
  if (base.chart2 && !state.data.files[CHARTS.find((c) => c.id === base.chart2)?.needs]) base.chart2 = '';
  return base;
}

export function newDeck(state, templateId = 'board') {
  const company = state.data.files.company?.rows[0]?.company_name || '';
  const t = TEMPLATES[templateId];
  return {
    title: company ? `${company}: 2027 Plan Review` : 'Management Presentation',
    subtitle: 'Management team recommendation to the board',
    company,
    audience: 'Board of Directors',
    confidential: true,
    health: '',
    sourceNote: state.data.asOf ? `Source: company CRM, finance and product data · as of ${state.data.asOf}` : 'Source: company CRM, finance and product data',
    presenters: '',
    date: new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }),
    template: templateId,
    slides: [
      { id: slideId(), kind: 'title' },
      ...t.slides.map((x) => fillSlide(x, state)),
      { id: slideId(), kind: 'evidence', title: 'Evidence appendix', eyebrow: 'Appendix' },
    ],
  };
}

// ---------------------------------------------------------------- AI prompt (structured JSON)
const LAYOUT_SPEC = `Allowed slide layouts (prefer the visual ones — this is a VISUAL deck):
- "summary": "items": 6 objects [{"value","answer","tone"}] in question order 1–6  (the executive summary: value = the key number ≤ 6 characters; answer = the one-line answer ≤ 12 words). The slide "title" is the overall recommendation.
- "bignumbers": "items": [{"icon","value","label","sub","tone"}]  (1–3 giant numbers; value ≤ 6 characters like "$888K" or "80%"; label ≤ 8 words; sub = comparison + source file ≤ 8 words)
- "hero": "chart": chart id, "stats": [{"value","label","tone"}]  (big chart + up to 3 numbers; label ≤ 8 words incl. source file)
- "allocation": "items": [{"amount","label","why"}]  (amounts like "$40K" that add up to the budget; label ≤ 5 words; why ≤ 10 words incl. source file)
- "compare": "rows": [{"icon","from","to","why"}]  (plan says → we would change to; ≤ 8 words each; why ≤ 10 words incl. source file)
- "twocharts": "chart", "chart2", "captions": ["≤ 12 words", "≤ 12 words"]
- "kpis": "kpis": [] or up to 4 tiles {"label","value","sub","tone"}, "spotlight": {"label","value","caption","text"}  (text ≤ 35 words)
- "cards", "scorecard", "decisions", "narrative", "bullets" also exist — use them only if a visual layout cannot work.
icon = up | down | cash | people | target | alert | chart | check | calendar | clock | flag | shield.  tone = good | bad | warn | neutral.
Every slide also has: "layout", "eyebrow" (2–4 word section label), "title" (the takeaway as a sentence, ≤ 12 words), "takeaway" (≤ 15 words, optional), "notes" (what the presenter says out loud — put explanations here, not on the slide).`;

export function buildAiPrompt(state, deck) {
  const ids = availableCharts(state).map((c) => `${c.id} (${c.label})`).join('; ');
  const plan = deck.slides.filter((s) => s.kind === 'content').map((s, i) => `${i + 1}. layout "${s.layout}" · eyebrow "${s.eyebrow || ''}" · ${s.title}${s.hint ? ` — ${s.hint}` : ''}${s.chart ? ` · chart "${s.chart}"` : ''}`).join('\n');
  const score = deck.slides.find((s) => s.layout === 'scorecard');
  return `You are helping a management team build a board presentation (about 3 minutes). Make it look like a professional board deck: every slide title states a conclusion ("The funnel is the problem, not the close"), not a topic ("Pipeline").

RULES
- VISUAL FIRST: no paragraphs on slides. At most about 40 words of visible text per slide. Lead with numbers and charts; put explanations in "notes".
- Use ONLY the numbers in the data brief below, or simple calculations from them (show the calculation in a note).
- Name the source file in every card body, stat note, KPI sub-line or bullet that contains a number, e.g. "(accounts.csv)".
- If files disagree or the data cannot answer something, say so on the slide instead of guessing.
- Answer every question with a clear position.

SLIDES TO WRITE (keep this order and these layouts unless a different layout is clearly better)
${plan}
${score ? `\nFor the scorecard slide, start from these computed rows (keep the numbers; you may reorder, drop rows, or change the status):\n${JSON.stringify(score.rows)}` : ''}

${LAYOUT_SPEC}
Chart ids you may use: ${ids}

OUTPUT: only a JSON object in a \`\`\`json code block, shaped like:
{"title": "...", "subtitle": "...", "health": "Green|Yellow|Red", "slides": [ { "layout": "cards", "eyebrow": "...", "title": "...", "subtitle": "...", "cards": [...], "takeaway": "...", "notes": "..." } ]}

${buildDataBrief(state)}`;
}

// ---------------------------------------------------------------- Parsing AI output
const str = (v) => (v === null || v === undefined ? '' : typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : JSON.stringify(v));

function normalizeSlide(raw, state) {
  const layouts = ['summary', 'bignumbers', 'hero', 'twocharts', 'allocation', 'compare', 'image', 'cards', 'scorecard', 'chart', 'kpis', 'decisions', 'narrative', 'bullets'];
  const layout = layouts.includes(raw.layout) ? raw.layout : 'bullets';
  const s = { id: slideId(), kind: 'content', layout, fromAi: true, verified: false,
    eyebrow: str(raw.eyebrow), title: str(raw.title), subtitle: str(raw.subtitle), takeaway: str(raw.takeaway), notes: str(raw.notes) };
  const chartOk = (id) => CHARTS.some((c) => c.id === id && state.data.files[c.needs]);
  if (raw.chart && chartOk(str(raw.chart))) s.chart = str(raw.chart);
  const arr = (a) => (Array.isArray(a) ? a : []);
  const pick = (o, keys) => Object.fromEntries(keys.map((k) => [k, str(o?.[k])]));
  const tone = (t) => (['good', 'bad', 'warn', 'neutral'].includes(t) ? t : 'neutral');
  if (layout === 'cards') s.cards = arr(raw.cards).slice(0, 6).map((c) => ({ ...pick(c, ['title', 'body']), tone: tone(c?.tone) }));
  if (layout === 'scorecard') s.rows = arr(raw.rows).slice(0, 14).map((r) => ({ ...pick(r, ['kpi', 'basis', 'value', 'compare', 'change']), rag: ['G', 'Y', 'R'].includes(str(r?.rag).toUpperCase()[0]) ? str(r.rag).toUpperCase()[0] : '' }));
  if (layout === 'chart') s.stats = arr(raw.stats).slice(0, 3).map((c) => ({ ...pick(c, ['label', 'value', 'delta', 'note']), tone: tone(c?.tone) }));
  if (layout === 'kpis') { s.kpis = arr(raw.kpis).slice(0, 4).map((c) => ({ ...pick(c, ['label', 'value', 'sub']), tone: tone(c?.tone) })); s.spotlight = pick(raw.spotlight || {}, ['label', 'value', 'caption', 'text']); }
  if (layout === 'decisions') s.items = arr(raw.items).slice(0, 3).map((c) => pick(c, ['title', 'body', 'why']));
  if (layout === 'narrative') { s.paragraphs = arr(raw.paragraphs).slice(0, 5).map(str); s.ask = str(raw.ask); }
  if (layout === 'bullets') s.bullets = arr(raw.bullets).slice(0, 7).map(str);
  const icon = (i) => (['up', 'down', 'cash', 'people', 'target', 'alert', 'chart', 'check', 'calendar', 'clock', 'flag', 'shield'].includes(i) ? i : 'chart');
  if (layout === 'bignumbers') s.items = arr(raw.items).slice(0, 3).map((c) => ({ ...pick(c, ['value', 'label', 'sub']), icon: icon(c?.icon), tone: tone(c?.tone) }));
  if (layout === 'hero') s.stats = arr(raw.stats).slice(0, 3).map((c) => ({ ...pick(c, ['value', 'label']), tone: tone(c?.tone) }));
  if (layout === 'twocharts') { if (raw.chart2 && chartOk(str(raw.chart2))) s.chart2 = str(raw.chart2); s.captions = arr(raw.captions).slice(0, 2).map(str); }
  if (layout === 'allocation') s.items = arr(raw.items).slice(0, 4).map((c) => pick(c, ['amount', 'label', 'why']));
  if (layout === 'compare') s.rows = arr(raw.rows).slice(0, 4).map((c) => ({ ...pick(c, ['from', 'to', 'why']), icon: icon(c?.icon || 'flag') }));
  if (layout === 'image') s.points = arr(raw.points).slice(0, 3).map((c) => pick(c, ['value', 'label']));
  if (layout === 'summary') s.items = arr(raw.items).slice(0, 6).map((c) => ({ ...pick(c, ['value', 'answer']), tone: tone(c?.tone) }));
  return s;
}

export function parseAiDeck(text, state) {
  const t = text.replace(/\r/g, '');
  const a = t.indexOf('{'), b = t.lastIndexOf('}');
  if (a >= 0 && b > a) {
    try {
      const j = JSON.parse(t.slice(a, b + 1));
      const slides = (Array.isArray(j.slides) ? j.slides : []).map((x) => normalizeSlide(x || {}, state));
      if (slides.length) return { title: str(j.title), subtitle: str(j.subtitle), health: ['Green', 'Yellow', 'Red'].find((h) => h.toLowerCase() === str(j.health).toLowerCase()) || '', slides };
    } catch { /* fall back to outline */ }
  }
  return parseOutline(t, state);
}

// Plain outline fallback: "# Deck title / ## Slide / - bullet / Chart: id / Notes: ..."
export function parseOutline(text, state) {
  const out = { title: '', subtitle: '', health: '', slides: [] };
  let cur = null;
  text.split('\n').forEach((raw) => {
    const line = raw.trim();
    if (!line || line.startsWith('```')) return;
    let m;
    if ((m = line.match(/^#\s+(.*)/)) && !line.startsWith('##')) { out.title = clean(m[1]); return; }
    if ((m = line.match(/^#{2,3}\s*(?:slide\s*\d+[:.)-]?\s*)?(.*)/i))) {
      cur = normalizeSlide({ layout: 'bullets', title: clean(m[1]), bullets: [] }, state);
      out.slides.push(cur);
      return;
    }
    if (!cur) return;
    if ((m = line.match(/^\**chart\**\s*:\s*`?([a-z_]+)`?/i))) { const id = m[1].toLowerCase(); if (CHARTS.some((c) => c.id === id && state.data.files[c.needs])) cur.chart = id; return; }
    if ((m = line.match(/^\**(?:speaker\s+)?notes\**\s*:\s*(.*)/i))) { cur.notes = clean(m[1]); return; }
    if ((m = line.match(/^\**takeaway\**\s*:\s*(.*)/i))) { cur.takeaway = clean(m[1]); return; }
    if ((m = line.match(/^(?:[-*•]|\d+[.)])\s+(.*)/))) { cur.bullets.push(clean(m[1])); return; }
    cur.bullets.push(clean(line));
  });
  return out;
}

function clean(s) {
  return s.replace(/\*\*(.+?)\*\*/g, '$1').replace(/__(.+?)__/g, '$1').replace(/`/g, '').trim();
}

// ---------------------------------------------------------------- Citations
function strings(v, out = []) {
  if (typeof v === 'string') out.push(v);
  else if (Array.isArray(v)) v.forEach((x) => strings(x, out));
  else if (v && typeof v === 'object') Object.entries(v).forEach(([k, x]) => { if (!['id', 'kind', 'layout', 'chart', 'tone', 'rag', 'hint', 'auto'].includes(k)) strings(x, out); });
  return out;
}

export function citations(deck, state) {
  const names = state.data.order.map((k) => state.data.files[k]).filter(Boolean).map((f) => ({ key: f.key, name: f.name.toLowerCase(), stem: f.name.toLowerCase().replace(/\.(csv|tsv|txt)$/, '') }));
  const found = [];
  deck.slides.forEach((s) => {
    if (s.kind === 'evidence') {
      (state.evidence || []).forEach((e) => found.push({ file: e.file, text: `${e.label}: ${e.value}` }));
      return;
    }
    if (s.kind !== 'content') return;
    // The scorecard is pre-filled by the app, so it does not count toward the team's own citations.
    if (s.layout === 'scorecard') return;
    const rows = strings(s);
    rows.forEach((t) => {
      const lt = t.toLowerCase();
      const hit = names.filter((n) => lt.includes(n.name) || lt.includes(n.stem));
      if (hit.length && /\d/.test(t)) hit.forEach((h) => found.push({ file: h.key, text: t }));
    });
  });
  return { points: new Set(found.map((f) => f.text)).size, files: new Set(found.map((f) => f.file)).size, found };
}

export { fileLabel };
