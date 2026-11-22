// JSON backup and restore. A backup holds every store (history, progression
// state, preferences, your exercise edits) in one plain JSON file you own.
import * as DB from './db.js';

export const FORMAT = 'forge-backup';
export const FORMAT_VERSION = 1;

export async function build() {
  const data = await DB.loadAll();
  return {
    format: FORMAT,
    version: FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    counts: Object.fromEntries(DB.STORES.map((n) => [n, data[n].length])),
    data,
  };
}

export const fileName = (d = new Date()) => {
  const p = (n) => String(n).padStart(2, '0');
  return `forge-backup-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}.json`;
};

/** Check a parsed backup file. Returns {ok, error?, backup?, summary?}. Never writes anything. */
export function validate(obj) {
  if (!obj || typeof obj !== 'object') return { ok: false, error: 'This file isn’t a backup from this app.' };
  if (obj.format !== FORMAT) return { ok: false, error: 'This file isn’t a backup from this app.' };
  if (typeof obj.version !== 'number' || obj.version > FORMAT_VERSION) {
    return { ok: false, error: 'This backup is from a newer version of the app. Update the app first.' };
  }
  if (!obj.data || typeof obj.data !== 'object') return { ok: false, error: 'The backup is missing its data.' };
  const clean = {};
  for (const n of DB.STORES) {
    const list = obj.data[n] ?? [];
    if (!Array.isArray(list)) return { ok: false, error: `The backup's “${n}” section is damaged.` };
    const key = DB.keyOf(n);
    for (const rec of list) {
      if (!rec || typeof rec !== 'object' || rec[key] == null) {
        return { ok: false, error: `The backup's “${n}” section has a damaged record.` };
      }
    }
    clean[n] = list;
  }
  // Every set must belong to a workout in the same file.
  const sessionIds = new Set(clean.sessions.map((s) => s.id));
  const orphans = clean.sets.filter((x) => !sessionIds.has(x.sessionId)).length;
  if (orphans) return { ok: false, error: `${orphans} logged set(s) in this backup don’t belong to any workout. The file may be damaged.` };
  return {
    ok: true,
    backup: { ...obj, data: clean },
    summary: { exportedAt: obj.exportedAt, workouts: clean.sessions.length, sets: clean.sets.length },
  };
}

export async function parseFile(file) {
  let obj;
  try { obj = JSON.parse(await file.text()); } catch { return { ok: false, error: 'This file isn’t valid JSON.' }; }
  return validate(obj);
}

/** mode: 'replace' (this device becomes exactly the backup) or 'merge' (add missing, newer wins). */
export async function restore(backup, mode) {
  if (mode === 'replace') { await DB.replaceAll(backup.data); return { replaced: true }; }
  return DB.mergeAll(backup.data);
}

/** Save the file: share sheet on iPhone (Save to Files), download elsewhere. */
export async function download(obj) {
  const text = JSON.stringify(obj, null, 1);
  const name = fileName();
  const blob = new Blob([text], { type: 'application/json' });
  try {
    const file = new File([blob], name, { type: 'application/json' });
    if (navigator.canShare?.({ files: [file] }) && /iPhone|iPad|iPod/.test(navigator.userAgent)) {
      await navigator.share({ files: [file], title: name });
      return 'shared';
    }
  } catch (e) {
    if (e?.name === 'AbortError') return 'cancelled';
  }
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return 'downloaded';
}
