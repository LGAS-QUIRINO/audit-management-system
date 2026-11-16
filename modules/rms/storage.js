// Records Management · Records & Storage (agreed 17 Nov 2026).
// File (a received transmittal) → Folder (Folder Code) → Cabinet/Shelf or Sack → Room. Per team; everyone in the team can
// set up rooms, shelves, sacks and folders, file, and move. A file is in one folder at a time; folders move from a shelf to
// a sack (one by one, or a whole shelf at once) and keep a movement history.
// Stored with the received items (rms_items, kinds 'store-room', 'store-place', 'store-folder'); a file's folder is kept on
// the file itself (folderId). Nothing is deleted: a room, shelf, sack or folder no longer used is marked removed.
import { store, newId } from '../../js/store.js';
import { esc, pill, modal, toast, $, $$ } from '../../js/ui.js';
import { hasRole, fmtDate, periodLabel, visibleOffices, scopesFor } from './rms.js';
import { numberOf, saveItem, batchOf, isBatchLead, periodsText } from './receiving.js';

const by = (refs) => refs.me?.data.email || '';
const myName = (refs) => refs.me?.data.name || '';
const shortName = (n) => { const w = String(n || '').trim().split(/\s+/); const c = (x) => x.charAt(0).toUpperCase() + x.slice(1).toLowerCase();
  return w.length > 1 ? c(w[0]) + ' ' + w[w.length - 1].charAt(0).toUpperCase() + '.' : c(w[0] || ''); };
const today = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };

/* ---------- teams ---------- */
// Admin, SA and OSA Staff may work on any team's storage; others on their own team(s).
export function storageTeams(refs) {
  if (hasRole(refs, 'admin', 'sa', 'osa')) return refs.teams;
  const mine = refs.me?.data.teamIds || [];
  return refs.teams.filter((t) => mine.includes(t.id));
}
const teamOf = (q, refs) => { const ts = storageTeams(refs); const t = q.get('t'); return ts.find((x) => x.id === t) || ts.find((x) => (refs.me?.data.teamIds || []).includes(x.id)) || ts[0] || null; };
const teamSel = (refs, team, base) => { const ts = storageTeams(refs); return ts.length > 1 ? `<select class="input" data-goto="${base}" aria-label="Team">${ts.map((t) => `<option value="${t.id}" ${t.id === team.id ? 'selected' : ''}>${esc(t.data.name)}</option>`).join('')}</select>` : ''; };

/* ---------- lookups ---------- */
const live = (x) => !x.removed;
export const placeName = (p) => (!p ? '' : p.type === 'sack' ? 'Sack ' + p.code : p.name);
const roomsOf = (rms, teamId) => rms.rooms.filter((r) => live(r) && r.teamId === teamId).sort((a, b) => a.name.localeCompare(b.name));
const placesOf = (rms, roomId) => rms.places.filter((p) => live(p) && p.roomId === roomId).sort((a, b) => (a.type === b.type ? placeName(a).localeCompare(placeName(b), undefined, { numeric: true }) : a.type === 'sack' ? 1 : -1));
const foldersIn = (rms, placeId) => rms.folders.filter((f) => live(f) && f.placeId === placeId).sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
const foldersOfTeam = (rms, teamId) => rms.folders.filter((f) => live(f) && f.teamId === teamId).sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
// The files (transmittals) of a folder: one row per tracking number (a transmittal of several periods counts once).
export const filesIn = (rms, folderId) => rms.items.filter((i) => i.folderId === folderId && isBatchLead(rms, i)).sort((a, b) => String(a.trackingNo).localeCompare(String(b.trackingNo)));
// Where a folder is: "Shelf 2 · PSAO Records Room".
export function whereOf(rms, f) {
  const p = f && rms.places.find((x) => x.id === f.placeId), r = p && rms.rooms.find((x) => x.id === p.roomId);
  return { place: p, room: r, text: [placeName(p), r && r.name].filter(Boolean).join(' · ') };
}
// Where a received file is: Room › Sack/Shelf › Folder (null when not yet filed).
export function locationOf(rms, i) {
  const f = i && i.folderId && rms.folders && rms.folders.find((x) => x.id === i.folderId);
  if (!f) return null;
  const w = whereOf(rms, f);
  return { folder: f, ...w, text: [w.room && w.room.name, placeName(w.place), f.code].filter(Boolean).join(' › ') };
}
// Files of a team that can be filed: received reports and communications (one row per tracking number).
function teamFiles(refs, rms, teamId) {
  const offs = visibleOffices(refs, rms, scopesFor(refs).map((s) => s.id));
  const offTeam = new Map(offs.map((o) => [o.id, o.teamId]));
  return rms.items.filter((i) => i.trackingNo && !i._new && isBatchLead(rms, i) && (i.teamId || offTeam.get(i.officeId)) === teamId);
}
function describe(rms, offs, i) {
  const off = offs.find((o) => o.id === i.officeId);
  const what = i.kind === 'comm' ? 'Communication · ' + (i.subject || '') : (i.reportCode || '') + ' · ' + (i.batchId ? periodsText(batchOf(rms, i).map((x) => x.period)) : periodLabel(i.period));
  return { office: i.fromOutside || off?.label || '', what };
}
const findText = (rms, offs, i) => { const d = describe(rms, offs, i); return [numberOf(i), d.office, d.what, i.reportCode, ...(i.batchId ? batchOf(rms, i).map((x) => periodLabel(x.period)) : [i.period && periodLabel(i.period)]), i.subject].filter(Boolean).join(' ').toLowerCase(); };

/* ---------- saving ---------- */
const strip = (x) => { const { id: _i, _new: _n, ...rest } = x; return rest; };
// Put files in a folder (or take them out with folderId ''): every period of a transmittal goes along.
async function fileInto(refs, rms, files, folderId) {
  const now = new Date().toISOString();
  for (const i of files) for (const x of (i.batchId ? batchOf(rms, i) : [i])) {
    await saveItem(x.id, { ...strip(x), folderId, ...(folderId ? { filedAt: now, filedBy: by(refs), filedByName: myName(refs) } : { filedAt: '', filedBy: '', filedByName: '' }) }, by(refs));
  }
}
const saveStore = (refs, id, data) => store.save('rms_items', id, data, by(refs));

/* ================= Folders ================= */
export function foldersHtml(refs, rms, q) {
  const team = teamOf(q, refs);
  if (!team) return `<div class="msg bad">No team is assigned to you yet. Ask the Admin to set your team in Users &amp; Roles.</div>`;
  if (q.get('f')) return folderHtml(refs, rms, q, team);
  const rooms = roomsOf(rms, team.id), rf = q.get('r') || 'all';
  const list = foldersOfTeam(rms, team.id).filter((f) => rf === 'all' || whereOf(rms, f).room?.id === rf);
  const cols = 'grid-template-columns:minmax(170px,1fr) minmax(220px,1.4fr) minmax(170px,1.2fr) minmax(120px,1fr) 90px';
  const row = (f) => { const w = whereOf(rms, f), files = filesIn(rms, f.id), reps = [...new Set(files.map((x) => x.reportCode || (x.kind === 'comm' ? 'Comm.' : '')).filter(Boolean))];
    const find = [f.code, w.text, f.remarks, ...files.map((x) => numberOf(x))].join(' ').toLowerCase();
    return `<div class="t-row" style="${cols}" data-find="${esc(find)}"><span class="mono"><b>${esc(f.code)}</b></span>
      <span>${pill(placeName(w.place) || '—', w.place?.type === 'sack' ? 'sack' : 'blue')} <small>${esc(w.room?.name || '')}</small></span>
      <span>${files.length} file${files.length === 1 ? '' : 's'}${reps.length ? `<br><small>${esc(reps.join(', '))}</small>` : ''}</span>
      <span><small>${esc(f.remarks || '')}</small></span><span><a class="btn sm" href="#/rms/folders?t=${team.id}&f=${f.id}">Open</a></span></div>`; };
  return `<div class="hello"><div><h1>Folders · ${esc(team.data.name)}</h1><p>Each folder holds several files (received transmittals). A folder is on a cabinet/shelf, or in a sack, inside a room.</p></div>
      <div class="btn-row">${teamSel(refs, team, 'folders')}<button class="btn" id="fo-move" type="button">Move Folders…</button><button class="btn primary" id="fo-new" type="button">+ New Folder</button></div></div>
    ${!rooms.length ? `<div class="msg">No rooms yet for ${esc(team.data.name)}. Add the rooms, cabinets/shelves and sacks first in <a href="#/rms/storage?t=${team.id}">Storage Setup</a>.</div>` : ''}
    <section class="panel"><div class="panel-head"><h2>Folders · ${list.length}</h2><span class="r">
        <select class="input" id="fo-room"><option value="all">All rooms</option>${rooms.map((r) => `<option value="${r.id}" ${r.id === rf ? 'selected' : ''}>${esc(r.name)}</option>`).join('')}</select>
        <input class="input" id="fo-find" placeholder="Search folder code, file no., remarks" style="width:260px"></span></div>
      ${list.length ? `<div class="t-head" style="${cols}"><span>Folder Code</span><span>Where</span><span>Files</span><span>Remarks</span><span></span></div><div id="fo-list">${list.map(row).join('')}</div><p class="empty" id="fo-none" hidden>Nothing matches the search.</p>`
        : `<div class="empty"><b>No folders yet</b>Use + New Folder, then add its files.</div>`}</section>`;
}

function folderHtml(refs, rms, q, team) {
  const f = rms.folders.find((x) => x.id === q.get('f'));
  if (!f) return `<div class="msg bad">This folder was not found. <a href="#/rms/folders">Back to Folders</a></div>`;
  const w = whereOf(rms, f), files = filesIn(rms, f.id);
  const offs = visibleOffices(refs, rms, scopesFor(refs).map((s) => s.id));
  // Suggested: files not yet filed of the same offices and reports as those already in this folder.
  const keys = new Set(files.map((x) => x.officeId + '|' + (x.reportId || 'comm')));
  const sugg = keys.size ? teamFiles(refs, rms, f.teamId).filter((i) => !i.folderId && keys.has(i.officeId + '|' + (i.reportId || 'comm'))) : [];
  const cols = 'grid-template-columns:minmax(200px,1.1fr) minmax(220px,1.5fr) 120px 130px 170px';
  return `<div class="hello"><div><p><a href="#/rms/folders?t=${f.teamId}">← Folders</a></p><h1 class="mono">${esc(f.code)}</h1>
      <p>${pill(placeName(w.place) || '—', w.place?.type === 'sack' ? 'sack' : 'blue')} ${esc(w.room?.name || '')}${f.remarks ? ' · ' + esc(f.remarks) : ''}</p></div>
      <div class="btn-row"><button class="btn" id="fd-label" type="button">Print Label</button><button class="btn" id="fd-index" type="button">Print Index</button>
        <button class="btn" id="fd-move" type="button">Move…</button><button class="btn" id="fd-edit" type="button">Edit</button></div></div>
    <section class="panel"><div class="panel-head"><h2>Add Files</h2></div>
      <div style="padding:14px 22px 6px"><label class="legend" for="fd-q">Type a tracking number, office, report or month (e.g. “opac brs 2026”)</label>
        <input class="input" id="fd-q" style="max-width:620px;width:100%" autocomplete="off"><div id="fd-res" class="fd-res"></div>
        <div class="btn-row" style="margin-top:8px"><button class="btn primary sm" id="fd-add" type="button" disabled>Add Files</button>
          ${sugg.length ? `<small>Suggested: ${sugg.length} file${sugg.length > 1 ? 's' : ''} of the same office and report not yet filed · <a href="#" id="fd-sugg">add ${sugg.length > 1 ? 'all' : 'it'}</a></small>` : ''}</div></div></section>
    <section class="panel"><div class="panel-head"><h2>Files in this Folder · ${files.length}</h2></div>
      ${files.length ? `<div class="t-head" style="${cols}"><span>Tracking No.</span><span>Office · Item</span><span>Received</span><span>Filed</span><span></span></div>
        ${files.map((i) => { const d = describe(rms, offs, i); return `<div class="t-row" style="${cols}"><span class="mono">${esc(numberOf(i))}</span><span>${esc(d.office)}<br><small>${esc(d.what)}</small></span>
          <span><small>${esc(fmtDate(i.receivedAt))}</small></span><span><small>${esc(fmtDate(i.filedAt))}${i.filedByName ? ' · ' + esc(shortName(i.filedByName)) : ''}</small></span>
          <span class="acts"><button class="btn sm" data-fmove="${i.id}">Move to…</button><button class="btn sm" data-fout="${i.id}">Remove</button></span></div>`; }).join('')}`
        : '<div class="empty"><b>No files yet</b>Add them with the search above.</div>'}
      <div class="note">A file is in one folder only. “Move to…” puts it in another folder; “Remove” makes it Not Yet Filed again.</div></section>
    <section class="panel"><div class="panel-head"><h2>Movement History</h2></div>
      <div class="note">${(f.history || []).slice().reverse().map((h) => `<div>${esc(fmtDate(h.at))} · ${esc(h.text)}${h.byName ? ' · ' + esc(shortName(h.byName)) : ''}</div>`).join('') || 'No movement yet.'}</div></section>`;
}

export function wireFolders(refs, rms, q) {
  const team = teamOf(q, refs); if (!team) return;
  wireTeamSel();
  if (q.get('f')) return wireFolder(refs, rms, q);
  const nf = $('#fo-new'); if (nf) nf.onclick = () => newFolder(refs, rms, team);
  const mv = $('#fo-move'); if (mv) mv.onclick = () => moveFolders(refs, rms, team, null);
  const rs = $('#fo-room'); if (rs) rs.onchange = () => { location.hash = `#/rms/folders?t=${team.id}&r=${encodeURIComponent(rs.value)}`; };
  const fi = $('#fo-find'); if (fi) fi.oninput = () => { const v = fi.value.trim().toLowerCase(); let n = 0;
    $$('#fo-list .t-row').forEach((r) => { const hit = !v || v.split(/\s+/).every((x) => r.dataset.find.includes(x)); r.hidden = !hit; if (hit) n++; });
    const none = $('#fo-none'); if (none) none.hidden = n > 0; };
}
function wireTeamSel() { $$('[data-goto]').forEach((s) => { s.onchange = () => { location.hash = `#/rms/${s.dataset.goto}?t=${encodeURIComponent(s.value)}`; }; }); }

function wireFolder(refs, rms, q) {
  const f = rms.folders.find((x) => x.id === q.get('f')); if (!f) return;
  const offs = visibleOffices(refs, rms, scopesFor(refs).map((s) => s.id));
  const pool = teamFiles(refs, rms, f.teamId);
  const picked = new Set();
  const input = $('#fd-q'), res = $('#fd-res'), add = $('#fd-add');
  const upd = () => { add.disabled = !picked.size; add.textContent = picked.size ? `Add ${picked.size} File${picked.size > 1 ? 's' : ''}` : 'Add Files'; };
  input.oninput = () => {
    const v = input.value.trim().toLowerCase();
    if (!v) { res.innerHTML = ''; return; }
    const words = v.split(/\s+/);
    const hits = pool.filter((i) => words.every((w) => findText(rms, offs, i).includes(w))).sort((a, b) => (a.folderId ? 1 : 0) - (b.folderId ? 1 : 0) || String(b.receivedAt).localeCompare(String(a.receivedAt))).slice(0, 40);
    res.innerHTML = hits.length ? hits.map((i) => { const d = describe(rms, offs, i), other = i.folderId && rms.folders.find((x) => x.id === i.folderId);
      const here = i.folderId === f.id;
      return `<label class="${i.folderId ? 'dis' : ''}"><input type="checkbox" value="${i.id}" ${i.folderId ? 'disabled' : ''} ${picked.has(i.id) ? 'checked' : ''}> <span class="mono">${esc(numberOf(i))}</span>
        <small>· ${esc(d.what)} · ${esc(d.office)}${here ? ' · already in this folder' : other ? ` · in ${esc(other.code)} (use Move to… there)` : ''}</small></label>`; }).join('')
      : '<p class="hint">No file matches.</p>';
    $$('input[type=checkbox]', res).forEach((x) => { x.onchange = () => { if (x.checked) picked.add(x.value); else picked.delete(x.value); upd(); }; });
  };
  add.onclick = async () => { const list = pool.filter((i) => picked.has(i.id)); await fileInto(refs, rms, list, f.id); toast(`${list.length} file${list.length > 1 ? 's' : ''} added to ${f.code}.`, 'ok'); };
  const sg = $('#fd-sugg'); if (sg) sg.onclick = async (e) => { e.preventDefault();
    const keys = new Set(filesIn(rms, f.id).map((x) => x.officeId + '|' + (x.reportId || 'comm')));
    const list = pool.filter((i) => !i.folderId && keys.has(i.officeId + '|' + (i.reportId || 'comm')));
    await fileInto(refs, rms, list, f.id); toast(`${list.length} file${list.length > 1 ? 's' : ''} added to ${f.code}.`, 'ok'); };
  $$('[data-fout]').forEach((b) => { b.onclick = async () => { const i = rms.items.find((x) => x.id === b.dataset.fout); await fileInto(refs, rms, [i], ''); toast(`${numberOf(i)} is Not Yet Filed again.`, 'ok'); }; });
  $$('[data-fmove]').forEach((b) => { b.onclick = () => fileTo(refs, rms, [rms.items.find((x) => x.id === b.dataset.fmove)], f.teamId, f.id); });
  $('#fd-label').onclick = () => printLabel(rms, f, refs);
  $('#fd-index').onclick = () => printIndex(refs, rms, f);
  $('#fd-move').onclick = () => moveFolders(refs, rms, refs.teams.find((t) => t.id === f.teamId), [f.id]);
  $('#fd-edit').onclick = () => editFolder(refs, rms, f);
}

/* ---------- folder: new / edit ---------- */
function placePicker(rms, teamId, cur = {}) {
  const rooms = roomsOf(rms, teamId);
  return `<div class="two"><div class="field"><label for="pp-room">Room</label><select class="input" id="pp-room">${rooms.map((r) => `<option value="${r.id}" ${r.id === cur.roomId ? 'selected' : ''}>${esc(r.name)}</option>`).join('')}</select></div>
      <div class="field"><span class="legend">Where in the room</span><div class="rcv-type"><label><input type="radio" name="pp-type" value="shelf" ${cur.type !== 'sack' ? 'checked' : ''}> Cabinet / Shelf</label><label><input type="radio" name="pp-type" value="sack" ${cur.type === 'sack' ? 'checked' : ''}> Sack</label></div>
        <select class="input" id="pp-place"></select></div></div>
    <div class="field" id="pp-new-box" hidden><label for="pp-new" id="pp-new-l">New sack code</label><input class="input mono" id="pp-new" placeholder="e.g. S-2026-01"></div>`;
}
function wirePlacePicker(bg, rms, cur = {}) {
  const fill = () => {
    const room = $('#pp-room', bg).value, type = $('input[name=pp-type]:checked', bg).value;
    const ps = placesOf(rms, room).filter((p) => (type === 'sack') === (p.type === 'sack'));
    $('#pp-place', bg).innerHTML = ps.map((p) => `<option value="${p.id}" ${p.id === cur.placeId ? 'selected' : ''}>${esc(placeName(p))}</option>`).join('') + `<option value="__new">+ New ${type === 'sack' ? 'sack' : 'cabinet / shelf'}…</option>`;
    newState();
  };
  const newState = () => { const n = $('#pp-place', bg).value === '__new', type = $('input[name=pp-type]:checked', bg).value;
    $('#pp-new-box', bg).hidden = !n; $('#pp-new-l', bg).textContent = type === 'sack' ? 'New sack code' : 'New cabinet / shelf name';
    $('#pp-new', bg).placeholder = type === 'sack' ? 'e.g. S-2026-01' : 'e.g. Shelf 3, or Cabinet 1 · Drawer 2'; };
  if ($('#pp-room', bg)) { $('#pp-room', bg).onchange = fill; $$('input[name=pp-type]', bg).forEach((x) => { x.onchange = fill; }); $('#pp-place', bg).onchange = newState; fill(); }
}
// The chosen place, made first when it is new. Returns its id, or null (with a message) when something is missing.
function readPlace(bg, rms, teamId) {
  const room = $('#pp-room', bg)?.value; if (!room) { toast('Add a room first in Storage Setup.', 'bad'); return null; }
  const type = $('input[name=pp-type]:checked', bg).value, v = $('#pp-place', bg).value;
  if (v !== '__new') return { id: v };
  const name = $('#pp-new', bg).value.trim(); if (!name) { toast(type === 'sack' ? 'Enter the sack code.' : 'Enter the cabinet / shelf name.', 'bad'); return null; }
  if (type === 'sack' && rms.places.some((p) => live(p) && p.type === 'sack' && p.teamId === teamId && p.code.toUpperCase() === name.toUpperCase())) { toast(`Sack ${name} already exists in this team.`, 'bad'); return null; }
  return { id: newId('place'), make: { kind: 'store-place', teamId, roomId: room, type, ...(type === 'sack' ? { code: name.toUpperCase() } : { name }) } };
}
async function makePlace(refs, pl) { if (pl.make) await saveStore(refs, pl.id, pl.make); return pl.id; }
const placeText = (rms, placeId, made) => { const p = rms.places.find((x) => x.id === placeId) || made, r = p && rms.rooms.find((x) => x.id === p.roomId); return `${placeName(p)}${r ? ' (' + r.name + ')' : ''}`; };

async function newFolder(refs, rms, team, then) {
  if (!roomsOf(rms, team.id).length) return toast(`Add a room first in Storage Setup (${team.data.name}).`, 'bad');
  let out = null;
  const res = await modal({ title: 'New Folder · ' + team.data.name, wide: true,
    body: `<div class="field" style="max-width:320px"><label for="nf-code">Folder Code (unique in the team)</label><input class="input mono upper" id="nf-code" placeholder="e.g. F-OPAC-BRS-2026-A"></div>
      ${placePicker(rms, team.id)}
      <div class="field"><label for="nf-rem">Remarks (optional)</label><input class="input" id="nf-rem" placeholder="e.g. BRS 75 accounts, part 2"></div>
      <p class="hint">Then add its files with the search field.</p>`,
    onOpen: (bg) => wirePlacePicker(bg, rms),
    buttons: [{ label: 'Cancel', value: null }, { label: 'Save Folder', cls: 'primary', value: 'save', check: (bg) => {
      const code = $('#nf-code', bg).value.trim().toUpperCase(); if (!code) { toast('Enter the Folder Code.', 'bad'); return false; }
      if (rms.folders.some((x) => live(x) && x.teamId === team.id && x.code === code)) { toast(`Folder ${code} already exists in ${team.data.name}.`, 'bad'); return false; }
      const pl = readPlace(bg, rms, team.id); if (!pl) return false;
      out = { code, pl, remarks: $('#nf-rem', bg).value.trim() }; return true; } }] });
  if (res !== 'save') return;
  const placeId = await makePlace(refs, out.pl), id = newId('folder'), now = new Date().toISOString();
  await saveStore(refs, id, { kind: 'store-folder', teamId: team.id, code: out.code, placeId, remarks: out.remarks,
    history: [{ at: now, by: by(refs), byName: myName(refs), to: placeId, text: 'folder made on ' + placeText(rms, placeId, out.pl.make) }] });
  toast(`Folder ${out.code} saved.`, 'ok');
  if (then) return then(id);
  location.hash = `#/rms/folders?t=${team.id}&f=${id}`;
}

async function editFolder(refs, rms, f) {
  const files = filesIn(rms, f.id);
  let out = null;
  const res = await modal({ title: 'Edit Folder · ' + f.code,
    body: `<div class="field" style="max-width:320px"><label for="ef-code">Folder Code</label><input class="input mono upper" id="ef-code" value="${esc(f.code)}"></div>
      <div class="field"><label for="ef-rem">Remarks</label><input class="input" id="ef-rem" value="${esc(f.remarks || '')}"></div>
      <p class="hint">To change where it is, use Move…</p>`,
    buttons: [{ label: 'Cancel', value: null }, ...(files.length ? [] : [{ label: 'Remove Folder', value: 'rm' }]), { label: 'Save', cls: 'primary', value: 'save', check: (bg) => {
      const code = $('#ef-code', bg).value.trim().toUpperCase(); if (!code) { toast('Enter the Folder Code.', 'bad'); return false; }
      if (rms.folders.some((x) => live(x) && x.id !== f.id && x.teamId === f.teamId && x.code === code)) { toast(`Folder ${code} already exists.`, 'bad'); return false; }
      out = { code, remarks: $('#ef-rem', bg).value.trim() }; return true; } }] });
  if (res === 'rm') { await saveStore(refs, f.id, { ...strip(f), removed: true }); toast(`Folder ${f.code} removed.`, 'ok'); location.hash = `#/rms/folders?t=${f.teamId}`; return; }
  if (res !== 'save') return;
  await saveStore(refs, f.id, { ...strip(f), ...out });
  toast('Folder saved.', 'ok');
}

/* ---------- file into another folder ---------- */
async function fileTo(refs, rms, files, teamId, notId = '') {
  const fs = foldersOfTeam(rms, teamId).filter((x) => x.id !== notId);
  let pick = null;
  const res = await modal({ title: files.length > 1 ? `File ${files.length} Files in…` : 'Move ' + numberOf(files[0]) + ' to…',
    body: `<div class="field"><label for="ft-q">Folder Code</label><input class="input mono upper" id="ft-q" list="ft-list" placeholder="Type or pick a folder code" autocomplete="off">
        <datalist id="ft-list">${fs.map((x) => `<option value="${esc(x.code)}">${esc(whereOf(rms, x).text)}</option>`).join('')}</datalist></div>
      <p class="hint">Or <a href="#" id="ft-new">make a new folder</a> for ${files.length > 1 ? 'them' : 'it'}.</p>`,
    onOpen: (bg) => { $('#ft-new', bg).onclick = (e) => { e.preventDefault(); pick = '__new'; $('.mf .btn', bg).click(); }; },
    buttons: [{ label: 'Cancel', value: null }, { label: files.length > 1 ? 'File Them' : 'Move', cls: 'primary', value: 'go', check: (bg) => {
      const code = $('#ft-q', bg).value.trim().toUpperCase(), f = fs.find((x) => x.code === code);
      if (!f) { toast(code ? `No folder ${code} in this team.` : 'Type or pick a folder code.', 'bad'); return false; }
      pick = f.id; return true; } }] });
  if (pick === '__new') return newFolder(refs, rms, refs.teams.find((t) => t.id === teamId), async (id) => { await fileInto(refs, rms, files, id); toast(`${files.length} file${files.length > 1 ? 's' : ''} filed.`, 'ok'); location.hash = `#/rms/folders?t=${teamId}&f=${id}`; });
  if (res !== 'go') return;
  await fileInto(refs, rms, files, pick);
  toast(`${files.length > 1 ? files.length + ' files' : numberOf(files[0])} filed in ${rms.folders.find((x) => x.id === pick).code}.`, 'ok');
}

/* ---------- move folders (one, several, or a whole shelf) ---------- */
async function moveFolders(refs, rms, team, ids) {
  const fs = foldersOfTeam(rms, team.id);
  if (!fs.length) return toast('No folders yet.', 'bad');
  const shelves = rms.places.filter((p) => live(p) && p.teamId === team.id && foldersIn(rms, p.id).length);
  let out = null;
  const res = await modal({ title: 'Move Folders · ' + team.data.name, wide: true,
    body: `${ids ? `<p>Moving <b class="mono">${ids.map((i) => esc(fs.find((x) => x.id === i)?.code || '')).join(', ')}</b> (now ${esc(whereOf(rms, fs.find((x) => x.id === ids[0])).text)})</p>`
      : `<div class="field"><span class="legend">Move</span><div class="rcv-type"><label><input type="radio" name="mv-mode" value="some" checked> Chosen folders</label><label><input type="radio" name="mv-mode" value="place"> Everything on a cabinet / shelf / sack</label></div></div>
      <div id="mv-some"><input class="input" id="mv-find" placeholder="Search folder code"><div class="rcv-items long" id="mv-list">${fs.map((f) => `<label data-t="${esc(f.code.toLowerCase())}"><input type="checkbox" name="mv-f" value="${f.id}"> <span class="mono">${esc(f.code)}</span> <small>· ${esc(whereOf(rms, f).text)}</small></label>`).join('')}</div></div>
      <div id="mv-place" hidden><select class="input" id="mv-from">${shelves.map((p) => `<option value="${p.id}">${esc(placeText(rms, p.id))} · ${foldersIn(rms, p.id).length} folders</option>`).join('')}</select></div>`}
      <span class="legend">Move to</span>${placePicker(rms, team.id, { type: 'sack' })}
      <div class="field" style="max-width:220px"><label for="mv-date">Date moved</label><input class="input" type="date" id="mv-date" value="${today()}" max="${today()}"></div>
      <p class="hint">Each folder keeps its movement history. Print the sack's contents list after moving (Storage Setup).</p>`,
    onOpen: (bg) => {
      wirePlacePicker(bg, rms, { type: 'sack' });
      $$('input[name=mv-mode]', bg).forEach((x) => { x.onchange = () => { const p = $('input[name=mv-mode]:checked', bg).value === 'place'; $('#mv-some', bg).hidden = p; $('#mv-place', bg).hidden = !p; }; });
      if ($('#mv-find', bg)) $('#mv-find', bg).oninput = () => { const v = $('#mv-find', bg).value.trim().toLowerCase(); $$('#mv-list label', bg).forEach((l) => { l.hidden = v && !l.dataset.t.includes(v); }); };
    },
    buttons: [{ label: 'Cancel', value: null }, { label: 'Move', cls: 'primary', value: 'go', check: (bg) => {
      let list = ids;
      if (!list) list = $('input[name=mv-mode]:checked', bg).value === 'place' ? foldersIn(rms, $('#mv-from', bg).value).map((f) => f.id) : $$('input[name=mv-f]:checked', bg).map((x) => x.value);
      if (!list || !list.length) { toast('Choose the folders to move.', 'bad'); return false; }
      const pl = readPlace(bg, rms, team.id); if (!pl) return false;
      const day = $('#mv-date', bg).value; if (!day) { toast('Enter the date moved.', 'bad'); return false; }
      out = { list, pl, at: new Date(day + 'T12:00:00').toISOString() }; return true; } }] });
  if (res !== 'go') return;
  const placeId = await makePlace(refs, out.pl), to = placeText(rms, placeId, out.pl.make);
  let n = 0;
  for (const id of out.list) { const f = rms.folders.find((x) => x.id === id); if (!f || f.placeId === placeId) continue;
    await saveStore(refs, id, { ...strip(f), placeId, history: [...(f.history || []), { at: out.at, by: by(refs), byName: myName(refs), from: f.placeId, to: placeId, text: `moved from ${placeText(rms, f.placeId)} to ${to}` }] }); n++; }
  toast(`${n} folder${n === 1 ? '' : 's'} moved to ${to}.`, 'ok');
}

/* ================= Not Yet Filed ================= */
export const unfiledCount = (refs, rms) => storageTeams(refs).reduce((n, t) => n + teamFiles(refs, rms, t.id).filter((i) => !i.folderId).length, 0);
export function unfiledHtml(refs, rms, q) {
  const team = teamOf(q, refs);
  if (!team) return `<div class="msg bad">No team is assigned to you yet.</div>`;
  const offs = visibleOffices(refs, rms, scopesFor(refs).map((s) => s.id));
  const list = teamFiles(refs, rms, team.id).filter((i) => !i.folderId).sort((a, b) => String(a.trackingNo).localeCompare(String(b.trackingNo)));
  const offIds = [...new Set(list.map((i) => i.officeId).filter(Boolean))], reps = [...new Set(list.map((i) => i.reportCode || (i.kind === 'comm' ? 'Communication' : '')).filter(Boolean))].sort();
  const cols = 'grid-template-columns:40px minmax(200px,1.1fr) minmax(240px,1.6fr) 130px';
  return `<div class="hello"><div><h1>Not Yet Filed · ${list.length}</h1><p>Received files that are not in any folder yet. Tick several and file them together.</p></div><div class="btn-row">${teamSel(refs, team, 'unfiled')}</div></div>
    <section class="panel"><div class="panel-head"><h2>${list.length} file${list.length === 1 ? '' : 's'}</h2><span class="r">
        <select class="input" id="uf-off"><option value="">All offices</option>${offIds.map((id) => `<option value="${id}">${esc(offs.find((o) => o.id === id)?.label || id)}</option>`).join('')}</select>
        <select class="input" id="uf-rep"><option value="">All reports</option>${reps.map((r) => `<option>${esc(r)}</option>`).join('')}</select>
        <input class="input" id="uf-find" placeholder="Search" style="width:200px"></span></div>
      ${list.length ? `<div class="t-head" style="${cols}"><span><input type="checkbox" id="uf-all" aria-label="Tick all shown"></span><span>Tracking No.</span><span>Office · Item</span><span>Received</span></div>
        <div id="uf-list">${list.map((i) => { const d = describe(rms, offs, i); return `<label class="t-row" style="${cols}" data-off="${esc(i.officeId || '')}" data-rep="${esc(i.reportCode || (i.kind === 'comm' ? 'Communication' : ''))}" data-find="${esc(findText(rms, offs, i))}">
          <span><input type="checkbox" name="uf" value="${i.id}"></span><span class="mono">${esc(numberOf(i))}</span><span>${esc(d.office)}<br><small>${esc(d.what)}</small></span><span><small>${esc(fmtDate(i.receivedAt))}</small></span></label>`; }).join('')}</div>
        <div class="note"><button class="btn primary sm" id="uf-file" type="button" disabled>File in…</button> &nbsp;choose a folder (by Folder Code) or make a new one.</div>`
        : '<div class="empty"><b>Everything is filed</b>New receipts appear here until they are put in a folder.</div>'}</section>`;
}
export function wireUnfiled(refs, rms, q) {
  const team = teamOf(q, refs); if (!team) return;
  wireTeamSel();
  const btn = $('#uf-file'); if (!btn) return;
  const upd = () => { const n = $$('input[name=uf]:checked').length; btn.disabled = !n; btn.textContent = n ? `File ${n} in…` : 'File in…'; };
  const filt = () => { const o = $('#uf-off').value, r = $('#uf-rep').value, v = $('#uf-find').value.trim().toLowerCase();
    $$('#uf-list .t-row').forEach((row) => { row.hidden = (o && row.dataset.off !== o) || (r && row.dataset.rep !== r) || (v && !v.split(/\s+/).every((w) => row.dataset.find.includes(w))); }); };
  $('#uf-off').onchange = filt; $('#uf-rep').onchange = filt; $('#uf-find').oninput = filt;
  $$('input[name=uf]').forEach((x) => { x.onchange = upd; });
  $('#uf-all').onchange = () => { $$('#uf-list .t-row').forEach((row) => { if (!row.hidden) $('input', row).checked = $('#uf-all').checked; }); upd(); };
  btn.onclick = () => { const ids = new Set($$('input[name=uf]:checked').map((x) => x.value)); fileTo(refs, rms, rms.items.filter((i) => ids.has(i.id)), team.id); };
}

/* ================= Location ================= */
export function locationHtml(refs, rms, q) {
  const team = teamOf(q, refs);
  if (!team) return `<div class="msg bad">No team is assigned to you yet.</div>`;
  const offs = visibleOffices(refs, rms, scopesFor(refs).map((s) => s.id));
  const rooms = roomsOf(rms, team.id);
  const fileRow = (i) => { const d = describe(rms, offs, i); return `<div><span class="mono">${esc(numberOf(i))}</span><small>${esc(d.what)} · ${esc(d.office)} · received ${esc(fmtDate(i.receivedAt))}</small><button class="btn sm" data-lview="${i.id}" type="button">View</button></div>`; };
  const folderNode = (f) => { const files = filesIn(rms, f.id);
    return `<details data-node="${f.id}"><summary><span class="ic">📁</span><span class="mono">${esc(f.code)}</span><small>${files.length} file${files.length === 1 ? '' : 's'} · <a href="#/rms/folders?t=${team.id}&f=${f.id}">open</a></small></summary>
      <div class="files">${files.map(fileRow).join('') || '<div><small>No files yet.</small></div>'}</div></details>`; };
  const placeNode = (p) => { const fs = foldersIn(rms, p.id);
    return `<details data-node="${p.id}"><summary><span class="ic">${p.type === 'sack' ? '🛍' : '🗄'}</span><span class="${p.type === 'sack' ? 'mono' : ''}">${esc(placeName(p))}</span><small>${fs.length} folder${fs.length === 1 ? '' : 's'}${p.type === 'sack' ? ` · <a href="#" data-sackprint="${p.id}">contents list</a>` : ''}</small></summary>${fs.map(folderNode).join('') || '<p class="hint" style="margin-left:46px">No folders.</p>'}</details>`; };
  const roomNode = (r) => { const ps = placesOf(rms, r.id), nf = ps.reduce((n, p) => n + foldersIn(rms, p.id).length, 0), sh = ps.filter((p) => p.type !== 'sack').length, sk = ps.length - sh;
    return `<details data-node="${r.id}"><summary><span class="ic">🏠</span><b>${esc(r.name)}</b><small>${[sh ? sh + ' cabinet/shelf' : '', sk ? sk + ' sack' + (sk > 1 ? 's' : '') : '', nf + ' folder' + (nf === 1 ? '' : 's')].filter(Boolean).join(' · ')}</small></summary>${ps.map(placeNode).join('') || '<p class="hint" style="margin-left:46px">No cabinets, shelves or sacks yet.</p>'}</details>`; };
  return `<div class="hello"><div><h1>Location · ${esc(team.data.name)}</h1><p>Open a room to see its cabinets, shelves and sacks, then one of them to see its folders, then a folder to see its files. Or search directly.</p></div><div class="btn-row">${teamSel(refs, team, 'location')}</div></div>
    <input class="input" id="lc-q" placeholder="Search a tracking number, folder code or sack code" style="width:440px;max-width:100%;margin-bottom:14px" autocomplete="off">
    <div id="lc-res"></div>
    <section class="panel"><div class="crumb" id="lc-crumb">All rooms</div>
      <div class="tree">${rooms.map(roomNode).join('') || `<div class="empty"><b>No rooms yet</b>Add them in <a href="#/rms/storage?t=${team.id}">Storage Setup</a>.</div>`}</div></section>`;
}
export function wireLocation(refs, rms, q, view) {
  const team = teamOf(q, refs); if (!team) return;
  wireTeamSel();
  const offs = visibleOffices(refs, rms, scopesFor(refs).map((s) => s.id));
  const nameOf = (id) => { const r = rms.rooms.find((x) => x.id === id); if (r) return r.name; const p = rms.places.find((x) => x.id === id); if (p) return placeName(p); return rms.folders.find((x) => x.id === id)?.code || ''; };
  // Path line: where the last opened item is.
  $$('.tree details').forEach((d) => { d.addEventListener('toggle', () => {
    if (!d.open) return;
    const chain = []; let x = d; while (x && x.matches && x.matches('details')) { chain.unshift(x.dataset.node); x = x.parentElement.closest('details'); }
    $('#lc-crumb').innerHTML = ['All rooms', ...chain.map(nameOf)].map(esc).join(' › '); }); });
  $$('[data-lview]').forEach((b) => { b.onclick = () => view(b.dataset.lview); });
  $$('[data-sackprint]').forEach((a) => { a.onclick = (e) => { e.preventDefault(); printSack(rms, rms.places.find((p) => p.id === a.dataset.sackprint), refs); }; });
  const qi = $('#lc-q'), res = $('#lc-res');
  qi.oninput = () => {
    const v = qi.value.trim().toLowerCase(); if (!v) { res.innerHTML = ''; return; }
    const words = v.split(/\s+/);
    const files = teamFiles(refs, rms, team.id).filter((i) => words.every((w) => findText(rms, offs, i).includes(w))).slice(0, 8);
    const folders = foldersOfTeam(rms, team.id).filter((f) => words.every((w) => f.code.toLowerCase().includes(w))).slice(0, 5);
    const sacks = rms.places.filter((p) => live(p) && p.teamId === team.id && p.type === 'sack' && words.every((w) => p.code.toLowerCase().includes(w))).slice(0, 5);
    const step = (k, v2, mono) => `<div class="step"><small>${k}</small><span class="${mono ? 'mono' : ''}">${esc(v2)}</span></div>`;
    const path = (f) => { const w = whereOf(rms, f); return [step('Room', w.room?.name || '—'), step(w.place?.type === 'sack' ? 'Sack' : 'Cabinet / Shelf', placeName(w.place) || '—', w.place?.type === 'sack'), step('Folder', f.code, true)]; };
    res.innerHTML = `<section class="panel">${files.map((i) => { const f = rms.folders.find((x) => x.id === i.folderId), d = describe(rms, offs, i);
        return `<div class="panel-head"><h2 class="mono">${esc(numberOf(i))}</h2><small>${esc(d.what)} · ${esc(d.office)}</small></div>
          ${f ? `<div class="path">${[...path(f), step('File', numberOf(i), true)].join('<span class="arr">›</span>')}</div>
            <div class="hist"><b>Folder history</b>${(f.history || []).slice().reverse().map((h) => `<div>${esc(fmtDate(h.at))} · ${esc(h.text)}${h.byName ? ' · ' + esc(shortName(h.byName)) : ''}</div>`).join('')}</div>`
            : `<div class="note"><b>Not yet filed.</b> <a href="#/rms/unfiled?t=${team.id}">File it</a></div>`}`; }).join('')}
      ${folders.map((f) => `<div class="panel-head"><h2>Folder <span class="mono">${esc(f.code)}</span></h2><small>${filesIn(rms, f.id).length} files · <a href="#/rms/folders?t=${team.id}&f=${f.id}">open</a></small></div><div class="path">${path(f).join('<span class="arr">›</span>')}</div>`).join('')}
      ${sacks.map((p) => `<div class="panel-head"><h2>Sack <span class="mono">${esc(p.code)}</span></h2><small>${foldersIn(rms, p.id).length} folders · ${esc(rms.rooms.find((r) => r.id === p.roomId)?.name || '')} · <a href="#" data-sp="${p.id}">contents list</a></small></div>`).join('')}
      ${files.length + folders.length + sacks.length ? '' : '<div class="empty"><b>Nothing found</b>Check the number or code.</div>'}</section>`;
    $$('[data-sp]', res).forEach((a) => { a.onclick = (e) => { e.preventDefault(); printSack(rms, rms.places.find((p) => p.id === a.dataset.sp), refs); }; });
  };
}

/* ================= Storage Setup ================= */
export function storageHtml(refs, rms, q) {
  const team = teamOf(q, refs);
  if (!team) return `<div class="msg bad">No team is assigned to you yet.</div>`;
  const rooms = roomsOf(rms, team.id);
  return `<div class="hello"><div><h1>Storage Setup · ${esc(team.data.name)}</h1><p>Each team keeps its own rooms. In each room: cabinets/shelves (current files) and sacks (old files).</p></div>
      <div class="btn-row">${teamSel(refs, team, 'storage')}<button class="btn primary" id="ss-room" type="button">+ Add Room</button></div></div>
    <section class="panel">${rooms.length ? `<div class="rooms">${rooms.map((r) => { const ps = placesOf(rms, r.id);
      return `<div class="room"><div class="room-h"><h3>${esc(r.name)}</h3><button class="btn sm" data-rroom="${r.id}" type="button">Edit</button></div>${r.note ? `<small>${esc(r.note)}</small>` : ''}
        <ul>${ps.map((p) => { const n = foldersIn(rms, p.id).length; return `<li><span>${p.type === 'sack' ? '🛍' : '🗄'} <span class="${p.type === 'sack' ? 'mono' : ''}">${esc(placeName(p))}</span></span>
          <small>${n} folder${n === 1 ? '' : 's'}${p.type === 'sack' ? ` · <a href="#" data-sackprint="${p.id}">contents list</a>` : ''} · <a href="#" data-rplace="${p.id}">edit</a></small></li>`; }).join('') || '<li><small>No cabinets, shelves or sacks yet.</small></li>'}</ul>
        <div class="btn-row" style="margin-top:10px"><button class="btn sm" data-addp="${r.id}|shelf" type="button">+ Cabinet / Shelf</button><button class="btn sm" data-addp="${r.id}|sack" type="button">+ Sack</button></div></div>`; }).join('')}</div>`
      : '<div class="empty"><b>No rooms yet</b>Add the first room, e.g. “PSAO Records Room”, then its cabinets/shelves and sacks.</div>'}</section>`;
}
export function wireStorage(refs, rms, q) {
  const team = teamOf(q, refs); if (!team) return;
  wireTeamSel();
  $('#ss-room').onclick = () => editRoom(refs, rms, team, null);
  $$('[data-rroom]').forEach((b) => { b.onclick = () => editRoom(refs, rms, team, rms.rooms.find((r) => r.id === b.dataset.rroom)); });
  $$('[data-addp]').forEach((b) => { const [roomId, type] = b.dataset.addp.split('|'); b.onclick = () => editPlace(refs, rms, team, null, roomId, type); });
  $$('[data-rplace]').forEach((a) => { a.onclick = (e) => { e.preventDefault(); const p = rms.places.find((x) => x.id === a.dataset.rplace); editPlace(refs, rms, team, p, p.roomId, p.type); }; });
  $$('[data-sackprint]').forEach((a) => { a.onclick = (e) => { e.preventDefault(); printSack(rms, rms.places.find((p) => p.id === a.dataset.sackprint), refs); }; });
}
async function editRoom(refs, rms, team, r) {
  const empty = r && !placesOf(rms, r.id).length;
  let out = null;
  const res = await modal({ title: r ? 'Edit Room' : 'Add Room · ' + team.data.name,
    body: `<div class="field"><label for="er-name">Room name</label><input class="input" id="er-name" value="${esc(r?.name || '')}" placeholder="e.g. PSAO Records Room, Quirino Provincial Hospital Records Room"></div>
      <div class="field"><label for="er-note">Where / note (optional)</label><input class="input" id="er-note" value="${esc(r?.note || '')}" placeholder="e.g. Capitol compound, 2nd floor"></div>`,
    buttons: [{ label: 'Cancel', value: null }, ...(empty ? [{ label: 'Remove Room', value: 'rm' }] : []), { label: 'Save', cls: 'primary', value: 'save', check: (bg) => {
      const name = $('#er-name', bg).value.trim(); if (!name) { toast('Enter the room name.', 'bad'); return false; }
      if (rms.rooms.some((x) => live(x) && x.teamId === team.id && x.id !== r?.id && x.name.toLowerCase() === name.toLowerCase())) { toast('That room already exists.', 'bad'); return false; }
      out = { name, note: $('#er-note', bg).value.trim() }; return true; } }] });
  if (res === 'rm') { await saveStore(refs, r.id, { ...strip(r), removed: true }); toast('Room removed.', 'ok'); return; }
  if (res !== 'save') return;
  await saveStore(refs, r ? r.id : newId('room'), { ...(r ? strip(r) : { kind: 'store-room', teamId: team.id }), ...out });
  toast('Room saved.', 'ok');
}
async function editPlace(refs, rms, team, p, roomId, type) {
  const sack = type === 'sack', empty = p && !foldersIn(rms, p.id).length;
  let out = null;
  const res = await modal({ title: (p ? 'Edit ' : 'Add ') + (sack ? 'Sack' : 'Cabinet / Shelf') + ' · ' + (rms.rooms.find((r) => r.id === roomId)?.name || ''),
    body: `<div class="field"><label for="ep-name">${sack ? 'Sack code' : 'Name'}</label><input class="input ${sack ? 'mono upper' : ''}" id="ep-name" value="${esc(p ? (sack ? p.code : p.name) : '')}" placeholder="${sack ? 'e.g. S-2026-01' : 'e.g. Shelf 3, or Cabinet 1 · Drawer 2'}"></div>`,
    buttons: [{ label: 'Cancel', value: null }, ...(empty ? [{ label: 'Remove', value: 'rm' }] : []), { label: 'Save', cls: 'primary', value: 'save', check: (bg) => {
      let v = $('#ep-name', bg).value.trim(); if (!v) { toast(sack ? 'Enter the sack code.' : 'Enter the name.', 'bad'); return false; }
      if (sack) { v = v.toUpperCase(); if (rms.places.some((x) => live(x) && x.teamId === team.id && x.type === 'sack' && x.id !== p?.id && x.code === v)) { toast(`Sack ${v} already exists in this team.`, 'bad'); return false; } }
      out = sack ? { code: v } : { name: v }; return true; } }] });
  if (res === 'rm') { await saveStore(refs, p.id, { ...strip(p), removed: true }); toast('Removed.', 'ok'); return; }
  if (res !== 'save') return;
  await saveStore(refs, p ? p.id : newId('place'), { ...(p ? strip(p) : { kind: 'store-place', teamId: team.id, roomId, type }), ...out });
  toast('Saved.', 'ok');
}

/* ================= printouts ================= */
function printPage(title, body) {
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>
    @page{size:letter; margin:0.5in} body{font-family:Arial,Helvetica,sans-serif; color:#111; font-size:10.5pt}
    .lbl{display:inline-block; border:2px solid #111; padding:12px 16px; margin:0 12px 12px 0; min-width:3.2in} .lbl .c{font:700 22pt Consolas,monospace} .lbl .l{font-size:10pt; margin-top:4px}
    h1{font-size:15pt; margin:0 0 2px} .sub{color:#444; margin:0 0 12px} table{border-collapse:collapse; width:100%} th,td{border:1px solid #999; padding:5px 7px; text-align:left; font-size:9.5pt} th{background:#eee}
    .mono{font-family:Consolas,monospace}</style></head><body>${body}<script>window.onload=()=>{window.focus();window.print();}<\/script></body></html>`;
  const w = window.open('', '_blank'); if (!w) return toast('Allow pop-ups for this site to print.', 'bad');
  w.document.open(); w.document.write(html); w.document.close();
}
function printLabel(rms, f, refs) {
  const w = whereOf(rms, f), files = filesIn(rms, f.id), team = refs.teams.find((t) => t.id === f.teamId);
  printPage(f.code, `<div class="lbl"><div class="c">${esc(f.code)}</div><div class="l">${esc(w.text)} · ${esc(team?.data.name || '')}<br>${files.length} file${files.length === 1 ? '' : 's'}${f.remarks ? ' · ' + esc(f.remarks) : ''}</div></div>`);
}
function printIndex(refs, rms, f) {
  const w = whereOf(rms, f), files = filesIn(rms, f.id), offs = visibleOffices(refs, rms, scopesFor(refs).map((s) => s.id));
  printPage(f.code + ' index', `<h1>Folder <span class="mono">${esc(f.code)}</span></h1><p class="sub">${esc(w.text)} · ${files.length} files · printed ${esc(fmtDate(new Date()))}</p>
    <table><thead><tr><th>#</th><th>Tracking No.</th><th>Office</th><th>Item</th><th>Received</th></tr></thead><tbody>${files.map((i, k) => { const d = describe(rms, offs, i);
      return `<tr><td>${k + 1}</td><td class="mono">${esc(numberOf(i))}</td><td>${esc(d.office)}</td><td>${esc(d.what)}</td><td>${esc(fmtDate(i.receivedAt))}</td></tr>`; }).join('')}</tbody></table>`);
}
function printSack(rms, p, refs) {
  if (!p) return;
  const r = rms.rooms.find((x) => x.id === p.roomId), fs = foldersIn(rms, p.id), team = refs.teams.find((t) => t.id === p.teamId);
  printPage('Sack ' + p.code, `<div class="lbl"><div class="c">SACK ${esc(p.code)}</div><div class="l">${esc(r?.name || '')} · ${esc(team?.data.name || '')} · ${fs.length} folders</div></div>
    <h1>Contents of Sack <span class="mono">${esc(p.code)}</span></h1><p class="sub">${esc(r?.name || '')} · printed ${esc(fmtDate(new Date()))}</p>
    <table><thead><tr><th>#</th><th>Folder Code</th><th>Files</th><th>Tracking numbers</th></tr></thead><tbody>${fs.map((f, k) => { const files = filesIn(rms, f.id);
      return `<tr><td>${k + 1}</td><td class="mono">${esc(f.code)}</td><td>${files.length}</td><td class="mono" style="font-size:8.5pt">${esc(files.map((i) => numberOf(i)).join(', '))}</td></tr>`; }).join('')}</tbody></table>`);
}
