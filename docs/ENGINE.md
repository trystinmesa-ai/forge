# Training engine

Everything lives in `js/engine/`. The planner, scheduler and progression rules are pure functions: history and settings go in, a plan comes out. There's no randomness and nothing leaves the phone. `index.js` loads your history from IndexedDB and calls them.

Basis labels follow `js/data/sources.js`: **guideline** (published recommendation), **estimate** (our reasonable reading, tunable), **preference** (your choice).

## Recovery (`recovery.js`), estimate

- Each completed working set counts toward a muscle: 1 for a primary muscle, 0.5 for a secondary one. Warm-ups and mobility work never count.
- Fatigue from a session fades over a recovery window: 72 h for large muscles, 60 h medium, 48 h small. The window scales with how many sets that muscle did (×0.6–1.25), and fatigue from several sessions adds up.
- **Readiness** = 1 − fatigue.
- **Need** = readiness × (more if the muscle is under 10 hard sets this week; half if over 20). Weekly volume is a guideline (Schoenfeld 2017).
- **Sore** region: readiness for its muscles is capped at 0.3, so they're effectively left out.
- **Pain** region: any exercise that loads it is excluded. That means its `stress` tags, its primary muscles in that region, and some whole patterns: squats and lunges for knees, overhead pressing for the neck. The app never diagnoses and never suggests training through pain.

## Choosing the session (`planner.js`)

1. **Focus:**
   - No history: full body.
   - 4 or more days since the last workout: full body.
   - Otherwise, whichever half is clearly fresher (upper or lower). Full body when they're about even.
   - You can force a focus.
2. **Slots:** each focus has ordered slots (e.g. squat, push, hinge, pull, carry, core…).
   - Priority 1 slots are always included. Priority 2 are included normally, and priority 3 only if time allows.
   - Slots match on movement pattern, and may also require a category or muscle.
3. **Picking each slot**, scored on:
   - category fit and muscle need
   - +1.5 for exercises you've done in the last 8 weeks, so they keep progressing
   - a measurable-load preference
   - simpler variations first
   - +0.5 for staples
   - −2.5 for a lift you've swapped away twice or more, and +2 for its usual replacement
   - −4 on regenerate, so the picks come out different

   Equipment is strict: every item an exercise needs must be in the chosen setup. If a priority-1 slot can't be filled, the plan says so and names the equipment that would fix it.
4. **Sets:** come from the exercise's prescription. After 7 or more days away, the main lifts get one fewer set.
5. **Time:** each exercise's time is estimated from setup + reps × seconds per rep (doubled for one-side-at-a-time) + rest + a 45 s transition. A warm-up (3 min) and ramp-up sets (3 min) are added on top.
   - Optional slots are added while the total stays within your budget + 3 min.
   - If it's over, sets are trimmed: small exercises first, then main lifts, never below 2.
   - If the essentials still don't fit, the plan says how long it actually needs.
   - With lots of spare time, the main lifts get a 4th set.
6. **Warm-up:** 2–3 mobility moves matching the focus, plus two ramp-up sets (≈50% / 75%) on the first barbell, dumbbell or machine lift. All are excluded from volume and progression.

## When to train (`schedule.js`), estimate

- The next day where the best session type is at least 75% recovered.
- Never a 4th day in a row.
- Once you've reached your weekly aim, an extra session is marked as a bonus, never blocked.
- Missed days are never penalized: the recommendation is simply "today", and the plan adapts.

## Progression (`progression.js`)

- **Adaptive (default), double progression** (NSCA Essentials):
  - Every working set at the top of the range → +1 step (your gym's increment, or your next kettlebell size).
  - A jump of more than 15% (common with kettlebells) needs two sessions at the top first.
  - Two sessions in a row under the range → −1 step. Otherwise hold and beat last time's reps.
- **Classic 15 / 12 / max** (your preference), judged on the last set:
  - under 10 → −5 lb
  - 10–15 → hold
  - 15–20 → +5 lb
  - over 20 → +5 lb (more if it felt easy)

  Conservative extra: no increase unless sets 1–2 hit 15 and 12. Heavy barbell lifts keep the adaptive ranges.
- **Breaks:** more than 14 days → hold; more than 42 days → −1 step. Never more than one step per session.
- **Never invented:** a new exercise gets no weight. Only completed working sets count, so warm-ups are ignored.

The decision and its one-line reason are stored on each workout entry (`entry.progress`) and shown above its sets.
