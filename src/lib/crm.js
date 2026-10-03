// CRM-style summaries for recognized file types. Pure functions over row arrays.
import { toNumber as n } from './analysis.js';

const sum = (arr, f) => arr.reduce((a, r) => a + (Number.isFinite(f(r)) ? f(r) : 0), 0);
const avg = (arr, f) => {
  const v = arr.map(f).filter(Number.isFinite);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : NaN;
};
const by = (arr, key) => arr.reduce((m, r) => { const k = typeof key === 'function' ? key(r) : r[key]; (m[k] ||= []).push(r); return m; }, {});
const day = (s) => { const t = Date.parse(s); return Number.isNaN(t) ? null : t; };
const DAY = 86400000;

export const money = (v, digits = 0) => {
  if (!Number.isFinite(v)) return '—';
  const sign = v < 0 ? '-' : '';
  const a = Math.abs(v);
  if (a >= 1e6) return `${sign}$${(a / 1e6).toFixed(2)}M`;
  if (a >= 1e4) return `${sign}$${(a / 1e3).toFixed(1)}K`;
  return `${sign}$${a.toLocaleString(undefined, { maximumFractionDigits: digits })}`;
};
export const pct = (v, digits = 1) => (Number.isFinite(v) ? `${(v * 100).toFixed(digits)}%` : '—');
export const num = (v, digits = 0) => (Number.isFinite(v) ? v.toLocaleString(undefined, { maximumFractionDigits: digits }) : '—');

export function asOfDate(state) {
  if (state.data.asOf && day(state.data.asOf)) return day(state.data.asOf);
  return Date.now();
}

// ---------- Accounts ----------
export function enrichAccounts(rows) {
  return rows.map((r) => {
    const arr = n(r.contract_arr);
    const contrib = n(r.est_annual_contribution);
    return {
      ...r,
      _arr: arr,
      _health: n(r.health_score),
      _adoption: n(r.adoption_rate),
      _nps: n(r.nps),
      _tickets: n(r.support_tickets_90d),
      _cs: n(r.cs_hours_90d),
      _margin: arr ? contrib / arr : NaN,
      _contrib: contrib,
      _discount: n(r.discount_pct),
      _pay: n(r.avg_payment_days),
      _renew: day(r.renewal_date),
    };
  });
}

export function accountsSummary(rows, asOf) {
  const a = enrichAccounts(rows);
  const risky = a.filter((r) => /high|medium/i.test(r.churn_risk || ''));
  const in90 = a.filter((r) => r._renew !== null && r._renew >= asOf && r._renew <= asOf + 90 * DAY);
  const passed = a.filter((r) => r._renew !== null && r._renew < asOf);
  const lowMargin = a.filter((r) => Number.isFinite(r._margin) && r._margin < 0.4);
  const totalArr = sum(a, (r) => r._arr);
  const top10 = [...a].sort((x, y) => y._arr - x._arr).slice(0, Math.max(1, Math.round(a.length * 0.1)));
  return {
    count: a.length,
    totalArr,
    avgHealth: avg(a, (r) => r._health),
    avgAdoption: avg(a, (r) => r._adoption),
    avgNps: avg(a, (r) => r._nps),
    riskyArr: sum(risky, (r) => r._arr),
    riskyCount: risky.length,
    highRisk: a.filter((r) => /high/i.test(r.churn_risk || '')),
    in90,
    in90Arr: sum(in90, (r) => r._arr),
    passed,
    lowMargin,
    lowMarginArr: sum(lowMargin, (r) => r._arr),
    avgDiscount: avg(a, (r) => r._discount),
    totalContribution: sum(a, (r) => r._contrib),
    top10Share: totalArr ? sum(top10, (r) => r._arr) / totalArr : NaN,
    slowPayers: a.filter((r) => r._pay > 60),
    bySegment: groupTable(a, 'segment'),
    byIndustry: groupTable(a, 'industry'),
    byOwner: groupTable(a, 'account_owner'),
  };
}

function groupTable(a, key) {
  return Object.entries(by(a, key)).map(([k, rs]) => ({
    key: k || '(blank)',
    count: rs.length,
    arr: sum(rs, (r) => r._arr),
    health: avg(rs, (r) => r._health),
    adoption: avg(rs, (r) => r._adoption),
    margin: sum(rs, (r) => r._contrib) / (sum(rs, (r) => r._arr) || NaN),
    tickets: sum(rs, (r) => r._tickets),
    cs: sum(rs, (r) => r._cs),
    risky: rs.filter((r) => /high|medium/i.test(r.churn_risk || '')).length,
  })).sort((x, y) => y.arr - x.arr);
}

// ---------- Opportunities ----------
const isWon = (r) => /won/i.test(r.status || r.stage || '');
const isLost = (r) => /lost/i.test(r.status || r.stage || '');
const isOpen = (r) => !isWon(r) && !isLost(r);

export const OPEN_STAGES = ['Discovery', 'Demo', 'Proposal', 'Negotiation'];

export function pipelineSummary(rows) {
  const o = rows.map((r) => ({ ...r, _amt: n(r.amount), _w: n(r.weighted_pipeline), _days: n(r.days_in_stage), _disc: n(r.discount_pct) }));
  const won = o.filter(isWon), lost = o.filter(isLost), open = o.filter(isOpen);
  const rate = (w, l) => (w + l ? w / (w + l) : NaN);
  const group = (key) => Object.entries(by(o, key)).map(([k, rs]) => {
    const w = rs.filter(isWon), l = rs.filter(isLost), op = rs.filter(isOpen);
    return {
      key: k || '(blank)',
      count: rs.length,
      won: w.length,
      lost: l.length,
      open: op.length,
      winRate: rate(w.length, l.length),
      wonAmt: sum(w, (r) => r._amt),
      avgWon: w.length ? sum(w, (r) => r._amt) / w.length : NaN,
      openAmt: sum(op, (r) => r._amt),
      weighted: sum(op, (r) => r._w),
      avgDisc: avg(w, (r) => r._disc),
    };
  }).sort((x, y) => y.wonAmt - x.wonAmt);

  const stages = [...new Set([...OPEN_STAGES, ...open.map((r) => r.stage)])].filter((s) => open.some((r) => r.stage === s));
  return {
    total: o.length,
    won, lost, open,
    wonAmt: sum(won, (r) => r._amt),
    openAmt: sum(open, (r) => r._amt),
    weighted: sum(open, (r) => r._w),
    winRate: rate(won.length, lost.length),
    avgWon: won.length ? sum(won, (r) => r._amt) / won.length : NaN,
    avgDiscWon: avg(won, (r) => r._disc),
    staleOpen: open.filter((r) => r._days > 30),
    stages: stages.map((s) => ({ stage: s, rows: open.filter((r) => r.stage === s).sort((a, b) => b._amt - a._amt) })),
    bySource: group('source'),
    byRep: group('sales_rep'),
    byProduct: group('product'),
    byType: group('opportunity_type'),
    lostReasons: Object.entries(by(lost, (r) => r.lost_reason || '(none given)'))
      .map(([k, rs]) => ({ key: k, count: rs.length, amt: sum(rs, (r) => r._amt) }))
      .sort((a, b) => b.count - a.count),
  };
}

// ---------- Marketing ----------
export function campaignsByChannel(rows) {
  return Object.entries(by(rows, 'channel')).map(([k, rs]) => {
    const spend = sum(rs, (r) => n(r.spend));
    const opps = sum(rs, (r) => n(r.opportunities));
    const wins = sum(rs, (r) => n(r.wins));
    const bookings = sum(rs, (r) => n(r.bookings));
    const leads = sum(rs, (r) => n(r.leads));
    const mqls = sum(rs, (r) => n(r.mqls));
    return {
      key: k, campaigns: rs.length, spend, leads, mqls, opps, wins, bookings,
      costPerOpp: opps ? spend / opps : NaN,
      cac: wins ? spend / wins : NaN,
      bookingRoi: spend ? bookings / spend : NaN,
      oppToWin: opps ? wins / opps : NaN,
      leadToMql: leads ? mqls / leads : NaN,
      cycle: avg(rs, (r) => n(r.avg_sales_cycle_days)),
    };
  }).sort((a, b) => b.bookingRoi - a.bookingRoi);
}

// ---------- Sales activity ----------
export function activityByRep(rows, opps) {
  const weeks = new Set(rows.map((r) => r.week_start)).size || 1;
  const p = opps ? pipelineSummary(opps) : null;
  return Object.entries(by(rows, 'sales_rep')).map(([rep, rs]) => {
    const calls = sum(rs, (r) => n(r.outbound_calls));
    const emails = sum(rs, (r) => n(r.emails_sent));
    const meetings = sum(rs, (r) => n(r.meetings_held));
    const demos = sum(rs, (r) => n(r.demos_completed));
    const proposals = sum(rs, (r) => n(r.proposals_sent));
    const pr = p?.byRep.find((x) => x.key === rep);
    return {
      key: rep, weeks: rs.length, calls, emails, meetings, demos, proposals,
      perWeek: { calls: calls / rs.length, meetings: meetings / rs.length, demos: demos / rs.length, proposals: proposals / rs.length },
      demoToProposal: demos ? proposals / demos : NaN,
      won: pr?.won ?? NaN, wonAmt: pr?.wonAmt ?? NaN, winRate: pr?.winRate ?? NaN, openAmt: pr?.openAmt ?? NaN,
    };
  }).sort((a, b) => (b.wonAmt || 0) - (a.wonAmt || 0)).map((r) => ({ ...r, totalWeeks: weeks }));
}

export function activityByWeek(rows) {
  return Object.entries(by(rows, 'week_start')).sort(([a], [b]) => (a < b ? -1 : 1)).map(([w, rs]) => ({
    label: w.slice(5), demos: sum(rs, (r) => n(r.demos_completed)), proposals: sum(rs, (r) => n(r.proposals_sent)), meetings: sum(rs, (r) => n(r.meetings_held)),
  }));
}

// ---------- Product usage ----------
export function usageByMonth(rows) {
  return Object.entries(by(rows, 'month')).sort(([a], [b]) => (a < b ? -1 : 1)).map(([m, rs]) => {
    const lic = sum(rs, (r) => n(r.licensed_users));
    const act = sum(rs, (r) => n(r.active_users));
    return {
      label: m.slice(0, 7), licensed: lic, active: act, adoption: lic ? act / lic : NaN,
      sessions: sum(rs, (r) => n(r.sessions)),
      aiCoach: sum(rs, (r) => n(r.ai_coach_users)),
      analytics: sum(rs, (r) => n(r.analytics_pro_users)),
      ttv: avg(rs, (r) => n(r.avg_time_to_value_days)),
      tickets: sum(rs, (r) => n(r.support_tickets)),
      accounts: rs.length,
    };
  });
}

export function usageByAccount(rows) {
  return Object.entries(by(rows, 'account_id')).map(([id, rs]) => {
    const sorted = [...rs].sort((a, b) => (a.month < b.month ? -1 : 1));
    const first = sorted[0], last = sorted[sorted.length - 1];
    return {
      id, name: last.account_name,
      series: sorted.map((r) => ({ label: r.month.slice(0, 7), value: n(r.adoption_rate) })),
      firstAdoption: n(first.adoption_rate), lastAdoption: n(last.adoption_rate),
      change: n(last.adoption_rate) - n(first.adoption_rate),
      tickets: sum(rs, (r) => n(r.support_tickets)),
      ttv: avg(rs, (r) => n(r.avg_time_to_value_days)),
      aiCoach: n(last.ai_coach_users), analytics: n(last.analytics_pro_users), licensed: n(last.licensed_users),
    };
  });
}

// ---------- Financials ----------
export function financialSummary(rows, company) {
  const f = rows.map((r) => ({ ...r, _rev: n(r.total_revenue), _cash: n(r.ending_cash), _ebitda: n(r.ebitda), _gm: n(r.gross_margin_pct), _chg: n(r.monthly_cash_change), _actual: /actual/i.test(r.actual_or_forecast || 'actual') }));
  const act = f.filter((r) => r._actual);
  const last = act[act.length - 1] || f[f.length - 1];
  const reserve = company ? n(company.minimum_cash_reserve_target) : NaN;
  const target = company ? n(company['2026_revenue_target']) : NaN;
  const fy = sum(f, (r) => r._rev);
  const burn = avg(act, (r) => r._chg);
  const breach = f.find((r) => Number.isFinite(reserve) && r._cash < reserve);
  const negative = f.find((r) => r._cash < 0);
  return {
    rows: f, actualMonths: act.length,
    ytdRevenue: sum(act, (r) => r._rev),
    fyRevenue: fy, target, vsTarget: Number.isFinite(target) ? fy - target : NaN,
    exitRunRate: f.length ? f[f.length - 1]._rev * 12 : NaN,
    lastActual: last,
    cash: last?._cash, reserve,
    avgBurn: burn,
    ytdEbitda: sum(act, (r) => r._ebitda),
    avgGm: avg(act, (r) => r._gm),
    breach, negative,
    yearEndCash: f[f.length - 1]?._cash,
    marketingSpend: sum(f, (r) => n(r.marketing_expense)),
    payroll: sum(f, (r) => n(r.payroll_and_benefits)),
    collectionRate: sum(act, (r) => n(r.cash_collected)) / (sum(act, (r) => r._rev) || NaN),
  };
}

// ---------- Team ----------
export function teamSummary(rows) {
  const e = rows.map((r) => {
    const base = n(r.base_salary);
    const loaded = base * (1 + (n(r.benefits_burden_pct) || 0)) * (1 + (n(r.variable_comp_target_pct) || 0));
    return { ...r, _base: base, _loaded: loaded, _planned: /plan/i.test(r.status || '') };
  });
  const active = e.filter((r) => !r._planned), planned = e.filter((r) => r._planned);
  return {
    rows: e, active, planned,
    activeCost: sum(active, (r) => r._loaded),
    plannedCost: sum(planned, (r) => r._loaded),
    byDept: Object.entries(by(e, 'department')).map(([k, rs]) => ({
      key: k, active: rs.filter((r) => !r._planned).length, planned: rs.filter((r) => r._planned).length, cost: sum(rs, (r) => r._loaded),
    })).sort((a, b) => b.cost - a.cost),
  };
}

// ---------- Plan pressure test ----------
export function planPressureTest(state) {
  const F = state.data.files;
  const company = F.company?.rows[0];
  const fin = F.financials ? financialSummary(F.financials.rows, company) : null;
  const pipe = F.opportunities ? pipelineSummary(F.opportunities.rows) : null;
  const renewals = pipe?.byType.find((t) => /renew/i.test(t.key));
  const team = F.employees ? teamSummary(F.employees.rows) : null;
  const scenarios = F.plan?.rows || [];
  const evidence = {
    revenue2026: fin?.fyRevenue,
    renewalWinRate: renewals?.winRate,
    grossMargin: fin?.avgGm,
    marketing2026: fin?.marketingSpend,
    payroll2026: fin?.payroll,
    yearEndCash: fin?.yearEndCash,
    headcount: team?.active.length,
  };
  const checks = scenarios.map((s) => {
    const growth = n(s.revenue_growth_pct);
    const impliedRev = Number.isFinite(evidence.revenue2026) ? evidence.revenue2026 * (1 + growth) : NaN;
    return {
      scenario: s.scenario,
      rows: [
        { label: 'Revenue', plan: money(n(s.projected_revenue)), actual: money(evidence.revenue2026), note: `Requires ${pct(growth, 0)} growth${Number.isFinite(impliedRev) ? ` (≈${money(impliedRev)} on 2026 base)` : ''}` },
        { label: 'Renewal rate', plan: pct(n(s.renewal_rate), 0), actual: pct(evidence.renewalWinRate, 0), note: '2026 evidence = renewal opportunities won ÷ (won + lost) in the CRM', gap: n(s.renewal_rate) - (evidence.renewalWinRate ?? NaN) },
        { label: 'Gross margin', plan: pct(n(s.gross_margin_pct), 0), actual: pct(evidence.grossMargin, 1), note: '2026 actual months, average', gap: n(s.gross_margin_pct) - (evidence.grossMargin ?? NaN) },
        { label: 'Marketing budget', plan: money(n(s.marketing_budget)), actual: money(evidence.marketing2026), note: '2026 total incl. forecast months' },
        { label: 'New hires', plan: num(n(s.planned_new_hires)), actual: `${num(evidence.headcount)} today`, note: 'Active headcount in the team file' },
        { label: 'EBITDA', plan: money(n(s.projected_ebitda)), actual: '', note: Number.isFinite(evidence.yearEndCash) ? `2026 year-end cash forecast: ${money(evidence.yearEndCash)}` : '' },
      ],
    };
  });
  return { evidence, checks, scenarios };
}
