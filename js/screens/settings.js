// Settings: training preferences, appearance, backup/restore, cloud sync, erase.
import { h, icon, seg, stepper, toggle, toast, confirm, sheet } from '../ui.js';
import * as Prefs from '../prefs.js';
import * as DB from '../db.js';
import * as Backup from '../backup.js';
import * as Cloud from '../cloud.js';
import { EQUIPMENT } from '../data/taxonomy.js';
import { VERSION } from '../version.js';

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
      row('Rest timer', 'Starts after you complete a set', toggle(p.restTimer, (v) => save({ restTimer: v }), 'Rest timer'))),

    h('div.section-label', 'Equipment'),
    h('div.list',
      p.profiles.map((pr) => h('div.item',
        h('div.grow', h('div', pr.name, pr.id === p.defaultProfile && h('span.pill.accent', { style: { marginLeft: '8px' } }, 'Default')),
          h('div.sub', pr.equipment.map((e) => EQUIPMENT[e]?.name).filter(Boolean).join(', '))),
        pr.id !== p.defaultProfile && h('button.btn.ghost', { style: { minHeight: '36px', padding: '0 10px', fontSize: '14px' }, onclick: () => save({ defaultProfile: pr.id }).then(refresh) }, 'Make default'))),
      row('Weight jumps', `Barbell ${p.increments.barbell} lb · Dumbbell ${p.increments.dumbbell} lb · Machine/cable ${p.increments.machine} lb`, null)),
    h('p.small.faint', { style: { margin: '8px 4px 0' } }, `Starting with “${profileName(p.defaultProfile)}”. Editing profiles and weight jumps arrives with the exercise library.`),

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
      await Prefs.load();
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
  await Prefs.load();
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
      await Cloud.signOut(); await Prefs.load(); refresh();
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
        if (ok) { close(); await Prefs.load(); toast('Signed in'); refresh(); }
      } catch (ex) { err.textContent = ex.message; err.style.display = ''; }
      btn.disabled = false;
    } },
      h('h2', 'Sign in'),
      h('p.muted.small', { style: { margin: 0 } }, 'Same account as Tally. Workouts sync to a separate private table only you can read.'),
      email, pw, err, btn,
      h('button.btn.ghost.block', { type: 'button', onclick: () => close() }, 'Cancel'));
  }, { label: 'Sign in' });
}
