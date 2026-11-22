// Read-only views over training history, shared by the screens (and later the engine).
import * as DB from './db.js';
import { localDate, addDays, daysBetween } from './util.js';

/** Completed workouts, newest first. Unfinished ones are separate (see activeSession). */
export async function completedSessions() {
  const list = await DB.byIndex('sessions', 'status', 'completed');
  return list.sort((a, b) => (b.date.localeCompare(a.date)) || (b.startedAt - a.startedAt));
}

export async function activeSession() {
  const list = await DB.byIndex('sessions', 'status', 'active');
  return list.sort((a, b) => b.startedAt - a.startedAt)[0] || null;
}

export const setsForSession = async (id) =>
  (await DB.byIndex('sets', 'sessionId', id)).sort((a, b) => (a.entryOrder - b.entryOrder) || (a.idx - b.idx));

/** Map of YYYY-MM-DD -> sessions on that day. */
export function byDate(sessions) {
  const m = new Map();
  for (const s of sessions) { if (!m.has(s.date)) m.set(s.date, []); m.get(s.date).push(s); }
  return m;
}

/** Last n days ending today, oldest first: [{date, sessions}] */
export function lastDays(sessions, n = 7, today = localDate()) {
  const m = byDate(sessions);
  return Array.from({ length: n }, (_, i) => { const d = addDays(today, i - n + 1); return { date: d, sessions: m.get(d) || [] }; });
}

export function summary(sessions, today = localDate()) {
  const last = sessions[0] || null;
  const in7 = sessions.filter((s) => daysBetween(s.date, today) < 7).length;
  const in28 = sessions.filter((s) => daysBetween(s.date, today) < 28).length;
  return { total: sessions.length, last, daysSinceLast: last ? daysBetween(last.date, today) : null, in7, avgPerWeek4: in28 / 4 };
}
