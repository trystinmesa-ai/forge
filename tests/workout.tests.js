// Workout logging: start, log, previous performance, replace, finish, discard, resume after closing.
import * as DB from '../js/db.js';
import * as W from '../js/workout.js';
import { DEFAULTS } from '../js/prefs.js';

const prefs = structuredClone(DEFAULTS);
const T0 = Date.parse('2026-11-16T17:00:00');

export default function register({ describe, it, eq, ok, fresh }) {
  /** Log a full workout of one exercise with the given sets, finished at `start` + 50 min. */
  async function logWorkout(exerciseId, sets, start) {
    const s = await W.startSession({ exerciseIds: [exerciseId], prefs, now: start });
    const map = await W.setsByEntry(s.id);
    const planned = map.get(s.entries[0].id);
    for (let i = 0; i < sets.length; i++) {
      const target = planned[i] || await W.addSet(s.id, s.entries[0].id);
      await W.updateSet(target.id, { weight: sets[i][0], reps: sets[i][1], completed: true });
    }
    return W.finishSession(s.id, { now: start + 50 * 60000 });
  }

  describe('Workout: first time and previous performance', () => {
    it('a never-done exercise is clearly new: no invented weights or reps', async () => {
      await fresh();
      eq(await W.previousPerformance('db-bench'), null);
      const s = await W.startSession({ exerciseIds: ['db-bench'], prefs, now: T0 });
      const sets = (await W.setsByEntry(s.id)).get(s.entries[0].id);
      eq(sets.length, 3);
      ok(sets.every((x) => x.weight === null && x.reps === null && !x.completed), 'planned sets must be blank');
    });
    it('the next workout shows last time’s sets and pre-fills last time’s weights', async () => {
      await fresh();
      await logWorkout('db-bench', [[45, 9], [45, 8], [45, 8]], T0);
      const prev = await W.previousPerformance('db-bench');
      eq(prev.sets.map((x) => [x.weight, x.reps]), [[45, 9], [45, 8], [45, 8]]);
      const s = await W.startSession({ exerciseIds: ['db-bench'], prefs, now: T0 + 2 * 864e5 });
      const sets = (await W.setsByEntry(s.id)).get(s.entries[0].id);
      eq(sets.map((x) => x.weight), [45, 45, 45], 'weights pre-filled');
      eq(sets.map((x) => x.reps), [null, null, null], 'reps are never pre-filled as if done');
    });
    it('uses the most recent completed workout, ignoring warm-ups and the workout in progress', async () => {
      await fresh();
      await logWorkout('db-bench', [[40, 12]], T0);
      await logWorkout('db-bench', [[50, 10]], T0 + 864e5);
      const s = await W.startSession({ exerciseIds: ['db-bench'], prefs, now: T0 + 3 * 864e5 });
      const e = s.entries[0];
      const warm = await W.addSet(s.id, e.id, { kind: 'warmup' });
      await W.updateSet(warm.id, { weight: 25, reps: 10, completed: true });
      const prev = await W.previousPerformance('db-bench', s.id);
      eq(prev.sets.map((x) => x.weight), [50]);
      eq(warm.weight, 25, 'warm-up suggested at about half the working weight');
    });
  });

  describe('Workout: saving as you go', () => {
    it('logged sets survive closing the app mid-workout, and the workout can be resumed', async () => {
      await fresh();
      const s = await W.startSession({ exerciseIds: ['db-bench', 'db-row'], prefs, now: T0 });
      const first = (await W.setsByEntry(s.id)).get(s.entries[0].id)[0];
      await W.updateSet(first.id, { weight: 45, reps: 15, completed: true });
      await DB.close();                 // app closed
      DB.useDatabase('forge-test');     // app reopened
      const resumed = await W.activeSession();
      eq(resumed.id, s.id);
      eq(resumed.entries.map((e) => e.exerciseId), ['db-bench', 'db-row']);
      const again = (await W.setsByEntry(s.id)).get(s.entries[0].id)[0];
      eq([again.weight, again.reps, again.completed], [45, 15, true]);
      ok(again.completedAt > 0);
    });
    it('only one workout can be in progress at a time', async () => {
      await fresh();
      await W.startSession({ prefs, now: T0 });
      let msg = '';
      try { await W.startSession({ prefs, now: T0 + 1000 }); } catch (e) { msg = e.message; }
      ok(/already in progress/.test(msg), msg);
    });
  });

  describe('Workout: finishing', () => {
    it('keeps completed sets, drops planned ones, records duration and skipped exercises', async () => {
      await fresh();
      const s = await W.startSession({ exerciseIds: ['db-bench', 'db-curl'], prefs, now: T0 });
      const bench = (await W.setsByEntry(s.id)).get(s.entries[0].id);
      await W.updateSet(bench[0].id, { weight: 45, reps: 15, completed: true });
      await W.updateSet(bench[1].id, { weight: 45, reps: 12, completed: true });
      const done = await W.finishSession(s.id, { notes: 'good', now: T0 + 40 * 60000 });
      eq(done.status, 'completed');
      eq(done.durationMin, 40);
      eq(done.notes, 'good');
      eq((await DB.byIndex('sets', 'sessionId', s.id)).length, 2, 'unfinished planned sets removed');
      eq(done.entries.map((e) => e.skipped), [false, true], 'untouched exercise marked skipped');
    });
    it('a workout left open for hours ends at the last set, not hours later', async () => {
      await fresh();
      const s = await W.startSession({ exerciseIds: ['db-bench'], prefs, now: T0 });
      const set = (await W.setsByEntry(s.id)).get(s.entries[0].id)[0];
      await W.updateSet(set.id, { weight: 45, reps: 10, completed: true });
      const lastAt = (await DB.get('sets', set.id)).completedAt;
      const done = await W.finishSession(s.id, { now: lastAt + 5 * 3600e3 });
      ok(done.endedAt - lastAt <= 2 * 60000 + 1, 'end time capped near the last set');
    });
    it('cannot finish an empty workout; discarding removes it completely', async () => {
      await fresh();
      const s = await W.startSession({ exerciseIds: ['db-bench'], prefs, now: T0 });
      let msg = '';
      try { await W.finishSession(s.id); } catch (e) { msg = e.message; }
      ok(/No completed sets/.test(msg), msg);
      await W.discardSession(s.id);
      eq(await DB.count('sessions'), 0);
      eq(await DB.count('sets'), 0);
    });
  });

  describe('Workout: replacing exercises', () => {
    it('replacing keeps the spot in the workout and the rest unchanged, and remembers the swap', async () => {
      await fresh();
      const s = await W.startSession({ exerciseIds: ['bb-rdl', 'db-row', 'db-curl'], prefs, now: T0 });
      await W.replaceEntry(s.id, s.entries[0].id, 'smith-rdl', prefs);
      const after = await DB.get('sessions', s.id);
      eq(after.entries.sort((a, b) => a.order - b.order).map((e) => e.exerciseId), ['smith-rdl', 'db-row', 'db-curl']);
      eq(after.entries.find((e) => e.exerciseId === 'smith-rdl').replacedFrom, 'bb-rdl');
      eq((await DB.byIndex('sets', 'exerciseId', 'bb-rdl')).length, 0, 'old planned sets removed');
      eq((await DB.get('substitutions', 'bb-rdl>smith-rdl')).count, 1);
      await W.discardSession(s.id);
      const s2 = await W.startSession({ exerciseIds: ['bb-rdl'], prefs, now: T0 + 864e5 });
      await W.replaceEntry(s2.id, s2.entries[0].id, 'smith-rdl', prefs);
      eq((await DB.get('substitutions', 'bb-rdl>smith-rdl')).count, 2, 'repeat swaps are counted');
    });
    it('sets already done on the old exercise are kept when replacing mid-way', async () => {
      await fresh();
      const s = await W.startSession({ exerciseIds: ['bb-bench'], prefs, now: T0 });
      const first = (await W.setsByEntry(s.id)).get(s.entries[0].id)[0];
      await W.updateSet(first.id, { weight: 135, reps: 8, completed: true });
      await W.replaceEntry(s.id, s.entries[0].id, 'db-bench', prefs);
      const after = await DB.get('sessions', s.id);
      eq(after.entries.sort((a, b) => a.order - b.order).map((e) => e.exerciseId), ['bb-bench', 'db-bench']);
      eq((await DB.byIndex('sets', 'exerciseId', 'bb-bench')).filter((x) => x.completed).length, 1);
    });
  });

  describe('Workout: history and weights', () => {
    it('exercise history lists every completed workout, newest first, with the best set', async () => {
      await fresh();
      await logWorkout('db-bench', [[45, 15], [45, 12]], T0);
      await logWorkout('db-bench', [[50, 10], [50, 9]], T0 + 2 * 864e5);
      const hist = await W.exerciseHistory('db-bench');
      eq(hist.map((x) => x.date), ['2026-11-18', '2026-11-16']);
      const best = W.bestSet(hist.flatMap((x) => x.sets));
      eq([best.weight, best.reps], [50, 10]);
    });
    it('repeating a past workout copies its exercises with current weights', async () => {
      await fresh();
      const past = await logWorkout('db-bench', [[45, 15]], T0);
      const s = await W.repeatSession(past.id, prefs);
      eq(s.entries.map((e) => e.exerciseId), ['db-bench']);
      eq(s.plan.from, past.id);
    });
    it('weight steps follow your gym’s jumps and owned kettlebell sizes', () => {
      eq(W.stepWeight({ load: 'dumbbell' }, 45, 1, prefs), 50);
      eq(W.stepWeight({ load: 'barbell' }, 135, -1, prefs), 130);
      eq(W.stepWeight({ load: 'kettlebell' }, 35, 1, prefs), 44);
      eq(W.stepWeight({ load: 'kettlebell' }, 35, -1, prefs), 26);
      eq(W.stepWeight({ load: 'kettlebell' }, 30, 1, { ...prefs, kettlebellSizes: [26, 53] }), 53);
    });
  });

  describe('Workouts logged afterwards, and editing', () => {
    const past = (over = {}) => ({ date: '2026-11-10', title: 'Gym', durationMin: 50, notes: '', entries: [
      { exerciseId: 'db-bench', sets: [{ weight: 50, reps: 10 }, { weight: 50, reps: 9 }, { weight: null, reps: null }] },
      { exerciseId: 'push-up', sets: [{ weight: null, reps: 20 }] },
    ], ...over });
    it('saves only the sets you filled in, as a finished workout on that day', async () => {
      await fresh();
      const s = await W.savePastWorkout(past(), prefs, { now: T0 });
      eq([s.status, s.date, s.durationMin, s.title], ['completed', '2026-11-10', 50, 'Gym']);
      const sets = await DB.byIndex('sets', 'sessionId', s.id);
      eq(sets.length, 3, 'the empty row is ignored');
      ok(sets.every((x) => x.completed && x.kind === 'working' && x.date === '2026-11-10'));
      const prev = await W.previousPerformance('db-bench');
      eq(prev.sets.map((x) => [x.weight, x.reps]), [[50, 10], [50, 9]]);
    });
    it('it feeds progression like any other workout', async () => {
      await fresh();
      await W.savePastWorkout(past({ entries: [{ exerciseId: 'db-bench', sets: [{ weight: 50, reps: 10 }, { weight: 50, reps: 10 }, { weight: 50, reps: 10 }] }] }), prefs, { now: T0 });
      const s = await W.startSession({ exerciseIds: ['db-bench'], prefs, now: T0 });
      eq(s.entries[0].progress.decision, 'increase');
    });
    it('refuses future dates and workouts with no sets', async () => {
      await fresh();
      let a = '', b = '';
      try { await W.savePastWorkout(past({ date: '2026-12-31' }), prefs, { now: T0 }); } catch (e) { a = e.message; }
      try { await W.savePastWorkout(past({ entries: [{ exerciseId: 'db-bench', sets: [{ weight: 50, reps: null }] }] }), prefs, { now: T0 }); } catch (e) { b = e.message; }
      ok(/future/.test(a), a);
      ok(/at least one set/.test(b), b);
      eq(await DB.count('sessions'), 0);
    });
    it('a workout logged for today counts as just finished (so recovery sees it)', async () => {
      await fresh();
      const s = await W.savePastWorkout(past({ date: '2026-11-16' }), prefs, { now: T0 });
      eq(s.startedAt, T0 - 50 * 60000);
    });
    it('editing: change sets, remove an exercise, add one, move the day; warm-ups of kept exercises stay', async () => {
      await fresh();
      const live = await W.startSession({ exerciseIds: ['db-bench', 'db-curl'], prefs, now: T0 });
      const bench = live.entries[0];
      const warm = await W.addSet(live.id, bench.id, { kind: 'warmup' });
      await W.updateSet(warm.id, { weight: 25, reps: 8, completed: true });
      for (const x of (await W.setsByEntry(live.id)).get(bench.id).filter((y) => y.kind === 'working')) await W.updateSet(x.id, { weight: 45, reps: 8, completed: true });
      const c = (await W.setsByEntry(live.id)).get(live.entries[1].id)[0];
      await W.updateSet(c.id, { weight: 20, reps: 12, completed: true });
      await W.finishSession(live.id, { now: T0 + 3e6 });

      const d = await W.loadForEdit(live.id);
      eq(d.entries.map((e) => e.exerciseId), ['db-bench', 'db-curl']);
      d.entries[0].sets[0].reps = 10;                    // fix a typo
      d.entries[0].sets.pop();                           // drop a set
      d.entries.splice(1, 1);                            // remove curls
      d.entries.push({ entryId: null, exerciseId: 'db-row', sets: [{ weight: 55, reps: 10 }] });
      d.date = '2026-11-15';
      const saved = await W.savePastWorkout(d, prefs, { now: T0 + 4e6 });
      eq(saved.id, live.id, 'same workout, not a copy');
      eq(saved.entries.map((e) => e.exerciseId), ['db-bench', 'db-row']);
      const sets = await DB.byIndex('sets', 'sessionId', live.id);
      eq(sets.filter((x) => x.kind === 'working' && x.exerciseId === 'db-bench').sort((a, b) => a.idx - b.idx).map((x) => x.reps), [10, 8]);
      eq(sets.filter((x) => x.exerciseId === 'db-curl').length, 0, 'removed exercise’s sets deleted');
      eq(sets.filter((x) => x.kind === 'warmup').map((x) => x.weight), [25], 'warm-up kept');
      ok(sets.every((x) => x.date === '2026-11-15'), 'moved to the new day');
      ok(saved.editedAt > 0);
    });
  });
}
