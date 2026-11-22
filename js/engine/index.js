// The training engine's front door: loads your history, then calls the pure planner,
// scheduler and progression rules. Everything is computed on the phone; nothing is sent anywhere.
import * as DB from '../db.js';
import * as W from '../workout.js';
import { plan } from './planner.js';
import { nextSession } from './schedule.js';
import { localDate, daysBetween } from '../util.js';

export { plan, FOCI, estimateMinutes } from './planner.js';
export { nextSession } from './schedule.js';
export { nextTarget } from './progression.js';

const HISTORY_DAYS = 56;

/** Completed workouts from the last 8 weeks with their sets, exercises done recently, and remembered swaps. */
export async function context(today = localDate()) {
  const sessions = (await DB.byIndex('sessions', 'status', 'completed')).filter((s) => daysBetween(s.date, today) <= HISTORY_DAYS);
  const history = [];
  const familiar = new Map();
  for (const session of sessions) {
    const sets = (await DB.byIndex('sets', 'sessionId', session.id)).filter((s) => s.completed);
    history.push({ session, sets });
    for (const s of sets) if (s.kind === 'working' && !(familiar.get(s.exerciseId) > session.date)) familiar.set(s.exerciseId, session.date);
  }
  const swaps = await DB.all('substitutions');
  return { history, familiar, swaps };
}

/** Today's recommendation: when to train and what. opts as for planner.plan (prefs required). */
export async function recommend(opts) {
  const today = opts.today || localDate();
  const now = opts.now || Date.now();
  const ctx = await context(today);
  const when = nextSession(ctx.history, { today, now, prefs: opts.prefs, checkin: opts.checkin });
  const workout = plan(ctx.history, ctx, { ...opts, today, now });
  return { when, workout };
}

/** Start the planned workout. The plan (and its reasons) is kept with the session. */
export function startPlan(p, { prefs, checkin = null, now = Date.now() }) {
  return W.startSession({
    title: p.title, items: p.items, checkin, prefs, now,
    plan: {
      generatedBy: 'engine', focus: p.focus, minutes: p.minutes, profileId: p.profileId, estimateMin: p.estimateMin,
      reasons: p.reasons, notes: p.notes, warmup: p.warmup, ramp: p.ramp, picks: p.items.map((i) => i.exerciseId),
    },
  });
}

/**
 * Rebuild the exercises you haven't started, e.g. after switching equipment or time.
 * Exercises with any completed set stay exactly as they are.
 */
export async function regenerateRemaining(sessionId, { prefs, profileId, minutes, vary = true, now = Date.now() }) {
  const session = await DB.get('sessions', sessionId);
  const sets = await DB.byIndex('sets', 'sessionId', sessionId);
  const started = new Set(sets.filter((s) => s.completed).map((s) => s.entryId));
  const keep = session.entries.filter((e) => started.has(e.id));
  const elapsed = Math.round((now - session.startedAt) / 60000);
  const ctx = await context(session.date);
  const p = plan(ctx.history, ctx, {
    prefs, now, today: session.date, profileId, checkin: session.checkin,
    minutes: Math.max(15, (minutes || session.plan?.minutes || prefs.defaultMinutes) - elapsed),
    focus: session.plan?.focus || 'auto',
    // Same setup: show different exercises. New equipment or time: just the best fit.
    avoid: vary ? session.entries.filter((e) => !started.has(e.id)).map((e) => e.exerciseId) : [],
    skipSlots: keep.map((e) => e.slot).filter(Boolean),
  });
  // Already-done exercises aren't repeated.
  const doneIds = new Set(keep.map((e) => e.exerciseId));
  const items = p.items.filter((i) => !doneIds.has(i.exerciseId));
  const drop = sets.filter((s) => !started.has(s.entryId));
  await DB.batch([
    { store: 'sessions', put: { ...session, entries: keep, title: keep.length ? session.title : p.title,
      plan: { ...(session.plan || {}), generatedBy: session.plan?.generatedBy || 'engine', profileId: p.profileId, minutes: minutes || session.plan?.minutes, focus: p.focus, reasons: p.reasons, notes: p.notes, regenerated: (session.plan?.regenerated || 0) + 1 } } },
    ...drop.map((s) => ({ store: 'sets', del: s.id })),
  ]);
  for (const it of items) await W.addEntry(sessionId, it.exerciseId, prefs, { sets: it.sets, slot: it.slot });
  return { session: await DB.get('sessions', sessionId), plan: p, added: items.length };
}
