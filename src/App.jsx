import { useCallback, useEffect, useMemo, useState } from 'react';
import { STAGES, stageScore, emptyState } from './lib/stages.js';
import { SAMPLES } from './lib/samples.js';
import { addFiles } from './lib/workspace.js';
import { buildBrief, buildBoardUpdate } from './lib/brief.js';
import Coach from './components/Coach.jsx';
import Workspace from './components/Workspace.jsx';
import EvidenceBoard from './components/EvidenceBoard.jsx';
import { EvidenceCtx } from './components/WorkspaceKit.jsx';
import QuestionStage from './stages/QuestionStage.jsx';
import DataStage from './stages/DataStage.jsx';
import KpiStage from './stages/KpiStage.jsx';
import AnalysisStage from './stages/AnalysisStage.jsx';
import DecisionStage from './stages/DecisionStage.jsx';
import MeasurementStage from './stages/MeasurementStage.jsx';
import PivotStage from './stages/PivotStage.jsx';

const STORE = 'decision-loop:v2';
const SCREENS = { question: QuestionStage, data: DataStage, kpi: KpiStage, analysis: AnalysisStage, decision: DecisionStage, measurement: MeasurementStage, pivot: PivotStage };

function load() {
  try {
    const raw = localStorage.getItem(STORE);
    if (!raw) return null;
    const saved = JSON.parse(raw);
    const base = emptyState();
    const st = saved.state || {};
    return {
      stageId: saved.stageId,
      state: { ...base, ...st, data: { ...base.data, ...st.data }, analysis: { ...base.analysis, ...st.analysis }, decision: { ...base.decision, ...st.decision }, evidence: st.evidence || [] },
    };
  } catch { return null; }
}

export default function App() {
  const saved = useMemo(load, []);
  const [state, setState] = useState(saved?.state || emptyState());
  const [stageId, setStageId] = useState(saved?.stageId || 'question');
  const startEmpty = !Object.keys((saved?.state || emptyState()).data.files).length;
  // First visit (or nothing loaded yet): open on the CRM workspace with the example case so the app is never an empty shell.
  const [mode, setMode] = useState(startEmpty ? 'workspace' : 'loop');
  const [booting, setBooting] = useState(startEmpty);
  const [panel, setPanel] = useState(null); // 'evidence' | 'brief' | 'board' | 'about'
  const [saveWarn, setSaveWarn] = useState(false);
  const [welcome, setWelcome] = useState(!saved);

  useEffect(() => {
    const t = setTimeout(() => {
      try {
        localStorage.setItem(STORE, JSON.stringify({ state, stageId }));
        setSaveWarn(false);
      } catch {
        setSaveWarn(true); // Usually a very large dataset exceeding browser storage.
      }
    }, 400);
    return () => clearTimeout(t);
  }, [state, stageId]);

  useEffect(() => {
    if (!startEmpty) return;
    loadSample('northstar').catch(() => {}).finally(() => setBooting(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const update = useCallback((section, patch) => setState((s) => ({ ...s, [section]: { ...s[section], ...patch } })), []);

  const pin = useCallback((e) => {
    setState((s) => {
      const exists = s.evidence.find((x) => x.file === e.file && x.label === e.label);
      if (exists) return { ...s, evidence: s.evidence.filter((x) => x !== exists) };
      return { ...s, evidence: [...s.evidence, { ...e, id: `e${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}` }] };
    });
  }, []);
  const isPinned = useCallback((file, label) => state.evidence.some((x) => x.file === file && x.label === label), [state.evidence]);

  async function loadSample(id) {
    const s = SAMPLES.find((x) => x.id === id);
    const built = await s.build();
    setState((prev) => {
      const fresh = emptyState();
      const data = addFiles({ ...fresh.data, source: built.source, asOf: built.asOf }, built.files);
      return { ...fresh, question: { ...fresh.question, ...built.question }, data: { ...data, active: built.files[0].key }, kpis: built.kpis || [] };
    });
    setWelcome(false);
  }

  const [armReset, setArmReset] = useState(false);
  function reset() {
    if (!armReset) { setArmReset(true); setTimeout(() => setArmReset(false), 4000); return; }
    setArmReset(false);
    setState(emptyState());
    setStageId('question');
    setMode('loop');
    setWelcome(true);
  }

  function restartLoop() {
    setState((s) => {
      const fresh = emptyState();
      const learned = [s.pivot.learnings && `Previous loop learned: ${s.pivot.learnings}`, s.decision.choice && `Previous decision: ${s.decision.choice} (${s.pivot.status || 'status not set'}).`].filter(Boolean).join(' ');
      return { ...fresh, data: s.data, kpis: s.kpis, evidence: s.evidence, question: { ...fresh.question, context: learned } };
    });
    setStageId('question');
    window.scrollTo({ top: 0 });
  }

  const idx = STAGES.findIndex((s) => s.id === stageId);
  const stage = STAGES[idx];
  const Screen = SCREENS[stageId];
  const go = (id) => { setStageId(id); setMode('loop'); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const fileCount = Object.keys(state.data.files).length;
  const isExample = (state.data.source || '').startsWith('Northstar case pack');

  return (
    <EvidenceCtx.Provider value={{ pin, isPinned }}>
      <div className="app">
        <header className="topbar">
          <div className="brand" onClick={() => setPanel('about')} role="button" tabIndex={0}>
            <LoopMark />
            <div>
              <strong>Decision Loop</strong>
              <span>Management judgment, guided</span>
            </div>
          </div>
          <div className="mode-toggle" role="tablist" aria-label="View">
            <button role="tab" aria-selected={mode === 'loop'} className={mode === 'loop' ? 'on' : ''} onClick={() => setMode('loop')}>Decision Loop</button>
            <button role="tab" aria-selected={mode === 'workspace'} className={mode === 'workspace' ? 'on' : ''} onClick={() => setMode('workspace')}>
              CRM Workspace{fileCount ? <span className="count">{fileCount}</span> : null}
            </button>
          </div>
          <div className="top-actions">
            <button className="btn small" onClick={() => setPanel('evidence')}>Evidence <span className="count">{state.evidence.length}</span></button>
            <button className="btn small" onClick={() => setPanel('board')}>Board update</button>
            <button className="btn small" onClick={() => setPanel('brief')}>Decision brief</button>
            <button className={`btn small ${armReset ? '' : 'ghost'}`} onClick={reset}>{armReset ? 'Click again to clear' : 'Reset'}</button>
          </div>
        </header>

        {saveWarn && <div className="banner warn">Your data is too large to auto-save in this browser. Export your brief before closing the tab.</div>}

        {welcome && mode === 'loop' && (
          <section className="welcome">
            <div>
              <span className="eyebrow">Not a chatbot. A process.</span>
              <h1>Make the call — and know why you made it.</h1>
              <p>Decision Loop walks you through the seven moves of a sound management decision. The tool does the arithmetic and the charts. You do the judgment: framing the question, choosing what to measure, weighing evidence, committing, and deciding in advance what would make you change course.</p>
              <div className="welcome-actions">
                <button className="btn primary" onClick={() => loadSample('northstar').then(() => setMode('workspace'))}>Explore the Northstar case</button>
                <button className="btn" onClick={() => setWelcome(false)}>Start with my own decision</button>
              </div>
            </div>
            <LoopDiagram />
          </section>
        )}

        {mode === 'workspace' ? (
          <main className="ws-main">
            {isExample && (
              <div className="example-banner">
                <div>
                  <strong>You are viewing example data.</strong> Northstar Learning Systems is a fictional B2B SaaS company (10 linked CSVs). Explore it like a CRM, then take it through the Decision Loop.
                </div>
                <div className="row tight">
                  <button className="btn small primary" onClick={() => go('question')}>Start the Decision Loop</button>
                  <button className="btn small" onClick={() => go('data')}>Load my own files</button>
                </div>
              </div>
            )}
            {booting ? <div className="ws-empty"><p className="muted">Loading the example case…</p></div> : <Workspace state={state} onGoToLoop={go} />}
          </main>
        ) : (
          <div className="layout">
            <nav className="stepper" aria-label="Decision stages">
              {STAGES.map((s, i) => {
                const sc = stageScore(s, state);
                const pctDone = sc.done / sc.total;
                return (
                  <button key={s.id} className={`step ${s.id === stageId ? 'on' : ''} ${pctDone === 1 ? 'done' : ''}`} onClick={() => go(s.id)} aria-current={s.id === stageId ? 'step' : undefined}>
                    <span className="step-num">{pctDone === 1 ? '✓' : i + 1}</span>
                    <span className="step-text">
                      <strong>{s.label}</strong>
                      <span className="step-bar"><span style={{ width: `${pctDone * 100}%` }} /></span>
                    </span>
                  </button>
                );
              })}
              <div className="step-loop" aria-hidden="true">↺ back to Question</div>
            </nav>

            <main className="content">
              <Screen
                state={state}
                update={update}
                setState={setState}
                stage={stage}
                loadSample={loadSample}
                openWorkspace={() => setMode('workspace')}
                restartLoop={restartLoop}
              />
              <div className="stage-nav">
                {idx > 0 ? <button className="btn" onClick={() => go(STAGES[idx - 1].id)}>← {STAGES[idx - 1].label}</button> : <span />}
                {idx < STAGES.length - 1 && <button className="btn primary" onClick={() => go(STAGES[idx + 1].id)}>{STAGES[idx + 1].label} →</button>}
              </div>
            </main>

            <Coach stage={stage} state={state} />
          </div>
        )}

        <footer className="footer">
          <span>Your data stays in your browser. Decision Loop computes; you decide.</span>
          <button className="link" onClick={() => setPanel('about')}>How this works</button>
        </footer>

        {panel && (
          <div className="drawer-backdrop" onClick={() => setPanel(null)}>
            <aside className={`drawer ${panel === 'brief' || panel === 'board' ? 'wide' : ''}`} onClick={(e) => e.stopPropagation()}>
              <header>
                <h2>{{ evidence: 'Evidence', brief: 'Decision brief', board: 'Board update', about: 'How Decision Loop works' }[panel]}</h2>
                <button className="icon-btn" onClick={() => setPanel(null)} aria-label="Close">✕</button>
              </header>
              {panel === 'evidence' && <EvidenceBoard state={state} setState={setState} compact />}
              {panel === 'brief' && <Export md={buildBrief(state)} filename="decision-brief.md" />}
              {panel === 'board' && <Export md={buildBoardUpdate(state)} filename="board-update.md" intro="A one-page answer built from your Analysis, Decision and Pivot steps. Empty lines mean a step still needs your judgment." />}
              {panel === 'about' && <About />}
            </aside>
          </div>
        )}
      </div>
    </EvidenceCtx.Provider>
  );
}

function Export({ md, filename, intro }) {
  const [copied, setCopied] = useState(false);
  const download = () => {
    const url = URL.createObjectURL(new Blob([md], { type: 'text/markdown' }));
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(md); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* ignore */ }
  };
  return (
    <div className="export">
      {intro && <p className="muted">{intro}</p>}
      <div className="row tight">
        <button className="btn primary small" onClick={download}>Download .md</button>
        <button className="btn small" onClick={copy}>{copied ? 'Copied' : 'Copy'}</button>
        <button className="btn small" onClick={() => printMarkdown(md)}>Print / Save as PDF</button>
      </div>
      <div className="md-preview" dangerouslySetInnerHTML={{ __html: mdToHtml(md) }} />
    </div>
  );
}

function About() {
  return (
    <div className="about">
      <p>Most “AI for data” tools invite you to upload a spreadsheet and ask for an answer. That skips the part that makes a manager good at the job: deciding what question matters, what evidence counts, and what you will do when the results come in.</p>
      <ol>
        {STAGES.map((s) => <li key={s.id}><strong>{s.label}.</strong> {s.principle}</li>)}
      </ol>
      <p><strong>The CRM workspace</strong> recognizes common business files — accounts, opportunities, marketing campaigns, product usage, monthly financials, team and hiring plans, plan scenarios — and gives each a CRM-style view. Pin any number to your evidence board; the board feeds your analysis and your board update.</p>
      <p><strong>Privacy.</strong> Files are parsed in your browser and saved only in this browser’s local storage. If the optional AI coach is enabled on this deployment, it receives what you wrote and summary numbers — never your raw rows.</p>
    </div>
  );
}

// Minimal Markdown → HTML for the preview (headings, bold, italics, lists, tables).
function esc(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function inline(s) { return esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/(^|\s)_(.+?)_(?=\s|$)/g, '$1<em>$2</em>'); }
export function mdToHtml(md) {
  const lines = md.split('\n');
  const out = [];
  let list = null;
  let table = null;
  const closeList = () => { if (list) { out.push(`</${list}>`); list = null; } };
  const closeTable = () => { if (table) { out.push('</tbody></table>'); table = null; } };
  for (const raw of lines) {
    const line = raw.replace(/\s+$/, '');
    if (/^\|/.test(line)) {
      closeList();
      const cells = line.split('|').slice(1, -1).map((c) => c.trim());
      if (cells.every((c) => /^-+$/.test(c))) continue;
      if (!table) { out.push(`<table><thead><tr>${cells.map((c) => `<th>${inline(c)}</th>`).join('')}</tr></thead><tbody>`); table = true; }
      else out.push(`<tr>${cells.map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`);
      continue;
    }
    closeTable();
    let m;
    if ((m = line.match(/^(#{1,4})\s+(.*)/))) { closeList(); out.push(`<h${m[1].length}>${inline(m[2])}</h${m[1].length}>`); }
    else if ((m = line.match(/^\s*-\s+(.*)/))) { if (list !== 'ul') { closeList(); out.push('<ul>'); list = 'ul'; } out.push(`<li>${inline(m[1])}</li>`); }
    else if ((m = line.match(/^\d+\.\s+(.*)/))) { if (list !== 'ol') { closeList(); out.push('<ol>'); list = 'ol'; } out.push(`<li>${inline(m[1])}</li>`); }
    else if (/^---$/.test(line)) { closeList(); out.push('<hr/>'); }
    else if (line.trim() === '') { closeList(); }
    else { closeList(); out.push(`<p>${inline(line)}</p>`); }
  }
  closeList(); closeTable();
  return out.join('\n');
}

function printMarkdown(md) {
  const w = window.open('', '_blank');
  if (!w) return;
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Decision Loop</title><style>body{font:14px/1.55 Georgia,serif;max-width:760px;margin:40px auto;padding:0 24px;color:#1b1b1b}h1,h2,h3{font-family:Helvetica,Arial,sans-serif}table{border-collapse:collapse;width:100%;font:12px Helvetica,Arial,sans-serif}th,td{border:1px solid #ccc;padding:5px 7px;text-align:left}</style></head><body>${mdToHtml(md)}</body></html>`);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 300);
}

function LoopMark() {
  return (
    <svg viewBox="0 0 32 32" width="34" height="34" aria-hidden="true">
      <rect width="32" height="32" rx="8" className="mark-bg" />
      <path d="M16 7a9 9 0 1 1-8.5 6" fill="none" className="mark-fg" strokeWidth="3" strokeLinecap="round" />
      <path d="M5 9l2.5 4.5L12 11" fill="none" className="mark-fg" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function LoopDiagram() {
  const n = STAGES.length;
  const R = 118, cx = 160, cy = 150;
  return (
    <svg className="loop-diagram" viewBox="0 0 320 300" role="img" aria-label="The seven-stage decision loop">
      <circle cx={cx} cy={cy} r={R} className="loop-ring" />
      {STAGES.map((s, i) => {
        const ang = -Math.PI / 2 + (i * 2 * Math.PI) / n;
        const x = cx + R * Math.cos(ang), y = cy + R * Math.sin(ang);
        return (
          <g key={s.id}>
            <circle cx={x} cy={y} r="24" className={`loop-node ${i === 4 ? 'key' : ''}`} />
            <text x={x} y={y + 4} textAnchor="middle" className="loop-label">{s.label.length > 8 ? s.label.slice(0, 7) + '.' : s.label}</text>
          </g>
        );
      })}
      <text x={cx} y={cy - 6} textAnchor="middle" className="loop-center">You decide.</text>
      <text x={cx} y={cy + 14} textAnchor="middle" className="loop-center-sub">The tool keeps you honest.</text>
    </svg>
  );
}
