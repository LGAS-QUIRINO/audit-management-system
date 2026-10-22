/**
 * AMS – Audit Management System · COA Quirino
 * Database script. It lives inside the "AMS Database" Google Sheet owned by the AMS Gmail.
 *
 * New database: fill in the two lines below, run setup() once, then Deploy → New deployment → Web app
 * (Execute as: Me · Who has access: Anyone). See SETUP.md.
 * Updating an existing database: replace this whole file, then Deploy → Manage deployments → Edit → Version: New version.
 */
const CLIENT_ID = '__CLIENT_ID__';   // from Google Cloud → Credentials
const FIRST_ADMIN_EMAIL = 'paste.the.admin.gmail@gmail.com';               // only needed by setup() for a new database

// Core lists, then Records Management (added 19 Oct 2026). A missing sheet is made the first time it is used.
const TABLES = ['users', 'teams', 'lgus', 'rms_reports', 'rms_offices', 'rms_items', 'rms_settings'];
const ADMIN_TABLES = { users: true, teams: true, lgus: true };            // only the Admin may change these
// Who may change the Records Management lists (by role).
const TABLE_ROLES = {
  rms_reports: ['admin', 'osa'],                                  // Report Library: Admin and SA Staff
  rms_settings: ['admin', 'osa', 'sa'],                           // monitoring start, report groups, PSAO document types
  rms_offices: ['admin', 'sa', 'atl', 'member'],                  // Office Setup
  rms_items: ['admin', 'sa', 'atl', 'member', 'osa', 'staff']     // Receiving: everyone with a role
};
const DECIDERS = ['admin', 'sa', 'atl', 'member'];                // may accept or reject (not JO or SA Staff)
const CORRECTORS = ['admin', 'sa'];                               // may correct a received record
const PSAO = ['admin', 'sa', 'osa'];                              // may record in the PSAO books (PSAO-IN / PSAO-OUT)
const HEAD = ['id', 'version', 'updatedAt', 'updatedBy', 'deleted', 'data'];
const SEED = __SEED__;

/* ---------- one-time setup ---------- */
function setup() {
  if (CLIENT_ID.indexOf('PASTE') === 0 || CLIENT_ID.indexOf('__') === 0 || FIRST_ADMIN_EMAIL.indexOf('paste') === 0) throw new Error('Fill in CLIENT_ID and FIRST_ADMIN_EMAIL at the top first.');
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  TABLES.concat(['log']).forEach(function (name) {
    let sh = ss.getSheetByName(name);
    if (!sh) sh = ss.insertSheet(name);
    if (sh.getLastRow() === 0) {
      sh.appendRow(name === 'log' ? ['at', 'by', 'action', 'table', 'id'] : HEAD);
      sh.setFrozenRows(1);
    }
  });
  const first = ss.getSheetByName('Sheet1'); if (first && ss.getSheets().length > 1 && first.getLastRow() === 0) ss.deleteSheet(first);
  const now = new Date().toISOString();
  const add = function (table, id, rec) { if (!findRow_(table, id)) sheet_(table).appendRow([id, 1, now, 'setup', false, JSON.stringify(rec)]); };
  SEED.teams.forEach(function (t) { add('teams', t.id, t); });
  SEED.lgus.forEach(function (l) { add('lgus', l.id, l); });
  const email = FIRST_ADMIN_EMAIL.trim().toLowerCase();
  const users = readAll_('users');
  if (!users.some(function (u) { return String(u.data.email).toLowerCase() === email; })) {
    add('users', 'user-first-admin', { email: email, name: 'ADMIN', nickname: '', position: '', designation: '', roles: ['admin'], teamIds: [], munIds: [], status: 'active' });
  }
  SpreadsheetApp.flush();
  Logger.log('AMS setup done: ' + SEED.teams.length + ' teams, ' + SEED.lgus.length + ' LGUs, first Admin ' + email);
}

/* ---------- web app ---------- */
// Shown when the Web app URL is opened in a browser, to check which version is deployed.
const SCRIPT_VERSION = '2026-10-22b · move to another report · linked documents · renumber with current codes';
function doGet() { return json_({ ok: true, app: 'AMS', version: SCRIPT_VERSION, time: new Date().toISOString() }); }

function doPost(e) {
  try {
    const req = JSON.parse(e.postData.contents);
    const email = verify_(req.idToken);
    const me = readAll_('users').filter(function (u) { return !u.deleted && String(u.data.email).toLowerCase() === email; })[0];
    if (!me || me.data.status === 'disabled') throw new Error('This Gmail (' + email + ') is not registered in AMS. Ask the Admin to add it.');
    if (me.data.status === 'invited') markActive_(me, email);
    const roles = me.data.roles || [];
    if (req.action === 'pull') return json_({ ok: true, records: pull_(req.since), serverTime: new Date().toISOString() });
    if (req.action === 'push') return json_({ ok: true, results: push_(req.changes || [], email, roles) });
    throw new Error('Unknown action');
  } catch (err) {
    return json_({ ok: false, error: String(err.message || err) });
  }
}

/* ---------- sign-in check ---------- */
function verify_(token) {
  if (!token) throw new Error('SIGNIN_NEEDED');
  const cache = CacheService.getScriptCache();
  const key = 't' + Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, token)).slice(0, 40);
  const hit = cache.get(key); if (hit) return hit;
  const res = UrlFetchApp.fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(token), { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) throw new Error('SIGNIN_NEEDED');
  const info = JSON.parse(res.getContentText());
  if (info.aud !== CLIENT_ID) throw new Error('This sign-in is not for this app.');
  if (String(info.email_verified) !== 'true') throw new Error('This Gmail is not verified by Google.');
  const email = String(info.email).toLowerCase();
  const left = Math.min(3000, Math.max(60, Number(info.exp) - Math.floor(Date.now() / 1000) - 60));
  cache.put(key, email, left);
  return email;
}

/* ---------- read and write ---------- */
function sheet_(table) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(table);
  if (!sh && TABLES.indexOf(table) >= 0) { sh = ss.insertSheet(table); sh.appendRow(HEAD); sh.setFrozenRows(1); }
  return sh;
}

function readAll_(table) {
  const sh = sheet_(table); const n = sh.getLastRow();
  if (n < 2) return [];
  return sh.getRange(2, 1, n - 1, Math.max(HEAD.length, sh.getLastColumn())).getValues().filter(function (r) { return r[0]; }).map(rec_);
}
// A Google Sheets cell holds at most 50,000 characters. A large record (e.g. a BRS with 76 bank accounts) is split into
// pieces of up to 45,000 characters in the cells to the right of "data"; the extra pieces start with "~" so that Sheets
// never turns a piece into a number or a date.
const PIECE = 45000;
function rowOf_(id, version, at, by, deleted, data) {
  const s = JSON.stringify(data), row = [id, version, at, by, deleted];
  for (let i = 0; i === 0 || i * PIECE < s.length; i++) row.push((i ? '~' : '') + s.slice(i * PIECE, (i + 1) * PIECE));
  return row;
}
function writeRow_(sh, rowNo, values) {
  const w = Math.max(values.length, sh.getLastColumn(), HEAD.length);
  if (sh.getMaxColumns() < w) sh.insertColumnsAfter(sh.getMaxColumns(), w - sh.getMaxColumns());
  const full = values.concat(new Array(w - values.length).fill(''));
  if (rowNo) sh.getRange(rowNo, 1, 1, w).setValues([full]); else sh.appendRow(full);
}
function rec_(r) {
  const text = r.slice(5).filter(function (x) { return x !== '' && x !== null && x !== undefined; }).map(function (x, i) { return i ? String(x).replace(/^~/, '') : String(x); }).join('');
  let data = null; try { data = JSON.parse(text); } catch (e) { data = null; }
  const at = r[2] instanceof Date ? r[2].toISOString() : String(r[2]);
  return { id: String(r[0]), version: Number(r[1]) || 0, updatedAt: at, updatedBy: String(r[3]), deleted: r[4] === true || r[4] === 'TRUE', data: data };
}
function findRow_(table, id) {
  const sh = sheet_(table); const n = sh.getLastRow();
  if (n < 2) return 0;
  const ids = sh.getRange(2, 1, n - 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) if (String(ids[i][0]) === id) return i + 2;
  return 0;
}

function pull_(since) {
  const out = {};
  TABLES.forEach(function (t) { out[t] = readAll_(t).filter(function (r) { return !since || r.updatedAt > since; }); });
  return out;
}

function push_(changes, email, roles) {
  const isAdmin = roles.indexOf('admin') >= 0;
  const has = function (list) { return roles.some(function (r) { return list.indexOf(r) >= 0; }); };
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const log = sheet_('log');
    return changes.map(function (c) {
      const res = { table: c.table, id: c.id };
      try {
        if (TABLES.indexOf(c.table) < 0) throw new Error('Unknown list: ' + c.table);
        if (ADMIN_TABLES[c.table] && !isAdmin) throw new Error('Only the Admin can change ' + c.table + '.');
        if (TABLE_ROLES[c.table] && !has(TABLE_ROLES[c.table])) throw new Error('Your role cannot change this (' + c.table + ').');
        const row = findRow_(c.table, c.id), sh = sheet_(c.table);
        const cur = row ? rec_(sh.getRange(row, 1, 1, Math.max(HEAD.length, sh.getLastColumn())).getValues()[0]) : null;
        if ((cur ? cur.version : 0) !== Number(c.baseVersion || 0)) { res.status = 'conflict'; res.record = cur; return res; }
        if (c.table === 'users' && !c.deleted) checkUser_(c, email);
        if (c.table === 'rms_items') checkItem_(c, cur, has(DECIDERS), isAdmin, has(CORRECTORS), has(PSAO));
        const next = rowOf_(c.id, (cur ? cur.version : 0) + 1, new Date().toISOString(), email, !!c.deleted, c.data);
        writeRow_(sh, row, next);
        log.appendRow([next[2], email, row ? (c.deleted ? 'deleted' : 'changed') : 'added', c.table, c.id]);
        res.status = 'ok'; res.record = rec_(next);
      } catch (err) { res.status = 'error'; res.error = String(err.message || err); }
      return res;
    });
  } finally { lock.releaseLock(); }
}

/* ---------- Records Management: receiving ---------- */
// Tracking numbers are given here, so two people receiving at the same time never get the same number.
// One running series per office per report per year: MAD-ABB-RCI-2026-0012 (the app sends the series key office|report);
// communications one series per office per year (MAD-ABB-2026-0013, from outside OUT-2026-0004).
// The PSAO books: one series per document type per year, PSAO-IN-IND-2026-0001 / PSAO-OUT-MEMO-2026-0001.
// Once given, a record's number never changes. Only auditors may accept or reject.
function checkItem_(c, cur, decider, isAdmin, corrector, psao) {
  if (c.deleted && !isAdmin) throw new Error('Only the Admin can delete a received item.');
  const d = c.data || {}, old = cur && cur.data ? cur.data : null;
  // The PSAO books (and team reports received at the PSAO) are recorded by the SA, the OSA Staff or the Admin.
  // ATLs and members may then update the routing (assign, acted on).
  if (!old && !psao && (d.kind === 'psao-in' || d.kind === 'psao-out' || d.atPsao)) throw new Error('Only the SA or the OSA Staff can record in the PSAO book.');
  // Corrections (date received, period, names, unticking a document) are for the Admin and the SA only.
  if (old && !corrector) {
    const same = function (k) { return JSON.stringify(d[k] === undefined ? null : d[k]) === JSON.stringify(old[k] === undefined ? null : old[k]); };
    const unticked = (old.checklist || []).some(function (x, k) { return x.ok && !((d.checklist || [])[k] || {}).ok; });
    // A batch dated earlier than the first submission (back-encoding) may move the date received earlier, never later.
    const recOk = same('receivedAt') || (d.receivedAt && old.receivedAt && String(d.receivedAt) < String(old.receivedAt));
    if (!same('corrections') || !recOk || !same('period') || !same('reportId') || !same('submittedBy') || !same('submittedDesignation') || !same('subject') || unticked)
      throw new Error('Only the Admin or the SA can correct a received record.');
  }
  const decided = function (x) { return x && x.decision ? JSON.stringify(x.decision) : ''; };
  if (!decider && (decided(d) !== decided(old) || ((d.status === 'accepted' || d.status === 'rejected') && (!old || old.status !== d.status))))
    throw new Error('Only an auditor (ATL, Team Member, SA or Admin) can accept or reject.');
  // Moved to another report (Admin or SA): a new number in the new report's series; the old one stays in the history.
  const moved = old && corrector && d.reportId && old.reportId && d.reportId !== old.reportId;
  if (old && old.trackingNo && !moved) { d.trackingNo = old.trackingNo; d.series = old.series; d.trackingYear = old.trackingYear; d.seriesKey = old.seriesKey; return; }
  if (!d.trackingNo) return;
  const year = Number(d.trackingYear) || new Date().getFullYear(), key = d.seriesKey || d.officeId;
  let n = 0;
  readAll_('rms_items').forEach(function (r) {
    const x = r.data || {};
    if (r.id !== c.id && x.trackingNo && (x.seriesKey || x.officeId) === key && Number(x.trackingYear) === year) n = Math.max(n, Number(x.series) || 0);
  });
  const code = key === 'outside' ? 'OUT' : d.officeCode;
  d.series = n + 1; d.trackingYear = year; d.seriesKey = key;
  d.trackingNo = [code, d.kind === 'comm' ? '' : d.reportCode, year, ('000' + d.series).slice(-4)].filter(function (v) { return v !== '' && v !== undefined && v !== null; }).join('-');
}

/* ---------- one-time: renumber the tracking numbers (21 Oct 2026) ---------- */
// Run from the Apps Script editor (choose renumberAll, then Run). Also after changing a report code or an office code. Every received report gets a number in its own
// series per office, per report and per year, in the order received: PGQ-OPAC-FS-2026-0001, -0002, …
// Communications from an office: one series per office per year (from outside: OUT-2026-0001 …).
// Outgoing records that mention an old number ("related") are updated. The list of old → new numbers is written to the log
// sheet and to the Execution log. Safe to run again: numbers already in order stay the same.
function renumberAll() {
  const lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    const sh = sheet_('rms_items'), n = sh.getLastRow();
    if (n < 2) { Logger.log('Nothing to renumber.'); return; }
    const w = Math.max(HEAD.length, sh.getLastColumn());
    const all = sh.getRange(2, 1, n - 1, w).getValues().map(function (r, i) { return { row: i + 2, rec: r[0] ? rec_(r) : null }; })
      .filter(function (x) { return x.rec && !x.rec.deleted && x.rec.data; });
    // The current report codes (Report Library) and office codes (Office Setup): a code changed later (e.g. FS → TB)
    // is given to the records already received.
    const repCode = {}, offCode = {};
    readAll_('rms_reports').forEach(function (r) { if (!r.deleted && r.data && r.data.code) repCode[r.id] = r.data.code; });
    readAll_('rms_offices').forEach(function (r) { if (!r.deleted && r.data && r.data.code) offCode[r.id] = r.data.code; });
    const groups = {};
    all.forEach(function (x) {
      const d = x.rec.data;
      if (!d.trackingNo || ['out', 'psao-in', 'psao-out'].indexOf(d.kind) >= 0) return;
      if (d.kind !== 'comm' && repCode[d.reportId] && repCode[d.reportId] !== d.reportCode) { d.reportCode = repCode[d.reportId]; x.codeChanged = true; }
      if (d.officeId && offCode[d.officeId] && offCode[d.officeId] !== d.officeCode) { d.officeCode = offCode[d.officeId]; x.codeChanged = true; }
      const key = d.kind === 'comm' ? (d.officeId || 'outside') : d.officeId + '|' + d.reportCode;
      const g = key + '#' + d.trackingYear;
      (groups[g] = groups[g] || { key: key, list: [] }).list.push(x);
    });
    const map = {}, dirty = [];
    Object.keys(groups).forEach(function (g) {
      const grp = groups[g];
      grp.list.sort(function (a, b) {
        return String(a.rec.data.receivedAt).localeCompare(String(b.rec.data.receivedAt)) || String(a.rec.data.encodedAt || '').localeCompare(String(b.rec.data.encodedAt || '')) || a.row - b.row;
      });
      grp.list.forEach(function (x, i) {
        const d = x.rec.data, s = i + 1;
        const code = d.kind === 'comm' && !d.officeId ? 'OUT' : d.officeCode;
        const no = [code, d.kind === 'comm' ? '' : d.reportCode, d.trackingYear, ('000' + s).slice(-4)].filter(function (v) { return v !== '' && v !== undefined && v !== null; }).join('-');
        if (no === d.trackingNo && d.series === s && d.seriesKey === grp.key && !x.codeChanged) return;
        if (no !== d.trackingNo) map[d.trackingNo] = no;
        d.trackingNo = no; d.series = s; d.seriesKey = grp.key;
        dirty.push(x);
      });
    });
    // Outgoing records that refer to an old number.
    all.forEach(function (x) { const d = x.rec.data; if (d.related && map[d.related] && dirty.indexOf(x) < 0) { d.related = map[d.related]; dirty.push(x); } });
    const now = new Date().toISOString();
    let log = sheet_('log'); if (!log) { log = SpreadsheetApp.getActiveSpreadsheet().insertSheet('log'); log.appendRow(['at', 'by', 'action', 'table', 'id']); }
    dirty.forEach(function (x) { writeRow_(sh, x.row, rowOf_(x.rec.id, x.rec.version + 1, now, 'renumber', false, x.rec.data)); });
    Object.keys(map).forEach(function (old) { log.appendRow([now, 'renumber', old + ' → ' + map[old], 'rms_items', '']); });
    Logger.log('Renumbered ' + Object.keys(map).length + ' tracking numbers (' + dirty.length + ' records updated).');
    Object.keys(map).forEach(function (old) { Logger.log(old + ' → ' + map[old]); });
  } finally { lock.releaseLock(); }
}

// Same Gmail twice is not allowed; the Admin cannot remove their own Admin access.
function checkUser_(c, email) {
  const mail = String(c.data.email || '').toLowerCase();
  const dup = readAll_('users').some(function (u) { return u.id !== c.id && !u.deleted && String(u.data.email).toLowerCase() === mail; });
  if (dup) throw new Error('That Gmail is already registered.');
  if (mail === email && ((c.data.roles || []).indexOf('admin') < 0 || c.data.status === 'disabled')) throw new Error('You cannot remove your own Admin access.');
}

// First sign-in: Invited becomes Active.
function markActive_(me, email) {
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const row = findRow_('users', me.id); if (!row) return;
    const data = Object.assign({}, me.data, { status: 'active' });
    writeRow_(sheet_('users'), row, rowOf_(me.id, me.version + 1, new Date().toISOString(), email, false, data));
  } finally { lock.releaseLock(); }
}

function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
