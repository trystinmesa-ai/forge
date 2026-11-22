// Settings: training preferences, appearance, backup/restore, cloud sync, erase.
import { h, icon, seg, stepper, toggle, toast, confirm, sheet } from '../ui.js';
import * as Prefs from '../prefs.js';
import * as DB from '../db.js';
import * as Backup from '../backup.js';
import * as Cloud from '../cloud.js';
import { EQUIPMENT, KB_SIZES_LB } from '../data/taxonomy.js';
import * as Lookup from '../data/lookup.js';
import { VERSION } from '../version.js';
import { RULES } from '../data/programming.js';
import { SOURCES, BASIS } from '../data/sources.js';
import { RECOVERY_HOURS } from '../engine/recovery.js';
import { LONG_BREAK_DAYS, VERY_LONG_BREAK_DAYS, BIG_JUMP } from '../engine/progression.js';
import { READY, MAX_DAYS_IN_A_ROW } from '../engine/schedule.js';

const row = (label, sub, control) =>
  h('div.item', h('div.grow', h('div', label), sub && h('div.sub', sub)), control);

export default async function settings({ go, refresh }) {
  const p = Prefs.get();
  const save = (patch) => Prefs.update(patch).catch((e) => toast(`Couldn’t save: ${e.message}`, { error: true }));
  const [workouts, sets, lastBackup, persisted] = await Promise.all([
    DB.count('sessions'), DB.count('sets'), DB.get('meta', 'lastBackupAt'),
    navigator.storage?.persisted?.().catch(() => false) ?? false,
  ]);

  const profileName = (id) => p.profiles.find((x) => x.id === id)?.name;

  return h('div',
    h('header.screen-head',
      h('div', h('div.eyebrow', `Version ${VERSION}`), h('h1', 'Settings')),
      h('button.btn.ghost', { onclick: () => go('today') }, 'Done')),

    h('div.section-label', 'Training'),
    h('div.list',
      row('Sessions per week', 'A target, not a schedule. Missed days never reset anything.',
        stepper(p.targetSessionsPerWeek, { min: 1, max: 7, onChange: (v) => save({ targetSessionsPerWeek: v }) })),
      row('Usual workout length', null,
        stepper(p.defaultMinutes, { min: 15, max: 120, step: 15, format: (v) => `${v}m`, onChange: (v) => save({ defaultMinutes: v }) })),
      h('div.item', { style: { display: 'block' } },
        h('div', 'Progression style'),
        h('div.sub', { style: { margin: '2px 0 10px' } }, p.progressionStyle === 'adaptive'
          ? 'Rep ranges and failure targets fit each exercise: heavier for big lifts, higher reps for isolation.'
          : 'Your 15 / 12 / max-reps sets for most exercises. Heavy barbell lifts still use safer ranges.'),
        seg([['adaptive', 'Exercise-specific'], ['classic', '15 / 12 / max']], p.progressionStyle, (v) => save({ progressionStyle: v }).then(refresh))),
      row('Rest timer', 'Starts after you complete a set', toggle(p.restTimer, (v) => save({ restTimer: v }), 'Rest timer')),
      h('button.item', { onclick: () => howItWorks() },
        h('div.grow', h('div', 'How recommendations work'), h('div.sub', 'The rules, how sure we are about each, and the sources')),
        icon('chevron', 'chev'))),

    h('div.section-label', 'Equipment'),
    h('div.list',
      p.profiles.map((pr) => h('button.item', { onclick: () => editProfile(pr, refresh) },
        h('div.grow', h('div', pr.name, pr.id === p.defaultProfile && h('span.pill.accent', { style: { marginLeft: '8px' } }, 'Default')),
          h('div.sub', `${pr.equipment.filter((e) => e !== 'bodyweight').map((e) => EQUIPMENT[e]?.name).filter(Boolean).join(', ') || 'No equipment'} · ${countFor(pr)} exercises`)),
        icon('chevron', 'chev'))),
      h('button.item', { style: { color: 'var(--accent)', fontWeight: 600 }, onclick: () => editProfile(null, refresh) }, '+ Add an equipment setup'),
      h('button.item', { onclick: () => editIncrements(refresh) },
        h('div.grow', h('div', 'Weight jumps'), h('div.sub', `Barbell ${p.increments.barbell} · Dumbbell ${p.increments.dumbbell} · Machine ${p.increments.machine} · Cable ${p.increments.cable} lb`)),
        icon('chevron', 'chev')),
      h('button.item', { onclick: () => editKettlebells(refresh) },
        h('div.grow', h('div', 'Kettlebells you have'), h('div.sub', `${p.kettlebellSizes.join(', ')} lb`)),
        icon('chevron', 'chev'))),
    h('p.small.faint', { style: { margin: '8px 4px 0' } }, `Workouts start with “${profileName(p.defaultProfile)}”. You can pick a different setup each time you plan a workout.`),

    h('div.section-label', 'Appearance'),
    h('div.list', h('div.item', { style: { display: 'block' } },
      seg([['dark', 'Dark'], ['light', 'Light'], ['system', 'Match iPhone']], p.theme, (v) => save({ theme: v })))),

    h('div.section-label', 'Your data'),
    h('div.list',
      row('On this device', `${workouts} workout${workouts === 1 ? '' : 's'} · ${sets} set${sets === 1 ? '' : 's'}`,
        h('span.pill', { class: persisted ? 'accent' : 'warn' }, persisted ? 'Protected' : 'Standard')),
      h('button.item', { onclick: () => doExport(refresh) },
        icon('download', 'chev'), h('div.grow', h('div', 'Export backup'),
          h('div.sub', lastBackup ? `Last backup ${new Date(lastBackup.value).toLocaleDateString()}` : 'No backup yet. Saves a JSON file you keep.'))),
      h('button.item', { onclick: () => pickRestore(refresh) },
        icon('upload', 'chev'), h('div.grow', h('div', 'Restore from backup'), h('div.sub', 'Shows what’s in the file before changing anything')))),
    !persisted && h('p.small.faint', { style: { margin: '8px 4px 0' } }, 'Add the app to your Home Screen so iOS keeps its storage long-term. Backups or sync protect you either way.'),

    h('div.section-label', 'Account sync'),
    syncCard(refresh),

    h('div.section-label', 'Danger zone'),
    h('div.list', h('button.item', { style: { color: 'var(--danger)' }, onclick: () => eraseAll(refresh) },
      h('div.grow', h('div', 'Erase all data'), h('div.sub', Cloud.user() ? 'Also erases it from your account' : 'From this device')))),
  );
}

async function doExport(refresh) {
  try {
    const b = await Backup.build();
    const how = await Backup.download(b);
    if (how === 'cancelled') return;
    await DB.put('meta', { key: 'lastBackupAt', value: Date.now() });
    toast(`Backup saved: ${b.counts.sessions} workouts`);
    refresh();
  } catch (e) { toast(`Export failed: ${e.message}`, { error: true }); }
}

function pickRestore(refresh) {
  const input = h('input', { type: 'file', accept: 'application/json,.json', style: { display: 'none' } });
  input.addEventListener('change', async () => {
    const file = input.files?.[0]; input.remove();
    if (!file) return;
    const res = await Backup.parseFile(file);
    if (!res.ok) { toast(res.error, { error: true, ms: 4500 }); return; }
    const when = res.summary.exportedAt ? new Date(res.summary.exportedAt).toLocaleString() : 'unknown date';
    const mode = await sheet((close) => h('div.stack',
      h('h2', 'Restore this backup?'),
      h('p.muted', { style: { margin: 0 } }, `From ${when}: ${res.summary.workouts} workouts, ${res.summary.sets} sets.`),
      h('button.btn.primary.block.lg', { onclick: () => close('merge') }, 'Merge with what’s here'),
      h('p.small.faint', { style: { margin: '-4px 4px 4px' } }, 'Adds anything missing. Where both have the same record, the newer one is kept.'),
      h('button.btn.danger.block', { onclick: () => close('replace') }, 'Replace everything on this device'),
      h('button.btn.ghost.block', { onclick: () => close() }, 'Cancel')), { label: 'Restore backup' });
    if (!mode) return;
    if (mode === 'replace' && !(await confirm('Replace all data?', 'Everything on this device (and your account, if signed in) becomes exactly this backup. Export a backup first if you might want the current data.', { ok: 'Replace', danger: true }))) return;
    try {
      const r = await Backup.restore(res.backup, mode);
      await Prefs.load(); await reloadEdits();
      toast(r.replaced ? 'Backup restored' : `Merged: ${r.added} added, ${r.updated} updated`);
      refresh();
    } catch (e) { toast(`Restore failed, nothing was changed: ${e.message}`, { error: true, ms: 5000 }); }
  });
  document.body.append(input);
  input.click();
}

async function eraseAll(refresh) {
  if (!(await confirm('Erase all data?', 'This deletes every workout, set and preference. It can’t be undone unless you have a backup.', { ok: 'Erase everything', danger: true }))) return;
  await DB.replaceAll({});
  await Prefs.load(); await reloadEdits();
  toast('All data erased');
  refresh();
}

function syncCard(refresh) {
  const u = Cloud.user();
  const st = Cloud.status;
  if (!u) {
    return h('div.list',
      h('button.item', { onclick: () => signInSheet(refresh) }, icon('cloud', 'chev'),
        h('div.grow', h('div', 'Sign in to sync'), h('div.sub', 'Optional. Uses your existing private account; the app works fully without it.'))));
  }
  const label = { syncing: 'Syncing…', ok: 'Up to date', offline: 'Offline. Changes upload when you’re back online.', error: `Sync problem: ${st.error}`, idle: 'Waiting to sync' }[st.state] || '';
  return h('div.list',
    row(u.email, label, h('button.btn.ghost', { style: { minHeight: '36px', fontSize: '14px' }, onclick: () => Cloud.sync().then(refresh) }, 'Sync now')),
    h('button.item', { onclick: async () => {
      if (!(await confirm('Sign out?', 'This removes the data from this device. It stays in your account and comes back when you sign in.', { ok: 'Sign out' }))) return;
      await Cloud.signOut(); await Prefs.load(); await reloadEdits(); refresh();
    } }, h('div.grow', 'Sign out')));
}

function signInSheet(refresh) {
  return sheet((close) => {
    const email = h('input', { type: 'email', placeholder: 'Email', autocomplete: 'username', autocapitalize: 'off' });
    const pw = h('input', { type: 'password', placeholder: 'Password', autocomplete: 'current-password' });
    const err = h('div.banner.danger', { style: { display: 'none' } });
    const btn = h('button.btn.primary.block.lg', { type: 'submit' }, 'Sign in');
    return h('form.stack', { onsubmit: async (e) => {
      e.preventDefault(); btn.disabled = true; err.style.display = 'none';
      try {
        const ok = await Cloud.signIn(email.value.trim(), pw.value, (other) =>
          confirm('Switch accounts?', `This device has data from ${other}. Signing in removes it from this device (it stays in that account).`, { ok: 'Switch', danger: true }));
        if (ok) { close(); await Prefs.load(); await reloadEdits(); toast('Signed in'); refresh(); }
      } catch (ex) { err.textContent = ex.message; err.style.display = ''; }
      btn.disabled = false;
    } },
      h('h2', 'Sign in'),
      h('p.muted.small', { style: { margin: 0 } }, 'Same account as Tally. Workouts sync to a separate private table only you can read.'),
      email, pw, err, btn,
      h('button.btn.ghost.block', { type: 'button', onclick: () => close() }, 'Cancel'));
  }, { label: 'Sign in' });
}

// ───────── Equipment editing ─────────
const countFor = (pr) => Lookup.allExercises({ includeHidden: false }).filter((ex) => Lookup.isAvailable(ex, pr.equipment)).length;

function editProfile(existing, refresh) {
  const p = Prefs.get();
  const draft = existing ? { ...existing, equipment: [...existing.equipment] } : { id: `p-${Date.now().toString(36)}`, name: '', equipment: ['bodyweight'] };
  return sheet((close) => {
    const name = h('input', { type: 'text', placeholder: 'Name (e.g. Hotel gym)', value: draft.name, maxlength: 40 });
    const count = h('div.small.muted');
    const updateCount = () => { count.textContent = `${countFor(draft)} exercises available with this setup`; };
    const grid = h('div.list', Object.entries(EQUIPMENT).filter(([k]) => k !== 'bodyweight').map(([k, v]) =>
      h('div.item', h('div.grow', v.name), toggle(draft.equipment.includes(k), (on) => {
        draft.equipment = on ? [...new Set([...draft.equipment, k])] : draft.equipment.filter((e) => e !== k);
        updateCount();
      }, v.name))));
    updateCount();
    const isDefault = existing && existing.id === p.defaultProfile;
    return h('div.stack',
      h('h2', existing ? 'Edit setup' : 'New equipment setup'),
      name,
      h('p.small.faint', { style: { margin: 0 } }, 'Bodyweight exercises are always included. An exercise is only suggested when every piece it needs is switched on here.'),
      grid, count,
      h('button.btn.primary.block.lg', { onclick: async () => {
        draft.name = name.value.trim() || 'My setup';
        if (!draft.equipment.includes('bodyweight')) draft.equipment.push('bodyweight');
        const profiles = existing ? p.profiles.map((x) => (x.id === draft.id ? draft : x)) : [...p.profiles, draft];
        await Prefs.update({ profiles });
        close(); toast('Saved'); refresh();
      } }, 'Save'),
      existing && !isDefault && h('button.btn.block', { onclick: async () => { await Prefs.update({ defaultProfile: existing.id }); close(); refresh(); } }, 'Make this the default'),
      existing && !isDefault && p.profiles.length > 1 && h('button.btn.danger.block', { onclick: async () => {
        if (!(await confirm(`Delete “${existing.name}”?`, 'Past workouts are not affected.', { ok: 'Delete', danger: true }))) return;
        await Prefs.update({ profiles: p.profiles.filter((x) => x.id !== existing.id) });
        close(); refresh();
      } }, 'Delete setup'),
      h('button.btn.ghost.block', { onclick: () => close() }, 'Cancel'));
  }, { label: 'Equipment setup' });
}

function editIncrements(refresh) {
  const p = Prefs.get();
  const inc = { ...p.increments };
  const items = [['barbell', 'Barbell', 'Total bar weight added (5 lb = 2.5 lb per side)'], ['dumbbell', 'Dumbbells', 'Gap between dumbbells'], ['machine', 'Machines', 'Weight stack step'], ['cable', 'Cables', 'Weight stack step'], ['smith', 'Smith machine', 'Total added']];
  return sheet((close) => h('div.stack',
    h('h2', 'Weight jumps'),
    h('p.small.muted', { style: { margin: 0 } }, 'The smallest increase available at your gym. Progression uses these, so it never suggests a weight you can’t load.'),
    h('div.list', items.map(([k, label, sub]) => h('div.item', h('div.grow', h('div', label), h('div.sub', sub)),
      stepper(inc[k], { min: 2.5, max: 20, step: 2.5, format: (v) => `${v} lb`, onChange: (v) => { inc[k] = v; } })))),
    h('button.btn.primary.block.lg', { onclick: async () => { await Prefs.update({ increments: inc }); close(); toast('Saved'); refresh(); } }, 'Save'),
    h('button.btn.ghost.block', { onclick: () => close() }, 'Cancel')), { label: 'Weight jumps' });
}

function editKettlebells(refresh) {
  const have = new Set(Prefs.get().kettlebellSizes);
  return sheet((close) => h('div.stack',
    h('h2', 'Kettlebells you have'),
    h('p.small.muted', { style: { margin: 0 } }, 'Kettlebells jump in big steps, so progression moves to the next size you own and adds reps in between.'),
    h('div.chips', { style: { flexWrap: 'wrap', margin: 0, padding: 0 } }, KB_SIZES_LB.map((w) => h('button.chip', {
      type: 'button', 'aria-pressed': String(have.has(w)),
      onclick: (e) => { if (have.has(w)) have.delete(w); else have.add(w); e.currentTarget.setAttribute('aria-pressed', String(have.has(w))); },
    }, `${w} lb`))),
    h('button.btn.primary.block.lg', { onclick: async () => {
      if (!have.size) { toast('Pick at least one size', { error: true }); return; }
      await Prefs.update({ kettlebellSizes: [...have].sort((a, b) => a - b) }); close(); toast('Saved'); refresh();
    } }, 'Save'),
    h('button.btn.ghost.block', { onclick: () => close() }, 'Cancel')), { label: 'Kettlebells' });
}

async function reloadEdits() {
  Lookup.setOverrides(await DB.all('overrides'));
  Lookup.setCustom(await DB.all('customEx'));
}

// ───────── How it works: rules, evidence labels, sources ─────────
function howItWorks() {
  const p = Prefs.get();
  const tag = (basis) => h('span.basis', { class: basis }, BASIS[basis]);
  const ruleCard = (basis, text, sources = []) => h('div.card',
    tag(basis),
    h('p', { style: { margin: '4px 0 0' } }, text),
    sources.length > 0 && h('div.small.faint', { style: { marginTop: '4px' } }, sources.map((k) => SOURCES[k]?.short).filter(Boolean).join(' · ')));
  const engine = [
    ['estimate', `Recovery: about ${RECOVERY_HOURS.large} h for big muscles (legs, chest, back), ${RECOVERY_HOURS.medium} h for medium and ${RECOVERY_HOURS.small} h for small ones, longer after bigger sessions. A session type counts as ready at ${Math.round(READY * 100)}% recovered. Soreness you report overrides this.`],
    ['estimate', `No more than ${MAX_DAYS_IN_A_ROW} training days in a row. Missed days are never penalized; the next workout simply adapts.`],
    ['estimate', `After ${LONG_BREAK_DAYS}+ days away an exercise keeps its weight; after ${VERY_LONG_BREAK_DAYS}+ days it starts one step lighter. Weight jumps of more than ${Math.round(BIG_JUMP * 100)}% (common with kettlebells) need two sessions at the top of the range first.`],
    ['estimate', 'Estimated 1-rep max uses the Epley formula and is only shown for sets of 12 reps or fewer. It is a rough guide, not a tested max.'],
  ];
  const prefsRules = [
    ['preference', `About ${p.targetSessionsPerWeek} sessions a week (your setting). A target, not a schedule.`],
    ['preference', p.progressionStyle === 'classic'
      ? 'Progression: your 15 / 12 / max scheme. Last set under 10 → drop 5 lb; 10–15 → same; 15–20 → add 5 lb; over 20 → add weight. Heavy barbell lifts keep exercise-specific ranges.'
      : 'Progression: exercise-specific double progression. Switch to your 15 / 12 / max scheme under Progression style.'],
  ];
  return sheet((close) => h('div.stack',
    h('h2', 'How recommendations work'),
    h('p.muted', { style: { margin: 0 } }, 'Workouts are planned by fixed rules, not AI. They use your logged history, your settings and what you report each day. Each rule is labelled by how sure we are:'),
    h('div.small', tag('guideline'), ' published guidance · ', tag('estimate'), ' a reasonable reading, adjustable · ', tag('preference'), ' your choice'),
    h('div.section-label', 'Training rules'),
    RULES.map((r) => ruleCard(r.basis, r.text, r.sources)),
    h('div.section-label', 'How the planner decides'),
    engine.map(([b, t]) => ruleCard(b, t)),
    h('div.banner', h('b', 'Safety: '), 'pain is treated differently from soreness. Anything that loads a painful area is left out. The app never diagnoses and never suggests training through pain; persistent or sharp pain is worth getting checked.'),
    h('div.section-label', 'Your preferences'),
    prefsRules.map(([b, t]) => ruleCard(b, t)),
    h('div.section-label', 'Sources'),
    h('div.card', h('ol.cues', Object.values(SOURCES).map((src) => h('li.small', src.full)))),
    h('button.btn.block', { onclick: () => close() }, 'Close')), { label: 'How recommendations work' });
}
