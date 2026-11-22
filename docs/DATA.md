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
