import { useRef, useState } from 'react';
import { Field, Text, Area, StageHeader, Callout } from '../components/ui.jsx';
import { makeFile, addFiles, fileLabel, KINDS } from '../lib/workspace.js';
import { profileColumns } from '../lib/analysis.js';
import { SAMPLES } from '../lib/samples.js';

const CHECKS = [
  { id: 'fresh', label: 'Fresh enough', hint: 'The data describes the period you are deciding about.' },
  { id: 'complete', label: 'Complete', hint: 'No large blocks of missing rows, months or segments.' },
  { id: 'representative', label: 'Representative', hint: 'It includes the cases you care about — not just the easy-to-measure ones.' },
  { id: 'definitions', label: 'Definitions agreed', hint: 'Everyone means the same thing by each field (e.g. “active”, “churned”, “health”).' },
];

export default function DataStage({ state, update, setState, stage, loadSample, openWorkspace }) {
  const d = state.data;
  const set = (patch) => update('data', patch);
  const inputRef = useRef(null);
  const [error, setError] = useState('');
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState('');
  const keys = d.order.filter((k) => d.files[k]);
  const activeKey = d.files[d.active] ? d.active : keys[0];
  const active = d.files[activeKey];

  async function handleFiles(list) {
    setError('');
    const arr = [...list].filter((f) => /\.(csv|tsv|txt)$/i.test(f.name));
    if (!arr.length) { setError('Please choose one or more .csv files.'); return; }
    try {
      const parsed = await Promise.all(arr.map(async (f) => makeFile(f.name, await f.text())));
      setState((s) => ({ ...s, data: { ...addFiles(s.data, parsed), active: parsed[0].key } }));
    } catch (e) {
      setError(e.message || 'Could not read that file.');
    }
  }

  async function sample(id) {
    setBusy(id);
    try { await loadSample(id); } catch (e) { setError(e.message); }
    setBusy('');
  }

  function removeFile(key) {
    setState((s) => {
      const files = { ...s.data.files };
      delete files[key];
      return { ...s, data: { ...s.data, files, order: s.data.order.filter((k) => k !== key) }, kpis: s.kpis.map((k) => (k.file === key ? { ...k, file: '', column: '' } : k)) };
    });
  }

  function setDateCol(key, col) {
    setState((s) => ({ ...s, data: { ...s.data, files: { ...s.data.files, [key]: { ...s.data.files[key], dateCol: col } } } }));
  }

  const profile = active ? profileColumns(active.columns, active.rows) : [];

  return (
    <div className="stage">
      <StageHeader stage={stage} index={1} />

      <div
        className={`dropzone ${drag ? 'drag' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); handleFiles(e.dataTransfer.files); }}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && inputRef.current?.click()}
      >
        <input ref={inputRef} type="file" accept=".csv,.tsv,.txt" multiple hidden onChange={(e) => { handleFiles(e.target.files); e.target.value = ''; }} />
        <strong>Drop one or more CSV files here, or click to choose</strong>
        <span className="muted">Files stay in your browser. Nothing is uploaded to a server. Recognized business files (accounts, opportunities, campaigns, usage, financials, team, plan) unlock CRM views.</span>
      </div>
      {error && <Callout kind="warn">{error}</Callout>}

      <div className="samples">
        <span className="field-label">Or explore an example case</span>
        <div className="sample-grid">
          {SAMPLES.map((s) => (
            <button key={s.id} className={`sample ${s.featured ? 'featured' : ''}`} onClick={() => sample(s.id)} disabled={!!busy}>
              <strong>{busy === s.id ? 'Loading…' : s.title}</strong>
              <span>{s.blurb}</span>
            </button>
          ))}
        </div>
      </div>

      {keys.length > 0 && (
        <>
          <div className="ws-section-head">
            <h3>Files in this decision ({keys.length})</h3>
            <button className="btn primary small" onClick={openWorkspace}>Open CRM workspace →</button>
          </div>
          <div className="file-list">
            {keys.map((k) => {
              const f = d.files[k];
              return (
                <div key={k} className={`file-row ${k === activeKey ? 'on' : ''}`} onClick={() => set({ active: k })}>
                  <div>
                    <strong>{f.name}</strong>
                    <span className={`badge ${f.kind === 'generic' ? '' : 'good'}`}>{f.kind === 'generic' ? 'Table' : KINDS[f.kind].label}</span>
                  </div>
                  <span className="muted small">{f.rows.length.toLocaleString()} rows · {f.columns.length} cols{f.dateCol ? ` · time: ${f.dateCol}` : ''}</span>
                  <button className="icon-btn" aria-label={`Remove ${f.name}`} onClick={(e) => { e.stopPropagation(); removeFile(k); }}>✕</button>
                </div>
              );
            })}
          </div>

          {active && (
            <div className="data-summary">
              <div className="row tight">
                <h4>{fileLabel(active)} — column profile</h4>
                <label className="inline">
                  Time column{' '}
                  <select value={active.dateCol} onChange={(e) => setDateCol(active.key, e.target.value)}>
                    <option value="">(none)</option>
                    {active.columns.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </label>
              </div>
              <div className="table-scroll">
                <table className="grid-table">
                  <thead><tr><th>Column</th><th>Type</th><th className="num">Missing</th><th className="num">Unique</th><th>Range / examples</th></tr></thead>
                  <tbody>
                    {profile.map((p) => (
                      <tr key={p.name}>
                        <td><code>{p.name}</code></td>
                        <td><span className={`type-pill ${p.type}`}>{p.type}</span></td>
                        <td className={`num ${p.missing ? 'warn-text' : ''}`}>{p.missing}</td>
                        <td className="num">{p.unique}</td>
                        <td className="muted">{p.stats ? `${p.stats.min.toLocaleString()} – ${p.stats.max.toLocaleString()} (avg ${p.stats.mean.toLocaleString(undefined, { maximumFractionDigits: 2 })})` : p.sample.join(', ')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      <div className="row">
        <Field label="Where did this data come from?" hint="Systems, who exported it, any filters applied.">
          <Text value={d.source} onChange={(v) => set({ source: v })} placeholder="e.g. CRM export by RevOps, all regions" />
        </Field>
        <Field label="Data as of" hint="The most recent date the data covers.">
          <Text type="date" value={d.asOf} onChange={(v) => set({ asOf: v })} />
        </Field>
      </div>

      <div className="field wide">
        <span className="field-label">Data quality checklist</span>
        <span className="field-hint">Tick only what you have actually confirmed. Unticked boxes are fine — they become named gaps below.</span>
        <div className="checks">
          {CHECKS.map((c) => (
            <label key={c.id} className={`check ${d.checks?.[c.id] ? 'on' : ''}`}>
              <input type="checkbox" checked={!!d.checks?.[c.id]} onChange={(e) => set({ checks: { ...d.checks, [c.id]: e.target.checked } })} />
              <span><strong>{c.label}</strong><small>{c.hint}</small></span>
            </label>
          ))}
        </div>
      </div>

      <Field label="What is missing or suspect?" hint="Data you wish you had, fields you do not trust, numbers that disagree across files." wide>
        <Area value={d.gaps} onChange={(v) => set({ gaps: v })} placeholder="We do not have … / We are not sure how … is defined / The two files disagree on …" />
      </Field>
    </div>
  );
}
