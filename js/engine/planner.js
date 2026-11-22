// Builds a workout from your history, recovery, equipment, check-in and time.
// Pure and deterministic: the same inputs always give the same workout.
// "Regenerate" passes the previous picks in `avoid`, so it gives a different one.
import * as L from '../data/lookup.js';
import { CATEGORY_RX } from '../data/programming.js';
import { MUSCLES, REGIONS, PATTERNS, EQUIPMENT } from '../data/taxonomy.js';
import { muscleState, weighted, aggravates } from './recovery.js';
import { daysBetween } from '../util.js';

// ───────── Session types ─────────
// Slots are filled in order of priority (1 = always, 2 = normally, 3 = if time allows).
// pats: movement patterns that can fill it. cats: preferred categories, best first.
// muscles: the slot only takes exercises whose primary muscles include one of these.
// differentFrom: must use a different pattern from that slot's pick.
const S = (key, label, pri, pats, cats, more = {}) => ({ key, label, pri, pats, cats, ...more });

export const FOCI = {
  full: {
    name: 'Full body',
    muscles: ['quads', 'glutes', 'hamstrings', 'chest', 'lats', 'upperBack', 'frontDelts'],
    slots: [
      S('squat', 'Squat or lunge', 1, ['squat', 'lunge'], ['compound', 'accessory']),
      S('push', 'Push', 1, ['horizontalPush', 'verticalPush'], ['compound', 'accessory']),
      S('hinge', 'Hinge', 1, ['hinge', 'ballistic'], ['compound', 'power', 'accessory']),
      S('pull', 'Pull', 1, ['horizontalPull', 'verticalPull'], ['compound', 'accessory']),
      S('carry', 'Carry or get-up', 2, ['carry', 'getUp'], ['carry', 'compound']),
      S('core', 'Core', 2, ['antiExtension', 'rotation', 'flexion'], ['core']),
      S('pull2', 'Second pull', 3, ['verticalPull', 'horizontalPull'], ['compound', 'accessory'], { differentFrom: 'pull' }),
      S('push2', 'Second push', 3, ['verticalPush', 'horizontalPush'], ['accessory', 'compound'], { differentFrom: 'push' }),
      S('single', 'Single leg', 3, ['lunge'], ['accessory', 'compound'], { differentFrom: 'squat' }),
      S('arms', 'Arms', 3, ['elbowFlexion', 'elbowExtension'], ['isolation']),
    ],
  },
  upper: {
    name: 'Upper body',
    muscles: ['chest', 'lats', 'upperBack', 'frontDelts', 'sideDelts', 'rearDelts', 'biceps', 'triceps'],
    slots: [
      S('hpush', 'Horizontal push', 1, ['horizontalPush'], ['compound', 'accessory']),
      S('hpull', 'Row', 1, ['horizontalPull'], ['compound', 'accessory']),
      S('vpull', 'Vertical pull', 1, ['verticalPull'], ['compound', 'accessory']),
      S('vpush', 'Overhead press', 2, ['verticalPush'], ['compound', 'accessory', 'power']),
      S('delts', 'Side delts', 2, ['shoulderIso'], ['isolation'], { muscles: ['sideDelts'] }),
      S('biceps', 'Biceps', 2, ['elbowFlexion'], ['isolation']),
      S('triceps', 'Triceps', 2, ['elbowExtension'], ['isolation', 'accessory']),
      S('rear', 'Rear delts', 3, ['shoulderIso'], ['isolation'], { muscles: ['rearDelts'] }),
      S('chestIso', 'Chest isolation', 3, ['horizontalPush'], ['isolation']),
      S('core', 'Core', 3, ['rotation', 'antiExtension', 'flexion', 'getUp'], ['core', 'compound']),
    ],
  },
  lower: {
    name: 'Lower body',
    muscles: ['quads', 'hamstrings', 'glutes', 'adductors', 'calves'],
    slots: [
      S('squat', 'Squat', 1, ['squat'], ['compound', 'accessory']),
      S('hinge', 'Hinge', 1, ['hinge', 'ballistic'], ['compound', 'power', 'accessory']),
      S('single', 'Single leg', 1, ['lunge'], ['compound', 'accessory']),
      S('ham', 'Hamstrings / glutes', 2, ['legIso', 'hinge'], ['isolation', 'accessory'], { muscles: ['hamstrings', 'glutes'] }),
      S('core', 'Core', 2, ['antiExtension', 'rotation', 'flexion'], ['core']),
      S('carry', 'Carry', 2, ['carry'], ['carry']),
      S('calves', 'Calves', 3, ['legIso'], ['isolation'], { muscles: ['calves'] }),
      S('quadIso', 'Quads isolation', 3, ['legIso'], ['isolation'], { muscles: ['quads'] }),
      S('power', 'Power', 3, ['ballistic'], ['power'], { differentFrom: 'hinge' }),
    ],
  },
};

const ORDER = { power: 0, compound: 1, accessory: 2, isolation: 3, carry: 4, core: 5 };
const WARMUP_SEC = 3 * 60;           // 3 short mobility moves
const RAMP_SEC = 2 * 90;             // 2 lighter ramp-up sets on the first main lift
const TRANSITION_SEC = 45;           // moving between exercises
const TOLERANCE_SEC = 180;           // "about 45 min" can run a couple of minutes over
// With plenty of equipment, prefer loads you can progress in small, measurable steps.
const LOAD_PREF = { barbell: 0.6, dumbbell: 0.6, cable: 0.5, machine: 0.5, kettlebell: 0.5, smith: 0.4, bodyweight: 0.2, band: 0 };

const mid = ([a, b]) => (a + b) / 2;

/** Seconds one exercise takes: work + rest between sets + setup. Estimate. */
export function entrySeconds(ex, sets, style = 'adaptive') {
  const rx = L.prescription(ex, style);
  const base = CATEGORY_RX[ex.cat];
  let work;
  if (rx.seconds) work = mid(rx.seconds);
  else {
    const reps = rx.setReps ? 13 : mid(rx.reps); // 15 / 12 / ~12
    work = reps * (base.secPerRep || 3);
  }
  if (ex.uni) work = work * 2 + 10;
  return (base.setupSec || 30) + sets * work + Math.max(0, sets - 1) * rx.restSec + TRANSITION_SEC;
}

export function estimateMinutes(items, style, { warmup = true, ramp = false } = {}) {
  let sec = (warmup ? WARMUP_SEC : 0) + (ramp ? RAMP_SEC : 0);
  for (const it of items) sec += entrySeconds(L.exercise(it.exerciseId), it.sets, style);
  return Math.round(sec / 60);
}

// ───────── Choosing what to train ─────────
function lastTrainedDays(state, muscles, today) {
  const dates = muscles.map((m) => state[m]?.lastDate).filter(Boolean).sort();
  return dates.length ? daysBetween(dates[dates.length - 1], today) : null;
}

const ago = (d) => (d == null ? 'not recently' : d === 0 ? 'today' : d === 1 ? 'yesterday' : `${d} days ago`);

export function chooseFocus(state, { daysSince, hasHistory, forced, today }) {
  const score = {};
  for (const f of Object.keys(FOCI)) score[f] = weighted(state, FOCI[f].muscles, 'need');
  const up = weighted(state, FOCI.upper.muscles, 'readiness');
  const low = weighted(state, FOCI.lower.muscles, 'readiness');
  const upDays = lastTrainedDays(state, ['chest', 'lats', 'upperBack'], today);
  const lowDays = lastTrainedDays(state, ['quads', 'glutes', 'hamstrings'], today);
  if (forced && FOCI[forced]) return { focus: forced, reason: `${FOCI[forced].name}, as you chose.` };
  if (!hasHistory) return { focus: 'full', reason: 'No history yet, so a full-body session to find your starting weights.' };
  if (daysSince != null && daysSince >= 4) {
    return { focus: 'full', reason: `${daysSince} days since your last workout. Everything has recovered, so full body covers the most ground.` };
  }
  // A clearly fresher half wins; otherwise train both.
  if (score.lower - score.upper > 0.12 || (low - up > 0.2)) {
    return { focus: 'lower', reason: `Lower body: legs last trained ${ago(lowDays)} and are recovered. Upper body was trained ${ago(upDays)}.` };
  }
  if (score.upper - score.lower > 0.12 || (up - low > 0.2)) {
    return { focus: 'upper', reason: `Upper body: chest and back last trained ${ago(upDays)} and are recovered. Legs were trained ${ago(lowDays)}.` };
  }
  return { focus: 'full', reason: `Upper and lower body are about equally recovered (last trained ${ago(Math.min(upDays ?? 99, lowDays ?? 99))}), so full body.` };
}

// ───────── Picking exercises ─────────
function candidatesFor(slot, ctx, chosen) {
  const { pool, state, familiar, swapsFrom, swapsTo, avoid } = ctx;
  const avoidPattern = slot.differentFrom ? chosen.get(slot.differentFrom)?.pattern : null;
  const out = [];
  for (const ex of pool) {
    if (!slot.pats.includes(ex.pattern)) continue;
    if (!slot.cats.includes(ex.cat)) continue;
    if (slot.muscles && !ex.primary.some((m) => slot.muscles.includes(m))) continue;
    if (avoidPattern && ex.pattern === avoidPattern) continue;
    if ([...chosen.values()].some((c) => c.id === ex.id)) continue;
    const minReady = Math.min(...ex.primary.map((m) => state[m]?.readiness ?? 1));
    if (minReady < 0.35) continue; // sore or just trained hard: leave it
    let s = 3 - slot.cats.indexOf(ex.cat);
    s += 4 * weighted(state, ex.primary, 'need');
    s += LOAD_PREF[ex.load] ?? 0;
    s -= 0.3 * ((ex.diff || 1) - 1);                        // simpler first, all else equal
    if (ex.staple) s += 0.5;                                // foundational lifts first
    if (familiar.has(ex.id)) s += 1.5;                     // keep progressing what you already do
    else if (ex.diff >= 3) s -= 1;                          // technical lifts aren't sprung on you
    if (ex.heavy && minReady < 0.8) s -= 2;
    if ((swapsFrom.get(ex.id) || 0) >= 2) s -= 2.5;         // you keep swapping this one out
    if ((swapsTo.get(ex.id) || 0) >= 2) s += 2;             // ...and this one in
    if (avoid.has(ex.id)) s -= 4;                           // regenerate: try something else
    out.push({ ex, s });
  }
  return out.sort((a, b) => b.s - a.s || a.ex.id.localeCompare(b.ex.id));
}

function setsFor(ex, ctx) {
  const rx = L.prescription(ex, ctx.style);
  let n = rx.sets;
  if (ctx.returning && (ex.cat === 'compound' || ex.cat === 'power')) n = Math.max(2, n - 1);
  return n;
}

function pickWarmup(focus, ctx, minutes) {
  const tags = focus === 'upper' ? ['upper', 'full'] : focus === 'lower' ? ['lower', 'full'] : ['full', 'lower', 'upper'];
  const n = minutes <= 30 ? 2 : 3;
  const mob = L.allExercises({ includeHidden: false })
    .filter((e) => e.cat === 'mobility' && L.isAvailable(e, ctx.equipment) && !aggravates(e, ctx.pain) && (e.warmup || []).some((t) => tags.includes(t)));
  const rank = (e) => Math.min(...e.warmup.map((t) => (tags.includes(t) ? tags.indexOf(t) : 9)));
  const ordered = mob.slice().sort((a, b) => rank(a) - rank(b));
  const out = [];
  // Full body: one move for each area first. Otherwise the best-matching moves.
  if (focus === 'full') for (const t of tags) { const e = ordered.find((x) => x.warmup.includes(t) && !out.includes(x)); if (e) out.push(e); }
  for (const e of ordered) if (out.length < n && !out.includes(e)) out.push(e);
  return out.slice(0, n).map((e) => e.id);
}

/**
 * Plan a workout.
 * history: [{ session, sets }] completed sessions. familiar: Map exerciseId -> last date.
 * swaps: [{from, to, count}]. opts: { now, today, prefs, minutes, profileId, checkin, focus, avoid, skipSlots }
 */
export function plan(history, { familiar = new Map(), swaps = [] } = {}, opts) {
  const { now, today, prefs } = opts;
  const minutes = opts.minutes || prefs.defaultMinutes;
  const profile = prefs.profiles.find((p) => p.id === (opts.profileId || prefs.defaultProfile)) || prefs.profiles[0];
  const checkin = opts.checkin || { sore: [], pain: [] };
  const pain = checkin.pain || [];
  const state = muscleState(history, now, checkin);
  const sorted = history.slice().sort((a, b) => b.session.date.localeCompare(a.session.date));
  const lastDate = sorted[0]?.session.date || null;
  const daysSince = lastDate ? daysBetween(lastDate, today) : null;

  const { focus, reason } = chooseFocus(state, { today, daysSince, hasHistory: history.length > 0, forced: opts.focus && opts.focus !== 'auto' ? opts.focus : null });
  const equipment = profile.equipment;
  const ctx = {
    state, familiar, avoid: new Set(opts.avoid || []), style: prefs.progressionStyle, equipment, pain,
    returning: daysSince != null && daysSince >= 7,
    swapsFrom: new Map(), swapsTo: new Map(),
    pool: L.allExercises({ includeHidden: false }).filter((e) => e.cat !== 'mobility' && L.isAvailable(e, equipment) && !aggravates(e, pain)),
  };
  for (const s of swaps) {
    ctx.swapsFrom.set(s.from, (ctx.swapsFrom.get(s.from) || 0) + s.count);
    ctx.swapsTo.set(s.to, (ctx.swapsTo.get(s.to) || 0) + s.count);
  }

  const reasons = [reason];
  const notes = [];
  const skip = new Set(opts.skipSlots || []);
  const chosen = new Map();
  const picks = [];
  for (const slot of FOCI[focus].slots) {
    if (skip.has(slot.key)) continue;
    const [best] = candidatesFor(slot, ctx, chosen);
    if (!best) {
      if (slot.pri === 1) notes.push(gapNote(slot, profile, ctx, pain));
      continue;
    }
    chosen.set(slot.key, best.ex);
    picks.push({ slot, ex: best.ex, sets: setsFor(best.ex, ctx) });
  }

  // ───── Fit to time ─────
  const budget = minutes * 60;
  const ramp = picks.some((p) => p.ex.heavy || (p.ex.cat === 'compound' && p.ex.load !== 'bodyweight' && p.ex.load !== 'kettlebell'));
  const fixed = WARMUP_SEC + (ramp ? RAMP_SEC : 0);
  const sec = (p) => entrySeconds(p.ex, p.sets, ctx.style);
  const total = (list) => fixed + list.reduce((a, p) => a + sec(p), 0);
  const must = picks.filter((p) => p.slot.pri === 1);
  const rest = picks.filter((p) => p.slot.pri !== 1).sort((a, b) => a.slot.pri - b.slot.pri);
  let kept = [...must];
  const dropped = [];
  for (const p of rest) {
    if (total([...kept, p]) <= budget + TOLERANCE_SEC) kept.push(p);
    else dropped.push(p);
  }
  // Still too long: trim sets on the smaller exercises first, then the main lifts (never below 2).
  for (const cats of [['isolation', 'core', 'carry', 'accessory'], ['compound', 'power']]) {
    for (const p of kept) {
      if (total(kept) <= budget + TOLERANCE_SEC) break;
      if (cats.includes(p.ex.cat) && p.sets > 2) p.sets -= 1;
    }
  }
  // Lots of time left (e.g. 90 min): an extra set on the main lifts.
  for (const p of kept) {
    if (p.ex.cat !== 'compound' || ctx.returning) continue;
    const extra = { ...p, sets: p.sets + 1 };
    if (total(kept.map((x) => (x === p ? extra : x))) <= budget - 300 && dropped.length === 0) p.sets += 1;
  }
  const estimate = Math.round(total(kept) / 60);
  const over = estimate - minutes;

  kept.sort((a, b) => (ORDER[a.ex.cat] - ORDER[b.ex.cat]) || (a.slot.pri - b.slot.pri));
  // Heavy barbell lifts go first while you're freshest, ahead of kettlebell ballistics.
  kept.sort((a, b) => (b.ex.heavy ? 1 : 0) - (a.ex.heavy ? 1 : 0));

  // ───── Explanations ─────
  const sore = (checkin.sore || []).map((r) => REGIONS[r]?.name.toLowerCase()).filter(Boolean);
  if (sore.length) reasons.push(`Sore ${list(sore)}: those muscles are left out or kept light today.`);
  if (pain.length) reasons.push(`Pain reported (${list(pain.map((r) => REGIONS[r]?.name.toLowerCase()))}): anything that loads ${pain.length > 1 ? 'those areas' : 'it'} is left out. Don’t train through pain; if it persists, get it checked.`);
  if (ctx.returning) reasons.push(`First session in ${daysSince} days: one fewer set on the main lifts and no weight increases, to ease back in.`);
  const behind = FOCI[focus].muscles.filter((m) => MUSCLES[m].size === 'large' && state[m].weekSets < 4 && history.length);
  if (behind.length && !ctx.returning && daysSince != null && daysSince < 4) {
    reasons.push(`Behind this week on ${list(behind.map((m) => MUSCLES[m].name.toLowerCase()))}, so those come first.`);
  }
  if (over > 3) reasons.push(`This needs about ${estimate} min, more than your ${minutes}. Skip the last exercise if you run short.`);
  else if (dropped.length) reasons.push(`Fits about ${minutes} min. Left out for time: ${list(dropped.map((p) => p.ex.name))}.`);

  const titleParts = [FOCI[focus].name];
  if (profile.id !== 'gym') titleParts.push(profile.name.toLowerCase().includes('only') ? profile.name.replace(/ only$/i, '') : profile.name);
  return {
    focus, title: titleParts.join(' · '), daysSince, profileId: profile.id, minutes, estimateMin: estimate, overBudget: over > 3,
    items: kept.map((p) => ({ exerciseId: p.ex.id, slot: p.slot.key, sets: p.sets })),
    warmup: pickWarmup(focus, ctx, minutes),
    ramp,
    reasons, notes,
    dropped: dropped.map((p) => p.ex.id),
    readiness: Object.fromEntries(Object.entries(state).map(([m, s]) => [m, Math.round(s.readiness * 100) / 100])),
  };
}

function gapNote(slot, profile, ctx, pain) {
  const label = slot.label.toLowerCase();
  // Would it work with more equipment, or is pain the reason?
  const any = L.allExercises({ includeHidden: false }).filter((e) => slot.pats.includes(e.pattern) && slot.cats.includes(e.cat));
  if (pain.length && any.some((e) => L.isAvailable(e, ctx.equipment))) return `No ${label} exercise today that avoids your reported pain.`;
  const needs = new Set();
  for (const e of any) for (const q of e.eq) if (q !== 'bodyweight' && !ctx.equipment.includes(q)) needs.add(q);
  const simple = ['pullupBar', 'band', 'dumbbell', 'kettlebell'].filter((q) => needs.has(q)).map((q) => EQUIPMENT[q].name.toLowerCase());
  return `No ${label} exercise works with ${profile.name.toLowerCase()}${simple.length ? `. Adding ${list(simple, 'or')} would cover it` : ''}.`;
}

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
function list(items, word = 'and') {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} ${word} ${items[items.length - 1]}`;
}

export { PATTERNS };
