// Exercise library checks: data integrity, strict equipment, coverage per setup, prescriptions.
import { EXERCISES } from '../js/data/exercises.js';
import { MUSCLES, PATTERNS, EQUIPMENT, CATEGORIES, REGIONS, MOBILITY_AREAS, LOAD_TYPES, DEFAULT_PROFILES } from '../js/data/taxonomy.js';
import { CATEGORY_RX } from '../js/data/programming.js';
import { SOURCES } from '../js/data/sources.js';
import { RULES } from '../js/data/programming.js';
import * as L from '../js/data/lookup.js';

export default function register({ describe, it, eq, ok }) {
  const byId = new Map(EXERCISES.map((e) => [e.id, e]));
  const profile = (id) => DEFAULT_PROFILES.find((p) => p.id === id);
  const availableIn = (id) => EXERCISES.filter((e) => L.isAvailable(e, profile(id).equipment));
  const patternsWith = (list, filter = () => true) => new Set(list.filter(filter).map((e) => e.pattern));

  describe('Library: data integrity', () => {
    it('has a substantial library with unique ids', () => {
      ok(EXERCISES.length >= 120, `only ${EXERCISES.length} exercises`);
      eq(byId.size, EXERCISES.length, 'duplicate ids');
    });
    it('every field points at a real muscle, pattern, category, equipment item and body area', () => {
      const bad = [];
      for (const e of EXERCISES) {
        if (!CATEGORIES[e.cat]) bad.push(`${e.id}: cat ${e.cat}`);
        if (!PATTERNS[e.pattern]) bad.push(`${e.id}: pattern ${e.pattern}`);
        if (!LOAD_TYPES[e.load]) bad.push(`${e.id}: load ${e.load}`);
        if (!e.eq.length) bad.push(`${e.id}: no equipment listed`);
        for (const x of e.eq) if (!EQUIPMENT[x]) bad.push(`${e.id}: eq ${x}`);
        if (!e.primary.length) bad.push(`${e.id}: no primary muscle`);
        for (const m of [...e.primary, ...e.secondary]) if (!MUSCLES[m]) bad.push(`${e.id}: muscle ${m}`);
        for (const r of e.stress) if (!REGIONS[r]) bad.push(`${e.id}: stress ${r}`);
        for (const a of e.area || []) if (!MOBILITY_AREAS[a]) bad.push(`${e.id}: area ${a}`);
        for (const a of e.alt) if (!byId.has(a)) bad.push(`${e.id}: alt ${a} missing`);
        if (e.cues.length < 3) bad.push(`${e.id}: fewer than 3 cues`);
        if (e.reps && e.reps[0] > e.reps[1]) bad.push(`${e.id}: reps range reversed`);
        if (e.measure === 'time' && !(e.seconds || CATEGORY_RX[e.cat].seconds)) bad.push(`${e.id}: timed but no seconds`);
        if (e.load === 'kettlebell' && !e.eq.includes('kettlebell')) bad.push(`${e.id}: kettlebell load without kettlebell`);
      }
      eq(bad, []);
    });
    it('every muscle group is the main target of at least 3 exercises', () => {
      const thin = Object.keys(MUSCLES).filter((m) => EXERCISES.filter((e) => e.primary.includes(m)).length < 3);
      eq(thin, []);
    });
    it('every programming rule cites only sources that exist, and labels its certainty', () => {
      for (const r of RULES) {
        ok(['guideline', 'estimate', 'preference'].includes(r.basis), `${r.id} basis`);
        for (const s of r.sources) ok(SOURCES[s], `${r.id} cites unknown ${s}`);
      }
    });
  });

  describe('Library: strict equipment', () => {
    it('an exercise is only available when every piece it needs is there', () => {
      ok(!L.isAvailable(byId.get('bb-bench'), ['barbell', 'bench']), 'bench press needs a rack too');
      ok(L.isAvailable(byId.get('bb-bench'), ['barbell', 'bench', 'rack']));
      ok(L.isAvailable(byId.get('push-up'), []), 'bodyweight is always available');
      ok(!L.isAvailable(byId.get('pull-up'), ['bodyweight']), 'pull-ups need a bar');
    });
    it('each starting setup only ever offers equipment it has', () => {
      for (const p of DEFAULT_PROFILES) {
        for (const e of availableIn(p.id)) {
          for (const x of e.eq) ok(x === 'bodyweight' || p.equipment.includes(x), `${p.name} offered ${e.name} (needs ${x})`);
        }
      }
    });
    it('alternatives respect equipment and never change the movement pattern on their own', () => {
      for (const e of EXERCISES) {
        for (const a of L.alternatives(e, { available: ['kettlebell', 'bodyweight'] })) {
          ok(L.isAvailable(a, ['kettlebell', 'bodyweight']), `${a.id} offered without equipment`);
        }
        for (const a of L.alternatives(e)) ok(a.pattern === e.pattern || e.alt.includes(a.id), `${e.id} → ${a.id} changes pattern`);
      }
    });
    it('a Smith-machine-only gym gets Smith alternatives for barbell deadlifts and squats', () => {
      const smith = ['smith', 'bodyweight'];
      ok(L.alternatives(byId.get('bb-rdl'), { available: smith }).some((a) => a.id === 'smith-rdl'));
      ok(L.alternatives(byId.get('bb-back-squat'), { available: smith }).some((a) => a.id === 'smith-squat'));
    });
  });

  describe('Library: every setup can build a real workout', () => {
    it('kettlebells only: genuine kettlebell movements for every major pattern', () => {
      const kb = availableIn('kb').filter((e) => e.load === 'kettlebell');
      ok(kb.length >= 25, `only ${kb.length} kettlebell exercises`);
      const have = patternsWith(kb);
      for (const p of ['squat', 'hinge', 'ballistic', 'lunge', 'verticalPush', 'horizontalPush', 'horizontalPull', 'carry', 'getUp', 'rotation']) ok(have.has(p), `kettlebell ${p} missing`);
      for (const id of ['kb-swing', 'kb-goblet-squat', 'kb-clean', 'tgu', 'farmer-carry-kb', 'kb-press']) ok(kb.some((e) => e.id === id), `${id} missing`);
    });
    it('dumbbells + bench: push, pull, legs and arms', () => {
      const have = patternsWith(availableIn('db'), (e) => e.load === 'dumbbell');
      for (const p of ['horizontalPush', 'verticalPush', 'horizontalPull', 'squat', 'hinge', 'lunge', 'elbowFlexion', 'elbowExtension', 'shoulderIso', 'carry']) ok(have.has(p), `dumbbell ${p} missing`);
    });
    it('bodyweight only: legs, pushing, core and mobility, with no pulling (a known gap the planner must explain)', () => {
      const have = patternsWith(availableIn('home'));
      for (const p of ['squat', 'lunge', 'hinge', 'horizontalPush', 'verticalPush', 'antiExtension', 'rotation', 'mobility']) ok(have.has(p), `bodyweight ${p} missing`);
      ok(!have.has('verticalPull') && !have.has('horizontalPull'), 'expected no pulling without equipment');
    });
    it('full gym: at least 3 choices for every strength pattern', () => {
      const list = availableIn('gym');
      for (const p of Object.keys(PATTERNS)) {
        const n = list.filter((e) => e.pattern === p).length;
        ok(n >= (p === 'getUp' ? 2 : 3), `${p}: only ${n}`);
      }
    });
    it('short warm-up options exist for lower, upper and full-body days with no equipment', () => {
      for (const w of ['lower', 'upper', 'full']) {
        const n = EXERCISES.filter((e) => (e.warmup || []).includes(w) && L.isAvailable(e, [])).length;
        ok(n >= 3, `${w}: only ${n}`);
      }
    });
  });

  describe('Library: prescriptions', () => {
    it('heavy barbell lifts keep conservative ranges even in 15 / 12 / max mode', () => {
      for (const e of EXERCISES.filter((x) => x.heavy)) {
        const rx = L.prescription(e, 'classic');
        eq(rx.style, 'adaptive', e.id);
        ok(!rx.amrapLast, `${e.id} must not be max-rep`);
        ok(rx.rir[0] >= 1, `${e.id} must stop short of failure`);
      }
      eq(L.prescription(byId.get('bb-deadlift')).reps, [3, 6]);
    });
    it('the 15 / 12 / max scheme applies to dumbbell, machine and isolation work', () => {
      eq(L.prescription(byId.get('db-bench'), 'classic').setReps, [15, 12, 'max']);
      eq(L.prescription(byId.get('db-curl'), 'classic').setReps, [15, 12, 'max']);
      eq(L.prescription(byId.get('db-curl'), 'adaptive').reps, [10, 15]);
    });
    it('power, carry, core-hold and mobility work never become max-rep sets', () => {
      for (const id of ['kb-swing', 'farmer-carry-kb', 'plank', 'worlds-greatest-stretch', 'tgu']) {
        const rx = L.prescription(byId.get(id), 'classic');
        ok(!rx.setReps, id);
      }
      eq(L.prescription(byId.get('plank')).seconds, [30, 60]);
    });
    it('describes prescriptions in plain words', () => {
      eq(L.describeRx(L.prescription(byId.get('db-row')), byId.get('db-row')), '3 × 6–10 reps per side');
      eq(L.describeRx(L.prescription(byId.get('db-curl'), 'classic'), byId.get('db-curl')), '15 / 12 / max reps');
    });
  });
}
