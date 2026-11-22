// Find exercises, check equipment, work out prescriptions and alternatives.
// Pure functions over the library: the engine (Phase 4) builds on these.
import { EXERCISES } from './exercises.js';
import { CATEGORY_RX, CLASSIC_RX } from './programming.js';

const builtIn = new Map(EXERCISES.map((e) => [e.id, e]));
let custom = new Map();
let overrides = new Map();

export const setCustom = (list) => { custom = new Map(list.map((e) => [e.id, e])); };
export const setOverrides = (list) => { overrides = new Map(list.map((o) => [o.exerciseId, o])); };
export const override = (id) => overrides.get(id) || null;

export const exercise = (id) => custom.get(id) || builtIn.get(id) || null;

/** Display name; an unknown id (e.g. a removed exercise) still shows something readable. */
export const exerciseName = (id) =>
  exercise(id)?.name || String(id).replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

export const allExercises = ({ includeHidden = true } = {}) =>
  [...builtIn.values(), ...custom.values()].filter((e) => includeHidden || !overrides.get(e.id)?.hidden);

/** True when every piece of equipment the exercise needs is in `available` (bodyweight is always available). */
export function isAvailable(ex, available) {
  const have = available instanceof Set ? available : new Set(available);
  return ex.eq.every((e) => e === 'bodyweight' || have.has(e));
}

const RX_CATS_FOR_CLASSIC = new Set(['compound', 'accessory', 'isolation']);

/**
 * What a normal session of this exercise looks like.
 * style: 'adaptive' (exercise-specific) or 'classic' (15 / 12 / max).
 */
export function prescription(ex, style = 'adaptive') {
  const base = CATEGORY_RX[ex.cat];
  const rx = {
    style: 'adaptive',
    sets: ex.sets || base.sets,
    reps: ex.measure === 'time' ? null : (ex.reps || base.reps),
    seconds: ex.measure === 'time' ? (ex.seconds || base.seconds || [30, 45]) : null,
    rir: ex.rir || base.rir || null,
    restSec: ex.restSec ?? base.restSec,
    amrapLast: !ex.heavy && !!base.amrapLast,
  };
  const classicOk = style === 'classic' && RX_CATS_FOR_CLASSIC.has(ex.cat) && ex.measure === 'reps'
    && !(CLASSIC_RX.excludeHeavy && ex.heavy) && !ex.reps; // exercises with their own range (e.g. get-ups) keep it
  if (classicOk) Object.assign(rx, { style: 'classic', sets: CLASSIC_RX.sets, setReps: CLASSIC_RX.setReps, rir: null, amrapLast: true });
  return rx;
}

export function describeRx(rx, ex) {
  const per = ex.uni ? ' per side' : '';
  if (rx.setReps) return `${rx.setReps.map((r) => (r === 'max' ? 'max' : r)).join(' / ')} reps${per}`;
  if (rx.seconds) return `${rx.sets} × ${rx.seconds[0]}–${rx.seconds[1]} s${per}`;
  const [a, b] = rx.reps;
  return `${rx.sets} × ${a === b ? a : `${a}–${b}`} reps${per}`;
}

export function describeEffort(rx, ex) {
  if (ex.cat === 'mobility') return 'Easy and controlled. Move within a comfortable range.';
  if (ex.cat === 'power') return 'Stop well before you slow down. Every rep fast and crisp.';
  if (ex.cat === 'carry') return 'Heavy enough that the last few seconds are hard. Posture never breaks.';
  if (rx.setReps) return 'Last set: as many reps as you can with good form.';
  if (!rx.rir) return '';
  const [lo, hi] = rx.rir;
  if (lo === 0) return `Leave ${hi === 1 ? '0–1 rep' : `0–${hi} reps`} in the tank. The last set can go to failure with good form.`;
  return `Stop ${lo}–${hi} reps before failure. Never grind out ugly reps.`;
}

/**
 * Exercises that could stand in for `ex`, best first. Only same-pattern exercises
 * qualify, so "trains the same muscle" alone is never enough.
 * options.available: equipment list/set to restrict to.
 */
export function alternatives(ex, { available = null, limit = 6 } = {}) {
  const explicit = new Set(ex.alt || []);
  const out = [];
  for (const c of allExercises({ includeHidden: false })) {
    if (c.id === ex.id) continue;
    if (c.pattern !== ex.pattern && !explicit.has(c.id)) continue;
    if (c.cat === 'mobility' && ex.cat !== 'mobility') continue;
    if (available && !isAvailable(c, available)) continue;
    let s = explicit.has(c.id) ? 3 : 0;
    s += 2 * c.primary.filter((m) => ex.primary.includes(m)).length;
    s += 0.5 * c.secondary.filter((m) => ex.secondary.includes(m) || ex.primary.includes(m)).length;
    if (c.cat === ex.cat) s += 1;
    if (c.uni === ex.uni) s += 0.3;
    s -= 0.5 * Math.abs((c.diff || 1) - (ex.diff || 1));
    if (s > 1) out.push({ ex: c, score: s });
  }
  return out.sort((a, b) => b.score - a.score || a.ex.name.localeCompare(b.ex.name)).slice(0, limit).map((x) => x.ex);
}
