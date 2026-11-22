// The workout in progress: log sets quickly, see last time's numbers beside each set,
// rest timer, replace/skip exercises, finish or discard. Every tap is saved immediately.
import { h, icon, sheet, toast, confirm } from '../ui.js';
import * as W from '../workout.js';
import * as L from '../data/lookup.js';
import * as Prefs from '../prefs.js';
import * as Timer from '../timer.js';
import { REGIONS, MUSCLES } from '../data/taxonomy.js';
import { muscleMap } from '../musclemap.js';
import { openExercise } from './library.js';
import { pickExercise, exerciseHistorySheet, fmtSet } from '../sheets.js';
import { shortDate, relativeDays, daysBetween, localDate } from '../util.js';

let clock = null;

export default async function workout({ go, refresh }) {
  clearInterval(clock);
  const session = await W.activeSession();
  if (!session) {
    return h('div', h('header.screen-head', h('div', h('h1', 'Workout'))),
      h('div.card.empty', h('h3', 'No workout in progress'), h('p', 'Start one from Today.'),
        h('button.btn.primary', { onclick: () => go('today') }, 'Go to Today')));
  }
  const prefs = Prefs.get();
  const setMap = await W.setsByEntry(session.id);
  const prevs = new Map(await Promise.all(session.entries.map(async (e) => [e.id, await W.previousPerformance(e.exerciseId, session.id)])));
  const rerender = () => { const y = window.scrollY; refresh().then(() => window.scrollTo(0, y)); };

  const elapsed = h('span');
  const tickClock = () => { const m = Math.floor((Date.now() - session.startedAt) / 60000); elapsed.textContent = m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`; };
  tickClock(); clock = setInterval(tickClock, 15000);

  const allSets = [...setMap.values()].flat();
  const doneCount = allSets.filter((s) => s.completed && s.kind === 'working').length;

  const head = h('header.screen-head.workout-head',
    h('div', h('div.eyebrow', elapsed, ` · ${doneCount} set${doneCount === 1 ? '' : 's'}`), h('h1', session.title || 'Workout')),
    h('button.btn.primary', { onclick: () => finishSheet(session, go) }, 'Finish'));

  const entries = session.entries.slice().sort((a, b) => a.order - b.order);
  return h('div',
    head,
    h('div.stack',
      checkinCard(session),
      entries.length ? entries.map((e) => entryCard(session, e, setMap.get(e.id) || [], prevs.get(e.id), prefs, rerender)) :
        h('div.card.empty', h('h3', 'Add your first exercise'), h('p', { style: { margin: 0 } }, 'Search the library and tap to add.')),
      h('button.btn.block.lg', { onclick: async () => {
        await pickExercise({ onPick: (ex) => W.addEntry(session.id, ex.id, prefs) });
        rerender();
      } }, '+ Add exercise'),
      h('button.btn.block.ghost', { style: { color: 'var(--danger)' }, onclick: async () => {
        if (!(await confirm('Discard this workout?', 'Everything logged in it will be deleted. This can’t be undone.', { ok: 'Discard', danger: true }))) return;
        await W.discardSession(session.id); Timer.stop(); go('today');
      } }, 'Discard workout')));
}

// ───────── One exercise ─────────
function entryCard(session, entry, sets, prev, prefs, rerender) {
  const ex = L.exercise(entry.exerciseId);
  if (!ex) return h('div.card', h('h3', L.exerciseName(entry.exerciseId)), h('p.muted.small', 'This exercise is no longer in the library.'));
  const t = entry.target;
  const timed = ex.measure === 'time';
  const working = sets.filter((s) => s.kind === 'working');
  const allDone = sets.length > 0 && sets.every((s) => s.completed);

  const targetText = t.setReps ? `${t.setReps.join(' / ')} reps` : timed ? `${t.sets} × ${t.seconds[0]}–${t.seconds[1]} s` : `${t.sets} × ${t.reps[0]}–${t.reps[1]} reps`;
  const restText = t.restSec ? ` · rest ${t.restSec >= 60 ? `${Math.floor(t.restSec / 60)}:${String(t.restSec % 60).padStart(2, '0')}` : `${t.restSec}s`}` : '';
  const lastText = prev
    ? `Last time ${shortDate(prev.date)} (${relativeDays(daysBetween(prev.date, localDate()))}): ${prev.sets.map(fmtSet).join(', ')}`
    : null;

  const rows = sets.map((s) => setRow(session, entry, ex, s, prev, working, prefs, rerender));

  return h('div.card.entry', { class: [entry.skipped && 'skipped', allDone && 'all-done'].filter(Boolean).join(' ') },
    h('div.entry-head',
      h('button.entry-thumb', { 'aria-label': `About ${ex.name}`, onclick: () => openExercise(ex.id) }, muscleMap(ex.primary, ex.secondary)),
      h('div.grow',
        h('button.entry-name', { onclick: () => openExercise(ex.id) }, ex.name),
        h('div.small.muted', `${targetText}${ex.uni ? ' per side' : ''}${restText}`),
        entry.replacedFrom && h('div.small.faint', `Replacing ${L.exerciseName(entry.replacedFrom)}`)),
      h('button.icon-btn', { 'aria-label': 'Exercise options', onclick: () => entryMenu(session, entry, ex, sets, rerender) }, '⋯')),
    prev ? h('div.prev', lastText) : h('div.prev.new', h('b', 'New exercise. '), timed
      ? 'Pick a weight you can hold with perfect posture for the whole time.'
      : `Start light and find a weight you can do for ${t.setReps ? '15' : t.reps[1]} good reps. The app learns from what you log.`),
    effortLine(ex, t),
    h('details.cues', h('summary', 'How to do it'), h('ol.cues', ex.cues.map((c) => h('li', c)))),
    entry.skipped
      ? h('div.small.muted', { style: { padding: '6px 0' } }, 'Skipped. ', h('button.link', { onclick: async () => { await W.setSkipped(session.id, entry.id, false); rerender(); } }, 'Undo'))
      : h('div.sets',
        h('div.set-row.set-headrow', h('span', 'Set'), h('span', 'Last'), h('span', ex.load === 'bodyweight' ? '+lb' : 'lb'), h('span', timed ? 'sec' : 'reps'), h('span', '')),
        rows,
        h('div.row', { style: { marginTop: '8px' } },
          h('button.btn.small-btn', { onclick: async () => { await W.addSet(session.id, entry.id); rerender(); } }, '+ Set'),
          ex.cat !== 'mobility' && ex.load !== 'bodyweight' && h('button.btn.small-btn.ghost', { onclick: async () => { await W.addSet(session.id, entry.id, { kind: 'warmup' }); rerender(); } }, '+ Warm-up set'))));
}

function effortLine(ex, t) {
  const rx = { ...t, amrapLast: !!t.setReps };
  const text = L.describeEffort(rx, ex);
  return text ? h('div.small.faint', { style: { margin: '2px 0 6px' } }, text) : null;
}

function setRow(session, entry, ex, s, prev, working, prefs, rerender) {
  const timed = ex.measure === 'time';
  const t = entry.target;
  const isWarm = s.kind === 'warmup';
  const prevSet = !isWarm ? prev?.sets[s.idx] : null;
  const targetReps = isWarm ? '' : t.setReps ? String(t.setReps[s.idx] ?? t.setReps[t.setReps.length - 1]) : timed ? `${t.seconds[0]}–${t.seconds[1]}` : `${t.reps[0]}–${t.reps[1]}`;
  const label = isWarm ? 'W' : String(s.idx + 1);

  const wIn = h('input.num', { type: 'text', inputmode: 'decimal', value: s.weight ?? '', placeholder: ex.load === 'bodyweight' ? '0' : (prevSet?.weight ?? 'lb'), 'aria-label': `Set ${label} weight` });
  const rIn = h('input.num', { type: 'text', inputmode: 'numeric', value: (timed ? s.seconds : s.reps) ?? '', placeholder: targetReps === 'max' ? 'max' : targetReps, 'aria-label': `Set ${label} ${timed ? 'seconds' : 'reps'}` });
  const parse = (v) => { const n = parseFloat(String(v).replace(',', '.')); return Number.isFinite(n) && n >= 0 ? n : null; };
  const saveVals = () => W.updateSet(s.id, { weight: parse(wIn.value), [timed ? 'seconds' : 'reps']: parse(rIn.value) == null ? null : Math.round(parse(rIn.value)) });
  wIn.addEventListener('change', saveVals);
  rIn.addEventListener('change', saveVals);
  for (const el of [wIn, rIn]) el.addEventListener('focus', () => el.select());

  const check = h('button.set-check', { 'aria-pressed': String(!!s.completed), 'aria-label': s.completed ? `Set ${label} done; tap to undo` : `Mark set ${label} done`, onclick: async () => {
    if (s.completed) { await W.updateSet(s.id, { completed: false }); rerender(); return; }
    // A single-number target (e.g. 15) counts as entered; a range or "max" needs your actual number.
    if (!rIn.value && /^\d+$/.test(targetReps)) rIn.value = targetReps;
    if (!rIn.value) { rIn.focus(); toast(timed ? 'Enter how many seconds' : 'Enter how many reps you did'); return; }
    if (!wIn.value && ex.load !== 'bodyweight' && ex.cat !== 'mobility') { wIn.focus(); toast('Enter the weight you used'); return; }
    await saveVals();
    await W.updateSet(s.id, { completed: true });
    // Carry this weight to the later sets you haven't filled in yet: one less thing to type.
    const w = parse(wIn.value);
    if (w != null && !isWarm) {
      for (const later of working.filter((x) => x.idx > s.idx && !x.completed && x.weight == null)) await W.updateSet(later.id, { weight: w });
    }
    if (prefs.restTimer && !isWarm && t.restSec) Timer.start(t.restSec, `Rest · ${ex.name}`);
    rerender();
  } }, '✓');

  return h('div.set-row', { class: [s.completed && 'done', isWarm && 'warm'].filter(Boolean).join(' ') },
    h('span.set-label', label),
    h('span.set-prev', prevSet ? fmtSet(prevSet) : '–'),
    wIn, rIn, check);
}

// ───────── Menus & sheets ─────────
function entryMenu(session, entry, ex, sets, rerender) {
  const prefs = Prefs.get();
  const open = sets.filter((s) => !s.completed);
  return sheet((close) => h('div.stack',
    h('h2', ex.name),
    h('div.list',
      h('button.item', { onclick: () => { close(); replaceSheet(session, entry, ex, rerender); } }, h('div.grow', h('div', 'Replace this exercise'), h('div.sub', 'Similar movement, rest of the workout unchanged'))),
      h('button.item', { onclick: async () => { close(); await W.setSkipped(session.id, entry.id, !entry.skipped); rerender(); } }, h('div.grow', entry.skipped ? 'Un-skip' : 'Skip this exercise')),
      open.length > 0 && h('button.item', { onclick: async () => { close(); await W.removeSet(open[open.length - 1].id); rerender(); } }, h('div.grow', 'Remove last unfinished set')),
      h('button.item', { onclick: () => { close(); exerciseHistorySheet(ex.id); } }, h('div.grow', 'My history with this exercise')),
      h('button.item', { style: { color: 'var(--danger)' }, onclick: async () => {
        close();
        if (sets.some((s) => s.completed) && !(await confirm('Remove from workout?', 'Its completed sets will be deleted too.', { ok: 'Remove', danger: true }))) return;
        await W.removeEntry(session.id, entry.id); rerender();
      } }, h('div.grow', 'Remove from workout'))),
    h('button.btn.ghost.block', { onclick: () => close() }, 'Cancel')), { label: 'Exercise options' });
}

async function replaceSheet(session, entry, ex, rerender) {
  const prefs = Prefs.get();
  const profile = prefs.profiles.find((p) => p.id === (session.plan?.profileId || prefs.defaultProfile));
  const DB = await import('../db.js');
  const subs = (await DB.all('substitutions')).filter((s) => s.from === ex.id);
  const remembered = new Map(subs.map((s) => [s.to, s.count]));
  const inSetup = L.alternatives(ex, { available: profile?.equipment, limit: 8 });
  const others = L.alternatives(ex, { limit: 8 }).filter((a) => !inSetup.some((b) => b.id === a.id));
  // Swaps you've made at least twice float to the top.
  const sortRemembered = (list) => list.slice().sort((a, b) => ((remembered.get(b.id) || 0) >= 2) - ((remembered.get(a.id) || 0) >= 2));
  const item = (a, close) => h('button.item', { onclick: async () => { close(); await W.replaceEntry(session.id, entry.id, a.id, prefs); toast(`Swapped in ${a.name}`); rerender(); } },
    h('div.grow', h('div', { style: { fontWeight: 600 } }, a.name, (remembered.get(a.id) || 0) >= 2 && h('span.pill.accent', { style: { marginLeft: '8px' } }, 'Your usual swap')),
      h('div.sub', a.primary.map((m) => MUSCLES[m]?.name).join(', '))));
  await sheet((close) => h('div.stack',
    h('div', h('div.kicker.faint.small', 'Replace'), h('h2', ex.name)),
    h('p.small.muted', { style: { margin: 0 } }, 'Same movement pattern and similar muscles. The rest of the workout stays as it is. Whole-workout regeneration arrives with the planner in Phase 4.'),
    inSetup.length ? h('div', h('div.section-label', `With ${profile?.name || 'your equipment'}`), h('div.list', sortRemembered(inSetup).map((a) => item(a, close)))) : null,
    others.length ? h('div', h('div.section-label', 'Needs other equipment'), h('div.list', sortRemembered(others).map((a) => item(a, close)))) : null,
    h('button.btn.block', { onclick: async () => {
      close();
      await pickExercise({ title: 'Replace with…', multi: false, onPick: async (a) => { await W.replaceEntry(session.id, entry.id, a.id, prefs); } });
      rerender();
    } }, 'Pick any exercise'),
    h('button.btn.ghost.block', { onclick: () => close() }, 'Cancel')), { label: 'Replace exercise' });
}

function checkinCard(session) {
  const c = session.checkin || { sore: [], pain: [], notes: '' };
  const save = (patch) => W.updateSession(session.id, { checkin: { ...c, ...patch } }).then(() => Object.assign(c, patch));
  const chipGroup = (key) => h('div.chips', { style: { flexWrap: 'wrap', margin: 0, padding: 0 } },
    Object.entries(REGIONS).filter(([k]) => key === 'pain' || !['knees', 'elbows', 'wrists', 'neck'].includes(k)).map(([k, v]) =>
      h('button.chip', { type: 'button', 'aria-pressed': String((c[key] || []).includes(k)), onclick: (e) => {
        const set = new Set(c[key] || []); if (set.has(k)) set.delete(k); else set.add(k);
        e.currentTarget.setAttribute('aria-pressed', String(set.has(k)));
        save({ [key]: [...set] });
      } }, v.name)));
  const notes = h('textarea', { rows: 2, placeholder: 'Anything else? (e.g. slept badly, short on time)', onchange: (e) => save({ notes: e.target.value.trim() }) });
  notes.value = c.notes || '';
  const n = (c.sore || []).length + (c.pain || []).length;
  return h('details.card.checkin', n ? { open: false } : null,
    h('summary', h('span', 'How are you feeling?'), h('span.small.faint', n ? `${n} noted` : 'Optional')),
    h('div.stack', { style: { marginTop: '10px' } },
      h('div.small.muted', 'Sore (normal muscle soreness)'), chipGroup('sore'),
      h('div.small.muted', 'Pain or discomfort'), chipGroup('pain'),
      (c.pain || []).length > 0 && h('div.banner', 'Pain is different from soreness. Skip or replace anything that hurts; don’t train through it. If it persists, get it checked.'),
      notes));
}

function finishSheet(session, go) {
  return W.finishPreview(session.id).then((p) => sheet((close) => {
    const notes = h('textarea', { rows: 3, placeholder: 'Notes about this workout (optional)' });
    notes.value = session.notes || '';
    return h('div.stack',
      h('h2', p.completed ? 'Finish workout?' : 'Nothing logged yet'),
      p.completed
        ? h('p.muted', { style: { margin: 0 } }, `${p.completed} working set${p.completed === 1 ? '' : 's'}${p.warmups ? ` + ${p.warmups} warm-up` : ''} will be saved.${p.open ? ` ${p.open} planned set${p.open === 1 ? '' : 's'} you didn’t do won’t be recorded.` : ''}`)
        : h('p.muted', { style: { margin: 0 } }, 'Tick at least one set to save this workout, or discard it.'),
      p.completed > 0 && notes,
      p.completed > 0 && h('button.btn.primary.block.lg', { onclick: async () => {
        try {
          const done = await W.finishSession(session.id, { notes: notes.value.trim() });
          Timer.stop(); close();
          toast(`Saved · ${done.durationMin} min`);
          go('history');
        } catch (e) { toast(e.message, { error: true }); }
      } }, 'Finish & save'),
      !p.completed && h('button.btn.danger.block', { onclick: async () => { await W.discardSession(session.id); Timer.stop(); close(); go('today'); } }, 'Discard workout'),
      h('button.btn.ghost.block', { onclick: () => close() }, 'Keep going'));
  }, { label: 'Finish workout' }));
}
