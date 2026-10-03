// Example cases so first-time visitors can walk the full loop without their own data.
// Data is generated deterministically (seeded) so every visitor sees the same numbers.

function rng(seed) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const MONTHS = ['2025-10', '2025-11', '2025-12', '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09'];

function saasData() {
  const r = rng(42);
  const rows = [];
  const segments = [
    { region: 'Northeast', plan: 'Pro', base: 420, churn: 0.028, onboard: 78 },
    { region: 'Northeast', plan: 'Starter', base: 900, churn: 0.045, onboard: 61 },
    { region: 'South', plan: 'Pro', base: 310, churn: 0.033, onboard: 72 },
    { region: 'South', plan: 'Starter', base: 760, churn: 0.058, onboard: 52 },
    { region: 'West', plan: 'Pro', base: 380, churn: 0.025, onboard: 81 },
    { region: 'West', plan: 'Starter', base: 820, churn: 0.041, onboard: 64 },
  ];
  segments.forEach((seg) => {
    let active = seg.base;
    MONTHS.forEach((m, i) => {
      // Starter churn drifts up over the year; onboarding completion drifts down. That's the story.
      const drift = seg.plan === 'Starter' ? i * 0.0016 : i * 0.0003;
      const onboard = Math.round(seg.onboard - (seg.plan === 'Starter' ? i * 0.9 : i * 0.2) + (r() - 0.5) * 6);
      const churnRate = seg.churn + drift - (onboard - 60) * 0.0004 + (r() - 0.5) * 0.006;
      const churned = Math.max(0, Math.round(active * churnRate));
      const added = Math.round(active * (0.05 + (r() - 0.5) * 0.02));
      const price = seg.plan === 'Pro' ? 149 : 49;
      const tickets = Math.round(active * (seg.plan === 'Starter' ? 0.09 : 0.05) * (1 + (70 - onboard) / 100) + r() * 8);
      rows.push({
        month: m,
        region: seg.region,
        plan: seg.plan,
        customers_start: String(active),
        new_customers: String(added),
        churned_customers: String(churned),
        mrr: String(Math.round((active - churned + added) * price)),
        onboarding_completion_pct: String(onboard),
        support_tickets: String(tickets),
      });
      active = active - churned + added;
    });
  });
  return { columns: Object.keys(rows[0]), rows };
}

function schoolData() {
  const r = rng(7);
  const rows = [];
  const schools = [
    { school: 'Lincoln MS', tutoring: 'Yes', base: 61 },
    { school: 'Roosevelt MS', tutoring: 'Yes', base: 57 },
    { school: 'Jefferson MS', tutoring: 'No', base: 59 },
    { school: 'Adams MS', tutoring: 'No', base: 63 },
    { school: 'Madison MS', tutoring: 'Yes', base: 54 },
  ];
  const months = ['2025-09', '2025-10', '2025-11', '2025-12', '2026-01', '2026-02', '2026-03', '2026-04', '2026-05'];
  schools.forEach((s) => {
    months.forEach((m, i) => {
      const lift = s.tutoring === 'Yes' ? i * 1.1 : i * 0.35;
      const attendance = 88 + (r() - 0.5) * 6 - (s.tutoring === 'No' ? 1.5 : 0);
      const sessions = s.tutoring === 'Yes' ? Math.round(120 + i * 18 + r() * 30) : 0;
      const enrolled = 410 + Math.round(r() * 60);
      const proficient = Math.round(enrolled * (s.base + lift + (r() - 0.5) * 4) / 100);
      rows.push({
        month: m,
        school: s.school,
        tutoring_program: s.tutoring,
        students_assessed: String(enrolled),
        students_proficient: String(proficient),
        attendance_rate_pct: attendance.toFixed(1),
        tutoring_sessions: String(sessions),
        tutoring_cost_usd: String(sessions * 42),
      });
    });
  });
  return { columns: Object.keys(rows[0]), rows };
}

import { loadNorthstar } from './workspace.js';

export const SAMPLES = [
  {
    id: 'northstar',
    title: 'Northstar Learning Systems: the 2027 board case',
    blurb: 'Ten linked files — accounts, pipeline, campaigns, usage, financials, hiring and the 2027 plan. Explore it like a CRM, then build a board recommendation.',
    featured: true,
    build: async () => ({
      question: {
        decision: 'Should we commit to the 2027 management plan ($1.2M revenue), and where should we invest the next $100,000?',
        context: 'Northstar is a B2B SaaS company selling workforce training and simulation software, targeting about $820K revenue in 2026. Management wants to reach $1.2M in 2027 while protecting cash and deciding whether to expand into healthcare. The board wants a 1-page / 3-minute update.',
        owner: 'Management team (CEO: Maya Brooks)',
        deadline: '',
        options: ['', ''],
        stakes: '',
        changeMind: '',
        initialLean: '',
      },
      files: await loadNorthstar(),
      source: 'Northstar case pack (synthetic, classroom use): CRM, billing, product analytics, finance and HR exports',
      asOf: '2026-09-30',
      kpis: [],
    }),
  },
  {
    id: 'saas',
    title: 'SaaS: price increase or onboarding investment?',
    blurb: 'A subscription business sees revenue flatten. Leadership is split between raising Starter prices and investing in onboarding.',
    build: async () => {
      const d = saasData();
      return {
        question: {
          decision: 'Should we raise Starter plan pricing by 15% in Q1, or invest the same budget in a guided onboarding program?',
          context: 'MRR growth has slowed for two quarters. Finance wants a price increase; Customer Success believes churn from poor onboarding is the real leak.',
          owner: 'VP Revenue',
          deadline: '2026-11-15',
          options: ['Raise Starter price 15% in January', 'Fund a guided onboarding program for Starter customers', 'Do both, staged: onboarding now, pricing in Q2'],
          stakes: 'About $180K annual budget and the credibility of the Q1 plan. Price changes are hard to walk back with existing customers.',
          changeMind: 'If Starter churn is flat and unrelated to onboarding completion, the onboarding case weakens and pricing becomes more attractive.',
        },
        files: [{ key: 'subscription_metrics', name: 'subscription_metrics_by_segment.csv', kind: 'generic', columns: d.columns, rows: d.rows, dateCol: 'month' }],
        source: 'Billing system export + onboarding tool, monthly, by region and plan',
        asOf: '2026-09-30',
        kpis: [
          { id: 'k1', file: 'subscription_metrics', name: 'Customer churn rate', column: 'churned_customers', agg: 'ratio', denominator: 'customers_start', asPercent: true, direction: 'down', target: '3.5', type: 'lagging', why: 'The leak we are trying to plug. Ties directly to MRR.', unit: '' },
          { id: 'k2', file: 'subscription_metrics', name: 'Onboarding completion', column: 'onboarding_completion_pct', agg: 'avg', direction: 'up', target: '75', type: 'leading', why: 'Shows up weeks before churn does. If it moves, churn should follow.', unit: '' },
          { id: 'k3', file: 'subscription_metrics', name: 'Monthly recurring revenue', column: 'mrr', agg: 'sum', direction: 'up', target: '', type: 'lagging', why: 'The outcome the board watches.', unit: '$' },
        ],
      };
    },
  },
  {
    id: 'school',
    title: 'District: expand the tutoring pilot?',
    blurb: 'A district piloted high-dosage tutoring at three middle schools. The board wants to know whether to fund it district-wide next year.',
    build: async () => {
      const d = schoolData();
      return {
        question: {
          decision: 'Should we expand the middle-school tutoring pilot to all five schools for the 2026–27 school year?',
          context: 'Three schools ran the pilot this year. The board meets in November to set the budget, and two principals want in.',
          owner: 'Chief Academic Officer',
          deadline: '2026-11-10',
          options: ['Expand to all five schools', 'Continue the pilot at three schools for another year', 'Expand to one more school as a controlled comparison'],
          stakes: 'Roughly $250K a year and staff time. Pulling a program after families rely on it is costly.',
          changeMind: 'If pilot schools were already improving faster before tutoring started, or the gap is within normal variation, expansion is premature.',
        },
        files: [{ key: 'tutoring_pilot', name: 'middle_school_tutoring_pilot.csv', kind: 'generic', columns: d.columns, rows: d.rows, dateCol: 'month' }],
        source: 'Interim assessment results + tutoring vendor session logs, monthly by school',
        asOf: '2026-05-31',
        kpis: [
          { id: 'k1', file: 'tutoring_pilot', name: 'Math proficiency rate', column: 'students_proficient', agg: 'ratio', denominator: 'students_assessed', asPercent: true, direction: 'up', target: '65', type: 'lagging', why: 'The board-level outcome the program exists to move.', unit: '' },
          { id: 'k2', file: 'tutoring_pilot', name: 'Tutoring sessions delivered', column: 'tutoring_sessions', agg: 'sum', direction: 'up', target: '', type: 'leading', why: 'Dosage. No sessions, no effect — tells us early if implementation is slipping.', unit: '' },
          { id: 'k3', file: 'tutoring_pilot', name: 'Attendance rate', column: 'attendance_rate_pct', agg: 'avg', direction: 'up', target: '90', type: 'leading', why: 'Students have to be present to benefit; also a possible alternative explanation.', unit: '' },
        ],
      };
    },
  },
];
