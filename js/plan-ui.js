// Planning a workout: time, equipment, focus and how you feel → a preview with reasons
// → start it or regenerate. Everything is calculated on the phone from your own history.
import { h, icon, seg, sheet, toast } from './ui.js';
import * as Engine from './engine/index.js';
import * as L from './data/lookup.js';
import * as W from './workout.js';
import * as Prefs from './prefs.js';
import { REGIONS, MUSCLES } from './data/taxonomy.js';
import { localDate } from './util.js';

const JOINTS = ['knees', 'elbows', 'wrists', 'neck'];

/** Chips for sore / pain regions. onChange(list). */
export function regionChips(selected, { joints = false, onChange }) {
  const set = new Set(selected || []);
  return h('div.chips.wrap', Object.entries(REGIONS).filter(([k]) => joints || !JOINTS.includes(k)).map(([k, v]) =>
    h('button.chip', { type: 'button', 'aria-pressed': String(set.has(k)), onclick: (e) => {
      if (set.has(k)) set.delete(k); else set.add(k);
      e.currentTarget.setAttribute('aria-pressed', String(set.has(k)));
      onChange([...set]);
    } }, v.name)));
}

export function rxText(ex, sets, style) {
  const rx = L.prescription(ex, style);
  const per = ex.uni ? ' /side' : '';
  if (rx.setReps) return `${rx.setReps.slice(0, sets).join(' / ')}${per}`;
  if (rx.seconds) return `${sets} × ${rx.seconds[0]}–${rx.seconds[1]} s${per}`;
  return `${sets} × ${rx.reps[0]}–${rx.reps[1]}${per}`;
}

export const ARROW = { increase: '↑', decrease: '↓', hold: '→', reps: '↗', new: '•' };

/** Short "what weight" text for a preview row, from the progression rules and your real history. */
async function progressFor(ex, prefs) {
  const hist = await W.exerciseHistory(ex.id);
  const t = Engine.nextTarget(ex, L.prescription(ex, prefs.progressionStyle), hist.slice(0, 3), prefs, localDate());
  if (t.decision === 'new') return { t, text: 'New' };
  if (!t.weight) return { t, text: ARROW[t.decision] };
  return { t, text: `${ARROW[t.decision]} ${t.weight} lb` };
}

/** The planning sheet. Resolves after starting a workout (then calls go('workout')). */
export function planSheet({ go, focus = 'auto' } = {}) {
  const prefs = Prefs.get();
  const input = {
    minutes: prefs.defaultMinutes, profileId: prefs.defaultProfile, focus,
    checkin: { sore: [], pain: [], notes: '' },
  };
  let avoid = [];
  let current = null;

  return sheet((close) => {
    const preview = h('div.stack');
    const draw = async () => {
      const { when, workout: p } = await Engine.recommend({ prefs, ...input, avoid });
      current = p;
      const rows = await Promise.all(p.items.map(async (it) => {
        const ex = L.exercise(it.exerciseId);
        const pr = await progressFor(ex, prefs);
        return h('div.item.plan-row',
          h('div.grow', h('div', { style: { fontWeight: 600 } }, ex.name), h('div.sub', `${rxText(ex, it.sets, prefs.progressionStyle)} · ${ex.primary.map((m) => MUSCLES[m]?.name).join(', ')}`)),
          h('span.pill', { class: pr.t.decision === 'increase' ? 'accent' : '', title: pr.t.reason }, pr.text));
      }));
      preview.replaceChildren(...[
        h('div.spread', h('h3', p.title), h('span.pill', { class: p.overBudget ? 'warn' : '' }, icon('clock'), `~${p.estimateMin} min`)),
        when.days > 0 && h('div.banner.soft', `Your next session would normally be ${when.days === 1 ? 'tomorrow' : `in ${when.days} days`}. ${when.reason} Training today is fine; it’s planned around what’s recovered.`),
        h('ul.reasons', p.reasons.map((r) => h('li', r))),
        p.notes.length > 0 && h('div.banner', p.notes.join(' ')),
        p.warmup.length > 0 && h('div.small.muted', h('b', 'Warm-up (about 3 min): '), p.warmup.map((id) => L.exerciseName(id)).join(', '), p.ramp ? ', then two lighter sets of the first lift.' : '.'),
        rows.length ? h('div.list', rows) : h('div.card.empty', h('p', { style: { margin: 0 } }, 'Nothing fits these settings. Try more time, other equipment, or fewer reported areas.')),
      ].filter(Boolean));
    };
    const redraw = () => { avoid = []; draw(); };

    const profileChips = h('div.chips', prefs.profiles.map((pr) => h('button.chip', { type: 'button', 'aria-pressed': String(pr.id === input.profileId), onclick: (e) => {
      input.profileId = pr.id;
      for (const c of e.currentTarget.parentElement.children) c.setAttribute('aria-pressed', 'false');
      e.currentTarget.setAttribute('aria-pressed', 'true'); redraw();
    } }, pr.name)));
    const painNote = h('div');
    const notes = h('textarea', { rows: 2, placeholder: 'Anything else? (optional, saved with the workout)', onchange: (e) => { input.checkin.notes = e.target.value.trim(); } });

    draw();
    return h('div.stack',
      h('h2', 'Plan a workout'),
      h('div.field', h('div.label', 'Time'), seg([[30, '30'], [45, '45'], [60, '60'], [90, '90 min']], input.minutes, (v) => { input.minutes = v; redraw(); })),
      h('div.field', h('div.label', 'Equipment'), profileChips),
      h('div.field', h('div.label', 'Focus'), seg([['auto', 'Auto'], ['full', 'Full'], ['upper', 'Upper'], ['lower', 'Lower']], input.focus, (v) => { input.focus = v; redraw(); })),
      h('details.card.checkin',
        h('summary', h('span', 'How are you feeling?'), h('span.small.faint', 'Optional')),
        h('div.stack', { style: { marginTop: '10px' } },
          h('div.small.muted', 'Sore (normal muscle soreness)'),
          regionChips([], { onChange: (v) => { input.checkin.sore = v; redraw(); } }),
          h('div.small.muted', 'Pain or discomfort: anything that loads it is left out'),
          regionChips([], { joints: true, onChange: (v) => {
            input.checkin.pain = v; redraw();
            painNote.replaceChildren(v.length ? h('div.banner', 'Pain is different from soreness. The plan avoids loading it, but don’t train through pain. If it persists or is sharp, get it checked by a professional.') : '');
          } }),
          painNote, notes)),
      preview,
      h('button.btn.primary.block.lg', { onclick: async () => {
        if (!current?.items.length) { toast('Nothing to start with these settings', { error: true }); return; }
        try {
          await Engine.startPlan(current, { prefs, checkin: input.checkin });
          close(); go('workout');
        } catch (e) { toast(e.message, { error: true }); }
      } }, icon('bolt'), 'Start this workout'),
      h('button.btn.block', { onclick: () => {
        if (!current) return;
        avoid = [...new Set([...avoid, ...current.items.map((i) => i.exerciseId)])];
        draw();
      } }, 'Regenerate'),
      h('p.small.faint', { style: { margin: 0 } }, 'Planned by fixed rules from your logged history, recovery estimates and settings. Nothing leaves your phone.'),
      h('button.btn.ghost.block', { onclick: () => close() }, 'Cancel'));
  }, { label: 'Plan a workout' });
}
