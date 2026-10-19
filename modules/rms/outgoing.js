// Records Management · Outgoing (mockup approved 20 Oct 2026).
// Everything a team sends out: demand letters, AOMs with transmittals, replies, reports to the Region. Each gets its own
// outgoing number per team per year (T2-OUT-2026-0022), given by the AMS database. "Awaiting acknowledgment" until the
// recipient's receiving copy comes back; then Record receipt (name, designation, date).
// Stored with the received items (rms_items, kind 'out'), so no new database list is needed.
import { store, newId } from '../../js/store.js';
import { esc, pill, modal, toast, $, $$ } from '../../js/ui.js';
import { DEMO } from '../../js/config.js';
import { syncNow } from '../../js/sync.js';
import { scopesFor, visibleOffices, fmtDate, hasRole } from './rms.js';

const by = (refs) => refs.me?.data.email || '';
const myName = (refs) => refs.me?.data.name || '';
export const KINDS = ['Demand letter', 'AOM / transmittal', 'Letter / reply', 'Report to Region / Central', 'Other'];
export const MODES = ['By hand', 'Courier / mail', 'Email'];
const localDay = (d) => { const x = new Date(d); x.setMinutes(x.getMinutes() - x.getTimezoneOffset()); return x.toISOString().slice(0, 10); };

// The team's short code for outgoing numbers: "Team 2" → T2 (else the team's office code).
export function teamCode(team) {
  const m = String(team?.data?.name || '').match(/(\d+)/);
  return m ? 'T' + m[1] : String(team?.data?.officeCode || 'TEAM').replace(/[^A-Z0-9]/gi, '').toUpperCase();
}
// Teams this person sends for: Admin, SA and SA Staff may choose any team; others their own.
function sendTeams(refs) {
  if (hasRole(refs, 'admin', 'sa', 'osa')) return refs.teams;
  const mine = refs.me?.data.teamIds || [];
  return refs.teams.filter((t) => mine.includes(t.id));
}
const isAwaiting = (o) => !o.recipient;
export const awaitingCount = (refs, rms) => rms.outs.filter((o) => sendTeams(refs).some((t) => t.id === o.teamId) && isAwaiting(o)).length;

/* ================= Outgoing page ================= */
export function outgoingHtml(refs, rms, q) {
  const teams = sendTeams(refs);
  if (!teams.length) return `<div class="msg bad">No team is assigned to you yet. Ask the Admin to set your team in Users &amp; Roles.</div>`;
  const tf = q.get('t') || 'all';
  const show = q.get('s') || 'all';
  const list = rms.outs.filter((o) => teams.some((t) => t.id === o.teamId) && (tf === 'all' || o.teamId === tf))
    .sort((a, b) => String(b.sentAt).localeCompare(String(a.sentAt)) || String(b.trackingNo).localeCompare(String(a.trackingNo)));
  const waiting = list.filter(isAwaiting).length;
  const shown = list.filter((o) => show === 'all' || (show === 'wait' ? isAwaiting(o) : !isAwaiting(o)));
  const qs = (patch) => '#/rms/outgoing?' + Object.entries({ t: tf, s: show, ...patch }).map(([k, v]) => k + '=' + encodeURIComponent(v)).join('&');
  const cols = 'grid-template-columns:150px 100px minmax(160px,1fr) minmax(200px,1.3fr) 140px minmax(210px,1fr)';
  const row = (o) => {
    const find = [o.trackingNo, o.toName, o.officeCode && o.toCode, o.subject, o.docKind, o.related, o.sentByName, o.recipient && o.recipient.name, fmtDate(o.sentAt)].filter(Boolean).join(' ').toLowerCase();
    return `<div class="t-row" style="${cols}" data-find="${esc(find)}"><span class="mono"><b>${esc(o.trackingNo || '')}</b>${o._new ? '<br><small class="warn-t">not yet confirmed</small>' : ''}</span>
      <span><small>${esc(fmtDate(o.sentAt))}</small></span>
      <span><b>${esc(o.toName || '')}</b>${o.toCode ? `<br><small class="mono">${esc(o.toCode)}</small>` : ''}</span>
      <span>${esc(o.subject || '')}<br><small>${esc(o.docKind || '')}${o.related ? ' · re ' + esc(o.related) : ''}</small></span>
      <span>${esc(o.sentByName || '')}<br><small>${esc(o.mode || '')}</small></span>
      <span>${o.recipient ? `${pill('Received', 'ok')}<br><small>${esc(o.recipient.name)}${o.recipient.designation ? ', ' + esc(o.recipient.designation) : ''} · ${esc(fmtDate(o.recipient.at))}</small>`
        : `${pill('Awaiting acknowledgment', 'warn')}<br><button class="btn sm" data-ack="${o.id}" style="margin-top:6px">Record receipt</button>`}
        <button class="btn sm" data-oview="${o.id}" style="margin-top:6px">View</button></span></div>`;
  };
  return `<div class="hello"><div><h1>Outgoing</h1><p>Everything the team sends out: demand letters, AOMs, replies, reports to the Region. Each gets its own outgoing number.</p></div>
      <button class="btn primary" type="button" id="out-new">+ Record Outgoing</button></div>
    <section class="panel">
      <div class="filters out-filters"><div class="seg"><a class="${show === 'all' ? 'on' : ''}" href="${qs({ s: 'all' })}">All · ${list.length}</a><a class="${show === 'wait' ? 'on' : ''}" href="${qs({ s: 'wait' })}">Awaiting acknowledgment · ${waiting}</a><a class="${show === 'done' ? 'on' : ''}" href="${qs({ s: 'done' })}">Received · ${list.length - waiting}</a></div>
        ${teams.length > 1 ? `<select class="input" id="out-team"><option value="all">All teams</option>${teams.map((t) => `<option value="${t.id}" ${tf === t.id ? 'selected' : ''}>${esc(t.data.name)}</option>`).join('')}</select>` : ''}
        <input class="input" id="out-find" placeholder="Search: number, office, subject, name" style="margin-left:auto;min-width:280px"></div>
      ${shown.length ? `<div class="t-head" style="${cols}"><span>Outgoing No.</span><span>Date sent</span><span>To</span><span>Document / Subject</span><span>Sent by · Mode</span><span>Recipient</span></div>
        <div id="out-list">${shown.map(row).join('')}</div><p class="empty" id="out-none" hidden>Nothing matches the search.</p>`
        : `<div class="empty"><b>${list.length ? 'Nothing in this list' : 'Nothing sent yet'}</b>${list.length ? 'Choose All.' : 'Use + Record Outgoing for the first letter or report sent out.'}</div>`}
      <div class="out-note">"Awaiting acknowledgment" until the recipient's receiving copy comes back; then click Record receipt and enter who received it and when.</div>
    </section>`;
}

export function wireOutgoing(refs, rms, q) {
  $('#out-new').onclick = () => recordOutgoing(refs, rms);
  const t = $('#out-team'); if (t) t.onchange = () => { location.hash = `#/rms/outgoing?t=${encodeURIComponent(t.value)}&s=${encodeURIComponent(q.get('s') || 'all')}`; };
  const f = $('#out-find'); if (f) f.oninput = () => { const v = f.value.trim().toLowerCase(); let n = 0;
    $$('#out-list .t-row').forEach((r) => { const hit = !v || v.split(/\s+/).every((w) => r.dataset.find.includes(w)); r.hidden = !hit; if (hit) n++; });
    const none = $('#out-none'); if (none) none.hidden = n > 0; };
  $$('[data-ack]').forEach((b) => { b.onclick = () => recordReceipt(refs, rms, b.dataset.ack); });
  $$('[data-oview]').forEach((b) => { b.onclick = () => viewOutgoing(refs, rms, b.dataset.oview); });
  if (q.get('new') === '1') { history.replaceState(null, '', '#/rms/outgoing'); recordOutgoing(refs, rms); }
}

/* ---------- Record Outgoing ---------- */
async function recordOutgoing(refs, rms) {
  const teams = sendTeams(refs);
  const scopes = scopesFor(refs);
  const offs = visibleOffices(refs, rms, scopes.map((s) => s.id)).filter((o) => o.code);
  const label = (s) => s.data.kind === 'province' ? 'Province of Quirino' : s.data.name;
  const incoming = [...new Set(rms.items.map((i) => i.trackingNo).filter(Boolean))].sort().reverse().slice(0, 300);
  let out = null;
  const res = await modal({
    title: 'Record Outgoing', wide: true,
    body: `${teams.length > 1 ? `<div class="field" style="max-width:260px"><label for="o-team">For team</label><select class="input" id="o-team">${teams.map((t) => `<option value="${t.id}" ${(refs.me?.data.teamIds || [])[0] === t.id ? 'selected' : ''}>${esc(t.data.name)} · ${esc(teamCode(t))}-OUT</option>`).join('')}</select></div>` : ''}
      <div class="field"><span class="legend">To</span><div class="rcv-type"><label><input type="radio" name="to" value="office" checked> One of the offices</label><label><input type="radio" name="to" value="outside"> Outside (e.g. COA Regional Office II)</label></div></div>
      <div class="two" id="o-office-box"><div class="field"><label for="o-mun">Municipality</label><select class="input" id="o-mun">${scopes.map((s) => `<option value="${s.id}">${esc(label(s))}</option>`).join('')}</select></div>
        <div class="field"><label for="o-off">Office</label><select class="input" id="o-off"></select></div></div>
      <div class="field" id="o-outside-box" hidden><label for="o-to">To (name of office or person)</label><input class="input" id="o-to" placeholder="e.g. COA Regional Office II"></div>
      <div class="two"><div class="field"><label for="o-kind">Kind</label><select class="input" id="o-kind">${KINDS.map((k) => `<option>${esc(k)}</option>`).join('')}</select></div>
        <div class="field"><span class="legend">Mode of sending</span><div class="rcv-type">${MODES.map((m, k) => `<label><input type="radio" name="mode" value="${esc(m)}" ${k ? '' : 'checked'}> ${esc(m)}</label>`).join('')}</div></div></div>
      <div class="field"><label for="o-subj">Subject / Description</label><input class="input" id="o-subj" placeholder="e.g. Demand letter – overdue August and September RCI"></div>
      <div class="two"><div class="field"><label for="o-rel">Related tracking no. (optional)</label><input class="input mono" id="o-rel" list="o-rel-list" placeholder="e.g. MAD-BAL-2026-0007"><datalist id="o-rel-list">${incoming.map((n) => `<option value="${esc(n)}">`).join('')}</datalist>
          <span class="hint">A reply to an incoming letter, or the report it is about.</span></div>
        <div class="field"><label for="o-date">Date sent</label><input class="input" type="date" id="o-date" value="${localDay(new Date())}" max="${localDay(new Date())}"></div></div>
      <div class="field"><label for="o-rem">Remarks (optional)</label><input class="input" id="o-rem"></div>
      <p class="hint">Sent by <b>${esc(myName(refs))}</b> (recorded automatically). The outgoing number is given on saving. The recipient's name and date are added later with <b>Record receipt</b>.</p>`,
    onOpen: (bg) => {
      const fillOff = () => { const list = offs.filter((o) => o.munId === $('#o-mun', bg).value);
        $('#o-off', bg).innerHTML = list.map((o) => `<option value="${o.id}">${esc(o.label)} · ${esc(o.code)}</option>`).join('') || '<option value="">No offices with codes yet</option>'; };
      $('#o-mun', bg).onchange = fillOff; fillOff();
      $$('input[name=to]', bg).forEach((x) => { x.onchange = () => { const o = $('input[name=to]:checked', bg).value === 'outside'; $('#o-office-box', bg).hidden = o; $('#o-outside-box', bg).hidden = !o; }; });
    },
    buttons: [{ label: 'Cancel', value: null }, { label: 'Save and Get Number', cls: 'primary', value: 'save', check: (bg) => {
      const team = teams.length > 1 ? teams.find((t) => t.id === $('#o-team', bg).value) : teams[0];
      const outside = $('input[name=to]:checked', bg).value === 'outside';
      const o = outside ? null : offs.find((x) => x.id === $('#o-off', bg).value);
      const toName = outside ? $('#o-to', bg).value.trim() : (o ? o.label : '');
      if (!toName) { toast(outside ? 'Enter who it is sent to.' : 'Choose the office.', 'bad'); return false; }
      const subject = $('#o-subj', bg).value.trim(); if (!subject) { toast('Enter the subject or a short description.', 'bad'); return false; }
      const day = $('#o-date', bg).value; if (!day) { toast('Enter the date sent.', 'bad'); return false; }
      const now = new Date(), sent = new Date(day + 'T' + now.toTimeString().slice(0, 8));
      if (sent - now > 5 * 60000) { toast('The date sent cannot be in the future.', 'bad'); return false; }
      const code = teamCode(team) + '-OUT', year = sent.getFullYear(), key = 'out-' + team.id;
      const n = Math.max(0, ...rms.outs.filter((x) => x.seriesKey === key && x.trackingYear === year).map((x) => x.series || 0)) + 1;
      out = { kind: 'out', teamId: team.id, seriesKey: key, officeCode: code, trackingYear: year, series: n, trackingNo: `${code}-${year}-${String(n).padStart(4, '0')}`,
        toKind: outside ? 'outside' : 'office', officeId: o ? o.id : '', toCode: o ? o.code : '', munId: o ? o.munId : '', toName,
        docKind: $('#o-kind', bg).value, mode: $('input[name=mode]:checked', bg).value, subject, related: $('#o-rel', bg).value.trim().toUpperCase(),
        remarks: $('#o-rem', bg).value.trim(), sentAt: sent.toISOString(), encodedAt: now.toISOString(), sentBy: by(refs), sentByName: myName(refs), status: 'sent', recipient: null };
      return true;
    } }]
  });
  if (res !== 'save') return;
  const id = newId('out');
  await store.save('rms_items', id, out, by(refs));
  let saved = { id, ...out }, confirmed = DEMO;
  // Connected: the AMS database gives the number, so two people sending at once never share a number.
  if (!DEMO && navigator.onLine) {
    toast('Getting the outgoing number from the AMS database…');
    for (let k = 0; k < 3 && !confirmed; k++) {
      const problems = await syncNow();
      const rec = await store.get('rms_items', id);
      if (!rec) { toast('Not saved: ' + (problems[0] || 'the database refused it.'), 'bad'); return; }
      if (!rec.pending) { saved = { id, ...rec.data }; confirmed = true; }
    }
  }
  await modal({
    title: confirmed ? 'Saved · Outgoing Number' : 'Saved on This Computer · Number Not Yet Confirmed',
    body: `<div class="rcv-done ${confirmed ? '' : 'pend'}"><small>${confirmed ? 'OUTGOING NUMBER' : 'NUMBER NOT YET CONFIRMED'}</small><b>${esc(saved.trackingNo)}</b></div>
      <p>${confirmed ? 'Write this number on the letter or transmittal. When the receiving copy comes back, use <b>Record receipt</b>.' : 'No connection to the AMS database right now. It is saved on this computer and will be sent automatically; the number may still change when it is sent.'}</p>`
  });
}

/* ---------- Record receipt (the recipient's receiving copy came back) ---------- */
async function recordReceipt(refs, rms, id) {
  const o = rms.outs.find((x) => x.id === id);
  let rec = null;
  const res = await modal({
    title: 'Record Receipt · ' + o.trackingNo,
    body: `<p class="hint">${esc(o.subject)} · to ${esc(o.toName)} · sent ${esc(fmtDate(o.sentAt))}, ${esc((o.mode || '').toLowerCase())}</p>
      <div class="two"><div class="field"><label for="a-name">Received by (name)</label><input class="input" id="a-name" placeholder="e.g. Rosa T. Lim"></div>
        <div class="field"><label for="a-des">Designation</label><input class="input" id="a-des" placeholder="e.g. Barangay Treasurer"></div></div>
      <div class="field" style="max-width:260px"><label for="a-date">Date received</label><input class="input" type="date" id="a-date" value="${localDay(new Date())}" max="${localDay(new Date())}"></div>`,
    buttons: [{ label: 'Cancel', value: null }, { label: 'Save', cls: 'primary', value: 'save', check: (bg) => {
      const name = $('#a-name', bg).value.trim(); if (!name) { toast('Enter the name of the person who received it.', 'bad'); return false; }
      const day = $('#a-date', bg).value; if (!day) { toast('Enter the date received.', 'bad'); return false; }
      if (day < localDay(o.sentAt)) { toast('The date received cannot be before the date sent (' + fmtDate(o.sentAt) + ').', 'bad'); return false; }
      rec = { name, designation: $('#a-des', bg).value.trim(), at: new Date(day + 'T12:00:00').toISOString(), by: by(refs), byName: myName(refs), recordedAt: new Date().toISOString() };
      return true; } }]
  });
  if (res !== 'save') return;
  const { id: _x, _new: _n, ...data } = o;
  await store.save('rms_items', id, { ...data, recipient: rec, status: 'received' }, by(refs));
  toast('Receipt recorded.', 'ok');
}

function viewOutgoing(refs, rms, id) {
  const o = rms.outs.find((x) => x.id === id);
  const row = (k, v) => `<div class="kvrow"><small>${k}</small><span>${v}</span></div>`;
  modal({ title: o.trackingNo, body: `${row('Status', o.recipient ? pill('Received', 'ok') : pill('Awaiting acknowledgment', 'warn'))}
    ${row('To', esc(o.toName) + (o.toCode ? ` <small class="mono">${esc(o.toCode)}</small>` : ''))}
    ${row('Document', esc(o.subject) + `<br><small>${esc(o.docKind)}</small>`)}${o.related ? row('Related', `<span class="mono">${esc(o.related)}</span>`) : ''}
    ${row('Sent', esc(fmtDate(o.sentAt)) + ' · ' + esc(o.mode) + ' · by ' + esc(o.sentByName))}
    ${o.recipient ? row('Received by', esc(o.recipient.name) + (o.recipient.designation ? ', ' + esc(o.recipient.designation) : '') + ' · ' + esc(fmtDate(o.recipient.at)) + `<br><small>recorded by ${esc(o.recipient.byName)}</small>`) : ''}
    ${o.remarks ? row('Remarks', esc(o.remarks)) : ''}` });
}
