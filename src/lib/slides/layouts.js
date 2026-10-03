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
export const ICON_NAMES = ['', 'up', 'down', 'cash', 'people', 'target', 'alert', 'chart', 'check', 'calendar', 'clock', 'flag', 'shield'];

export const LAYOUTS = {
  summary: {
    label: 'Executive summary (6 answers)',
    list: { key: 'items', max: 6, add: { answer: '', value: '', tone: 'neutral' }, fields: [
      { k: 'value', label: 'Key number (blank = from that question’s slide)', words: 2 },
      { k: 'answer', label: 'Answer (blank = that slide’s headline)', words: 12 },
      { k: 'tone', label: 'Signal', options: ['neutral', 'good', 'bad', 'warn'] },
    ] },
  },
  bignumbers: {
    label: 'Big numbers with icons (1–3)',
    list: { key: 'items', max: 3, add: { icon: 'chart', value: '', label: '', sub: '', tone: 'neutral' }, fields: [
      { k: 'value', label: 'Big number', words: 2 }, { k: 'label', label: 'What it is (max 8 words)', words: 8 },
      { k: 'sub', label: 'Source / comparison (max 8 words)', words: 8 },
      { k: 'icon', label: 'Icon', options: ['up', 'down', 'cash', 'people', 'target', 'alert', 'chart', 'check', 'calendar', 'clock', 'flag', 'shield'] },
      { k: 'tone', label: 'Signal', options: ['neutral', 'good', 'bad', 'warn'] },
    ] },
  },
  hero: {
    label: 'Big chart + key numbers',
    chart: true,
    list: { key: 'stats', max: 3, add: { value: '', label: '', tone: 'neutral' }, fields: [
      { k: 'value', label: 'Number', words: 2 }, { k: 'label', label: 'What it means (max 8 words)', words: 8 },
      { k: 'tone', label: 'Signal', options: ['neutral', 'good', 'bad', 'warn'] },
    ] },
  },
  twocharts: {
    label: 'Two charts side by side',
    chart: true, chart2: true,
    list: { key: 'captions', max: 2, strings: true, add: '', label: 'Caption (max 12 words)', words: 12 },
  },
  allocation: {
    label: 'Budget allocation bar',
    list: { key: 'items', max: 4, add: { label: '', amount: '', why: '' }, fields: [
      { k: 'amount', label: 'Amount (e.g. $40K)', words: 1 }, { k: 'label', label: 'Where it goes (max 5 words)', words: 5 },
      { k: 'why', label: 'Why — the data point (max 10 words)', words: 10 },
    ] },
  },
  compare: {
    label: 'Plan vs. our change (arrows)',
    list: { key: 'rows', max: 4, add: { icon: 'flag', from: '', to: '', why: '' }, fields: [
      { k: 'from', label: 'Current plan says (max 8 words)', words: 8 }, { k: 'to', label: 'We would change to (max 8 words)', words: 8 },
      { k: 'why', label: 'Because (max 10 words)', words: 10 },
      { k: 'icon', label: 'Icon', options: ['flag', 'up', 'down', 'cash', 'people', 'target', 'alert', 'chart', 'check', 'calendar', 'clock', 'shield'] },
    ] },
  },
  image: {
    label: 'Image + key numbers',
    image: true,
    list: { key: 'points', max: 3, add: { value: '', label: '' }, fields: [
      { k: 'value', label: 'Number', words: 2 }, { k: 'label', label: 'What it means (max 8 words)', words: 8 },
    ] },
  },
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
    label: 'Chart + stat cards',
    chart: true,
    list: { key: 'stats', max: 3, add: { label: '', value: '', delta: '', note: '', tone: 'neutral' }, fields: [
      { k: 'label', label: 'Label', words: 4 }, { k: 'value', label: 'Big number', words: 2 }, { k: 'delta', label: 'Change / comparison', words: 5 },
      { k: 'note', label: 'Source file', words: 4 }, { k: 'tone', label: 'Signal', options: ['neutral', 'good', 'bad', 'warn'] },
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
  return (text.length * sizePt * (serif ? (bold ? 0.62 : 0.55) : (bold ? 0.58 : 0.52))) / 72;
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
  const w = box.w / (style.maxLines === 1 ? 1.18 : 1.06); // headroom for font substitution in PowerPoint/Keynote
  for (let s = max; s >= min; s -= 0.5) {
    const lines = wrap(text, w, s, style);
    if (lines.length * s * lh / 72 <= box.h + 0.001 && (!style.maxLines || lines.length <= style.maxLines)) return { size: s, lines };
  }
  const lines = wrap(text, w, min, style);
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
    poly(points, fill) { ops.push({ op: 'poly', points, fill }); },
    image(src, box) { if (src) ops.push({ op: 'image', src, ...box }); },
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
export const filled = (arr) => (arr || []).filter((x) => (typeof x === 'string' ? x.trim() : Object.entries(x || {}).some(([k, v]) => !['tone', 'rag', 'icon'].includes(k) && String(v ?? '').trim())));

// ---------------------------------------------------------------- Layout renderers
export function layoutSlide(slide, deck, state, n, total) {
  const o = Ops();
  if (slide.kind === 'title') { titleSlide(o, deck); return o.ops; }
  if (slide.kind === 'evidence') { evidenceSlide(o, slide, deck, state, n, total); return o.ops; }
  const fn = { cards, scorecard, chart: chartLayout, kpis, decisions, narrative, bullets, bignumbers, hero, twocharts, allocation, compare, image: imageLayout, summary }[slide.layout] || bullets;
  fn(o, slide, deck, state, n, total);
  return o.ops;
}

function titleSlide(o, deck) {
  o.rect(0, 0, PAGE.w, PAGE.h, P.dark);
  if (deck.image) {
    const box = { x: 7.6, y: 0, w: PAGE.w - 7.6, h: PAGE.h };
    o.rect(box.x, box.y, box.w, box.h, '123F28');
    o.image(deck.image, { ...containBox(deck.imageW, deck.imageH, box), clip: box });
  }
  o.rect(0, 0, 0.18, PAGE.h, P.green2);
  o.text((deck.company || '').toUpperCase(), { x: 0.8, y: 0.75, w: 8, h: 0.35 }, { size: 15, bold: true, color: P.white, spacing: 1.5, caps: true });
  o.text([deck.audience, deck.confidential ? 'Confidential' : ''].filter(Boolean).join('   |   ').toUpperCase(), { x: 0.8, y: 1.15, w: 8, h: 0.25 }, { size: 9.5, bold: true, color: P.mint, spacing: 2, caps: true });
  const tw = deck.image ? 6.4 : 11.2;
  const h = o.text(deck.title || '', { x: 0.8, y: 2.25, w: tw, h: 1.5 }, { size: 40, bold: true, serif: true, color: P.white, min: 26, lineHeight: 1.08 });
  const y = 2.25 + h + 0.15;
  const sh = o.text(deck.subtitle || '', { x: 0.8, y, w: tw, h: 0.6 }, { size: 20, italic: true, serif: true, color: P.mintSoft, min: 13 });
  if (deck.health) {
    const col = { Green: P.good, Yellow: 'D69200', Red: P.bad }[deck.health] || P.amber;
    o.rect(0.8, y + sh + 0.6, 3.0, 0.48, col, null, 0.06);
    o.text(`BUSINESS HEALTH: ${deck.health.toUpperCase()}`, { x: 0.8, y: y + sh + 0.73, w: 3.0, h: 0.24 }, { size: 10.5, bold: true, color: P.white, align: 'center', spacing: 1, caps: true });
  }
  o.text(deck.sourceNote || '', { x: 0.8, y: 5.55, w: tw, h: 0.5 }, { size: 10, color: P.mintSoft, min: 8 });
  o.text([deck.presenters, deck.date].filter(Boolean).join('   ·   '), { x: 0.8, y: 6.35, w: tw, h: 0.3 }, { size: 11, italic: true, color: P.white, min: 8 });
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
    o.text(s.value, { x: x + 0.25, y: y + 0.42, w: w * 0.55, h: 0.5 }, { size: 26, bold: true, serif: true, color: TONE[s.tone] && s.tone !== 'neutral' ? TONE[s.tone] : P.ink, min: 11, lineHeight: 1.05, maxLines: 1 });
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
  let sp = slide.spotlight || {};
  let hasSpot = [sp.label, sp.value, sp.text].some((v) => String(v || '').trim());
  if (!list.length && !hasSpot && Array.isArray(slide.kpis) && slide.kpis.length === 0) {
    sp = { label: 'The number that would change our mind', value: '—', caption: 'Metric · threshold · date', text: 'Fill in the spotlight fields in the editor below: which metric, what threshold, by when — and what you would do if it hits.' };
    hasSpot = true;
  }
  const bottom = bodyBottom(slide);
  const gap = 0.25;
  const count = Math.max(1, list.length);
  const w = (PAGE.w - 2 * M - gap * (count - 1)) / count;
  const th = !list.length && hasSpot ? -0.3 : hasSpot ? 1.75 : Math.min(2.6, bottom - BODY_TOP);
  (list.length || hasSpot ? list : [{ label: 'KPI', value: '—', sub: 'Insert a number from the CRM in the editor below' }]).forEach((k, i) => {
    const x = M + i * (w + gap), y = BODY_TOP;
    o.rect(x, y, w, th, P.card, P.line);
    o.text((k.label || '').toUpperCase(), { x: x + 0.25, y: y + 0.2, w: w - 0.5, h: 0.4 }, { size: 8.5, bold: true, color: P.ink3, spacing: 1, caps: true, min: 6.5 });
    o.text(k.value, { x: x + 0.25, y: y + 0.6, w: w - 0.5, h: 0.6 }, { size: 32, bold: true, serif: true, color: TONE[k.tone] && k.tone !== 'neutral' ? TONE[k.tone] : P.ink, min: 12, lineHeight: 1.05, maxLines: 1 });
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
    o.text(sp.value, { x: M + 0.4, y: y + 0.65, w: 4.4, h: only ? 1.2 : 0.9 }, { size: only ? 66 : 48, bold: true, serif: true, color: P.bad, min: 16, lineHeight: 1.0, maxLines: 1 });
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


// ---------------------------------------------------------------- Icons (drawn from primitives so they work everywhere)
function poly(o, pts, cx, cy, s, fill) {
  const u = s / 24;
  o.poly(pts.map(([x, y]) => [cx - s / 2 + x * u, cy - s / 2 + y * u]), fill);
}
export function drawIcon(o, name, cx, cy, d, bg, fg = P.white) {
  o.circle(cx, cy, d / 2, bg);
  const s = d * 0.56, u = s / 24, X = (x) => cx - s / 2 + x * u, Y = (y) => cy - s / 2 + y * u, R = (x, y, w, h, c = fg) => o.rect(X(x), Y(y), w * u, h * u, c);
  switch (name) {
    case 'up': poly(o, [[12, 2], [22, 12], [16, 12], [16, 22], [8, 22], [8, 12], [2, 12]], cx, cy, s, fg); break;
    case 'down': poly(o, [[12, 22], [22, 12], [16, 12], [16, 2], [8, 2], [8, 12], [2, 12]], cx, cy, s, fg); break;
    case 'alert': poly(o, [[12, 1.5], [23, 22], [1, 22]], cx, cy, s, fg); R(10.6, 8, 2.8, 8, bg); o.circle(X(12), Y(19), 1.6 * u, bg); break;
    case 'target': o.circle(cx, cy, s / 2, fg); o.circle(cx, cy, s * 0.34, bg); o.circle(cx, cy, s * 0.2, fg); o.circle(cx, cy, s * 0.07, bg); break;
    case 'people': o.circle(X(8), Y(7), 3.6 * u, fg); o.circle(X(16.5), Y(7.5), 3 * u, fg); R(2, 12.5, 12, 9.5); R(12.5, 13, 9.5, 8.5); break;
    case 'cash': R(1, 5, 22, 14); R(3, 7, 18, 10, bg); o.circle(cx, cy, 3.4 * u, fg); break;
    case 'chart': R(2, 14, 5, 8); R(9.5, 8, 5, 14); R(17, 2, 5, 20); break;
    case 'check': poly(o, [[2, 12.5], [5.5, 9], [9.5, 13], [18.5, 4], [22, 7.5], [9.5, 20]], cx, cy, s, fg); break;
    case 'calendar': R(2, 4, 20, 18); R(4, 9, 16, 11, bg); R(6, 11, 4, 3); R(14, 11, 4, 3); R(6, 16, 4, 3); R(6, 1.5, 2.5, 5); R(15.5, 1.5, 2.5, 5); break;
    case 'clock': o.circle(cx, cy, s / 2, fg); o.circle(cx, cy, s * 0.4, bg); R(11, 5.5, 2, 7.5); R(11, 11, 6, 2); break;
    case 'flag': R(3, 2, 2.5, 20); poly(o, [[5.5, 3], [21, 3], [17, 8.5], [21, 14], [5.5, 14]], cx, cy, s, fg); break;
    case 'shield': poly(o, [[12, 1.5], [21, 5], [20, 14], [12, 22.5], [4, 14], [3, 5]], cx, cy, s, fg); break;
    default: break;
  }
}
const toneColor = (t) => (TONE[t] && t !== 'neutral' ? TONE[t] : P.green);

export function containBox(iw, ih, box) {
  if (!iw || !ih) return { x: box.x, y: box.y, w: box.w, h: box.h };
  const r = Math.min(box.w / iw, box.h / ih);
  const w = iw * r, h = ih * r;
  return { x: box.x + (box.w - w) / 2, y: box.y + (box.h - h) / 2, w, h };
}

function bignumbers(o, slide, deck, state, n, total) {
  chrome(o, slide, deck, n, total);
  const list = filled(slide.items).slice(0, 3);
  const items = list.length ? list : (slide.items && slide.items.length ? slide.items : [{}]).slice(0, 3).map((it) => ({ icon: it.icon || 'chart', value: '—', label: 'Insert a number from the CRM', sub: 'Use the picker in the editor below', tone: 'neutral' }));
  const bottom = bodyBottom(slide), gap = 0.3;
  const w = (PAGE.w - 2 * M - gap * (items.length - 1)) / items.length;
  const h = bottom - BODY_TOP;
  items.forEach((it, i) => {
    const x = M + i * (w + gap), y = BODY_TOP, col = toneColor(it.tone);
    o.rect(x, y, w, h, P.card, P.line);
    o.rect(x, y, w, 0.08, col);
    const d = Math.min(1.15, h * 0.28);
    if (it.icon) drawIcon(o, it.icon, x + w / 2, y + 0.35 + d / 2, d, col);
    const vy = y + (it.icon ? 0.55 + d : 0.6);
    o.text(it.value, { x: x + 0.2, y: vy, w: w - 0.4, h: 1.0 }, { size: items.length === 1 ? 88 : 60, bold: true, serif: true, color: col, align: 'center', min: 16, lineHeight: 1.0, maxLines: 1 });
    const ly = vy + (items.length === 1 ? 1.35 : 1.0);
    const lh = o.text(it.label, { x: x + 0.3, y: ly, w: w - 0.6, h: 0.75 }, { size: 17, bold: true, color: P.ink, align: 'center', min: 11, lineHeight: 1.2 });
    o.text(it.sub, { x: x + 0.3, y: ly + Math.max(lh, 0.3) + 0.08, w: w - 0.6, h: Math.max(0.3, y + h - (ly + Math.max(lh, 0.3) + 0.08) - 0.2) }, { size: 12, color: P.ink3, align: 'center', min: 8 });
  });
}

function hero(o, slide, deck, state, n, total) {
  chrome(o, slide, deck, n, total);
  const bottom = bodyBottom(slide);
  const stats = filled(slide.stats).slice(0, 3);
  const sw = stats.length ? 3.0 : 0;
  const data = slide.chart ? chartData(slide.chart, state) : null;
  const cx = M + (sw ? sw + 0.3 : 0), cw = PAGE.w - M - cx;
  if (data) o.chart(data, { x: cx, y: BODY_TOP, w: cw, h: bottom - BODY_TOP, big: true });
  else { o.rect(cx, BODY_TOP, cw, bottom - BODY_TOP, P.card, P.line); o.text('Choose a chart', { x: cx, y: (BODY_TOP + bottom) / 2 - 0.15, w: cw, h: 0.3 }, { size: 13, color: P.ink3, align: 'center' }); }
  if (!stats.length) return;
  const gap = 0.2, h = (bottom - BODY_TOP - gap * (stats.length - 1)) / stats.length;
  stats.forEach((st, i) => {
    const y = BODY_TOP + i * (h + gap), col = toneColor(st.tone);
    o.rect(M, y, sw, h, P.card, P.line);
    o.rect(M, y, 0.08, h, col);
    const vh = o.text(st.value, { x: M + 0.3, y: y + Math.max(0.15, h / 2 - 0.62), w: sw - 0.45, h: 0.75 }, { size: 40, bold: true, serif: true, color: col, min: 14, lineHeight: 1.0, maxLines: 1 });
    o.text(st.label, { x: M + 0.3, y: y + Math.max(0.15, h / 2 - 0.62) + vh + 0.08, w: sw - 0.45, h: Math.max(0.3, h / 2) }, { size: 12.5, color: P.ink2, min: 8, lineHeight: 1.2 });
  });
}

function twocharts(o, slide, deck, state, n, total) {
  chrome(o, slide, deck, n, total);
  const bottom = bodyBottom(slide), gap = 0.3;
  const w = (PAGE.w - 2 * M - gap) / 2;
  const caps = slide.captions || [];
  [slide.chart, slide.chart2].forEach((id, i) => {
    const x = M + i * (w + gap);
    const capH = caps[i] && caps[i].trim() ? 0.55 : 0;
    const data = id ? chartData(id, state) : null;
    if (data) o.chart(data, { x, y: BODY_TOP, w, h: bottom - BODY_TOP - capH });
    else { o.rect(x, BODY_TOP, w, bottom - BODY_TOP - capH, P.card, P.line); o.text(`Choose chart ${i + 1}`, { x, y: (BODY_TOP + bottom) / 2 - 0.15, w, h: 0.3 }, { size: 12, color: P.ink3, align: 'center' }); }
    if (capH) o.text(caps[i], { x: x + 0.1, y: bottom - capH + 0.12, w: w - 0.2, h: capH - 0.1 }, { size: 13, bold: true, color: P.ink, align: 'center', min: 9 });
  });
}

const parseAmount = (v) => {
  const m = String(v || '').replace(/[$,\s]/g, '').match(/^(-?\d+(?:\.\d+)?)([kKmM]?)/);
  if (!m) return NaN;
  return Number(m[1]) * (/k/i.test(m[2]) ? 1e3 : /m/i.test(m[2]) ? 1e6 : 1);
};

function allocation(o, slide, deck, state, n, total) {
  chrome(o, slide, deck, n, total);
  const items = filled(slide.items).slice(0, 4);
  const list = items.length ? items : [{ label: 'Add up to four allocations', amount: '', why: '' }];
  const amts = list.map((i) => parseAmount(i.amount));
  const sum = amts.reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0);
  const colors = [P.green, '2E8B57', '6BBF8E', 'A9D9BC'];
  const bottom = bodyBottom(slide);
  const compact = (v) => (v >= 1e6 ? `$${+(v / 1e6).toFixed(2)}M` : v >= 1e3 ? `$${+(v / 1e3).toFixed(1)}K` : `$${Math.round(v)}`);
  o.text(sum ? compact(sum) : '$—', { x: M, y: BODY_TOP - 0.05, w: 4.2, h: 0.85 }, { size: 54, bold: true, serif: true, color: P.green, min: 24, lineHeight: 1.0 });
  o.text(`allocated across ${list.length} priorit${list.length === 1 ? 'y' : 'ies'}`, { x: M + 4.3, y: BODY_TOP + 0.38, w: 6, h: 0.35 }, { size: 15, color: P.ink2, min: 10 });
  const by = BODY_TOP + 1.05, bh = 0.75, bw = PAGE.w - 2 * M;
  let x = M;
  list.forEach((it, i) => {
    const share = sum ? (Number.isFinite(amts[i]) ? amts[i] : 0) / sum : 1 / list.length;
    const w = bw * share;
    if (w <= 0) return;
    o.rect(x, by, w, bh, colors[i % colors.length]);
    if (w > 0.8) o.text(`${Math.round(share * 100)}%`, { x, y: by + 0.22, w, h: 0.32 }, { size: 16, bold: true, color: i >= 2 ? P.ink : P.white, align: 'center', min: 9 });
    x += w;
  });
  const gap = 0.3, cw = (bw - gap * (list.length - 1)) / list.length, cy = by + bh + 0.35;
  list.forEach((it, i) => {
    const cx = M + i * (cw + gap);
    o.rect(cx, cy, 0.22, 0.22, colors[i % colors.length]);
    o.text(it.amount || '', { x: cx + 0.35, y: cy - 0.12, w: cw - 0.35, h: 0.6 }, { size: 30, bold: true, serif: true, color: P.ink, min: 14, lineHeight: 1.0, maxLines: 1 });
    const lh = o.text(it.label, { x: cx, y: cy + 0.6, w: cw, h: 0.65 }, { size: 16, bold: true, color: P.ink, min: 10, lineHeight: 1.15 });
    o.text(it.why, { x: cx, y: cy + 0.7 + Math.max(lh, 0.3), w: cw, h: Math.max(0.3, bottom - (cy + 0.7 + Math.max(lh, 0.3))) }, { size: 12, color: P.ink2, min: 8, lineHeight: 1.25 });
  });
}

function compare(o, slide, deck, state, n, total) {
  chrome(o, slide, deck, n, total);
  const rows = filled(slide.rows).slice(0, 4);
  const list = rows.length ? rows : [{ icon: 'flag', from: 'What the plan assumes', to: 'What you would change it to', why: '' }];
  const bottom = bodyBottom(slide);
  const top = BODY_TOP + 0.35, gap = 0.18;
  const h = Math.min(1.15, (bottom - top - gap * (list.length - 1)) / list.length);
  const iconW = 0.95, fw = 3.9, aw = 0.75, tw = 3.9, ww = PAGE.w - 2 * M - iconW - fw - aw - tw - 0.2;
  const fx = M + iconW, ax = fx + fw, tx = ax + aw, wx = tx + tw + 0.2;
  o.text('CURRENT PLAN', { x: fx, y: BODY_TOP, w: fw, h: 0.22 }, { size: 9, bold: true, color: P.ink3, spacing: 1.5, caps: true });
  o.text('WHAT WE WOULD CHANGE', { x: tx, y: BODY_TOP, w: tw, h: 0.22 }, { size: 9, bold: true, color: P.green2, spacing: 1.5, caps: true });
  o.text('BECAUSE', { x: wx, y: BODY_TOP, w: ww, h: 0.22 }, { size: 9, bold: true, color: P.ink3, spacing: 1.5, caps: true });
  list.forEach((r, i) => {
    const y = top + i * (h + gap);
    drawIcon(o, r.icon || 'flag', M + 0.4, y + h / 2, Math.min(0.7, h * 0.75), P.dark);
    o.rect(fx, y, fw, h, 'E6EAE7');
    o.text(r.from, { x: fx + 0.25, y: y + 0.15, w: fw - 0.5, h: h - 0.3 }, { size: 15, color: P.ink2, min: 9, valign: 'middle' });
    poly(o, [[2, 9], [14, 9], [14, 3], [23, 12], [14, 21], [14, 15], [2, 15]], ax + aw / 2, y + h / 2, 0.5, P.green2);
    o.rect(tx, y, tw, h, 'E1F1E7', P.green2);
    o.text(r.to, { x: tx + 0.25, y: y + 0.15, w: tw - 0.5, h: h - 0.3 }, { size: 15, bold: true, color: P.green, min: 9, valign: 'middle' });
    o.text(r.why, { x: wx, y: y + 0.12, w: ww, h: h - 0.24 }, { size: 11.5, color: P.ink2, min: 7.5, valign: 'middle' });
  });
}

function imageLayout(o, slide, deck, state, n, total) {
  chrome(o, slide, deck, n, total);
  const bottom = bodyBottom(slide);
  const pts = filled(slide.points).slice(0, 3);
  const iw = pts.length ? 7.6 : PAGE.w - 2 * M;
  const box = { x: M, y: BODY_TOP, w: iw, h: bottom - BODY_TOP };
  o.rect(box.x, box.y, box.w, box.h, 'E6EAE7');
  if (slide.image) o.image(slide.image, { ...containBox(slide.imageW, slide.imageH, box), clip: box });
  else o.text('Upload an image: a product screenshot, a customer photo, a chart from another tool', { x: box.x + 0.5, y: box.y + box.h / 2 - 0.3, w: box.w - 1, h: 0.6 }, { size: 13, color: P.ink3, align: 'center' });
  if (!pts.length) return;
  const x = M + iw + 0.35, w = PAGE.w - M - x, gap = 0.2;
  const h = (bottom - BODY_TOP - gap * (pts.length - 1)) / pts.length;
  pts.forEach((p, i) => {
    const y = BODY_TOP + i * (h + gap);
    o.rect(x, y, w, h, P.card, P.line);
    o.rect(x, y, 0.08, h, P.green);
    const vh = o.text(p.value, { x: x + 0.3, y: y + Math.max(0.15, h / 2 - 0.6), w: w - 0.45, h: 0.75 }, { size: 38, bold: true, serif: true, color: P.green, min: 13, lineHeight: 1.0, maxLines: 1 });
    o.text(p.label, { x: x + 0.3, y: y + Math.max(0.15, h / 2 - 0.6) + vh + 0.08, w: w - 0.45, h: Math.max(0.3, h / 2) }, { size: 13, color: P.ink2, min: 8 });
  });
}


// ---------------------------------------------------------------- Executive summary: one tile per board question
const QUESTION_LABELS = ['Growth plan', 'CEO dashboard', 'Biggest risk', 'Investment', 'Plan changes', 'Pivot trigger'];

function firstNumber(sl) {
  if (!sl) return { value: '', tone: 'neutral' };
  const pools = [sl.items, sl.stats, sl.kpis, sl.points].filter(Array.isArray);
  for (const pool of pools) for (const it of pool) {
    const v = String(it?.value || it?.amount || '').trim();
    if (v && v !== '—') return { value: v, tone: it.tone || 'neutral' };
  }
  if (sl.spotlight?.value) return { value: sl.spotlight.value, tone: 'bad' };
  if (sl.layout === 'allocation') {
    const sum = (sl.items || []).reduce((a, i) => a + (parseAmount(i.amount) || 0), 0);
    if (sum) return { value: sum >= 1e3 ? `$${+(sum / 1e3).toFixed(1)}K` : `$${sum}`, tone: 'neutral' };
  }
  return { value: '', tone: 'neutral' };
}

// Derive each tile from the matching "Question N" slide unless the team typed an override.
export function summaryTiles(slide, deck) {
  const items = slide.items || [];
  return QUESTION_LABELS.map((label, i) => {
    const q = (deck.slides || []).find((x) => x.kind === 'content' && x.layout !== 'summary' && new RegExp(`^question\\s*${i + 1}\\b`, 'i').test(x.eyebrow || ''));
    const own = items[i] || {};
    const derived = firstNumber(q);
    const fromTitle = q && q.title && !q.hint?.includes(q.title) && !TEMPLATE_TITLES.has(q.title) ? q.title : '';
    const qLabel = q?.eyebrow ? q.eyebrow.split('·').slice(1).join('·').trim() || label : label;
    return {
      n: i + 1, label: qLabel,
      answer: (own.answer || '').trim() || fromTitle,
      value: (own.value || '').trim() || derived.value,
      tone: own.tone && own.tone !== 'neutral' ? own.tone : derived.tone,
    };
  });
}
const TEMPLATE_TITLES = new Set(['Is the 2027 growth plan realistic?', 'Three KPIs for the CEO dashboard', 'Our biggest financial or operating risk', 'Where we would invest the next $100,000', 'What we would change in the current plan', 'The data point that would change our recommendation']);

function summary(o, slide, deck, state, n, total) {
  chrome(o, slide, deck, n, total);
  const tiles = summaryTiles(slide, deck);
  const bottom = bodyBottom(slide), gap = 0.22, cols = 3, rows = 2;
  const w = (PAGE.w - 2 * M - gap * (cols - 1)) / cols;
  const h = (bottom - BODY_TOP - gap * (rows - 1)) / rows;
  tiles.forEach((t, i) => {
    const x = M + (i % cols) * (w + gap), y = BODY_TOP + Math.floor(i / cols) * (h + gap);
    const col = toneColor(t.tone);
    o.rect(x, y, w, h, P.card, P.line);
    o.rect(x, y, w, 0.07, col);
    o.circle(x + 0.42, y + 0.45, 0.22, P.dark);
    o.text(`Q${t.n}`, { x: x + 0.2, y: y + 0.36, w: 0.44, h: 0.2 }, { size: 9.5, bold: true, color: P.white, align: 'center', min: 7 });
    o.text(t.label.toUpperCase(), { x: x + 0.75, y: y + 0.37, w: w - 0.95, h: 0.2 }, { size: 9, bold: true, color: P.ink3, spacing: 1.2, caps: true, min: 7, maxLines: 1 });
    const vh = t.value ? o.text(t.value, { x: x + 0.25, y: y + 0.78, w: w - 0.5, h: 0.62 }, { size: 34, bold: true, serif: true, color: col, min: 14, lineHeight: 1.0, maxLines: 1 }) : 0;
    const ay = y + 0.78 + (vh ? vh + 0.12 : 0);
    o.text(t.answer || 'Fills in from this question’s slide headline', { x: x + 0.25, y: ay, w: w - 0.5, h: Math.max(0.3, y + h - ay - 0.18) }, { size: 13, bold: !!t.answer, color: t.answer ? P.ink : P.ink3, min: 11, lineHeight: 1.22 });
  });
}

// ---------------------------------------------------------------- Chart → primitive ops (preview + PDF)
export function chartOps(data, box) {
  const o = Ops();
  const { x, y, w, h } = box;
  o.rect(x, y, w, h, P.card, P.line);
  const pad = 0.25;
  const big = !!box.big;
  const th = o.text(data.title, { x: x + pad, y: y + 0.18, w: w - 2 * pad, h: 0.34 }, { size: big ? 14 : 11.5, bold: true, color: P.ink, min: 8 });
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
