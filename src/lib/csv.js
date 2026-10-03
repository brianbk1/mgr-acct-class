// Small, dependency-free CSV parser that handles quoted fields, escaped quotes,
// commas/newlines inside quotes, CRLF line endings and tab-delimited files.
export function parseCSV(text) {
  const src = text.replace(/^﻿/, '');
  const firstLine = src.split(/\r?\n/)[0] || '';
  const delim = (firstLine.match(/\t/g) || []).length > (firstLine.match(/,/g) || []).length ? '\t' : ',';

  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
      continue;
    }
    if (c === '"') inQuotes = true;
    else if (c === delim) { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some((v) => v.trim() !== '')) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((v) => v.trim() !== '')) rows.push(row);

  if (rows.length < 2) throw new Error('The file needs a header row and at least one data row.');

  const seen = {};
  const columns = rows[0].map((h, i) => {
    let name = h.trim() || `column_${i + 1}`;
    if (seen[name]) name = `${name}_${++seen[name]}`;
    else seen[name] = 1;
    return name;
  });

  const data = rows.slice(1).map((r) => {
    const obj = {};
    columns.forEach((col, i) => { obj[col] = (r[i] ?? '').trim(); });
    return obj;
  });

  return { columns, rows: data };
}

export function toCSV(columns, rows) {
  const esc = (v) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [columns.map(esc).join(','), ...rows.map((r) => columns.map((c) => esc(r[c])).join(','))].join('\n');
}
