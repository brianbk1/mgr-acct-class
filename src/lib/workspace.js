import { parseCSV } from './csv.js';
import { profileColumns } from './analysis.js';

// Recognize well-known business files by their headers so the CRM workspace can
// build purpose-made views. Anything unrecognized still works as a generic table.
export const KINDS = {
  company: { label: 'Company summary', test: (c) => c.includes('company_name') && c.some((x) => /revenue_(goal|target)/.test(x)) },
  accounts: { label: 'Accounts', test: (c) => c.includes('account_id') && c.includes('contract_arr') },
  opportunities: { label: 'CRM opportunities', test: (c) => c.includes('opportunity_id') && c.includes('stage') },
  financials: { label: 'Monthly financials', test: (c) => c.includes('total_revenue') && c.includes('ending_cash') },
  usage: { label: 'Product usage', test: (c) => c.includes('account_id') && c.includes('sessions') },
  plan: { label: 'Plan scenarios', test: (c) => c.includes('scenario') && c.includes('projected_revenue') },
  employees: { label: 'Team & hiring plan', test: (c) => c.includes('employee_id') },
  campaigns: { label: 'Marketing campaigns', test: (c) => c.includes('campaign_id') && c.includes('channel') },
  activity: { label: 'Sales activity', test: (c) => c.includes('sales_rep') && c.includes('outbound_calls') },
  dictionary: { label: 'Data dictionary', test: (c) => c.includes('file_name') && c.includes('column_name') },
};

export function detectKind(columns) {
  const c = columns.map((x) => x.toLowerCase());
  for (const [kind, def] of Object.entries(KINDS)) if (def.test(c)) return kind;
  return 'generic';
}

function cleanName(name) {
  // Strip upload prefixes like "1d163cb6-" that some tools add.
  return name.replace(/^[0-9a-f]{8}-/i, '');
}

export function makeFile(name, text) {
  const { columns, rows } = parseCSV(text);
  const kind = detectKind(columns);
  const profile = profileColumns(columns, rows);
  const dateCol = profile.find((p) => p.type === 'date')?.name || '';
  const clean = cleanName(name);
  const key = kind === 'generic' ? clean.replace(/\.(csv|tsv|txt)$/i, '') : kind;
  return { key, name: clean, kind, columns, rows, dateCol };
}

export function addFiles(data, files) {
  const next = { ...data, files: { ...data.files }, order: [...(data.order || [])] };
  files.forEach((f) => {
    let key = f.key;
    if (next.files[key] && next.files[key].name !== f.name && f.kind === 'generic') {
      let i = 2;
      while (next.files[`${key}_${i}`]) i++;
      key = `${key}_${i}`;
    }
    next.files[key] = { ...f, key };
    if (!next.order.includes(key)) next.order.push(key);
  });
  return next;
}

export function fileLabel(f) {
  return f.kind === 'generic' ? f.name : `${KINDS[f.kind].label}`;
}

export const NORTHSTAR_FILES = [
  'company_summary.csv',
  'accounts.csv',
  'crm_opportunities.csv',
  'monthly_financials_2026.csv',
  'product_usage_monthly.csv',
  '2027_plan_scenarios.csv',
  'employees_and_hiring_plan.csv',
  'marketing_campaigns.csv',
  'sales_activity_weekly.csv',
  'data_dictionary.csv',
];

export async function loadNorthstar() {
  const files = await Promise.all(
    NORTHSTAR_FILES.map(async (n) => {
      const res = await fetch(`samples/northstar/${n}`);
      if (!res.ok) throw new Error(`Could not load ${n}`);
      return makeFile(n, await res.text());
    })
  );
  return files;
}
