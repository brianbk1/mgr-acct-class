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

export const DECK_FORMAT = `Format your answer exactly like this, with no other text:

# Deck title
## Slide title
- Bullet (cite the source file in parentheses, e.g. "(accounts.csv)")
- Bullet
Chart: one of [CHART_IDS] (optional, one per slide)
Notes: one or two sentences the presenter will say (optional)

Repeat "## Slide title" for each slide.`;

export function buildAiPrompt(state, deck) {
  const ids = availableCharts(state).map((c) => c.id).join(', ');
  const outline = deck.slides.filter((s) => s.kind !== 'title' && s.kind !== 'evidence').map((s, i) => `${i + 1}. ${s.title}`).join('\n');
  return `You are helping a management team prepare a short board presentation (6–8 slides, about 3 minutes).
Use ONLY the data in the brief below. Every number you use must appear in the brief or be a simple calculation from it — show the calculation if you do one. Cite the source file for every number. Where the data is ambiguous or files disagree, say so on the slide instead of guessing.

Questions the presentation must answer:
${outline}

${DECK_FORMAT.replace('[CHART_IDS]', ids)}

${buildDataBrief(state)}`;
}

// ---------------------------------------------------------------- Templates
export const TEMPLATES = {
  board: {
    label: 'Board update — 6 questions',
    slides: [
      { title: 'Is the 2027 growth plan realistic?', chart: 'plan', hint: 'Yes / no / partly — and the two or three numbers that prove it.' },
      { title: 'Three KPIs for the CEO dashboard', chart: '', hint: 'Name each KPI, its current value, the target, and why it belongs on the dashboard.' },
      { title: 'Biggest financial or operating risk', chart: 'cash', hint: 'One risk. Show the data, the size of the exposure, and the timing.' },
      { title: 'Where we would invest the next $100,000', chart: 'winrate_source', hint: 'Dollar split across product, sales, marketing, customer success or new market — and what you would not fund.' },
      { title: 'What we would change in the current plan', chart: '', hint: 'Assumptions to revise, hires to move, spend to cut or re-time.' },
      { title: 'The data point that would make us pivot', chart: '', hint: 'A specific metric, threshold and date. What you would do if it hits.' },
    ],
  },
  exec: {
    label: 'Executive summary',
    slides: [
      { title: 'Executive summary', chart: '', hint: 'The answer first, in three bullets.' },
      { title: 'Where we are today', chart: 'revenue', hint: 'Revenue, cash, customers.' },
      { title: 'What is working', chart: 'won_source', hint: 'Evidence of strength.' },
      { title: 'What is not working', chart: 'arr_risk', hint: 'Evidence of weakness.' },
      { title: 'Recommendation', chart: '', hint: 'What we should do and what it costs.' },
      { title: 'Risks and next steps', chart: '', hint: 'What could go wrong; owners and dates.' },
    ],
  },
  blank: { label: 'Blank (title slide only)', slides: [] },
};

export function newDeck(state, templateId = 'board') {
  const company = state.data.files.company?.rows[0]?.company_name;
  const t = TEMPLATES[templateId];
  return {
    title: company ? `${company}: 2027 plan review` : 'Management presentation',
    subtitle: 'Management team recommendation to the board',
    presenters: '',
    template: templateId,
    slides: [
      { id: slideId(), kind: 'title' },
      ...t.slides.map((s) => ({ id: slideId(), kind: 'content', title: s.title, hint: s.hint, bullets: [''], chart: state.data.files[CHARTS.find((c) => c.id === s.chart)?.needs] ? s.chart : '', notes: '', verified: false })),
      { id: slideId(), kind: 'evidence', title: 'Evidence appendix' },
    ],
  };
}

// Parse "# Title / ## Slide / - bullet / Chart: id / Notes: ..." into slides.
export function parseOutline(text, state) {
  const ids = new Set(CHARTS.map((c) => c.id));
  const out = { title: '', slides: [] };
  let cur = null;
  text.replace(/\r/g, '').split('\n').forEach((raw) => {
    const line = raw.trim();
    if (!line) return;
    let m;
    if ((m = line.match(/^#\s+(.*)/)) && !line.startsWith('##')) { out.title = clean(m[1]); return; }
    if ((m = line.match(/^#{2,3}\s*(?:slide\s*\d+[:.)-]?\s*)?(.*)/i))) {
      cur = { id: slideId(), kind: 'content', title: clean(m[1]), bullets: [], chart: '', notes: '', verified: false, fromAi: true };
      out.slides.push(cur);
      return;
    }
    if (!cur) return;
    if ((m = line.match(/^\**chart\**\s*:\s*`?([a-z_]+)`?/i))) { const id = m[1].toLowerCase(); if (ids.has(id) && state.data.files[CHARTS.find((c) => c.id === id).needs]) cur.chart = id; return; }
    if ((m = line.match(/^\**(?:speaker\s+)?notes\**\s*:\s*(.*)/i))) { cur.notes = clean(m[1]); return; }
    if ((m = line.match(/^(?:[-*•]|\d+[.)])\s+(.*)/))) { cur.bullets.push(clean(m[1])); return; }
    cur.bullets.push(clean(line));
  });
  out.slides.forEach((s) => { if (!s.bullets.length) s.bullets = ['']; });
  return out;
}

function clean(s) {
  return s.replace(/\*\*(.+?)\*\*/g, '$1').replace(/__(.+?)__/g, '$1').replace(/`/g, '').trim();
}

// ---------------------------------------------------------------- Citations
export function citations(deck, state) {
  const names = state.data.order.map((k) => state.data.files[k]).filter(Boolean).map((f) => ({ key: f.key, name: f.name.toLowerCase(), stem: f.name.toLowerCase().replace(/\.(csv|tsv|txt)$/, '') }));
  const found = [];
  deck.slides.forEach((s) => {
    if (s.kind === 'evidence') {
      (state.evidence || []).forEach((e) => found.push({ slide: s.id, file: e.file, text: `${e.label}: ${e.value}` }));
      return;
    }
    (s.bullets || []).forEach((b) => {
      const lb = b.toLowerCase();
      const hit = names.filter((n) => lb.includes(n.name) || lb.includes(n.stem));
      if (hit.length && /\d/.test(b)) hit.forEach((h) => found.push({ slide: s.id, file: h.key, text: b }));
    });
  });
  const points = new Set(found.map((f) => f.text)).size;
  const files = new Set(found.map((f) => f.file)).size;
  return { points, files, found };
}

export { fileLabel };
