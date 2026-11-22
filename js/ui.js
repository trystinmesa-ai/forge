// Tiny DOM helpers: element builder, icons, sheets, toasts, confirm.

/** h('div.card', {onclick}, child, 'text', [more]) */
export function h(tag, props, ...kids) {
  const [name, ...classes] = tag.split('.');
  const el = document.createElement(name || 'div');
  if (classes.length) el.className = classes.join(' ');
  if (props && (typeof props !== 'object' || props instanceof Node || Array.isArray(props))) { kids.unshift(props); props = null; }
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className += ` ${v}`;
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k in el && typeof v !== 'string') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  append(el, kids);
  return el;
}
function append(el, kids) {
  for (const k of kids.flat(Infinity)) {
    if (k == null || k === false) continue;
    el.append(k instanceof Node ? k : document.createTextNode(String(k)));
  }
}

const P = {
  today: '<path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11"/>',
  history: '<rect x="3.5" y="5" width="17" height="15" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  library: '<path d="M5 4.5h4v15H5zM10.5 4.5h4v15h-4zM16 5.5l3.5-1 3 14-3.5 1z" transform="translate(-1 0)"/>',
  progress: '<path d="M4 19.5h16M6.5 16V11M11 16V6.5M15.5 16v-6M20 16V8.5" />',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z"/>',
  chevron: '<path d="M9 5l7 7-7 7"/>',
  left: '<path d="M15 5l-7 7 7 7"/>',
  right: '<path d="M9 5l7 7-7 7"/>',
  bolt: '<path d="M13 2.5L4.5 13.5H11l-1 8 8.5-11H12z"/>',
  download: '<path d="M12 4v11M7 10.5l5 5 5-5M5 19.5h14"/>',
  upload: '<path d="M12 15.5v-11M7 9l5-5 5 5M5 19.5h14"/>',
  cloud: '<path d="M7 18.5a4.5 4.5 0 0 1-.6-9 6 6 0 0 1 11.4 1.7A3.7 3.7 0 0 1 17.5 18.5z"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
};
export function icon(name, cls = '') {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 24 24');
  s.setAttribute('fill', 'none');
  s.setAttribute('stroke', 'currentColor');
  s.setAttribute('stroke-width', '1.8');
  s.setAttribute('stroke-linecap', 'round');
  s.setAttribute('stroke-linejoin', 'round');
  s.setAttribute('aria-hidden', 'true');
  if (cls) s.setAttribute('class', cls);
  s.innerHTML = P[name] || '';
  return s;
}

/** Bottom sheet. render(close) returns the content. Resolves with the value passed to close(). */
export function sheet(render, { label = 'Dialog' } = {}) {
  return new Promise((resolve) => {
    const root = document.getElementById('sheets');
    let done = false;
    const close = (v) => {
      if (done) return; done = true;
      back.remove(); document.removeEventListener('keydown', onKey); resolve(v);
    };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    const box = h('div.sheet', { role: 'dialog', 'aria-modal': 'true', 'aria-label': label }, h('div.grabber'), render(close));
    const back = h('div.sheet-backdrop', { onclick: (e) => { if (e.target === back) close(); } }, box);
    root.append(back);
    document.addEventListener('keydown', onKey);
    box.querySelector('button, input')?.focus({ preventScroll: true });
  });
}

export const confirm = (title, body, { ok = 'Confirm', danger = false } = {}) =>
  sheet((close) => h('div.stack',
    h('h2', title),
    body && h('p.muted', { style: { margin: '0 0 8px' } }, body),
    h('button.btn.block.lg', { class: danger ? 'danger' : 'primary', onclick: () => close(true) }, ok),
    h('button.btn.block.ghost', { onclick: () => close(false) }, 'Cancel'),
  ), { label: title });

export function toast(msg, { error = false, ms = 2600 } = {}) {
  const root = document.getElementById('toast-root');
  const t = h('div.toast', { class: error ? 'error' : '', role: 'status' }, msg);
  root.replaceChildren(t);
  setTimeout(() => t.remove(), ms);
}

export function seg(options, value, onPick) {
  const wrap = h('div.seg', { role: 'group' });
  for (const [v, label] of options) {
    wrap.append(h('button', {
      type: 'button', 'aria-pressed': String(v === value),
      onclick: () => {
        for (const b of wrap.children) b.setAttribute('aria-pressed', 'false');
        wrap.children[options.findIndex((o) => o[0] === v)].setAttribute('aria-pressed', 'true');
        onPick(v);
      },
    }, label));
  }
  return wrap;
}

export function stepper(value, { min = 0, max = 999, step = 1, format = String, onChange }) {
  let v = value;
  const out = h('output', format(v));
  const set = (n) => { v = Math.max(min, Math.min(max, n)); out.textContent = format(v); onChange(v); };
  return h('div.stepper',
    h('button', { type: 'button', 'aria-label': 'Decrease', onclick: () => set(v - step) }, '−'),
    out,
    h('button', { type: 'button', 'aria-label': 'Increase', onclick: () => set(v + step) }, '+'));
}

export function toggle(checked, onChange, label) {
  return h('label.switch', h('input', { type: 'checkbox', checked, 'aria-label': label, onchange: (e) => onChange(e.target.checked) }), h('span'));
}
