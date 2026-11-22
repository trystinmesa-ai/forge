# Data model

The built-in exercise library and vocabulary (muscles, equipment, patterns) ship **with the app code** (`js/data/`). They improve with each release without touching your history. Everything about **you** lives in IndexedDB, in the stores below. Ids are stable strings, and every record has `updatedAt` (ms).

## Stores

### `sessions`: one workout
```
id, date ('YYYY-MM-DD', local), startedAt, endedAt (ms), durationMin,
status: 'active' | 'completed',
title, focus ('upper' | 'lower' | 'full' | ...),
plan:    { minutes, profileId, equipment[], reason, generatedBy: 'engine@version' | 'manual' },
checkin: { sore: [region], tight: [region], pain: [region], energy: 1-5, notes },
entries: [{ id, exerciseId, order, target: { sets, repMin, repMax, rir, weight, restSec },
            skipped, replacedFrom, notes }],
notes
```
Indexed by `date` and `status`. An `active` session is an unfinished workout, which can be resumed.

### `sets`: one logged set (written the moment you tap it)
```
id, sessionId, entryId, entryOrder, exerciseId, date, idx,
kind: 'warmup' | 'working',  weight (lb, null = bodyweight), reps, rir (optional),
completed, completedAt
```
Indexed by `sessionId`, `exerciseId`, and `[exerciseId, date]` (exercise history). Warm-up sets never count toward volume or progression.

### `exState`: per-exercise progression (key `exerciseId`)
The engine's current recommendation: next weight, rep target and stage. It is derived from `sets`, so it can always be rebuilt from history.

### `overrides` (key `exerciseId`), `customEx`
Your edits to a library exercise (video link, notes, hidden, custom increment), and exercises you add yourself.

### `substitutions`
`{ id: 'from>to', from, to, count, lastAt }`. Repeated swaps become a remembered preference.

### `checkins`
`{ id, at, sore[], tight[], pain[], energy, notes }`. Readiness reports made outside a workout.

### `meta` (key/value)
`prefs` (see `js/prefs.js` DEFAULTS) and `lastBackupAt`.

## Guarantees
- History is never derived from or overwritten by recommendations. The engine reads `sets`; it never edits them.
- Deleting a workout deletes its sets in the same transaction.
- Schema changes are migrations in `db.js` (`onupgradeneeded`, keyed on the old version). Stores holding history are never dropped.
- Backups carry a format version. Older backups restore into newer apps, and a backup from a newer app is refused with a clear message.

## Evidence labels (used from Phase 2 on)
Each programming rule and exercise prescription carries `basis`:
- `guideline`: established position statements (e.g. ACSM resistance-training guidance, NSCA)
- `estimate`: reasonable practice where evidence is mixed (e.g. recovery windows per muscle size)
- `preference`: your own choices (e.g. the 15 / 12 / max-reps scheme)

## Exercise library (`js/data/exercises.js`)
Each exercise lists: muscles (primary/secondary), **every** required piece of equipment, movement pattern, category, difficulty, whether it's one side at a time, whether it's a heavy barbell lift, how it's measured (reps or time), the body areas it loads (`stress`, used to avoid pain), hand-picked alternatives and technique cues.

- **Prescriptions** come from the category defaults in `js/data/programming.js`, unless the exercise sets its own (e.g. deadlifts 3–6 reps, get-ups 1–3).
- **Alternatives** (`lookup.alternatives`) must share the movement pattern unless hand-picked. They're ranked by shared primary muscles, category and difficulty, and limited to the equipment you have.
- **Your edits** (video link, notes, hidden) live in the `overrides` store and sync like everything else. The built-in data is never modified.
- **Sources** for programming rules are in `js/data/sources.js`. Each rule is labelled guideline / estimate / preference.
