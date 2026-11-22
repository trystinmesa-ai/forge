// Today: resume or start a workout, last workout, time since training, recent days.
// The recommendation (what to train and when) arrives with the planner in Phase 4.
import { h, icon, sheet, toast } from '../ui.js';
import * as Hist from '../history-read.js';
import * as W from '../workout.js';
import { localDate, longDate, shortDate, relativeDays, weekday, duration, daysBetween } from '../util.js';
import * as Prefs from '../prefs.js';
import * as DB from '../db.js';

export default async function today({ go }) {
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

  const hero = !active && h('div.card.hero.stack',
    h('div.kicker', 'Next session'),
    sum.total
      ? h('h2', sum.daysSinceLast === 0 ? 'You trained today' : `Last trained ${relativeDays(sum.daysSinceLast)}`)
      : h('h2', 'Ready when you are'),
    h('p.muted', { style: { margin: 0 } }, sum.total
      ? 'Workout recommendations from your history arrive in Phase 4. For now, build your own or repeat a past workout.'
      : 'Log your first workout and the app starts learning your strength levels. It never guesses weights you haven’t lifted.'),
    h('button.btn.primary.block.lg', { onclick: () => startSheet(sessions, go) }, icon('bolt'), 'Start a workout'));

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
      h('div.dot', { class: [d.sessions.length && 'on', d.date === t && 'today'].filter(Boolean).join(' '), title: d.date }),
      weekday(d.date).slice(0, 1)))));

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
      h('div.item', { style: { opacity: 0.55 } }, icon('bolt', 'chev'),
        h('div.grow', h('div', 'Recommended for today'), h('div.sub', 'Built from your history, recovery, time and equipment. Arrives in Phase 4.'))),
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
