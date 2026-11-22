// Progressive overload: what weight to use next time, and why. Pure functions.
//
// Adaptive (default): double progression (NSCA Essentials; RULES.doubleProgression).
//   Add reps inside the range first; add one weight step only after every working set
//   reaches the top. Big jumps (e.g. the next kettlebell is 25% heavier) need two sessions
//   at the top first. Two sessions in a row under the range: one step down.
// Classic: your 15 / 12 / max rules, judged on the last set (your preference), plus one
//   conservative check: no increase unless the first two sets hit 15 and 12.
// Either way: at most one step per session, never an increase after a long break,
// and nothing is ever guessed for an exercise you haven't logged.
import { daysBetween } from '../util.js';

export const LONG_BREAK_DAYS = 14;   // estimate: hold the weight after this long away
export const VERY_LONG_BREAK_DAYS = 42; // estimate: one step lighter after this long
export const BIG_JUMP = 0.15;        // a jump of more than 15% needs confirming twice

/** Next weight up (dir 1) or down (dir -1), using your gym's jumps or the kettlebell sizes you own. */
export function stepWeight(ex, weight, dir, prefs) {
  const w = Number(weight) || 0;
  if (ex.load === 'kettlebell') {
    const sizes = [...prefs.kettlebellSizes].sort((a, b) => a - b);
    if (dir > 0) return sizes.find((s) => s > w) ?? sizes[sizes.length - 1];
    return [...sizes].reverse().find((s) => s < w) ?? sizes[0];
  }
  const inc = prefs.increments[ex.load] ?? 5;
  return Math.max(0, Math.round((w + dir * inc) * 100) / 100);
}

const mode = (list) => {
  const c = new Map();
  for (const x of list) c.set(x, (c.get(x) || 0) + 1);
  return [...c.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0]?.[0];
};

/** The weight used for most working sets (ties: the heavier). */
export const workingWeight = (sets) => mode(sets.map((s) => Number(s.weight) || 0));

const fmtW = (w) => `${w} lb`;

/**
 * history: [{ date, sets: [{ weight, reps, seconds, idx }] }] completed working sets, newest first.
 * rx: prescription (lookup.prescription). today: YYYY-MM-DD.
 * Returns { decision, weight, prevWeight, reason, rule } where decision is
 * 'new' | 'increase' | 'hold' | 'decrease' | 'reps'.
 */
export function nextTarget(ex, rx, history, prefs, today) {
  const last = history[0];
  if (!last || !last.sets.length) {
    return { decision: 'new', weight: null, prevWeight: null, rule: 'new',
      reason: 'First time: start light and find your level. Nothing is assumed.' };
  }
  const w = workingWeight(last.sets);
  const loaded = ex.load !== 'bodyweight' || w > 0;
  const gap = daysBetween(last.date, today);
  const base = { prevWeight: w, weight: w };

  if (gap > VERY_LONG_BREAK_DAYS && loaded && w > 0) {
    const down = stepWeight(ex, w, -1, prefs);
    return { ...base, decision: 'decrease', weight: down, rule: 'break',
      reason: `${Math.round(gap / 7)} weeks since last time: start one step lighter (${fmtW(down)}) and build back.` };
  }
  if (gap > LONG_BREAK_DAYS) {
    return { ...base, decision: 'hold', rule: 'break',
      reason: `${gap} days since last time: same weight as before. No increase until you’ve re-tested it.` };
  }

  if (ex.measure === 'time') return timed(ex, rx, last, base, prefs);
  if (rx.style === 'classic' && rx.setReps) return classic(ex, last, base, prefs);
  return adaptive(ex, rx, history, base, prefs);
}

function timed(ex, rx, last, base, prefs) {
  const [, hi] = rx.seconds;
  const allTop = last.sets.every((s) => (s.seconds || 0) >= hi);
  if (!allTop) return { ...base, decision: 'hold', rule: 'time', reason: `Same as last time; aim for ${hi} s on every set.` };
  if (ex.load !== 'bodyweight' && base.prevWeight > 0) {
    const up = stepWeight(ex, base.prevWeight, 1, prefs);
    if (up > base.prevWeight) return { ...base, decision: 'increase', weight: up, rule: 'time', reason: `You held ${hi} s on every set: go up to ${fmtW(up)}.` };
  }
  return { ...base, decision: 'reps', rule: 'time', reason: `You held ${hi} s on every set: try a harder version or hold a little longer.` };
}

function adaptive(ex, rx, history, base, prefs) {
  const [lo, hi] = rx.reps;
  const at = (h, w) => h.sets.filter((s) => (Number(s.weight) || 0) === w);
  const last = history[0];
  const w = base.prevWeight;
  const sets = at(last, w);
  const minSets = Math.min(rx.sets, 2);
  const topped = (h) => { const s = at(h, w); return s.length >= minSets && s.every((x) => (x.reps || 0) >= hi); };
  const under = (h) => { const s = at(h, w); return s.length > 0 && s.filter((x) => (x.reps || 0) < lo).length * 2 >= s.length; };

  if (topped(last)) {
    if (ex.load === 'bodyweight' && !w) {
      return { ...base, decision: 'reps', rule: 'double',
        reason: `${hi}+ reps on every set: add a few reps, slow the lowering, or move to a harder version.` };
    }
    const up = stepWeight(ex, w, 1, prefs);
    if (up <= w) return { ...base, decision: 'reps', rule: 'double', reason: `Top of the range at your heaviest option: add reps or a set.` };
    const big = w > 0 && (up - w) / w > BIG_JUMP;
    if (big && !(history[1] && topped(history[1]))) {
      return { ...base, decision: 'hold', rule: 'double',
        reason: `You hit ${hi} on every set. ${fmtW(up)} is a big jump, so hit the top once more before moving up.` };
    }
    return { ...base, decision: 'increase', weight: up, rule: 'double',
      reason: `You hit ${hi} reps on every set last time: up to ${fmtW(up)}, aim for ${lo}+ reps.` };
  }
  if (under(last)) {
    if (history[1] && under(history[1]) && w > 0) {
      const down = stepWeight(ex, w, -1, prefs);
      return { ...base, decision: 'decrease', weight: down, rule: 'double',
        reason: `Under ${lo} reps two workouts running: drop to ${fmtW(down)} and build back up.` };
    }
    return { ...base, decision: 'hold', rule: 'double',
      reason: `Fewer reps than the ${lo}–${hi} target last time. Same weight; aim for ${lo} on each set.` };
  }
  const best = Math.max(...sets.map((s) => s.reps || 0));
  return { ...base, decision: 'hold', rule: 'double',
    reason: `Same weight; beat last time’s reps (best ${best}). Weight goes up once every set reaches ${hi}.` };
}

function classic(ex, last, base, prefs) {
  const sorted = last.sets.slice().sort((a, b) => a.idx - b.idx);
  const final = sorted[sorted.length - 1];
  const r = final?.reps || 0;
  const w = base.prevWeight;
  const firstOk = (sorted[0]?.reps || 0) >= 15 && (sorted.length < 3 || (sorted[1]?.reps || 0) >= 12);
  const bw = ex.load === 'bodyweight' && !w;
  if (r < 10) {
    if (bw || !w) return { ...base, decision: 'hold', rule: 'classic', reason: `${r} on the last set (under 10). Same again, or an easier version.` };
    const down = stepWeight(ex, w, -1, prefs);
    return { ...base, decision: 'decrease', weight: down, rule: 'classic', reason: `${r} reps on the last set (under 10): drop to ${fmtW(down)}.` };
  }
  if (r <= 15) return { ...base, decision: 'hold', rule: 'classic', reason: `${r} reps on the last set (10–15): same weight.` };
  if (!firstOk) return { ...base, decision: 'hold', rule: 'classic', reason: `${r} on the last set, but the first sets missed 15 / 12. Same weight until they’re there.` };
  if (bw) return { ...base, decision: 'reps', rule: 'classic', reason: `${r} on the last set: add weight or move to a harder version.` };
  const up = stepWeight(ex, w, 1, prefs);
  if (up <= w) return { ...base, decision: 'reps', rule: 'classic', reason: `${r} on the last set at your heaviest option: add reps or a set.` };
  return { ...base, decision: 'increase', weight: up, rule: 'classic',
    reason: r > 20 ? `${r} reps on the last set (over 20): up to ${fmtW(up)}. If it felt easy, go a step more.` : `${r} reps on the last set (15–20): up to ${fmtW(up)}.` };
}
