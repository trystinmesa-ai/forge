// Progress: totals and consistency from real history. Charts and records come in Phase 5.
import { h } from '../ui.js';
import * as Hist from '../history-read.js';
import * as DB from '../db.js';

export default async function progress() {
  const sessions = await Hist.completedSessions();
  const sum = Hist.summary(sessions);
  const ids = new Set(sessions.map((s) => s.id));
  const sets = (await DB.all('sets')).filter((x) => ids.has(x.sessionId) && x.completed && x.kind === 'working');
  const volume = sets.reduce((a, x) => a + (x.weight || 0) * (x.reps || 0), 0);

  return h('div',
    h('header.screen-head', h('div', h('div.eyebrow', 'Over months and years'), h('h1', 'Progress'))),
    h('div.stat-grid',
      h('div.stat', h('div.v', sum.total), h('div.l', 'Workouts')),
      h('div.stat', h('div.v', sum.avgPerWeek4.toFixed(1)), h('div.l', 'Per week (4 wk)')),
      h('div.stat', h('div.v', sets.length), h('div.l', 'Working sets'))),
    h('div.section-label', 'Total volume'),
    h('div.card', h('div.spread', h('span.muted', 'Weight × reps, working sets only'), h('strong', { style: { whiteSpace: 'nowrap' } }, `${Math.round(volume).toLocaleString()} lb`))),
    !sum.total && h('div.card.empty', { style: { marginTop: '12px' } },
      h('h3', 'Nothing to chart yet'),
      h('p', { style: { margin: 0 } }, 'Strength trends, personal records and monthly consistency will appear here as you log workouts.')));
}
