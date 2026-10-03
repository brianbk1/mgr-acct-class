// PowerPoint (.pptx) and PDF export. Both draw from the same slide model so the files match.
// Libraries are loaded on demand so the CRM views stay fast.
import { chartData, fmtUnit } from './deck.js';

const C = { green: '006027', green2: '008350', ink: '231F20', ink2: '4A4F4C', ink3: '737A76', gray: 'E3E6E4', line: 'C9CFCB', white: 'FFFFFF', warn: 'A8670F' };

function today() {
  return new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

function contentSlides(deck) {
  return deck.slides.filter((s) => s.kind === 'content');
}

function bulletsOf(s) {
  return (s.bullets || []).map((b) => b.trim()).filter(Boolean);
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

function safeName(t) {
  return (t || 'presentation').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-').slice(0, 60) || 'presentation';
}

// ---------------------------------------------------------------- PPTX
export async function buildPptx(deck, state, outputType = 'blob') {
  const { default: PptxGenJS } = await import('pptxgenjs');
  const pres = new PptxGenJS();
  pres.layout = 'LAYOUT_WIDE'; // 13.33 x 7.5 in
  pres.title = deck.title;
  pres.company = state.data.files.company?.rows[0]?.company_name || '';

  const W = 13.33;
  const total = deck.slides.length;
  const footer = (slide, n, source) => {
    slide.addShape(pres.ShapeType.line, { x: 0.6, y: 6.95, w: W - 1.2, h: 0, line: { color: C.line, width: 0.75 } });
    slide.addText(source ? `Source: ${source}` : deck.title, { x: 0.6, y: 7.0, w: W - 2.4, h: 0.3, fontSize: 9, color: C.ink3, fontFace: 'Calibri' });
    slide.addText(`${n} / ${total}`, { x: W - 1.8, y: 7.0, w: 1.2, h: 0.3, fontSize: 9, color: C.ink3, align: 'right', fontFace: 'Calibri' });
  };

  deck.slides.forEach((s, i) => {
    const slide = pres.addSlide();
    slide.background = { color: C.white };
    if (s.kind === 'title') {
      slide.addShape(pres.ShapeType.rect, { x: 0, y: 0, w: W, h: 7.5, fill: { color: C.gray } });
      slide.addShape(pres.ShapeType.rect, { x: 0.6, y: 2.2, w: 0.12, h: 2.2, fill: { color: C.green } });
      slide.addText(deck.title, { x: 0.95, y: 2.1, w: W - 2, h: 1.3, fontSize: 40, bold: true, color: C.green, fontFace: 'Georgia', valign: 'top' });
      slide.addText(deck.subtitle || '', { x: 0.95, y: 3.45, w: W - 2, h: 0.6, fontSize: 20, color: C.ink2, fontFace: 'Calibri' });
      slide.addText([deck.presenters, today()].filter(Boolean).join('  ·  '), { x: 0.95, y: 4.1, w: W - 2, h: 0.4, fontSize: 14, color: C.ink3, fontFace: 'Calibri' });
      return;
    }
    if (s.kind === 'evidence') {
      slide.addText(s.title || 'Evidence appendix', { x: 0.6, y: 0.4, w: W - 1.2, h: 0.8, fontSize: 28, bold: true, color: C.green, fontFace: 'Georgia' });
      const ev = state.evidence || [];
      if (!ev.length) {
        slide.addText('No evidence pinned yet. Pin data points in the CRM tabs to list them here.', { x: 0.6, y: 1.5, w: W - 1.2, h: 0.6, fontSize: 16, color: C.ink3 });
      } else {
        const rows = [
          ['Data point', 'Value', 'Source'].map((t) => ({ text: t, options: { bold: true, color: C.white, fill: { color: C.green } } })),
          ...ev.slice(0, 14).map((e) => [e.label, e.value, e.fileName]),
        ];
        slide.addTable(rows, { x: 0.6, y: 1.35, w: W - 1.2, colW: [4.4, 4.9, 2.83], fontSize: 11, fontFace: 'Calibri', color: C.ink, border: { type: 'solid', color: C.line, pt: 0.5 }, autoPage: false });
      }
      footer(slide, i + 1, '');
      return;
    }
    const chart = s.chart ? chartData(s.chart, state) : null;
    const bullets = bulletsOf(s);
    slide.addText(s.title || '', { x: 0.6, y: 0.4, w: W - 1.2, h: 0.9, fontSize: 28, bold: true, color: C.green, fontFace: 'Georgia', valign: 'top' });
    slide.addShape(pres.ShapeType.rect, { x: 0.6, y: 1.3, w: 1.0, h: 0.06, fill: { color: C.green2 } });
    const textW = chart ? 6.2 : W - 1.2;
    if (bullets.length) {
      slide.addText(
        bullets.map((b) => ({ text: b, options: { bullet: { code: '25A0' }, paraSpaceAfter: 10 } })),
        { x: 0.6, y: 1.6, w: textW, h: 5.1, fontSize: bullets.length > 5 ? 15 : 18, color: C.ink, fontFace: 'Calibri', valign: 'top' }
      );
    }
    if (chart) {
      const numFmt = chart.unit === '$' ? '$#,##0' : chart.unit === '%' ? '0.0"%"' : chart.unit === 'x' ? '0.0"x"' : '#,##0';
      const opts = {
        x: 7.1, y: 1.6, w: 5.6, h: 4.6,
        chartColors: [C.green],
        showTitle: true, title: chart.title, titleFontSize: 13, titleColor: C.ink, titleFontFace: 'Calibri',
        catAxisLabelFontSize: 9, valAxisLabelFontSize: 9, catAxisLabelColor: C.ink2, valAxisLabelColor: C.ink2,
        valAxisLabelFormatCode: numFmt, dataLabelFormatCode: numFmt,
        valGridLine: { color: 'E8ECE9', size: 0.5 }, catGridLine: { style: 'none' },
        showLegend: false,
      };
      if (chart.type === 'bar') {
        Object.assign(opts, { barDir: chart.labels.length > 6 ? 'bar' : 'col', showValue: chart.labels.length <= 8, dataLabelFontSize: 9, dataLabelColor: C.ink2 });
        if (chart.labels.length > 6) opts.catAxisOrientation = 'maxMin';
        slide.addChart(pres.ChartType.bar, [{ name: chart.title, labels: chart.labels, values: chart.values.map((v) => (Number.isFinite(v) ? v : 0)) }], opts);
      } else {
        Object.assign(opts, { lineSize: 2.5, lineDataSymbol: 'circle', lineDataSymbolSize: 6 });
        slide.addChart(pres.ChartType.line, [{ name: chart.title, labels: chart.labels, values: chart.values.map((v) => (Number.isFinite(v) ? v : 0)) }], opts);
      }
      const caption = [chart.reference ? `${chart.reference.label}: ${fmtUnit(chart.reference.value, chart.unit)}` : '', chart.note].filter(Boolean).join('   ·   ');
      if (caption) slide.addText(caption, { x: 7.1, y: 6.25, w: 5.6, h: 0.35, fontSize: 10, color: C.warn, fontFace: 'Calibri' });
    }
    if (s.notes) slide.addNotes(s.notes);
    footer(slide, i + 1, chart?.source || '');
  });

  return pres.write({ outputType });
}

export async function exportPptx(deck, state) {
  const blob = await buildPptx(deck, state, 'blob');
  downloadBlob(blob, `${safeName(deck.title)}.pptx`);
}

// ---------------------------------------------------------------- PDF
// jsPDF's built-in fonts cover Latin-1, so typographic characters are mapped to safe equivalents.
function latin1(s) {
  return String(s ?? '')
    .replace(/[‘’‚′]/g, "'").replace(/[“”„″]/g, '"').replace(/[–—]/g, '-').replace(/…/g, '...')
    .replace(/•/g, '-').replace(/→/g, '->').replace(/←/g, '<-').replace(/≈/g, '~').replace(/≥/g, '>=').replace(/≤/g, '<=')
    .replace(/×/g, 'x').replace(/÷/g, '/').replace(/[^\x00-\xFF]/g, '');
}

function hex(h) { return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }

export async function buildPdf(deck, state) {
  const { jsPDF } = await import('jspdf');
  const W = 960, H = 540;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: [W, H] });
  const total = deck.slides.length;
  const color = (h) => doc.setTextColor(...hex(h));
  const fill = (h) => doc.setFillColor(...hex(h));
  const stroke = (h) => doc.setDrawColor(...hex(h));

  const footer = (n, source) => {
    stroke(C.line); doc.setLineWidth(0.6); doc.line(44, H - 34, W - 44, H - 34);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); color(C.ink3);
    doc.text(latin1(source ? `Source: ${source}` : deck.title), 44, H - 20, { maxWidth: W - 180 });
    doc.text(`${n} / ${total}`, W - 44, H - 20, { align: 'right' });
  };

  deck.slides.forEach((s, i) => {
    if (i > 0) doc.addPage([W, H], 'landscape');
    if (s.kind === 'title') {
      fill(C.gray); doc.rect(0, 0, W, H, 'F');
      fill(C.green); doc.rect(44, 170, 8, 150, 'F');
      doc.setFont('times', 'bold'); doc.setFontSize(36); color(C.green);
      const tl = doc.splitTextToSize(latin1(deck.title), W - 160);
      doc.text(tl, 72, 205);
      const y = 205 + tl.length * 40;
      doc.setFont('helvetica', 'normal'); doc.setFontSize(18); color(C.ink2);
      doc.text(latin1(deck.subtitle || ''), 72, y + 6, { maxWidth: W - 160 });
      doc.setFontSize(12.5); color(C.ink3);
      doc.text(latin1([deck.presenters, today()].filter(Boolean).join('  ·  ')), 72, y + 34, { maxWidth: W - 160 });
      return;
    }
    doc.setFont('times', 'bold'); doc.setFontSize(24); color(C.green);
    const tl = doc.splitTextToSize(latin1(s.title || ''), W - 88);
    doc.text(tl.slice(0, 2), 44, 62);
    const top = 62 + Math.min(tl.length, 2) * 26;
    fill(C.green2); doc.rect(44, top - 8, 70, 4, 'F');

    if (s.kind === 'evidence') {
      const ev = state.evidence || [];
      let y = top + 22;
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); fill(C.green); doc.rect(44, y - 13, W - 88, 20, 'F'); color(C.white);
      doc.text('Data point', 52, y); doc.text('Value', 360, y); doc.text('Source', 760, y);
      doc.setFont('helvetica', 'normal'); color(C.ink);
      if (!ev.length) { color(C.ink3); doc.text('No evidence pinned yet.', 52, y + 28); }
      ev.slice(0, 14).forEach((e) => {
        y += 24;
        const v = doc.splitTextToSize(latin1(e.value), 390);
        doc.text(doc.splitTextToSize(latin1(e.label), 300)[0], 52, y);
        doc.text(v[0] + (v.length > 1 ? '...' : ''), 360, y);
        doc.text(latin1(e.fileName), 760, y, { maxWidth: 160 });
        stroke(C.line); doc.setLineWidth(0.4); doc.line(44, y + 8, W - 44, y + 8);
      });
      footer(i + 1, '');
      return;
    }

    const chart = s.chart ? chartData(s.chart, state) : null;
    const bullets = bulletsOf(s);
    const textW = chart ? 420 : W - 100;
    let y = top + 24;
    const size = bullets.length > 5 ? 13 : 15.5;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(size); color(C.ink);
    bullets.forEach((b) => {
      const lines = doc.splitTextToSize(latin1(b), textW - 20);
      if (y + lines.length * size * 1.25 > H - 50) return;
      fill(C.green2); doc.rect(46, y - size * 0.42, 5, 5, 'F');
      doc.text(lines, 62, y);
      y += lines.length * size * 1.25 + 9;
    });
    if (chart) drawPdfChart(doc, chart, { x: 500, y: top + 6, w: 416, h: 330 }, { color, fill, stroke });
    footer(i + 1, chart?.source || '');
  });

  return doc;
}

export async function exportPdf(deck, state) {
  const doc = await buildPdf(deck, state);
  downloadBlob(doc.output('blob'), `${safeName(deck.title)}.pdf`);
}

function drawPdfChart(doc, chart, box, pen) {
  const { x, y, w, h } = box;
  const vals = chart.values.map((v) => (Number.isFinite(v) ? v : 0));
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11); pen.color(C.ink);
  doc.text(latin1(chart.title), x, y + 4, { maxWidth: w });
  const top = y + 22, bottom = y + h - (chart.type === 'line' ? 30 : 6);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8);

  if (chart.type === 'bar') {
    const n = vals.length;
    const labelW = 120;
    const max = Math.max(0, ...vals, chart.reference?.value || 0);
    const min = Math.min(0, ...vals);
    const range = max - min || 1;
    const plotX = x + labelW, plotW = w - labelW - 60;
    const sx = (v) => plotX + ((v - min) / range) * plotW;
    const rowH = Math.min(26, (bottom - top) / n);
    vals.forEach((v, i) => {
      const ry = top + i * rowH;
      pen.color(C.ink2);
      doc.text(latin1(String(chart.labels[i])).slice(0, 24), plotX - 6, ry + rowH / 2 + 3, { align: 'right' });
      pen.fill(v < 0 ? 'B3362D' : C.green);
      const x0 = sx(Math.min(0, v)), x1 = sx(Math.max(0, v));
      doc.rect(x0, ry + rowH * 0.18, Math.max(1, x1 - x0), rowH * 0.64, 'F');
      pen.color(C.ink);
      doc.text(latin1(fmtUnit(chart.values[i], chart.unit)), x1 + 4, ry + rowH / 2 + 3);
    });
    if (min < 0) { pen.stroke(C.ink3); doc.setLineWidth(0.5); doc.line(sx(0), top, sx(0), top + n * rowH); }
  } else {
    const n = vals.length;
    let max = Math.max(...vals, chart.reference?.value ?? -Infinity);
    let min = Math.min(...vals, chart.reference?.value ?? Infinity);
    if (min === max) { min -= 1; max += 1; }
    const pad = (max - min) * 0.1; max += pad; min -= pad;
    const plotX = x + 58, plotW = w - 66;
    const sx = (i) => plotX + (n > 1 ? (i * plotW) / (n - 1) : plotW / 2);
    const sy = (v) => bottom - ((v - min) / (max - min)) * (bottom - top);
    pen.stroke('E2E7E3'); doc.setLineWidth(0.5);
    for (let t = 0; t <= 4; t++) {
      const v = min + ((max - min) * t) / 4;
      doc.line(plotX, sy(v), plotX + plotW, sy(v));
      pen.color(C.ink3); doc.text(latin1(fmtUnit(v, chart.unit)), plotX - 6, sy(v) + 3, { align: 'right' });
    }
    if (min < 0 && max > 0) { pen.stroke(C.ink3); doc.line(plotX, sy(0), plotX + plotW, sy(0)); }
    if (chart.reference) {
      pen.stroke(C.warn); doc.setLineWidth(1); doc.setLineDashPattern([4, 3], 0);
      doc.line(plotX, sy(chart.reference.value), plotX + plotW, sy(chart.reference.value));
      doc.setLineDashPattern([], 0);
      pen.color(C.warn); doc.text(latin1(`${chart.reference.label} ${fmtUnit(chart.reference.value, chart.unit)}`), plotX + plotW, sy(chart.reference.value) - 4, { align: 'right' });
    }
    pen.stroke(C.green); doc.setLineWidth(2);
    for (let i = 1; i < n; i++) doc.line(sx(i - 1), sy(vals[i - 1]), sx(i), sy(vals[i]));
    pen.fill(C.green);
    vals.forEach((v, i) => doc.circle(sx(i), sy(v), 2.6, 'F'));
    pen.color(C.ink3);
    const every = Math.ceil(n / 7);
    const lastShown = Math.floor((n - 1) / every) * every;
    chart.labels.forEach((l, i) => {
      const show = i % every === 0 || (i === n - 1 && n - 1 - lastShown >= every * 0.6);
      if (show) doc.text(latin1(String(l)), sx(i), bottom + 14, { align: 'center' });
    });
  }
  if (chart.note) { pen.color(C.ink3); doc.setFontSize(8); doc.text(latin1(chart.note), x, y + h + 10); }
}
