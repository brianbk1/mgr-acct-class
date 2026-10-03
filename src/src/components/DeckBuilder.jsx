import { useEffect, useMemo, useState } from 'react';
import { LineChart, BarChart } from './Charts.jsx';
import { Badge } from './WorkspaceKit.jsx';
import {
  availableCharts, chartData, newDeck, parseOutline, buildAiPrompt, citations, TEMPLATES, slideId, fmtUnit,
} from '../lib/deck.js';

const kpiFor = (unit) => (unit === '%' ? { agg: 'ratio', asPercent: true } : unit === '$' ? { unit: '$' } : {});

export default function DeckBuilder({ state, setState, goToCrm }) {
  const deck = state.deck;
  const hasData = Object.keys(state.data.files).length > 0;

  useEffect(() => {
    if (!deck && hasData) setState((s) => ({ ...s, deck: newDeck(s, 'board') }));
  }, [deck, hasData, setState]);

  const [sel, setSel] = useState(null);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState(null);
  const [paste, setPaste] = useState('');
  const [showPrompt, setShowPrompt] = useState(false);
  const [armTemplate, setArmTemplate] = useState('');

  const charts = useMemo(() => availableCharts(state), [state]);
  const prompt = useMemo(() => (deck ? buildAiPrompt(state, deck) : ''), [state, deck]);
  const cites = useMemo(() => (deck ? citations(deck, state) : { points: 0, files: 0 }), [deck, state]);

  if (!hasData) {
    return (
      <div className="ws-empty">
        <h2>Load data first</h2>
        <p>The deck is built from the CRM data. Load the Northstar case or your own CSV files, then come back here.</p>
        <button className="btn primary" onClick={goToCrm}>Go to the CRM</button>
      </div>
    );
  }
  if (!deck) return null;

  const setDeck = (fn) => setState((s) => ({ ...s, deck: fn(s.deck) }));
  const patchDeck = (p) => setDeck((d) => ({ ...d, ...p }));
  const patchSlide = (id, p) => setDeck((d) => ({ ...d, slides: d.slides.map((x) => (x.id === id ? { ...x, ...p } : x)) }));
  const selected = deck.slides.find((x) => x.id === sel) || deck.slides.find((x) => x.kind === 'content') || deck.slides[0];
  const content = deck.slides.filter((x) => x.kind === 'content');
  const unverified = content.filter((x) => !x.verified).length;
  const citeOk = cites.points >= 5 && cites.files >= 3;

  function move(id, dir) {
    setDeck((d) => {
      const arr = [...d.slides];
      const i = arr.findIndex((x) => x.id === id);
      const j = i + dir;
      if (arr[i].kind !== 'content' || !arr[j] || arr[j].kind !== 'content') return d;
      [arr[i], arr[j]] = [arr[j], arr[i]];
      return { ...d, slides: arr };
    });
  }
  function addSlide() {
    const s = { id: slideId(), kind: 'content', title: 'New slide', bullets: [''], chart: '', notes: '', verified: false };
    setDeck((d) => {
      const arr = [...d.slides];
      const ev = arr.findIndex((x) => x.kind === 'evidence');
      arr.splice(ev >= 0 ? ev : arr.length, 0, s);
      return { ...d, slides: arr };
    });
    setSel(s.id);
  }
  function removeSlide(id) {
    setDeck((d) => ({ ...d, slides: d.slides.filter((x) => x.id !== id) }));
    setSel(null);
  }
  function applyTemplate(t) {
    if (armTemplate !== t) { setArmTemplate(t); setTimeout(() => setArmTemplate(''), 4000); return; }
    setArmTemplate('');
    const fresh = newDeck(state, t);
    setDeck((d) => ({ ...fresh, title: d.title, subtitle: d.subtitle, presenters: d.presenters }));
    setSel(null);
  }
  function importOutline(text, source) {
    const parsed = parseOutline(text, state);
    if (!parsed.slides.length) {
      setMsg({ kind: 'warn', text: 'No slides found. Each slide should start with a line like “## Slide title”, followed by “- ” bullets.' });
      return false;
    }
    setDeck((d) => {
      const title = d.slides.find((x) => x.kind === 'title') || { id: slideId(), kind: 'title' };
      const ev = d.slides.find((x) => x.kind === 'evidence');
      return { ...d, title: parsed.title || d.title, slides: [title, ...parsed.slides, ...(ev ? [ev] : [])] };
    });
    setSel(parsed.slides[0].id);
    setMsg({ kind: 'tip', text: `${parsed.slides.length} slides drafted ${source}. Now check every number against the CRM tabs and tick “Verified” on each slide.` });
    return true;
  }

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(prompt);
      setMsg({ kind: 'tip', text: 'Copied. Paste it into ChatGPT, Claude, Copilot or Gemini, then paste the answer into box 2.' });
    } catch {
      setShowPrompt(true);
      setMsg({ kind: 'note', text: 'Your browser blocked copying. The prompt is shown below — select all of it and copy it manually.' });
    }
  }

  async function draftWithAi() {
    setBusy('ai'); setMsg(null);
    try {
      const res = await fetch('/api/deck', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'The built-in AI is not available on this site. Use steps 1 and 2 with any AI tool instead.');
      importOutline(data.text, 'by the built-in AI');
    } catch (e) {
      setMsg({ kind: 'warn', text: e.message });
    }
    setBusy('');
  }

  async function download(kind) {
    setBusy(kind); setMsg(null);
    try {
      const ex = await import('../lib/exporters.js');
      if (kind === 'pptx') await ex.exportPptx(deck, state);
      else await ex.exportPdf(deck, state);
      setMsg({ kind: 'tip', text: `${kind === 'pptx' ? 'PowerPoint' : 'PDF'} downloaded.${unverified ? ` Reminder: ${unverified} slide${unverified > 1 ? 's are' : ' is'} not marked as verified.` : ''}` });
    } catch (e) {
      setMsg({ kind: 'warn', text: `Download failed: ${e.message || e}. If you are viewing a preview link, open the published site instead.` });
    }
    setBusy('');
  }

  return (
    <div className="deck">
      <section className="deck-head">
        <div className="deck-meta">
          <label className="field"><span className="field-label">Presentation title</span>
            <input id="deck-title" value={deck.title} onChange={(e) => patchDeck({ title: e.target.value })} />
          </label>
          <label className="field"><span className="field-label">Subtitle</span>
            <input id="deck-subtitle" value={deck.subtitle} onChange={(e) => patchDeck({ subtitle: e.target.value })} />
          </label>
          <label className="field"><span className="field-label">Team / presenters</span>
            <input id="deck-presenters" value={deck.presenters} placeholder="e.g. Team 3: Alvarez, Chen, Okafor, Smith" onChange={(e) => patchDeck({ presenters: e.target.value })} />
          </label>
        </div>
        <div className="deck-downloads">
          <button className="btn primary" onClick={() => download('pptx')} disabled={!!busy}>{busy === 'pptx' ? 'Building…' : 'Download PowerPoint'}</button>
          <button className="btn" onClick={() => download('pdf')} disabled={!!busy}>{busy === 'pdf' ? 'Building…' : 'Download PDF'}</button>
        </div>
      </section>

      <section className="deck-ai">
        <div className="deck-ai-step">
          <span className="step-badge">1</span>
          <div>
            <strong>Give the AI the data</strong>
            <p className="muted small">Copies a prompt with every key number from the CRM tabs (and your pinned evidence), plus the questions your deck must answer.</p>
            <div className="row tight">
              <button className="btn small primary" onClick={copyPrompt}>Copy data + prompt</button>
              <button className="link small" onClick={() => setShowPrompt((v) => !v)}>{showPrompt ? 'Hide' : 'Show'} prompt</button>
            </div>
          </div>
        </div>
        <div className="deck-ai-step">
          <span className="step-badge">2</span>
          <div>
            <strong>Paste the AI’s answer</strong>
            <textarea id="deck-paste" rows={3} value={paste} placeholder={'## Is the 2027 growth plan realistic?\n- …'} onChange={(e) => setPaste(e.target.value)} />
            <div className="row tight">
              <button className="btn small primary" onClick={() => importOutline(paste, 'from your AI answer') && setPaste('')} disabled={!paste.trim()}>Build slides</button>
              <span className="muted small">or</span>
              <button className="btn small" onClick={draftWithAi} disabled={!!busy}>{busy === 'ai' ? 'Drafting…' : 'Draft with built-in AI'}</button>
            </div>
          </div>
        </div>
        <div className="deck-ai-step">
          <span className="step-badge">3</span>
          <div>
            <strong>Check it — you own the numbers</strong>
            <ul className="deck-checks">
              <li className={citeOk ? 'ok' : ''}><span className="gate-dot">{citeOk ? '✓' : ''}</span>{cites.points} cited data points from {cites.files} files <span className="muted">(need 5 from 3)</span></li>
              <li className={unverified === 0 && content.length ? 'ok' : ''}><span className="gate-dot">{unverified === 0 && content.length ? '✓' : ''}</span>{content.length - unverified} of {content.length} slides verified against the CRM</li>
            </ul>
            <p className="muted small">A bullet counts as cited when it contains a number and names its source file, e.g. “(accounts.csv)”.</p>
          </div>
        </div>
      </section>

      {showPrompt && <textarea className="prompt-box" readOnly value={prompt} rows={12} onFocus={(e) => e.target.select()} />}
      {msg && <div className={`callout ${msg.kind}`}><div>{msg.text}</div></div>}

      <div className="deck-body">
        <aside className="slide-list" aria-label="Slides">
          {deck.slides.map((s, i) => (
            <button key={s.id} className={`slide-thumb ${selected?.id === s.id ? 'on' : ''}`} onClick={() => setSel(s.id)}>
              <span className="thumb-num">{i + 1}</span>
              <span className="thumb-title">{s.kind === 'title' ? 'Title slide' : s.title || 'Untitled'}</span>
              {s.kind === 'content' && (s.verified ? <Badge tone="good">✓</Badge> : s.fromAi ? <Badge tone="warn">AI</Badge> : null)}
            </button>
          ))}
          <button className="btn ghost small" onClick={addSlide}>+ Add slide</button>
          <div className="template-pick">
            <span className="muted small">Start over from a template</span>
            {Object.entries(TEMPLATES).map(([k, t]) => (
              <button key={k} className="link small" onClick={() => applyTemplate(k)}>{armTemplate === k ? `Click again to replace all slides` : t.label}</button>
            ))}
          </div>
        </aside>

        <div className="slide-work">
          {selected && <SlidePreview slide={selected} deck={deck} state={state} index={deck.slides.indexOf(selected)} />}

          {selected?.kind === 'content' && (
            <div className="slide-editor">
              <div className="row tight">
                <button className="btn small" onClick={() => move(selected.id, -1)} aria-label="Move slide up">↑</button>
                <button className="btn small" onClick={() => move(selected.id, 1)} aria-label="Move slide down">↓</button>
                <button className="btn ghost small" onClick={() => removeSlide(selected.id)}>Delete slide</button>
                <label className={`verify ${selected.verified ? 'on' : ''}`}>
                  <input type="checkbox" checked={!!selected.verified} onChange={(e) => patchSlide(selected.id, { verified: e.target.checked })} />
                  Verified: every number on this slide matches the CRM
                </label>
              </div>
              <label className="field"><span className="field-label">Slide title</span>
                <input id={`title-${selected.id}`} value={selected.title} onChange={(e) => patchSlide(selected.id, { title: e.target.value })} />
              </label>
              {selected.hint && <p className="muted small hint">Answer this: {selected.hint}</p>}
              <label className="field"><span className="field-label">Bullets <span className="muted small">(one per line — keep to 3–5)</span></span>
                <textarea id={`bullets-${selected.id}`} rows={6} value={(selected.bullets || []).join('\n')} onChange={(e) => patchSlide(selected.id, { bullets: e.target.value.split('\n') })} />
              </label>
              {(state.evidence || []).length > 0 && (
                <div className="ev-insert">
                  <span className="field-label">Insert pinned evidence</span>
                  <div className="chips">
                    {state.evidence.map((e) => (
                      <button key={e.id} className="chip-btn" onClick={() => patchSlide(selected.id, { bullets: [...(selected.bullets || []).filter((b) => b.trim()), `${e.label}: ${e.value} (${e.fileName})`] })}>
                        + {e.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="row">
                <label className="field"><span className="field-label">Chart</span>
                  <select id={`chart-${selected.id}`} value={selected.chart || ''} onChange={(e) => patchSlide(selected.id, { chart: e.target.value })}>
                    <option value="">No chart</option>
                    {charts.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </select>
                </label>
                <label className="field"><span className="field-label">Speaker notes</span>
                  <input id={`notes-${selected.id}`} value={selected.notes || ''} placeholder="What you will say on this slide" onChange={(e) => patchSlide(selected.id, { notes: e.target.value })} />
                </label>
              </div>
            </div>
          )}
          {selected?.kind === 'title' && <p className="muted small">Edit the title, subtitle and presenters at the top of the page.</p>}
          {selected?.kind === 'evidence' && (
            <p className="muted small">This slide lists every data point you pinned in the CRM tabs ({(state.evidence || []).length} so far). Pin more with the pin icon on any number. <button className="link small" onClick={goToCrm}>Open the CRM →</button></p>
          )}
        </div>
      </div>
    </div>
  );
}

function SlidePreview({ slide, deck, state, index }) {
  if (slide.kind === 'title') {
    return (
      <div className="slide-canvas title-slide">
        <div className="title-bar" />
        <div>
          <h2>{deck.title}</h2>
          <p className="sub">{deck.subtitle}</p>
          <p className="meta">{[deck.presenters, new Date().toLocaleDateString()].filter(Boolean).join(' · ')}</p>
        </div>
      </div>
    );
  }
  if (slide.kind === 'evidence') {
    const ev = state.evidence || [];
    return (
      <div className="slide-canvas">
        <h3 className="slide-h">{slide.title}</h3>
        <div className="slide-rule" />
        {ev.length ? (
          <table className="slide-table">
            <thead><tr><th>Data point</th><th>Value</th><th>Source</th></tr></thead>
            <tbody>{ev.slice(0, 10).map((e) => <tr key={e.id}><td>{e.label}</td><td>{e.value}</td><td>{e.fileName}</td></tr>)}</tbody>
          </table>
        ) : <p className="muted">No evidence pinned yet.</p>}
        <SlideFooter n={index + 1} total={deck.slides.length} source="" />
      </div>
    );
  }
  const chart = slide.chart ? chartData(slide.chart, state) : null;
  const bullets = (slide.bullets || []).filter((b) => b.trim());
  return (
    <div className="slide-canvas">
      <h3 className="slide-h">{slide.title}</h3>
      <div className="slide-rule" />
      <div className={`slide-cols ${chart ? 'with-chart' : ''}`}>
        <ul className="slide-bullets">
          {bullets.length ? bullets.map((b, i) => <li key={i}>{b}</li>) : <li className="placeholder">{slide.hint || 'Add bullets'}</li>}
        </ul>
        {chart && (
          <div className="slide-chart">
            <div className="slide-chart-title">{chart.title}</div>
            {chart.type === 'line'
              ? <LineChart series={chart.labels.map((l, i) => ({ label: l, value: chart.values[i] }))} kpi={kpiFor(chart.unit)} target={chart.reference ? chart.reference.value : ''} targetLabel={chart.reference?.label || ''} height={200} zero={chart.unit === '$'} />
              : <BarChart data={chart.labels.map((l, i) => ({ label: l, value: chart.values[i], n: 1 }))} kpi={kpiFor(chart.unit === 'x' ? '' : chart.unit)} />}
            {(chart.note || chart.reference) && <div className="slide-chart-note">{[chart.reference && `${chart.reference.label}: ${fmtUnit(chart.reference.value, chart.unit)}`, chart.note].filter(Boolean).join(' · ')}</div>}
          </div>
        )}
      </div>
      <SlideFooter n={index + 1} total={deck.slides.length} source={chart?.source} />
    </div>
  );
}

function SlideFooter({ n, total, source }) {
  return (
    <div className="slide-foot">
      <span>{source ? `Source: ${source}` : ''}</span>
      <span>{n} / {total}</span>
    </div>
  );
}
