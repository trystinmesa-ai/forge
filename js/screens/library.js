// Exercise library. The browsing screen is built in Phase 2; this shows the structure it will use.
import { h } from '../ui.js';
import { MUSCLES, EQUIPMENT, PATTERNS } from '../data/taxonomy.js';
import { allExercises } from '../data/lookup.js';

export default async function library() {
  const n = allExercises().length;
  return h('div',
    h('header.screen-head', h('div', h('div.eyebrow', `${n} exercises`), h('h1', 'Library'))),
    h('div.card.empty',
      h('h3', 'Exercise library arrives in Phase 2'),
      h('p', { style: { margin: 0 } }, 'Every exercise will list its muscles, equipment, movement pattern, rep ranges, instructions and alternatives.')),
    h('div.section-label', 'It will be organized by'),
    h('div.stat-grid',
      h('div.stat', h('div.v', Object.keys(MUSCLES).length), h('div.l', 'Muscle groups')),
      h('div.stat', h('div.v', Object.keys(PATTERNS).length), h('div.l', 'Movement patterns')),
      h('div.stat', h('div.v', Object.keys(EQUIPMENT).length), h('div.l', 'Equipment types'))));
}
