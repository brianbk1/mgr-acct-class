import { KINDS } from '../lib/workspace.js';

export default function EvidenceBoard({ state, setState, compact }) {
  const ev = state.evidence || [];
  const files = new Set(ev.map((e) => e.file));
  const remove = (id) => setState((s) => ({ ...s, evidence: s.evidence.filter((e) => e.id !== id) }));
  const note = (id, v) => setState((s) => ({ ...s, evidence: s.evidence.map((e) => (e.id === id ? { ...e, note: v } : e)) }));

  return (
    <div className={`evidence ${compact ? 'compact' : ''}`}>
      <div className="evidence-head">
        <h3>Evidence board</h3>
        <span className={`badge ${ev.length >= 5 && files.size >= 3 ? 'good' : ''}`}>{ev.length} points · {files.size} files</span>
      </div>
      {ev.length === 0 ? (
        <p className="muted">Nothing pinned yet. Use the pin on any number in the CRM workspace or in the charts below. A strong recommendation usually rests on at least five specific data points from three or more sources.</p>
      ) : (
        <ol>
          {ev.map((e) => (
            <li key={e.id}>
              <div className="ev-main">
                <span className="ev-label">{e.label}</span>
                <span className="ev-value">{e.value}</span>
                <button className="icon-btn" aria-label="Remove evidence" onClick={() => remove(e.id)}>✕</button>
              </div>
              <span className="muted small">{KINDS[state.data.files[e.file]?.kind]?.label || 'File'} · {e.fileName}</span>
              <input className="ev-note" value={e.note || ''} placeholder="What does this tell you? (optional)" onChange={(x) => note(e.id, x.target.value)} />
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
