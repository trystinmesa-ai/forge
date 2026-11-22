// Progress stats: records, strength timeline, weekly/monthly counts, muscle volume, trends.
import * as Stats from '../js/stats.js';
import { addDays } from '../js/util.js';

const TODAY = '2026-11-20';
let n = 0;
/** Build sessions + sets: workouts = [[daysAgo, [[exerciseId, [[w, r], ...]], ...]], ...] */
function build(workouts) {
  const sessions = new Map(), sets = [];
  for (const [ago, items, extra = {}] of workouts) {
    const id = `w${++n}`;
    const date = addDays(TODAY, -ago);
    sessions.set(id, { id, date, startedAt: Date.parse(`${date}T17:00`), status: 'completed', durationMin: 50, ...extra });
    for (const [exerciseId, list] of items) list.forEach(([weight, reps, more = {}], idx) => sets.push({ id: `${id}-${exerciseId}-${idx}`, sessionId: id, exerciseId, idx, kind: 'working', completed: true, weight, reps, ...more }));
  }
  return { sessions, sets };
}

export default function register({ describe, it, eq, ok }) {
  describe('Progress: personal records', () => {
    it('the first time sets a baseline, not a record', () => {
      const { sessions, sets } = build([[5, [['db-bench', [[50, 10]]]]]]);
      eq(Stats.records(sets, sessions), []);
    });
    it('a heavier set is a weight record; a better estimated max at the same weight is an e1RM record', () => {
      const { sessions, sets } = build([
        [9, [['db-bench', [[50, 8], [50, 8]]]]],
        [6, [['db-bench', [[55, 6]]]]],
        [3, [['db-bench', [[55, 9]]]]],
      ]);
      const r = Stats.records(sets, sessions);
      eq(r.map((x) => [x.kind, x.value]), [['weight', 55], ['e1rm', 72]]);
      eq(r[0].prev, 50);
    });
    it('warm-ups and unfinished sets never count, and one workout gives one record per exercise', () => {
      const { sessions, sets } = build([
        [6, [['db-bench', [[50, 10]]]]],
        [3, [['db-bench', [[90, 3, { kind: 'warmup' }], [70, 5, { completed: false }], [52.5, 8], [55, 6]]]]],
      ]);
      const r = Stats.records(sets, sessions);
      eq(r.length, 1);
      eq([r[0].kind, r[0].value, r[0].reps], ['weight', 55, 6]);
    });
    it('bodyweight exercises record reps; timed ones record seconds', () => {
      const { sessions, sets } = build([
        [6, [['push-up', [[0, 15]]], ['plank', [[0, null, { seconds: 40 }]]]]],
        [3, [['push-up', [[0, 18]]], ['plank', [[0, null, { seconds: 50 }]]]]],
      ]);
      eq(Stats.records(sets, sessions).map((x) => [x.exerciseId, x.kind, x.value]), [['push-up', 'reps', 18], ['plank', 'time', 50]]);
    });
  });

  describe('Progress: strength and consistency', () => {
    it('estimated max uses Epley only for 1–12 reps', () => {
      eq(Stats.e1rm(100, 1), 100);
      eq(Stats.e1rm(100, 10), 133);
      eq(Stats.e1rm(100, 15), null);
      eq(Stats.e1rm(0, 10), null);
    });
    it('the strength timeline has one point per workout, oldest first', () => {
      const { sessions, sets } = build([[2, [['db-row', [[60, 10], [65, 8]]]]], [9, [['db-row', [[55, 10]]]]]]);
      const tl = Stats.timeline('db-row', sets, sessions);
      eq(tl.map((p) => p.date), [addDays(TODAY, -9), addDays(TODAY, -2)]);
      eq([tl[1].topWeight, tl[1].topReps, tl[1].e1rm], [65, 8, 82]);
    });
    it('weekly counts use rolling 7-day windows ending today, with missed weeks as plain zeros', () => {
      const { sessions } = build([[0, []], [2, []], [6, []], [20, []]]);
      const w = Stats.weekly([...sessions.values()], TODAY, 4);
      eq(w.map((x) => x.count), [0, 1, 0, 3]);
      eq(w[3].end, TODAY);
    });
    it('monthly counts and an average per week, the current month marked as partial', () => {
      const { sessions } = build([[0, []], [5, []], [40, []]]);
      const m = Stats.monthly([...sessions.values()], TODAY, 3);
      eq(m.map((x) => x.count), [0, 1, 2]);
      ok(m[2].partial && !m[1].partial);
      eq(Math.round(m[2].perWeek * 10) / 10, Math.round((2 / (20 / 7)) * 10) / 10);
    });
    it('muscle volume counts primary 1 and secondary 0.5 over the last 7 days only', () => {
      const { sessions, sets } = build([[1, [['db-bench', [[50, 10], [50, 10]]]]], [10, [['db-bench', [[50, 10]]]]]]);
      const history = [...sessions.values()].map((session) => ({ session, sets: sets.filter((s) => s.sessionId === session.id) }));
      const mw = Stats.muscleWeek(history, TODAY);
      eq([mw.chest, mw.triceps], [2, 1]);
    });
    it('4-week trend compares with the 4 weeks before', () => {
      const { sessions, sets } = build([[3, [['db-bench', [[50, 10]]]]], [10, [['db-bench', [[50, 10]]]]], [35, [['db-bench', [[40, 10]]]]]]);
      const history = [...sessions.values()].map((session) => ({ session, sets: sets.filter((s) => s.sessionId === session.id) }));
      const t = Stats.trend(history, TODAY);
      eq([t.now.workouts, t.now.sets, t.now.volume, t.before.workouts, t.before.volume], [2, 2, 1000, 1, 400]);
    });
    it('the strength picker lists your most-logged exercises first, without mobility', () => {
      const { sessions, sets } = build([[1, [['db-row', [[60, 10]]], ['cat-cow', [[0, 8]]]]], [4, [['db-row', [[60, 10]]], ['db-bench', [[50, 10]]]]]]);
      eq(Stats.topExercises(sets, sessions).map((t) => t.id), ['db-row', 'db-bench']);
    });
  });
}
