// Training engine: planning, recovery, equipment, time, scheduling and progression.
import * as L from '../js/data/lookup.js';
import * as W from '../js/workout.js';
import * as Engine from '../js/engine/index.js';
import { plan, entrySeconds } from '../js/engine/planner.js';
import { nextSession } from '../js/engine/schedule.js';
import { nextTarget, stepWeight } from '../js/engine/progression.js';
import { muscleState } from '../js/engine/recovery.js';
import { DEFAULTS } from '../js/prefs.js';
import { addDays, parseDate } from '../js/util.js';

const prefs = structuredClone(DEFAULTS);
const TODAY = '2026-11-20';
const at = (date, hour = 17) => parseDate(date).getTime() + hour * 3.6e6;
const NOW = at(TODAY, 9);

let n = 0;
/** A completed session on `date` doing each exercise for `sets` sets. */
function done(date, items, hour = 17) {
  const id = `h${++n}`;
  const sets = [];
  for (const [exerciseId, count = 3, weight = 50, reps = 10] of items) {
    for (let i = 0; i < count; i++) sets.push({ id: `${id}-${exerciseId}-${i}`, sessionId: id, exerciseId, idx: i, kind: 'working', completed: true, weight, reps });
  }
  return { session: { id, date, status: 'completed', startedAt: at(date, hour) }, sets };
}
const fromPlan = (date, p) => done(date, p.items.map((i) => [i.exerciseId, i.sets]));
const UPPER = [['db-bench'], ['db-row'], ['lat-pulldown'], ['db-shoulder-press'], ['db-curl'], ['cable-pushdown']];
const LOWER = [['bb-back-squat'], ['bb-rdl'], ['db-bss'], ['leg-curl'], ['standing-calf-raise']];

const opts = (more = {}) => ({ prefs, today: TODAY, now: NOW, minutes: 60, profileId: 'gym', ...more });
const profile = (id) => prefs.profiles.find((p) => p.id === id);
const exs = (p) => p.items.map((i) => L.exercise(i.exerciseId));

export default function register({ describe, it, eq, ok, fresh }) {
  describe('Engine: what to train', () => {
    it('with no history, a balanced full-body session covering squat, push, hinge and pull', () => {
      const p = plan([], {}, opts());
      eq(p.focus, 'full');
      const pats = new Set(exs(p).map((e) => e.pattern));
      ok(['squat', 'lunge'].some((x) => pats.has(x)) && ['hinge', 'ballistic'].some((x) => pats.has(x)), 'lower body patterns');
      ok(['horizontalPush', 'verticalPush'].some((x) => pats.has(x)) && ['horizontalPull', 'verticalPull'].some((x) => pats.has(x)), 'upper body patterns');
      ok(/No history/.test(p.reasons[0]), p.reasons[0]);
    });
    it('upper body yesterday → lower body today, and the other way round', () => {
      const a = plan([done(addDays(TODAY, -1), UPPER)], {}, opts());
      eq(a.focus, 'lower', a.reasons[0]);
      const b = plan([done(addDays(TODAY, -1), LOWER)], {}, opts());
      eq(b.focus, 'upper', b.reasons[0]);
      ok(/yesterday/.test(b.reasons[0]), b.reasons[0]);
    });
    it('is deterministic, and regenerating gives different exercises', () => {
      const h = [done(addDays(TODAY, -2), LOWER)];
      const a = plan(h, {}, opts());
      eq(plan(h, {}, opts()).items, a.items, 'same inputs, same workout');
      const b = plan(h, {}, opts({ avoid: a.items.map((i) => i.exerciseId) }));
      const same = b.items.filter((i) => a.items.some((x) => x.exerciseId === i.exerciseId)).length;
      ok(same < a.items.length / 2, `regenerated workout should mostly differ (${same} repeated)`);
      eq(b.focus, a.focus);
    });
    it('keeps exercises you already do, so they can progress', () => {
      const h = [done(addDays(TODAY, -3), [['machine-row'], ['hack-squat']])];
      const fam = new Map([['machine-row', addDays(TODAY, -3)], ['hack-squat', addDays(TODAY, -3)]]);
      const p = plan(h, { familiar: fam }, opts({ focus: 'full', minutes: 90 }));
      ok(p.items.some((i) => i.exerciseId === 'machine-row'), 'familiar row kept');
    });
    it('remembers repeated swaps: a lift you keep replacing stops being picked', () => {
      const base = plan([], {}, opts({ focus: 'lower' }));
      const hinge = base.items.find((i) => i.slot === 'hinge').exerciseId;
      const p = plan([], { swaps: [{ from: hinge, to: 'smith-rdl', count: 2 }] }, opts({ focus: 'lower' }));
      ok(p.items.find((i) => i.slot === 'hinge').exerciseId !== hinge, `${hinge} should be swapped out`);
    });
  });

  describe('Engine: equipment', () => {
    it('never uses equipment you don’t have, for any setup, focus or time', () => {
      for (const prof of prefs.profiles) for (const focus of ['auto', 'full', 'upper', 'lower']) for (const minutes of [30, 45, 60, 90]) {
        const p = plan([], {}, opts({ profileId: prof.id, focus, minutes }));
        for (const id of [...p.items.map((i) => i.exerciseId), ...p.warmup]) {
          ok(L.isAvailable(L.exercise(id), prof.equipment), `${id} needs ${L.exercise(id).eq} (${prof.name}, ${focus}, ${minutes})`);
        }
      }
    });
    it('kettlebells only gives a real kettlebell workout', () => {
      const p = plan([], {}, opts({ profileId: 'kb', minutes: 45 }));
      const list = exs(p);
      ok(list.length >= 5, `${list.length} exercises`);
      ok(list.filter((e) => e.load === 'kettlebell').length >= list.length - 1, list.map((e) => e.id).join(', '));
      ok(list.some((e) => e.pattern === 'ballistic'), 'includes a swing, clean or snatch');
      ok(list.some((e) => ['carry', 'getUp'].includes(e.pattern)), 'includes a carry or get-up');
      ok(/Kettlebells/.test(p.title), p.title);
    });
    it('bodyweight only works, and says honestly what can’t be trained', () => {
      const p = plan([], {}, opts({ profileId: 'home', minutes: 45 }));
      ok(exs(p).every((e) => e.eq.every((q) => q === 'bodyweight')), 'bodyweight only');
      ok(p.items.length >= 4, `${p.items.length} exercises`);
      ok(p.notes.some((t) => /pull/i.test(t) && /pull-up bar|resistance bands/i.test(t)), p.notes.join(' | '));
    });
  });

  describe('Engine: recovery, soreness and pain', () => {
    it('recovery: trained muscles are less ready the next day and recover over 2–3 days', () => {
      const h = [done(TODAY, [['bb-back-squat', 4]], 7)];
      const s1 = muscleState(h, at(addDays(TODAY, 1), 7));
      const s3 = muscleState(h, at(addDays(TODAY, 3), 7));
      ok(s1.quads.readiness < 0.7, `next day ${s1.quads.readiness}`);
      ok(s3.quads.readiness === 1, `three days later ${s3.quads.readiness}`);
      eq(s1.chest.readiness, 1, 'untrained muscles unaffected');
    });
    it('sore legs: no leg-focused session and no exercises aimed at the sore muscles', () => {
      const p = plan([], {}, opts({ checkin: { sore: ['legs', 'hips'], pain: [] } }));
      ok(p.focus !== 'lower', p.focus);
      ok(exs(p).every((e) => !e.primary.some((m) => ['quads', 'hamstrings', 'glutes', 'calves', 'adductors'].includes(m))), exs(p).map((e) => e.id).join(', '));
      ok(p.reasons.some((r) => /Sore/.test(r)));
    });
    it('knee pain: nothing that loads the knees, and a clear don’t-train-through-pain note', () => {
      const p = plan([], {}, opts({ focus: 'lower', checkin: { sore: [], pain: ['knees'] } }));
      ok(exs(p).every((e) => !e.stress.includes('knees') && !['squat', 'lunge'].includes(e.pattern)), exs(p).map((e) => e.id).join(', '));
      ok(p.items.length >= 3, 'still a real workout (hinges, hamstrings, core)');
      ok(p.notes.some((t) => /avoids your reported pain/.test(t)), p.notes.join(' | '));
      ok(p.reasons.some((r) => /Don’t train through pain/.test(r)));
    });
    it('shoulder pain: no pressing overhead or shoulder-stressing lifts, warm-up included', () => {
      const p = plan([], {}, opts({ focus: 'upper', checkin: { sore: [], pain: ['shoulders'] } }));
      ok([...exs(p), ...p.warmup.map(L.exercise)].every((e) => !e.stress.includes('shoulders') && !e.primary.some((m) => /Delts/.test(m))), exs(p).map((e) => e.id).join(', '));
    });
  });

  describe('Engine: time', () => {
    it('30 minutes fits in about 30 minutes; 90 gets more work than 45', () => {
      const p30 = plan([], {}, opts({ minutes: 30 }));
      const p45 = plan([], {}, opts({ minutes: 45 }));
      const p90 = plan([], {}, opts({ minutes: 90 }));
      ok(p30.estimateMin <= 33, `30 → ${p30.estimateMin}`);
      ok(p45.estimateMin <= 48, `45 → ${p45.estimateMin}`);
      const sets = (p) => p.items.reduce((a, i) => a + i.sets, 0);
      ok(sets(p90) > sets(p45) && sets(p45) > sets(p30), `${sets(p30)} < ${sets(p45)} < ${sets(p90)}`);
      ok(p30.items.length >= 4, 'the main lifts are kept even when short');
    });
    it('is honest when the essentials need more time than you have', () => {
      const p = plan([], {}, opts({ minutes: 15 }));
      ok(p.overBudget, `estimate ${p.estimateMin}`);
      ok(p.reasons.some((r) => /needs about \d+ min/.test(r)), p.reasons.join(' | '));
    });
    it('duration estimates are realistic', () => {
      const m = entrySeconds(L.exercise('bb-back-squat'), 3) / 60;
      ok(m > 6 && m < 11, `squat 3 sets ≈ ${m.toFixed(1)} min`);
      const c = entrySeconds(L.exercise('db-curl'), 3) / 60;
      ok(c > 3.5 && c < 7, `curl 3 sets ≈ ${c.toFixed(1)} min`);
    });
  });

  describe('Engine: missed days and weeks', () => {
    it('several missed days: train today, full body, no penalty or catch-up volume', () => {
      const h = [done(addDays(TODAY, -5), UPPER)];
      const when = nextSession(h, { today: TODAY, now: NOW, prefs });
      eq(when.days, 0);
      const p = plan(h, {}, opts());
      eq(p.focus, 'full');
      ok(p.items.every((i) => i.sets <= 4), 'no extra sets to “make up” for missed days');
    });
    it('a week away: full body, one fewer set on the main lifts, and no weight increases', () => {
      const h = [done(addDays(TODAY, -9), LOWER)];
      const p = plan(h, {}, opts());
      eq(p.focus, 'full');
      ok(p.reasons.some((r) => /ease back in/.test(r)), p.reasons.join(' | '));
      ok(exs(p).filter((e) => e.cat === 'compound').every((e) => p.items.find((i) => i.exerciseId === e.id).sets === 2));
      const t = nextTarget(L.exercise('db-bench'), L.prescription(L.exercise('db-bench')), [{ date: addDays(TODAY, -16), sets: [{ idx: 0, weight: 50, reps: 10 }, { idx: 1, weight: 50, reps: 10 }, { idx: 2, weight: 50, reps: 10 }] }], prefs, TODAY);
      eq([t.decision, t.weight], ['hold', 50], t.reason);
    });
    it('two workouts in a week: today is recommended and not a bonus', () => {
      const h = [done(addDays(TODAY, -5), UPPER), done(addDays(TODAY, -3), LOWER)];
      const w = nextSession(h, { today: TODAY, now: NOW, prefs });
      eq([w.days, w.optional], [0, false]);
    });
    it('four in the last week: still allowed, but marked as a bonus', () => {
      const h = [-6, -5, -3, -2].map((d, i) => done(addDays(TODAY, d), i % 2 ? LOWER : UPPER));
      const w = nextSession(h, { today: TODAY, now: NOW, prefs });
      ok(w.optional, w.reason);
    });
    it('three days in a row: suggests a rest day', () => {
      const h = [-3, -2, -1].map((d, i) => done(addDays(TODAY, d), i % 2 ? LOWER : UPPER));
      const w = nextSession(h, { today: TODAY, now: NOW, prefs });
      eq(w.days, 1, w.reason);
    });
    it('trained upper today: tomorrow is fine for a different focus', () => {
      const h = [done(TODAY, UPPER, 7)];
      const w = nextSession(h, { today: TODAY, now: at(TODAY, 10), prefs });
      eq(w.days, 1, w.reason);
    });
    it('following the recommendations for two weeks gives about 4 sessions a week, each muscle at least twice', () => {
      const h = [];
      let day = '2026-11-02';
      const start = day;
      for (let i = 0; i < 14; i++, day = addDays(day, 1)) {
        const w = nextSession(h, { today: day, now: at(day, 8), prefs });
        if (w.days !== 0 || w.optional) continue;
        const p = plan(h, {}, { prefs, today: day, now: at(day, 8), minutes: 60, profileId: 'gym' });
        h.push(fromPlan(day, p));
      }
      const count = h.length;
      ok(count >= 6 && count <= 10, `${count} sessions in 2 weeks`);
      const second = h.filter((x) => x.session.date >= addDays(start, 7));
      for (const m of ['chest', 'lats', 'quads', 'hamstrings', 'glutes']) {
        const hits = second.filter((x) => x.sets.some((s) => L.exercise(s.exerciseId).primary.includes(m))).length;
        ok(hits >= 2, `${m} trained ${hits}× in week 2`);
      }
    });
  });

  describe('Progression: adaptive (double progression)', () => {
    const bench = L.exercise('db-bench'); // 6–10 reps
    const rx = L.prescription(bench);
    const s = (...reps) => reps.map((r, i) => ({ idx: i, weight: 50, reps: r }));
    const day = (d, sets) => ({ date: addDays(TODAY, d), sets });
    it('a new exercise gets no weight at all', () => {
      const t = nextTarget(bench, rx, [], prefs, TODAY);
      eq([t.decision, t.weight], ['new', null]);
    });
    it('top of the range on every set → one step heavier', () => {
      const t = nextTarget(bench, rx, [day(-3, s(10, 10, 10))], prefs, TODAY);
      eq([t.decision, t.weight], ['increase', 55], t.reason);
    });
    it('inside the range → same weight, beat the reps', () => {
      const t = nextTarget(bench, rx, [day(-3, s(10, 9, 8))], prefs, TODAY);
      eq([t.decision, t.weight], ['hold', 50], t.reason);
    });
    it('fewer reps than expected once → hold; twice in a row → one step lighter', () => {
      const once = nextTarget(bench, rx, [day(-3, s(5, 5, 4))], prefs, TODAY);
      eq([once.decision, once.weight], ['hold', 50], once.reason);
      const twice = nextTarget(bench, rx, [day(-3, s(5, 5, 4)), day(-6, s(6, 5, 5))], prefs, TODAY);
      eq([twice.decision, twice.weight], ['decrease', 45], twice.reason);
    });
    it('uses your gym’s increments', () => {
      const t = nextTarget(bench, rx, [day(-3, s(10, 10, 10))], { ...prefs, increments: { ...prefs.increments, dumbbell: 2.5 } }, TODAY);
      eq(t.weight, 52.5);
    });
    it('kettlebells: a big jump to the next bell needs two sessions at the top', () => {
      const kb = L.exercise('kb-goblet-squat');
      const krx = L.prescription(kb);
      const top = krx.reps[1];
      const sets = [0, 1, 2].map((i) => ({ idx: i, weight: 35, reps: top }));
      const once = nextTarget(kb, krx, [day(-3, sets)], prefs, TODAY);
      eq([once.decision, once.weight], ['hold', 35], once.reason);
      const twice = nextTarget(kb, krx, [day(-3, sets), day(-6, sets)], prefs, TODAY);
      eq([twice.decision, twice.weight], ['increase', 44], twice.reason);
    });
    it('a long break: hold after 2+ weeks, one step lighter after 6+ weeks', () => {
      eq(nextTarget(bench, rx, [day(-20, s(10, 10, 10))], prefs, TODAY).decision, 'hold');
      const t = nextTarget(bench, rx, [day(-50, s(10, 10, 10))], prefs, TODAY);
      eq([t.decision, t.weight], ['decrease', 45]);
    });
    it('timed holds: all sets at the top → harder version, not a made-up weight', () => {
      const plank = L.exercise('plank');
      const prx = L.prescription(plank);
      const t = nextTarget(plank, prx, [day(-2, [0, 1, 2].map((i) => ({ idx: i, weight: 0, seconds: prx.seconds[1] })))], prefs, TODAY);
      eq(t.decision, 'reps');
    });
  });

  describe('Progression: your 15 / 12 / max', () => {
    const curl = L.exercise('db-curl');
    const rx = L.prescription(curl, 'classic');
    const last = (a, b, c) => [{ date: addDays(TODAY, -3), sets: [a, b, c].map((r, i) => ({ idx: i, weight: 30, reps: r })) }];
    const t = (a, b, c) => nextTarget(curl, rx, last(a, b, c), prefs, TODAY);
    it('uses 15 / 12 / max on suitable exercises but never on heavy barbell lifts', () => {
      eq(rx.setReps, [15, 12, 'max']);
      eq(L.prescription(L.exercise('bb-back-squat'), 'classic').style, 'adaptive');
    });
    it('last set under 10 → drop 5 lb', () => eq([t(15, 12, 8).decision, t(15, 12, 8).weight], ['decrease', 25]));
    it('last set 10–15 → same weight', () => eq([t(15, 12, 13).decision, t(15, 12, 13).weight], ['hold', 30]));
    it('last set 15–20 → add 5 lb', () => eq([t(15, 12, 17).decision, t(15, 12, 17).weight], ['increase', 35]));
    it('over 20 → add weight', () => { const r = t(15, 12, 23); eq([r.decision, r.weight], ['increase', 35]); ok(/over 20/.test(r.reason)); });
    it('no increase unless the first two sets hit 15 and 12 (conservative check)', () => eq(t(13, 12, 18).decision, 'hold'));
  });

  describe('Progression in the workout', () => {
    it('hitting the target pre-fills the heavier weight and says why; reps stay blank; warm-ups don’t count', async () => {
      await fresh();
      const s = await W.startSession({ exerciseIds: ['db-bench'], prefs, now: at('2026-11-16') });
      const e = s.entries[0];
      const warm = await W.addSet(s.id, e.id, { kind: 'warmup' });
      await W.updateSet(warm.id, { weight: 80, reps: 3, completed: true }); // a heavy warm-up must not count
      for (const set of (await W.setsByEntry(s.id)).get(e.id).filter((x) => x.kind === 'working')) await W.updateSet(set.id, { weight: 50, reps: 10, completed: true });
      await W.finishSession(s.id, { now: at('2026-11-16') + 3e6 });
      const next = await W.startSession({ exerciseIds: ['db-bench'], prefs, now: at('2026-11-18') });
      const entry = next.entries[0];
      eq(entry.progress.decision, 'increase', entry.progress.reason);
      const planned = (await W.setsByEntry(next.id)).get(entry.id);
      eq(planned.map((x) => x.weight), [55, 55, 55]);
      eq(planned.map((x) => x.reps), [null, null, null]);
    });
    it('starting a planned workout adds ramp-up sets to the first lift (excluded from progress)', async () => {
      await fresh();
      const s0 = await W.startSession({ exerciseIds: ['bb-back-squat'], prefs, now: at('2026-11-16') });
      for (const set of (await W.setsByEntry(s0.id)).get(s0.entries[0].id)) await W.updateSet(set.id, { weight: 135, reps: 8, completed: true });
      await W.finishSession(s0.id, { now: at('2026-11-16') + 3e6 });
      const p = { ...plan([], {}, opts({ focus: 'lower' })), items: [{ exerciseId: 'bb-back-squat', slot: 'squat', sets: 3 }], ramp: true };
      const s = await Engine.startPlan(p, { prefs, now: at('2026-11-19') });
      const sets = (await W.setsByEntry(s.id)).get(s.entries[0].id);
      eq(sets.filter((x) => x.kind === 'warmup').map((x) => x.weight), [65, 100]);
      eq(s.plan.generatedBy, 'engine');
    });
    it('regenerating after switching to kettlebells replaces only untouched exercises', async () => {
      await fresh();
      const p = plan([], {}, opts({ focus: 'full', minutes: 45 }));
      const s = await Engine.startPlan(p, { prefs, now: Date.now() - 10 * 60000 });
      const first = s.entries.sort((a, b) => a.order - b.order)[0];
      const set = (await W.setsByEntry(s.id)).get(first.id).find((x) => x.kind === 'working');
      await W.updateSet(set.id, { weight: 50, reps: 8, completed: true });
      const r = await Engine.regenerateRemaining(s.id, { prefs, profileId: 'kb', minutes: 45, vary: false });
      const ids = r.session.entries.map((e) => e.exerciseId);
      ok(ids.includes(first.exerciseId), 'started exercise kept');
      const rest = r.session.entries.filter((e) => e.id !== first.id).map((e) => L.exercise(e.exerciseId));
      ok(rest.length >= 3, `${rest.length} new exercises`);
      ok(rest.every((e) => L.isAvailable(e, profile('kb').equipment)), rest.map((e) => e.id).join(', '));
      eq((await W.setsByEntry(s.id)).get(first.id).filter((x) => x.completed).length, 1, 'logged set kept');
    });
    it('weight steps: gym increments and owned kettlebell sizes', () => {
      eq(stepWeight({ load: 'kettlebell' }, 44, 1, { ...prefs, kettlebellSizes: [26, 35, 53] }), 53);
    });
  });
}
