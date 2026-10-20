/* ===========================================================
   GymTrack — utilities: dates, ids, dom, formatters
   =========================================================== */

import { CURRENCY, WEEK_START_DAY } from './config.js';

/* ---------- IDs ---------- */
export function uid(prefix = 'id') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

/* ---------- Date utils ----------
   All dates are stored as ISO strings (YYYY-MM-DD or full ISO).
   We avoid Date ambiguity by working with local dates.
*/

export function todayISO() {
  const d = new Date();
  return toISODate(d);
}

export function toISODate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function fromISODate(s) {
  if (!s) return null;
  // Treat YYYY-MM-DD strings as local-date, no TZ shifts.
  const [y, m, d] = s.split('-').map(Number);
  if (!y || !m || !d) return new Date(s);
  return new Date(y, m - 1, d);
}

export function fmtDate(iso, fmt = 'dmy') {
  if (!iso) return '—';
  const d = fromISODate(iso);
  if (!d || isNaN(d)) return '—';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = d.getFullYear();
  if (fmt === 'ymd') return `${yy}-${mm}-${dd}`;
  if (fmt === 'long') return `${dd} de ${MONTHS_ES[d.getMonth()]} de ${yy}`;
  if (fmt === 'short') return `${dd}/${mm}`;
  return `${dd}/${mm}/${yy}`;
}

export const MONTHS_ES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

export const WEEKDAYS_ES_SHORT = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
export const WEEKDAYS_ES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

/** Returns Monday of the week containing `iso` (or Date). */
export function startOfWeek(dOrIso) {
  const d = typeof dOrIso === 'string' ? fromISODate(dOrIso) : new Date(dOrIso);
  const day = d.getDay(); // 0 = Sunday
  const diff = (day - WEEK_START_DAY + 7) % 7; // distance back to Monday
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function endOfWeek(dOrIso) {
  const start = startOfWeek(dOrIso);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return end;
}

export function addDays(dOrIso, n) {
  const d = typeof dOrIso === 'string' ? fromISODate(dOrIso) : new Date(dOrIso);
  d.setDate(d.getDate() + n);
  return d;
}

export function addMonths(dOrIso, n) {
  const d = typeof dOrIso === 'string' ? fromISODate(dOrIso) : new Date(dOrIso);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, lastDay));
  return d;
}

export function diffDays(aIso, bIso) {
  const a = fromISODate(aIso);
  const b = fromISODate(bIso);
  return Math.round((a - b) / (1000 * 60 * 60 * 24));
}

export function fmtTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d)) return '—';
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

export function fmtDateTime(iso) {
  if (!iso) return '—';
  return `${fmtDate(iso)} ${fmtTime(iso)}`;
}

/** Returns "hace 5 min", "hace 2 horas", "ayer", "hace 3 días". */
export function relativeTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const seconds = Math.round((now - d) / 1000);
  if (seconds < 60) return 'hace instantes';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.round(hours / 24);
  if (days === 1) return 'ayer';
  if (days < 7) return `hace ${days} días`;
  if (days < 30) return `hace ${Math.round(days / 7)} sem`;
  return `hace ${Math.round(days / 30)} meses`;
}

/* ---------- Numbers / currency ---------- */
export const fmtCLP = (n) => `${CURRENCY.symbol}${CURRENCY.format(n)}`;
export const fmtPct = (n, digits = 0) => `${(Number(n) || 0).toFixed(digits)}%`;
export const fmtNum = (n, digits = 1) => Number(n || 0).toLocaleString('es-CL', {
  minimumFractionDigits: digits, maximumFractionDigits: digits,
});

/* ---------- Strings ---------- */
export const initials = (name = '') => {
  const parts = name.trim().split(/\s+/);
  if (!parts.length || !parts[0]) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

export const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

export const capitalize = (s = '') => s.charAt(0).toUpperCase() + s.slice(1);

/* ---------- Sorting / grouping ---------- */
export const sortBy = (arr, fn, dir = 'asc') =>
  [...arr].sort((a, b) => {
    const va = fn(a), vb = fn(b);
    if (va < vb) return dir === 'asc' ? -1 : 1;
    if (va > vb) return dir === 'asc' ? 1 : -1;
    return 0;
  });

export const groupBy = (arr, fn) => {
  const out = new Map();
  for (const item of arr) {
    const key = fn(item);
    if (!out.has(key)) out.set(key, []);
    out.get(key).push(item);
  }
  return out;
};

/* ---------- DOM helpers ---------- */
export const $  = (sel, ctx = document) => ctx.querySelector(sel);
export const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

export const el = (tag, attrs = {}, children = []) => {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'html') node.innerHTML = v;
    else if (v === true) node.setAttribute(k, '');
    else node.setAttribute(k, v);
  }
  for (const child of [].concat(children).filter(Boolean)) {
    if (child instanceof Node) node.appendChild(child);
    else node.appendChild(document.createTextNode(String(child)));
  }
  return node;
};

/** escape user-provided strings that go into innerHTML */
export const esc = (s = '') => String(s)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

/* ---------- Validation ---------- */
export const isEmail = (s = '') => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
export const isPhone = (s = '') => /^[\d+\-\s().]{6,}$/.test(s.trim());
export const isISODate = (s = '') => /^\d{4}-\d{2}-\d{2}$/.test(s);

export const toNumber = (v, fallback = 0) => {
  if (v === '' || v === null || v === undefined) return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

export const toInt = (v, fallback = 0) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
};

/* ---------- Debounce ---------- */
export const debounce = (fn, ms = 250) => {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(null, args), ms);
  };
};

/* ---------- Misc ---------- */
export const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const a = el('a', { href: url, download: filename, class: 'hidden-sm' });
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
    a.remove();
  }, 0);
};
