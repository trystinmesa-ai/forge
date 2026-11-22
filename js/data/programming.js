// Default prescriptions by exercise category, plus the training-wide rules the
// engine will use. Every rule says how sure we are (basis) and where it comes from.
// Change numbers here; nothing else in the app hard-codes them.

/**
 * Per-category defaults ('adaptive' = exercise-specific double progression).
 * reps: target range. rir: reps left in reserve at the end of a set (0 = failure).
 * restSec: rest between sets. secPerRep / setupSec: used to estimate workout time.
 */
export const CATEGORY_RX = {
  compound:  { sets: 3, reps: [6, 10],  rir: [1, 3], restSec: 150, secPerRep: 4, setupSec: 90, amrapLast: false },
  accessory: { sets: 3, reps: [8, 12],  rir: [1, 2], restSec: 105, secPerRep: 3.5, setupSec: 60, amrapLast: false },
  isolation: { sets: 3, reps: [10, 15], rir: [0, 2], restSec: 75,  secPerRep: 3, setupSec: 45, amrapLast: true },
  power:     { sets: 4, reps: [8, 12],  rir: [3, 4], restSec: 90,  secPerRep: 1.5, setupSec: 30, amrapLast: false },
  core:      { sets: 3, reps: [8, 15],  rir: [1, 3], restSec: 60,  secPerRep: 3, setupSec: 30, amrapLast: false },
  carry:     { sets: 3, seconds: [30, 45], restSec: 75, setupSec: 30 },
  mobility:  { sets: 1, reps: [6, 10],  restSec: 0,   secPerRep: 4, setupSec: 15 },
};

/** Your original scheme, used for most exercises when Progression style is "15 / 12 / max". */
export const CLASSIC_RX = {
  sets: 3, setReps: [15, 12, 'max'],
  // Final-set reps -> next session's change, as you described it.
  thresholds: [
    { below: 10, change: -5, label: 'Drop 5 lb' },
    { upTo: 15, change: 0, label: 'Same weight' },
    { upTo: 20, change: +5, label: 'Add 5 lb' },
    { above: 20, change: +5, label: 'Add weight (more if it felt easy)' },
  ],
  // Heavy barbell lifts keep the adaptive ranges: max-rep sets on them raise injury risk for little benefit.
  excludeHeavy: true,
};

/** Training-wide rules, with how sure we are and why. */
export const RULES = [
  {
    id: 'repRange', basis: 'guideline', sources: ['schoenfeld2017load', 'acsm2009'],
    text: 'Muscle grows across a wide range of loads (roughly 6–30 reps) when sets are taken close to failure. Heavier ranges build more maximal strength.',
  },
  {
    id: 'categoryRanges', basis: 'estimate', sources: ['acsm2009'],
    text: 'Big lifts use lower reps (6–10) because high-rep sets on them get technically sloppy. Isolation work uses higher reps (10–20) where fatigue is safe.',
  },
  {
    id: 'proximity', basis: 'estimate', sources: ['refalo2023'],
    text: 'Stopping 1–3 reps short of failure grows muscle about as well as failure on most lifts, with less fatigue. Absolute failure is reserved for safe isolation exercises.',
  },
  {
    id: 'rest', basis: 'guideline', sources: ['acsm2009'],
    text: 'About 2–3 min rest for heavy multi-joint lifts, 1–2 min for lighter or single-joint exercises.',
  },
  {
    id: 'doubleProgression', basis: 'estimate', sources: ['nscaEssentials'],
    text: 'Add reps within the range first. Add weight only once every working set reaches the top of the range, then restart at the bottom.',
  },
  {
    id: 'weeklySets', basis: 'estimate', sources: ['schoenfeld2017volume'],
    text: 'Around 10–20 hard sets per muscle per week is the working target. More volume tends to mean more growth, up to a point.',
  },
  {
    id: 'frequency', basis: 'guideline', sources: ['schoenfeld2016freq', 'who2020'],
    text: 'Training each muscle about twice a week works well. Strength training at least 2 days a week is the baseline for health.',
  },
  {
    id: 'recovery', basis: 'estimate', sources: [],
    text: 'Recovery times are estimates. Larger muscles and harder sessions usually need longer (often 48–72 h), but it varies by person. Your check-ins override the estimate.',
  },
];
