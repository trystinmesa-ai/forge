// IndexedDB storage. This device's copy is the one the app always reads and writes.
// Every change is also noted in the 'outbox' (in the same transaction), which
// cloud.js uploads when you're signed in. Signed out, nothing leaves the device.
//
// Stores (see docs/DATA.md for field-by-field details):
//   sessions      one workout: date, times, plan, check-in, exercise entries, notes
//   sets          one logged set: session, exercise, weight, reps, warm-up/working, done
//   exState       per-exercise progression state + next recommendation
//   overrides     your edits to library exercises (video link, notes, hidden, increment)
//   customEx      exercises you add yourself
//   substitutions "I swapped A for B" counts, used to remember preferences
//   checkins      soreness / tightness / pain / energy reports
//   meta          preferences and small app values (key/value)

let DB_NAME = 'forge';
const DB_VERSION = 1;
export const STORES = ['sessions', 'sets', 'exState', 'overrides', 'customEx', 'substitutions', 'checkins', 'meta'];
const KEYS = { meta: 'key', exState: 'exerciseId', overrides: 'exerciseId' };
export const keyOf = (store) => KEYS[store] || 'id';

/** Tests use a separate database so they never touch real data. */
export function useDatabase(name) { DB_NAME = name; close(); }

let dbp = null;
function open() {
  if (dbp) return dbp;
  dbp = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (ev) => {
      const db = req.result;
      // Version 1. Future versions add migrations below, keyed on ev.oldVersion,
      // and never drop a store that holds training history.
      if (ev.oldVersion < 1) {
        const sessions = db.createObjectStore('sessions', { keyPath: 'id' });
        sessions.createIndex('date', 'date');
        sessions.createIndex('status', 'status');
        const sets = db.createObjectStore('sets', { keyPath: 'id' });
        sets.createIndex('sessionId', 'sessionId');
        sets.createIndex('exerciseId', 'exerciseId');
        sets.createIndex('exerciseDate', ['exerciseId', 'date']);
        db.createObjectStore('exState', { keyPath: 'exerciseId' });
        db.createObjectStore('overrides', { keyPath: 'exerciseId' });
        db.createObjectStore('customEx', { keyPath: 'id' });
        db.createObjectStore('substitutions', { keyPath: 'id' });
        db.createObjectStore('checkins', { keyPath: 'id' }).createIndex('at', 'at');
        db.createObjectStore('meta', { keyPath: 'key' });
        db.createObjectStore('outbox', { keyPath: 'k' }); // "store|id" -> pending upload
      }
    };
    req.onsuccess = () => {
      const db = req.result;
      db.onversionchange = () => { db.close(); dbp = null; };
      resolve(db);
    };
    req.onerror = () => { dbp = null; reject(req.error); };
    req.onblocked = () => { dbp = null; reject(new Error('Storage is busy. Close other copies of the app and try again.')); };
  });
  return dbp;
}

export async function close() {
  const p = dbp; dbp = null;
  if (p) { try { (await p).close(); } catch {} }
}

export const reqP = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });

const listeners = new Set();
/** Called after any local change commits (not for changes pulled from the cloud). */
export const onChange = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };

let seqN = 0;
const nextSeq = () => Date.now() * 1000 + (seqN++ % 1000);

function tracked(tx, name) {
  const s = tx.objectStore(name);
  const out = tx.objectStore('outbox');
  const mark = (id) => out.put({ k: `${name}|${id}`, store: name, id, seq: nextSeq() });
  return {
    get: (k) => s.get(k),
    getAll: (q) => s.getAll(q),
    getAllKeys: () => s.getAllKeys(),
    count: () => s.count(),
    index: (n) => s.index(n),
    put(obj) { mark(obj[s.keyPath]); return s.put(obj); },
    delete(id) { mark(id); return s.delete(id); },
  };
}

/** Run fn(stores) in one atomic transaction; resolves after the data is committed. */
export async function run(names, mode, fn, { track = true } = {}) {
  const db = await open();
  const tracking = track && mode === 'readwrite';
  return new Promise((resolve, reject) => {
    const tx = db.transaction(tracking ? [...names, 'outbox'] : names, mode, { durability: 'strict' });
    const stores = Object.fromEntries(names.map((n) => [n, tracking ? tracked(tx, n) : tx.objectStore(n)]));
    let result;
    Promise.resolve()
      .then(() => fn(stores, tx))
      .then((r) => { result = r; })
      .catch((e) => { try { tx.abort(); } catch {} reject(e); });
    tx.oncomplete = () => {
      resolve(result);
      if (tracking) for (const l of listeners) { try { l(names); } catch (e) { console.warn(e); } }
    };
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('Save was cancelled'));
  });
}

// ---------- Simple access ----------
export const get = (store, id) => run([store], 'readonly', (s) => reqP(s[store].get(id)));
export const all = (store) => run([store], 'readonly', (s) => reqP(s[store].getAll()));
export const byIndex = (store, index, query) => run([store], 'readonly', (s) => reqP(s[store].index(index).getAll(query)));
export const count = (store) => run([store], 'readonly', (s) => reqP(s[store].count()));

const stamp = (o) => ({ ...o, updatedAt: Date.now() });
export const put = (store, obj) => run([store], 'readwrite', (s) => reqP(s[store].put(stamp(obj))));
export const del = (store, id) => run([store], 'readwrite', (s) => reqP(s[store].delete(id)));

/** Several puts/deletes in one atomic step: [{store, put}|{store, del}] */
export const batch = (ops) => {
  const names = [...new Set(ops.map((o) => o.store))];
  return run(names, 'readwrite', async (s) => {
    for (const o of ops) {
      if (o.put) await reqP(s[o.store].put(stamp(o.put)));
      else await reqP(s[o.store].delete(o.del));
    }
  });
};

export async function loadAll() {
  const out = {};
  await run(STORES, 'readonly', async (s) => { for (const n of STORES) out[n] = await reqP(s[n].getAll()); });
  return out;
}

/** Delete one workout and all of its sets. */
export const deleteSession = (id) =>
  run(['sessions', 'sets'], 'readwrite', async (s) => {
    const sets = await reqP(s.sets.index('sessionId').getAll(id));
    for (const x of sets) await reqP(s.sets.delete(x.id));
    await reqP(s.sessions.delete(id));
  });

/** Replace everything with a backup's contents. Deletes sync to the account too. */
export const replaceAll = (data) =>
  run(STORES, 'readwrite', async (s) => {
    for (const n of STORES) for (const k of await reqP(s[n].getAllKeys())) await reqP(s[n].delete(k));
    for (const n of STORES) for (const o of data[n] || []) await reqP(s[n].put(o));
  });

/** Add a backup's records; for a record that exists in both, the newer one wins. */
export const mergeAll = (data) =>
  run(STORES, 'readwrite', async (s) => {
    let added = 0, updated = 0;
    for (const n of STORES) {
      for (const o of data[n] || []) {
        const cur = await reqP(s[n].get(o[keyOf(n)]));
        if (!cur) { await reqP(s[n].put(o)); added++; }
        else if ((o.updatedAt || 0) > (cur.updatedAt || 0)) { await reqP(s[n].put(o)); updated++; }
      }
    }
    return { added, updated };
  });

// ---------- Sync support (used by cloud.js) ----------
function stable(v) {
  if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`;
  if (v && typeof v === 'object') return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${stable(v[k])}`).join(',')}}`;
  return JSON.stringify(v);
}

export const pendingCount = () => run(['outbox'], 'readonly', (s) => reqP(s.outbox.count()));

export const readPending = () =>
  run([...STORES, 'outbox'], 'readonly', async (s) => {
    const list = await reqP(s.outbox.getAll());
    for (const e of list) e.data = (await reqP(s[e.store].get(e.id))) ?? null;
    return list;
  });

export const markPushed = (entries) =>
  run(['outbox'], 'readwrite', async (s) => {
    for (const e of entries) {
      const cur = await reqP(s.outbox.get(e.k));
      if (cur && cur.seq === e.seq) await reqP(s.outbox.delete(e.k));
    }
  }, { track: false });

export const enqueueAll = () =>
  run([...STORES, 'outbox'], 'readwrite', async (s) => {
    for (const n of STORES) {
      for (const id of await reqP(s[n].getAllKeys())) await reqP(s.outbox.put({ k: `${n}|${id}`, store: n, id, seq: nextSeq() }));
    }
  }, { track: false });

/** Apply cloud records. A record with an unsent local change is skipped (local wins, uploads next). */
export const applyRemote = (rows) =>
  run([...STORES, 'outbox'], 'readwrite', async (s) => {
    let changed = 0;
    for (const r of rows) {
      if (!STORES.includes(r.store)) continue;
      if (await reqP(s.outbox.get(`${r.store}|${r.id}`))) continue;
      const cur = await reqP(s[r.store].get(r.id));
      if (r.deleted) {
        if (cur !== undefined) { await reqP(s[r.store].delete(r.id)); changed++; }
      } else if (cur === undefined || stable(cur) !== stable(r.data)) {
        await reqP(s[r.store].put(r.data)); changed++;
      }
    }
    return changed;
  }, { track: false });

export const replaceLocal = (rows) =>
  run([...STORES, 'outbox'], 'readwrite', async (s) => {
    for (const n of [...STORES, 'outbox']) await reqP(s[n].clear());
    for (const r of rows) if (STORES.includes(r.store) && !r.deleted) await reqP(s[r.store].put(r.data));
  }, { track: false });

export const wipeLocal = () =>
  run([...STORES, 'outbox'], 'readwrite', async (s) => {
    for (const n of [...STORES, 'outbox']) await reqP(s[n].clear());
  }, { track: false });
