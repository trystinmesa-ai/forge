// Small shared helpers: ids, local dates, formatting.

export const uid = (prefix = '') =>
  prefix + (crypto.randomUUID ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`);

const pad = (n) => String(n).padStart(2, '0');

/** Local calendar date as YYYY-MM-DD (workouts belong to the day you did them, in your time zone). */
export const localDate = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Parse YYYY-MM-DD as local midnight. */
export const parseDate = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };

/** Whole calendar days from a to b (both YYYY-MM-DD or Date). Safe across daylight-saving changes. */
export const daysBetween = (a, b) => {
  const A = typeof a === 'string' ? parseDate(a) : a;
  const B = typeof b === 'string' ? parseDate(b) : b;
  return Math.round((Date.UTC(B.getFullYear(), B.getMonth(), B.getDate()) - Date.UTC(A.getFullYear(), A.getMonth(), A.getDate())) / 864e5);
};

export const addDays = (s, n) => { const d = parseDate(s); d.setDate(d.getDate() + n); return localDate(d); };

const WD = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MO = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const weekday = (s) => WD[parseDate(s).getDay()];
export const shortDate = (s) => { const d = parseDate(s); return `${MO[d.getMonth()]} ${d.getDate()}`; };
export const longDate = (s) => `${weekday(s)}, ${shortDate(s)}`;
export const monthName = (y, m) => `${['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][m]} ${y}`;

export function relativeDays(n) {
  if (n <= 0) return 'today';
  if (n === 1) return 'yesterday';
  return `${n} days ago`;
}

export const clockTime = (ms) => new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

export function duration(min) {
  if (min == null) return '';
  const m = Math.round(min);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h ${m % 60 ? `${m % 60} min` : ''}`.trim();
}

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
