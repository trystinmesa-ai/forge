// Progress: how training is going over weeks, months and years. Strength trends,
// personal records, consistency and weekly muscle volume, all from logged sets.
// No streaks: a missed day or week never resets or shames anything.
import { h, seg } from '../ui.js';
import * as Hist from '../history-read.js';
import * as DB from '../db.js';
import * as Prefs from '../prefs.js';
import * as L from '../data/lookup.js';
import * as Stats from '../stats.js';
import * as Chart from '../charts.js';
import { MUSCLES } from '../data/taxonomy.js';
import { exerciseHistorySheet } from '../sheets.js';
import { localDate, shortDate, duration, monthName } from '../util.js';

const state = { exercise: null, range: 12 };
const compact = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 10000 ? `${(n / 1000).toFixed(n >= 1e5 ? 0 : 1)}K` : Math.round(n).toLocaleString());

function delta(now, before, unit = '') {
  if (!before && !now) return null;
  if (!before) return 'first 4 weeks';
  const d = now - before;
  if (Math.abs(d) < 0.05 * before) return 'same as prior 4 wk';
  return `${d > 0 ? '+' : '−'}${compact(Math.abs(d))}${unit} vs prior 4 wk`;
}

export default async function progress({ refresh }) {
  const prefs = Prefs.get();
  const today = localDate();
  const sessions = await Hist.completedSessions();
  const byId = new Map(sessions.map((s) => [s.id, s]));
  const sets = (await DB.all('sets')).filter((x) => byId.has(x.sessionId) && x.completed);
  const workingSets = sets.filter((x) => x.kind === 'working');
  const head = h('header.screen-head', h('div', h('div.eyebrow', 'Over weeks, months and years'), h('h1', 'Progress')));

  if (!sessions.length) {
    return h('div', head, h('div.card.empty',
      h('h3', 'Nothing to chart yet'),
      h('p', { style: { margin: 0 } }, 'Strength trends, personal records and monthly consistency appear here as you log workouts. Nothing is estimated before you’ve lifted it.')));
  }

  const bySession = new Map();
  for (const x of sets) { if (!bySession.has(x.sessionId)) bySession.set(x.sessionId, []); bySession.get(x.sessionId).push(x); }
  const history = sessions.map((session) => ({ session, sets: bySession.get(session.id) || [] }));
  const tr = Stats.trend(history, today);
  const totalVolume = workingSets.reduce((a, x) => a + (x.weight || 0) * (x.reps || 0), 0);
  const totalMin = sessions.reduce((a, s) => a + (s.durationMin || 0), 0);

  // ── Last 4 weeks ──
  const tiles = h('div.stat-grid',
    h('div.stat', h('div.v', (tr.now.workouts / 4).toFixed(1)), h('div.l', 'Workouts / week'), h('div.d', `aim ~${prefs.targetSessionsPerWeek}`)),
    h('div.stat', h('div.v', compact(tr.now.sets)), h('div.l', 'Working sets'), h('div.d', delta(tr.now.sets, tr.before.sets) || '')),
    h('div.stat', h('div.v', tr.now.minutes >= 60 ? `${(tr.now.minutes / 60).toFixed(tr.now.minutes >= 600 ? 0 : 1)} h` : `${tr.now.minutes} m`), h('div.l', 'Time training'), h('div.d', delta(tr.now.minutes, tr.before.minutes, ' min') || '')));

  // ── Workouts per week ──
  const weeks = Stats.weekly(sessions, today, state.range);
  const weekChart = Chart.columns({
    label: `Workouts per week, last ${state.range} weeks`,
    valueName: 'Workouts',
    minTop: prefs.targetSessionsPerWeek,
    ref: { value: prefs.targetSessionsPerWeek, label: `aim ${prefs.targetSessionsPerWeek}` },
    data: weeks.map((w, i) => ({
      label: `${shortDate(w.start)}–${shortDate(w.end)}`,
      value: w.count,
      tip: `${shortDate(w.start)}–${shortDate(w.end)}: ${w.count} workout${w.count === 1 ? '' : 's'}${w.minutes ? ` · ${duration(w.minutes)}` : ''}`,
      axis: i === weeks.length - 1 ? 'This wk' : (weeks.length - 1 - i) % 4 === 0 ? `${weeks.length - 1 - i}w ago` : '',
    })),
  });
  const rangeSeg = seg([[12, '12 weeks'], [26, '6 months'], [52, 'Year']], state.range, (v) => { state.range = v; refresh(); });

  // ── By month ──
  const months = Stats.monthly(sessions, today, 6);
  const monthChart = Chart.columns({
    label: 'Workouts per month, last 6 months', valueName: 'Workouts', height: 130,
    data: months.map((m) => ({
      label: monthName(m.y, m.m), value: m.count, faded: m.partial,
      tip: `${monthName(m.y, m.m)}: ${m.count} workout${m.count === 1 ? '' : 's'} · ${m.perWeek.toFixed(1)}/week${m.partial ? ' so far' : ''}`,
      axis: monthName(m.y, m.m).slice(0, 3),
    })),
  });

  // ── Strength ──
  const top = Stats.topExercises(sets, byId, 8);
  if (!state.exercise || !top.some((t) => t.id === state.exercise)) state.exercise = top[0]?.id || null;
  const strength = h('div');
  const drawStrength = () => {
    const id = state.exercise;
    if (!id) { strength.replaceChildren(h('p.muted.small', 'Log a few workouts to see strength trends.')); return; }
    const tl = Stats.timeline(id, sets.filter((x) => x.exerciseId === id), byId);
    const metric = tl[0]?.metric || 'weight';
    const usesE1rm = metric === 'weight' && tl.some((p) => p.e1rm);
    const unit = metric === 'time' ? ' s' : metric === 'reps' ? '' : ' lb';
    const points = tl.map((p) => ({
      x: p.date, y: Stats.chartValue(p),
      tip: metric === 'weight' ? `best ${p.topWeight} × ${p.topReps}${p.e1rm ? ` · est. max ${p.e1rm} lb` : ''}` : `${Stats.chartValue(p)}${unit}`,
    }));
    const first = points[0], last = points[points.length - 1];
    const change = points.length > 1 ? last.y - first.y : 0;
    strength.replaceChildren(
      h('div.spread', { style: { alignItems: 'baseline' } },
        h('button.entry-name', { onclick: () => exerciseHistorySheet(id) }, L.exerciseName(id)),
        points.length > 1 && h('span.small.muted', { style: { whiteSpace: 'nowrap' } }, `${change >= 0 ? '+' : '−'}${Math.abs(change)}${unit} since ${shortDate(first.x)}`)),
      h('div.small.faint', { style: { margin: '2px 0 8px' } }, usesE1rm
        ? 'Estimated 1-rep max per workout (Epley formula, an estimate from sets of 12 reps or fewer).'
        : metric === 'weight' ? 'Heaviest weight per workout.' : metric === 'reps' ? 'Most reps in a set per workout.' : 'Longest set per workout.'),
      points.length > 1
        ? Chart.line({ points, unit, label: `${L.exerciseName(id)} over time`, valueName: usesE1rm ? 'Est. max' : 'Best' })
        : h('p.small.muted', 'Only one workout so far. The trend appears after the next one.'));
  };
  const picker = h('div.chips', top.map((t) => h('button.chip', { type: 'button', 'aria-pressed': String(t.id === state.exercise), onclick: (e) => {
    state.exercise = t.id;
    for (const c of e.currentTarget.parentElement.children) c.setAttribute('aria-pressed', 'false');
    e.currentTarget.setAttribute('aria-pressed', 'true');
    drawStrength();
  } }, L.exerciseName(t.id))));
  drawStrength();

  // ── Records ──
  // Most recent record per exercise, newest first.
  const seen = new Set();
  const recs = Stats.records(sets, byId).reverse().filter((r) => !seen.has(r.exerciseId) && seen.add(r.exerciseId));
  const recList = recs.slice(0, 8).map((r) => h('button.item', { onclick: () => exerciseHistorySheet(r.exerciseId) },
    h('div.grow', h('div', { style: { fontWeight: 600 } }, L.exerciseName(r.exerciseId)),
      h('div.sub', `${Stats.RECORD_LABEL[r.kind]}: ${Stats.describeRecord(r)} · was ${r.prev}${r.kind === 'time' ? ' s' : r.kind === 'reps' ? '' : ' lb'}`)),
    h('span.small.faint', { style: { whiteSpace: 'nowrap' } }, shortDate(r.date))));

  // ── Muscle volume this week ──
  const mw = Stats.muscleWeek(history, today);
  const muscleRows = Object.keys(MUSCLES).map((m) => ({ m, label: MUSCLES[m].name, value: Math.round((mw[m] || 0) * 2) / 2 }))
    .filter((r) => MUSCLES[r.m].size !== 'small' || r.value > 0)
    .map((r) => ({ ...r, tip: `${r.label}: ${r.value} hard set${r.value === 1 ? '' : 's'} in 7 days` }));

  return h('div', head,
    h('div.section-label', 'Last 4 weeks'),
    tiles,
    h('div.section-label', 'Workouts per week'),
    h('div.card.stack', rangeSeg, weekChart,
      h('p.small.faint', { style: { margin: 0 } }, 'Rolling 7-day windows ending today. The aim is a guide, not a target to hit every week.')),
    h('div.section-label', 'By month'),
    h('div.card', monthChart),
    h('div.section-label', 'Strength'),
    top.length ? h('div.stack', picker, h('div.card', strength)) : h('div.card', h('p.muted.small', { style: { margin: 0 } }, 'Log a few workouts to see strength trends.')),
    h('div.section-label', 'Latest personal records'),
    recList.length ? h('div.list', recList) : h('div.card', h('p.muted.small', { style: { margin: 0 } }, 'Records appear when you beat a previous best. Your first time on an exercise sets the baseline.')),
    h('div.section-label', 'Hard sets per muscle, last 7 days'),
    h('div.card',
      Chart.bars({ rows: muscleRows, band: [Stats.WEEKLY_SET_TARGET, Stats.WEEKLY_SET_CAP], label: 'Hard sets per muscle in the last 7 days', valueName: 'Sets' }),
      h('p.small.faint', { style: { margin: '6px 0 0' } }, `Shaded: ${Stats.WEEKLY_SET_TARGET}–${Stats.WEEKLY_SET_CAP} sets a week, the commonly used working range (Schoenfeld et al. 2017). Secondary muscles count half. A guide, not a rule.`)),
    h('div.section-label', 'All time'),
    h('div.stat-grid',
      h('div.stat', h('div.v', sessions.length), h('div.l', 'Workouts')),
      h('div.stat', h('div.v', compact(workingSets.length)), h('div.l', 'Working sets')),
      h('div.stat', h('div.v', compact(totalVolume)), h('div.l', 'lb lifted'))),
    h('p.small.faint', { style: { margin: '8px 4px 0' } }, `${duration(totalMin)} of training since ${shortDate(sessions[sessions.length - 1].date)}. Volume is weight × reps of working sets; warm-ups never count.`));
}
