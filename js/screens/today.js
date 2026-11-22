// Today: last workout, time since training, recent days, and (from Phase 4) the recommendation.
import { h, icon, sheet } from '../ui.js';
import * as Hist from '../history-read.js';
import { localDate, longDate, relativeDays, weekday, duration } from '../util.js';
import * as Prefs from '../prefs.js';

export default async function today({ go }) {
  const sessions = await Hist.completedSessions();
  const active = await Hist.activeSession();
  const sum = Hist.summary(sessions);
  const t = localDate();
  const prefs = Prefs.get();

  const head = h('header.screen-head',
    h('div', h('div.eyebrow', longDate(t)), h('h1', 'Today')),
    h('button.icon-btn', { 'aria-label': 'Settings', onclick: () => go('settings') }, icon('settings')));

  const resume = active && h('div.card', { style: { borderColor: 'var(--accent)' } },
    h('div.kicker', 'Workout in progress'),
    h('h3', active.title || 'Unfinished workout'),
    h('p.muted.small', `Started ${longDate(active.date)}. Everything you logged is saved.`),
    h('button.btn.primary.block', { disabled: true }, 'Resume (arrives in Phase 3)'));

  const hero = h('div.card.hero.stack',
    h('div.kicker', 'Next session'),
    sum.total
      ? h('h2', sum.daysSinceLast === 0 ? 'You trained today' : `Last trained ${relativeDays(sum.daysSinceLast)}`)
      : h('h2', 'Ready when you are'),
    h('p.muted', { style: { margin: 0 } }, sum.total
      ? 'Recommendations will use your full history once the training engine is built.'
      : 'Log your first workout and the app starts learning your strength levels. It never guesses weights you haven’t lifted.'),
    h('button.btn.primary.block.lg', { onclick: () => planSheet(prefs) }, icon('bolt'), 'Plan today’s workout'));

  const last = sum.last && h('div.card',
    h('div.kicker', 'Most recent workout'),
    h('div.spread',
      h('div', h('h3', sum.last.title || 'Workout'), h('div.muted.small', `${weekday(sum.last.date)} · ${relativeDays(sum.daysSinceLast)}`)),
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

function planSheet(prefs) {
  return sheet((close) => h('div.stack',
    h('h2', 'Coming in Phase 4'),
    h('p.muted', { style: { margin: 0 } },
      'This is where you’ll tell the app how much time you have, what equipment is available, and anything that’s sore. ',
      'It will then build a workout from your history. The foundation (storage, backup, sync, navigation) is what’s being built right now.'),
    h('p.small.faint', `Your defaults: ${prefs.defaultMinutes} min · ${prefs.profiles.find((p) => p.id === prefs.defaultProfile)?.name || 'Full gym'}. Change them in Settings.`),
    h('button.btn.block', { onclick: () => close() }, 'OK')), { label: 'Plan today’s workout' });
}
