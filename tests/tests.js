// Browser test runner. Uses a separate database ('forge-test'), never your real data.
import * as DB from '../js/db.js';
import * as Backup from '../js/backup.js';
import * as Prefs from '../js/prefs.js';
import * as Hist from '../js/history-read.js';
import { daysBetween, addDays, localDate } from '../js/util.js';
import registerLibrary from './library.tests.js';
import registerWorkout from './workout.tests.js';
import registerEngine from './engine.tests.js';
import registerStats from './stats.tests.js';

const out = document.getElementById('out');
const results = [];
let group = '';
const tests = [];
const describe = (name, fn) => tests.push({ group: name }) && fn();
const it = (name, fn) => tests.push({ name, fn });
const eq = (a, b, msg = '') => { const A = JSON.stringify(a), B = JSON.stringify(b); if (A !== B) throw new Error(`${msg} expected ${B}, got ${A}`); };
const ok = (v, msg = 'expected truthy') => { if (!v) throw new Error(msg); };

async function fresh() {
  await DB.close();
  await new Promise((res, rej) => { const r = indexedDB.deleteDatabase('forge-test'); r.onsuccess = res; r.onerror = () => rej(r.error); r.onblocked = res; });
  DB.useDatabase('forge-test');
}

const session = (id, date, extra = {}) => ({ id, date, status: 'completed', startedAt: Date.parse(date + 'T18:00'), title: 'Upper', entries: [{ id: `${id}-e1`, exerciseId: 'db-bench', order: 0 }], ...extra });
const set = (id, sessionId, idx, weight, reps, extra = {}) => ({ id, sessionId, entryId: `${sessionId}-e1`, entryOrder: 0, exerciseId: 'db-bench', date: '2026-11-20', idx, kind: 'working', weight, reps, completed: true, ...extra });

describe('Storage', () => {
  it('opens with every store', async () => {
    await fresh();
    const all = await DB.loadAll();
    eq(Object.keys(all).sort(), [...DB.STORES].sort());
  });
  it('saves a workout and its sets, and finds them by index', async () => {
    await fresh();
    await DB.put('sessions', session('s1', '2026-11-20'));
    await DB.batch([{ store: 'sets', put: set('a', 's1', 0, 45, 15) }, { store: 'sets', put: set('b', 's1', 1, 45, 12) }]);
    eq((await Hist.setsForSession('s1')).map((x) => x.reps), [15, 12]);
    eq((await DB.byIndex('sets', 'exerciseId', 'db-bench')).length, 2);
    ok((await DB.get('sessions', 's1')).updatedAt > 0, 'updatedAt stamped');
  });
  it('keeps a logged set after the app closes mid-workout', async () => {
    await fresh();
    await DB.put('sessions', session('live', localDate(), { status: 'active' }));
    await DB.put('sets', set('x', 'live', 0, 50, 10));
    await DB.close();                       // simulate the app being closed
    DB.useDatabase('forge-test');           // reopen
    eq((await Hist.activeSession())?.id, 'live');
    eq((await Hist.setsForSession('live'))[0].weight, 50);
  });
  it('deleting a workout removes its sets', async () => {
    await fresh();
    await DB.put('sessions', session('s1', '2026-11-20'));
    await DB.put('sets', set('a', 's1', 0, 45, 15));
    await DB.deleteSession('s1');
    eq(await DB.count('sets'), 0);
    eq(await DB.count('sessions'), 0);
  });
  it('a failed transaction saves nothing', async () => {
    await fresh();
    let threw = false;
    try { await DB.run(['sessions'], 'readwrite', async (s) => { await DB.reqP(s.sessions.put(session('s1', '2026-11-20'))); throw new Error('boom'); }); } catch { threw = true; }
    ok(threw, 'error surfaced');
    eq(await DB.count('sessions'), 0);
  });
});

describe('Sync outbox', () => {
  it('every local change is queued for upload, and cleared once pushed', async () => {
    await fresh();
    await DB.put('sessions', session('s1', '2026-11-20'));
    await DB.put('sets', set('a', 's1', 0, 45, 15));
    const pending = await DB.readPending();
    eq(pending.map((p) => p.k).sort(), ['sessions|s1', 'sets|a']);
    await DB.markPushed(pending);
    eq(await DB.pendingCount(), 0);
  });
  it('a cloud record never overwrites an unsent local change', async () => {
    await fresh();
    await DB.put('sets', set('a', 's1', 0, 50, 10));
    const n = await DB.applyRemote([{ store: 'sets', id: 'a', data: set('a', 's1', 0, 99, 1) }]);
    eq(n, 0);
    eq((await DB.get('sets', 'a')).weight, 50);
  });
  it('cloud records apply when nothing local is pending', async () => {
    await fresh();
    const n = await DB.applyRemote([{ store: 'sessions', id: 's9', data: session('s9', '2026-11-01') }, { store: 'bogus', id: 'z', data: {} }]);
    eq(n, 1);
    eq(await DB.pendingCount(), 0, 'pulled data is not re-uploaded');
  });
});

describe('Backup & restore', () => {
  it('export then replace-restore gives back identical data', async () => {
    await fresh();
    await DB.put('sessions', session('s1', '2026-11-20'));
    await DB.put('sets', set('a', 's1', 0, 45, 15));
    await DB.put('exState', { exerciseId: 'db-bench', nextWeight: 50 });
    await Prefs.load(); await Prefs.update({ targetSessionsPerWeek: 3 });
    const b = JSON.parse(JSON.stringify(await Backup.build()));
    eq(b.counts.sessions, 1);
    await DB.replaceAll({});
    eq(await DB.count('sets'), 0);
    const v = Backup.validate(b);
    ok(v.ok, v.error);
    await Backup.restore(v.backup, 'replace');
    eq(await DB.loadAll(), b.data);
    eq((await Prefs.load()).targetSessionsPerWeek, 3);
  });
  it('rejects files that are not backups, damaged, or from a newer app', () => {
    ok(!Backup.validate({ hello: 1 }).ok);
    ok(!Backup.validate({ format: 'forge-backup', version: 99, data: {} }).ok);
    ok(!Backup.validate({ format: 'forge-backup', version: 1, data: { sessions: 'x' } }).ok);
    ok(!Backup.validate({ format: 'forge-backup', version: 1, data: { sessions: [{ noId: 1 }] } }).ok);
    const orphan = Backup.validate({ format: 'forge-backup', version: 1, data: { sessions: [], sets: [set('a', 'missing', 0, 1, 1)] } });
    ok(!orphan.ok && /don’t belong/.test(orphan.error), orphan.error);
  });
  it('accepts an older backup that lacks newer sections', () => {
    const v = Backup.validate({ format: 'forge-backup', version: 1, data: { sessions: [session('s1', '2026-01-01')] } });
    ok(v.ok, v.error);
    eq(v.backup.data.checkins, []);
  });
  it('merge adds missing records and keeps the newer copy of each', async () => {
    await fresh();
    await DB.run(['sessions'], 'readwrite', (s) => {
      s.sessions.put({ ...session('keep', '2026-11-01'), notes: 'local newer', updatedAt: 200 });
      s.sessions.put({ ...session('old', '2026-11-02'), notes: 'local older', updatedAt: 100 });
    });
    const r = await DB.mergeAll({ sessions: [
      { ...session('keep', '2026-11-01'), notes: 'backup older', updatedAt: 150 },
      { ...session('old', '2026-11-02'), notes: 'backup newer', updatedAt: 300 },
      { ...session('new', '2026-11-03'), updatedAt: 1 },
    ] });
    eq(r, { added: 1, updated: 1 });
    eq((await DB.get('sessions', 'keep')).notes, 'local newer');
    eq((await DB.get('sessions', 'old')).notes, 'backup newer');
  });
});

describe('Preferences', () => {
  it('starts from sensible defaults and remembers changes', async () => {
    await fresh();
    const p = await Prefs.load();
    eq([p.targetSessionsPerWeek, p.progressionStyle, p.units, p.increments.dumbbell], [4, 'adaptive', 'lb', 5]);
    await Prefs.update({ progressionStyle: 'classic' });
    eq((await Prefs.load()).progressionStyle, 'classic');
  });
  it('two quick changes in a row both stick', async () => {
    await fresh(); await Prefs.load();
    await Promise.all([Prefs.update({ theme: 'light' }), Prefs.update({ targetSessionsPerWeek: 5 })]);
    const p = await Prefs.load();
    eq([p.theme, p.targetSessionsPerWeek], ['light', 5]);
  });
});

describe('Dates & history summary', () => {
  it('counts calendar days correctly across daylight-saving changes', () => {
    eq(daysBetween('2026-03-07', '2026-03-09'), 2);
    eq(daysBetween('2026-10-31', '2026-11-02'), 2);
    eq(addDays('2026-02-27', 2), '2026-03-01');
  });
  it('summarizes recent training without depending on weekdays', () => {
    const list = [session('c', '2026-11-20'), session('b', '2026-11-18'), session('a', '2026-11-01')];
    const s = Hist.summary(list, '2026-11-21');
    eq([s.total, s.daysSinceLast, s.in7], [3, 1, 2]);
    const days = Hist.lastDays(list, 7, '2026-11-21');
    eq(days.map((d) => d.sessions.length), [0, 0, 0, 1, 0, 1, 0]);
  });
});

// Library tests live in their own file.
registerLibrary({ describe, it, eq, ok });
registerWorkout({ describe, it, eq, ok, fresh });
registerEngine({ describe, it, eq, ok, fresh });
registerStats({ describe, it, eq, ok, fresh });

// ---------- runner ----------
(async () => {
  let pass = 0, fail = 0;
  for (const t of tests) {
    if (t.group) { group = t.group; out.append(Object.assign(document.createElement('div'), { className: 'grp', textContent: group })); continue; }
    const line = document.createElement('div');
    try { await t.fn(); pass++; line.className = 'pass'; line.textContent = `✓ ${t.name}`; results.push({ group, name: t.name, ok: true }); }
    catch (e) {
      fail++; line.className = 'fail'; line.textContent = `✗ ${t.name}`;
      const pre = document.createElement('pre'); pre.textContent = e.stack || e.message; line.append(pre);
      results.push({ group, name: t.name, ok: false, error: e.message });
    }
    out.append(line);
  }
  await DB.close();
  document.getElementById('sum').textContent = `— ${pass} passed, ${fail} failed`;
  document.getElementById('sum').className = fail ? 'fail' : 'pass';
  window.__results = { pass, fail, results };
})();
