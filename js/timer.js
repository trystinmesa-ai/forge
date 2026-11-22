// Rest timer: a bar above the bottom edge that counts down after you complete a set.
// Based on an end timestamp, so it stays right if the phone locks or the app reloads.
import { h } from './ui.js';

const KEY = 'forge.rest';
let bar = null, tick = null, els = null;

const load = () => { try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; } };
const save = (v) => { try { if (v) localStorage.setItem(KEY, JSON.stringify(v)); else localStorage.removeItem(KEY); } catch {} };
const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

export function start(seconds, label = 'Rest') {
  if (!seconds) return;
  save({ endsAt: Date.now() + seconds * 1000, total: seconds, label });
  show();
}

export function stop() { save(null); hide(); }

/** Pick up a timer that was running before a reload. */
export function resume() { if (load()) show(); }

function adjust(delta) {
  const t = load(); if (!t) return;
  t.endsAt = Math.max(Date.now() + 1000, t.endsAt + delta * 1000);
  t.total = Math.max(1, t.total + delta);
  save(t); render();
}

function hide() { clearInterval(tick); tick = null; bar?.remove(); bar = null; els = null; }

function show() {
  if (!bar) {
    els = {
      progress: h('div.rest-progress'),
      time: h('div.rest-time'),
      label: h('div.grow.small.muted'),
      controls: h('div.row', { style: { gap: '6px' } },
        h('button.btn', { onclick: () => adjust(-15), 'aria-label': 'Fifteen seconds less' }, '−15'),
        h('button.btn', { onclick: () => adjust(15), 'aria-label': 'Fifteen seconds more' }, '+15'),
        h('button.btn', { onclick: stop }, 'Skip')),
      ok: h('button.btn', { onclick: stop, style: { display: 'none' } }, 'OK'),
    };
    bar = h('div.rest-bar', { role: 'timer' }, els.progress, els.time, els.label, els.controls, els.ok);
    document.body.append(bar);
  }
  clearInterval(tick);
  tick = setInterval(render, 250);
  render();
}

function render() {
  const t = load();
  if (!t || !bar) { hide(); return; }
  const left = Math.ceil((t.endsAt - Date.now()) / 1000);
  const done = left <= 0;
  if (done && !bar.classList.contains('done')) {
    try { navigator.vibrate?.([120, 60, 120]); } catch {}
    setTimeout(() => { if (bar?.classList.contains('done')) stop(); }, 8000);
  }
  bar.classList.toggle('done', done);
  els.time.textContent = done ? 'Rest done' : fmt(left);
  els.label.textContent = done ? 'Next set when ready' : t.label;
  els.progress.style.width = `${done ? 0 : Math.max(0, Math.min(100, (left / t.total) * 100))}%`;
  els.controls.style.display = done ? 'none' : '';
  els.ok.style.display = done ? '' : 'none';
}
