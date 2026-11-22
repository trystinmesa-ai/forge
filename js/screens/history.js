// History: month calendar of trained days; tap a day to see its workouts.
import { h, icon, sheet, confirm, toast } from '../ui.js';
import * as DB from '../db.js';
import { REGIONS } from '../data/taxonomy.js';
import { exerciseHistorySheet, fmtSet } from '../sheets.js';
import * as Hist from '../history-read.js';
import { localDate, monthName, longDate, duration, clockTime } from '../util.js';
import { exerciseName } from '../data/lookup.js';

let view = null; // {y, m, selected} survives re-renders

/** Open History on a given day (e.g. after saving a workout for it). */
export function focusDay(date) {
  const [y, m] = date.split('-').map(Number);
  view = { y, m: m - 1, selected: date };
}

export default async function history({ refresh, go }) {
  const sessions = await Hist.completedSessions();
  const map = Hist.byDate(sessions);
  const t = localDate();
  if (!view) { const d = new Date(); view = { y: d.getFullYear(), m: d.getMonth(), selected: t }; }

  const root = h('div');
  const draw = () => {
    const first = new Date(view.y, view.m, 1);
    const lead = (first.getDay() + 6) % 7; // weeks start Monday for display only
    const daysIn = new Date(view.y, view.m + 1, 0).getDate();
    const cal = h('div.cal', ['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d) => h('div.dow', d)));
    for (let i = 0; i < lead; i++) cal.append(h('div.day.out'));
    let monthCount = 0;
    for (let d = 1; d <= daysIn; d++) {
      const key = localDate(new Date(view.y, view.m, d));
      const has = map.get(key);
      if (has) monthCount += has.length;
      const cls = [has && 'trained', key === t && 'today', key === view.selected && 'selected', key > t && 'future'].filter(Boolean).join(' ');
      cal.append(h('button.day', { class: cls, 'aria-label': `${longDate(key)}${has ? ', trained' : ''}`, onclick: () => { view.selected = key; draw(); } }, d));
    }
    const shift = (n) => { const d = new Date(view.y, view.m + n, 1); view.y = d.getFullYear(); view.m = d.getMonth(); draw(); };
    const daySessions = map.get(view.selected) || [];

    root.replaceChildren(
      h('header.screen-head', h('div', h('div.eyebrow', `${sessions.length} workout${sessions.length === 1 ? '' : 's'} logged`), h('h1', 'History'))),
      h('div.card',
        h('div.cal-head',
          h('button.icon-btn', { 'aria-label': 'Previous month', onclick: () => shift(-1) }, icon('left')),
          h('div', { style: { textAlign: 'center' } }, h('h2', monthName(view.y, view.m)), h('div.small.faint', `${monthCount} session${monthCount === 1 ? '' : 's'}`)),
          h('button.icon-btn', { 'aria-label': 'Next month', onclick: () => shift(1) }, icon('right'))),
        cal),
      h('div.section-label', longDate(view.selected)),
      daySessions.length
        ? h('div.list', daySessions.map((s) => h('button.item', { onclick: () => detail(s, refresh, go) },
          h('div.grow', h('div', { style: { fontWeight: 650 } }, s.title || 'Workout'),
            h('div.sub', [s.startedAt && clockTime(s.startedAt), s.durationMin != null && duration(s.durationMin), (() => { const n = (s.entries || []).length; return `${n} exercise${n === 1 ? '' : 's'}`; })()].filter(Boolean).join(' · '))),
          icon('chevron', 'chev'))))
        : h('div.card.empty', h('p', { style: { margin: 0 } }, view.selected > t ? 'This day hasn’t happened yet.' : 'No workout this day. Rest days are part of training.')),
      view.selected <= t && h('button.btn.block', { style: { marginTop: '10px' }, onclick: () => go('log', 'new', view.selected) },
        daySessions.length ? '+ Add another workout this day' : '+ Add a workout you did this day'),
    );
  };
  draw();
  return root;
}

export async function detail(s, refresh, go) {
  const sets = await Hist.setsForSession(s.id);
  const prSets = new Map((await Hist.allRecords()).filter((r) => r.sessionId === s.id).map((r) => [r.setId, r]));
  const byEntry = new Map();
  for (const x of sets) { if (!byEntry.has(x.entryId)) byEntry.set(x.entryId, []); byEntry.get(x.entryId).push(x); }
  const regions = (list) => (list || []).map((r) => REGIONS[r]?.name || r).join(', ');
  const entries = (s.entries || []).slice().sort((a, b) => a.order - b.order);
  let deleted = false;
  await sheet((close) => h('div.stack',
    h('div', h('div.kicker.faint.small', longDate(s.date)), h('h2', s.title || 'Workout')),
    h('div.row', { style: { flexWrap: 'wrap' } },
      s.startedAt && h('span.pill', `Started ${clockTime(s.startedAt)}`),
      s.durationMin != null && h('span.pill', duration(s.durationMin)),
      h('span.pill', `${sets.filter((x) => x.kind === 'working').length} working sets`),
      prSets.size > 0 && h('span.pill.accent', `${prSets.size} record${prSets.size === 1 ? '' : 's'}`)),
    entries.map((e) => {
      const list = (byEntry.get(e.id) || []).filter((x) => x.completed);
      if (!list.length && !e.skipped) return null;
      let w = 0;
      return h('div.card',
        h('button.entry-name', { onclick: () => exerciseHistorySheet(e.exerciseId) }, exerciseName(e.exerciseId)),
        e.replacedFrom && h('div.small.faint', `Replaced ${exerciseName(e.replacedFrom)}`),
        !list.length && h('div.small.faint', 'Skipped'),
        list.map((x) => h('div.spread.small', { style: { padding: '4px 0' } },
          h('span.muted', x.kind === 'warmup' ? `Warm-up ${++w}` : `Set ${x.idx + 1}`),
          h('span', fmtSet(x), prSets.has(x.id) && h('span.pr-badge', { title: 'Personal record' }, 'PR')))));
    }),
    (s.checkin?.sore?.length || s.checkin?.pain?.length || s.checkin?.notes) && h('div.card',
      h('div.kicker', 'Check-in'),
      s.checkin.sore?.length > 0 && h('div.small', h('span.muted', 'Sore: '), regions(s.checkin.sore)),
      s.checkin.pain?.length > 0 && h('div.small', h('span.muted', 'Pain/discomfort: '), regions(s.checkin.pain)),
      s.checkin.notes && h('div.small.muted', s.checkin.notes)),
    s.notes && h('div.card', h('div.kicker', 'Notes'), h('p', { style: { margin: 0 } }, s.notes)),
    h('p.small.faint', { style: { margin: 0 } }, 'Tap an exercise to see its full history.'),
    h('button.btn.primary.block', { onclick: () => { close(); go('log', s.id); } }, 'Edit workout'),
    h('button.btn.block', { onclick: () => close() }, 'Close'),
    h('button.btn.ghost.block', { style: { color: 'var(--danger)' }, onclick: async () => {
      if (!(await confirm('Delete this workout?', `${longDate(s.date)}: all of its sets will be permanently deleted${' '}(also from your account if you sync). Export a backup first if unsure.`, { ok: 'Delete workout', danger: true }))) return;
      await DB.deleteSession(s.id); deleted = true; close();
    } }, 'Delete workout')), { label: 'Workout details' });
  if (deleted) { toast('Workout deleted'); refresh(); }
}

/** One day's workouts, with a way to add one you did. Used by Today's 7-day strip. */
export async function daySheet(date, { go, refresh }) {
  const list = (await Hist.completedSessions()).filter((s) => s.date === date);
  const past = date <= localDate();
  await sheet((close) => h('div.stack',
    h('h2', longDate(date)),
    list.length
      ? h('div.list', list.map((s) => h('button.item', { onclick: () => { close(); detail(s, refresh, go); } },
        h('div.grow', h('div', { style: { fontWeight: 650 } }, s.title || 'Workout'),
          h('div.sub', [s.durationMin != null && duration(s.durationMin), `${(s.entries || []).filter((e) => !e.skipped).length} exercises`].filter(Boolean).join(' · '))),
        icon('chevron', 'chev'))))
      : h('p.muted', { style: { margin: 0 } }, 'No workout logged this day.'),
    past && h('button.btn.primary.block', { onclick: () => { close(); go('log', 'new', date); } }, list.length ? '+ Add another workout' : '+ Add a workout you did'),
    h('button.btn.ghost.block', { onclick: () => close() }, 'Close')), { label: longDate(date) });
}
