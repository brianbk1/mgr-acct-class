import { useEffect, useMemo, useState } from 'react';
import SlideSvg from './SlideSvg.jsx';
import { Badge } from './WorkspaceKit.jsx';
import { LAYOUTS } from '../lib/slides/layouts.js';
import {
  availableCharts, newDeck, parseAiDeck, buildAiPrompt, citations, TEMPLATES, slideId, autoScorecard, metricOptions,
} from '../lib/deck.js';

// Downscale an uploaded image so it fits comfortably in browser storage and the exported files.
function readImage(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onerror = () => reject(new Error('Could not read that image.'));
    r.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('That file is not an image the browser can read.'));
      img.onload = () => {
        const scale = Math.min(1, 1600 / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(img, 0, 0, c.width, c.height);
        resolve({ src: c.toDataURL('image/jpeg', 0.82), w: c.width, h: c.height });
      };
      img.src = r.result;
    };
    r.readAsDataURL(file);
  });
}

function words(s) { return String(s || '').trim().split(/\s+/).filter(Boolean).length; }

export default function DeckBuilder({ state, setState, goToCrm }) {
  const deck = state.deck;
  const hasData = Object.keys(state.data.files).length > 0;
  const outdated = deck && deck.slides.some((s) => s.kind === 'content' && !s.layout);

  useEffect(() => {
    if ((!deck || outdated) && hasData) setState((s) => ({ ...s, deck: newDeck(s, 'board') }));
  }, [deck, outdated, hasData, setState]);

  const [sel, setSel] = useState(null);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState(null);
  const [paste, setPaste] = useState('');
  const [showPrompt, setShowPrompt] = useState(false);
  const [arm, setArm] = useState('');
  const [undo, setUndo] = useState(null);

  const charts = useMemo(() => availableCharts(state), [state]);
  const prompt = useMemo(() => (deck && !outdated ? buildAiPrompt(state, deck) : ''), [state, deck, outdated]);
  const cites = useMemo(() => (deck && !outdated ? citations(deck, state) : { points: 0, files: 0 }), [deck, state, outdated]);

  if (!hasData) {
    return (
      <div className="ws-empty">
        <h2>Load data first</h2>
        <p>The deck is built from the CRM data. Load the Northstar case or your own CSV files, then come back here.</p>
        <button className="btn primary" onClick={goToCrm}>Go to the CRM</button>
      </div>
    );
  }
  if (!deck || outdated) return null;

  const setDeck = (fn) => setState((s) => ({ ...s, deck: fn(s.deck) }));
  const patchDeck = (p) => setDeck((d) => ({ ...d, ...p }));
  const patchSlide = (id, p) => setDeck((d) => ({ ...d, slides: d.slides.map((x) => (x.id === id ? { ...x, ...p } : x)) }));
  const selected = deck.slides.find((x) => x.id === sel) || deck.slides[1] || deck.slides[0];
  const idx = deck.slides.indexOf(selected);
  const content = deck.slides.filter((x) => x.kind === 'content');
  const unverified = content.filter((x) => !x.verified).length;
  const citeOk = cites.points >= 5 && cites.files >= 3;

  const confirmArm = (key, fn) => {
    if (arm !== key) { setArm(key); setTimeout(() => setArm((a) => (a === key ? '' : a)), 4000); return; }
    setArm(''); fn();
  };

  function move(id, dir) {
    setDeck((d) => {
      const arr = [...d.slides];
      const i = arr.findIndex((x) => x.id === id), j = i + dir;
      if (arr[i]?.kind !== 'content' || arr[j]?.kind !== 'content') return d;
      [arr[i], arr[j]] = [arr[j], arr[i]];
      return { ...d, slides: arr };
    });
  }
  function addSlide(layout = 'cards') {
    const L = LAYOUTS[layout];
    const s = { id: slideId(), kind: 'content', layout, eyebrow: '', title: 'New slide', subtitle: '', takeaway: '', notes: '', verified: false, chart: '' };
    s[L.list.key] = L.list.strings ? [''] : [{ ...L.list.add }];
    if (L.spotlight) s.spotlight = {};
    setDeck((d) => {
      const arr = [...d.slides];
      const ev = arr.findIndex((x) => x.kind === 'evidence');
      arr.splice(ev >= 0 ? ev : arr.length, 0, s);
      return { ...d, slides: arr };
    });
    setSel(s.id);
  }
  function duplicate(s) {
    const copy = { ...JSON.parse(JSON.stringify(s)), id: slideId(), verified: false };
    setDeck((d) => { const arr = [...d.slides]; arr.splice(arr.indexOf(arr.find((x) => x.id === s.id)) + 1, 0, copy); return { ...d, slides: arr }; });
    setSel(copy.id);
  }
  function changeLayout(s, layout) {
    const L = LAYOUTS[layout];
    const p = { layout };
    if (!s[L.list.key] || !s[L.list.key].length) p[L.list.key] = layout === 'scorecard' ? autoScorecard(state) : L.list.strings ? [''] : [{ ...L.list.add }];
    if (L.spotlight && !s.spotlight) p.spotlight = {};
    patchSlide(s.id, p);
  }
  function importAi(text, source) {
    if (/DATA BRIEF \(computed from|SLIDES TO WRITE|OUTPUT: only a JSON object/.test(text) && !/"slides"\s*:/.test(text)) {
      setMsg({ kind: 'warn', text: 'That looks like the prompt from step 1, not the AI’s answer. Paste the prompt into ChatGPT, Claude, Copilot or Gemini first, then paste the AI’s reply here.' });
      return false;
    }
    const parsed = parseAiDeck(text, state);
    if (!parsed.slides.length) {
      setMsg({ kind: 'warn', text: 'No slides found in that text. Paste the AI’s whole answer, including the ```json block.' });
      return false;
    }
    setUndo(deck);
    setDeck((d) => {
      const title = d.slides.find((x) => x.kind === 'title') || { id: slideId(), kind: 'title' };
      const ev = d.slides.find((x) => x.kind === 'evidence');
      return { ...d, title: parsed.title || d.title, subtitle: parsed.subtitle || d.subtitle, health: parsed.health || d.health, slides: [title, ...parsed.slides, ...(ev ? [ev] : [])] };
    });
    setSel(parsed.slides[0].id);
    setMsg({ kind: 'tip', text: `${parsed.slides.length} slides drafted ${source}. AI drafts are marked “AI” until you check each number against the CRM and tick Verified.` });
    return true;
  }
  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(prompt);
      setMsg({ kind: 'tip', text: 'Copied. Paste it into ChatGPT, Claude, Copilot or Gemini, then paste the whole answer into box 2.' });
    } catch {
      setShowPrompt(true);
      setMsg({ kind: 'note', text: 'Your browser blocked copying. The prompt is shown below — click in it, select all, and copy.' });
    }
  }
  async function draftWithAi() {
    setBusy('ai'); setMsg(null);
    try {
      const res = await fetch('/api/deck', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'The built-in AI is not available on this site. Use steps 1 and 2 with any AI tool instead.');
      importAi(data.text, 'by the built-in AI');
    } catch (e) { setMsg({ kind: 'warn', text: e.message }); }
    setBusy('');
  }
  async function download(kind) {
    setBusy(kind); setMsg(null);
    try {
      const ex = await import('../lib/slides/backends.js');
      if (kind === 'pptx') await ex.exportPptx(deck, state); else await ex.exportPdf(deck, state);
      setMsg({ kind: 'tip', text: `${kind === 'pptx' ? 'PowerPoint' : 'PDF'} downloaded.${unverified ? ` ${unverified} slide${unverified > 1 ? 's are' : ' is'} not marked Verified yet.` : ''}` });
    } catch (e) {
      setMsg({ kind: 'warn', text: `Download failed: ${e.message || e}. If you are on a preview link, open the published site instead.` });
    }
    setBusy('');
  }

  return (
    <div className="deck">
      <section className="deck-ai">
        <div className="deck-ai-step">
          <span className="step-badge">1</span>
          <div>
            <strong>Copy the prompt into your AI tool</strong>
            <p className="muted small">Copies the CRM numbers, your pinned evidence and the slide plan. Paste it into ChatGPT, Claude, Copilot or Gemini.</p>
            <div className="row tight">
              <button className="btn small primary" onClick={copyPrompt}>Copy data + prompt</button>
              <button className="link small" onClick={() => setShowPrompt((v) => !v)}>{showPrompt ? 'Hide' : 'Show'} prompt</button>
            </div>
          </div>
        </div>
        <div className="deck-ai-step">
          <span className="step-badge">2</span>
          <div>
            <strong>Paste the AI’s reply here</strong>
            <textarea id="deck-paste" rows={3} value={paste} placeholder="Paste the whole reply, including the ```json block" onChange={(e) => setPaste(e.target.value)} />
            <div className="row tight">
              <button className="btn small primary" onClick={() => importAi(paste, 'from your AI answer') && setPaste('')} disabled={!paste.trim()}>Build slides</button>
              <span className="muted small">or</span>
              <button className="btn small" onClick={draftWithAi} disabled={!!busy}>{busy === 'ai' ? 'Drafting…' : 'Draft with built-in AI'}</button>
            </div>
          </div>
        </div>
        <div className="deck-ai-step">
          <span className="step-badge">3</span>
          <div>
            <strong>Check, edit, download</strong>
            <ul className="deck-checks">
              <li className={citeOk ? 'ok' : ''}><span className="gate-dot">{citeOk ? '✓' : ''}</span>{cites.points} data points cited in your slides, from {cites.files} files <span className="muted">(need 5 from 3; the pre-filled scorecard doesn’t count)</span></li>
              <li className={unverified === 0 && content.length ? 'ok' : ''}><span className="gate-dot">{unverified === 0 && content.length ? '✓' : ''}</span>{content.length - unverified} of {content.length} slides verified against the CRM</li>
            </ul>
            <div className="row tight">
              <button className="btn small primary" onClick={() => download('pptx')} disabled={!!busy}>{busy === 'pptx' ? 'Building…' : 'Download PowerPoint'}</button>
              <button className="btn small" onClick={() => download('pdf')} disabled={!!busy}>{busy === 'pdf' ? 'Building…' : 'Download PDF'}</button>
            </div>
          </div>
        </div>
      </section>

      {showPrompt && <textarea className="prompt-box" readOnly value={prompt} rows={12} onFocus={(e) => e.target.select()} />}
      {msg && (
        <div className={`callout ${msg.kind} with-action`}>
          <div>{msg.text}</div>
          {undo && msg.kind === 'tip' && <button className="btn small" onClick={() => { setState((st) => ({ ...st, deck: undo })); setUndo(null); setSel(null); setMsg({ kind: 'note', text: 'Restored your previous slides.' }); }}>Undo</button>}
        </div>
      )}

      <div className="deck-body">
        <aside className="filmstrip" aria-label="Slides">
          {deck.slides.map((s, i) => (
            <button key={s.id} className={`film ${selected?.id === s.id ? 'on' : ''}`} onClick={() => setSel(s.id)}>
              <span className="film-num">{i + 1}</span>
              <span className="film-img"><SlideSvg slide={s} deck={deck} state={state} n={i + 1} total={deck.slides.length} /></span>
              {s.kind === 'content' && (s.verified ? <Badge tone="good">✓</Badge> : s.fromAi ? <Badge tone="warn">AI</Badge> : null)}
            </button>
          ))}
          <div className="add-slide">
            <select id="add-layout" defaultValue="" onChange={(e) => { if (e.target.value) { addSlide(e.target.value); e.target.value = ''; } }}>
              <option value="">+ Add slide…</option>
              {Object.entries(LAYOUTS).map(([k, l]) => <option key={k} value={k}>{l.label}</option>)}
            </select>
          </div>
          <div className="template-pick">
            <span className="muted small">Start over from a template</span>
            {Object.entries(TEMPLATES).map(([k, t]) => (
              <button key={k} className="link small" onClick={() => confirmArm(`t-${k}`, () => { const fresh = newDeck(state, k); setDeck((d) => ({ ...fresh, title: d.title, subtitle: d.subtitle, presenters: d.presenters, health: d.health })); setSel(null); })}>
                {arm === `t-${k}` ? 'Click again to replace all slides' : t.label}
              </button>
            ))}
          </div>
        </aside>

        <div className="slide-work">
          <div className="slide-stage">
            <SlideSvg slide={selected} deck={deck} state={state} n={idx + 1} total={deck.slides.length} />
          </div>

          {selected.kind === 'title' && <TitleEditor deck={deck} patchDeck={patchDeck} onError={(t) => setMsg({ kind: 'warn', text: t })} />}
          {selected.kind === 'evidence' && (
            <p className="muted small">Lists every number you pinned in the CRM tabs ({(state.evidence || []).length} so far). <button className="link small" onClick={goToCrm}>Pin more in the CRM →</button></p>
          )}
          {selected.kind === 'content' && (
            <SlideEditor
              slide={selected} charts={charts} state={state} metrics={metricOptions(state)} onError={(t) => setMsg({ kind: 'warn', text: t })} patch={(p) => patchSlide(selected.id, p)}
              onMove={(d) => move(selected.id, d)} onDuplicate={() => duplicate(selected)}
              onDelete={() => confirmArm(`del-${selected.id}`, () => { setDeck((d) => ({ ...d, slides: d.slides.filter((x) => x.id !== selected.id) })); setSel(null); })}
              deleteArmed={arm === `del-${selected.id}`} onLayout={(l) => changeLayout(selected, l)}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function TitleEditor({ deck, patchDeck, onError }) {
  const F = (k, label, ph) => (
    <label className="field"><span className="field-label">{label}</span>
      <input id={`deck-${k}`} value={deck[k] || ''} placeholder={ph} onChange={(e) => patchDeck({ [k]: e.target.value })} />
    </label>
  );
  return (
    <div className="slide-editor">
      <div className="row">{F('title', 'Presentation title')}{F('subtitle', 'Subtitle', 'e.g. January – September 2026 review')}</div>
      <div className="row three">
        {F('company', 'Company')}
        {F('audience', 'Audience', 'Board of Directors')}
        <label className="field"><span className="field-label">Business health</span>
          <select id="deck-health" value={deck.health || ''} onChange={(e) => patchDeck({ health: e.target.value })}>
            <option value="">Not shown</option><option>Green</option><option>Yellow</option><option>Red</option>
          </select>
        </label>
      </div>
      <div className="row">{F('presenters', 'Team / presenters', 'Team 3: Alvarez, Chen, Okafor')}{F('date', 'Date')}</div>
      {F('sourceNote', 'Source line')}
      <ImagePicker label="Cover image (optional — shown on the right of the title slide)" src={deck.image} onPick={(img) => patchDeck({ image: img.src, imageW: img.w, imageH: img.h })} onClear={() => patchDeck({ image: '', imageW: 0, imageH: 0 })} onError={onError} />
      <label className="inline-check field"><input type="checkbox" checked={!!deck.confidential} onChange={(e) => patchDeck({ confidential: e.target.checked })} /> Mark slides “Confidential”</label>
    </div>
  );
}

function SlideEditor({ slide, charts, metrics, onError, patch, onMove, onDuplicate, onDelete, deleteArmed, onLayout }) {
  const L = LAYOUTS[slide.layout] || LAYOUTS.bullets;
  const list = slide[L.list.key] || [];
  const setList = (next) => patch({ [L.list.key]: next });
  const sp = slide.spotlight || {};

  return (
    <div className="slide-editor">
      <div className="row tight editor-tools">
        <select id={`layout-${slide.id}`} value={slide.layout} onChange={(e) => onLayout(e.target.value)} aria-label="Layout">
          {Object.entries(LAYOUTS).map(([k, l]) => <option key={k} value={k}>{l.label}</option>)}
        </select>
        <button className="btn small" onClick={() => onMove(-1)} aria-label="Move slide earlier">↑</button>
        <button className="btn small" onClick={() => onMove(1)} aria-label="Move slide later">↓</button>
        <button className="btn ghost small" onClick={onDuplicate}>Duplicate</button>
        <button className="btn ghost small" onClick={onDelete}>{deleteArmed ? 'Click again to delete' : 'Delete'}</button>
        <label className={`verify ${slide.verified ? 'on' : ''}`}>
          <input type="checkbox" checked={!!slide.verified} onChange={(e) => patch({ verified: e.target.checked })} />
          Verified against the CRM
        </label>
      </div>
      {slide.hint && <p className="hint-box"><strong>This slide answers:</strong> {slide.hint}</p>}

      <div className="row">
        <label className="field"><span className="field-label">Section label</span>
          <input id={`eyebrow-${slide.id}`} value={slide.eyebrow || ''} placeholder="e.g. Customer health" onChange={(e) => patch({ eyebrow: e.target.value })} />
        </label>
        <label className="field"><span className="field-label">Subtitle (period / basis)</span>
          <input id={`subtitle-${slide.id}`} value={slide.subtitle || ''} placeholder="e.g. Jan–Sep 2026 actuals" onChange={(e) => patch({ subtitle: e.target.value })} />
        </label>
      </div>
      <label className="field"><span className="field-label">Headline — state the conclusion, not the topic</span>
        <input id={`title-${slide.id}`} value={slide.title || ''} placeholder="e.g. The funnel is the problem, not the close" onChange={(e) => patch({ title: e.target.value })} />
      </label>

      {L.chart && (
        <label className="field"><span className="field-label">Chart</span>
          <select id={`chart-${slide.id}`} value={slide.chart || ''} onChange={(e) => patch({ chart: e.target.value })}>
            <option value="">{slide.layout === 'chart' ? 'Choose a chart…' : 'No chart'}</option>
            {charts.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </label>
      )}

      {L.chart2 && (
        <label className="field"><span className="field-label">Second chart</span>
          <select id={`chart2-${slide.id}`} value={slide.chart2 || ''} onChange={(e) => patch({ chart2: e.target.value })}>
            <option value="">Choose a chart…</option>
            {charts.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </label>
      )}
      {L.image && <ImagePicker label="Image" src={slide.image} onPick={(img) => patch({ image: img.src, imageW: img.w, imageH: img.h })} onClear={() => patch({ image: '', imageW: 0, imageH: 0 })} onError={onError} />}

      <div className="list-edit">
        <span className="field-label">{L.list.strings ? `${L.list.label}s` : L.label}</span>
        {list.map((item, i) => (
          <div key={i} className={`list-item ${L.list.strings ? 'single' : ''}`}>
            {L.list.strings ? (
              <textarea id={`${L.list.key}-${slide.id}-${i}`} rows={slide.layout === 'narrative' ? 3 : 2} value={item} onChange={(e) => setList(list.map((x, j) => (j === i ? e.target.value : x)))} />
            ) : (
              <div className={`item-fields n${L.list.fields.length}`}>
                {L.list.fields.some((f) => f.k === 'value') && metrics.length > 0 && (
                  <label className="field wide"><span className="field-hint">Insert a number from the CRM</span>
                    <select id={`metric-${slide.id}-${i}`} value="" onChange={(e) => { const m = metrics.find((x) => x.id === e.target.value); if (m) setList(list.map((x, j) => (j === i ? applyMetric(slide.layout, x, m) : x))); }}>
                      <option value="">Choose a metric… (fills the number and its source)</option>
                      <optgroup label="Computed from the CRM">{metrics.filter((m) => !m.pinned).map((m) => <option key={m.id} value={m.id}>{m.label}: {m.value}</option>)}</optgroup>
                      {metrics.some((m) => m.pinned) && <optgroup label="Your pinned evidence">{metrics.filter((m) => m.pinned).map((m) => <option key={m.id} value={m.id}>{m.label}: {m.full}</option>)}</optgroup>}
                    </select>
                  </label>
                )}
                {L.list.fields.map((f) => (
                  <label key={f.k} className={`field ${f.area ? 'wide' : ''}`}><span className="field-hint">{f.label}</span>
                    {f.options ? (
                      <select id={`${f.k}-${slide.id}-${i}`} value={item[f.k] ?? ''} onChange={(e) => setList(list.map((x, j) => (j === i ? { ...x, [f.k]: e.target.value } : x)))}>
                        {f.options.map((o) => <option key={o} value={o}>{o === '' ? '—' : o}</option>)}
                      </select>
                    ) : f.area ? (
                      <textarea id={`${f.k}-${slide.id}-${i}`} rows={2} value={item[f.k] || ''} onChange={(e) => setList(list.map((x, j) => (j === i ? { ...x, [f.k]: e.target.value } : x)))} />
                    ) : (
                      <input id={`${f.k}-${slide.id}-${i}`} className={f.words && words(item[f.k]) > f.words ? 'too-long' : ''} value={item[f.k] || ''} onChange={(e) => setList(list.map((x, j) => (j === i ? { ...x, [f.k]: e.target.value } : x)))} />
                    )}
                    {f.words > 2 && words(item[f.k]) > f.words && <span className="too-long-note">{words(item[f.k])} words — keep it under {f.words}; put detail in speaker notes</span>}
                  </label>
                ))}
              </div>
            )}
            <button className="icon-btn" aria-label="Remove" onClick={() => setList(list.filter((_, j) => j !== i))}>✕</button>
          </div>
        ))}
        {list.length < L.list.max && (
          <button className="btn ghost small" onClick={() => setList([...list, L.list.strings ? '' : { ...L.list.add }])}>+ Add {L.list.strings ? L.list.label.toLowerCase() : 'row'}</button>
        )}
      </div>

      {L.spotlight && (
        <div className="list-edit">
          <span className="field-label">Spotlight number</span>
          <div className="item-fields n4">
            {metrics.length > 0 && (
              <label className="field wide"><span className="field-hint">Insert a number from the CRM</span>
                <select id={`sp-metric-${slide.id}`} value="" onChange={(e) => { const m = metrics.find((x) => x.id === e.target.value); if (m) patch({ spotlight: { ...sp, label: m.label, value: m.value, caption: `Today · ${m.source}` } }); }}>
                  <option value="">Choose a metric…</option>
                  {metrics.map((m) => <option key={m.id} value={m.id}>{m.label}: {m.full || m.value}</option>)}
                </select>
              </label>
            )}
            {[['label', 'Label'], ['value', 'Big number'], ['caption', 'Caption'], ['text', 'Explanation (cite the file)']].map(([k, label]) => (
              <label key={k} className={`field ${k === 'text' ? 'wide' : ''}`}><span className="field-hint">{label}</span>
                {k === 'text'
                  ? <textarea id={`sp-${k}-${slide.id}`} rows={2} value={sp[k] || ''} onChange={(e) => patch({ spotlight: { ...sp, [k]: e.target.value } })} />
                  : <input id={`sp-${k}-${slide.id}`} value={sp[k] || ''} onChange={(e) => patch({ spotlight: { ...sp, [k]: e.target.value } })} />}
              </label>
            ))}
          </div>
        </div>
      )}
      {L.ask && (
        <label className="field"><span className="field-label">The ask (highlighted)</span>
          <textarea id={`ask-${slide.id}`} rows={2} value={slide.ask || ''} onChange={(e) => patch({ ask: e.target.value })} />
        </label>
      )}
      {slide.layout === 'scorecard' && (
        <label className="field"><span className="field-label">Footnote (optional)</span>
          <input id={`foot-${slide.id}`} value={slide.footnote || ''} onChange={(e) => patch({ footnote: e.target.value })} />
        </label>
      )}

      {slide.layout !== 'narrative' && (
        <label className="field"><span className="field-label">Board takeaway (one sentence, shown in the bar at the bottom)</span>
          <input id={`takeaway-${slide.id}`} value={slide.takeaway || ''} onChange={(e) => patch({ takeaway: e.target.value })} />
        </label>
      )}
      <label className="field"><span className="field-label">Speaker notes</span>
        <textarea id={`notes-${slide.id}`} rows={2} value={slide.notes || ''} onChange={(e) => patch({ notes: e.target.value })} />
      </label>
    </div>
  );
}

function applyMetric(layout, item, m) {
  const next = { ...item, value: m.value, tone: m.tone === 'neutral' ? item.tone || 'neutral' : m.tone };
  if (layout === 'bignumbers') return { ...next, label: m.label, sub: m.sub };
  if (layout === 'hero' || layout === 'image') return { ...next, label: `${m.label} (${m.source})` };
  if (layout === 'chart') return { ...next, label: m.label, delta: m.sub.split(' · ')[0] || '', note: m.source };
  if (layout === 'kpis') return { ...next, label: m.label, sub: m.sub };
  return { ...next, label: m.label };
}

function ImagePicker({ label, src, onPick, onClear, onError }) {
  return (
    <div className="image-pick">
      <span className="field-label">{label}</span>
      <div className="row tight">
        {src && <img src={src} alt="" className="image-thumb" />}
        <label className="btn small">
          {src ? 'Replace image' : 'Upload image'}
          <input type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={async (e) => {
            const f = e.target.files?.[0]; e.target.value = '';
            if (!f) return;
            try { onPick(await readImage(f)); } catch (err) { onError(err.message); }
          }} />
        </label>
        {src && <button className="btn ghost small" onClick={onClear}>Remove</button>}
        <span className="muted small">PNG or JPG — a product screenshot, a customer photo, a logo.</span>
      </div>
    </div>
  );
}
