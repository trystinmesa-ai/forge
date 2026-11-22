// App start-up, navigation and theme.
import * as DB from './db.js';
import * as Prefs from './prefs.js';
import * as Cloud from './cloud.js';
import * as Lookup from './data/lookup.js';
import { h, icon, toast } from './ui.js';
import today from './screens/today.js';
import history from './screens/history.js';
import library from './screens/library.js';
import progress from './screens/progress.js';
import settings from './screens/settings.js';
import workout from './screens/workout.js';
import * as Timer from './timer.js';

export { VERSION } from './version.js';

const TABS = [
  { id: 'today', label: 'Today', icon: 'today', render: today },
  { id: 'history', label: 'History', icon: 'history', render: history },
  { id: 'library', label: 'Library', icon: 'library', render: library },
  { id: 'progress', label: 'Progress', icon: 'progress', render: progress },
];
const ROUTES = { ...Object.fromEntries(TABS.map((t) => [t.id, t.render])), settings, workout };

const app = document.getElementById('app');

function current() {
  const [route, ...rest] = location.hash.replace(/^#\/?/, '').split('/');
  return { route: ROUTES[route] ? route : 'today', args: rest };
}

export const go = (route, ...args) => { location.hash = `#/${[route, ...args].join('/')}`; };

let renderToken = 0;
export async function render() {
  const { route, args } = current();
  const token = ++renderToken;
  const tabRoute = route === 'settings' || route === 'workout' ? 'today' : route;
  document.body.classList.toggle('in-workout', route === 'workout');
  for (const a of document.querySelectorAll('.tabbar a')) {
    if (a.dataset.id === tabRoute) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  }
  try {
    const view = await ROUTES[route]({ args, go, refresh: render });
    if (token !== renderToken) return;           // a newer navigation won
    app.replaceChildren(view);
  } catch (e) {
    console.error(e);
    app.replaceChildren(h('div.card', h('h3', 'Something went wrong'), h('p.muted', e.message || String(e)),
      h('p.small.faint', 'Your saved data is not affected. Try reopening the app.')));
  }
}

function buildTabbar() {
  const nav = h('nav', { 'aria-label': 'Main' });
  for (const t of TABS) nav.append(h('a', { href: `#/${t.id}`, 'data-id': t.id }, icon(t.icon), t.label));
  document.getElementById('tabbar').replaceChildren(nav);
}

export function applyTheme(theme = Prefs.get().theme) {
  const dark = theme === 'dark' || (theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0a0b0d' : '#f4f5f7');
}

/** Ask the browser not to evict our data under storage pressure. */
async function persistStorage() {
  try {
    if (navigator.storage?.persisted && !(await navigator.storage.persisted())) await navigator.storage.persist();
  } catch {}
}

/** Your video links, notes, hidden flags and custom exercises, applied over the built-in library. */
async function loadLibraryEdits() {
  Lookup.setOverrides(await DB.all('overrides'));
  Lookup.setCustom(await DB.all('customEx'));
}

async function start() {
  buildTabbar();
  try {
    await Prefs.load();
    await loadLibraryEdits();
  } catch (e) {
    app.replaceChildren(h('div.card', h('h3', 'Storage unavailable'),
      h('p.muted', 'This browser is blocking on-device storage (private browsing can do this). Nothing can be saved until it is allowed.'),
      h('p.small.faint', e.message)));
    return;
  }
  applyTheme();
  Prefs.subscribe(() => applyTheme());
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => applyTheme());
  persistStorage();
  window.addEventListener('hashchange', render);
  await render();
  Timer.resume();
  Cloud.init({ onRemote: async () => { await Prefs.load(); await loadLibraryEdits(); render(); toast('Synced from your account'); } });
  Cloud.subscribe(() => { if (current().route === "settings") render(); });
  if ('serviceWorker' in navigator && location.protocol !== 'file:' && !new URLSearchParams(location.search).has('nosw')) {
    navigator.serviceWorker.register('sw.js').catch((e) => console.warn('Service worker failed', e));
  }
}

start();
