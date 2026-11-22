// Workout data operations. Every change is written to IndexedDB immediately,
// so closing the app mid-workout never loses a logged set.
//
// A workout in progress is a session with status 'active'. Its planned sets are
// stored as set records with completed: false. Ticking a set marks it completed.
// Finishing keeps only completed sets: planned-but-not-done sets are not performance.
import * as DB from './db.js';
import * as L from './data/lookup.js';
import { uid, localDate } from './util.js';
import { nextTarget } from './engine/progression.js';

const sortSets = (a, b) => (a.kind === b.kind ? a.idx - b.idx : a.kind === 'warmup' ? -1 : 1);

// ───────── Reading ─────────
export async function activeSession() {
  const list = await DB.byIndex('sessions', 'status', 'active');
  return list.sort((a, b) => b.startedAt - a.startedAt)[0] || null;
}

export async function setsByEntry(sessionId) {
  const sets = await DB.byIndex('sets', 'sessionId', sessionId);
  const m = new Map();
  for (const s of sets) { if (!m.has(s.entryId)) m.set(s.entryId, []); m.get(s.entryId).push(s); }
  for (const list of m.values()) list.sort(sortSets);
  return m;
}

/**
 * The most recent *completed* workout containing this exercise (excluding `excludeSessionId`),
 * with its completed working sets. Returns null for an exercise you've never done. Nothing is invented.
 */
export async function previousPerformance(exerciseId, excludeSessionId = null) {
  const sets = (await DB.byIndex('sets', 'exerciseId', exerciseId)).filter((s) => s.completed && s.sessionId !== excludeSessionId);
  if (!sets.length) return null;
  const sessionIds = [...new Set(sets.map((s) => s.sessionId))];
  const sessions = (await Promise.all(sessionIds.map((id) => DB.get('sessions', id))))
    .filter((s) => s && s.status === 'completed')
    .sort((a, b) => b.date.localeCompare(a.date) || b.startedAt - a.startedAt);
  if (!sessions.length) return null;
  const s = sessions[0];
  const mine = sets.filter((x) => x.sessionId === s.id).sort(sortSets);
  return { sessionId: s.id, date: s.date, sets: mine.filter((x) => x.kind === 'working'), warmups: mine.filter((x) => x.kind === 'warmup') };
}

/** Every completed workout that included this exercise, newest first: [{date, sessionId, sets}] */
export async function exerciseHistory(exerciseId) {
  const sets = (await DB.byIndex('sets', 'exerciseId', exerciseId)).filter((s) => s.completed && s.kind === 'working');
  const bySession = new Map();
  for (const s of sets) { if (!bySession.has(s.sessionId)) bySession.set(s.sessionId, []); bySession.get(s.sessionId).push(s); }
  const out = [];
  for (const [id, list] of bySession) {
    const sess = await DB.get('sessions', id);
    if (!sess || sess.status !== 'completed') continue;
    out.push({ sessionId: id, date: sess.date, title: sess.title, sets: list.sort((a, b) => a.idx - b.idx) });
  }
  return out.sort((a, b) => b.date.localeCompare(a.date));
}

/** The best working set by weight (then reps); for timed work, longest. */
export function bestSet(sets) {
  return sets.reduce((best, s) => {
    if (!best) return s;
    if (s.seconds != null || best.seconds != null) return (s.seconds || 0) > (best.seconds || 0) ? s : best;
    if ((s.weight || 0) !== (best.weight || 0)) return (s.weight || 0) > (best.weight || 0) ? s : best;
    return (s.reps || 0) > (best.reps || 0) ? s : best;
  }, null);
}

// Weight steps live with the progression rules; re-exported here for the screens.
export { stepWeight } from './engine/progression.js';

// ───────── Planning an entry ─────────
function targetFor(ex, prefs) {
  const rx = L.prescription(ex, prefs.progressionStyle);
  return {
    sets: rx.sets, reps: rx.reps, setReps: rx.setReps || null, seconds: rx.seconds,
    rir: rx.rir, restSec: rx.restSec, style: rx.style,
  };
}

/**
 * Planned sets for an entry. Weights come from the progression rules applied to what you
 * actually logged: last time's weights when holding, one step up or down when the rules say so,
 * blank for an exercise you've never done.
 */
function plannedSets(session, entry, ex, prev, progress) {
  const n = entry.target.sets;
  const out = [];
  const change = progress && (progress.decision === 'increase' || progress.decision === 'decrease');
  for (let i = 0; i < n; i++) {
    const p = prev?.sets[i] || prev?.sets[prev.sets.length - 1] || null;
    out.push({
      id: uid('set-'), sessionId: session.id, entryId: entry.id, entryOrder: entry.order, exerciseId: ex.id,
      date: session.date, idx: i, kind: 'working',
      weight: change ? progress.weight : (p?.weight ?? null),
      reps: null, seconds: null, completed: false, completedAt: null,
    });
  }
  return out;
}

/** Two lighter ramp-up sets before the first main lift (about 50% and 75%). Excluded from progress. */
function rampSets(session, entry, ex, weight) {
  if (!weight || ex.load === 'kettlebell' || ex.load === 'bodyweight') return [];
  return [0.5, 0.75].map((f, i) => ({
    id: uid('set-'), sessionId: session.id, entryId: entry.id, entryOrder: entry.order, exerciseId: ex.id,
    date: session.date, idx: i, kind: 'warmup', weight: Math.max(0, Math.floor((weight * f) / 5) * 5) || null,
    reps: null, seconds: null, completed: false, completedAt: null,
  }));
}

/** Completed working sets per workout for this exercise, newest first (for the progression rules). */
async function recentHistory(exerciseId, excludeSessionId, n = 3) {
  const hist = await exerciseHistory(exerciseId);
  return hist.filter((x) => x.sessionId !== excludeSessionId).slice(0, n);
}

// ───────── Writing ─────────
/**
 * Start a workout. exerciseIds: initial exercises (can be empty).
 * Refuses if a workout is already in progress, so nothing is accidentally abandoned.
 */
export async function startSession({ title = 'Workout', exerciseIds = [], items = null, checkin = null, plan = null, prefs, now = Date.now() }) {
  if (await activeSession()) throw new Error('A workout is already in progress. Resume or finish it first.');
  const session = {
    id: uid('ses-'), date: localDate(new Date(now)), startedAt: now, endedAt: null, durationMin: null,
    status: 'active', title, plan: plan || { generatedBy: 'manual' }, checkin, entries: [], notes: '',
  };
  await DB.put('sessions', session);
  const list = items || exerciseIds.map((exerciseId) => ({ exerciseId }));
  for (let i = 0; i < list.length; i++) {
    await addEntry(session.id, list[i].exerciseId, prefs, { sets: list[i].sets, slot: list[i].slot, ramp: !!(plan?.ramp && i === 0), today: session.date });
  }
  return DB.get('sessions', session.id);
}

export async function addEntry(sessionId, exerciseId, prefs, { replacedFrom = null, atOrder = null, sets = null, slot = null, ramp = false, today = null } = {}) {
  const ex = L.exercise(exerciseId);
  if (!ex) throw new Error('Unknown exercise');
  const session = await DB.get('sessions', sessionId);
  const prev = await previousPerformance(exerciseId, sessionId);
  const target = targetFor(ex, prefs);
  if (sets) target.sets = sets;
  const progress = nextTarget(ex, L.prescription(ex, prefs.progressionStyle), await recentHistory(exerciseId, sessionId), prefs, today || session.date);
  const order = atOrder ?? (session.entries.length ? Math.max(...session.entries.map((e) => e.order)) + 1 : 0);
  const entry = { id: uid('ent-'), exerciseId, order, target, skipped: false, replacedFrom, slot, progress, notes: '' };
  const planned = plannedSets(session, entry, ex, prev, progress);
  const warm = ramp ? rampSets(session, entry, ex, planned[0]?.weight) : [];
  const entries = [...session.entries, entry].sort((a, b) => a.order - b.order);
  await DB.batch([{ store: 'sessions', put: { ...session, entries } }, ...[...warm, ...planned].map((s) => ({ store: 'sets', put: s }))]);
  return entry;
}

/** Swap an exercise for another in the same spot. Completed sets of the old one are kept. */
export async function replaceEntry(sessionId, entryId, newExerciseId, prefs) {
  const session = await DB.get('sessions', sessionId);
  const old = session.entries.find((e) => e.id === entryId);
  const sets = (await DB.byIndex('sets', 'sessionId', sessionId)).filter((s) => s.entryId === entryId);
  const anyDone = sets.some((s) => s.completed);
  const ops = sets.filter((s) => !s.completed).map((s) => ({ store: 'sets', del: s.id }));
  // Sets already done stay in the record under the old exercise; the new one goes right after it.
  const entries = anyDone ? session.entries : session.entries.filter((e) => e.id !== entryId);
  await DB.batch([{ store: 'sessions', put: { ...session, entries } }, ...ops]);
  await recordSubstitution(old.exerciseId, newExerciseId);
  return addEntry(sessionId, newExerciseId, prefs, { replacedFrom: old.exerciseId, atOrder: anyDone ? old.order + 0.5 : old.order, sets: old.target?.sets, slot: old.slot });
}

export async function recordSubstitution(from, to) {
  const id = `${from}>${to}`;
  const cur = await DB.get('substitutions', id);
  await DB.put('substitutions', { id, from, to, count: (cur?.count || 0) + 1, lastAt: Date.now() });
}

export async function removeEntry(sessionId, entryId) {
  const session = await DB.get('sessions', sessionId);
  const sets = (await DB.byIndex('sets', 'sessionId', sessionId)).filter((s) => s.entryId === entryId);
  await DB.batch([
    { store: 'sessions', put: { ...session, entries: session.entries.filter((e) => e.id !== entryId) } },
    ...sets.map((s) => ({ store: 'sets', del: s.id })),
  ]);
}

export async function setSkipped(sessionId, entryId, skipped) {
  const session = await DB.get('sessions', sessionId);
  await DB.put('sessions', { ...session, entries: session.entries.map((e) => (e.id === entryId ? { ...e, skipped } : e)) });
}

export async function updateSession(sessionId, patch) {
  const session = await DB.get('sessions', sessionId);
  await DB.put('sessions', { ...session, ...patch });
}

/** Save a set's values. completed: true marks it done (and stamps the time). */
export async function updateSet(setId, patch) {
  const cur = await DB.get('sets', setId);
  if (!cur) return null;
  const next = { ...cur, ...patch };
  if (patch.completed === true && !cur.completed) next.completedAt = Date.now();
  if (patch.completed === false) next.completedAt = null;
  await DB.put('sets', next);
  return next;
}

export async function addSet(sessionId, entryId, { kind = 'working' } = {}) {
  const session = await DB.get('sessions', sessionId);
  const entry = session.entries.find((e) => e.id === entryId);
  const sets = (await DB.byIndex('sets', 'sessionId', sessionId)).filter((s) => s.entryId === entryId);
  const same = sets.filter((s) => s.kind === kind).sort((a, b) => a.idx - b.idx);
  const working = sets.filter((s) => s.kind === 'working').sort((a, b) => a.idx - b.idx);
  const last = same[same.length - 1];
  const ex = L.exercise(entry.exerciseId);
  let weight = last?.weight ?? null;
  if (kind === 'warmup' && working[0]?.weight) {
    // Warm-ups: about half the working weight, rounded down to a loadable step.
    weight = roundDownToStep(ex, working[0].weight * (same.length ? 0.7 : 0.5));
  }
  const set = {
    id: uid('set-'), sessionId, entryId, entryOrder: entry.order, exerciseId: entry.exerciseId, date: session.date,
    idx: last ? last.idx + 1 : 0, kind, weight, reps: null, seconds: null, completed: false, completedAt: null,
  };
  await DB.put('sets', set);
  return set;
}

// Kettlebell and bodyweight warm-ups are left blank: you pick a lighter bell yourself.
function roundDownToStep(ex, w) {
  if (ex.load === 'bodyweight' || ex.load === 'kettlebell' || !w) return null;
  return Math.max(0, Math.floor(w / 5) * 5);
}

export const removeSet = (setId) => DB.del('sets', setId);

/** What finishing now would save. */
export async function finishPreview(sessionId) {
  const sets = await DB.byIndex('sets', 'sessionId', sessionId);
  const done = sets.filter((s) => s.completed);
  return { completed: done.filter((s) => s.kind === 'working').length, warmups: done.filter((s) => s.kind === 'warmup').length, open: sets.filter((s) => !s.completed).length };
}

/**
 * Finish: keep completed sets, drop planned ones, record the duration.
 * If the app was left open long after the last set, the end time is the last set (+2 min), not "now".
 */
export async function finishSession(sessionId, { notes, now = Date.now() } = {}) {
  const session = await DB.get('sessions', sessionId);
  const sets = await DB.byIndex('sets', 'sessionId', sessionId);
  const done = sets.filter((s) => s.completed);
  if (!done.length) throw new Error('No completed sets yet. Log at least one set, or discard the workout.');
  const lastAt = Math.max(...done.map((s) => s.completedAt || session.startedAt));
  const endedAt = now - lastAt > 30 * 60 * 1000 ? lastAt + 2 * 60 * 1000 : now;
  const usedEntries = new Set(done.map((s) => s.entryId));
  const entries = session.entries.map((e) => ({ ...e, skipped: e.skipped || !usedEntries.has(e.id) }));
  await DB.batch([
    ...sets.filter((s) => !s.completed).map((s) => ({ store: 'sets', del: s.id })),
    { store: 'sessions', put: {
      ...session, entries, status: 'completed', endedAt,
      durationMin: Math.max(1, Math.round((endedAt - session.startedAt) / 60000)),
      notes: notes ?? session.notes,
    } },
  ]);
  return DB.get('sessions', sessionId);
}

export const discardSession = (sessionId) => DB.deleteSession(sessionId);

/** Copy a past workout's exercises into a new one (weights come from each exercise's latest performance). */
export async function repeatSession(pastId, prefs) {
  const past = await DB.get('sessions', pastId);
  const ids = past.entries.filter((e) => !e.skipped && L.exercise(e.exerciseId)).sort((a, b) => a.order - b.order).map((e) => e.exerciseId);
  return startSession({ title: past.title || 'Workout', exerciseIds: ids, prefs, plan: { generatedBy: 'repeat', from: pastId } });
}
