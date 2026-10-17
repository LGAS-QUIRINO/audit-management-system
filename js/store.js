// Records kept on this device (users, teams, lgus). Every save also waits in the outbox,
// ready to be sent to the AMS database once it is connected.
import { db } from './db.js';
import { DEMO } from './config.js';
import { seedData, DEMO_ADMIN } from './seed.js';

const listeners = new Set();
export const onChange = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
const emit = (table) => listeners.forEach((fn) => fn(table));

export const newId = (prefix) => prefix + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

export const store = {
  // First run on this device: load the teams and the LGU Master List (and the demo Admin in Demo Mode).
  async ready() {
    if (await db.get('meta', 'seeded')) return;
    const { teams, lgus } = seedData();
    for (const t of teams) await db.put('records', { table: 'teams', id: t.id, data: t, at: Date.now() });
    for (const l of lgus) await db.put('records', { table: 'lgus', id: l.id, data: l, at: Date.now() });
    if (DEMO) await db.put('records', { table: 'users', id: DEMO_ADMIN.id, data: DEMO_ADMIN, at: Date.now() });
    await db.put('meta', true, 'seeded');
  },
  async list(table) { return db.all('records', table); },
  async get(table, id) { return db.get('records', [table, id]); },
  async save(table, id, data, by = '') {
    const rec = { table, id, data, at: Date.now(), by };
    await db.put('records', rec);
    await db.put('outbox', rec);
    emit(table);
    return rec;
  },
  async del(table, id) {
    await db.del('records', [table, id]);
    await db.put('outbox', { table, id, data: null, deleted: true, at: Date.now() });
    emit(table);
  }
};

// Everything the screens need at once, with quick look-ups by ID.
export async function loadRefs(email) {
  const [users, teams, lgus] = await Promise.all([store.list('users'), store.list('teams'), store.list('lgus')]);
  const byId = (arr) => Object.fromEntries(arr.map((r) => [r.id, r]));
  const me = users.find((u) => String(u.data.email).toLowerCase() === String(email || '').toLowerCase()) || null;
  return { users, teams, lgus, user: byId(users), team: byId(teams), lgu: byId(lgus), me,
    isAdmin: !!(me && me.data.status !== 'disabled' && (me.data.roles || []).includes('admin')) };
}
