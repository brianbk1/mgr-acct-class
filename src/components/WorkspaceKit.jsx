import { createContext, useContext, useMemo, useState } from 'react';

// Shared building blocks for the CRM workspace: stat tiles you can pin as evidence,
// and a sortable, searchable table.

export const EvidenceCtx = createContext({ pin: () => {}, isPinned: () => false });

export function Stat({ label, value, sub, tone, file, fileName, note }) {
  const { pin, isPinned } = useContext(EvidenceCtx);
  const pinned = file ? isPinned(file, label) : false;
  return (
    <div className={`stat ${tone || ''}`}>
      <div className="stat-top">
        <span className="stat-label">{label}</span>
        {file && (
          <button
            className={`pin ${pinned ? 'on' : ''}`}
            title={pinned ? 'Pinned as evidence' : 'Pin this data point as evidence'}
            aria-label={pinned ? `Unpin ${label}` : `Pin ${label} as evidence`}
            onClick={() => pin({ file, fileName, label, value: String(value), note: note || sub || '' })}
          >
            <PinIcon />
          </button>
        )}
      </div>
      <div className="stat-value">{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}

export function PinIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
      <path d="M9.5 1.5l5 5-2 .8-2.6 2.6.4 3.1-1.3 1.3-2.6-2.6L3 15l-1-1 3.3-3.4L2.7 8l1.3-1.3 3.1.4 2.6-2.6z" fill="currentColor" />
    </svg>
  );
}

// Pin a single row-level fact from inside a table.
export function PinCell({ file, fileName, label, value, note }) {
  const { pin, isPinned } = useContext(EvidenceCtx);
  const on = isPinned(file, label);
  return (
    <button
      className={`pin small ${on ? 'on' : ''}`}
      title={on ? 'Pinned' : 'Pin as evidence'}
      aria-label={`Pin ${label}`}
      onClick={(e) => { e.stopPropagation(); pin({ file, fileName, label, value: String(value), note }); }}
    >
      <PinIcon />
    </button>
  );
}

export function DataTable({ columns, rows, initialSort, onRowClick, search = true, pageSize = 25, rowClass, empty = 'No rows.' }) {
  const [sort, setSort] = useState(initialSort || { key: null, dir: 'desc' });
  const [q, setQ] = useState('');
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    if (!q.trim()) return rows;
    const needle = q.toLowerCase();
    return rows.filter((r) => columns.some((c) => String(c.text ? c.text(r) : r[c.key] ?? '').toLowerCase().includes(needle)));
  }, [rows, q, columns]);

  const sorted = useMemo(() => {
    if (!sort.key) return filtered;
    const col = columns.find((c) => c.key === sort.key);
    const val = col?.sort || ((r) => r[sort.key]);
    return [...filtered].sort((a, b) => {
      const x = val(a), y = val(b);
      const nx = typeof x === 'number' ? x : Number(x), ny = typeof y === 'number' ? y : Number(y);
      let c;
      if (Number.isFinite(nx) && Number.isFinite(ny)) c = nx - ny;
      else c = String(x ?? '').localeCompare(String(y ?? ''));
      return sort.dir === 'asc' ? c : -c;
    });
  }, [filtered, sort, columns]);

  const pages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const p = Math.min(page, pages - 1);
  const shown = sorted.slice(p * pageSize, (p + 1) * pageSize);

  return (
    <div className="table-wrap">
      {search && (
        <div className="table-tools">
          <input className="table-search" placeholder="Search…" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} />
          <span className="muted">{sorted.length} of {rows.length}</span>
        </div>
      )}
      <div className="table-scroll">
        <table className="grid-table">
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c.key} className={c.align === 'right' ? 'num' : ''}>
                  {c.nosort ? c.label : (
                    <button onClick={() => setSort((s) => ({ key: c.key, dir: s.key === c.key && s.dir === 'desc' ? 'asc' : 'desc' }))}>
                      {c.label}{sort.key === c.key ? (sort.dir === 'desc' ? ' ↓' : ' ↑') : ''}
                    </button>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 && <tr><td colSpan={columns.length} className="muted">{empty}</td></tr>}
            {shown.map((r, i) => (
              <tr key={r.__key ?? r.id ?? i} onClick={onRowClick ? () => onRowClick(r) : undefined} className={`${onRowClick ? 'clickable' : ''} ${rowClass ? rowClass(r) : ''}`}>
                {columns.map((c) => (
                  <td key={c.key} className={c.align === 'right' ? 'num' : ''}>{c.render ? c.render(r) : r[c.key]}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <div className="pager">
          <button disabled={p === 0} onClick={() => setPage(p - 1)}>← Prev</button>
          <span>Page {p + 1} of {pages}</span>
          <button disabled={p >= pages - 1} onClick={() => setPage(p + 1)}>Next →</button>
        </div>
      )}
    </div>
  );
}

export function Badge({ children, tone }) {
  return <span className={`badge ${tone || ''}`}>{children}</span>;
}

export function riskTone(v) {
  const s = String(v || '').toLowerCase();
  if (s.includes('high')) return 'bad';
  if (s.includes('medium')) return 'warn';
  if (s.includes('low')) return 'good';
  return '';
}

export function Section({ title, hint, children, actions }) {
  return (
    <section className="ws-section">
      <div className="ws-section-head">
        <div>
          <h3>{title}</h3>
          {hint && <p className="muted">{hint}</p>}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

export function HBar({ value, max, tone }) {
  const w = max > 0 && Number.isFinite(value) ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return <span className="hbar"><span className={`hbar-fill ${tone || ''}`} style={{ width: `${w}%` }} /></span>;
}
