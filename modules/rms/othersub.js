// Records Management · Other Submissions: checklist of attachments, bulk transmittals and the number list (agreed 24 Nov 2026).
// Each type (Report Library → Other Submission Types) may have a checklist (required / optional), be "Bulk" (one transmittal
// holds several documents under one tracking number, e.g. 3 AIRs), with the fields recorded for each document (AIR: Date,
// AIR No., Supplier, Amount), and a gap check on the number (AIR only), shown in the number list per office.
// Record: non-bulk → attach: [{ item, opt, ok, at }]; bulk → docFields (copy of the type's fields) and docs: [{ <field key>: value, attach }].
// A required attachment not yet in makes the record Incomplete; Add Attachment ticks what came later (records received
// before the checklist existed can be ticked this way too).
import { store } from '../../js/store.js';
import { esc, pill, modal, toast, $, $$ } from '../../js/ui.js';
import { fmtDate, visibleOffices, scopesFor, hasRole } from './rms.js';
import { numberOf, saveItem } from './receiving.js';
import { downloadTable } from './export.js';

const by = (refs) => refs.me?.data.email || '';
const myName = (refs) => refs.me?.data.name || '';
export const FIELD_TYPES = [['date', 'Date'], ['no', 'Number (No.)'], ['text', 'Text'], ['amount', 'Amount']];

/* ---------- helpers ---------- */
export const typeOf = (rms, i) => (rms.otherTypes || []).find((t) => t.code === (i.reportCode || i.docType));
// A fresh checklist for a type: [{ item, opt }].
export const attachOf = (t) => ((t && t.checklist) || []).map((item) => ({ item, ...(((t.optional || []).includes(item)) ? { opt: true } : {}), ok: false }));
export const missingOf = (att) => (att || []).filter((a) => !a.ok && !a.opt).map((a) => a.item);
export const isBulkRec = (i) => !!i && Array.isArray(i.docs);
export const noField = (fields) => (fields || []).find((f) => f.type === 'no');
export const defaultFields = (t) => [{ key: 'date', label: 'Date', type: 'date' }, { key: 'no', label: (t.code || '') + ' No.', type: 'no' }, { key: 'title', label: 'Title', type: 'text' }];
// The documents of a record still missing a required attachment.
export function incompleteDocs(i) {
  if (!i || i.kind !== 'other') return [];
  if (isBulkRec(i)) return i.docs.filter((d) => missingOf(d.attach).length);
  return missingOf(i.attach).length ? [i] : [];
}
export const otherIncomplete = (i) => incompleteDocs(i).length > 0;
const money = (v) => (v === '' || v == null || isNaN(+v) ? '' : Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
export const fieldVal = (f, v) => (v == null || v === '' ? '' : f.type === 'date' ? fmtDate(v + 'T12:00:00') : f.type === 'amount' ? money(v) : String(v));
// "AIR 2026-11-015 · JMC Trading · ₱48,500.00" (with "dated Nov 10, 2026" when asked).
export function docLine(i, d, withDate = false) {
  const fs = i.docFields || [], nf = noField(fs), df = fs.find((f) => f.type === 'date');
  const head = (i.reportCode || '') + (nf && d[nf.key] ? ' ' + d[nf.key] : '') + (withDate && df && d[df.key] ? ' dated ' + fieldVal(df, d[df.key]) : '');
  const rest = fs.filter((f) => f !== nf && f !== df && d[f.key] !== '' && d[f.key] != null).map((f) => (f.type === 'amount' ? '₱' : '') + fieldVal(f, d[f.key]));
  return [head, ...rest].join(' · ');
}
const attText = (att) => { const ok = (att || []).filter((a) => a.ok).map((a) => a.item), miss = missingOf(att);
  return (ok.length ? ok.join(', ') : '—') + (miss.length ? ` (${miss.join(', ')} to follow)` : ''); };
export const docsTotal = (i) => { const af = (i.docFields || []).find((f) => f.type === 'amount'); return af ? (i.docs || []).reduce((s, d) => s + (+d[af.key] || 0), 0) : null; };
// The record's subject for a bulk transmittal: "3 AIRs: 2026-11-015, 2026-11-017, 2026-11-018".
export function bulkSubject(t, fields, docs) {
  const nf = noField(fields), n = docs.length, nos = nf ? docs.map((d) => d[nf.key]).filter(Boolean) : [];
  return `${n} ${t.code}${n === 1 ? '' : 's'}` + (nos.length ? ': ' + nos.slice(0, 5).join(', ') + (nos.length > 5 ? ` … and ${nos.length - 5} more` : '') : '');
}
// What the record brought, one line per document (logbook, view, slip).
export function particularsLines(i) {
  if (isBulkRec(i)) return i.docs.map((d) => ({ text: docLine(i, d, true) + ' — ' + attText(d.attach), amount: (() => { const af = (i.docFields || []).find((f) => f.type === 'amount'); return af ? money(d[af.key]) : ''; })(), miss: missingOf(d.attach).length > 0 }));
  return i.attach ? [{ text: 'submitted: ' + attText(i.attach), amount: '', miss: missingOf(i.attach).length > 0 }] : [];
}
// Short line for Incoming and the Daily Report: "3 AIRs · ₱68,750.00 · 1 incomplete".
export function bulkNote(i) {
  if (!isBulkRec(i)) return otherIncomplete(i) ? 'missing: ' + missingOf(i.attach).join(', ') : '';
  const tot = docsTotal(i), inc = incompleteDocs(i).length;
  return [tot != null ? '₱' + money(tot) : '', inc ? `${inc} incomplete` : ''].filter(Boolean).join(' · ');
}

/* ---------- receiving: attachments of a single document ---------- */
export const attachTicksHtml = (t, att) => { const l = att || attachOf(t); return l.length ? `<span class="legend">Attachments received</span><div class="rcv-items">${l.map((a, k) =>
  `<label><input type="checkbox" name="oatt" value="${k}" ${a.ok ? 'checked' : ''}> ${esc(a.item)}${a.opt ? ' <small>(optional)</small>' : ''}</label>`).join('')}</div>` : ''; };
export const readTicks = (bg, t, at, prev) => { const l = prev ? prev.map((a) => ({ ...a })) : attachOf(t), on = new Set($$('input[name=oatt]:checked', bg).map((x) => +x.value));
  return l.map((a, k) => (on.has(k) ? { ...a, ok: true, at: a.at || at } : { ...a, ok: false, at: '' })); };

/* ---------- receiving: the rows of a bulk transmittal ---------- */
// host: element to draw in. Returns { get(at) → { docs, err } }.
export function rowsEditor(host, t, fields, docs0) {
  const fs = fields && fields.length ? fields : defaultFields(t);
  const base = attachOf(t);
  let rows = (docs0 && docs0.length ? docs0 : [{}]).map((d) => ({ ...d, attach: d.attach ? d.attach.map((a) => ({ ...a })) : base.map((a) => ({ ...a })) }));
  const inp = (f, r, k) => f.type === 'date' ? `<input class="input" type="date" data-rf="${k}|${f.key}" value="${esc(r[f.key] || '')}">`
    : f.type === 'amount' ? `<input class="input amt" type="number" step="0.01" min="0" data-rf="${k}|${f.key}" value="${esc(r[f.key] ?? '')}">`
    : `<input class="input${f.type === 'no' ? ' mono' : ''}" data-rf="${k}|${f.key}" value="${esc(r[f.key] || '')}">`;
  const keep = () => {
    $$('[data-rf]', host).forEach((x) => { const [k, key] = x.dataset.rf.split('|'); rows[+k][key] = x.value.trim(); });
    $$('[data-ra]', host).forEach((x) => { const [k, a] = x.dataset.ra.split('|').map(Number); rows[k].attach[a].ok = x.checked; });
  };
  const warn = () => { keep(); const nf = noField(fs);
    const inc = rows.map((r, k) => ({ r, k, m: missingOf(r.attach) })).filter((x) => x.m.length);
    const w = $('.or-warn', host); if (!w) return;
    w.hidden = !inc.length;
    w.innerHTML = inc.map((x) => `${esc(t.code)} ${esc((nf && x.r[nf.key]) || '#' + (x.k + 1))} is missing ${esc(x.m.join(', '))}`).join('<br>') + (inc.length ? ' — it will be saved as <b>Incomplete</b>; add it later with Add Attachment.' : '');
    const c = $('.or-count', host); if (c) c.textContent = rows.length; };
  const draw = () => {
    host.innerHTML = `<span class="legend">${esc(t.code)}s in this transmittal (<span class="or-count">${rows.length}</span>)</span>
      <div class="or-wrap"><table class="or-tab"><thead><tr><th>#</th>${fs.map((f) => `<th class="${f.type === 'amount' ? 'r' : ''}">${esc(f.label)}</th>`).join('')}${base.length ? '<th>Attachments</th>' : ''}<th></th></tr></thead>
      <tbody>${rows.map((r, k) => `<tr><td>${k + 1}</td>${fs.map((f) => `<td>${inp(f, r, k)}</td>`).join('')}
        ${base.length ? `<td><div class="or-att">${r.attach.map((a, j) => `<label title="${esc(a.item)}${a.opt ? ' (optional)' : ''}"><input type="checkbox" data-ra="${k}|${j}" ${a.ok ? 'checked' : ''}> ${esc(a.item)}${a.opt ? '*' : ''}</label>`).join('')}</div></td>` : ''}
        <td>${rows.length > 1 ? `<button type="button" class="mini" data-rx="${k}" aria-label="Remove">×</button>` : ''}</td></tr>`).join('')}</tbody></table></div>
      <div class="or-foot"><button type="button" class="btn sm" data-radd>+ Add ${esc(t.code)}</button>${base.some((a) => a.opt) ? ' <small class="hint">* optional</small>' : ''}
        ${base.length ? '<button type="button" class="btn sm" data-rall>Tick all required</button>' : ''}</div>
      <div class="or-warn" hidden></div>`;
    $('[data-radd]', host).onclick = () => { keep(); rows.push({ attach: base.map((a) => ({ ...a })) }); draw(); const l = $$('tbody tr', host).pop(); const f0 = l && $('input', l); if (f0) f0.focus(); };
    const all = $('[data-rall]', host); if (all) all.onclick = () => { keep(); rows.forEach((r) => r.attach.forEach((a) => { if (!a.opt) a.ok = true; })); draw(); };
    $$('[data-rx]', host).forEach((b) => { b.onclick = () => { keep(); rows.splice(+b.dataset.rx, 1); draw(); }; });
    $$('input', host).forEach((x) => { x.addEventListener('change', warn); });
    warn();
  };
  draw();
  return { fields: fs, get(at) {
    keep();
    const nf = noField(fs);
    const used = rows.filter((r) => fs.some((f) => r[f.key]) || r.attach.some((a) => a.ok));
    if (!used.length) return { err: `Enter at least one ${t.code}.` };
    if (nf) { const bad = used.findIndex((r) => !r[nf.key]); if (bad >= 0) return { err: `Enter the ${nf.label} of row ${rows.indexOf(used[bad]) + 1}.` };
      const seen = new Set(); for (const r of used) { const v = r[nf.key].toLowerCase(); if (seen.has(v)) return { err: `${nf.label} ${r[nf.key]} is entered twice.` }; seen.add(v); } }
    const af = fs.filter((f) => f.type === 'amount');
    for (const r of used) for (const f of af) if (r[f.key] !== '' && r[f.key] != null && isNaN(+r[f.key])) return { err: `${f.label} must be a number.` };
    return { docs: used.map((r) => { const d = {}; fs.forEach((f) => { d[f.key] = f.type === 'amount' ? (r[f.key] === '' || r[f.key] == null ? '' : +r[f.key]) : (r[f.key] || ''); });
      d.attach = r.attach.map((a) => (a.ok ? { ...a, at: a.at || at } : { ...a, ok: false, at: '' })); return d; }) };
  } };
}

/* ---------- Add Attachment (anyone who receives) ---------- */
// Ticks what came later; for a record received before its type had a checklist, starts from the type's checklist.
export async function addAttachment(refs, rms, id) {
  const i = rms.items.find((x) => x.id === id); if (!i) return;
  const t = typeOf(rms, i);
  if (!isBulkRec(i) && !i.attach && !(t && (t.checklist || []).length)) return toast(`${t ? t.name : 'This type'} has no checklist yet. Set it up in Report Library → Other Submission Types.`, 'bad');
  const docs = isBulkRec(i) ? i.docs.map((d) => ({ ...d, attach: (d.attach || attachOf(t)).map((a) => ({ ...a })) })) : null;
  const att = docs ? null : (i.attach || attachOf(t)).map((a) => ({ ...a }));
  const now = new Date(), local = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  const tick = (list, pre) => list.map((a, k) => `<label class="${a.ok ? 'done' : ''}"><input type="checkbox" data-aa="${pre}${k}" ${a.ok ? 'checked disabled' : ''}> ${esc(a.item)}${a.opt ? ' <small>(optional)</small>' : ''}${a.ok && a.at && a.at !== i.receivedAt ? ` <small class="hint">came ${esc(fmtDate(a.at))}</small>` : ''}</label>`).join('');
  let out = null;
  const res = await modal({ title: 'Add Attachment · ' + numberOf(i), wide: !!docs,
    body: `<p class="hint">Tick what was submitted now. Already received items stay ticked. ${i.attach || docs ? '' : 'This record was received before the checklist was set up: tick everything it came with.'}</p>
      ${docs ? docs.map((d, k) => `<div class="aa-doc"><b>${esc(docLine(i, d))}</b>${missingOf(d.attach).length ? ' ' + pill('Incomplete', 'warn') : ' ' + pill('Complete', 'ok')}<div class="rcv-items">${tick(d.attach, k + '|')}</div></div>`).join('')
        : `<div class="rcv-items">${tick(att, '0|')}</div>`}
      <div class="field" style="max-width:260px;margin-top:10px"><label for="aa-when">Date received</label><input class="input" type="datetime-local" id="aa-when" value="${local}" max="${local}"></div>`,
    buttons: [{ label: 'Cancel', value: null }, { label: 'Save', cls: 'primary', value: 'save', check: (bg) => {
      const picked = $$('[data-aa]:checked:not(:disabled)', bg).map((x) => x.dataset.aa.split('|').map(Number));
      if (!picked.length) { toast('Tick what was submitted.', 'bad'); return false; }
      const w = $('#aa-when', bg).value, at = w ? new Date(w).toISOString() : new Date().toISOString();
      if (new Date(at) < new Date(i.receivedAt)) { toast('That is before the transmittal was received.', 'bad'); return false; }
      const items = [];
      picked.forEach(([k, a]) => { const l = docs ? docs[k].attach : att; l[a].ok = true; l[a].at = at; items.push((docs ? docLine(i, docs[k]) + ': ' : '') + l[a].item); });
      out = { at, items }; return true; } }] });
  if (res !== 'save') return;
  const { id: _x, _new: _n, ...data } = i;
  const log = [...(i.attachLog || []), { at: out.at, by: by(refs), byName: myName(refs), items: out.items }];
  await saveItem(id, { ...data, ...(docs ? { docs } : { attach: att }), attachLog: log }, by(refs));
  const after = { ...i, ...(docs ? { docs } : { attach: att }) };
  toast(otherIncomplete(after) ? 'Saved. Still missing some attachments.' : 'Saved. All required attachments are in.', 'ok');
}

/* ---------- setup of one type (Admin and OSA Staff) ---------- */
export async function editOtherSetup(refs, rms, code) {
  const types = rms.otherTypes.map((t) => ({ ...t }));
  const t = types.find((x) => x.code === code); if (!t) return;
  const items = (t.checklist || []).map((x) => ({ t: x, opt: (t.optional || []).includes(x) }));
  let bulk = !!t.bulk, gap = !!t.gap;
  const fields = (t.fields && t.fields.length ? t.fields : defaultFields(t)).map((f) => ({ ...f }));
  const used = rms.items.some((i) => i.kind === 'other' && i.reportCode === code);
  const res = await modal({ title: `${t.name} · ${t.code}`, wide: true,
    body: `<span class="legend">Checklist of attachments</span>
      <p class="hint">What each ${esc(t.code)} should come with. Tick “Optional” for those not always attached; a missing required one makes it Incomplete.</p>
      <div class="list-edit" id="os-ck"></div>
      <div class="field" style="margin-top:14px"><label><input type="checkbox" id="os-bulk" ${bulk ? 'checked' : ''}> <b>Bulk</b> — one transmittal can contain several documents (one tracking number for all)</label></div>
      <div id="os-bulkpart"><span class="legend">Fields recorded for each document</span>
        <p class="hint">The columns filled in for each ${esc(t.code)} at receiving. One field can be the document's number (e.g. AIR No.).</p>
        <div class="list-edit" id="os-f"></div>
        <div class="field" id="os-gapbox"><label><input type="checkbox" id="os-gap" ${gap ? 'checked' : ''}> <b>Check for gaps</b> in the number, per office and year (a missing number is flagged in the ${esc(t.code)} List)</label></div></div>
      ${used ? '<p class="hint">Changes apply to what is received from now on. Records already received keep what they were received with; use Add Attachment on them to tick their attachments.</p>' : ''}`,
    onOpen: (bg) => {
      const keep = () => { $$('[data-ck]', bg).forEach((x) => { items[+x.dataset.ck].t = x.value; }); $$('[data-co]', bg).forEach((x) => { items[+x.dataset.co].opt = x.checked; });
        $$('[data-fl]', bg).forEach((x) => { fields[+x.dataset.fl].label = x.value; }); $$('[data-ft]', bg).forEach((x) => { fields[+x.dataset.ft].type = x.value; }); };
      const drawCk = () => {
        $('#os-ck', bg).innerHTML = items.map((x, k) => `<div><span class="n">${k + 1}.</span><input class="input txt" data-ck="${k}" value="${esc(x.t)}" aria-label="Document">
            <label class="hint" style="white-space:nowrap"><input type="checkbox" data-co="${k}" ${x.opt ? 'checked' : ''}> Optional</label>
            <button type="button" class="mini" data-cu="${k}" ${k ? '' : 'disabled'} aria-label="Move up">↑</button><button type="button" class="mini" data-cr="${k}" aria-label="Remove">×</button></div>`).join('')
          + `<div><input class="input" id="os-cn" placeholder="+ Document (e.g. Delivery Receipt), then press Enter"></div>`;
        $$('[data-cr]', bg).forEach((b) => { b.onclick = () => { keep(); items.splice(+b.dataset.cr, 1); drawCk(); }; });
        $$('[data-cu]', bg).forEach((b) => { b.onclick = () => { keep(); const k = +b.dataset.cu; [items[k - 1], items[k]] = [items[k], items[k - 1]]; drawCk(); }; });
        $('#os-cn', bg).onkeydown = (e) => { if (e.key !== 'Enter') return; e.preventDefault(); keep(); const v = e.target.value.trim(); if (v) { items.push({ t: v, opt: false }); drawCk(); $('#os-cn', bg).focus(); } };
      };
      const drawF = () => {
        $('#os-f', bg).innerHTML = fields.map((f, k) => `<div><span class="n">${k + 1}.</span><input class="input txt" data-fl="${k}" value="${esc(f.label)}" aria-label="Field name">
            <select class="input" data-ft="${k}" style="width:150px">${FIELD_TYPES.map(([v, l]) => `<option value="${v}" ${f.type === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
            <button type="button" class="mini" data-fu="${k}" ${k ? '' : 'disabled'} aria-label="Move up">↑</button><button type="button" class="mini" data-fr="${k}" aria-label="Remove">×</button></div>`).join('')
          + `<div><input class="input" id="os-fn" placeholder="+ Field (e.g. Supplier), then press Enter"></div>`;
        $$('[data-fr]', bg).forEach((b) => { b.onclick = () => { keep(); fields.splice(+b.dataset.fr, 1); drawF(); }; });
        $$('[data-fu]', bg).forEach((b) => { b.onclick = () => { keep(); const k = +b.dataset.fu; [fields[k - 1], fields[k]] = [fields[k], fields[k - 1]]; drawF(); }; });
        $$('[data-ft]', bg).forEach((s) => { s.onchange = () => { keep(); gapState(); }; });
        $('#os-fn', bg).onkeydown = (e) => { if (e.key !== 'Enter') return; e.preventDefault(); keep(); const v = e.target.value.trim();
          if (v) { const amt = /amount|cost|price|total/i.test(v), dt = /date/i.test(v); fields.push({ key: 'f' + Date.now().toString(36), label: v, type: amt ? 'amount' : dt ? 'date' : 'text' }); drawF(); $('#os-fn', bg).focus(); } };
        gapState();
      };
      const gapState = () => { const has = fields.some((f) => f.type === 'no'); $('#os-gapbox', bg).hidden = !has; };
      const bulkState = () => { $('#os-bulkpart', bg).hidden = !$('#os-bulk', bg).checked; };
      $('#os-bulk', bg).onchange = bulkState;
      bg._keep = keep; drawCk(); drawF(); bulkState();
    },
    buttons: [{ label: 'Cancel', value: null }, { label: 'Save', cls: 'primary', value: 'save', check: (bg) => {
      bg._keep();
      const cn = $('#os-cn', bg).value.trim(); if (cn) items.push({ t: cn, opt: false });
      const fn = $('#os-fn', bg).value.trim(); if (fn) fields.push({ key: 'f' + Date.now().toString(36), label: fn, type: /amount/i.test(fn) ? 'amount' : 'text' });
      const ck = items.map((x) => ({ t: x.t.trim(), opt: x.opt })).filter((x) => x.t);
      if (new Set(ck.map((x) => x.t.toLowerCase())).size !== ck.length) { toast('A document is listed twice in the checklist.', 'bad'); return false; }
      bulk = $('#os-bulk', bg).checked; gap = $('#os-gap', bg).checked;
      if (bulk) {
        if (fields.some((f) => !f.label.trim())) { toast('Every field needs a name.', 'bad'); return false; }
        if (!fields.length) { toast('Add at least one field (e.g. the document number).', 'bad'); return false; }
        if (fields.filter((f) => f.type === 'no').length > 1) { toast('Only one field can be the number (No.).', 'bad'); return false; }
      }
      t.checklist = ck.map((x) => x.t); t.optional = ck.filter((x) => x.opt).map((x) => x.t);
      t.bulk = bulk; t.fields = bulk ? fields.map((f) => ({ key: f.key, label: f.label.trim(), type: f.type })) : (t.fields || undefined);
      t.gap = bulk && gap && fields.some((f) => f.type === 'no');
      if (!t.fields) delete t.fields;
      return true; } }] });
  if (res !== 'save') return;
  await store.save('rms_settings', 'othertypes', { types: types.map(cleanType) }, by(refs));
  toast(`${t.name} saved.`, 'ok');
}
// What is stored for a type.
export const cleanType = (t) => ({ code: t.code, name: t.name, kinds: t.kinds || [], ...(t.starts && Object.keys(t.starts).length ? { starts: t.starts } : {}),
  ...((t.checklist || []).length ? { checklist: t.checklist, optional: t.optional || [] } : {}), ...(t.bulk ? { bulk: true, fields: t.fields || defaultFields(t) } : {}), ...(t.gap ? { gap: true } : {}) });
export const typeSummary = (t) => [(t.checklist || []).length ? `${t.checklist.length} attachment${t.checklist.length === 1 ? '' : 's'}` : '', t.bulk ? 'Bulk' : '', t.gap ? 'gap check' : ''].filter(Boolean).join(' · ');

/* ================= Number list (e.g. AIR List): per office, gaps flagged ================= */
// Types with "Check for gaps" get a page: one tab for the Province and one per municipality; inside, one table per office and
// year, sorted by number. The running number is the last group of digits (2026-11-015 → 15). When the same running number
// appears with different beginnings (numbering restarts each month, e.g. 2026-10-001 and 2026-11-001), each beginning is
// checked on its own.
export const gapTypes = (rms) => (rms.otherTypes || []).filter((t) => t.gap);
const runOf = (no) => { const m = String(no || '').match(/^(.*?)(\d+)(\D*)$/); return m ? { pre: m[1], n: +m[2], w: m[2].length, post: m[3] } : null; };
function listRows(rms, t, offIds, year) {
  const all = [];
  rms.items.filter((i) => i.kind === 'other' && i.reportCode === t.code && isBulkRec(i) && !i.deleted && offIds.has(i.officeId)).forEach((i) => {
    const fs = i.docFields || [], nf = noField(fs), df = fs.find((f) => f.type === 'date');
    i.docs.forEach((d) => { const y = (df && d[df.key] ? String(d[df.key]).slice(0, 4) : String(new Date(i.receivedAt).getFullYear()));
      all.push({ i, d, no: nf ? d[nf.key] : '', year: +y }); });
  });
  return all.filter((r) => r.year === year);
}
// Rows of one office, sorted, with gap rows in between.
function withGaps(rows) {
  const parsed = rows.map((r) => ({ ...r, run: runOf(r.no) }));
  const nums = parsed.filter((r) => r.run);
  const restarts = new Set(nums.map((r) => r.run.n)).size !== nums.length && new Set(nums.map((r) => r.run.pre)).size > 1;
  const keyOf = (r) => (restarts ? r.run.pre : '');
  parsed.sort((a, b) => (a.run && b.run ? (keyOf(a) || '').localeCompare(keyOf(b) || '', undefined, { numeric: true }) || a.run.n - b.run.n : a.run ? -1 : b.run ? 1 : String(a.no).localeCompare(String(b.no))));
  const out = []; let gaps = 0;
  parsed.forEach((r, k) => {
    const p = parsed[k - 1];
    if (p && p.run && r.run && keyOf(p) === keyOf(r) && r.run.n > p.run.n + 1) {
      const miss = r.run.n - p.run.n - 1, fmt = (n) => r.run.pre + String(n).padStart(r.run.w, '0') + r.run.post;
      gaps += miss;
      out.push({ gap: true, text: miss === 1 ? fmt(p.run.n + 1) : `${fmt(p.run.n + 1)} – ${fmt(r.run.n - 1)}`, miss, between: [p.no, r.no] });
    }
    out.push(r);
  });
  return { out, gaps };
}
function listData(refs, rms, q) {
  const t = gapTypes(rms).find((x) => x.code === q.get('t')) || gapTypes(rms)[0];
  if (!t) return null;
  const scopes = scopesFor(refs), offs = visibleOffices(refs, rms, scopes.map((s) => s.id));
  const yNow = new Date().getFullYear(), year = +(q.get('y') || yNow) || yNow;
  const tabs = scopes.map((s) => { const ids = new Set(offs.filter((o) => o.munId === s.id).map((o) => o.id)), rows = listRows(rms, t, ids, year);
    const byOff = new Map(); rows.forEach((r) => { if (!byOff.has(r.i.officeId)) byOff.set(r.i.officeId, []); byOff.get(r.i.officeId).push(r); });
    const groups = [...byOff.entries()].map(([oid, l]) => ({ off: offs.find((o) => o.id === oid), ...withGaps(l) })).sort((a, b) => String(a.off?.label).localeCompare(String(b.off?.label)));
    return { s, name: s.data.kind === 'province' ? 'Province' : s.data.name, count: rows.length, gaps: groups.reduce((n, g) => n + g.gaps, 0), groups }; });
  const tab = tabs.find((x) => x.s.id === q.get('m')) || tabs.find((x) => x.count) || tabs[0];
  const years = [...new Set([yNow, year, ...rms.items.filter((i) => i.kind === 'other' && i.reportCode === t.code).map((i) => new Date(i.receivedAt).getFullYear())])].sort((a, b) => b - a);
  return { t, year, years, tabs, tab };
}
function listTable(t, tab) {
  if (!tab || !tab.count) return `<table class="lbt nl"><tbody><tr><td class="ctr muted">No ${esc(t.code)} received for this year.</td></tr></tbody></table>`;
  const fs = tab.groups[0].out.find((r) => !r.gap)?.i.docFields || t.fields || defaultFields(t);
  const nf = noField(fs), cols = [nf, ...fs.filter((f) => f !== nf)].filter(Boolean);
  const n = cols.length + 4;
  return `<table class="lbt nl"><thead><tr>${cols.map((f) => `<th>${esc(f.label)}</th>`).join('')}<th>Tracking Number</th><th>Received</th><th>Attachments</th><th>Status</th></tr></thead><tbody>${tab.groups.map((g) =>
    `<tr class="grp"><td colspan="${n}">${esc(g.off?.label || 'Office')} · ${g.out.filter((r) => !r.gap).length} ${esc(t.code)}${g.out.filter((r) => !r.gap).length === 1 ? '' : 's'}${g.gaps ? ` · ${g.gaps} number${g.gaps === 1 ? '' : 's'} not received` : ''}</td></tr>`
    + g.out.map((r) => r.gap ? `<tr class="usec gapr"><td class="mono">${esc(r.text)}</td><td colspan="${n - 1}">⚠ Not received — between ${esc(r.between[0])} and ${esc(r.between[1])}${r.miss > 1 ? ` (${r.miss} numbers)` : ''}</td></tr>`
      : `<tr>${cols.map((f) => `<td class="${f.type === 'no' ? 'mono' : f.type === 'amount' ? 'num' : ''}">${esc(fieldVal(f, r.d[f.key]))}</td>`).join('')}<td class="mono">${esc(numberOf(r.i))}</td><td>${esc(fmtDate(r.i.receivedAt))}</td>
        <td>${esc((r.d.attach || []).filter((a) => a.ok).map((a) => a.item).join(', ') || '—')}</td><td class="${missingOf(r.d.attach).length ? 'urg' : ''}">${missingOf(r.d.attach).length ? 'Missing: ' + esc(missingOf(r.d.attach).join(', ')) : 'Complete'}</td></tr>`).join('')).join('')}</tbody></table>`;
}
export function numberListHtml(refs, rms, q) {
  const D = listData(refs, rms, q);
  if (!D) return `<div class="hello"><div><h1>Number List</h1><p>No Other Submission type has “Check for gaps” turned on. Set it in Report Library → Other Submission Types.</p></div></div>`;
  const { t, year, years, tabs, tab } = D;
  const rows = tab ? tab.groups.flatMap((g) => g.out.filter((r) => !r.gap)) : [];
  const amt = (rows[0]?.i.docFields || t.fields || []).find((f) => f.type === 'amount');
  const total = amt ? rows.reduce((s, r) => s + (+r.d[amt.key] || 0), 0) : null, inc = rows.filter((r) => missingOf(r.d.attach).length).length;
  const others = gapTypes(rms);
  return `<div class="hello"><div><h1>${esc(t.code)} List</h1><p>Every ${esc(t.name)} received, per office, sorted by number. A number not received is flagged in red.</p></div>
      <div class="btn-row"><button class="btn" id="nl-print" type="button">Print</button><div class="dl-wrap"><button class="btn primary" id="nl-dl" type="button">Download ▾</button>
        <div class="dl-menu" id="nl-dl-menu" hidden><button type="button" data-ndl="pdf">PDF</button><button type="button" data-ndl="xlsx">Excel</button><button type="button" data-ndl="docx">Word</button></div></div></div></div>
    <section class="panel">
      <div class="mon-filters">
        ${others.length > 1 ? `<label>Type<select class="input" data-nf="t">${others.map((x) => `<option value="${esc(x.code)}" ${x.code === t.code ? 'selected' : ''}>${esc(x.code)} · ${esc(x.name)}</option>`).join('')}</select></label>` : ''}
        <label>Year<select class="input" data-nf="y">${years.map((y) => `<option ${y === year ? 'selected' : ''}>${y}</option>`).join('')}</select></label>
        <label>Search<input class="input" id="nl-find" placeholder="Number, supplier, tracking no." style="width:240px"></label>
      </div>
      <div class="nl-tabs">${tabs.map((x) => `<a href="#" data-nm="${esc(x.s.id)}" class="${x === tab ? 'on' : ''}">${esc(x.name)} (${x.count})${x.gaps ? `<i>${x.gaps}</i>` : ''}</a>`).join('')}</div>
      <div class="dr-sum" style="margin:12px 18px 0"><div><span>${esc(t.code)}s received</span><b>${rows.length}</b><small>${esc(tab ? tab.name : '')} · ${year}</small></div>
        ${total != null ? `<div><span>Total ${esc(amt.label.toLowerCase())}</span><b style="font-size:20px">₱${esc(money(total))}</b><small>&nbsp;</small></div>` : ''}
        <div><span>Incomplete</span><b>${inc}</b><small>missing a required attachment</small></div>
        <div class="u"><span>Numbers not received</span><b>${tab ? tab.gaps : 0}</b><small>gaps in the numbering</small></div></div>
      <div class="lbsheet" id="nl-sheet">
        <div class="lb-top"><img src="img/coa-logo.png" alt=""><div><div class="t1">COMMISSION ON AUDIT</div><div class="t2">Local Government Audit Sector · Province of Quirino</div></div></div>
        <div class="lb-title">LIST OF ${esc(t.name.toUpperCase())} RECEIVED</div>
        <div class="lb-sub">${esc(tab ? tab.name : '')} · ${year} · ${rows.length} ${esc(t.code)}${rows.length === 1 ? '' : 's'}${tab && tab.gaps ? ` · ${tab.gaps} number${tab.gaps === 1 ? '' : 's'} not received` : ''}</div>
        ${listTable(t, tab)}
        <div class="lb-foot"><span>AMS · ${esc(t.code)} List</span><span>Printed ${esc(new Date().toLocaleString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }))}</span></div>
      </div>
      <div class="note doc-key">The running number is the last group of digits (2026-11-<b>015</b>). Gaps are checked within the same office and year; when the numbering starts again each month, each month is checked on its own.</div></section>`;
}
export function wireNumberList(refs, rms, q) {
  const D = listData(refs, rms, q); if (!D) return;
  const go = (patch) => { const p = new URLSearchParams(location.hash.split('?')[1] || ''); Object.entries(patch).forEach(([k, v]) => { if (v === '' || v == null) p.delete(k); else p.set(k, v); }); location.hash = '#/rms/numbers?' + p.toString(); };
  $$('[data-nf]').forEach((el) => { el.onchange = () => go({ [el.dataset.nf]: el.value }); });
  $$('[data-nm]').forEach((a) => { a.onclick = (e) => { e.preventDefault(); go({ m: a.dataset.nm }); }; });
  const f = $('#nl-find'); if (f) f.oninput = () => { const v = f.value.trim().toLowerCase();
    $$('#nl-sheet tbody tr').forEach((tr) => { if (tr.classList.contains('grp')) return; tr.hidden = !!v && !tr.innerText.toLowerCase().includes(v); }); };
  $('#nl-print').onclick = () => {
    const sheet = $('#nl-sheet').outerHTML.replace('src="img/coa-logo.png"', `src="${new URL('img/coa-logo.png', location.href).href}"`);
    const css = [...document.styleSheets].map((ss) => { try { return [...ss.cssRules].map((r) => r.cssText).filter((x) => /lb|gapr|urg|\.num/.test(x)).join('\n'); } catch (e) { return ''; } }).join('\n');
    const w = window.open('', '_blank'); if (!w) return toast('Allow pop-ups for this site to print.', 'bad');
    w.document.open(); w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(D.t.code)} List</title><style>body{font-family:Arial,Helvetica,sans-serif;margin:0} @page{size:legal landscape;margin:0.4in} ${css} .lbsheet{margin:0;box-shadow:none;border:0}</style></head><body>${sheet}<script>window.onload=()=>{window.focus();window.print();}<\/script></body></html>`); w.document.close(); };
  const menu = $('#nl-dl-menu');
  $('#nl-dl').onclick = (e) => { e.stopPropagation(); menu.hidden = !menu.hidden; };
  if (!window.__nlDlClose) { window.__nlDlClose = true; document.addEventListener('click', () => { const m = document.getElementById('nl-dl-menu'); if (m) m.hidden = true; }); }
  $$('[data-ndl]', menu).forEach((b) => { b.onclick = async () => {
    menu.hidden = true; toast('Preparing the file…');
    const tbl = $('#nl-sheet table'), n = tbl.querySelector('thead tr').children.length;
    try { await downloadTable(b.dataset.ndl, tbl, { title: `LIST OF ${D.t.name.toUpperCase()} RECEIVED`, filters: `${D.tab ? D.tab.name : ''} · ${D.year}`, counts: $('#nl-sheet .lb-sub').innerText, notes: [], legend: null, navy: true,
      sheet: (D.tab ? D.tab.name : D.t.code).slice(0, 30), widths: Array.from({ length: n }, (_, k) => (k === n - 2 ? 26 : k === n - 1 ? 18 : 16)), align: Array.from({ length: n }, () => 'l'),
      fileBase: `${D.t.code} List ${D.tab ? D.tab.name : ''} ${D.year}`, made: 'Printed ' + new Date().toLocaleString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) });
      toast('File downloaded.', 'ok'); } catch (err) { toast('Could not make the file: ' + err.message, 'bad'); } }; });
}
export const canSetUpTypes = (refs) => hasRole(refs, 'admin', 'osa');
