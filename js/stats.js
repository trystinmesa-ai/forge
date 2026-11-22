// Progress numbers from what you actually logged: personal records, strength over time,
// workouts per week and month, weekly muscle volume, and 4-week trends.
// Pure functions. Only completed working sets count; warm-ups never do.
import * as L from './data/lookup.js';
import { setsPerMuscle, WEEKLY_SET_TARGET, WEEKLY_SET_CAP } from './engine/recovery.js';
import { addDays, daysBetween, parseDate, localDate } from './util.js';

export { WEEKLY_SET_TARGET, WEEKLY_SET_CAP };

/**
 * Estimated 1-rep max (Epley: weight × (1 + reps / 30)). An ESTIMATE, and only shown for
 * sets of 1–12 reps, where the formula is reasonable. Null otherwise.
 */
export function e1rm(weight, reps) {
  if (!weight || !reps || reps < 1 || reps > 12) return null;
  return reps === 1 ? weight : Math.round(weight * (1 + reps / 30));
}

const working = (sets) => sets.filter((s) => s.completed && s.kind === 'working');

/** What "better" means for an exercise: heavier, more reps (bodyweight), or longer (timed). */
export function metricFor(ex, sets = []) {
  if (ex?.measure === 'time') return 'time';
  const loaded = ex?.load !== 'bodyweight' || sets.some((s) => (s.weight || 0) > 0);
  return loaded ? 'weight' : 'reps';
}

/**
 * Per-workout bests for one exercise, oldest first.
 * sets: completed sets for this exercise. sessions: Map id -> session (completed only).
 */
export function timeline(exerciseId, sets, sessions) {
  const ex = L.exercise(exerciseId);
  const by = new Map();
  for (const s of working(sets)) {
    const sess = sessions.get(s.sessionId);
    if (!sess) continue;
    if (!by.has(s.sessionId)) by.set(s.sessionId, { date: sess.date, startedAt: sess.startedAt || 0, sets: [] });
    by.get(s.sessionId).sets.push(s);
  }
  const metric = metricFor(ex, sets);
  return [...by.values()].sort((a, b) => a.date.localeCompare(b.date) || a.startedAt - b.startedAt).map((d) => {
    const topW = Math.max(...d.sets.map((s) => s.weight || 0));
    const est = Math.max(0, ...d.sets.map((s) => e1rm(s.weight, s.reps) || 0)) || null;
    return {
      date: d.date,
      topWeight: topW,
      topReps: Math.max(...d.sets.filter((s) => (s.weight || 0) === topW).map((s) => s.reps || 0)),
      maxReps: Math.max(...d.sets.map((s) => s.reps || 0)),
      maxSeconds: Math.max(...d.sets.map((s) => s.seconds || 0)),
      e1rm: est,
      volume: d.sets.reduce((a, s) => a + (s.weight || 0) * (s.reps || 0), 0),
      sets: d.sets.length,
      metric,
    };
  });
}

/** The number a strength chart plots for one workout. */
export function chartValue(point) {
  if (point.metric === 'time') return point.maxSeconds;
  if (point.metric === 'reps') return point.maxReps;
  return point.e1rm || point.topWeight;
}

/**
 * Personal records, in the order they happened. A record needs a previous workout to beat:
 * the first time you do an exercise sets a baseline, not a record.
 * kinds: 'weight' (heaviest set), 'e1rm' (best estimated max, only when not also a weight record),
 *        'reps' (bodyweight), 'time' (timed holds/carries).
 */
export function records(allSets, sessions) {
  const sorted = working(allSets)
    .filter((s) => sessions.has(s.sessionId))
    .map((s) => ({ s, sess: sessions.get(s.sessionId) }))
    .sort((a, b) => a.sess.date.localeCompare(b.sess.date) || (a.sess.startedAt || 0) - (b.sess.startedAt || 0) || a.s.idx - b.s.idx);
  const best = new Map(); // exerciseId -> { weight, e1rm, reps, time, sessionId }
  const out = [];
  // Records are judged against what was true before the workout, so one workout gives at most one record per kind.
  let i = 0;
  while (i < sorted.length) {
    const sid = sorted[i].sess.id;
    const group = [];
    while (i < sorted.length && sorted[i].sess.id === sid) group.push(sorted[i++]);
    const byEx = new Map();
    for (const g of group) { if (!byEx.has(g.s.exerciseId)) byEx.set(g.s.exerciseId, []); byEx.get(g.s.exerciseId).push(g.s); }
    for (const [exId, sets] of byEx) {
      const ex = L.exercise(exId);
      const metric = metricFor(ex, sets);
      const prev = best.get(exId);
      const top = {
        weight: Math.max(...sets.map((s) => s.weight || 0)),
        e1rm: Math.max(0, ...sets.map((s) => e1rm(s.weight, s.reps) || 0)),
        reps: Math.max(...sets.map((s) => s.reps || 0)),
        time: Math.max(...sets.map((s) => s.seconds || 0)),
      };
      const pick = (fn) => sets.reduce((a, s) => (fn(s) > fn(a) ? s : a), sets[0]);
      const base = { exerciseId: exId, date: group[0].sess.date, sessionId: sid };
      if (prev) {
        if (metric === 'time' && top.time > prev.time) out.push({ ...base, kind: 'time', value: top.time, prev: prev.time, setId: pick((s) => s.seconds || 0).id });
        else if (metric === 'reps' && top.reps > prev.reps) out.push({ ...base, kind: 'reps', value: top.reps, prev: prev.reps, setId: pick((s) => s.reps || 0).id });
        else if (metric === 'weight') {
          if (top.weight > prev.weight) {
            const s = pick((x) => (x.weight || 0) * 1000 + (x.reps || 0));
            out.push({ ...base, kind: 'weight', value: top.weight, reps: s.reps, prev: prev.weight, setId: s.id });
          } else if (top.e1rm > prev.e1rm && prev.e1rm > 0) {
            const s = pick((x) => e1rm(x.weight, x.reps) || 0);
            out.push({ ...base, kind: 'e1rm', value: top.e1rm, weight: s.weight, reps: s.reps, prev: prev.e1rm, setId: s.id });
          }
        }
      }
      best.set(exId, {
        weight: Math.max(prev?.weight || 0, top.weight), e1rm: Math.max(prev?.e1rm || 0, top.e1rm),
        reps: Math.max(prev?.reps || 0, top.reps), time: Math.max(prev?.time || 0, top.time),
      });
    }
  }
  return out;
}

export function describeRecord(r) {
  if (r.kind === 'weight') return `${r.value} lb × ${r.reps}`;
  if (r.kind === 'e1rm') return `${r.weight} × ${r.reps} (est. max ${r.value} lb)`;
  if (r.kind === 'reps') return `${r.value} reps`;
  return `${r.value} s`;
}
export const RECORD_LABEL = { weight: 'Heaviest', e1rm: 'Best estimated max', reps: 'Most reps', time: 'Longest' };

/** Workouts in each of the last `n` 7-day windows ending today, oldest first. Not calendar weeks. */
export function weekly(sessions, today = localDate(), n = 12) {
  return Array.from({ length: n }, (_, i) => {
    const end = addDays(today, -7 * (n - 1 - i));
    const start = addDays(end, -6);
    const list = sessions.filter((s) => s.date >= start && s.date <= end);
    return { start, end, count: list.length, minutes: list.reduce((a, s) => a + (s.durationMin || 0), 0) };
  });
}

/** Workouts per calendar month for the last `n` months, oldest first, with an average per week. */
export function monthly(sessions, today = localDate(), n = 6) {
  const t = parseDate(today);
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(t.getFullYear(), t.getMonth() - (n - 1 - i), 1);
    const y = d.getFullYear(), m = d.getMonth();
    const prefix = `${y}-${String(m + 1).padStart(2, '0')}`;
    const count = sessions.filter((s) => s.date.startsWith(prefix)).length;
    const isCurrent = i === n - 1;
    const days = isCurrent ? t.getDate() : new Date(y, m + 1, 0).getDate();
    return { y, m, count, perWeek: count / (days / 7), partial: isCurrent };
  });
}

/** Hard sets per muscle over the last 7 days (primary 1, secondary 0.5). */
export function muscleWeek(history, today = localDate()) {
  const recent = history.filter((h) => daysBetween(h.session.date, today) < 7);
  const tot = {};
  for (const h of recent) for (const [m, n] of Object.entries(setsPerMuscle(h.sets))) tot[m] = (tot[m] || 0) + n;
  return tot;
}

/** Last 28 days vs the 28 before: workouts, working sets, volume, minutes. */
export function trend(history, today = localDate()) {
  const bucket = (from, to) => {
    const list = history.filter((h) => { const d = daysBetween(h.session.date, today); return d >= from && d < to; });
    const ws = list.flatMap((h) => working(h.sets));
    return {
      workouts: list.length,
      sets: ws.length,
      volume: Math.round(ws.reduce((a, s) => a + (s.weight || 0) * (s.reps || 0), 0)),
      minutes: list.reduce((a, h) => a + (h.session.durationMin || 0), 0),
    };
  };
  return { now: bucket(0, 28), before: bucket(28, 56) };
}

/** Exercises you've logged most often (by number of workouts), for the strength chart picker. */
export function topExercises(allSets, sessions, limit = 8) {
  const count = new Map();
  const last = new Map();
  for (const s of working(allSets)) {
    const sess = sessions.get(s.sessionId);
    if (!sess) continue;
    if (!count.has(s.exerciseId)) count.set(s.exerciseId, new Set());
    count.get(s.exerciseId).add(s.sessionId);
    if (!(last.get(s.exerciseId) >= sess.date)) last.set(s.exerciseId, sess.date);
  }
  return [...count.entries()]
    .filter(([id]) => L.exercise(id)?.cat !== 'mobility')
    .map(([id, set]) => ({ id, workouts: set.size, last: last.get(id) }))
    .sort((a, b) => b.workouts - a.workouts || b.last.localeCompare(a.last) || a.id.localeCompare(b.id))
    .slice(0, limit);
}
