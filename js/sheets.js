// Shared sheets: pick an exercise, and one exercise's full history.
import { h, icon, sheet, toast } from './ui.js';
import * as L from './data/lookup.js';
import * as W from './workout.js';
import * as Prefs from './prefs.js';
import { MUSCLES, PATTERNS, LOAD_TYPES } from './data/taxonomy.js';
import { longDate } from './util.js';

const muscleList = (ids) => ids.map((m) => MUSCLES[m]?.name || m).join(', ');

/** Pick exercises. onPick(ex) runs for each tap; the sheet stays open until Done. */
export function pickExercise({ title = 'Add exercise', onPick, profileId = 'all', multi = true }) {
  const prefs = Prefs.get();
  let q = '', prof = profileId;
  return sheet((close) => {
    const list = h('div.list');
    const draw = () => {
      const profile = prefs.profiles.find((p) => p.id === prof);
      const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
      const items = L.allExercises({ includeHidden: false }).filter((ex) => {
        if (profile && !L.isAvailable(ex, profile.equipment)) return false;
        const hay = [ex.name, ...ex.primary.map((m) => MUSCLES[m]?.name), PATTERNS[ex.pattern]?.name, LOAD_TYPES[ex.load]].join(' ').toLowerCase();
        return words.every((w) => hay.includes(w));
      }).sort((a, b) => a.name.localeCompare(b.name)).slice(0, 60);
      list.replaceChildren(...(items.length ? items.map((ex) => h('button.item', { onclick: async () => {
        await onPick(ex);
        if (!multi) close(ex); else toast(`Added ${ex.name}`);
      } },
        h('div.grow', h('div', { style: { fontWeight: 600 } }, ex.name), h('div.sub', `${muscleList(ex.primary)} · ${LOAD_TYPES[ex.load]}`)),
        h('span.add-plus', '+'))) : [h('div.item.muted', 'No exercises match')]));
    };
    const search = h('input', { type: 'search', placeholder: 'Search exercises or muscles', oninput: (e) => { q = e.target.value; draw(); } });
    const chips = h('div.chips', [['all', 'All'], ...prefs.profiles.map((p) => [p.id, p.name])].map(([id, name]) =>
      h('button.chip', { type: 'button', 'aria-pressed': String(prof === id), onclick: (e) => {
        prof = id; for (const c of e.currentTarget.parentElement.children) c.setAttribute('aria-pressed', 'false');
        e.currentTarget.setAttribute('aria-pressed', 'true'); draw();
      } }, name)));
    draw();
    return h('div.stack', h('div.spread', h('h2', title), h('button.btn', { onclick: () => close() }, 'Done')), search, chips, list);
  }, { label: title });
}

export const fmtSet = (s) => {
  if (s.seconds != null) return `${s.weight ? `${s.weight} lb · ` : ''}${s.seconds} s`;
  if (s.weight != null && s.weight !== 0) return `${s.weight} × ${s.reps ?? '–'}`;
  return `${s.reps ?? '–'} reps`;
};

/** Every time you've done this exercise, newest first. */
export async function exerciseHistorySheet(exerciseId) {
  const ex = L.exercise(exerciseId);
  const hist = await W.exerciseHistory(exerciseId);
  const best = W.bestSet(hist.flatMap((x) => x.sets));
  await sheet((close) => h('div.stack',
    h('div', h('div.kicker.faint.small', 'Exercise history'), h('h2', ex?.name || L.exerciseName(exerciseId))),
    hist.length
      ? h('div.stat-grid',
        h('div.stat', h('div.v', hist.length), h('div.l', 'Workouts')),
        h('div.stat', h('div.v', best ? fmtSet(best) : '–'), h('div.l', 'Best set')),
        h('div.stat', h('div.v', longDate(hist[0].date).split(', ')[1]), h('div.l', 'Last done')))
      : h('div.card.empty', h('p', { style: { margin: 0 } }, 'You haven’t logged this exercise yet.')),
    hist.map((x) => h('div.card',
      h('div.spread', h('h3', longDate(x.date)), h('span.small.faint', x.title || '')),
      h('div.set-chips', x.sets.map((s) => h('span.pill', fmtSet(s)))))),
    h('p.small.faint', 'Warm-up sets aren’t shown or counted.'),
    h('button.btn.block', { onclick: () => close() }, 'Close')), { label: 'Exercise history' });
}
