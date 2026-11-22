// Log a workout you did without the app, or edit a finished one.
// Route: #/log/new/YYYY-MM-DD  or  #/log/<sessionId>
// The draft lives in memory and in localStorage, so a sync refresh, a reload or closing the
// app doesn't lose what you've typed. Nothing is written to your history until you tap Save.
import { h, sheet, toast, confirm } from '../ui.js';
import * as W from '../workout.js';
import * as L from '../data/lookup.js';
import * as Prefs from '../prefs.js';
import { pickExercise } from '../sheets.js';
import { entrySeconds } from '../engine/planner.js';
import { localDate, longDate } from '../util.js';
import { focusDay } from './history.js';

const KEY = 'forge.draft';
let draft = null;

const store = {
  load() { try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; } },
  save() { try { localStorage.setItem(KEY, JSON.stringify(draft)); } catch {} },
  clear() { try { localStorage.removeItem(KEY); } catch {} },
};

const parseNum = (v) => { const n = parseFloat(String(v).replace(',', '.')); return Number.isFinite(n) && n >= 0 ? n : null; };
const isLoaded = (ex) => ex.load !== 'bodyweight' && ex.cat !== 'mobility';

function blankSets(ex, n) {
  return Array.from({ length: n }, () => ({ id: null, weight: null, reps: null, seconds: null }));
}

/** Rough duration from what's entered: same estimate the planner uses. */
function estimate(d) {
  const sec = d.entries.reduce((a, e) => {
    const ex = L.exercise(e.exerciseId);
    const n = e.sets.filter((s) => s.reps || s.seconds).length;
    return ex && n ? a + entrySeconds(ex, n) : a;
  }, 0);
  return sec ? Math.max(10, Math.round(sec / 60 / 5) * 5) : 45;
}

export default async function log({ args, go }) {
  const key = args.join('/');
  const prefs = Prefs.get();
  let restored = false;
  if (!draft || draft.key !== key) {
    const saved = store.load();
    if (saved?.key === key) { draft = saved; restored = true; }
    else if (args[0] === 'new') {
      const date = args[1] && args[1] <= localDate() ? args[1] : localDate();
      draft = { key, sessionId: null, date, title: 'Workout', durationMin: null, notes: '', entries: [], dirty: false };
    } else {
      try { draft = { key, ...(await W.loadForEdit(args[0])), dirty: false }; }
      catch (e) { return h('div', h('header.screen-head', h('h1', 'Edit workout')), h('div.card.empty', h('p', e.message), h('button.btn', { onclick: () => go('history') }, 'Back to History'))); }
    }
  }
  const editing = !!draft.sessionId;
  const root = h('div');
  const touch = () => { draft.dirty = true; store.save(); };

  const leave = async () => {
    if (draft.dirty && !(await confirm('Discard changes?', editing ? 'Your edits to this workout won’t be saved.' : 'This workout won’t be added to your history.', { ok: 'Discard', danger: true }))) return;
    const date = draft.date;
    draft = null; store.clear();
    focusDay(date); go('history');
  };

  const save = async () => {
    // Check every row before saving anything.
    for (const e of draft.entries) {
      const ex = L.exercise(e.exerciseId);
      for (const [i, s] of e.sets.entries()) {
        const has = ex.measure === 'time' ? s.seconds : s.reps;
        if (!has && s.weight != null) { toast(`${ex.name}, set ${i + 1}: enter ${ex.measure === 'time' ? 'seconds' : 'reps'}, or clear the row`, { error: true }); return; }
        if (has && isLoaded(ex) && s.weight == null) { toast(`${ex.name}, set ${i + 1}: enter the weight you used`, { error: true }); return; }
      }
    }
    try {
      const saved = await W.savePastWorkout({ ...draft, durationMin: draft.durationMin ?? estimate(draft) }, prefs);
      draft = null; store.clear();
      toast(editing ? 'Workout updated' : 'Workout added to your history');
      focusDay(saved.date); go('history');
    } catch (e) { toast(e.message, { error: true }); }
  };

  const draw = () => {
    const est = estimate(draft);
    const dateIn = h('input', { type: 'date', value: draft.date, max: localDate(), 'aria-label': 'Date', onchange: (e) => {
      if (!e.target.value || e.target.value > localDate()) { e.target.value = draft.date; toast('Pick today or an earlier day'); return; }
      draft.date = e.target.value; touch(); draw();
    } });
    const titleIn = h('input', { type: 'text', value: draft.title, placeholder: 'Workout', 'aria-label': 'Title', oninput: (e) => { draft.title = e.target.value; touch(); } });
    const durIn = h('input.num', { type: 'text', inputmode: 'numeric', value: draft.durationMin ?? '', placeholder: String(est), 'aria-label': 'Duration in minutes', style: { maxWidth: '90px' },
      oninput: (e) => { draft.durationMin = parseNum(e.target.value); touch(); } });
    const notes = h('textarea', { rows: 2, placeholder: 'Notes (optional)', oninput: (e) => { draft.notes = e.target.value; touch(); } });
    notes.value = draft.notes || '';

    root.replaceChildren(
      h('header.screen-head.workout-head',
        h('div', h('div.eyebrow', longDate(draft.date)), h('h1', editing ? 'Edit workout' : 'Add a workout')),
        h('button.btn.primary', { onclick: save }, 'Save')),
      h('div.stack',
        restored && h('div.banner.soft', 'Picked up your unsaved changes from last time.'),
        !editing && h('p.small.muted', { style: { margin: 0 } }, 'For a workout you did without logging it here. It counts toward your history, recommendations, progress and records, using only the numbers you enter.'),
        h('div.card.stack',
          h('div.field', h('div.label', 'Date'), dateIn),
          h('div.field', h('div.label', 'Title'), titleIn),
          h('div.field', h('div.label', 'Duration (minutes)'), h('div.row', durIn, h('span.small.faint', draft.durationMin == null ? `about ${est} if left blank` : ''))),
          notes),
        draft.entries.length ? draft.entries.map((e, ei) => entryCard(e, ei)) : h('div.card.empty', h('h3', 'Add the exercises you did'), h('p', { style: { margin: 0 } }, 'Then fill in the weight and reps for each set.')),
        h('button.btn.block.lg', { onclick: async () => {
          await pickExercise({ onPick: (ex) => {
            draft.entries.push({ entryId: null, exerciseId: ex.id, sets: blankSets(ex, L.prescription(ex, prefs.progressionStyle).sets) });
            touch();
          } });
          draw();
        } }, '+ Add exercise'),
        h('button.btn.primary.block.lg', { onclick: save }, editing ? 'Save changes' : 'Save workout'),
        h('button.btn.ghost.block', { onclick: leave }, 'Cancel')));
  };

  function entryCard(e, ei) {
    const ex = L.exercise(e.exerciseId);
    if (!ex) return null;
    const timed = ex.measure === 'time';
    const rx = L.prescription(ex, prefs.progressionStyle);
    const rows = e.sets.map((s, si) => {
      const wIn = h('input.num', { type: 'text', inputmode: 'decimal', value: s.weight ?? '', placeholder: isLoaded(ex) ? 'lb' : '0', 'aria-label': `Set ${si + 1} weight`,
        oninput: (ev) => { s.weight = parseNum(ev.target.value); touch(); } });
      const rIn = h('input.num', { type: 'text', inputmode: 'numeric', value: (timed ? s.seconds : s.reps) ?? '', placeholder: timed ? 'sec' : 'reps', 'aria-label': `Set ${si + 1} ${timed ? 'seconds' : 'reps'}`,
        oninput: (ev) => { const n = parseNum(ev.target.value); if (timed) s.seconds = n; else s.reps = n; touch(); } });
      for (const el of [wIn, rIn]) el.addEventListener('focus', () => el.select());
      return h('div.set-row.log-row',
        h('span.set-label', String(si + 1)), wIn, rIn,
        h('button.icon-btn.small-x', { 'aria-label': `Remove set ${si + 1}`, onclick: () => { e.sets.splice(si, 1); if (!e.sets.length) draft.entries.splice(ei, 1); touch(); draw(); } }, '✕'));
    });
    return h('div.card.entry',
      h('div.spread',
        h('div', h('div.entry-name', ex.name), h('div.small.faint', `Usually ${L.describeRx(rx, ex)}`)),
        h('button.icon-btn', { 'aria-label': `Remove ${ex.name}`, onclick: async () => {
          if (e.sets.some((s) => s.reps || s.seconds) && !(await confirm(`Remove ${ex.name}?`, 'Its sets in this workout will be removed.', { ok: 'Remove', danger: true }))) return;
          draft.entries.splice(ei, 1); touch(); draw();
        } }, '✕')),
      h('div.sets',
        h('div.set-row.log-row.set-headrow', h('span', 'Set'), h('span', ex.load === 'bodyweight' ? '+lb' : 'lb'), h('span', timed ? 'sec' : 'reps'), h('span', '')),
        rows,
        h('button.btn.small-btn', { style: { marginTop: '8px' }, onclick: () => {
          const last = e.sets[e.sets.length - 1];
          e.sets.push({ id: null, weight: last?.weight ?? null, reps: null, seconds: null }); touch(); draw();
        } }, '+ Set')));
  }

  draw();
  return root;
}
