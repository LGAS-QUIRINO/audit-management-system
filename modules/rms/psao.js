// Records Management · PSAO desk (external communications), agreed 20–21 Oct 2026.
// For the SA and the OSA Staff: what the PSAO receives and sends, kept apart from the teams' own books.
//   PSAO Incoming: PSAO-IN-{TYPE}-2026-0001 (separate series per document type: IND Indorsement, MEMO Memorandum,
//   COM Other Documents, plus types added by the SA / OSA Staff). Routed SA → ATL → member.
//   A team office's report received at the PSAO gets the office's own tracking number (it counts in the Submission Monitor)
//   and is listed here too, with the same routing.
//   PSAO Outgoing: PSAO-OUT-{TYPE}-2026-0001 (outgoing.js, PSAO mode).
// Stored with the received items (rms_items, kind 'psao-in' / 'psao-out'), so no new database list is needed.
import { store, newId } from '../../js/store.js';
import { esc, pill, modal, toast, $, $$ } from '../../js/ui.js';
import { DEMO } from '../../js/config.js';
import { syncNow } from '../../js/sync.js';
import { hasRole, fmtDate, fmtDT, scopesFor, visibleOffices, periodLabel } from './rms.js';
import { packItem, unpackItem, numberOf, printSlip, receiveAtPsao, statusPill, localInput, readWhen } from './receiving.js';

const by = (refs) => refs.me?.data.email || '';
const myName = (refs) => refs.me?.data.name || '';
export const DEFAULT_TYPES = [{ code: 'IND', name: 'Indorsement' }, { code: 'MEMO', name: 'Memorandum' }, { code: 'COM', name: 'Other Documents' }];
export const psaoTypes = (rms) => (rms.psaoTypes && rms.psaoTypes.length ? rms.psaoTypes : DEFAULT_TYPES);

/* ---------- who may do what ---------- */
export const canPsao = (refs) => hasRole(refs, 'admin', 'sa', 'osa');
// OSA Staff only (no other role): the PSAO desk, the monitor of all teams and the Report Library; not the teams' books.
export const psaoOnly = (refs) => !!refs.me && (refs.me.data.roles || []).length > 0 && refs.me.data.roles.every((r) => r === 'osa');
const canRouteSa = (refs) => hasRole(refs, 'admin', 'sa');
const isAtlOf = (refs, teamId) => hasRole(refs, 'atl') && (refs.me.data.teamIds || []).includes(teamId);
const canAssign = (refs, teamId) => canRouteSa(refs) || isAtlOf(refs, teamId);
const canDone = (refs, t) => canAssign(refs, t.teamId) || (!!t.memberId && t.memberId === refs.me?.id);

/* ---------- the PSAO books ---------- */
export const psaoIn = (rms) => [...rms.psao.filter((i) => i.kind === 'psao-in'), ...rms.items.filter((i) => i.atPsao)]
  .sort((a, b) => String(b.receivedAt).localeCompare(String(a.receivedAt)) || String(b.trackingNo).localeCompare(String(a.trackingNo)));
export const psaoAwaiting = (rms) => rms.psao.filter((o) => o.kind === 'psao-out' && !o.recipient).length;

/* ---------- routing: SA → ATL → member ---------- */
const teamName = (refs, id) => refs.team[id]?.data.name || 'Team';
const cap = (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
// "CESS P. LACADEN" → "Cess L."
export const shortName = (n) => { const w = String(n || '').trim().split(/\s+/).filter((x) => !/^(ATTY|ENGR|DR|MR|MS|MRS)\.?$/i.test(x));
  return w.length > 1 ? cap(w[0]) + ' ' + w[w.length - 1].charAt(0).toUpperCase() + '.' : cap(w[0] || ''); };
const teamsOf = (i) => (i.route && i.route.teams) || [];
export function routeState(refs, i) {
  const r = i.route || {}, ts = teamsOf(i);
  if (r.filed) return { s: 'filed', text: 'Filed at the PSAO', cls: '' };
  if (!ts.length) return { s: 'sa', text: 'With the SA', cls: 'warn' };
  const atAtl = ts.filter((t) => !t.memberId);
  if (atAtl.length) return { s: 'atl', text: 'With ' + atAtl.map((t) => 'ATL ' + teamName(refs, t.teamId)).join(', '), cls: 'blue', at: atAtl[0].at };
  if (ts.some((t) => !t.doneAt)) return { s: 'member', text: 'Routed · for action', cls: 'blue' };
  return { s: 'done', text: 'Acted on', cls: 'ok' };
}
const stillRouting = (refs, i) => ['sa', 'atl', 'member'].includes(routeState(refs, i).s);
export const routingCount = (refs, rms) => psaoIn(rms).filter((i) => stillRouting(refs, i)).length;
function chainHtml(refs, i) {
  const ts = teamsOf(i);
  if (i.route && i.route.filed) return '<small>Kept at the PSAO</small>';
  if (!ts.length) return '<small>SA</small>';
  return `<small>SA → ${ts.map((t) => `ATL ${esc(teamName(refs, t.teamId))}${t.memberName ? ' → ' + esc(shortName(t.memberName)) : ''}${t.doneAt ? ' ✓' : ''}`).join('<br>SA → ')}</small>`;
}
// What this person may do on an item now (route, assign, mark acted on).
function myActions(refs, i) {
  if (i._new) return false;
  const r = i.route || {}, ts = teamsOf(i);
  if (canRouteSa(refs) && !r.filed) return true;
  return ts.some((t) => (!t.memberId && canAssign(refs, t.teamId)) || (t.memberId && !t.doneAt && canDone(refs, t)));
}
// PSAO items waiting for this person in a team (ATL: to assign; member: to act on).
export function waitingForMe(refs, rms) {
  if (!refs.me) return [];
  return psaoIn(rms).filter((i) => !i._new && teamsOf(i).some((t) => (!t.memberId && isAtlOf(refs, t.teamId)) || (t.memberId === refs.me.id && !t.doneAt)));
}

/* ---------- PSAO Incoming page ---------- */
const docOf = (rms, i) => i.kind === 'psao-in' ? { what: esc(i.subject || ''), sub: esc(i.docTypeName || i.docType || '') + (i.pages ? ' · ' + esc(i.pages) : '') }
  : { what: esc((rms.reports.find((r) => r.id === i.reportId)?.name || i.reportCode) + ' · ' + periodLabel(i.period)), sub: 'Report for ' + esc(i.reportCode || '') + ' · ' + statusPill(i) };
const fromOf = (rms, offs, i) => i.fromOutside || offs.find((o) => o.id === i.officeId)?.label || '';

export function psaoInHtml(refs, rms, q) {
  const offs = visibleOffices(refs, rms, scopesFor(refs).map((s) => s.id));
  const list = psaoIn(rms);
  const show = q.get('s') || 'all';
  const routing = list.filter((i) => stillRouting(refs, i));
  const shown = show === 'route' ? routing : list;
  const types = psaoTypes(rms);
  const cols = 'grid-template-columns:minmax(170px,1fr) 110px minmax(170px,1.1fr) minmax(200px,1.4fr) minmax(190px,1.1fr) 150px';
  const row = (i) => { const st = routeState(refs, i), d = docOf(rms, i), from = fromOf(rms, offs, i);
    const find = [numberOf(i), from, i.submittedBy, i.subject, i.docTypeName, i.reportCode, i.period && periodLabel(i.period), st.text, fmtDate(i.receivedAt), ...teamsOf(i).map((t) => teamName(refs, t.teamId) + ' ' + (t.memberName || ''))].filter(Boolean).join(' ').toLowerCase();
    return `<div class="t-row" style="${cols}" data-find="${esc(find)}"><span class="mono"><b>${esc(numberOf(i))}</b>${i._new ? '<br><small class="warn-t">not yet confirmed</small>' : ''}</span>
      <span><small>${esc(fmtDT(i.receivedAt))}</small></span>
      <span><b>${esc(from)}</b><br><small>${esc(i.submittedBy || '')}${i.submittedDesignation ? ', ' + esc(i.submittedDesignation) : ''}</small></span>
      <span>${d.what}<br><small>${d.sub}</small></span>
      <span>${pill(st.text, st.cls)}${st.at ? ` <small>${esc(fmtDate(st.at))}</small>` : ''}<br>${chainHtml(refs, i)}</span>
      <span class="acts">${myActions(refs, i) ? `<button class="btn sm primary" data-route="${i.id}">${canRouteSa(refs) && !teamsOf(i).length ? 'Route' : 'Update'}</button>` : ''}<button class="btn sm" data-pview="${i.id}">View</button>${i._new ? '' : `<button class="btn sm" data-pslip="${i.id}">Slip</button>`}</span></div>`; };
  return `<div class="hello"><div><h1>Incoming · PSAO</h1><p>What the PSAO receives: from the Regional Office, outside offices, and auditees who submit at the PSAO. Each is routed SA → ATL → member.</p></div>
      <div class="btn-row"><button class="btn" type="button" id="p-rep">+ Report for a Team Office</button><button class="btn primary" type="button" id="p-new">+ Receive Document</button></div></div>
    <section class="panel">
      <div class="filters out-filters"><div class="seg"><a class="${show === 'all' ? 'on' : ''}" href="#/rms/psao-in">All · ${list.length}</a><a class="${show === 'route' ? 'on' : ''}" href="#/rms/psao-in?s=route">Still being routed · ${routing.length}</a></div>
        <input class="input" id="p-find" placeholder="Search: number, from, subject, team, name" style="margin-left:auto;min-width:280px"></div>
      ${shown.length ? `<div class="t-head" style="${cols}"><span>Tracking No.</span><span>Received</span><span>From</span><span>Document</span><span>Routing (SA → ATL → member)</span><span></span></div>
        <div id="p-list">${shown.map(row).join('')}</div><p class="empty" id="p-none" hidden>Nothing matches the search.</p>`
        : `<div class="empty"><b>${list.length ? 'Nothing is still being routed' : 'Nothing received at the PSAO yet'}</b>${list.length ? 'Choose All.' : 'Use + Receive Document for the first letter, memo or indorsement.'}</div>`}
      <div class="out-note">A report for a team's office (e.g. a BRS) gets the office's own tracking number and still counts in that office's Submission Monitor; it is listed here because the PSAO received it.</div>
    </section>
    <section class="panel" style="margin-top:20px"><div class="panel-head"><h2>Document Types · ${types.length}</h2>${canPsao(refs) ? '<span class="r"><button class="btn" id="p-types">Edit Types</button></span>' : ''}</div>
      <div class="note chips" style="display:flex;flex-wrap:wrap;gap:6px">${types.map((t) => pill(t.code + ' · ' + t.name, 'blue')).join('')}</div>
      <div class="note">Each type has its own running number per year, e.g. PSAO-IN-${esc(types[0].code)}-${new Date().getFullYear()}-0001 and PSAO-OUT-${esc(types[0].code)}-${new Date().getFullYear()}-0001.</div></section>`;
}

export function wirePsaoIn(refs, rms, q) {
  $('#p-new').onclick = () => receivePsao(refs, rms);
  $('#p-rep').onclick = () => receiveAtPsao(refs, rms);
  const tb = $('#p-types'); if (tb) tb.onclick = () => editTypes(refs, rms);
  const f = $('#p-find'); if (f) f.oninput = () => { const v = f.value.trim().toLowerCase(); let n = 0;
    $$('#p-list .t-row').forEach((r) => { const hit = !v || v.split(/\s+/).every((w) => r.dataset.find.includes(w)); r.hidden = !hit; if (hit) n++; });
    const none = $('#p-none'); if (none) none.hidden = n > 0; };
  wireRows(refs, rms);
  if (q.get('new') === '1') { history.replaceState(null, '', '#/rms/psao-in'); receivePsao(refs, rms); }
}
// Route / View / Slip buttons (PSAO book and the teams' "From the PSAO" panel).
export function wireRows(refs, rms) {
  const find = (id) => psaoIn(rms).find((x) => x.id === id);
  $$('[data-route]').forEach((b) => { b.onclick = () => routeItem(refs, rms, find(b.dataset.route)); });
  $$('[data-pview]').forEach((b) => { b.onclick = () => viewPsao(refs, rms, find(b.dataset.pview)); });
  $$('[data-pslip]').forEach((b) => { b.onclick = () => printSlip(refs, rms, find(b.dataset.pslip)); });
}

/* ---------- a team's view: From the PSAO ---------- */
export function fromPsaoHtml(refs, rms) {
  const list = waitingForMe(refs, rms);
  if (!list.length) return '';
  const offs = visibleOffices(refs, rms, scopesFor(refs).map((s) => s.id));
  const cols = 'grid-template-columns:minmax(170px,1fr) minmax(170px,1.1fr) minmax(200px,1.4fr) minmax(170px,1fr) 150px';
  return `<section class="panel"><div class="panel-head"><h2>From the PSAO · ${list.length}</h2></div>
    <div class="t-head" style="${cols}"><span>Tracking No.</span><span>From</span><span>Document</span><span>Routing</span><span></span></div>
    ${list.map((i) => { const d = docOf(rms, i), mine = teamsOf(i).find((t) => t.memberId === refs.me.id && !t.doneAt);
      return `<div class="t-row" style="${cols}"><span class="mono"><b>${esc(numberOf(i))}</b><br><small>${esc(fmtDate(i.receivedAt))}</small></span>
      <span><b>${esc(fromOf(rms, offs, i))}</b></span><span>${d.what}<br><small>${d.sub}</small></span>
      <span>${pill(mine ? 'For your action' : 'To assign', mine ? 'warn' : 'blue')}<br>${chainHtml(refs, i)}</span>
      <span class="acts"><button class="btn sm primary" data-route="${i.id}">${mine ? 'Acted On' : 'Assign'}</button><button class="btn sm" data-pview="${i.id}">View</button></span></div>`; }).join('')}</section>`;
}

/* ---------- Receive Document (PSAO) ---------- */
async function receivePsao(refs, rms) {
  const types = psaoTypes(rms);
  const scopes = scopesFor(refs);
  const offs = visibleOffices(refs, rms, scopes.map((s) => s.id));
  const label = (s) => s.data.kind === 'province' ? 'Province of Quirino' : s.data.name;
  const now = new Date();
  const routeNow = canRouteSa(refs);
  const senders = [...new Set(psaoIn(rms).filter((i) => i.fromOutside).map((i) => i.fromOutside))].sort();
  let out = null;
  const res = await modal({
    title: 'Receive Document · PSAO', wide: true,
    body: `<div class="two"><div class="field"><label for="p-type">Document type</label><select class="input" id="p-type">${types.map((t) => `<option value="${esc(t.code)}">${esc(t.code + ' · ' + t.name)}</option>`).join('')}</select>
          <span class="hint" id="p-no"></span></div>
        <div class="field"><span class="legend">From</span><div class="rcv-type"><label><input type="radio" name="from" value="outside" checked> Outside (Regional Office, other agency)</label><label><input type="radio" name="from" value="office"> One of the offices</label></div></div></div>
      <div class="field" id="p-out-box"><label for="p-from">From (office or agency)</label><input class="input" id="p-from" list="p-from-list" placeholder="e.g. COA Regional Office II"><datalist id="p-from-list">${senders.map((x) => `<option value="${esc(x)}">`).join('')}</datalist></div>
      <div class="two" id="p-off-box" hidden><div class="field"><label for="p-mun">Municipality</label><select class="input" id="p-mun">${scopes.map((s) => `<option value="${s.id}">${esc(label(s))}</option>`).join('')}</select></div>
        <div class="field"><label for="p-off">Office</label><select class="input" id="p-off"></select></div></div>
      <div class="field"><label for="p-subj">Subject / Description</label><input class="input" id="p-subj" placeholder="e.g. Memo on the CY 2026 Annual Audit Report deadlines"></div>
      <div class="two"><div class="field"><label for="p-by">Received From (name)</label><input class="input" id="p-by" placeholder="e.g. Courier, or the person who brought it"></div>
        <div class="field"><label for="p-des">Designation (optional)</label><input class="input" id="p-des"></div></div>
      <div class="two"><div class="field"><label for="p-date">Date received</label><input class="input" type="datetime-local" id="p-date" value="${localInput(now)}" max="${localInput(now)}">
          <span class="hint">Now, unless you are encoding an earlier one: then use the date on the RECEIVED stamp.</span></div>
        <div class="field"><label for="p-pages">Pages / Attachments (optional)</label><input class="input" id="p-pages" placeholder="e.g. 3 pages"></div></div>
      <div class="field"><label for="p-rem">Remarks (optional)</label><input class="input" id="p-rem"></div>
      ${routeNow ? `<fieldset class="field"><legend>Route now to (optional)</legend><div class="checks">${refs.teams.map((t) => `<label><input type="checkbox" name="p-rt" value="${t.id}"> ATL ${esc(t.data.name)}</label>`).join('')}</div>
        <span class="hint">Leave unticked to route later. The ATL then assigns it to a member.</span></fieldset>` : '<p class="hint">It goes to the SA first, who routes it to the team.</p>'}
      <p class="hint">Received by <b>${esc(myName(refs))}</b> (recorded automatically). The tracking number is given on saving.</p>`,
    onOpen: (bg) => {
      const fillOff = () => { const l = offs.filter((o) => o.munId === $('#p-mun', bg).value);
        $('#p-off', bg).innerHTML = l.map((o) => `<option value="${o.id}">${esc(o.label)}${o.code ? ' · ' + esc(o.code) : ''}</option>`).join('') || '<option value="">No offices set up yet</option>'; };
      $('#p-mun', bg).onchange = fillOff; fillOff();
      $$('input[name=from]', bg).forEach((x) => { x.onchange = () => { const o = $('input[name=from]:checked', bg).value === 'office'; $('#p-off-box', bg).hidden = !o; $('#p-out-box', bg).hidden = o; }; });
      const no = () => { const c = $('#p-type', bg).value; $('#p-no', bg).textContent = `Number: PSAO-IN-${c}-${now.getFullYear()}-…`; };
      $('#p-type', bg).onchange = no; no();
    },
    buttons: [{ label: 'Cancel', value: null }, { label: 'Save and Get Number', cls: 'primary', value: 'save', check: (bg) => {
      const office = $('input[name=from]:checked', bg).value === 'office';
      const o = office ? offs.find((x) => x.id === $('#p-off', bg).value) : null;
      const fromOutside = office ? (o ? o.label : '') : $('#p-from', bg).value.trim();
      if (!fromOutside) { toast(office ? 'Choose the office.' : 'Enter who it is from.', 'bad'); return false; }
      const subject = $('#p-subj', bg).value.trim(); if (!subject) { toast('Enter the subject or a short description.', 'bad'); return false; }
      const submittedBy = $('#p-by', bg).value.trim(); if (!submittedBy) { toast('Enter the name in Received From.', 'bad'); return false; }
      const when = readWhen($('#p-date', bg).value); if (when.err) { toast(when.err, 'bad'); return false; }
      const t = types.find((x) => x.code === $('#p-type', bg).value);
      const enc = new Date().toISOString(), year = new Date(when.iso).getFullYear(), key = 'psao-in-' + t.code;
      const n = Math.max(0, ...rms.psao.filter((x) => x.seriesKey === key && x.trackingYear === year).map((x) => x.series || 0)) + 1;
      const rt = $$('input[name=p-rt]:checked', bg).map((x) => ({ teamId: x.value, at: enc, by: by(refs), byName: myName(refs), note: '' }));
      out = { kind: 'psao-in', docType: t.code, docTypeName: t.name, seriesKey: key, officeCode: 'PSAO-IN', reportCode: t.code, trackingYear: year, series: n,
        trackingNo: `PSAO-IN-${t.code}-${year}-${String(n).padStart(4, '0')}`, fromOutside, officeId: o ? o.id : '', munId: o ? o.munId : '', teamId: '',
        subject, pages: $('#p-pages', bg).value.trim(), submittedBy, submittedDesignation: $('#p-des', bg).value.trim(), remarks: $('#p-rem', bg).value.trim(),
        receivedAt: when.iso, encodedAt: enc, receivedBy: by(refs), receivedByName: myName(refs), status: 'received', route: { teams: rt } };
      return true; } }]
  });
  if (res !== 'save') return;
  const id = newId('psao');
  await store.save('rms_items', id, out, by(refs));
  let saved = { id, ...out }, confirmed = DEMO;
  if (!DEMO && navigator.onLine) {
    toast('Getting the tracking number from the AMS database…');
    for (let k = 0; k < 3 && !confirmed; k++) {
      const problems = await syncNow();
      const rec = await store.get('rms_items', id);
      if (!rec) { toast('Not saved: ' + (problems[0] || 'the database refused it.'), 'bad'); return; }
      if (!rec.pending) { saved = { id, ...rec.data }; confirmed = true; }
    }
  }
  const again = await modal({
    title: confirmed ? 'Saved · Tracking Number' : 'Saved on This Computer · Number Not Yet Confirmed',
    body: `<div class="rcv-done ${confirmed ? '' : 'pend'}"><small>${confirmed ? 'TRACKING NUMBER' : 'NUMBER NOT YET CONFIRMED'}</small><b>${esc(saved.trackingNo)}</b></div>
      <p>Routing: ${pill(routeState(refs, saved).text, routeState(refs, saved).cls)}</p>
      <p>${confirmed ? 'Write this number on the RECEIVED stamp.' : 'No connection to the AMS database right now. It is saved on this computer and will be sent automatically; the number may still change when it is sent.'}</p>`,
    buttons: [{ label: 'Done', value: null }, { label: 'Receive Another', value: 'again' }, ...(confirmed ? [{ label: 'Print Slip', cls: 'primary', value: 'slip' }] : [])]
  });
  if (again === 'slip') printSlip(refs, rms, saved);
  if (again === 'again') receivePsao(refs, { ...rms, psao: [...rms.psao, saved] });
}

/* ---------- Route / Assign / Acted on ---------- */
async function routeItem(refs, rms, i) {
  const r = i.route || { teams: [] }, ts = teamsOf(i);
  const members = (teamId) => refs.users.filter((u) => u.data.status !== 'disabled' && (u.data.teamIds || []).includes(teamId) && (u.data.roles || []).some((x) => x === 'member' || x === 'atl'))
    .sort((a, b) => String(a.data.name).localeCompare(String(b.data.name)));
  const sa = canRouteSa(refs) && !r.filed;
  const assign = ts.map((t, k) => ({ t, k })).filter(({ t }) => !t.memberId && canAssign(refs, t.teamId));
  const done = ts.map((t, k) => ({ t, k })).filter(({ t }) => t.memberId && !t.doneAt && canDone(refs, t));
  const d = docOf(rms, i);
  let out = null;
  const res = await modal({
    title: 'Routing · ' + numberOf(i),
    body: `<p><b>${esc(i.fromOutside || '')}</b> · ${d.what}<br><small>Received ${esc(fmtDT(i.receivedAt))} by ${esc(i.receivedByName || '')}</small></p>
      <div class="kvrow"><small>Now</small><span>${pill(routeState(refs, i).text, routeState(refs, i).cls)}<br>${chainHtml(refs, i)}</span></div>
      ${sa ? `<fieldset class="field"><legend>SA · route to the team(s)</legend><div class="checks">${refs.teams.map((t) => { const on = ts.some((x) => x.teamId === t.id);
          return `<label><input type="checkbox" name="r-team" value="${t.id}" ${on ? 'checked disabled' : ''}> ATL ${esc(t.data.name)}${on ? ' (routed)' : ''}</label>`; }).join('')}</div>
        ${!ts.length ? '<label><input type="checkbox" id="r-file"> No routing needed: keep it at the PSAO (file)</label>' : ''}
        <div class="field"><label for="r-note">Note to the ATL (optional)</label><input class="input" id="r-note" placeholder="e.g. For appropriate action; reply by Oct 30"></div></fieldset>` : ''}
      ${assign.map(({ t, k }) => `<div class="field"><label for="r-m${k}">ATL ${esc(teamName(refs, t.teamId))} · assign to</label><select class="input" id="r-m${k}" data-k="${k}"><option value="">Not yet</option>${members(t.teamId).map((u) => `<option value="${u.id}">${esc(u.data.name)}</option>`).join('')}</select>
        ${t.note ? `<span class="hint">SA's note: ${esc(t.note)}</span>` : ''}</div>`).join('')}
      ${assign.length ? '<div class="field"><label for="r-anote">Note to the member (optional)</label><input class="input" id="r-anote"></div>' : ''}
      ${done.map(({ t, k }) => `<div class="field"><label><input type="checkbox" name="r-done" value="${k}"> ${esc(teamName(refs, t.teamId))} · ${esc(t.memberName)}: acted on</label></div>`).join('')}
      ${done.length ? '<div class="field"><label for="r-dnote">What was done (optional)</label><input class="input" id="r-dnote" placeholder="e.g. Replied, T2-OUT-2026-0031"></div>' : ''}
      ${!sa && !assign.length && !done.length ? '<p class="hint">Nothing for you to do on this one.</p>' : ''}`,
    buttons: [{ label: 'Cancel', value: null }, { label: 'Save', cls: 'primary', value: 'save', check: (bg) => {
      const now = new Date().toISOString(), who = { by: by(refs), byName: myName(refs) };
      const teams = ts.map((t) => ({ ...t }));
      let filed = r.filed || null, changed = false;
      if (sa) {
        $$('input[name=r-team]:checked:not(:disabled)', bg).forEach((x) => { teams.push({ teamId: x.value, at: now, ...who, note: $('#r-note', bg).value.trim() }); changed = true; });
        if ($('#r-file', bg) && $('#r-file', bg).checked) { if (changed) { toast('Either route it to a team or keep it at the PSAO, not both.', 'bad'); return false; }
          filed = { at: now, ...who, note: $('#r-note', bg).value.trim() }; changed = true; }
      }
      $$('select[data-k]', bg).forEach((s) => { if (!s.value) return; const u = refs.users.find((x) => x.id === s.value);
        Object.assign(teams[+s.dataset.k], { memberId: u.id, memberName: u.data.name, assignedAt: now, assignedBy: who.by, assignedByName: who.byName, assignNote: $('#r-anote', bg).value.trim() }); changed = true; });
      $$('input[name=r-done]:checked', bg).forEach((x) => { Object.assign(teams[+x.value], { doneAt: now, doneBy: who.by, doneByName: who.byName, doneNote: $('#r-dnote', bg).value.trim() }); changed = true; });
      if (!changed) { toast('Nothing to save: tick or choose something first.', 'bad'); return false; }
      out = { teams, filed }; return true; } }]
  });
  if (res !== 'save') return;
  const { id, _new: _n, ...data } = i;
  await store.save('rms_items', id, packItem({ ...data, route: { ...r, teams: out.teams, filed: out.filed } }), by(refs));
  toast('Routing saved.', 'ok');
}

function viewPsao(refs, rms, i) {
  const offs = visibleOffices(refs, rms, scopesFor(refs).map((s) => s.id));
  const row = (k, v) => `<div class="kvrow"><small>${k}</small><span>${v}</span></div>`;
  const ev = [{ at: i.receivedAt, t: 'Received at the PSAO by ' + esc(i.receivedByName || '') }];
  teamsOf(i).forEach((t) => { const tn = esc(teamName(refs, t.teamId));
    ev.push({ at: t.at, t: `Routed to ATL ${tn} by ${esc(t.byName || '')}${t.note ? ' · “' + esc(t.note) + '”' : ''}` });
    if (t.assignedAt) ev.push({ at: t.assignedAt, t: `${tn}: assigned to ${esc(t.memberName)} by ${esc(t.assignedByName || '')}${t.assignNote ? ' · “' + esc(t.assignNote) + '”' : ''}` });
    if (t.doneAt) ev.push({ at: t.doneAt, t: `${tn}: acted on${t.doneByName ? ' · ' + esc(t.doneByName) : ''}${t.doneNote ? ' · “' + esc(t.doneNote) + '”' : ''}` }); });
  if (i.route && i.route.filed) ev.push({ at: i.route.filed.at, t: 'Kept at the PSAO by ' + esc(i.route.filed.byName || '') + (i.route.filed.note ? ' · “' + esc(i.route.filed.note) + '”' : '') });
  ev.sort((a, b) => String(a.at).localeCompare(String(b.at)));
  const d = docOf(rms, i), st = routeState(refs, i);
  modal({ title: numberOf(i), body: `${row('Routing', pill(st.text, st.cls))}${row('From', esc(fromOf(rms, offs, i)))}
    ${row(i.kind === 'psao-in' ? 'Document' : 'Report', d.what + `<br><small>${d.sub}</small>`)}
    ${row('Received', esc(fmtDT(i.receivedAt)) + ' by ' + esc(i.receivedByName || ''))}
    ${row('Received from', esc(i.submittedBy || '') + (i.submittedDesignation ? ', ' + esc(i.submittedDesignation) : ''))}
    ${row('History', ev.map((e) => `<div><small>${esc(fmtDT(e.at))}</small> · ${e.t}</div>`).join(''))}
    ${i.remarks ? row('Remarks', esc(i.remarks)) : ''}` });
}

/* ---------- document types (SA, OSA Staff, Admin) ---------- */
async function editTypes(refs, rms) {
  const list = psaoTypes(rms).map((t) => ({ ...t }));
  const used = new Set(rms.psao.map((x) => x.docType).filter(Boolean));
  let out = null;
  const res = await modal({
    title: 'PSAO Document Types',
    body: `<p class="hint">Each type has its own running number per year (PSAO-IN-IND-2026-0001, PSAO-OUT-IND-2026-0001). A code already used keeps its code; its name can still be changed.</p>
      <div class="list-edit" id="t-items"></div>`,
    onOpen: (bg) => {
      const keep = () => { $$('[data-tn]', bg).forEach((x) => { list[+x.dataset.tn].name = x.value; }); $$('[data-tc]', bg).forEach((x) => { list[+x.dataset.tc].code = x.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); }); };
      const draw = () => {
        $('#t-items', bg).innerHTML = list.map((t, k) => { const u = used.has(t.code) && t._old !== false;
          return `<div><input class="input mono" data-tc="${k}" value="${esc(t.code)}" ${u ? 'readonly' : ''} style="width:90px" aria-label="Code"><input class="input txt" data-tn="${k}" value="${esc(t.name)}" aria-label="Name">
            ${u ? '<small class="hint">in use</small>' : `<button type="button" class="mini" data-rm="${k}" aria-label="Remove">×</button>`}</div>`; }).join('')
          + `<div><input class="input mono" id="t-nc" placeholder="Code" style="width:90px"><input class="input" id="t-nn" placeholder="+ New type name, then press Enter"></div>`;
        $$('[data-rm]', bg).forEach((b) => { b.onclick = () => { keep(); list.splice(+b.dataset.rm, 1); draw(); }; });
        const addNew = () => { keep(); const code = $('#t-nc', bg).value.toUpperCase().replace(/[^A-Z0-9]/g, ''), name = $('#t-nn', bg).value.trim();
          if (!code || !name) return toast('Enter both a code (e.g. LTR) and a name.', 'bad');
          if (list.some((x) => x.code === code)) return toast('That code is already in the list.', 'bad');
          list.push({ code, name, _old: false }); draw(); $('#t-nc', bg).focus(); };
        $('#t-nn', bg).onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); addNew(); } };
      };
      draw();
    },
    buttons: [{ label: 'Cancel', value: null }, { label: 'Save', cls: 'primary', value: 'save', check: (bg) => {
      $$('[data-tn]', bg).forEach((x) => { list[+x.dataset.tn].name = x.value.trim(); }); $$('[data-tc]', bg).forEach((x) => { list[+x.dataset.tc].code = x.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); });
      const nc = $('#t-nc', bg).value.trim(), nn = $('#t-nn', bg).value.trim();
      if (nc && nn) { const code = nc.toUpperCase().replace(/[^A-Z0-9]/g, ''); if (!list.some((x) => x.code === code)) list.push({ code, name: nn }); }
      if (list.some((t) => !t.code || !t.name)) { toast('Every type needs a code and a name.', 'bad'); return false; }
      if (new Set(list.map((t) => t.code)).size !== list.length) { toast('Two types have the same code.', 'bad'); return false; }
      if (!list.length) { toast('Keep at least one type.', 'bad'); return false; }
      out = list.map(({ code, name }) => ({ code, name })); return true; } }]
  });
  if (res !== 'save') return;
  await store.save('rms_settings', 'psao', { types: out }, by(refs));
  toast('Document types saved.', 'ok');
}
