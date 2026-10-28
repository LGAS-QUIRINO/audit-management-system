// Records Management · Download what is on screen (Submission Monitor): PDF, Excel (.xlsx) or Word (.docx).
// Made on this computer from the table shown (filters, Show choice and search applied). Nothing is sent anywhere.
// Libraries load only when a download is asked for: jsPDF + AutoTable (PDF), ExcelJS (Excel), JSZip (Word).

const loaded = {};
const loadScript = (src) => (loaded[src] = loaded[src] || new Promise((ok, bad) => {
  const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => bad(new Error('Could not load ' + src + '. Check the internet connection.'));
  document.head.appendChild(s);
}));

// Status colors (same as the screen): [fill, text].
const COLORS = {
  complete: ['F2FAF3', '2E7D32'], late: ['FFF1E0', 'A55400'], verify: ['EEF4FF', '1D4FB8'], incomplete: ['FFFAEB', '8A6500'],
  overdue: ['D64545', 'FFFFFF'], notdue: ['FFFFFF', '9AA5BD'], nodue: ['FFFFFF', '9AA5BD'], untracked: ['FFFFFF', '9AA5BD'], annual: ['FFFFFF', '6B7A99'], na: ['FAFBFD', '9AA5BD']
};
const statusOf = (el) => Object.keys(COLORS).find((k) => el.classList.contains(k)) || '';
const clean = (t) => String(t || '').replace(/\s*\n\s*/g, ' ').replace(/\s+/g, ' ').trim();

// The table as rows of cells { text, colspan, rowspan, head, status, group }, visible rows only.
function readTable(table) {
  const rowsOf = (sec) => [...table.querySelectorAll(sec + ' > tr')].filter((tr) => sec === 'thead' || !tr.hidden);
  const cellsOf = (tr) => [...tr.children].map((c) => ({ text: clean(c.innerText), colspan: +(c.getAttribute('colspan') || 1), rowspan: +(c.getAttribute('rowspan') || 1),
    head: c.tagName === 'TH', status: statusOf(c), group: tr.classList.contains('acct-off') || tr.classList.contains('grp') }));
  return { head: rowsOf('thead').map(cellsOf), body: rowsOf('tbody').map(cellsOf) };
}
// Lay the rows on a grid (handles colspan/rowspan): grid[r][c] = { cell, first, covered }.
function toGrid(rows) {
  const grid = [];
  rows.forEach((row, r) => {
    grid[r] = grid[r] || [];
    let c = 0;
    row.forEach((cell) => {
      while (grid[r][c]) c++;
      for (let i = 0; i < cell.rowspan; i++) for (let j = 0; j < cell.colspan; j++) {
        grid[r + i] = grid[r + i] || [];
        grid[r + i][c + j] = { cell, first: i === 0 && j === 0, top: i === 0, left: j === 0 };
      }
      c += cell.colspan;
    });
  });
  const w = Math.max(0, ...grid.map((r) => r.length));
  return { grid, w };
}

// What is on screen: title, filters, the summary counts and the notes.
export function screenInfo() {
  const filters = [...document.querySelectorAll('.mon-filters label')].map((l) => {
    const name = clean(l.childNodes[0] && l.childNodes[0].nodeType === 3 ? l.childNodes[0].textContent : '');
    const sel = l.querySelector('select:not([data-show-sel])'), inp = l.querySelector('input');
    if (l.querySelector('.show-seg')) { const on = l.querySelector('.show-seg .on'); return 'Show: ' + (on ? (on.tagName === 'SELECT' ? on.options[on.selectedIndex].text : clean(on.innerText)) : 'Summary'); }
    if (sel) return name + ': ' + clean(sel.options[sel.selectedIndex]?.text);
    if (inp && inp.value.trim()) return name + ': "' + inp.value.trim() + '"';
    return '';
  }).filter(Boolean);
  const view = clean(document.querySelector('.mon-filters .seg:not(.show-seg) .on')?.innerText || '');
  const pick = (f) => { const el = document.querySelector(`.mon-filters [data-f="${f}"]`); return el ? clean(el.options[el.selectedIndex]?.text) : ''; };
  const show = (filters.find((f) => f.startsWith('Show: ')) || '').slice(6);
  const short = [pick('r').split(' · ')[0], pick('mo'), pick('y'), view, show && show !== 'Summary' ? show : ''].filter(Boolean).join(' ');
  return {
    title: 'Submission Monitor' + (view ? ' · ' + view : ''), short,
    filters: filters.join('   ·   '),
    counts: [...document.querySelectorAll('.mon-sum .pill')].map((p) => clean(p.innerText)).join('   '),
    notes: [...new Set([...document.querySelectorAll('.doc-key, section.panel > .note')].map((n) => clean(n.innerText)).filter(Boolean))],
    made: 'Downloaded ' + new Date().toLocaleString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
  };
}
const fileName = (info, ext) => ('Submission Monitor ' + info.short).replace(/[^A-Za-z0-9 ()-]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 100) + '.' + ext;
function save(blob, name) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
const LEGEND = '✓ complete / on time · L late · V for verification · M missing documents · ✗ document missing · ! overdue · · not yet due (or optional, not attached) · – N/A · — before monitoring · A replaced by the annual report';

/* ================= Excel ================= */
async function toExcel(table, info) {
  await loadScript('lib/exceljs.min.js');
  const t = readTable(table), H = toGrid(t.head), B = toGrid(t.body), w = Math.max(H.w, B.w);
  const wb = new window.ExcelJS.Workbook(); wb.creator = 'AMS · COA Quirino';
  const ws = wb.addWorksheet('Submission Monitor', { pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 5 } });
  const put = (r, text, opt = {}) => { ws.mergeCells(r, 1, r, w); const c = ws.getCell(r, 1); c.value = text; c.font = { bold: !!opt.bold, size: opt.size || 10, color: { argb: 'FF' + (opt.color || '1B2440') } }; c.alignment = { wrapText: true, vertical: 'top' }; };
  put(1, 'COMMISSION ON AUDIT · Province of Quirino', { bold: true, size: 11, color: '0B2A6B' });
  put(2, info.title, { bold: true, size: 14, color: '0B2A6B' });
  put(3, info.filters, { color: '5B6785' });
  put(4, info.counts, { color: '5B6785' });
  let r0 = 6;
  const border = { top: { style: 'thin', color: { argb: 'FFDFE5F1' } }, left: { style: 'thin', color: { argb: 'FFDFE5F1' } }, bottom: { style: 'thin', color: { argb: 'FFDFE5F1' } }, right: { style: 'thin', color: { argb: 'FFDFE5F1' } } };
  const write = (G, head) => {
    G.grid.forEach((row, i) => {
      const rr = r0 + i;
      row.forEach((g, c) => {
        if (!g) return;
        const cell = ws.getCell(rr, c + 1);
        cell.border = border;
        if (!g.first) return;
        if (g.cell.colspan > 1 || g.cell.rowspan > 1) ws.mergeCells(rr, c + 1, rr + g.cell.rowspan - 1, c + g.cell.colspan);
        const first = c === 0;
        cell.value = g.cell.text;
        const [fill, color] = COLORS[g.cell.status] || [head || g.cell.group ? 'F6F8FC' : 'FFFFFF', head ? '5B6785' : '1B2440'];
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + (g.cell.group ? 'EEF2FA' : fill) } };
        cell.font = { bold: head || g.cell.group || !!g.cell.status, size: head ? 9 : 10, color: { argb: 'FF' + color } };
        cell.alignment = { horizontal: first || g.cell.group ? 'left' : 'center', vertical: 'middle', wrapText: true };
      });
    });
    r0 += G.grid.length;
  };
  write(H, true); const headEnd = r0 - 1; write(B, false);
  ws.getColumn(1).width = 38;
  for (let c = 2; c <= w; c++) ws.getColumn(c).width = c === w ? 11 : w > 16 ? 7 : 10;
  ws.views = [{ state: 'frozen', xSplit: 1, ySplit: headEnd }];
  r0++; put(r0++, 'Legend: ' + LEGEND, { color: '5B6785', size: 9 });
  info.notes.forEach((n) => put(r0++, n, { color: '5B6785', size: 9 }));
  put(r0, info.made, { color: '9AA5BD', size: 9 });
  const buf = await wb.xlsx.writeBuffer();
  save(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), fileName(info, 'xlsx'));
}

/* ================= PDF ================= */
async function toPdf(table, info) {
  await loadScript('lib/jspdf.umd.min.js'); await loadScript('lib/jspdf.plugin.autotable.min.js');
  const { jsPDF } = window.jspdf;
  const t = readTable(table), w = Math.max(toGrid(t.head).w, toGrid(t.body).w);
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: w > 16 ? 'legal' : 'letter' });
  const pw = doc.internal.pageSize.getWidth();
  // ✓ and ✗ are drawn (the built-in PDF fonts have no such signs); other marks are plain letters.
  const pdfText = (s) => s === '✓' || s === '✗' ? '' : s.replace(/✓/g, 'ok').replace(/✗/g, 'x');
  const conv = (rows, head) => rows.map((row) => row.map((c, k) => {
    const [fill, color] = COLORS[c.status] || [head || c.group ? 'F6F8FC' : 'FFFFFF', head ? '5B6785' : '1B2440'];
    const hex = (h) => [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
    return { content: pdfText(c.text), colSpan: c.colspan, rowSpan: c.rowspan, mark: c.text,
      styles: { fillColor: hex(c.group ? 'EEF2FA' : fill), textColor: hex(color), fontStyle: head || c.group || c.status ? 'bold' : 'normal', halign: k === 0 || c.group ? 'left' : 'center' } };
  }));
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(11, 42, 107); doc.text('COMMISSION ON AUDIT · Province of Quirino', 36, 34);
  doc.setFontSize(14); doc.text(info.title, 36, 52);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(91, 103, 133);
  const lines = doc.splitTextToSize(pdfText(info.filters) + '\n' + pdfText(info.counts), pw - 72); doc.text(lines, 36, 66);
  doc.autoTable({
    head: conv(t.head, true), body: conv(t.body, false), startY: 66 + lines.length * 11 + 6, theme: 'grid',
    styles: { fontSize: w > 24 ? 6 : w > 14 ? 7 : 8, cellPadding: 3, lineColor: [223, 229, 241], lineWidth: 0.5, valign: 'middle', overflow: 'linebreak' },
    columnStyles: { 0: { cellWidth: w > 16 ? 150 : 190 } }, margin: { left: 36, right: 36 },
    didDrawCell: (d) => {
      const m = d.cell.raw && d.cell.raw.mark; if (m !== '✓' && m !== '✗') return;
      const x = d.cell.x + d.cell.width / 2, y = d.cell.y + d.cell.height / 2, s = Math.min(4, d.cell.height / 4);
      const col = d.cell.styles.textColor; doc.setDrawColor(col[0], col[1], col[2]); doc.setLineWidth(1.2);
      if (m === '✓') { doc.line(x - s, y, x - s / 3, y + s * 0.8); doc.line(x - s / 3, y + s * 0.8, x + s, y - s * 0.8); }
      else { doc.line(x - s * 0.8, y - s * 0.8, x + s * 0.8, y + s * 0.8); doc.line(x - s * 0.8, y + s * 0.8, x + s * 0.8, y - s * 0.8); }
    },
    didDrawPage: () => { const h = doc.internal.pageSize.getHeight(); doc.setFontSize(7.5); doc.setTextColor(154, 165, 189);
      doc.text(info.made + '   ·   Page ' + doc.internal.getNumberOfPages(), 36, h - 18); }
  });
  let y = doc.lastAutoTable.finalY + 14; const h = doc.internal.pageSize.getHeight();
  doc.setFontSize(7.5); doc.setTextColor(91, 103, 133);
  [('Legend: ' + LEGEND).replace(/✓/g, 'ok').replace(/✗/g, 'x'), ...info.notes.map(pdfText)].forEach((n) => {
    const ls = doc.splitTextToSize(n, pw - 72); if (y + ls.length * 9 > h - 30) { doc.addPage(); y = 40; } doc.text(ls, 36, y); y += ls.length * 9 + 3; });
  doc.save(fileName(info, 'pdf'));
}

/* ================= Word ================= */
const x = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
async function toWord(table, info) {
  await loadScript('lib/jszip.min.js');
  const t = readTable(table), H = toGrid(t.head), B = toGrid(t.body), w = Math.max(H.w, B.w);
  const legal = w > 16, pageW = legal ? 20160 : 15840, pageH = 12240, margin = 720, usable = pageW - 2 * margin;
  const firstW = Math.round(usable * (w > 16 ? 0.2 : 0.3)), otherW = Math.floor((usable - firstW) / Math.max(1, w - 1));
  const sz = w > 24 ? 12 : w > 14 ? 14 : 16;   // half-points
  const para = (text, { bold = false, size = 18, color = '1B2440', align = 'left' } = {}) =>
    `<w:p><w:pPr><w:spacing w:after="40"/><w:jc w:val="${align}"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/>${bold ? '<w:b/>' : ''}<w:color w:val="${color}"/><w:sz w:val="${size}"/></w:rPr><w:t xml:space="preserve">${x(text)}</w:t></w:r></w:p>`;
  const rowsXml = (G, head) => G.grid.map((row) => `<w:tr>${head ? '<w:trPr><w:tblHeader/></w:trPr>' : ''}${row.map((g, c) => {
    if (!g || !g.left) return '';
    const cell = g.cell, [fill, color] = COLORS[cell.status] || [head || cell.group ? 'F6F8FC' : 'FFFFFF', head ? '5B6785' : '1B2440'];
    const span = cell.colspan > 1 ? `<w:gridSpan w:val="${cell.colspan}"/>` : '';
    const vm = cell.rowspan > 1 ? (g.top ? '<w:vMerge w:val="restart"/>' : '<w:vMerge/>') : '';
    const width = (c === 0 ? firstW : otherW) + (cell.colspan - 1) * otherW;
    const body = g.top ? `<w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/>${head || cell.group || cell.status ? '<w:b/>' : ''}<w:color w:val="${color}"/><w:sz w:val="${sz}"/></w:rPr><w:t xml:space="preserve">${x(cell.text)}</w:t></w:r>` : '';
    return `<w:tc><w:tcPr><w:tcW w:w="${width}" w:type="dxa"/>${span}${vm}<w:shd w:val="clear" w:color="auto" w:fill="${cell.group ? 'EEF2FA' : fill}"/><w:vAlign w:val="center"/></w:tcPr><w:p><w:pPr><w:spacing w:after="0"/><w:jc w:val="${c === 0 || cell.group ? 'left' : 'center'}"/></w:pPr>${body}</w:p></w:tc>`;
  }).join('')}</w:tr>`).join('');
  const bd = (k) => `<w:${k} w:val="single" w:sz="4" w:space="0" w:color="DFE5F1"/>`;
  const tbl = `<w:tbl><w:tblPr><w:tblW w:w="${usable}" w:type="dxa"/><w:tblLayout w:type="fixed"/><w:tblBorders>${['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map(bd).join('')}</w:tblBorders><w:tblCellMar><w:left w:w="50" w:type="dxa"/><w:right w:w="50" w:type="dxa"/></w:tblCellMar></w:tblPr>
    <w:tblGrid><w:gridCol w:w="${firstW}"/>${Array.from({ length: w - 1 }, () => `<w:gridCol w:w="${otherW}"/>`).join('')}</w:tblGrid>${rowsXml(H, true)}${rowsXml(B, false)}</w:tbl>`;
  const body = para('COMMISSION ON AUDIT · Province of Quirino', { bold: true, size: 20, color: '0B2A6B' }) + para(info.title, { bold: true, size: 28, color: '0B2A6B' })
    + para(info.filters, { size: 16, color: '5B6785' }) + para(info.counts, { size: 16, color: '5B6785' }) + tbl
    + para('Legend: ' + LEGEND, { size: 14, color: '5B6785' }) + info.notes.map((n) => para(n, { size: 14, color: '5B6785' })).join('') + para(info.made, { size: 14, color: '9AA5BD' });
  const docXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}
    <w:sectPr><w:pgSz w:w="${pageW}" w:h="${pageH}" w:orient="landscape"/><w:pgMar w:top="${margin}" w:right="${margin}" w:bottom="${margin}" w:left="${margin}" w:header="360" w:footer="360" w:gutter="0"/></w:sectPr></w:body></w:document>`;
  const zip = new window.JSZip();
  zip.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
  zip.file('_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
  zip.file('word/document.xml', docXml);
  const blob = await zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
  save(blob, fileName(info, 'docx'));
}

// Download the table on screen in the chosen format.
export async function download(kind, table) {
  const info = screenInfo();
  if (kind === 'xlsx') return toExcel(table, info);
  if (kind === 'pdf') return toPdf(table, info);
  if (kind === 'docx') return toWord(table, info);
}
