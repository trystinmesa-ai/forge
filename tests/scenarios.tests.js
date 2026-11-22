// Phase 6: the 15 scenarios from the spec, end to end through the real data layer
// (IndexedDB 'forge-test', the workout logger, the engine). Each workout is planned by the
// app, then "done" by ticking its planned sets exactly as the screens do.
import * as DB from '../js/db.js';
import * as W from '../js/workout.js';
import * as L from '../js/data/lookup.js';
import * as Engine from '../js/engine/index.js';
import * as Backup from '../js/backup.js';
import * as Hist from '../js/history-read.js';
import { DEFAULTS } from '../js/prefs.js';
import { addDays, parseDate, daysBetween } from '../js/util.js';

const prefs = structuredClone(DEFAULTS);
const at = (date, hour = 17) => parseDate(date).getTime() + hour * 3.6e6;
const D = '2026-10-20';
// Starting weights the simulated lifter picks for a brand-new exercise.
const START = { barbell: 95, dumbbell: 40, kettlebell: 35, machine: 80, cable: 80, smith: 85, band: 0, bodyweight: 0 };
const LEGS = ['quads', 'hamstrings', 'glutes', 'calves', 'adductors'];

const recommendOn = (date, opts = {}) => Engine.recommend({ prefs, today: date, now: at(date, 8), ...opts });

/** reps: 'top' (hit the top of every target), 'bottom', 'under' (below the range), or fn(ex, target, set). */
function repsFor(mode, ex, t, set) {
  if (typeof mode === 'function') return mode(ex, t, set);
  if (t.setReps) {
    const want = t.setReps[set.idx] ?? t.setReps[t.setReps.length - 1];
    const n = want === 'max' ? 17 : want;
    return mode === 'under' ? 8 : n;
  }
  if (mode === 'under') return Math.max(1, t.reps[0] - 2);
  return mode === 'bottom' ? t.reps[0] : t.reps[1];
}

/** Tick every planned set of a session the way the workout screen does, then finish it. */
async function completeAll(session, date, reps = 'top') {
  const map = await W.setsByEntry(session.id);
  for (const e of session.entries) {
    const ex = L.exercise(e.exerciseId);
    for (const set of map.get(e.id) || []) {
      if (set.kind === 'warmup') { await W.updateSet(set.id, { reps: 5, completed: true }); continue; }
      const t = e.target;
      await W.updateSet(set.id, {
        weight: set.weight ?? START[ex.load],
        reps: t.seconds ? null : repsFor(reps, ex, t, set),
        seconds: t.seconds ? t.seconds[1] : null,
        completed: true,
      });
    }
  }
  return W.finishSession(session.id, { now: at(date) + 50 * 60000 });
}

async function doRecommended(date, opts = {}, reps = 'top') {
  const { workout } = await recommendOn(date, opts);
  const s = await Engine.startPlan(workout, { prefs, checkin: opts.checkin || null, now: at(date) });
  return { plan: workout, session: await completeAll(s, date, reps) };
}

async function doExercises(date, ids, reps = 'top', p = prefs) {
  const s = await W.startSession({ exerciseIds: ids, prefs: p, now: at(date) });
  return completeAll(s, date, reps);
}

const exs = (plan) => plan.items.map((i) => L.exercise(i.exerciseId));
const plannedSets = async (s) => [...(await W.setsByEntry(s.id)).values()].flat();

export default function register({ describe, it, eq, ok, fresh }) {
  describe('Scenario 1: four workouts in a week', () => {
    it('following the app for two weeks: ~4 a week, every major muscle twice, never 4 days in a row, weights progress', async () => {
      await fresh();
      const done = [];
      for (let i = 0; i < 14; i++) {
        const day = addDays(D, i);
        const { when } = await recommendOn(day);
        if (when.days !== 0 || when.optional) continue;
        done.push({ day, ...(await doRecommended(day)) });
      }
      const week2 = done.filter((d) => d.day >= addDays(D, 7));
      ok(week2.length >= 3 && week2.length <= 5, `${week2.length} workouts in week 2`);
      for (const m of ['chest', 'lats', 'upperBack', 'quads', 'hamstrings', 'glutes']) {
        const hits = week2.filter((d) => exs(d.plan).some((e) => e.primary.includes(m))).length;
        ok(hits >= 2, `${m} trained ${hits}× in week 2`);
      }
      const days = done.map((d) => d.day);
      ok(!days.some((d) => [1, 2, 3].every((k) => days.includes(addDays(d, k)))), `4 days in a row: ${days.join(', ')}`);
      const sessions = await Hist.completedSessions();
      const increased = sessions.some((s) => s.entries.some((e) => e.progress?.decision === 'increase'));
      ok(increased, 'hitting the targets led to weight increases');
    });
    it('a fifth session in the same week is allowed, just marked as a bonus', async () => {
      await fresh();
      for (const k of [-6, -5, -3, -2]) await doRecommended(addDays(D, k));
      const { when } = await recommendOn(D);
      ok(when.optional && /bonus/.test(when.reason), when.reason);
    });
  });

  describe('Scenario 2: two workouts in a week', () => {
    it('today is recommended, it isn’t a bonus, and there’s no catch-up volume', async () => {
      await fresh();
      await doRecommended(addDays(D, -6));
      await doRecommended(addDays(D, -3));
      const { when, workout } = await recommendOn(D);
      eq([when.days, when.optional], [0, false], when.reason);
      ok(workout.items.every((i) => i.sets <= L.prescription(L.exercise(i.exerciseId)).sets + 0), 'no extra sets to make up');
      ok(workout.estimateMin <= prefs.defaultMinutes + 3, `${workout.estimateMin} min`);
    });
  });

  describe('Scenario 3: several missed days', () => {
    it('after 5 days off: train today, full body, the gap explained without blame', async () => {
      await fresh();
      for (const k of [-12, -10, -8, -5]) await doRecommended(addDays(D, k));
      const { when, workout } = await recommendOn(D);
      eq(when.days, 0);
      ok(/5 days since/.test(when.reason), when.reason);
      eq(workout.focus, 'full');
      ok(!workout.reasons.some((r) => /missed|behind schedule|make up/i.test(r)), workout.reasons.join(' | '));
    });
  });

  describe('Scenario 4: a week away', () => {
    it('back after 9 days: full body, fewer sets on main lifts, weights held this first session', async () => {
      await fresh();
      for (const k of [-15, -13, -11, -9]) await doRecommended(addDays(D, k));
      const { workout } = await recommendOn(D);
      eq(workout.focus, 'full');
      ok(workout.reasons.some((r) => /ease back in/.test(r)), workout.reasons.join(' | '));
      const s = await Engine.startPlan(workout, { prefs, now: at(D) });
      const compounds = s.entries.filter((e) => L.exercise(e.exerciseId).cat === 'compound');
      ok(compounds.length && compounds.every((e) => e.target.sets === 2), 'main lifts at 2 sets');
      ok(!s.entries.some((e) => e.progress.decision === 'increase'), s.entries.map((e) => e.progress.decision).join(','));
      ok(s.entries.some((e) => e.progress.rule === 'return'), 'the hold is explained');
    });
  });

  describe('Scenario 5: soreness (and pain)', () => {
    it('sore legs: no leg-focused work today; the check-in is saved with the workout', async () => {
      await fresh();
      await doRecommended(addDays(D, -4));
      const checkin = { sore: ['legs', 'hips'], pain: [], notes: 'stairs hurt' };
      const { workout } = await recommendOn(D, { checkin });
      ok(workout.focus !== 'lower', workout.focus);
      ok(exs(workout).every((e) => !e.primary.some((m) => LEGS.includes(m))), exs(workout).map((e) => e.id).join(', '));
      const s = await Engine.startPlan(workout, { prefs, checkin, now: at(D) });
      eq((await DB.get('sessions', s.id)).checkin.sore, ['legs', 'hips']);
    });
    it('shoulder pain: nothing that loads the shoulders, and a clear warning not to train through it', async () => {
      await fresh();
      const { workout } = await recommendOn(D, { focus: 'upper', checkin: { sore: [], pain: ['shoulders'] } });
      ok([...exs(workout), ...workout.warmup.map(L.exercise)].every((e) => !e.stress.includes('shoulders')), exs(workout).map((e) => e.id).join(', '));
      ok(workout.reasons.some((r) => /Don’t train through pain/.test(r)));
    });
  });

  describe('Scenario 6: kettlebells only', () => {
    it('a real kettlebell workout, and weights move through the bells you own', async () => {
      await fresh();
      const { workout } = await recommendOn(D, { profileId: 'kb' });
      const list = exs(workout);
      ok(list.every((e) => e.eq.every((q) => q === 'kettlebell' || q === 'bodyweight')), list.map((e) => e.id).join(', '));
      ok(list.some((e) => e.pattern === 'ballistic') && list.some((e) => ['squat', 'lunge'].includes(e.pattern)), 'swing/clean + squat');
      ok(list.some((e) => ['carry', 'getUp'].includes(e.pattern)) || workout.minutes < 45, 'carry or get-up');
      // Goblet squat at 35 lb, top of the range twice → next bell (44), never a weight you don't own.
      await doExercises(addDays(D, -4), ['kb-goblet-squat'], (ex, t) => t.reps[1]);
      const s2 = await W.startSession({ exerciseIds: ['kb-goblet-squat'], prefs, now: at(addDays(D, -2)) });
      eq(s2.entries[0].progress.decision, 'hold', 'a 25% jump waits for a second confirmation');
      await completeAll(s2, addDays(D, -2), 'top');
      const s3 = await W.startSession({ exerciseIds: ['kb-goblet-squat'], prefs, now: at(D) });
      eq((await plannedSets(s3)).filter((x) => x.kind === 'working').map((x) => x.weight), [44, 44, 44]);
    });
  });

  describe('Scenario 7: bodyweight only', () => {
    it('only bodyweight exercises, no invented weights, honest about what it can’t train', async () => {
      await fresh();
      const { workout } = await recommendOn(D, { profileId: 'home' });
      ok(exs(workout).every((e) => e.eq.every((q) => q === 'bodyweight')), exs(workout).map((e) => e.id).join(', '));
      ok(workout.notes.some((t) => /pull/i.test(t)), workout.notes.join(' | '));
      const s = await Engine.startPlan(workout, { prefs, now: at(D) });
      ok((await plannedSets(s)).every((x) => x.weight === null), 'no weights filled in');
      await completeAll(s, D, 'top');
      const next = await W.startSession({ exerciseIds: [s.entries[0].exerciseId], prefs, now: at(addDays(D, 2)) });
      ok(['reps', 'hold'].includes(next.entries[0].progress.decision), next.entries[0].progress.reason);
      ok(next.entries[0].progress.weight === 0 || next.entries[0].progress.weight == null);
    });
  });

  describe('Scenario 8: replacing an exercise because of equipment', () => {
    it('alternatives respect the equipment, the swap keeps its spot, and repeated swaps are remembered', async () => {
      await fresh();
      const kb = prefs.profiles.find((x) => x.id === 'kb').equipment;
      const swapOnce = async (date) => {
        const s = await W.startSession({ exerciseIds: ['bb-bench', 'db-row'], prefs, now: at(date) });
        const alts = L.alternatives(L.exercise('bb-bench'), { available: kb });
        ok(alts.length > 0 && alts.every((a) => L.isAvailable(a, kb)), alts.map((a) => a.id).join(', '));
        await W.replaceEntry(s.id, s.entries[0].id, alts[0].id, prefs);
        const after = (await DB.get('sessions', s.id)).entries.sort((a, b) => a.order - b.order);
        eq(after.map((e) => e.exerciseId), [alts[0].id, 'db-row']);
        eq(after[0].replacedFrom, 'bb-bench');
        await completeAll(await DB.get('sessions', s.id), date);
        return alts[0].id;
      };
      const to = await swapOnce(addDays(D, -6));
      await swapOnce(addDays(D, -3));
      eq((await DB.get('substitutions', `bb-bench>${to}`)).count, 2);
      // The planner now avoids what you keep swapping out.
      const { workout } = await recommendOn(D, { focus: 'upper' });
      ok(!workout.items.some((i) => i.exerciseId === 'bb-bench'), workout.items.map((i) => i.exerciseId).join(', '));
    });
  });

  describe('Scenario 9: regenerating after an equipment change', () => {
    it('switching to kettlebells mid-workout rebuilds only what you haven’t started', async () => {
      await fresh();
      const { workout } = await recommendOn(D, { minutes: 60 });
      const s = await Engine.startPlan(workout, { prefs, now: Date.now() - 5 * 60000 });
      const first = s.entries.slice().sort((a, b) => a.order - b.order)[0];
      const set = (await W.setsByEntry(s.id)).get(first.id).find((x) => x.kind === 'working');
      await W.updateSet(set.id, { weight: 95, reps: 8, completed: true });
      const r = await Engine.regenerateRemaining(s.id, { prefs, profileId: 'kb', minutes: 60, vary: false });
      const kb = prefs.profiles.find((x) => x.id === 'kb').equipment;
      const rest = r.session.entries.filter((e) => e.id !== first.id);
      ok(r.session.entries.some((e) => e.id === first.id), 'started exercise kept');
      ok(rest.length >= 3 && rest.every((e) => L.isAvailable(L.exercise(e.exerciseId), kb)), rest.map((e) => e.exerciseId).join(', '));
      eq(r.session.plan.profileId, 'kb');
      eq((await DB.get('sets', set.id)).completed, true, 'logged set untouched');
    });
  });

  describe('Scenario 10: first time doing an exercise', () => {
    it('flagged as new, with no weight or reps filled in', async () => {
      await fresh();
      const { workout } = await recommendOn(D);
      const s = await Engine.startPlan(workout, { prefs, now: at(D) });
      ok(s.entries.every((e) => e.progress.decision === 'new'), s.entries.map((e) => e.progress.decision).join(','));
      ok((await plannedSets(s)).every((x) => x.weight === null && x.reps === null), 'nothing invented');
      eq(await W.previousPerformance(s.entries[0].exerciseId, s.id), null);
    });
  });

  describe('Scenario 11: weight increase after hitting the target', () => {
    it('exercise-specific: every set at the top of the range → one step up next time', async () => {
      await fresh();
      await doExercises(addDays(D, -3), ['db-bench'], 'top');
      const s = await W.startSession({ exerciseIds: ['db-bench'], prefs, now: at(D) });
      eq(s.entries[0].progress.decision, 'increase', s.entries[0].progress.reason);
      eq((await plannedSets(s)).map((x) => x.weight), [45, 45, 45]);
    });
    it('your 15 / 12 / max: 17 on the last set (after 15 and 12) → add 5 lb', async () => {
      await fresh();
      const classic = { ...prefs, progressionStyle: 'classic' };
      await doExercises(addDays(D, -3), ['db-curl'], 'top', classic);
      const s = await W.startSession({ exerciseIds: ['db-curl'], prefs: classic, now: at(D) });
      eq([s.entries[0].progress.decision, s.entries[0].progress.weight], ['increase', 45], s.entries[0].progress.reason);
      eq(s.entries[0].target.setReps, [15, 12, 'max']);
    });
  });

  describe('Scenario 12: fewer reps than expected', () => {
    it('once → same weight; twice in a row → one step lighter', async () => {
      await fresh();
      await doExercises(addDays(D, -6), ['db-bench'], 'under');
      const s1 = await W.startSession({ exerciseIds: ['db-bench'], prefs, now: at(addDays(D, -3)) });
      eq([s1.entries[0].progress.decision, (await plannedSets(s1))[0].weight], ['hold', 40], s1.entries[0].progress.reason);
      await completeAll(s1, addDays(D, -3), 'under');
      const s2 = await W.startSession({ exerciseIds: ['db-bench'], prefs, now: at(D) });
      eq([s2.entries[0].progress.decision, (await plannedSets(s2))[0].weight], ['decrease', 35], s2.entries[0].progress.reason);
    });
    it('15 / 12 / max with under 10 on the last set → drop 5 lb', async () => {
      await fresh();
      const classic = { ...prefs, progressionStyle: 'classic' };
      await doExercises(addDays(D, -3), ['db-curl'], 'under', classic);
      const s = await W.startSession({ exerciseIds: ['db-curl'], prefs: classic, now: at(D) });
      eq([s.entries[0].progress.decision, s.entries[0].progress.weight], ['decrease', 35]);
    });
  });

  describe('Scenario 13: only 30 minutes', () => {
    it('fits about 30 minutes, keeps the main lifts, and says what was left out', async () => {
      await fresh();
      for (const id of ['gym', 'kb', 'db']) {
        const { workout } = await recommendOn(D, { minutes: 30, profileId: id });
        ok(workout.estimateMin <= 33, `${id}: ${workout.estimateMin} min`);
        ok(workout.items.length >= 3, `${id}: ${workout.items.length} exercises`);
        ok(workout.dropped.length === 0 || workout.reasons.some((r) => /Left out for time/.test(r)), workout.reasons.join(' | '));
      }
      const { workout: tiny } = await recommendOn(D, { minutes: 15 });
      ok(tiny.overBudget && tiny.reasons.some((r) => /needs about/.test(r)), 'honest when it can’t fit');
    });
  });

  describe('Scenario 14: closing the app mid-workout', () => {
    it('logged sets, check-in, warm-up ticks and the rest timer all survive; the workout resumes and finishes', async () => {
      await fresh();
      const { workout } = await recommendOn(D);
      const checkin = { sore: ['arms'], pain: [], notes: '' };
      const s = await Engine.startPlan(workout, { prefs, checkin, now: Date.now() - 20 * 60000 });
      const sets = (await plannedSets(s)).filter((x) => x.kind === 'working').slice(0, 2);
      for (const x of sets) await W.updateSet(x.id, { weight: 50, reps: 9, completed: true });
      await W.updateSession(s.id, { plan: { ...s.plan, warmupDone: [s.plan.warmup[0]] } });
      localStorage.setItem('forge.rest', JSON.stringify({ endsAt: Date.now() + 90e3, total: 90, label: 'Rest' }));

      await DB.close();               // app closed / killed
      DB.useDatabase('forge-test');   // reopened

      const back = await W.activeSession();
      eq(back.id, s.id);
      eq(back.checkin.sore, ['arms']);
      eq(back.plan.warmupDone, [s.plan.warmup[0]]);
      const again = await Promise.all(sets.map((x) => DB.get('sets', x.id)));
      eq(again.map((x) => [x.weight, x.reps, x.completed]), [[50, 9, true], [50, 9, true]]);
      ok(JSON.parse(localStorage.getItem('forge.rest')).endsAt > Date.now(), 'rest timer still running');
      localStorage.removeItem('forge.rest');
      const done = await W.finishSession(s.id);
      eq((await DB.byIndex('sets', 'sessionId', done.id)).filter((x) => x.kind === 'working').length, 2);
    });
  });

  describe('Scenario 15: reopening with data intact', () => {
    it('history, records, swaps and recommendations are identical after closing, and after backup → wipe → restore', async () => {
      await fresh();
      for (const k of [-9, -7, -4, -2]) await doRecommended(addDays(D, k));
      const s = await W.startSession({ exerciseIds: ['bb-bench'], prefs, now: at(addDays(D, -1)) });
      await W.replaceEntry(s.id, s.entries[0].id, 'db-bench', prefs);
      await completeAll(await DB.get('sessions', s.id), addDays(D, -1));

      const snap = async () => ({
        data: await DB.loadAll(),
        records: await Hist.allRecords(),
        plan: (await recommendOn(D)).workout.items,
        when: (await recommendOn(D)).when,
      });
      const before = await snap();
      ok(before.data.sessions.length === 5 && before.data.sets.length > 30, `${before.data.sessions.length} workouts, ${before.data.sets.length} sets`);

      await DB.close();
      DB.useDatabase('forge-test');
      const reopened = await snap();
      eq(reopened, before, 'identical after reopening');

      const backup = JSON.parse(JSON.stringify(await Backup.build()));
      await DB.replaceAll({});
      eq(await DB.count('sessions'), 0);
      const v = Backup.validate(backup);
      ok(v.ok, v.error);
      await Backup.restore(v.backup, 'replace');
      const restored = await snap();
      eq(restored.data, before.data, 'every record restored');
      eq([restored.plan, restored.when, restored.records], [before.plan, before.when, before.records], 'same records and recommendation');
      ok(daysBetween(restored.data.sessions.map((x) => x.date).sort()[0], D) === 9);
    });
  });
}
