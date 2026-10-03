// Slide layout engine. Every slide is laid out ONCE into a list of drawing operations
// (rect, line, circle, text, chart) in inches on a 13.333 x 7.5 page. The same operations
// are replayed by three backends: the in-app SVG preview, the PDF and the PowerPoint.
import { chartData, fmtUnit } from '../deck.js';

export const PAGE = { w: 13.333, h: 7.5 };

// York College palette for exported slides.
export const P = {
  bg: 'F4F6F5', card: 'FFFFFF', line: 'D9E0DB', dark: '0B3D22', green: '006027', green2: '008350',
  mint: '9ED9B6', mintSoft: 'CFE6D8', ink: '231F20', ink2: '4A4F4C', ink3: '737A76',
  good: '1F7A45', bad: 'B3362D', amber: 'C27C0E', rowAlt: 'F7F9F8', white: 'FFFFFF',
};
const TONE = { good: P.good, bad: P.bad, warn: P.amber, neutral: P.green };
const RAG = { G: P.good, Y: 'D69200', R: P.bad };

// ---------------------------------------------------------------- Layout catalog (also drives the editor)
export const LAYOUTS = {
  cards: {
    label: 'Insight cards (2–6)',
    list: { key: 'cards', max: 6, add: { title: '', body: '', tone: 'neutral' }, fields: [
      { k: 'title', label: 'Card headline' }, { k: 'body', label: 'Supporting detail (cite the file)', area: true },
      { k: 'tone', label: 'Signal', options: ['neutral', 'good', 'bad', 'warn'] },
    ] },
  },
  scorecard: {
    label: 'Scorecard table (red / yellow / green)',
    list: { key: 'rows', max: 14, add: { kpi: '', basis: '', value: '', compare: '', change: '', rag: '' }, fields: [
      { k: 'kpi', label: 'KPI' }, { k: 'basis', label: 'Basis / source' }, { k: 'value', label: 'Actual' },
      { k: 'compare', label: 'Target / prior' }, { k: 'change', label: 'Gap / change' }, { k: 'rag', label: 'Status', options: ['G', 'Y', 'R', ''] },
    ] },
    columns: { value: 'Actual', compare: 'Target' },
  },
  chart: {
    label: 'Chart + stat callouts',
    chart: true,
    list: { key: 'stats', max: 3, add: { label: '', value: '', delta: '', note: '', tone: 'neutral' }, fields: [
      { k: 'label', label: 'Label' }, { k: 'value', label: 'Big number' }, { k: 'delta', label: 'Change / comparison' },
      { k: 'note', label: 'Short note (cite the file)' }, { k: 'tone', label: 'Signal', options: ['neutral', 'good', 'bad', 'warn'] },
    ] },
  },
  kpis: {
    label: 'KPI tiles + spotlight number',
    list: { key: 'kpis', max: 4, add: { label: '', value: '', sub: '', tone: 'neutral' }, fields: [
      { k: 'label', label: 'KPI' }, { k: 'value', label: 'Value' }, { k: 'sub', label: 'Target / trend / source' },
      { k: 'tone', label: 'Signal', options: ['neutral', 'good', 'bad', 'warn'] },
    ] },
    spotlight: true,
  },
  decisions: {
    label: 'Numbered decisions / recommendations',
    list: { key: 'items', max: 3, add: { title: '', body: '', why: '' }, fields: [
      { k: 'title', label: 'Recommendation' }, { k: 'body', label: 'What exactly (amount, owner, timing)', area: true },
      { k: 'why', label: 'Why now (the data point)' },
    ] },
  },
  narrative: {
    label: 'Narrative (dark slide)',
    list: { key: 'paragraphs', max: 5, strings: true, add: '', label: 'Paragraph' },
    ask: true,
  },
  bullets: {
    label: 'Bullets (+ optional chart)',
    chart: true,
    list: { key: 'bullets', max: 7, strings: true, add: '', label: 'Bullet' },
  },
};

// ---------------------------------------------------------------- Text measurement + fitting
let canvasCtx = null;
let noCanvas = false;
function measureWidth(text, sizePt, { bold, italic, serif }) {
  if (typeof document !== 'undefined' && !noCanvas) {
    try {
      if (!canvasCtx) canvasCtx = document.createElement('canvas').getContext('2d');
      if (!canvasCtx) throw new Error('no canvas');
      canvasCtx.font = `${italic ? 'italic ' : ''}${bold ? '700 ' : '400 '}${sizePt}px ${serif ? 'Georgia, "Times New Roman", serif' : 'Arial, Helvetica, sans-serif'}`;
      return canvasCtx.measureText(text).width / 72;
    } catch { noCanvas = true; }
  }
  return (text.length * sizePt * (bold ? 0.56 : 0.5)) / 72;
}

function wrap(text, widthIn, size, style) {
  const out = [];
  String(text ?? '').split('\n').forEach((para) => {
    const words = para.split(/\s+/).filter(Boolean);
    if (!words.length) { out.push(''); return; }
    let line = '';
    words.forEach((w) => {
      const test = line ? `${line} ${w}` : w;
      if (measureWidth(test, size, style) <= widthIn || !line) line = test;
      else { out.push(line); line = w; }
    });
    out.push(line);
  });
  return out;
}

// Fit text into a box: shrink from `size` down to `min` until it fits; clip with an ellipsis if it still doesn't.
function fit(text, box, style) {
  const lh = style.lineHeight || 1.22;
  const max = style.size, min = style.min || Math.max(7, Math.round(max * 0.62));
  for (let s = max; s >= min; s -= 0.5) {
    const lines = wrap(text, box.w, s, style);
    if (lines.length * s * lh / 72 <= box.h + 0.001) return { size: s, lines };
  }
  const lines = wrap(text, box.w, min, style);
  const fitN = Math.max(1, Math.floor((box.h * 72) / (min * lh)));
  if (lines.length > fitN) { lines.length = fitN; lines[fitN - 1] = lines[fitN - 1].replace(/\s*\S*$/, '') + '…'; }
  return { size: min, lines };
}

// ---------------------------------------------------------------- Op builders
function Ops() {
  const ops = [];
  return {
    ops,
    rect(x, y, w, h, fill, line, radius = 0) { ops.push({ op: 'rect', x, y, w, h, fill, line, radius }); },
    line(x1, y1, x2, y2, color, width = 0.75, dash = false) { ops.push({ op: 'line', x1, y1, x2, y2, color, width, dash }); },
    circle(cx, cy, r, fill) { ops.push({ op: 'circle', cx, cy, r, fill }); },
    // Returns the height actually used, so callers can stack blocks.
    text(str, box, style) {
      if (str === undefined || str === null || String(str).trim() === '') return 0;
      const st = { color: P.ink, align: 'left', valign: 'top', ...style };
      const { size, lines } = fit(String(str), box, st);
      const lh = st.lineHeight || 1.22;
      const used = (lines.length * size * lh) / 72;
      ops.push({ op: 'text', ...box, text: String(str), lines, size, bold: !!st.bold, italic: !!st.italic, serif: !!st.serif, color: st.color, align: st.align, valign: st.valign, lineHeight: lh, spacing: st.spacing || 0, caps: !!st.caps });
      return used;
    },
    chart(data, box) { ops.push({ op: 'chart', ...box, data }); },
  };
}

// ---------------------------------------------------------------- Shared chrome
const M = 0.6; // side margin
const BODY_TOP = 1.95;
const BAR_Y = 6.5;

function chrome(o, slide, deck, n, total, { dark = false } = {}) {
  o.rect(0, 0, PAGE.w, PAGE.h, dark ? P.dark : P.bg);
  const ey = slide.eyebrow ? o.text(slide.eyebrow.toUpperCase(), { x: M, y: 0.42, w: PAGE.w - 2 * M, h: 0.25 }, { size: 9.5, bold: true, color: dark ? P.mint : P.green2, spacing: 2, caps: true, min: 8 }) : 0;
  o.text(slide.title || '', { x: M, y: ey ? 0.7 : 0.5, w: PAGE.w - 2 * M, h: 0.62 }, { size: 26, bold: true, serif: true, color: dark ? P.white : P.green, min: 17, lineHeight: 1.1 });
  if (slide.subtitle) o.text(slide.subtitle, { x: M, y: 1.36, w: PAGE.w - 2 * M, h: 0.3 }, { size: 12, italic: true, color: dark ? P.mintSoft : P.ink3, min: 9 });
  if (slide.takeaway && !dark) {
    o.rect(M, BAR_Y, PAGE.w - 2 * M, 0.44, P.dark);
    o.text('BOARD TAKEAWAY', { x: M + 0.2, y: BAR_Y + 0.15, w: 1.6, h: 0.2 }, { size: 8, bold: true, color: P.mint, spacing: 1.5, caps: true, min: 7 });
    o.text(slide.takeaway, { x: M + 1.85, y: BAR_Y + 0.11, w: PAGE.w - 2 * M - 2.05, h: 0.24 }, { size: 11, color: P.white, min: 8 });
  }
  const foot = [deck.company, deck.confidential ? 'Confidential' : '', deck.audience].filter(Boolean).join('   |   ');
  o.text(foot, { x: M, y: 7.1, w: 7, h: 0.2 }, { size: 8, color: dark ? P.mintSoft : P.ink3, min: 7 });
  o.text(`${n} / ${total}`, { x: PAGE.w - M - 1.5, y: 7.1, w: 1.5, h: 0.2 }, { size: 8, color: dark ? P.mintSoft : P.ink3, align: 'right', min: 7 });
}

const bodyBottom = (slide) => (slide.takeaway ? BAR_Y - 0.2 : 6.85);
export const filled = (arr) => (arr || []).filter((x) => (typeof x === 'string' ? x.trim() : Object.entries(x || {}).some(([k, v]) => k !== 'tone' && k !== 'rag' && String(v ?? '').trim())));

// ---------------------------------------------------------------- Layout renderers
export function layoutSlide(slide, deck, state, n, total) {
  const o = Ops();
  if (slide.kind === 'title') { titleSlide(o, deck); return o.ops; }
  if (slide.kind === 'evidence') { evidenceSlide(o, slide, deck, state, n, total); return o.ops; }
  const fn = { cards, scorecard, chart: chartLayout, kpis, decisions, narrative, bullets }[slide.layout] || bullets;
  fn(o, slide, deck, state, n, total);
  return o.ops;
}

function titleSlide(o, deck) {
  o.rect(0, 0, PAGE.w, PAGE.h, P.dark);
  o.rect(0, 0, 0.18, PAGE.h, P.green2);
  o.text((deck.company || '').toUpperCase(), { x: 0.8, y: 0.75, w: 8, h: 0.35 }, { size: 15, bold: true, color: P.white, spacing: 1.5, caps: true });
  o.text([deck.audience, deck.confidential ? 'Confidential' : ''].filter(Boolean).join('   |   ').toUpperCase(), { x: 0.8, y: 1.15, w: 8, h: 0.25 }, { size: 9.5, bold: true, color: P.mint, spacing: 2, caps: true });
  const h = o.text(deck.title || '', { x: 0.8, y: 2.25, w: 11.2, h: 1.5 }, { size: 40, bold: true, serif: true, color: P.white, min: 26, lineHeight: 1.08 });
  const y = 2.25 + h + 0.15;
  const sh = o.text(deck.subtitle || '', { x: 0.8, y, w: 11, h: 0.5 }, { size: 20, italic: true, serif: true, color: P.mintSoft, min: 13 });
  if (deck.health) {
    const col = { Green: P.good, Yellow: 'D69200', Red: P.bad }[deck.health] || P.amber;
    o.rect(0.8, y + sh + 0.4, 3.0, 0.48, col, null, 0.06);
    o.text(`BUSINESS HEALTH: ${deck.health.toUpperCase()}`, { x: 0.8, y: y + sh + 0.53, w: 3.0, h: 0.24 }, { size: 10.5, bold: true, color: P.white, align: 'center', spacing: 1, caps: true });
  }
  o.text(deck.sourceNote || '', { x: 0.8, y: 5.55, w: 11, h: 0.5 }, { size: 10, color: P.mintSoft, min: 8 });
  o.text([deck.presenters, deck.date].filter(Boolean).join('   ·   '), { x: 0.8, y: 6.35, w: 11, h: 0.3 }, { size: 11, italic: true, color: P.white, min: 8 });
}

function cards(o, slide, deck, state, n, total) {
  chrome(o, slide, deck, n, total);
  const items = filled(slide.cards).slice(0, 6);
  const list = items.length ? items : [{ title: 'Add insight cards', body: 'Each card: a headline and one or two sentences of evidence, with the source file.', tone: 'neutral' }];
  const cols = list.length <= 4 ? 2 : 3;
  const rows = Math.ceil(list.length / cols);
  const gap = 0.25, top = BODY_TOP, bottom = bodyBottom(slide);
  const w = (PAGE.w - 2 * M - gap * (cols - 1)) / cols;
  const h = Math.min(rows === 1 ? 2.6 : 2.05, (bottom - top - gap * (rows - 1)) / rows);
  list.forEach((c, i) => {
    const x = M + (i % cols) * (w + gap), y = top + Math.floor(i / cols) * (h + gap);
    o.rect(x, y, w, h, P.card, P.line);
    o.rect(x, y, 0.07, h, TONE[c.tone] || P.green);
    const th = o.text(c.title, { x: x + 0.3, y: y + 0.24, w: w - 0.5, h: 0.62 }, { size: 16.5, bold: true, serif: true, color: P.ink, min: 11, lineHeight: 1.12 });
    o.text(c.body, { x: x + 0.3, y: y + 0.38 + Math.max(th, 0.28), w: w - 0.5, h: h - 0.6 - Math.max(th, 0.28) }, { size: cols === 3 ? 12.5 : 14, color: P.ink2, min: 8.5, lineHeight: 1.28 });
  });
}

function scorecard(o, slide, deck, state, n, total) {
  chrome(o, slide, deck, n, total);
  const rows = filled(slide.rows).slice(0, 14);
  const top = BODY_TOP - 0.05, bottom = bodyBottom(slide);
  const cols = [
    { k: 'kpi', label: 'KPI', w: 3.3, bold: true },
    { k: 'basis', label: 'Basis / source', w: 2.75 },
    { k: 'value', label: slide.colValue || 'Actual', w: 1.55, align: 'right' },
    { k: 'compare', label: slide.colCompare || 'Target', w: 1.55, align: 'right' },
    { k: 'change', label: 'Gap / change', w: 1.6, align: 'right', tone: true },
    { k: 'rag', label: 'Status', w: 1.383, align: 'center', rag: true },
  ];
  const rh = Math.min(0.38, (bottom - top) / (rows.length + 1));
  let x = M;
  o.rect(M, top, PAGE.w - 2 * M, rh, P.dark);
  cols.forEach((c) => { o.text(c.label.toUpperCase(), { x: x + 0.1, y: top + rh * 0.3, w: c.w - 0.2, h: rh * 0.5 }, { size: 8, bold: true, color: P.white, align: c.align || 'left', spacing: 0.8, caps: true, min: 6.5 }); x += c.w; });
  rows.forEach((r, i) => {
    const y = top + rh * (i + 1);
    o.rect(M, y, PAGE.w - 2 * M, rh, i % 2 ? P.rowAlt : P.card);
    o.line(M, y + rh, PAGE.w - M, y + rh, P.line, 0.5);
    let cx = M;
    cols.forEach((c) => {
      const v = String(r[c.k] ?? '');
      if (c.rag) {
        const code = v ? v.toUpperCase()[0] : '–';
        o.rect(cx + 0.35, y + rh * 0.16, c.w - 0.7, rh * 0.68, RAG[code] || 'B9C2BC', null, 0.03);
        o.text(code, { x: cx + 0.35, y: y + rh * 0.27, w: c.w - 0.7, h: rh * 0.5 }, { size: 9, bold: true, color: P.white, align: 'center', min: 7 });
      } else {
        const color = c.tone ? (/^[-−(]/.test(v.trim()) ? P.bad : /^\+/.test(v.trim()) ? P.good : P.ink) : c.bold ? P.ink : P.ink2;
        o.text(v, { x: cx + 0.1, y: y + rh * 0.24, w: c.w - 0.2, h: rh * 0.62 }, { size: 10.5, bold: c.bold || c.tone, color, align: c.align || 'left', min: 7.5 });
      }
      cx += c.w;
    });
  });
  if (slide.footnote) o.text(slide.footnote, { x: M, y: top + rh * (rows.length + 1) + 0.12, w: PAGE.w - 2 * M, h: 0.4 }, { size: 9, italic: true, color: P.ink3, min: 7 });
}

function statStack(o, stats, x, y0, w, bottom) {
  const list = filled(stats).slice(0, 3);
  if (!list.length) return;
  const gap = 0.2;
  const h = Math.min(1.45, (bottom - y0 - gap * (list.length - 1)) / list.length);
  list.forEach((s, i) => {
    const y = y0 + i * (h + gap);
    o.rect(x, y, w, h, P.card, P.line);
    o.text((s.label || '').toUpperCase(), { x: x + 0.25, y: y + 0.18, w: w * 0.55, h: 0.22 }, { size: 8, bold: true, color: P.ink3, spacing: 1, caps: true, min: 6.5 });
    o.text(s.value, { x: x + 0.25, y: y + 0.42, w: w * 0.55, h: 0.5 }, { size: 26, bold: true, serif: true, color: TONE[s.tone] && s.tone !== 'neutral' ? TONE[s.tone] : P.ink, min: 15, lineHeight: 1.05 });
    const dcol = /^[-−]/.test(String(s.delta || '').trim()) || s.tone === 'bad' ? P.bad : /^\+/.test(String(s.delta || '').trim()) || s.tone === 'good' ? P.good : P.ink2;
    o.text(s.delta, { x: x + 0.25, y: y + h - 0.38, w: w * 0.6, h: 0.24 }, { size: 10, bold: true, color: dcol, min: 7.5 });
    o.text(s.note, { x: x + w * 0.58, y: y + 0.2, w: w * 0.42 - 0.2, h: h - 0.35 }, { size: 9.5, color: P.ink2, min: 7 });
  });
}

function chartLayout(o, slide, deck, state, n, total) {
  chrome(o, slide, deck, n, total);
  const bottom = bodyBottom(slide);
  const hasStats = filled(slide.stats).length > 0;
  const cw = hasStats ? 7.4 : PAGE.w - 2 * M;
  const data = slide.chart ? chartData(slide.chart, state) : null;
  if (data) o.chart(data, { x: M, y: BODY_TOP, w: cw, h: bottom - BODY_TOP });
  else {
    o.rect(M, BODY_TOP, cw, bottom - BODY_TOP, P.card, P.line);
    o.text('Choose a chart for this slide', { x: M, y: BODY_TOP + (bottom - BODY_TOP) / 2 - 0.15, w: cw, h: 0.3 }, { size: 12, color: P.ink3, align: 'center' });
  }
  if (hasStats) statStack(o, slide.stats, M + cw + 0.3, BODY_TOP, PAGE.w - 2 * M - cw - 0.3, bottom);
}

function kpis(o, slide, deck, state, n, total) {
  chrome(o, slide, deck, n, total);
  const list = filled(slide.kpis).slice(0, 4);
  const sp = slide.spotlight || {};
  const hasSpot = [sp.label, sp.value, sp.text].some((v) => String(v || '').trim());
  const bottom = bodyBottom(slide);
  const gap = 0.25;
  const count = Math.max(1, list.length);
  const w = (PAGE.w - 2 * M - gap * (count - 1)) / count;
  const th = !list.length && hasSpot ? -0.3 : hasSpot ? 1.75 : Math.min(2.6, bottom - BODY_TOP);
  (list.length || hasSpot ? list : [{ label: 'KPI', value: '—', sub: 'Add up to four KPI tiles' }]).forEach((k, i) => {
    const x = M + i * (w + gap), y = BODY_TOP;
    o.rect(x, y, w, th, P.card, P.line);
    o.text((k.label || '').toUpperCase(), { x: x + 0.25, y: y + 0.2, w: w - 0.5, h: 0.4 }, { size: 8.5, bold: true, color: P.ink3, spacing: 1, caps: true, min: 6.5 });
    o.text(k.value, { x: x + 0.25, y: y + 0.6, w: w - 0.5, h: 0.6 }, { size: 32, bold: true, serif: true, color: TONE[k.tone] && k.tone !== 'neutral' ? TONE[k.tone] : P.ink, min: 18, lineHeight: 1.05 });
    o.text(k.sub, { x: x + 0.25, y: y + 1.22, w: w - 0.5, h: th - 1.35 }, { size: 10, color: P.ink2, min: 7 });
  });
  if (hasSpot) {
    const only = !list.length;
    const avail = bottom - (BODY_TOP + th + 0.3);
    const h = only ? Math.min(3.4, avail) : avail;
    const y = only ? BODY_TOP + (avail - h) / 2 : BODY_TOP + th + 0.3;
    o.rect(M, y, PAGE.w - 2 * M, h, P.card, P.bad);
    o.rect(M, y, PAGE.w - 2 * M, 0.05, P.bad);
    o.text((sp.label || 'The number to watch').toUpperCase(), { x: M + 0.4, y: y + 0.3, w: 4.2, h: 0.24 }, { size: 9, bold: true, color: P.bad, spacing: 1.5, caps: true, min: 7 });
    o.text(sp.value, { x: M + 0.4, y: y + 0.65, w: 4.4, h: only ? 1.2 : 0.9 }, { size: only ? 66 : 48, bold: true, serif: true, color: P.bad, min: 24, lineHeight: 1.0 });
    o.text(sp.caption, { x: M + 0.4, y: y + h - 0.6, w: 4.4, h: 0.35 }, { size: only ? 12.5 : 10, color: P.ink3, min: 7 });
    o.line(M + 5.0, y + 0.35, M + 5.0, y + h - 0.35, P.line, 0.75);
    o.text(sp.text, { x: M + 5.35, y: y + 0.35, w: PAGE.w - 2 * M - 5.75, h: h - 0.7 }, { size: only ? 17 : 14, color: P.ink, min: 8.5, valign: 'middle', lineHeight: 1.32 });
  }
}

function decisions(o, slide, deck, state, n, total) {
  chrome(o, slide, deck, n, total);
  const list = filled(slide.items).slice(0, 3);
  const items = list.length ? list : [{ title: 'Add a recommendation', body: 'What exactly, how much, who owns it, by when.', why: '' }];
  const bottom = bodyBottom(slide), gap = 0.25;
  const h = Math.min(1.8, (bottom - BODY_TOP - gap * (items.length - 1)) / items.length);
  items.forEach((it, i) => {
    const y = BODY_TOP + i * (h + gap), x = M;
    o.rect(x, y, PAGE.w - 2 * M, h, P.card, P.line);
    const r = Math.min(0.38, h * 0.3);
    o.circle(x + 0.35 + r, y + h / 2, r, P.dark);
    o.text(String(i + 1), { x: x + 0.35, y: y + h / 2 - r * 0.62, w: r * 2, h: r * 1.3 }, { size: Math.round(r * 60), bold: true, serif: true, color: P.white, align: 'center', min: 12 });
    const tx = x + 0.35 + 2 * r + 0.4, tw = PAGE.w - M - tx - 0.35;
    let ty = y + 0.22;
    ty += o.text(it.title, { x: tx, y: ty, w: tw, h: 0.42 }, { size: 18, bold: true, serif: true, color: P.ink, min: 12 }) + 0.08;
    ty += o.text(it.body, { x: tx, y: ty, w: tw, h: Math.max(0.3, y + h - ty - 0.42) }, { size: 13.5, color: P.ink2, min: 9 }) + 0.08;
    if (it.why) {
      o.text('WHY NOW:', { x: tx, y: Math.min(ty, y + h - 0.38) + 0.02, w: 1.05, h: 0.22 }, { size: 9.5, bold: true, color: P.bad, spacing: 0.8, caps: true, min: 7 });
      o.text(it.why, { x: tx + 1.05, y: Math.min(ty, y + h - 0.38), w: tw - 1.05, h: 0.26 }, { size: 12, color: P.ink2, min: 7.5 });
    }
  });
}

function narrative(o, slide, deck, state, n, total) {
  chrome(o, slide, deck, n, total, { dark: true });
  const paras = filled(slide.paragraphs);
  let y = BODY_TOP;
  const w = PAGE.w - 2 * M;
  (paras.length ? paras : ['Add two to four short paragraphs in your own voice.']).forEach((p) => {
    y += o.text(p, { x: M, y, w: w * 0.88, h: 6.6 - y }, { size: 19, color: P.white, serif: true, min: 11, lineHeight: 1.38 }) + 0.3;
  });
  if (slide.ask) o.text(slide.ask, { x: M, y: Math.min(y + 0.05, 6.2), w, h: 6.85 - Math.min(y + 0.05, 6.2) }, { size: 19, bold: true, serif: true, color: P.mint, min: 11, lineHeight: 1.32 });
}

function bullets(o, slide, deck, state, n, total) {
  chrome(o, slide, deck, n, total);
  const bottom = bodyBottom(slide);
  const data = slide.chart ? chartData(slide.chart, state) : null;
  const tw = data ? 6.0 : PAGE.w - 2 * M;
  const list = filled(slide.bullets);
  let y = BODY_TOP + 0.05;
  const size = list.length > 5 ? 14 : 17;
  (list.length ? list : ['Add bullets']).forEach((b) => {
    if (y > bottom - 0.3) return;
    o.rect(M, y + 0.1, 0.09, 0.09, P.green2);
    y += o.text(b, { x: M + 0.3, y, w: tw - 0.3, h: bottom - y }, { size, color: list.length ? P.ink : P.ink3, min: 10 }) + 0.18;
  });
  if (data) {
    o.rect(M + tw + 0.3, BODY_TOP, PAGE.w - 2 * M - tw - 0.3, bottom - BODY_TOP, P.card, P.line);
    o.chart(data, { x: M + tw + 0.45, y: BODY_TOP + 0.1, w: PAGE.w - 2 * M - tw - 0.6, h: bottom - BODY_TOP - 0.2 });
  }
}

function evidenceSlide(o, slide, deck, state, n, total) {
  chrome(o, { ...slide, eyebrow: slide.eyebrow || 'Appendix', subtitle: slide.subtitle || 'Data points pinned from the CRM, with their source files' }, deck, n, total);
  const ev = (state.evidence || []).slice(0, 14);
  const top = BODY_TOP - 0.05, rh = Math.min(0.36, (6.85 - top) / (ev.length + 1));
  const cols = [{ k: 'label', label: 'Data point', w: 4.6 }, { k: 'value', label: 'Value', w: 4.6 }, { k: 'fileName', label: 'Source file', w: 2.933 }];
  o.rect(M, top, PAGE.w - 2 * M, rh, P.dark);
  let x = M;
  cols.forEach((c) => { o.text(c.label.toUpperCase(), { x: x + 0.1, y: top + rh * 0.3, w: c.w - 0.2, h: rh * 0.5 }, { size: 8, bold: true, color: P.white, spacing: 0.8, caps: true }); x += c.w; });
  if (!ev.length) o.text('No evidence pinned yet. Pin numbers in the CRM tabs to list them here.', { x: M, y: top + rh + 0.2, w: 10, h: 0.3 }, { size: 11, color: P.ink3 });
  ev.forEach((e, i) => {
    const y = top + rh * (i + 1);
    o.rect(M, y, PAGE.w - 2 * M, rh, i % 2 ? P.rowAlt : P.card);
    let cx = M;
    cols.forEach((c) => { o.text(e[c.k], { x: cx + 0.1, y: y + rh * 0.22, w: c.w - 0.2, h: rh * 0.66 }, { size: 10, color: c.k === 'label' ? P.ink : P.ink2, bold: c.k === 'label', min: 7 }); cx += c.w; });
  });
}

// ---------------------------------------------------------------- Chart → primitive ops (preview + PDF)
export function chartOps(data, box) {
  const o = Ops();
  const { x, y, w, h } = box;
  o.rect(x, y, w, h, P.card, P.line);
  const pad = 0.25;
  const th = o.text(data.title, { x: x + pad, y: y + 0.18, w: w - 2 * pad, h: 0.3 }, { size: 11.5, bold: true, color: P.ink, min: 8 });
  const top = y + 0.3 + th, bottom = y + h - (data.note || data.reference ? 0.62 : 0.3);
  const vals = data.values.map((v) => (Number.isFinite(v) ? v : 0));
  const n = vals.length;
  if (data.type === 'bar') {
    const labelW = Math.min(1.9, w * 0.32);
    const max = Math.max(0, ...vals), min = Math.min(0, ...vals), range = max - min || 1;
    const px = x + pad + labelW, pw = w - 2 * pad - labelW - 0.85;
    const sx = (v) => px + ((v - min) / range) * pw;
    const rowH = Math.min(0.5, (bottom - top) / n);
    vals.forEach((v, i) => {
      const ry = top + i * rowH;
      o.text(String(data.labels[i]), { x: x + pad, y: ry + rowH * 0.28, w: labelW - 0.12, h: rowH * 0.6 }, { size: 9.5, color: P.ink2, align: 'right', min: 6.5 });
      const x0 = sx(Math.min(0, v)), x1 = sx(Math.max(0, v));
      o.rect(x0, ry + rowH * 0.18, Math.max(0.02, x1 - x0), rowH * 0.64, v < 0 ? P.bad : P.green);
      o.text(fmtUnit(data.values[i], data.unit), { x: x1 + 0.06, y: ry + rowH * 0.28, w: 0.85, h: rowH * 0.6 }, { size: 9.5, bold: true, color: P.ink, min: 6.5 });
    });
    if (min < 0) o.line(sx(0), top, sx(0), top + n * rowH, P.ink3, 0.75);
  } else {
    let max = Math.max(...vals, data.reference?.value ?? -Infinity), min = Math.min(...vals, data.reference?.value ?? Infinity);
    if (data.unit === '$') { min = Math.min(0, min); }
    if (min === max) { min -= 1; max += 1; }
    const padv = (max - min) * 0.08; max += padv; min -= padv;
    const px = x + pad + 0.85, pw = w - 2 * pad - 0.95;
    const sx = (i) => px + (n > 1 ? (i * pw) / (n - 1) : pw / 2);
    const sy = (v) => bottom - 0.25 - ((v - min) / (max - min)) * (bottom - 0.25 - top);
    for (let t = 0; t <= 4; t++) {
      const v = min + ((max - min) * t) / 4;
      o.line(px, sy(v), px + pw, sy(v), 'E3E8E5', 0.5);
      o.text(fmtUnit(v, data.unit), { x: x + pad, y: sy(v) - 0.08, w: 0.78, h: 0.18 }, { size: 8, color: P.ink3, align: 'right', min: 6 });
    }
    if (min < 0 && max > 0) o.line(px, sy(0), px + pw, sy(0), P.ink3, 0.75);
    if (data.reference) {
      o.line(px, sy(data.reference.value), px + pw, sy(data.reference.value), P.amber, 1.2, true);
      o.text(`${data.reference.label} ${fmtUnit(data.reference.value, data.unit)}`, { x: px + pw - 2.6, y: sy(data.reference.value) - 0.22, w: 2.6, h: 0.18 }, { size: 8.5, bold: true, color: P.amber, align: 'right', min: 6.5 });
    }
    for (let i = 1; i < n; i++) o.line(sx(i - 1), sy(vals[i - 1]), sx(i), sy(vals[i]), P.green, 2.2);
    vals.forEach((v, i) => o.circle(sx(i), sy(v), 0.045, P.green));
    const every = Math.ceil(n / 8);
    const lastShown = Math.floor((n - 1) / every) * every;
    data.labels.forEach((l, i) => {
      if (i % every === 0 || (i === n - 1 && n - 1 - lastShown >= every * 0.6)) o.text(String(l), { x: sx(i) - 0.5, y: bottom - 0.12, w: 1.0, h: 0.18 }, { size: 8, color: P.ink3, align: 'center', min: 6 });
    });
  }
  const cap = [data.note, `Source: ${data.source}`].filter(Boolean).join('   ·   ');
  o.text(cap, { x: x + pad, y: y + h - 0.32, w: w - 2 * pad, h: 0.2 }, { size: 8, italic: true, color: P.ink3, min: 6 });
  return o.ops;
}
