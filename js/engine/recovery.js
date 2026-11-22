// Recovery and training-need estimates per muscle, from what you actually logged.
// Pure functions: history in, numbers out. No randomness.
//
// Basis: ESTIMATE. Recovery windows (48–72 h, longer for big muscles and bigger sessions)
// are a reasonable reading of the literature, not a measured fact about you. Your check-in
// (sore / pain) always overrides them. See RULES.recovery and RULES.weeklySets.
import { MUSCLES } from '../data/taxonomy.js';
import * as L from '../data/lookup.js';

/** Hours a muscle typically needs after a normal session, by size (estimate). */
export const RECOVERY_HOURS = { large: 72, medium: 60, small: 48 };
/** Weekly hard sets per muscle we aim for (low end of the 10–20 working range). */
export const WEEKLY_SET_TARGET = 10;
export const WEEKLY_SET_CAP = 20;

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

/**
 * Hard sets per muscle for one session's completed working sets.
 * Primary muscles count 1 per set, secondary 0.5. Warm-ups and mobility never count.
 */
export function setsPerMuscle(sets) {
  const out = {};
  for (const s of sets) {
    if (!s.completed || s.kind !== 'working') continue;
    const ex = L.exercise(s.exerciseId);
    if (!ex || ex.cat === 'mobility') continue;
    for (const m of ex.primary) out[m] = (out[m] || 0) + 1;
    for (const m of ex.secondary) out[m] = (out[m] || 0) + 0.5;
  }
  return out;
}

/**
 * Per-muscle state at time `now`.
 * history: [{ session, sets }] completed sessions (any order).
 * checkin: { sore: [region], pain: [region] } reported today.
 * Returns { [muscle]: { readiness 0–1, weekSets, lastHours, need, sore } }.
 */
export function muscleState(history, now, checkin = null) {
  const state = {};
  for (const m of Object.keys(MUSCLES)) state[m] = { readiness: 1, fatigue: 0, weekSets: 0, lastHours: null, lastDate: null, sore: false };
  for (const { session, sets } of history) {
    const at = session.startedAt || Date.parse(`${session.date}T12:00`);
    const hours = (now - at) / 3.6e6;
    if (hours < 0) continue;
    const per = setsPerMuscle(sets);
    for (const [m, n] of Object.entries(per)) {
      const st = state[m];
      if (!st) continue;
      if (hours < 24 * 7) st.weekSets += n;
      if (st.lastHours == null || hours < st.lastHours) { st.lastHours = hours; st.lastDate = session.date; }
      // Bigger sessions take longer to bounce back from; a couple of sets barely registers.
      const window = RECOVERY_HOURS[MUSCLES[m].size] * clamp(0.5 + n / 8, 0.6, 1.25);
      const residual = clamp(1 - hours / window, 0, 1) * clamp(n / 4, 0, 1);
      st.fatigue = clamp(st.fatigue + residual, 0, 1);
    }
  }
  const sore = new Set(checkin?.sore || []);
  for (const [m, st] of Object.entries(state)) {
    st.readiness = 1 - st.fatigue;
    if (sore.has(MUSCLES[m].region)) { st.sore = true; st.readiness = Math.min(st.readiness, 0.3); }
    // Need: how much this muscle would benefit from training now.
    const deficit = clamp((WEEKLY_SET_TARGET - st.weekSets) / WEEKLY_SET_TARGET, 0, 1);
    const over = st.weekSets >= WEEKLY_SET_CAP ? 0.5 : 1;
    st.need = st.readiness * (0.6 + 0.8 * deficit) * over;
  }
  return state;
}

/** Average of a value over muscles, large muscles counted double. */
export function weighted(state, muscles, key = 'need') {
  let sum = 0, w = 0;
  for (const m of muscles) {
    const k = MUSCLES[m]?.size === 'large' ? 2 : 1;
    sum += (state[m]?.[key] ?? 0) * k; w += k;
  }
  return w ? sum / w : 0;
}

// ───────── Pain: avoid what could aggravate it ─────────
// Muscle regions map to the muscles in them; joints (knees, elbows, wrists, neck) only via `stress`.
// Some joints are loaded by a whole movement pattern, whatever the exercise's own tags say.
const PAIN_PATTERNS = { knees: ['squat', 'lunge'], neck: ['verticalPush'] };
const PAIN_IDS = { knees: ['leg-extension', 'cossack-squat', 'deep-squat-hold'], neck: ['db-shrug', 'kb-overhead-carry', 'tgu'] };

/** True if this exercise should be left out because of reported pain. */
export function aggravates(ex, painRegions) {
  if (!painRegions?.length) return false;
  for (const r of painRegions) {
    if (ex.stress?.includes(r)) return true;
    if (ex.primary.some((m) => MUSCLES[m]?.region === r)) return true;
    if (PAIN_PATTERNS[r]?.includes(ex.pattern) || PAIN_IDS[r]?.includes(ex.id)) return true;
  }
  return false;
}
