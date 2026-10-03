import { useMemo, useState } from 'react';
import { KINDS, fileLabel } from '../lib/workspace.js';
import {
  accountsSummary, enrichAccounts, pipelineSummary, campaignsByChannel, activityByRep, activityByWeek,
  usageByMonth, usageByAccount, financialSummary, teamSummary, planPressureTest, asOfDate, money, pct, num,
} from '../lib/crm.js';
import { toNumber } from '../lib/analysis.js';
import { LineChart, BarChart, Sparkline } from './Charts.jsx';
import { Stat, DataTable, Badge, riskTone, Section, HBar, PinCell } from './WorkspaceKit.jsx';

const TAB_DEFS = [
  { id: 'overview', label: 'Overview', needs: [] },
  { id: 'accounts', label: 'Accounts', needs: ['accounts'] },
  { id: 'pipeline', label: 'Pipeline', needs: ['opportunities'] },
  { id: 'marketing', label: 'Marketing', needs: ['campaigns'] },
  { id: 'activity', label: 'Sales Activity', needs: ['activity'] },
  { id: 'usage', label: 'Product Usage', needs: ['usage'] },
  { id: 'financials', label: 'Financials', needs: ['financials'] },
  { id: 'team', label: 'Team & Hiring', needs: ['employees'] },
  { id: 'plan', label: '2027 Plan', needs: ['plan'] },
  { id: 'files', label: 'All Files', needs: [] },
];

export default function Workspace({ state, onGoToLoop }) {
  const F = state.data.files;
  const tabs = TAB_DEFS.filter((t) => t.needs.every((k) => F[k]));
  const [tab, setTab] = useState('overview');
  const active = tabs.find((t) => t.id === tab) ? tab : 'overview';

  if (!Object.keys(F).length) {
    return (
      <div className="ws-empty">
        <h2>No data in the workspace yet</h2>
        <p>Load your CSV files (or the Northstar example case) in the <strong>Data</strong> step. Recognized files — accounts, opportunities, campaigns, usage, financials, team and plan — get their own CRM views here.</p>
        <button className="btn primary" onClick={() => onGoToLoop('data')}>Go to the Data step</button>
      </div>
    );
  }

  return (
    <div className="workspace">
      <nav className="ws-tabs" role="tablist">
        {tabs.map((t) => (
          <button key={t.id} role="tab" aria-selected={active === t.id} className={active === t.id ? 'on' : ''} onClick={() => setTab(t.id)}>{t.label}</button>
        ))}
      </nav>
      <div className="ws-hint">
        <strong>Pin what matters.</strong> Click the pin on any number to save it as evidence. Pinned numbers can be inserted into your slides and are listed in the deck’s evidence appendix.
      </div>
      {active === 'overview' && <Overview state={state} setTab={setTab} />}
      {active === 'accounts' && <Accounts state={state} />}
      {active === 'pipeline' && <Pipeline state={state} />}
      {active === 'marketing' && <Marketing state={state} />}
      {active === 'activity' && <Activity state={state} />}
      {active === 'usage' && <Usage state={state} />}
      {active === 'financials' && <Financials state={state} />}
      {active === 'team' && <Team state={state} />}
      {active === 'plan' && <Plan state={state} />}
      {active === 'files' && <Files state={state} />}
    </div>
  );
}

// ------------------------------------------------------------------ Overview
function Overview({ state, setTab }) {
  const F = state.data.files;
  const company = F.company?.rows[0];
  const asOf = asOfDate(state);
  const acc = F.accounts ? accountsSummary(F.accounts.rows, asOf) : null;
  const pipe = F.opportunities ? pipelineSummary(F.opportunities.rows) : null;
  const fin = F.financials ? financialSummary(F.financials.rows, company) : null;
  const usage = F.usage ? usageByMonth(F.usage.rows) : null;
  const goal = company ? toNumber(company['2027_revenue_goal']) : NaN;
  const lastUse = usage?.[usage.length - 1];
  const firstUse = usage?.[0];

  return (
    <>
      {company && (
        <div className="company-card">
          <div>
            <span className="eyebrow">{company.business_model}</span>
            <h2>{company.company_name}</h2>
            <p className="muted">
              Core market: {company.current_market} · Testing: {company.adjacent_market_under_test} · Products: {[company.core_product, company.add_on_1, company.add_on_2].filter(Boolean).join(', ')}
            </p>
          </div>
          {company.board_question && <blockquote>“{company.board_question}”<cite>The board’s question</cite></blockquote>}
        </div>
      )}

      <div className="stats">
        {fin && <Stat label="2026 revenue (actual + forecast)" value={money(fin.fyRevenue)} sub={Number.isFinite(fin.target) ? `${fin.vsTarget >= 0 ? '+' : ''}${money(fin.vsTarget)} vs ${money(fin.target)} target` : `${fin.actualMonths} actual months`} tone={fin.vsTarget < 0 ? 'warn' : ''} file="financials" fileName={F.financials.name} />}
        {fin && Number.isFinite(goal) && <Stat label="Growth needed for 2027 goal" value={pct(goal / fin.fyRevenue - 1, 0)} sub={`${money(goal)} goal vs ${money(fin.fyRevenue)} in 2026`} file="company" fileName={F.company.name} />}
        {fin && <Stat label={`Ending cash (${fin.lastActual?.month?.slice(0, 7) || 'latest'})`} value={money(fin.cash)} sub={Number.isFinite(fin.reserve) ? `Reserve target ${money(fin.reserve)}` : ''} tone={fin.cash < (fin.reserve || 0) ? 'bad' : ''} file="financials" fileName={F.financials.name} />}
        {fin && <Stat label="Avg monthly cash change (actuals)" value={money(fin.avgBurn)} tone={fin.avgBurn < 0 ? 'bad' : 'good'} file="financials" fileName={F.financials.name} />}
        {acc && <Stat label="Contracted ARR" value={money(acc.totalArr)} sub={`${acc.count} accounts`} file="accounts" fileName={F.accounts.name} />}
        {acc && <Stat label="ARR at medium/high churn risk" value={money(acc.riskyArr)} sub={`${acc.riskyCount} accounts · ${pct(acc.riskyArr / acc.totalArr, 0)} of ARR`} tone="warn" file="accounts" fileName={F.accounts.name} />}
        {pipe && <Stat label="Win rate (closed opportunities)" value={pct(pipe.winRate, 0)} sub={`${pipe.won.length} won · ${pipe.lost.length} lost`} file="opportunities" fileName={F.opportunities.name} />}
        {pipe && <Stat label="Open pipeline (weighted)" value={money(pipe.weighted)} sub={`${money(pipe.openAmt)} unweighted · ${pipe.open.length} deals`} file="opportunities" fileName={F.opportunities.name} />}
        {lastUse && <Stat label={`Product adoption (${lastUse.label})`} value={pct(lastUse.adoption, 1)} sub={`was ${pct(firstUse.adoption, 1)} in ${firstUse.label}`} file="usage" fileName={F.usage.name} />}
      </div>

      {fin && (
        <Section title="Cash runway" hint="Ending cash by month. Forecast months shown as hollow points.">
          <LineChart
            series={fin.rows.map((r) => ({ label: r.month.slice(0, 7), value: r._cash, forecast: !r._actual }))}
            kpi={{ unit: '$' }} target={Number.isFinite(fin.reserve) ? fin.reserve : ''} targetLabel="reserve" zero
          />
        </Section>
      )}

      <div className="two-col">
        {acc && (
          <Section title="Accounts needing attention" actions={<button className="link" onClick={() => setTab('accounts')}>All accounts →</button>}>
            <ul className="watchlist">
              {[...acc.highRisk, ...acc.in90.filter((r) => !acc.highRisk.includes(r))].slice(0, 6).map((r) => (
                <li key={r.account_id}>
                  <div><strong>{r.account_name}</strong> <Badge tone={riskTone(r.churn_risk)}>{r.churn_risk} risk</Badge></div>
                  <span className="muted">{money(r._arr)} ARR · health {num(r._health)} · renews {r.renewal_date}</span>
                </li>
              ))}
              {!acc.highRisk.length && !acc.in90.length && <li className="muted">No high-risk accounts or near-term renewals.</li>}
            </ul>
          </Section>
        )}
        {pipe && (
          <Section title="Where wins come from" actions={<button className="link" onClick={() => setTab('pipeline')}>Pipeline →</button>}>
            <BarChart data={pipe.bySource.map((s) => ({ label: s.key, value: s.wonAmt, n: s.count }))} kpi={{ unit: '$' }} />
          </Section>
        )}
      </div>

      <Section title="Files in this workspace">
        <div className="file-chips">
          {state.data.order.map((k) => F[k]).filter(Boolean).map((f) => (
            <span key={f.key} className="chip"><strong>{fileLabel(f)}</strong> {f.name} · {f.rows.length} rows</span>
          ))}
        </div>
      </Section>
    </>
  );
}

// ------------------------------------------------------------------ Accounts
function Accounts({ state }) {
  const F = state.data.files;
  const asOf = asOfDate(state);
  const s = useMemo(() => accountsSummary(F.accounts.rows, asOf), [F.accounts, asOf]);
  const rows = useMemo(() => enrichAccounts(F.accounts.rows), [F.accounts]);
  const usageMap = useMemo(() => (F.usage ? Object.fromEntries(usageByAccount(F.usage.rows).map((u) => [u.id, u])) : {}), [F.usage]);
  const [selected, setSelected] = useState(null);
  const [filter, setFilter] = useState({ segment: '', risk: '', owner: '' });
  const fn = F.accounts.name;

  const shown = rows.filter((r) =>
    (!filter.segment || r.segment === filter.segment) &&
    (!filter.risk || r.churn_risk === filter.risk) &&
    (!filter.owner || r.account_owner === filter.owner));
  const opts = (k) => [...new Set(rows.map((r) => r[k]).filter(Boolean))].sort();

  return (
    <>
      <div className="stats">
        <Stat label="Contracted ARR" value={money(s.totalArr)} sub={`${s.count} accounts`} file="accounts" fileName={fn} />
        <Stat label="Average health score" value={num(s.avgHealth, 1)} sub={`Avg NPS ${num(s.avgNps, 0)}`} file="accounts" fileName={fn} />
        <Stat label="Average adoption" value={pct(s.avgAdoption)} file="accounts" fileName={fn} />
        <Stat label="ARR at medium/high churn risk" value={money(s.riskyArr)} sub={`${s.riskyCount} accounts`} tone="warn" file="accounts" fileName={fn} />
        <Stat label="Renewing in next 90 days" value={money(s.in90Arr)} sub={`${s.in90.length} accounts`} file="accounts" fileName={fn} />
        <Stat label="Accounts under 40% contribution margin" value={num(s.lowMargin.length)} sub={`${money(s.lowMarginArr)} ARR`} tone={s.lowMargin.length ? 'warn' : ''} file="accounts" fileName={fn} />
        <Stat label="Top 10% of accounts’ share of ARR" value={pct(s.top10Share, 0)} sub="Concentration risk" file="accounts" fileName={fn} />
        <Stat label="Average discount" value={pct(s.avgDiscount)} file="accounts" fileName={fn} />
      </div>

      <Section title="Account list" hint="Click an account to open its record. Pin a row’s fact with the pin in the last column.">
        <div className="filters">
          <select value={filter.segment} onChange={(e) => setFilter({ ...filter, segment: e.target.value })}><option value="">All segments</option>{opts('segment').map((o) => <option key={o}>{o}</option>)}</select>
          <select value={filter.risk} onChange={(e) => setFilter({ ...filter, risk: e.target.value })}><option value="">All churn risk</option>{opts('churn_risk').map((o) => <option key={o}>{o}</option>)}</select>
          <select value={filter.owner} onChange={(e) => setFilter({ ...filter, owner: e.target.value })}><option value="">All owners</option>{opts('account_owner').map((o) => <option key={o}>{o}</option>)}</select>
        </div>
        <DataTable
          rows={shown}
          initialSort={{ key: 'arr', dir: 'desc' }}
          onRowClick={setSelected}
          columns={[
            { key: 'account_name', label: 'Account', render: (r) => <><strong>{r.account_name}</strong><div className="muted small">{r.industry} · {r.region}</div></> },
            { key: 'segment', label: 'Segment' },
            { key: 'arr', label: 'ARR', align: 'right', sort: (r) => r._arr, render: (r) => money(r._arr) },
            { key: 'health', label: 'Health', align: 'right', sort: (r) => r._health, render: (r) => <span className={r._health < 60 ? 'neg' : ''}>{num(r._health)}</span> },
            { key: 'adoption', label: 'Adoption', align: 'right', sort: (r) => r._adoption, render: (r) => <>{pct(r._adoption, 0)} {usageMap[r.account_id] && <Sparkline values={usageMap[r.account_id].series.map((p) => p.value)} width={56} height={18} />}</> },
            { key: 'nps', label: 'NPS', align: 'right', sort: (r) => r._nps, render: (r) => num(r._nps) },
            { key: 'tickets', label: 'Tickets 90d', align: 'right', sort: (r) => r._tickets, render: (r) => num(r._tickets) },
            { key: 'margin', label: 'Contrib. margin', align: 'right', sort: (r) => r._margin, render: (r) => <span className={r._margin < 0.4 ? 'neg' : ''}>{pct(r._margin, 0)}</span> },
            { key: 'renewal_date', label: 'Renewal', sort: (r) => r._renew },
            { key: 'churn_risk', label: 'Risk', render: (r) => <Badge tone={riskTone(r.churn_risk)}>{r.churn_risk}</Badge> },
            { key: 'account_owner', label: 'Owner' },
            { key: 'pin', label: '', nosort: true, render: (r) => <PinCell file="accounts" fileName={fn} label={`${r.account_name} (${r.account_id})`} value={`${money(r._arr)} ARR, health ${num(r._health)}, adoption ${pct(r._adoption, 0)}, ${r.churn_risk} churn risk, contribution margin ${pct(r._margin, 0)}`} /> },
          ]}
        />
      </Section>

      <div className="two-col">
        <Section title="By segment">
          <GroupTable rows={s.bySegment} file="accounts" fileName={fn} dim="Segment" />
        </Section>
        <Section title="By CS owner" hint="Book of business per Customer Success Manager.">
          <GroupTable rows={s.byOwner} file="accounts" fileName={fn} dim="Owner" />
        </Section>
      </div>
      <Section title="By industry">
        <GroupTable rows={s.byIndustry} file="accounts" fileName={fn} dim="Industry" />
      </Section>

      {selected && <AccountDrawer account={selected} state={state} usage={usageMap[selected.account_id]} onClose={() => setSelected(null)} />}
    </>
  );
}

function GroupTable({ rows, file, fileName, dim }) {
  const max = Math.max(...rows.map((r) => r.arr));
  return (
    <DataTable
      search={false}
      rows={rows.map((r) => ({ ...r, __key: r.key }))}
      initialSort={{ key: 'arr', dir: 'desc' }}
      columns={[
        { key: 'key', label: dim, render: (r) => <strong>{r.key}</strong> },
        { key: 'count', label: 'Accts', align: 'right' },
        { key: 'arr', label: 'ARR', align: 'right', render: (r) => <>{money(r.arr)} <HBar value={r.arr} max={max} /></> },
        { key: 'health', label: 'Health', align: 'right', render: (r) => num(r.health, 0) },
        { key: 'margin', label: 'Margin', align: 'right', render: (r) => pct(r.margin, 0) },
        { key: 'cs', label: 'CS hrs 90d', align: 'right', render: (r) => num(r.cs, 0) },
        { key: 'risky', label: 'At risk', align: 'right' },
        { key: 'pin', label: '', nosort: true, render: (r) => <PinCell file={file} fileName={fileName} label={`${dim}: ${r.key}`} value={`${r.count} accounts, ${money(r.arr)} ARR, health ${num(r.health, 0)}, margin ${pct(r.margin, 0)}, ${r.risky} at risk`} /> },
      ]}
    />
  );
}

function AccountDrawer({ account: a, state, usage, onClose }) {
  const F = state.data.files;
  const opps = F.opportunities ? F.opportunities.rows.filter((o) => o.account_id === a.account_id) : [];
  const hidden = new Set(['account_id', 'account_name', 'notes']);
  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside className="drawer" onClick={(e) => e.stopPropagation()} aria-label={`${a.account_name} record`}>
        <header>
          <div>
            <span className="eyebrow">{a.account_id} · {a.segment} · {a.industry}</span>
            <h2>{a.account_name}</h2>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close">✕</button>
        </header>
        <div className="stats compact">
          <Stat label="ARR" value={money(a._arr)} />
          <Stat label="Health" value={num(a._health)} tone={a._health < 60 ? 'bad' : ''} />
          <Stat label="Adoption" value={pct(a._adoption, 0)} />
          <Stat label="Contribution margin" value={pct(a._margin, 0)} tone={a._margin < 0.4 ? 'warn' : ''} />
        </div>
        {a.notes && <div className="callout note"><strong>Note</strong><div>{a.notes}</div></div>}
        {usage && (
          <>
            <h4>Adoption trend</h4>
            <LineChart series={usage.series.map((p) => ({ ...p, value: p.value * 100 }))} kpi={{ agg: 'ratio', asPercent: true }} height={170} />
            <p className="muted small">AI Coach users: {num(usage.aiCoach)} · Analytics Pro users: {num(usage.analytics)} of {num(usage.licensed)} licensed · Avg time-to-value {num(usage.ttv, 1)} days · {num(usage.tickets)} tickets this year</p>
          </>
        )}
        <h4>Record</h4>
        <dl className="kv">
          {Object.keys(a).filter((k) => !k.startsWith('_') && !hidden.has(k)).map((k) => (
            <div key={k}><dt>{k.replace(/_/g, ' ')}</dt><dd>{a[k] || '—'}</dd></div>
          ))}
        </dl>
        {opps.length > 0 && (
          <>
            <h4>Opportunities ({opps.length})</h4>
            <ul className="opp-list">
              {opps.map((o) => (
                <li key={o.opportunity_id}>
                  <div><strong>{o.product}</strong> · {o.opportunity_type} <Badge tone={/won/i.test(o.status) ? 'good' : /lost/i.test(o.status) ? 'bad' : ''}>{o.stage}</Badge></div>
                  <span className="muted small">{money(toNumber(o.amount))} · {o.sales_rep} · close {o.expected_close_date}{o.lost_reason ? ` · lost: ${o.lost_reason}` : ''}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </aside>
    </div>
  );
}

// ------------------------------------------------------------------ Pipeline
function Pipeline({ state }) {
  const F = state.data.files;
  const p = useMemo(() => pipelineSummary(F.opportunities.rows), [F.opportunities]);
  const fn = F.opportunities.name;
  const [view, setView] = useState('board');

  const groupCols = (dim) => [
    { key: 'key', label: dim, render: (r) => <strong>{r.key}</strong> },
    { key: 'count', label: 'Opps', align: 'right' },
    { key: 'winRate', label: 'Win rate', align: 'right', render: (r) => pct(r.winRate, 0) },
    { key: 'wonAmt', label: 'Won $', align: 'right', render: (r) => money(r.wonAmt) },
    { key: 'avgWon', label: 'Avg won deal', align: 'right', render: (r) => money(r.avgWon) },
    { key: 'weighted', label: 'Open weighted', align: 'right', render: (r) => money(r.weighted) },
    { key: 'avgDisc', label: 'Avg discount (won)', align: 'right', render: (r) => pct(r.avgDisc, 0) },
    { key: 'pin', label: '', nosort: true, render: (r) => <PinCell file="opportunities" fileName={fn} label={`${dim}: ${r.key}`} value={`win rate ${pct(r.winRate, 0)} (${r.won}W/${r.lost}L), ${money(r.wonAmt)} won, avg deal ${money(r.avgWon)}, ${money(r.weighted)} weighted open`} /> },
  ];

  return (
    <>
      <div className="stats">
        <Stat label="Closed-won bookings" value={money(p.wonAmt)} sub={`${p.won.length} deals · avg ${money(p.avgWon)}`} file="opportunities" fileName={fn} />
        <Stat label="Win rate" value={pct(p.winRate, 0)} sub={`${p.won.length} won / ${p.won.length + p.lost.length} closed`} file="opportunities" fileName={fn} />
        <Stat label="Open pipeline" value={money(p.openAmt)} sub={`${p.open.length} deals`} file="opportunities" fileName={fn} />
        <Stat label="Weighted pipeline" value={money(p.weighted)} sub="Amount × stage probability" file="opportunities" fileName={fn} />
        <Stat label="Avg discount on won deals" value={pct(p.avgDiscWon)} file="opportunities" fileName={fn} />
        <Stat label="Open deals stuck 30+ days in stage" value={num(p.staleOpen.length)} sub={money(p.staleOpen.reduce((a, r) => a + r._amt, 0))} tone={p.staleOpen.length ? 'warn' : ''} file="opportunities" fileName={fn} />
      </div>

      <div className="seg-toggle">
        <button className={view === 'board' ? 'on' : ''} onClick={() => setView('board')}>Board</button>
        <button className={view === 'list' ? 'on' : ''} onClick={() => setView('list')}>All opportunities</button>
      </div>

      {view === 'board' ? (
        <div className="kanban">
          {p.stages.map((col) => (
            <div key={col.stage} className="kanban-col">
              <header>
                <strong>{col.stage}</strong>
                <span className="muted small">{col.rows.length} · {money(col.rows.reduce((a, r) => a + r._amt, 0))}</span>
              </header>
              {col.rows.map((o) => (
                <div key={o.opportunity_id} className={`kcard ${o._days > 30 ? 'stale' : ''}`}>
                  <div className="kcard-top"><strong>{o.account_name}</strong><span>{money(o._amt)}</span></div>
                  <div className="muted small">{o.product} · {o.opportunity_type} · {o.source}</div>
                  <div className="muted small">{o.sales_rep} · {o.days_in_stage}d in stage · close {o.expected_close_date}</div>
                  {o.next_step && <div className="small next">Next: {o.next_step}</div>}
                </div>
              ))}
            </div>
          ))}
        </div>
      ) : (
        <DataTable
          rows={F.opportunities.rows.map((r) => ({ ...r, __key: r.opportunity_id }))}
          initialSort={{ key: 'amount', dir: 'desc' }}
          columns={[
            { key: 'opportunity_id', label: 'ID' },
            { key: 'account_name', label: 'Account', render: (r) => <strong>{r.account_name}</strong> },
            { key: 'opportunity_type', label: 'Type' },
            { key: 'product', label: 'Product' },
            { key: 'source', label: 'Source' },
            { key: 'sales_rep', label: 'Rep' },
            { key: 'stage', label: 'Stage', render: (r) => <Badge tone={/won/i.test(r.status) ? 'good' : /lost/i.test(r.status) ? 'bad' : ''}>{r.stage}</Badge> },
            { key: 'amount', label: 'Amount', align: 'right', sort: (r) => toNumber(r.amount), render: (r) => money(toNumber(r.amount)) },
            { key: 'expected_close_date', label: 'Close' },
            { key: 'lost_reason', label: 'Lost reason' },
          ]}
        />
      )}

      <Section title="By lead source" hint="Which sources produce revenue, not just activity?">
        <DataTable search={false} rows={p.bySource.map((r) => ({ ...r, __key: r.key }))} initialSort={{ key: 'wonAmt', dir: 'desc' }} columns={groupCols('Source')} />
      </Section>
      <div className="two-col">
        <Section title="By sales rep">
          <DataTable search={false} rows={p.byRep.map((r) => ({ ...r, __key: r.key }))} initialSort={{ key: 'wonAmt', dir: 'desc' }} columns={groupCols('Rep').filter((c) => c.key !== 'avgDisc')} />
        </Section>
        <Section title="By opportunity type">
          <DataTable search={false} rows={p.byType.map((r) => ({ ...r, __key: r.key }))} initialSort={{ key: 'wonAmt', dir: 'desc' }} columns={groupCols('Type').filter((c) => c.key !== 'avgDisc')} />
        </Section>
      </div>
      <div className="two-col">
        <Section title="By product">
          <DataTable search={false} rows={p.byProduct.map((r) => ({ ...r, __key: r.key }))} initialSort={{ key: 'wonAmt', dir: 'desc' }} columns={groupCols('Product').filter((c) => c.key !== 'avgDisc')} />
        </Section>
        <Section title="Why we lose">
          <BarChart data={p.lostReasons.map((r) => ({ label: r.key, value: r.count, n: r.count }))} kpi={{}} />
        </Section>
      </div>
    </>
  );
}

// ------------------------------------------------------------------ Marketing
function Marketing({ state }) {
  const F = state.data.files;
  const ch = useMemo(() => campaignsByChannel(F.campaigns.rows), [F.campaigns]);
  const fn = F.campaigns.name;
  const tot = ch.reduce((a, c) => ({ spend: a.spend + c.spend, bookings: a.bookings + c.bookings, wins: a.wins + c.wins, opps: a.opps + c.opps }), { spend: 0, bookings: 0, wins: 0, opps: 0 });
  const best = ch[0], worst = ch[ch.length - 1];
  return (
    <>
      <div className="stats">
        <Stat label="Campaign spend" value={money(tot.spend)} sub={`${F.campaigns.rows.length} campaigns`} file="campaigns" fileName={fn} />
        <Stat label="Attributed bookings" value={money(tot.bookings)} sub={`${num(tot.wins)} wins`} file="campaigns" fileName={fn} />
        <Stat label="Blended bookings ÷ spend" value={`${num(tot.bookings / tot.spend, 1)}×`} file="campaigns" fileName={fn} />
        <Stat label="Blended CAC" value={money(tot.spend / tot.wins)} sub="Spend ÷ wins (program spend only)" file="campaigns" fileName={fn} />
        {best && <Stat label={`Best channel: ${best.key}`} value={`${num(best.bookingRoi, 1)}× ROI`} sub={`CAC ${money(best.cac)}`} tone="good" file="campaigns" fileName={fn} />}
        {worst && <Stat label={`Weakest channel: ${worst.key}`} value={`${num(worst.bookingRoi, 1)}× ROI`} sub={`CAC ${money(worst.cac)}`} tone="warn" file="campaigns" fileName={fn} />}
      </div>
      <Section title="Channel performance" hint="Bookings ÷ spend is attributed, not causal. Ask how attribution was assigned before moving budget.">
        <DataTable
          search={false}
          rows={ch.map((r) => ({ ...r, __key: r.key }))}
          initialSort={{ key: 'bookingRoi', dir: 'desc' }}
          columns={[
            { key: 'key', label: 'Channel', render: (r) => <strong>{r.key}</strong> },
            { key: 'campaigns', label: 'Campaigns', align: 'right' },
            { key: 'spend', label: 'Spend', align: 'right', render: (r) => money(r.spend) },
            { key: 'leads', label: 'Leads', align: 'right', render: (r) => num(r.leads) },
            { key: 'opps', label: 'Opps', align: 'right', render: (r) => num(r.opps) },
            { key: 'wins', label: 'Wins', align: 'right', render: (r) => num(r.wins) },
            { key: 'oppToWin', label: 'Opp→Win', align: 'right', render: (r) => pct(r.oppToWin, 0) },
            { key: 'cac', label: 'CAC', align: 'right', render: (r) => money(r.cac) },
            { key: 'bookings', label: 'Bookings', align: 'right', render: (r) => money(r.bookings) },
            { key: 'bookingRoi', label: 'Bookings ÷ spend', align: 'right', render: (r) => `${num(r.bookingRoi, 1)}×` },
            { key: 'cycle', label: 'Cycle (days)', align: 'right', render: (r) => num(r.cycle, 0) },
            { key: 'pin', label: '', nosort: true, render: (r) => <PinCell file="campaigns" fileName={fn} label={`Channel: ${r.key}`} value={`${money(r.spend)} spend → ${money(r.bookings)} bookings (${num(r.bookingRoi, 1)}×), CAC ${money(r.cac)}, ${num(r.cycle, 0)}-day cycle`} /> },
          ]}
        />
      </Section>
      <Section title="Bookings per dollar, by channel">
        <BarChart data={ch.map((c) => ({ label: c.key, value: c.bookingRoi, n: c.campaigns }))} kpi={{}} />
      </Section>
      <Section title="All campaigns">
        <DataTable
          rows={F.campaigns.rows.map((r) => ({ ...r, __key: r.campaign_id }))}
          initialSort={{ key: 'booking_roi', dir: 'desc' }}
          columns={['campaign_name', 'channel', 'quarter', 'spend', 'leads', 'opportunities', 'wins', 'bookings', 'customer_acquisition_cost', 'booking_roi', 'avg_sales_cycle_days'].filter((k) => F.campaigns.columns.includes(k)).map((k) => ({
            key: k, label: k.replace(/_/g, ' '), align: ['campaign_name', 'channel', 'quarter'].includes(k) ? undefined : 'right',
            sort: (r) => (['campaign_name', 'channel', 'quarter'].includes(k) ? r[k] : toNumber(r[k])),
            render: (r) => (['spend', 'bookings', 'customer_acquisition_cost'].includes(k) ? money(toNumber(r[k])) : r[k]),
          }))}
        />
      </Section>
    </>
  );
}

// ------------------------------------------------------------------ Sales activity
function Activity({ state }) {
  const F = state.data.files;
  const reps = useMemo(() => activityByRep(F.activity.rows, F.opportunities?.rows), [F.activity, F.opportunities]);
  const weeks = useMemo(() => activityByWeek(F.activity.rows), [F.activity]);
  const fn = F.activity.name;
  return (
    <>
      <div className="stats">
        {reps.map((r) => (
          <Stat key={r.key} label={r.key} value={`${num(r.perWeek.demos, 1)} demos/wk`}
            sub={`${num(r.perWeek.calls, 0)} calls · ${num(r.perWeek.proposals, 1)} proposals/wk${Number.isFinite(r.wonAmt) ? ` · ${money(r.wonAmt)} won` : ''}`}
            file="activity" fileName={fn} />
        ))}
      </div>
      <Section title="Activity vs. outcomes by rep" hint="Activity is an input. Compare it with what each rep actually closed — high effort with low conversion is a coaching signal, not a quota problem.">
        <DataTable
          search={false}
          rows={reps.map((r) => ({ ...r, __key: r.key }))}
          initialSort={{ key: 'wonAmt', dir: 'desc' }}
          columns={[
            { key: 'key', label: 'Rep', render: (r) => <strong>{r.key}</strong> },
            { key: 'weeks', label: 'Weeks', align: 'right' },
            { key: 'calls', label: 'Calls', align: 'right', render: (r) => num(r.calls) },
            { key: 'emails', label: 'Emails', align: 'right', render: (r) => num(r.emails) },
            { key: 'meetings', label: 'Meetings', align: 'right', render: (r) => num(r.meetings) },
            { key: 'demos', label: 'Demos', align: 'right', render: (r) => num(r.demos) },
            { key: 'proposals', label: 'Proposals', align: 'right', render: (r) => num(r.proposals) },
            { key: 'demoToProposal', label: 'Demo→Proposal', align: 'right', render: (r) => pct(r.demoToProposal, 0) },
            ...(F.opportunities ? [
              { key: 'winRate', label: 'Win rate (CRM)', align: 'right', render: (r) => pct(r.winRate, 0) },
              { key: 'wonAmt', label: 'Won $ (CRM)', align: 'right', render: (r) => money(r.wonAmt) },
            ] : []),
            { key: 'pin', label: '', nosort: true, render: (r) => <PinCell file="activity" fileName={fn} label={`Rep activity: ${r.key}`} value={`${num(r.perWeek.calls, 0)} calls, ${num(r.perWeek.demos, 1)} demos, ${num(r.perWeek.proposals, 1)} proposals per week; demo→proposal ${pct(r.demoToProposal, 0)}`} /> },
          ]}
        />
      </Section>
      <Section title="Team demos per week">
        <LineChart series={weeks.map((w) => ({ label: w.label, value: w.demos }))} kpi={{}} height={200} />
      </Section>
    </>
  );
}

// ------------------------------------------------------------------ Usage
function Usage({ state }) {
  const F = state.data.files;
  const m = useMemo(() => usageByMonth(F.usage.rows), [F.usage]);
  const acc = useMemo(() => usageByAccount(F.usage.rows), [F.usage]);
  const fn = F.usage.name;
  const first = m[0], last = m[m.length - 1];
  return (
    <>
      <div className="stats">
        <Stat label={`Adoption ${last.label}`} value={pct(last.adoption)} sub={`${first.label}: ${pct(first.adoption)}`} file="usage" fileName={fn} />
        <Stat label={`Active users ${last.label}`} value={num(last.active)} sub={`of ${num(last.licensed)} licensed`} file="usage" fileName={fn} />
        <Stat label={`AI Coach users ${last.label}`} value={num(last.aiCoach)} sub={`${first.label}: ${num(first.aiCoach)}`} file="usage" fileName={fn} />
        <Stat label={`Analytics Pro users ${last.label}`} value={num(last.analytics)} sub={`${first.label}: ${num(first.analytics)}`} file="usage" fileName={fn} />
        <Stat label={`Avg time-to-value ${last.label}`} value={`${num(last.ttv, 1)} days`} sub={`${first.label}: ${num(first.ttv, 1)} days`} tone={last.ttv > first.ttv ? 'warn' : ''} file="usage" fileName={fn} />
        <Stat label={`Support tickets ${last.label}`} value={num(last.tickets)} sub={`${first.label}: ${num(first.tickets)}`} file="usage" fileName={fn} />
      </div>
      <div className="two-col">
        <Section title="Adoption rate (all accounts)"><LineChart series={m.map((r) => ({ label: r.label, value: r.adoption * 100 }))} kpi={{ agg: 'ratio', asPercent: true }} height={200} /></Section>
        <Section title="Add-on users">
          <LineChart series={m.map((r) => ({ label: r.label, value: r.aiCoach }))} kpi={{}} height={200} />
          <p className="muted small">AI Coach users per month. Analytics Pro: {m.map((r) => num(r.analytics)).join(' → ')}</p>
        </Section>
      </div>
      <Section title="Adoption by account" hint="Sorted by change since the first month. Declining adoption usually shows up before a churn conversation.">
        <DataTable
          rows={acc.map((r) => ({ ...r, __key: r.id }))}
          initialSort={{ key: 'change', dir: 'asc' }}
          columns={[
            { key: 'name', label: 'Account', render: (r) => <strong>{r.name}</strong> },
            { key: 'trend', label: 'Trend', nosort: true, render: (r) => <Sparkline values={r.series.map((p) => p.value)} /> },
            { key: 'firstAdoption', label: 'First', align: 'right', render: (r) => pct(r.firstAdoption, 0) },
            { key: 'lastAdoption', label: 'Latest', align: 'right', render: (r) => pct(r.lastAdoption, 0) },
            { key: 'change', label: 'Change', align: 'right', render: (r) => <span className={r.change < 0 ? 'neg' : 'pos'}>{r.change >= 0 ? '+' : ''}{num(r.change * 100, 1)} pts</span> },
            { key: 'ttv', label: 'Avg TTV (d)', align: 'right', render: (r) => num(r.ttv, 1) },
            { key: 'tickets', label: 'Tickets', align: 'right' },
            { key: 'aiCoach', label: 'AI Coach', align: 'right' },
            { key: 'analytics', label: 'Analytics Pro', align: 'right' },
            { key: 'pin', label: '', nosort: true, render: (r) => <PinCell file="usage" fileName={fn} label={`Usage: ${r.name}`} value={`adoption ${pct(r.firstAdoption, 0)} → ${pct(r.lastAdoption, 0)}, ${r.tickets} tickets, avg TTV ${num(r.ttv, 1)} days`} /> },
          ]}
        />
      </Section>
    </>
  );
}

// ------------------------------------------------------------------ Financials
function Financials({ state }) {
  const F = state.data.files;
  const company = F.company?.rows[0];
  const s = useMemo(() => financialSummary(F.financials.rows, company), [F.financials, company]);
  const fn = F.financials.name;
  const cols = F.financials.columns;
  return (
    <>
      <div className="stats">
        <Stat label="2026 revenue YTD (actual)" value={money(s.ytdRevenue)} sub={`${s.actualMonths} months`} file="financials" fileName={fn} />
        <Stat label="2026 full year (actual + forecast)" value={money(s.fyRevenue)} sub={Number.isFinite(s.target) ? `Target ${money(s.target)}` : ''} tone={s.vsTarget < 0 ? 'warn' : ''} file="financials" fileName={fn} />
        <Stat label="December exit run-rate" value={money(s.exitRunRate)} sub="Last month × 12" file="financials" fileName={fn} />
        <Stat label="Avg gross margin (actuals)" value={pct(s.avgGm)} file="financials" fileName={fn} />
        <Stat label="EBITDA YTD" value={money(s.ytdEbitda)} tone={s.ytdEbitda < 0 ? 'bad' : ''} file="financials" fileName={fn} />
        <Stat label="Avg monthly cash change" value={money(s.avgBurn)} tone={s.avgBurn < 0 ? 'bad' : ''} file="financials" fileName={fn} />
        {s.breach && <Stat label="First month below cash reserve" value={s.breach.month.slice(0, 7)} sub={`${money(s.breach._cash)} vs ${money(s.reserve)} reserve`} tone="bad" file="financials" fileName={fn} />}
        <Stat label="Forecast year-end cash" value={money(s.yearEndCash)} tone={s.yearEndCash < 0 ? 'bad' : ''} file="financials" fileName={fn} />
        <Stat label="Cash collected ÷ revenue (actuals)" value={pct(s.collectionRate)} file="financials" fileName={fn} />
      </div>
      {s.negative && (
        <div className="callout warn"><strong>Check this before anything else</strong><div>Ending cash turns negative in {s.negative.month.slice(0, 7)} in this file. Either a financing event is missing from the data, or the company needs funding now. Find out which before you discuss growth investments.</div></div>
      )}
      <div className="two-col">
        <Section title="Revenue by month" hint="Hollow points are forecast.">
          <LineChart series={s.rows.map((r) => ({ label: r.month.slice(0, 7), value: r._rev, forecast: !r._actual }))} kpi={{ unit: '$' }} height={200} />
        </Section>
        <Section title="EBITDA by month">
          <LineChart series={s.rows.map((r) => ({ label: r.month.slice(0, 7), value: r._ebitda, forecast: !r._actual }))} kpi={{ unit: '$' }} height={200} zero />
        </Section>
      </div>
      <Section title="Monthly P&L and cash">
        <div className="table-scroll">
          <table className="grid-table pnl">
            <thead>
              <tr><th>Line</th>{s.rows.map((r) => <th key={r.month} className={`num ${r._actual ? '' : 'fc'}`}>{r.month.slice(0, 7)}<div className="small">{r.actual_or_forecast}</div></th>)}</tr>
            </thead>
            <tbody>
              {cols.filter((c) => !['month', 'actual_or_forecast'].includes(c)).map((c) => (
                <tr key={c} className={/total|gross_profit|ebitda|ending_cash/.test(c) ? 'strong-row' : ''}>
                  <td>{c.replace(/_/g, ' ')}</td>
                  {s.rows.map((r) => {
                    const v = toNumber(r[c]);
                    return <td key={r.month} className={`num ${v < 0 ? 'neg' : ''} ${r._actual ? '' : 'fc'}`}>{/pct/.test(c) ? pct(v) : money(v)}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </>
  );
}

// ------------------------------------------------------------------ Team
function Team({ state }) {
  const F = state.data.files;
  const t = useMemo(() => teamSummary(F.employees.rows), [F.employees]);
  const fn = F.employees.name;
  return (
    <>
      <div className="stats">
        <Stat label="Active headcount" value={num(t.active.length)} file="employees" fileName={fn} />
        <Stat label="Active fully-loaded cost / yr" value={money(t.activeCost)} sub="Base × (1 + benefits) × (1 + variable target)" file="employees" fileName={fn} />
        <Stat label="Planned hires" value={num(t.planned.length)} file="employees" fileName={fn} />
        <Stat label="Planned hires — annualized cost" value={money(t.plannedCost)} tone="warn" file="employees" fileName={fn} />
      </div>
      <div className="two-col">
        <Section title="Roster">
          <DataTable
            rows={t.rows.map((r) => ({ ...r, __key: r.employee_id }))}
            initialSort={{ key: 'start_date', dir: 'asc' }}
            columns={[
              { key: 'employee_name', label: 'Name', render: (r) => <strong>{r.employee_name}</strong> },
              { key: 'role', label: 'Role' },
              { key: 'department', label: 'Dept' },
              { key: 'start_date', label: 'Start' },
              { key: 'status', label: 'Status', render: (r) => <Badge tone={r._planned ? 'warn' : 'good'}>{r.status}</Badge> },
              { key: 'base', label: 'Base', align: 'right', sort: (r) => r._base, render: (r) => money(r._base) },
              { key: 'loaded', label: 'Loaded cost', align: 'right', sort: (r) => r._loaded, render: (r) => money(r._loaded) },
              { key: 'business_case', label: 'Business case' },
            ]}
          />
        </Section>
        <Section title="Cost by department">
          <BarChart data={t.byDept.map((d) => ({ label: d.key, value: d.cost, n: d.active + d.planned }))} kpi={{ unit: '$' }} />
          <p className="muted small">Includes planned hires at full-year cost.</p>
        </Section>
      </div>
    </>
  );
}

// ------------------------------------------------------------------ Plan
function Plan({ state }) {
  const F = state.data.files;
  const t = useMemo(() => planPressureTest(state), [state]);
  const fn = F.plan.name;
  return (
    <>
      <Section title="Scenarios" hint="As submitted by management.">
        <DataTable
          search={false}
          rows={F.plan.rows.map((r) => ({ ...r, __key: r.scenario }))}
          columns={F.plan.columns.map((c) => ({
            key: c, label: c.replace(/_/g, ' '), align: c === 'scenario' ? undefined : 'right', nosort: true,
            render: (r) => (c === 'scenario' ? <strong>{r[c]}</strong> : /pct|rate/.test(c) ? pct(toNumber(r[c]), 0) : /hires/.test(c) ? r[c] : money(toNumber(r[c]))),
          }))}
        />
      </Section>
      <Section title="Pressure test: plan assumptions vs. 2026 evidence" hint="Each row puts a plan assumption next to what the 2026 files show. The gap is where your judgment is needed — the tool does not decide which side is right.">
        <div className="pressure">
          {t.checks.map((c) => (
            <div key={c.scenario} className="pressure-card">
              <h4>{c.scenario}</h4>
              <table className="grid-table">
                <thead><tr><th>Assumption</th><th className="num">Plan</th><th className="num">2026 evidence</th><th></th></tr></thead>
                <tbody>
                  {c.rows.map((r) => (
                    <tr key={r.label} className={r.gap > 0.05 ? 'flag' : ''}>
                      <td>{r.label}<div className="muted small">{r.note}</div></td>
                      <td className="num">{r.plan}</td>
                      <td className="num">{r.actual}</td>
                      <td><PinCell file="plan" fileName={fn} label={`${c.scenario}: ${r.label}`} value={`plan ${r.plan} vs 2026 ${r.actual || 'n/a'}${r.note ? ` (${r.note})` : ''}`} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      </Section>
    </>
  );
}

// ------------------------------------------------------------------ Files
function Files({ state }) {
  const F = state.data.files;
  const keys = state.data.order.filter((k) => F[k]);
  const [key, setKey] = useState(keys[0]);
  const f = F[key] || F[keys[0]];
  const dict = F.dictionary;
  const dictUseful = dict && dict.rows.some((r) => r.description && !/^see field name/i.test(r.description));
  return (
    <>
      <div className="filters">
        <select value={f.key} onChange={(e) => setKey(e.target.value)}>
          {keys.map((k) => <option key={k} value={k}>{fileLabel(F[k])} — {F[k].name}</option>)}
        </select>
        <span className="muted">{f.rows.length} rows · {f.columns.length} columns · type: {KINDS[f.kind]?.label || 'Generic table'}</span>
      </div>
      {dict && !dictUseful && (
        <div className="callout note"><strong>About the data dictionary</strong><div>The dictionary in this workspace lists fields but does not define them. Before you rely on a metric (for example, how “health score” or “contribution” is calculated), confirm the definition with the data owner and note it as a data gap.</div></div>
      )}
      <DataTable
        key={f.key}
        rows={f.rows.map((r, i) => ({ ...r, __key: i }))}
        pageSize={30}
        columns={f.columns.map((c) => ({ key: c, label: c.replace(/_/g, ' ') }))}
      />
    </>
  );
}
