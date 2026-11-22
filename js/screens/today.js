// Today: resume or start a workout, the recommendation (what and when, with reasons),
// last workout, time since training, recent days.
import { h, icon, sheet, toast } from '../ui.js';
import * as Engine from '../engine/index.js';
import * as L from '../data/lookup.js';
import { planSheet } from '../plan-ui.js';
import { daySheet } from './history.js';
import * as Hist from '../history-read.js';
import * as W from '../workout.js';
import { localDate, longDate, shortDate, relativeDays, weekday, duration, daysBetween } from '../util.js';
import * as Prefs from '../prefs.js';
import * as DB from '../db.js';

export default async function today({ go, refresh }) {
  const sessions = await Hist.completedSessions();
  const active = await W.activeSession();
  const sum = Hist.summary(sessions);
  const t = localDate();
  const prefs = Prefs.get();

  const head = h('header.screen-head',
    h('div', h('div.eyebrow', longDate(t)), h('h1', 'Today')),
    h('button.icon-btn', { 'aria-label': 'Settings', onclick: () => go('settings') }, icon('settings')));

  let resume = null;
  if (active) {
    const sets = await DB.byIndex('sets', 'sessionId', active.id);
    const done = sets.filter((s) => s.completed && s.kind === 'working').length;
    const startedAgo = daysBetween(active.date, t);
    resume = h('div.card.hero.stack', { style: { borderColor: 'var(--accent)' } },
      h('div.kicker', 'Workout in progress'),
      h('h2', active.title || 'Workout'),
      h('p.muted', { style: { margin: 0 } }, `${done} set${done === 1 ? '' : 's'} logged · started ${startedAgo ? `${relativeDays(startedAgo)}` : `at ${new Date(active.startedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`}. Everything you’ve logged is saved.`),
      h('button.btn.primary.block.lg', { onclick: () => go('workout') }, 'Resume workout'));
  }

  let hero = null;
  if (!active) {
    const { when, workout: p } = await Engine.recommend({ prefs });
    const whenText = when.days === 0 ? 'Today' : when.days === 1 ? 'Tomorrow' : weekday(when.date);
    const names = p.items.map((i) => L.exerciseName(i.exerciseId));
    hero = h('div.card.hero.stack',
      h('div.kicker', when.days === 0 ? (when.optional ? 'Bonus session' : 'Recommended today') : 'Next session'),
      h('h2', when.days === 0 ? p.title : `${whenText} · ${p.title}`),
      h('p.muted', { style: { margin: 0 } }, when.reason),
      h('ul.reasons', p.reasons.filter((r) => !/^Fits about/.test(r)).slice(0, 2).map((r) => h('li', r))),
      names.length > 0 && h('div.small.faint', `${names.slice(0, 4).join(' · ')}${names.length > 4 ? ` +${names.length - 4} more` : ''} · ~${p.estimateMin} min`),
      h('button.btn.primary.block.lg', { onclick: () => planSheet({ go }) }, icon('bolt'), when.days === 0 ? 'Plan today’s workout' : 'Train today anyway'),
      h('button.btn.block.ghost', { onclick: () => startSheet(sessions, go) }, 'Build my own or repeat one'));
  }

  const last = sum.last && h('button.card.card-btn', { onclick: () => go('history') },
    h('div.kicker', 'Most recent workout'),
    h('div.spread',
      h('div', h('h3', sum.last.title || 'Workout'), h('div.muted.small', `${weekday(sum.last.date)} · ${relativeDays(sum.daysSinceLast)} · ${(sum.last.entries || []).filter((e) => !e.skipped).length} exercises`)),
      sum.last.durationMin != null && h('span.pill', icon('clock'), duration(sum.last.durationMin))));

  const days = Hist.lastDays(sessions, 7, t);
  const recent = h('div.card',
    h('div.spread', h('div.kicker', { style: { margin: 0 } }, 'Last 7 days'),
      h('span.small.muted', `${sum.in7} session${sum.in7 === 1 ? '' : 's'} · aim ~${prefs.targetSessionsPerWeek}/week`)),
    h('div.week', days.map((d) => h('div.d',
      h('button.dot', { type: 'button', class: [d.sessions.length && 'on', d.date === t && 'today'].filter(Boolean).join(' '),
        'aria-label': `${longDate(d.date)}${d.sessions.length ? `, ${d.sessions.length} workout${d.sessions.length === 1 ? '' : 's'}` : ', no workout'}`,
        onclick: () => daySheet(d.date, { go, refresh }) }),
      weekday(d.date).slice(0, 1)))),
    h('div.small.faint', { style: { marginTop: '8px' } }, 'Tap a day to see it or add a workout you did.'));

  return h('div', head, h('div.stack', resume, hero, last, recent));
}

function startSheet(sessions, go) {
  const prefs = Prefs.get();
  const begin = async (fn) => {
    try { await fn(); go('workout'); } catch (e) { toast(e.message, { error: true }); }
  };
  return sheet((close) => h('div.stack',
    h('h2', 'Start a workout'),
    h('div.list',
      h('button.item', { onclick: () => { close(); planSheet({ go }); } }, icon('bolt', 'chev'),
        h('div.grow', h('div', { style: { fontWeight: 600 } }, 'Recommended workout'), h('div.sub', 'Built from your history, recovery, time and equipment'))),
      h('button.item', { onclick: () => { close(); begin(() => W.startSession({ title: 'Workout', prefs })); } },
        h('span.add-plus', '+'), h('div.grow', h('div', { style: { fontWeight: 600 } }, 'Build my own'), h('div.sub', 'Start empty and add exercises from the library')))),
    sessions.length > 0 && h('div',
      h('div.section-label', 'Repeat a past workout'),
      h('div.list', sessions.slice(0, 8).map((s) => h('button.item', { onclick: () => { close(); begin(() => W.repeatSession(s.id, prefs)); } },
        h('div.grow', h('div', { style: { fontWeight: 600 } }, s.title || 'Workout'),
          h('div.sub', `${shortDate(s.date)} · ${(s.entries || []).filter((e) => !e.skipped).length} exercises`)),
        icon('chevron', 'chev'))))),
    h('button.btn.ghost.block', { onclick: () => close() }, 'Cancel')), { label: 'Start a workout' });
}
