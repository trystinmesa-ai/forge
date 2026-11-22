# Scenario validation (Phase 6)

These are the 15 scenarios from the original spec. Each one is an automated, end-to-end test in `tests/scenarios.tests.js`, using:

- the real database code, against a separate test database (`forge-test`);
- the real workout logger;
- the real engine.

Each test lets the app plan a workout. It then "does" the workout by ticking the planned sets, the same way the workout screen does, and checks what the app recommends next.

**Result (v1.0.0, 2026-11-21):** all 15 scenarios pass (19 tests), along with 97 unit tests: 116 in total. Open `/tests/` on the dev server to run them.

**Do the tests catch problems?** To check, I deliberately broke two rules: the soreness cut-off and the hold on the first session back. Exactly the matching tests failed (3 of them). With the rules restored, all tests passed again.

| # | Scenario | What is checked |
|---|---|---|
| 1 | Four workouts in a week | Follows the app's recommendations for 14 days. Week 2 has 3–5 workouts, and chest, lats, upper back, quads, hamstrings and glutes are each trained at least twice. There are never 4 training days in a row, and hitting targets leads to weight increases. A 5th workout in the same week is allowed but marked as a bonus. |
| 2 | Two workouts in a week | Today is recommended and is not marked as a bonus. No extra "catch-up" sets are added, and the plan fits the usual time. |
| 3 | Several missed days | After 5 days off: train today, full body, and the reason states the gap with no blame ("missed", "make up" and "behind schedule" never appear). |
| 4 | A week away | Back after 9 days: full body, 2 sets on the main lifts, and **no weight increases in that first session**, with the reason shown. |
| 5 | Soreness | With sore legs, there's no lower-body session and no exercise aimed at leg muscles, and the check-in is saved with the workout. With shoulder pain, nothing that loads the shoulders is picked (warm-up included), and the plan shows a "don't train through pain" note. |
| 6 | Kettlebells only | Every exercise uses kettlebells or bodyweight only, including a swing or clean, a squat or lunge, and a carry or get-up. Weights move only through the kettlebells you own: 35 lb → 44 lb, and only after hitting the top of the range twice, because it's a 25% jump. |
| 7 | Bodyweight only | Bodyweight exercises only, and no weights are filled in. The plan says plainly that a pull-up bar or band is needed for pulling. Progress is in reps, not made-up weight. |
| 8 | Replacing an exercise for equipment | Every suggested alternative fits the chosen equipment, and the swap keeps its place in the workout. Swapping twice is counted, and the planner then stops picking the exercise you keep swapping out. |
| 9 | Regenerating after an equipment change | One set is logged, then the workout is switched to kettlebells. Only the exercises not yet started are rebuilt, all with kettlebell or bodyweight. The logged set and its exercise stay as they were. |
| 10 | First time doing an exercise | Every exercise is flagged "new", with no weight or reps filled in and no previous performance shown. |
| 11 | Weight increase after hitting the target | Exercise-specific: every set at the top of the range → +5 lb next time. 15 / 12 / max: 17 on the last set after hitting 15 and 12 → +5 lb. |
| 12 | Fewer reps than expected | Once → same weight. Twice in a row → 5 lb lighter. 15 / 12 / max with under 10 on the last set → 5 lb lighter. |
| 13 | Only 30 minutes | Full gym, kettlebells and dumbbells each fit in about 30 minutes or less (≤ 33) and keep at least 3 exercises, and the plan names what was left out for time. Asking for 15 minutes gets an honest "this needs about N min". |
| 14 | Closing the app mid-workout | After closing and reopening the database, the logged sets, check-in, warm-up ticks and running rest timer are all intact, and the workout resumes and finishes normally. I also checked this by hand in the app at phone size: reloading mid-workout brings back the "Resume workout" card and the running timer. |
| 15 | Reopening with data intact | Five workouts are logged, one with a swap. After closing and reopening, every record, every personal record and the recommended workout and date are identical. They are identical again after backup → wipe all data → restore. |

## Changes made during Phase 6

- **New rule (estimate):** the first workout after 7 or more days with no training holds weights instead of increasing them. Before this, an exercise only held its weight when *that exercise* hadn't been done for 14+ days. The rule appears in Settings → How recommendations work.
- **Fixed:** in the planning sheet, tapping several options quickly could let an older preview finish last and become the plan you start. Now only the newest preview counts.

## Not covered by automated tests

- **Real iPhone use:** the number pad, the share sheet for backups, Home Screen install and offline launch. These need a person on a phone.
- **Cloud sync against the live Supabase project:** the `fitness_records` table hasn't been created yet. The local outbox and merge logic is tested.
- **Recovery times and session targets** are labelled estimates. The tests check that the app behaves consistently with them, not that the numbers are right for your body.
