// Preferences: stored in the 'meta' store under key 'prefs'. Missing fields
// fall back to these defaults, so new settings in later versions just appear.
import * as DB from './db.js';
import { DEFAULT_PROFILES, KB_SIZES_LB } from './data/taxonomy.js';

export const DEFAULTS = {
  units: 'lb',
  targetSessionsPerWeek: 4,          // a target, never a schedule
  defaultMinutes: 45,
  defaultProfile: 'gym',
  profiles: DEFAULT_PROFILES,
  // 'adaptive': exercise-specific double progression (default).
  // 'classic': your 15 / 12 / max-reps system for most exercises.
  progressionStyle: 'adaptive',
  increments: { barbell: 5, dumbbell: 5, machine: 5, cable: 5, smith: 5 }, // lb per jump
  kettlebellSizes: KB_SIZES_LB,
  restTimer: true,
  theme: 'dark',                     // 'dark' | 'light' | 'system'
};

let cache = null;
const subs = new Set();
export const subscribe = (fn) => { subs.add(fn); return () => subs.delete(fn); };

export async function load() {
  const rec = await DB.get('meta', 'prefs');
  cache = { ...structuredClone(DEFAULTS), ...(rec?.value || {}) };
  return cache;
}

export const get = () => cache || structuredClone(DEFAULTS);

// Saves run one after another, each building on the last, so quick taps never overwrite each other.
let queue = Promise.resolve();
export function update(patch) {
  const job = queue.then(async () => {
    const next = { ...get(), ...patch };
    await DB.put('meta', { key: 'prefs', value: next });
    cache = next;
    for (const f of subs) f(cache);
    return cache;
  });
  queue = job.catch(() => {});
  return job;
}
