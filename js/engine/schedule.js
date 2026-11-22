// When to train next. No fixed weekly schedule: it looks at what has recovered,
// how many sessions you've done in the last 7 days against your aim, and runs of
// back-to-back days. Missed days are never held against you: the answer is just
// "today is a good day" and the planner adapts to whatever was missed.
import { muscleState, weighted } from './recovery.js';
import { FOCI } from './planner.js';
import { addDays, daysBetween, parseDate } from '../util.js';

export const READY = 0.75;          // estimate: "recovered enough" for the best session type
export const MAX_DAYS_IN_A_ROW = 3; // estimate: a rest day after three in a row

/** Best readiness across session types at time `at`. */
function bestReadiness(history, at, checkin) {
  const st = muscleState(history, at, checkin);
  return Math.max(...Object.values(FOCI).map((f) => weighted(st, f.muscles, 'readiness')));
}

/**
 * history: [{ session, sets }] completed. Returns { date, days, reason, optional }.
 * days: 0 = today, 1 = tomorrow...
 */
export function nextSession(history, { today, now, prefs, checkin = null }) {
  const target = prefs.targetSessionsPerWeek || 4;
  const dates = [...new Set(history.map((h) => h.session.date))].sort().reverse();
  if (!dates.length) return { date: today, days: 0, reason: 'Any day is a good day to start.', optional: false };

  const trainedToday = dates[0] === today;
  const in7 = history.filter((h) => daysBetween(h.session.date, today) < 7).length;
  const streakEnding = (day) => { let n = 0; while (dates.includes(addDays(day, -n))) n++; return n; };

  for (let d = trainedToday ? 1 : 0; d <= 4; d++) {
    const day = addDays(today, d);
    const at = d === 0 ? now : parseDate(day).getTime() + 17 * 3.6e6; // around 5 pm that day
    const before = streakEnding(addDays(day, -1));
    if (before >= MAX_DAYS_IN_A_ROW) continue;
    const ready = bestReadiness(history, at, d === 0 ? checkin : null);
    if (ready < READY && d < 3) continue;
    const optional = in7 >= target;
    let reason;
    if (d === 0 && daysBetween(dates[0], today) >= 3) reason = `${daysBetween(dates[0], today)} days since your last workout, so you’re fully recovered.`;
    else if (d === 0) reason = 'You’ve recovered enough for a good session today.';
    else if (trainedToday && d === 1) reason = 'You trained today. Tomorrow works with a different focus.';
    else if (d === 1 && !trainedToday && streakEnding(addDays(today, -1)) >= MAX_DAYS_IN_A_ROW) reason = `${MAX_DAYS_IN_A_ROW} days in a row: a rest day today helps you recover.`;
    else reason = 'Your last session needs a little longer to recover from.';
    if (optional) reason += ` You’ve already done ${in7} this week (aim ~${target}), so this one is a bonus.`;
    return { date: day, days: d, reason, optional };
  }
  return { date: addDays(today, 2), days: 2, reason: 'Give it a couple of days to recover.', optional: false };
}
