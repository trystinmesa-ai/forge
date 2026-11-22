# Forge — private training log & planner

A personal, installable PWA for logging strength workouts and recommending the next one from your training history using programmed rules. No AI API, no subscriptions.

## Architecture

| Layer | Choice | Why |
|---|---|---|
| UI | Plain JavaScript modules, HTML, CSS. No framework, no build step | Same as Tally/Meadow; nothing to install or upgrade; runs anywhere |
| Data | IndexedDB on the device (`js/db.js`) | Works offline; each set is committed the moment it's logged |
| Backup | JSON export/restore (`js/backup.js`) | You own a plain file of everything |
| Sync (optional) | Existing Supabase project, table `fitness_records` (`js/cloud.js`) | Off-device copy + desktop access; locked to your account by row-level security |
| Offline | Service worker caches the app shell (`sw.js`) | Opens and logs with no signal |
| Engine (Phase 4) | Pure, deterministic functions in `js/engine/` | Same inputs → same plan; fully testable; rules live in data, not screens |

**How data flows:** screens read and write IndexedDB only. Every write also goes into an `outbox` in the same transaction. When you're signed in, `cloud.js` uploads the outbox and downloads changes from your other devices. An unsent local change always wins over a cloud copy. Signed out, nothing leaves the device.

## Run locally

Start the `fitness` entry from `.claude/launch.json` (Ruby server on port 8020). Open http://localhost:8020/. Add `?nosw` to skip the service worker while developing.

Tests: http://localhost:8020/tests/ (uses a separate `forge-test` database).

## Turning on sync (one time)

1. Supabase dashboard → SQL Editor → New query → paste `supabase/schema.sql` → Run.
2. In the app: Settings → Account sync → sign in with your existing account.

## Releasing

Bump `VERSION` in **both** `js/version.js` and `sw.js`, then commit and push. Phones pick up the new version after one or two full close/reopens.

## Phases

1. **Foundation**: storage, backup, sync, navigation, PWA *(done)*
2. **Exercise library**: 140 exercises, muscle maps, alternatives, equipment setups *(done)*
3. **Workout logging**: log sets with last time beside them, rest timer, replace/skip, resume after closing, exercise history *(done)*
4. **Training engine**: recommended workout and date, recovery and soreness/pain handling, equipment-strict selection, time budgets, warm-ups, progression rules, regenerate *(done)*
5. **Progress**: workouts per week and month, strength trends (estimated max), personal records, weekly muscle volume, 4-week trends, “How recommendations work” page *(done)*
6. **Scenario validation**: the 15 spec scenarios as end-to-end tests, all passing (`docs/SCENARIOS.md`) *(done, v1.0.0)*

See `docs/DATA.md` for the data model and `docs/ENGINE.md` for how recommendations are made.
