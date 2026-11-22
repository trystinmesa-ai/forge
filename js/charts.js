// Small hand-drawn SVG charts: columns, a line over time, and horizontal bars.
// One series each, in the accent colour; text in text colours; hairline grid.
// Tap or hover a mark for its exact value. Every chart has a "Show as table" view.
import { h } from './ui.js';

const NS = 'http://www.w3.org/2000/svg';
const s = (tag, attrs = {}, ...kids) => {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) el.setAttribute(k, v);
  for (const k of kids) if (k != null) el.append(k);
  return el;
};
const text = (x, y, str, attrs = {}) => s('text', { x, y, ...attrs }, String(str));

/** Clean axis maximum and 2–4 ticks. */
function niceScale(max, minTop = 1) {
  const top = Math.max(max, minTop);
  const raw = top / 3;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((m) => m >= raw);
  const hi = Math.ceil(top / step) * step;
  const ticks = [];
  for (let v = 0; v <= hi + 1e-9; v += step) ticks.push(Math.round(v * 100) / 100);
  return { hi, ticks };
}
const fmtTick = (v) => (v >= 10000 ? `${Math.round(v / 1000)}K` : v.toLocaleString());

/** Column with a 4px rounded top, square at the baseline. */
function colPath(x, y, w, hgt) {
  if (hgt <= 0) return '';
  const r = Math.min(4, w / 2, hgt);
  return `M${x},${y + hgt}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + hgt}Z`;
}

function frame(label, svg, rows, cols) {
  const tip = h('div.chart-tip', { role: 'status', 'aria-live': 'polite' });
  const wrap = h('div.chart', svg, tip);
  const show = (str, x, y) => {
    tip.textContent = str;
    tip.style.display = 'block';
    const box = wrap.getBoundingClientRect();
    const sx = box.width / Number(svg.getAttribute('data-w'));
    const half = tip.offsetWidth / 2 + 2; // keep the whole tooltip inside the card
    const left = Math.min(Math.max(x * sx, half), box.width - half);
    tip.style.left = `${left}px`;
    tip.style.top = `${Math.max(0, y * sx - 8)}px`;
  };
  const hide = () => { tip.style.display = 'none'; };
  wrap.addEventListener('pointerleave', hide);
  const table = h('details.chart-table',
    h('summary', 'Show as table'),
    h('table', h('thead', h('tr', cols.map((c) => h('th', c)))), h('tbody', rows.map((r) => h('tr', r.map((c) => h('td', c)))))));
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', label);
  return { el: h('div', wrap, table), show, hide };
}

function hit(svg, x, y, w, hgt, onShow) {
  const r = s('rect', { x, y, width: w, height: hgt, fill: 'transparent', class: 'chart-hit' });
  r.addEventListener('pointerenter', onShow);
  r.addEventListener('click', onShow);
  svg.append(r);
}

/**
 * Columns. data: [{ label, value, tip, faded }]. ref: { value, label } draws a hairline reference.
 */
export function columns({ data, label, ref = null, height = 150, minTop = 1, valueName = 'Value' }) {
  const W = 340, H = height, L = 26, B = 20, T = 10;
  const max = Math.max(...data.map((d) => d.value), ref?.value || 0);
  const { hi, ticks } = niceScale(max, minTop);
  const plotH = H - B - T, plotW = W - L;
  const y = (v) => T + plotH - (v / hi) * plotH;
  const band = plotW / data.length;
  const bw = Math.min(24, band - 4);
  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%', 'data-w': W });
  for (const t of ticks) {
    svg.append(s('line', { x1: L, x2: W, y1: y(t), y2: y(t), class: 'chart-grid' }));
    svg.append(text(L - 6, y(t) + 3.5, fmtTick(t), { class: 'chart-axis', 'text-anchor': 'end' }));
  }
  const f = frame(label, svg, data.map((d) => [d.label, d.tip || d.value]), ['', valueName]);
  data.forEach((d, i) => {
    const x = L + i * band + (band - bw) / 2;
    svg.append(s('path', { d: colPath(x, y(d.value), bw, y(0) - y(d.value)), class: d.faded ? 'chart-mark faded' : 'chart-mark' }));
    if (d.axis) svg.append(text(x + bw / 2, H - 5, d.axis, { class: 'chart-axis', 'text-anchor': 'middle' }));
    hit(svg, L + i * band, T, band, plotH, () => f.show(d.tip || `${d.label}: ${d.value}`, x + bw / 2, y(d.value)));
  });
  if (ref) {
    svg.append(s('line', { x1: L, x2: W, y1: y(ref.value), y2: y(ref.value), class: 'chart-ref' }));
    svg.append(text(W - 2, y(ref.value) - 4, ref.label, { class: 'chart-axis', 'text-anchor': 'end' }));
  }
  // A value on the latest column only; the rest are on tap and in the table.
  const last = data[data.length - 1];
  if (last && last.value > 0) svg.append(text(L + (data.length - 1) * band + band / 2, y(last.value) - 4, last.value, { class: 'chart-value', 'text-anchor': 'middle' }));
  return f.el;
}

/**
 * A line over time. points: [{ x: 'YYYY-MM-DD', y, tip }] oldest first. Spaced by date.
 */
export function line({ points, label, height = 160, unit = '', valueName = 'Value' }) {
  const W = 340, H = height, L = 34, R = 34, B = 20, T = 14;
  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%', 'data-w': W });
  const f = frame(label, svg, points.slice().reverse().map((p) => [p.x, p.tip || `${p.y}${unit}`]), ['Date', valueName]);
  if (!points.length) return f.el;
  const ys = points.map((p) => p.y);
  let lo = Math.min(...ys), hiv = Math.max(...ys);
  const pad = Math.max(1, (hiv - lo) * 0.15);
  lo = Math.max(0, lo - pad); hiv += pad;
  const { ticks } = niceScale(hiv - lo);
  const step = ticks[1] || 1;
  lo = Math.floor(lo / step) * step;
  const top = Math.ceil(hiv / step) * step;
  const t0 = Date.parse(points[0].x), t1 = Date.parse(points[points.length - 1].x);
  const plotW = W - L - R, plotH = H - B - T;
  const X = (d) => (t1 === t0 ? L + plotW / 2 : L + ((Date.parse(d) - t0) / (t1 - t0)) * plotW);
  const Y = (v) => T + plotH - ((v - lo) / (top - lo || 1)) * plotH;
  for (let v = lo; v <= top + 1e-9; v += step) {
    svg.append(s('line', { x1: L, x2: W - R, y1: Y(v), y2: Y(v), class: 'chart-grid' }));
    svg.append(text(L - 6, Y(v) + 3.5, fmtTick(Math.round(v)), { class: 'chart-axis', 'text-anchor': 'end' }));
  }
  const fmtDate = (d) => new Date(Date.parse(`${d}T12:00`)).toLocaleDateString([], { month: 'short', day: 'numeric' });
  svg.append(text(L, H - 5, fmtDate(points[0].x), { class: 'chart-axis' }));
  if (points.length > 1) svg.append(text(W - R, H - 5, fmtDate(points[points.length - 1].x), { class: 'chart-axis', 'text-anchor': 'end' }));
  if (points.length > 1) {
    svg.append(s('path', { d: points.map((p, i) => `${i ? 'L' : 'M'}${X(p.x)},${Y(p.y)}`).join(''), class: 'chart-line' }));
  }
  points.forEach((p, i) => {
    const isLast = i === points.length - 1;
    svg.append(s('circle', { cx: X(p.x), cy: Y(p.y), r: isLast ? 5 : 4, class: 'chart-dot' }));
    const prevX = i ? X(points[i - 1].x) : L, nextX = isLast ? W - R : X(points[i + 1].x);
    const x0 = (prevX + X(p.x)) / 2, x1 = (X(p.x) + nextX) / 2;
    hit(svg, i ? x0 : L - 6, T - 6, Math.max(16, (isLast ? W - R + 6 : x1) - (i ? x0 : L - 6)), plotH + 12, () => f.show(`${fmtDate(p.x)}: ${p.tip || `${p.y}${unit}`}`, X(p.x), Y(p.y)));
  });
  const last = points[points.length - 1];
  svg.append(text(Math.min(W - 2, X(last.x) + 8), Y(last.y) + 4, `${last.y}${unit}`, { class: 'chart-value' }));
  return f.el;
}

/**
 * Horizontal bars with an optional target band, e.g. weekly sets per muscle (10–20).
 * rows: [{ label, value, tip }].
 */
export function bars({ rows, label, band = null, max = null, valueName = 'Value' }) {
  const W = 340, rowH = 22, gap = 6, L = 96, R = 30, T = 4;
  const H = T + rows.length * (rowH + gap) + 16;
  const top = Math.max(max || 0, ...rows.map((r) => r.value), band ? band[1] : 0);
  const X = (v) => L + (v / top) * (W - L - R);
  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%', 'data-w': W });
  const f = frame(label, svg, rows.map((r) => [r.label, r.tip || r.value]), ['', valueName]);
  if (band) {
    svg.append(s('rect', { x: X(band[0]), y: 0, width: X(band[1]) - X(band[0]), height: H - 16, class: 'chart-band' }));
    svg.append(text(X(band[0]), H - 4, band[0], { class: 'chart-axis', 'text-anchor': 'middle' }));
    svg.append(text(X(band[1]), H - 4, band[1], { class: 'chart-axis', 'text-anchor': 'middle' }));
  }
  rows.forEach((r, i) => {
    const y = T + i * (rowH + gap);
    const bh = 14, by = y + (rowH - bh) / 2;
    svg.append(text(L - 8, y + rowH / 2 + 4, r.label, { class: 'chart-label', 'text-anchor': 'end' }));
    const w = Math.max(0, X(r.value) - L);
    if (w > 0) {
      const rr = Math.min(4, w, bh / 2);
      svg.append(s('path', { d: `M${L},${by}H${L + w - rr}Q${L + w},${by} ${L + w},${by + rr}V${by + bh - rr}Q${L + w},${by + bh} ${L + w - rr},${by + bh}H${L}Z`, class: 'chart-mark' }));
    }
    svg.append(text(L + w + 6, y + rowH / 2 + 4, Number.isInteger(r.value) ? r.value : r.value.toFixed(1), { class: 'chart-value small' }));
    hit(svg, 0, y, W, rowH, () => f.show(r.tip || `${r.label}: ${r.value}`, L + w, by));
  });
  return f.el;
}
