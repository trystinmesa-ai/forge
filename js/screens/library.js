// Exercise library: search, group by muscle / pattern / equipment, filter to an
// equipment setup, and open any exercise for details, cues and alternatives.
import { h, icon, seg, sheet, toast, toggle } from '../ui.js';
import * as DB from '../db.js';
import * as Prefs from '../prefs.js';
import * as L from '../data/lookup.js';
import { MUSCLES, PATTERNS, EQUIPMENT, CATEGORIES, MOBILITY_AREAS, DIFFICULTY, LOAD_TYPES } from '../data/taxonomy.js';
import { muscleMap } from '../musclemap.js';

const state = { q: '', group: 'muscle', profile: 'all' };

const muscleList = (ids) => ids.map((m) => MUSCLES[m]?.name || m).join(', ');

function groups(list) {
  const out = new Map();
  const add = (key, label, ex) => { if (!out.has(key)) out.set(key, { label, items: [] }); out.get(key).items.push(ex); };
  if (state.group === 'muscle') {
    for (const k of Object.keys(MUSCLES)) out.set(k, { label: MUSCLES[k].name, items: [] });
    out.set('_mobility', { label: 'Mobility', items: [] });
    for (const ex of list) {
      if (ex.cat === 'mobility') add('_mobility', 'Mobility', ex);
      else for (const m of ex.primary) add(m, MUSCLES[m]?.name || m, ex);
    }
  } else if (state.group === 'pattern') {
    for (const k of Object.keys(PATTERNS)) out.set(k, { label: PATTERNS[k].name, items: [] });
    for (const ex of list) add(ex.pattern, PATTERNS[ex.pattern]?.name || ex.pattern, ex);
  } else {
    for (const k of Object.keys(LOAD_TYPES)) out.set(k, { label: LOAD_TYPES[k], items: [] });
    for (const ex of list) add(ex.load, LOAD_TYPES[ex.load] || ex.load, ex);
  }
  return [...out.values()].filter((g) => g.items.length);
}

export default async function library() {
  const prefs = Prefs.get();
  const root = h('div');
  const all = L.allExercises();

  const listWrap = h('div');
  const countEl = h('div.eyebrow');
  const drawList = () => {
    const q = state.q.trim().toLowerCase();
    const profile = prefs.profiles.find((p) => p.id === state.profile);
    const list = all.filter((ex) => {
      if (profile && !L.isAvailable(ex, profile.equipment)) return false;
      if (!q) return true;
      const hay = [ex.name, ...ex.primary.map((m) => MUSCLES[m]?.name), PATTERNS[ex.pattern]?.name, LOAD_TYPES[ex.load]].join(' ').toLowerCase();
      return q.split(/\s+/).every((w) => hay.includes(w));
    });
    countEl.textContent = `${list.length} of ${all.length} exercises`;
    const gs = groups(list);
    listWrap.replaceChildren(...(gs.length ? gs.flatMap((g) => [
      h('div.section-label', g.label, h('span.faint', { style: { marginLeft: '6px' } }, g.items.length)),
      h('div.list', g.items.sort((a, b) => a.name.localeCompare(b.name)).map((ex) => {
        const ov = L.override(ex.id);
        return h('button.item', { onclick: () => openExercise(ex.id, drawList) },
          h('div.grow',
            h('div', { style: { fontWeight: 600, opacity: ov?.hidden ? 0.5 : 1 } }, ex.name),
            h('div.sub', [muscleList(ex.primary), LOAD_TYPES[ex.load], ex.uni && 'one side at a time', ov?.hidden && 'hidden'].filter(Boolean).join(' · '))),
          icon('chevron', 'chev'));
      })),
    ]) : [h('div.card.empty', { style: { marginTop: '12px' } }, h('p', { style: { margin: 0 } }, 'No exercises match.'))]));
  };

  const search = h('input.search', {
    type: 'search', placeholder: 'Search exercises or muscles', value: state.q, autocomplete: 'off', 'aria-label': 'Search exercises',
    oninput: (e) => { state.q = e.target.value; drawList(); },
  });
  const chips = h('div.chips', { role: 'group', 'aria-label': 'Equipment filter' },
    [['all', 'All equipment'], ...prefs.profiles.map((p) => [p.id, p.name])].map(([id, name]) =>
      h('button.chip', { type: 'button', 'aria-pressed': String(state.profile === id), onclick: (e) => {
        state.profile = id;
        for (const c of e.currentTarget.parentElement.children) c.setAttribute('aria-pressed', 'false');
        e.currentTarget.setAttribute('aria-pressed', 'true');
        drawList();
      } }, name)));

  root.append(
    h('header.screen-head', h('div', countEl, h('h1', 'Library'))),
    h('div.stack', search, chips,
      seg([['muscle', 'Muscle'], ['pattern', 'Movement'], ['equipment', 'Equipment']], state.group, (v) => { state.group = v; drawList(); })),
    listWrap);
  drawList();
  return root;
}

// ───────── Exercise detail ─────────
async function saveOverride(id, patch) {
  const cur = (await DB.get('overrides', id)) || { exerciseId: id };
  const next = { ...cur, ...patch };
  await DB.put('overrides', next);
  L.setOverrides(await DB.all('overrides'));
  return next;
}

export async function openExercise(id, onChange = () => {}) {
  const ex = L.exercise(id);
  if (!ex) { toast('That exercise isn’t in the library anymore', { error: true }); return; }
  const prefs = Prefs.get();
  const rx = L.prescription(ex, prefs.progressionStyle);
  const ov = L.override(id) || {};
  let next = null;

  await sheet((close) => {
    const videoInput = h('input', { type: 'url', placeholder: 'Paste a video link (YouTube, etc.)', value: ov.videoUrl || '', inputmode: 'url', autocapitalize: 'off' });
    const notes = h('textarea', { rows: 2, placeholder: 'Your notes: seat setting, grip, what to watch for…' });
    notes.value = ov.notes || '';
    const watch = h('div');
    const drawWatch = (url) => watch.replaceChildren(url
      ? h('a.btn.primary.block', { href: url, target: '_blank', rel: 'noopener noreferrer' }, 'Watch your video')
      : h('span'));
    drawWatch(ov.videoUrl);

    const saveVideo = async () => {
      const v = videoInput.value.trim();
      if (v && !/^https:\/\/\S+$/i.test(v)) { toast('Use a full link starting with https://', { error: true }); return; }
      await saveOverride(id, { videoUrl: v || null });
      drawWatch(v); toast(v ? 'Video saved' : 'Video removed');
    };

    const alts = L.alternatives(ex);
    const ytSearch = `https://www.youtube.com/results?search_query=${encodeURIComponent(`${ex.name} technique`)}`;
    const effort = L.describeEffort(rx, ex);

    return h('div.stack',
      h('div',
        h('h2', ex.name),
        h('div.row', { style: { flexWrap: 'wrap', gap: '6px', marginTop: '6px' } },
          h('span.pill', CATEGORIES[ex.cat]?.name),
          h('span.pill', DIFFICULTY[ex.diff]),
          ex.uni && h('span.pill', 'One side at a time'),
          ex.heavy && h('span.pill.warn', 'Heavy lift'),
          ov.hidden && h('span.pill', 'Hidden'))),

      h('div.card.mm-card',
        muscleMap(ex.primary, ex.secondary, { label: `${ex.name}: ${muscleList(ex.primary)}` }),
        h('div.mm-legend',
          h('div', h('span.mm-dot.primary'), h('b', 'Primary '), muscleList(ex.primary)),
          ex.secondary.length > 0 && h('div', h('span.mm-dot.secondary'), h('b', 'Also '), muscleList(ex.secondary)),
          ex.area && h('div.faint', `Loosens: ${ex.area.map((a) => MOBILITY_AREAS[a]?.name || a).join(', ')}`))),

      h('div.card',
        h('div.kicker', rx.style === 'classic' ? 'Your 15 / 12 / max scheme' : 'Typical session'),
        h('div.rx', L.describeRx(rx, ex)),
        rx.restSec > 0 && h('div.muted.small', `Rest about ${rx.restSec >= 120 ? `${(rx.restSec / 60).toFixed(rx.restSec % 60 ? 1 : 0)} min` : `${rx.restSec} s`} between sets`),
        effort && h('div.muted.small', { style: { marginTop: '4px' } }, effort),
        ex.heavy && prefs.progressionStyle === 'classic' && h('div.small.faint', { style: { marginTop: '6px' } }, 'Heavy barbell lifts keep conservative ranges, even with the 15 / 12 / max setting.')),

      h('div.card',
        h('div.kicker', 'How to do it'),
        h('ol.cues', ex.cues.map((c) => h('li', c))),
        h('div.small.faint', 'Cues written for this app from standard coaching points. Learn heavy or technical lifts in person when you can.')),

      h('div.card.stack',
        h('div.kicker', { style: { margin: 0 } }, 'Demonstration'),
        watch,
        h('div.row', videoInput, h('button.btn', { onclick: saveVideo }, 'Save')),
        h('a.small', { href: ytSearch, target: '_blank', rel: 'noopener noreferrer' }, 'Find a technique video on YouTube ↗')),

      h('div.card.stack',
        h('div.kicker', { style: { margin: 0 } }, 'Notes'),
        notes,
        h('button.btn', { onclick: async () => { await saveOverride(id, { notes: notes.value.trim() || null }); toast('Notes saved'); } }, 'Save notes')),

      h('div.list',
        h('div.item', h('div.grow', h('div', 'Equipment'), h('div.sub', ex.eq.map((e) => EQUIPMENT[e]?.name || e).join(' + ')))),
        h('div.item', h('div.grow', h('div', 'Movement pattern'), h('div.sub', PATTERNS[ex.pattern]?.name))),
        ex.stress.length > 0 && h('div.item', h('div.grow', h('div', 'Loads these areas'), h('div.sub', `${ex.stress.join(', ')}. Swapped out if you report pain there.`))),
        h('div.item', h('div.grow', h('div', 'Hide from recommendations'), h('div.sub', 'It stays in your history and the library')),
          toggle(!!ov.hidden, async (v) => { await saveOverride(id, { hidden: v }); onChange(); toast(v ? 'Won’t be recommended' : 'Can be recommended again'); }, 'Hide from recommendations'))),

      alts.length > 0 && h('div',
        h('div.section-label', { style: { marginTop: '6px' } }, 'Alternatives'),
        h('div.list', alts.map((a) => h('button.item', { onclick: () => { next = a.id; close(); } },
          h('div.grow', h('div', { style: { fontWeight: 600 } }, a.name), h('div.sub', `${muscleList(a.primary)} · ${a.eq.map((e) => EQUIPMENT[e]?.name).join(' + ')}`)),
          icon('chevron', 'chev'))))),

      h('button.btn.block.ghost', { onclick: () => close() }, 'Close'));
  }, { label: ex.name });

  onChange();
  if (next) openExercise(next, onChange);
}
