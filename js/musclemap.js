// Front and back body diagram drawn in code, with muscles highlighted.
// Stylized (not anatomically exact): it shows *where* an exercise works at a glance.

const E = (cx, cy, rx, ry) => ({ t: 'ellipse', cx, cy, rx, ry });
const R = (x, y, w, h, r) => ({ t: 'rect', x, y, w, h, r });
const P = (d) => ({ t: 'path', d });
const mirror = (cxAxis, s) => (s.t === 'ellipse' ? { ...s, cx: 2 * cxAxis - s.cx } : s);

// [shape, muscleId | null]; the right side is mirrored automatically.
function front(cx) {
  const L = [
    [E(cx - 22, 40, 8, 7), 'frontDelts'],
    [E(cx - 28, 46, 3.5, 7), 'sideDelts'],
    [E(cx - 9, 46, 10, 8.5), 'chest'],
    [E(cx - 15, 74, 4.5, 14), 'obliques'],
    [E(cx - 28, 62, 4.8, 11), 'biceps'],
    [E(cx - 32, 87, 4.2, 12), 'forearms'],
    [E(cx - 34, 103, 3.6, 4), null],               // hand
    [E(cx - 5, 113, 4, 12), 'adductors'],
    [E(cx - 12, 124, 7.5, 21), 'quads'],
    [E(cx - 11, 150, 4.5, 4.5), null],              // knee
    [E(cx - 11, 170, 4.5, 15), 'calves'],
    [E(cx - 11, 190, 6, 3), null],                  // foot
  ];
  return [
    [E(cx, 14, 9.5, 11.5), null],                   // head
    [R(cx - 5, 24, 10, 8, 3), null],                // neck
    [R(cx - 8, 57, 16, 36, 5), 'abs'],
    [E(cx, 98, 13, 6), null],                       // pelvis
    ...L, ...L.map(([s, m]) => [mirror(cx, s), m]),
  ];
}

function back(cx) {
  const L = [
    [E(cx - 22, 40, 8, 7), 'rearDelts'],
    [E(cx - 28, 46, 3.5, 7), 'sideDelts'],
    [E(cx - 28, 61, 4.8, 11), 'triceps'],
    [E(cx - 32, 87, 4.2, 12), 'forearms'],
    [E(cx - 34, 103, 3.6, 4), null],
    [E(cx - 8, 106, 9, 9), 'glutes'],
    [E(cx - 10, 133, 7.5, 18), 'hamstrings'],
    [E(cx - 11, 153, 4.5, 3.5), null],
    [E(cx - 11, 169, 6, 13), 'calves'],
    [E(cx - 11, 190, 6, 3), null],
  ];
  return [
    [E(cx, 14, 9.5, 11.5), null],
    [R(cx - 5, 24, 10, 8, 3), null],
    [P(`M${cx} 27 L${cx - 19} 37 L${cx} 60 L${cx + 19} 37 Z`), 'upperBack'],
    [P(`M${cx - 17} 44 L${cx - 2} 60 L${cx - 3} 84 Q${cx - 15} 78 ${cx - 19} 64 Z`), 'lats'],
    [P(`M${cx + 17} 44 L${cx + 2} 60 L${cx + 3} 84 Q${cx + 15} 78 ${cx + 19} 64 Z`), 'lats'],
    [R(cx - 8, 80, 16, 16, 4), 'lowerBack'],
    ...L, ...L.map(([s, m]) => [mirror(cx, s), m]),
  ];
}

const NS = 'http://www.w3.org/2000/svg';
function node(s) {
  const el = document.createElementNS(NS, s.t);
  if (s.t === 'ellipse') for (const k of ['cx', 'cy', 'rx', 'ry']) el.setAttribute(k, s[k]);
  if (s.t === 'rect') { el.setAttribute('x', s.x); el.setAttribute('y', s.y); el.setAttribute('width', s.w); el.setAttribute('height', s.h); el.setAttribute('rx', s.r); }
  if (s.t === 'path') el.setAttribute('d', s.d);
  return el;
}

/** SVG with primary muscles in the accent colour, secondary ones faint. */
export function muscleMap(primary = [], secondary = [], { label = '' } = {}) {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 220 200');
  svg.setAttribute('class', 'muscle-map');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', label || 'Muscles worked');
  const P1 = new Set(primary), P2 = new Set(secondary);
  for (const [s, m] of [...front(55), ...back(165)]) {
    const el = node(s);
    el.setAttribute('class', P1.has(m) ? 'mm-primary' : P2.has(m) ? 'mm-secondary' : 'mm-base');
    svg.append(el);
  }
  for (const [x, t] of [[55, 'Front'], [165, 'Back']]) {
    const tx = document.createElementNS(NS, 'text');
    tx.setAttribute('x', x); tx.setAttribute('y', 199); tx.setAttribute('text-anchor', 'middle'); tx.setAttribute('class', 'mm-label');
    tx.textContent = t; svg.append(tx);
  }
  return svg;
}
