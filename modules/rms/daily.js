// Records Management · Daily Report of Documents Received (mockup agreed 23 Nov 2026).
// Everything received on a day (or a range): reports, communications, other submissions and, for the SA and OSA Staff, the
// PSAO's incoming documents. Urgent items first; four summary boxes; print, or download as PDF, Excel or Word (Excel: one
// sheet per day plus a Summary sheet for a range). Priority, deadline and assigned person come from the record
// (priority 'urgent', deadline, assignedName, actedAt), filled in at receiving.
import { esc, toast, $, $$ } from '../../js/ui.js';
import { hasRole, fmtDate, periodLabel, visibleOffices, scopesFor } from './rms.js';
import { numberOf, statusText, isVerify, isBatchLead, batchOf, periodsText } from './receiving.js';
import { canPsao, psaoIn, routeState } from './psao.js';
import { downloadTable, toExcelBook } from './export.js';
import { bulkNote } from './othersub.js';

const localDay = (d) => { const x = new Date(d); x.setMinutes(x.getMinutes() - x.getTimezoneOffset()); return x.toISOString().slice(0, 10); };
const today = () => localDay(new Date());
const addDays = (day, n) => { const d = new Date(day + 'T12:00:00'); d.setDate(d.getDate() + n); return localDay(d); };
const longDay = (day) => new Date(day + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
const shortDay = (day) => new Date(day + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
const time = (d) => new Date(d).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
// "JUAN A. DELA CRUZ" → "Juan D." (the surname starts after the middle initial).
const shortName = (n) => { const w = String(n || '').trim().split(/\s+/).filter(Boolean); const c = (x) => x.charAt(0).toUpperCase() + x.slice(1).toLowerCase();
  if (w.length < 2) return c(w[0] || ''); const mi = w.findIndex((x, k) => k > 0 && /^[A-Z]\.$/i.test(x)); const sur = mi > 0 && w[mi + 1] ? w[mi + 1] : w[w.length - 1];
  return c(w[0]) + ' ' + sur.charAt(0).toUpperCase() + '.'; };
export const isUrgent = (i) => i && i.priority === 'urgent';
// Urgent and not yet acted on.
export const needsAction = (i) => isUrgent(i) && !i.actedAt;

/* ---------- what this person may see ---------- */
const seesAll = (refs) => hasRole(refs, 'admin', 'sa', 'osa');
function teamChoices(refs) {
  const ts = seesAll(refs) ? refs.teams : refs.teams.filter((t) => (refs.me?.data.teamIds || []).includes(t.id));
  return [...ts.map((t) => ({ id: t.id, name: t.data.name })), ...(canPsao(refs) ? [{ id: 'psao', name: 'PSAO' }] : [])];
}
// Every received document (one row per tracking number) with what the report needs.
function allDocs(refs, rms) {
  const offs = visibleOffices(refs, rms, scopesFor(refs).map((s) => s.id));
  const label = (id) => offs.find((o) => o.id === id)?.label || '';
  const teamName = (id) => refs.team[id]?.data.name || '';
  const out = rms.items.filter((i) => i.trackingNo && isBatchLead(rms, i) && !i.atPsao).map((i) => {
    const kind = i.kind === 'comm' ? 'comm' : i.kind === 'other' ? 'other' : 'report';
    const what = kind === 'comm' ? i.subject || '' : kind === 'other' ? (i.docKind || i.docTypeName || i.reportCode) + ' · ' + (i.subject || '') + (i.docNo ? ' · ' + i.docNo : '') + (bulkNote(i) ? ' · ' + bulkNote(i) : '')
      : (i.reportCode || '') + ' · ' + (i.batchId ? periodsText(batchOf(rms, i).map((x) => x.period)) + ' (one transmittal)' : periodLabel(i.period));
    return { i, kind, team: i.teamId || offs.find((o) => o.id === i.officeId)?.teamId || '', teamName: teamName(i.teamId || offs.find((o) => o.id === i.officeId)?.teamId), from: i.fromOutside || label(i.officeId), what, status: statusText(i), verify: isVerify(i) };
  });
  if (canPsao(refs)) psaoIn(rms).forEach((i) => out.push({ i, kind: 'psao', team: 'psao', teamName: 'PSAO', from: i.fromOutside || label(i.officeId),
    what: i.kind === 'psao-in' ? (i.subject || '') + (i.docTypeName ? ' · ' + i.docTypeName : '') : (i.reportCode || '') + ' · ' + periodLabel(i.period), status: routeState(refs, i).text, verify: false }));
  return out;
}
const GROUPS = [['report', 'REPORTS'], ['comm', 'COMMUNICATIONS'], ['other', 'OTHER SUBMISSIONS'], ['psao', 'PSAO INCOMING']];

/* ---------- filters ---------- */
function filtersOf(refs, q) {
  const teams = teamChoices(refs);
  const day = /^\d{4}-\d{2}-\d{2}$/.test(q.get('day') || '') ? q.get('day') : today();
  const range = ['day', 'week', 'custom'].includes(q.get('rg')) ? q.get('rg') : 'day';
  let from = day, to = day;
  if (range === 'week') { const d = new Date(day + 'T12:00:00'), back = (d.getDay() + 6) % 7; from = addDays(day, -back); to = addDays(from, 6); }
  if (range === 'custom') { from = q.get('from') || day; to = q.get('to') || day; if (to < from) [from, to] = [to, from]; }
  const team = teams.some((t) => t.id === q.get('t')) ? q.get('t') : 'all';
  const kind = ['report', 'comm', 'other', 'psao'].includes(q.get('k')) ? q.get('k') : 'all';
  return { teams, day, range, from, to, team, kind, open: q.get('open') !== '0' };
}
function pick(refs, rms, f) {
  const allowed = new Set(f.teams.map((t) => t.id));
  const docs = allDocs(refs, rms).filter((d) => (allowed.has(d.team) || (seesAll(refs) && d.team !== 'psao')) && (f.team === 'all' || d.team === f.team) && (f.kind === 'all' || d.kind === f.kind));
  const inRange = docs.filter((d) => { const day = localDay(d.i.receivedAt); return day >= f.from && day <= f.to; })
    .sort((a, b) => String(a.i.receivedAt).localeCompare(String(b.i.receivedAt)));
  const open = docs.filter((d) => needsAction(d.i)).sort((a, b) => String(a.i.deadline || '9').localeCompare(String(b.i.deadline || '9')));
  return { inRange, open };
}
const scopeText = (f) => (f.team === 'all' ? (f.teams.length > 1 ? 'All teams' + (f.teams.some((t) => t.id === 'psao') ? ' and PSAO' : '') : f.teams[0]?.name || '') : f.teams.find((t) => t.id === f.team)?.name || '');
const periodText = (f) => (f.from === f.to ? longDay(f.from) : `${longDay(f.from)} – ${longDay(f.to)}`);

/* ---------- the report sheet ---------- */
const prio = (i) => (isUrgent(i) ? `<span class="urg">URGENT</span>${i.deadline ? ' · due ' + esc(shortDay(i.deadline)) : ''}${i.assignedName ? ' · ' + esc(shortName(i.assignedName)) : ''}${i.actedAt ? ' · acted on' : ''}` : '<span class="muted">Normal</span>');
function rowsHtml(list, withDate, start = 0) {
  return list.map((d, k) => `<tr><td class="ctr">${start + k + 1}</td><td>${withDate ? esc(shortDay(localDay(d.i.receivedAt))) + ' ' : ''}${esc(time(d.i.receivedAt))}</td><td class="mono">${esc(numberOf(d.i))}</td>
    <td>${esc(d.from)}</td><td>${esc(d.what)}</td><td>${esc(d.teamName)}</td><td>${esc(shortName(d.i.receivedByName))}</td><td>${prio(d.i)}</td><td>${esc(d.status)}</td></tr>`).join('');
}
function tableHtml(list, withDate, open = null) {
  const urgent = list.filter((d) => isUrgent(d.i)), rest = list.filter((d) => !isUrgent(d.i));
  let n = 0, body = '';
  if (urgent.length) { body += `<tr class="usec"><td colspan="9">URGENT · ${urgent.length}</td></tr>` + rowsHtml(urgent, withDate, n); n += urgent.length; }
  GROUPS.forEach(([k, name]) => { const g = rest.filter((d) => d.kind === k); if (!g.length) return; body += `<tr class="grp"><td colspan="9">${name} · ${g.length}</td></tr>` + rowsHtml(g, withDate, n); n += g.length; });
  if (!list.length) body = '<tr><td colspan="9" class="ctr muted">Nothing received.</td></tr>';
  if (open && open.length) {
    const day = today();
    body += `<tr class="usec"><td colspan="9">STILL NEEDS ACTION · ${open.length}</td></tr>` + open.map((d, k) => {
      const due = d.i.deadline, tag = !due ? '' : due < day ? 'OVERDUE · ' : due === day ? 'DUE TODAY · ' : '';
      return `<tr><td class="ctr">${k + 1}</td><td>${esc(shortDay(localDay(d.i.receivedAt)))}</td><td class="mono">${esc(numberOf(d.i))}</td><td>${esc(d.from)}</td><td>${esc(d.what)}</td><td>${esc(d.teamName)}</td>
        <td>${esc(shortName(d.i.receivedByName))}</td><td><span class="urg">${tag}</span>${due ? 'due ' + esc(shortDay(due)) : 'no deadline'}${d.i.assignedName ? ' · ' + esc(shortName(d.i.assignedName)) : ''}</td><td>${esc(d.status)}</td></tr>`; }).join('');
  }
  return `<table class="lbt dr"><thead><tr><th>#</th><th>${withDate ? 'Date · Time' : 'Time'}</th><th>Tracking Number</th><th>From</th><th>Document / Subject</th><th>Team</th><th>Received by</th><th>Priority · Deadline · Assigned</th><th>Status</th></tr></thead><tbody>${body}</tbody></table>`;
}
function summary(list, open) {
  const by = (k) => list.filter((d) => d.kind === k).length, day = today();
  const parts = [[by('report'), 'report'], [by('comm'), 'communication'], [by('other'), 'other'], [by('psao'), 'PSAO']].filter(([n]) => n).map(([n, w]) => `${n} ${w}${n > 1 && w !== 'other' && w !== 'PSAO' ? 's' : ''}`);
  const urg = list.filter((d) => isUrgent(d.i)), od = open.filter((d) => d.i.deadline && d.i.deadline < day).length, dt = open.filter((d) => d.i.deadline === day).length;
  return { received: list.length, parts: parts.join(' · ') || 'none', urgent: urg.length, urgentNote: urg.length ? (urg.every((d) => d.i.assignedName) ? (urg.length > 1 ? 'all assigned' : 'assigned') : 'some not yet assigned') : 'none',
    verify: list.filter((d) => d.verify).length, open: open.length, openNote: `${od} overdue · ${dt} due today` };
}
const boxes = (s) => `<div class="dr-sum"><div><span>Received</span><b>${s.received}</b><small>${esc(s.parts)}</small></div>
  <div class="u"><span>Urgent received</span><b>${s.urgent}</b><small>${esc(s.urgentNote)}</small></div>
  <div><span>For verification</span><b>${s.verify}</b><small>waiting for an auditor</small></div>
  <div class="u"><span>Still Needs Action</span><b>${s.open}</b><small>${esc(s.openNote)}</small></div></div>`;

/* ================= page ================= */
export function dailyHtml(refs, rms, q) {
  const f = filtersOf(refs, q);
  if (!f.teams.length) return `<div class="msg bad">No team is assigned to you yet. Ask the Admin to set your team in Users &amp; Roles.</div>`;
  const { inRange, open } = pick(refs, rms, f), s = summary(inRange, open), multi = f.from !== f.to;
  const opt = (v, t, cur) => `<option value="${esc(v)}" ${v === cur ? 'selected' : ''}>${esc(t)}</option>`;
  return `<div class="hello"><div><h1>Daily Report</h1><p>Everything received, day by day. Urgent items come first.</p></div>
      <div class="btn-row"><button class="btn" id="dr-print" type="button">Print</button><div class="dl-wrap"><button class="btn primary" id="dr-dl" type="button">Download ▾</button>
        <div class="dl-menu" id="dr-dl-menu" hidden><button type="button" data-ddl="pdf">PDF</button><button type="button" data-ddl="xlsx">Excel</button><button type="button" data-ddl="docx">Word</button></div></div></div></div>
    <section class="panel">
      <div class="mon-filters">
        <label>Day<input class="input" type="date" data-df="day" value="${esc(f.day)}" max="${today()}"></label>
        <div class="seg"><a href="#" data-dstep="-1">‹ Previous</a><a href="#" data-dstep="0" class="${f.day === today() && f.range === 'day' ? 'on' : ''}">Today</a><a href="#" data-dstep="1">Next ›</a></div>
        <label>Range<select class="input" data-df="rg">${opt('day', 'Just this day', f.range)}${opt('week', 'This week', f.range)}${opt('custom', 'From – to…', f.range)}</select></label>
        ${f.range === 'custom' ? `<label>From<input class="input" type="date" data-df="from" value="${esc(f.from)}"></label><label>To<input class="input" type="date" data-df="to" value="${esc(f.to)}"></label>` : ''}
        ${f.teams.length > 1 ? `<label>Team<select class="input" data-df="t">${opt('all', 'All teams' + (f.teams.some((t) => t.id === 'psao') ? ' and PSAO' : ''), f.team)}${f.teams.map((t) => opt(t.id, t.name, f.team)).join('')}</select></label>` : ''}
        <label>Kind<select class="input" data-df="k">${opt('all', 'All kinds', f.kind)}${opt('report', 'Reports', f.kind)}${opt('comm', 'Communications', f.kind)}${opt('other', 'Other submissions', f.kind)}${canPsao(refs) ? opt('psao', 'PSAO incoming', f.kind) : ''}</select></label>
        <label class="chk"><span>&nbsp;</span><span><input type="checkbox" data-df="open" ${f.open ? 'checked' : ''}> Include Still Needs Action</span></label>
      </div>
      <div class="lbsheet" id="dr-sheet">
        <div class="lb-top"><img src="img/coa-logo.png" alt=""><div><div class="t1">COMMISSION ON AUDIT</div><div class="t2">Local Government Audit Sector · Province of Quirino</div></div></div>
        <div class="lb-title">DAILY REPORT OF DOCUMENTS RECEIVED</div>
        <div class="lb-sub">${esc(periodText(f))} · ${esc(scopeText(f))}</div>
        ${boxes(s)}
        ${tableHtml(inRange, multi, f.open ? open : null)}
        <div class="lb-foot"><span>AMS · Daily Report · ${esc(scopeText(f))}</span><span>Printed ${esc(new Date().toLocaleString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }))}</span></div>
      </div>
      <div class="note">By date received. A document encoded later (with an earlier date received) appears on the day it was received.</div></section>`;
}

export function wireDaily(refs, rms, q) {
  const f = filtersOf(refs, q); if (!f.teams.length) return;
  const go = (patch) => { const p = new URLSearchParams(location.hash.split('?')[1] || ''); Object.entries(patch).forEach(([k, v]) => { if (v === '' || v === null) p.delete(k); else p.set(k, v); }); location.hash = '#/rms/daily?' + p.toString(); };
  $$('[data-df]').forEach((el) => { el.onchange = () => go({ [el.dataset.df]: el.type === 'checkbox' ? (el.checked ? '1' : '0') : el.value }); });
  $$('[data-dstep]').forEach((a) => { a.onclick = (e) => { e.preventDefault(); const n = +a.dataset.dstep; go({ day: n ? addDays(f.day, n) > today() ? today() : addDays(f.day, n) : today(), ...(n ? {} : { rg: 'day' }) }); }; });
  $('#dr-print').onclick = () => {
    const sheet = $('#dr-sheet').outerHTML.replace('src="img/coa-logo.png"', `src="${new URL('img/coa-logo.png', location.href).href}"`);
    const css = [...document.styleSheets].map((ss) => { try { return [...ss.cssRules].map((r) => r.cssText).filter((t) => /lb|dr-|urg|usec/.test(t)).join('\n'); } catch (e) { return ''; } }).join('\n');
    const w = window.open('', '_blank'); if (!w) return toast('Allow pop-ups for this site to print.', 'bad');
    w.document.open(); w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Daily Report</title><style>body{font-family:Arial,Helvetica,sans-serif;margin:0} @page{size:legal landscape;margin:0.4in} ${css} .lbsheet{margin:0;box-shadow:none;border:0}</style></head><body>${sheet}<script>window.onload=()=>{window.focus();window.print();}<\/script></body></html>`); w.document.close(); };
  const menu = $('#dr-dl-menu');
  $('#dr-dl').onclick = (e) => { e.stopPropagation(); menu.hidden = !menu.hidden; };
  if (!window.__drDlClose) { window.__drDlClose = true; document.addEventListener('click', () => { const m = document.getElementById('dr-dl-menu'); if (m) m.hidden = true; }); }
  const tableOf = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
  const info = (title, s, sheet) => ({ title, filters: `${periodText(f)} · ${scopeText(f)}`, counts: `Received ${s.received} (${s.parts}) · Urgent received ${s.urgent} · For verification ${s.verify} · Still Needs Action (${s.open}): ${s.openNote}`,
    notes: [], legend: null, navy: true, sheet, widths: [4, 11, 20, 22, 34, 9, 11, 22, 13], align: ['c', 'l', 'l', 'l', 'l', 'l', 'l', 'l', 'l'],
    fileBase: 'Daily Report ' + (f.from === f.to ? f.from : f.from + ' to ' + f.to) + ' ' + scopeText(f), made: 'Printed ' + new Date().toLocaleString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) });
  $$('[data-ddl]', menu).forEach((b) => { b.onclick = async () => {
    menu.hidden = true; toast('Preparing the file…');
    try {
      const { inRange, open } = pick(refs, rms, f), s = summary(inRange, open);
      if (b.dataset.ddl === 'xlsx' && f.from !== f.to) {
        // A range in Excel: one sheet per day, then a Summary sheet.
        const sheets = [];
        for (let d = f.from; d <= f.to; d = addDays(d, 1)) { const l = inRange.filter((x) => localDay(x.i.receivedAt) === d); if (!l.length) continue;
          sheets.push({ table: tableOf(tableHtml(l, false)), info: { ...info('DAILY REPORT OF DOCUMENTS RECEIVED', summary(l, open), shortDay(d)), filters: `${longDay(d)} · ${scopeText(f)}` } }); }
        const sumRows = []; for (let d = f.from; d <= f.to; d = addDays(d, 1)) { const l = inRange.filter((x) => localDay(x.i.receivedAt) === d), ss = summary(l, []); sumRows.push(`<tr><td>${esc(longDay(d))}</td><td>${ss.received}</td><td>${ss.urgent}</td><td>${ss.verify}</td><td>${esc(ss.parts)}</td></tr>`); }
        sheets.push({ table: tableOf(`<table><thead><tr><th>Day</th><th>Received</th><th>Urgent</th><th>For verification</th><th>Kinds</th></tr></thead><tbody>${sumRows.join('')}</tbody></table>`),
          info: { ...info('DAILY REPORT · SUMMARY', s, 'Summary'), widths: [30, 12, 10, 16, 40], align: ['l', 'c', 'c', 'c', 'l'] } });
        if (f.open && open.length) sheets.push({ table: tableOf(tableHtml([], false, open)), info: info('STILL NEEDS ACTION', s, 'Still Needs Action') });
        await toExcelBook(sheets, { fileBase: info('', s).fileBase });
      } else await downloadTable(b.dataset.ddl, $('#dr-sheet table'), info('DAILY REPORT OF DOCUMENTS RECEIVED', s, 'Daily Report'));
      toast('File downloaded.', 'ok');
    } catch (err) { toast('Could not make the file: ' + err.message, 'bad'); } }; });
}
