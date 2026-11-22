// History: month calendar of trained days; tap a day to see its workouts.
import { h, icon, sheet } from '../ui.js';
import * as Hist from '../history-read.js';
import { localDate, monthName, longDate, duration, clockTime } from '../util.js';
import { exerciseName } from '../data/lookup.js';

let view = null; // {y, m, selected} survives re-renders

export default async function history() {
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
        ? h('div.list', daySessions.map((s) => h('button.item', { onclick: () => detail(s) },
          h('div.grow', h('div', { style: { fontWeight: 650 } }, s.title || 'Workout'),
            h('div.sub', [s.startedAt && clockTime(s.startedAt), s.durationMin != null && duration(s.durationMin), (() => { const n = (s.entries || []).length; return `${n} exercise${n === 1 ? '' : 's'}`; })()].filter(Boolean).join(' · '))),
          icon('chevron', 'chev'))))
        : h('div.card.empty', h('p', { style: { margin: 0 } }, view.selected > t ? 'This day hasn’t happened yet.' : 'No workout this day. Rest days are part of training.')),
    );
  };
  draw();
  return root;
}

async function detail(s) {
  const sets = await Hist.setsForSession(s.id);
  const byEntry = new Map();
  for (const x of sets) { if (!byEntry.has(x.entryId)) byEntry.set(x.entryId, []); byEntry.get(x.entryId).push(x); }
  await sheet((close) => h('div.stack',
    h('div', h('div.kicker.faint.small', longDate(s.date)), h('h2', s.title || 'Workout')),
    h('div.row', { style: { flexWrap: 'wrap' } },
      s.startedAt && h('span.pill', `Started ${clockTime(s.startedAt)}`),
      s.durationMin != null && h('span.pill', duration(s.durationMin))),
    (s.entries || []).map((e) => {
      const list = (byEntry.get(e.id) || []).filter((x) => x.completed);
      return h('div.card',
        h('h3', exerciseName(e.exerciseId)),
        e.skipped && h('div.small.faint', 'Skipped'),
        list.map((x) => h('div.spread.small', { style: { padding: '4px 0' } },
          h('span.muted', x.kind === 'warmup' ? 'Warm-up' : `Set ${x.idx + 1}`),
          h('span', x.weight != null ? `${x.weight} lb × ${x.reps}` : `${x.reps} reps`))));
    }),
    s.checkin?.notes && h('p.muted.small', `Check-in: ${s.checkin.notes}`),
    s.notes && h('p.muted', s.notes),
    h('button.btn.block', { onclick: () => close() }, 'Close')), { label: 'Workout details' });
}
