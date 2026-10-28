/* ===========================================================
   ALPHA-FIT — hash-based router
   Hash format:
     #/dashboard
     #/students
     #/students/<id>
     #/students/<id>/attendance
     ...
   =========================================================== */

import { $, $$ } from './utils.js';

const _routes = new Map();
let _current = { path: '/', params: {}, query: {} };
const _listeners = new Set();

function parseHash() {
  const raw = location.hash.replace(/^#/, '') || '/';
  const [pathPart, queryPart] = raw.split('?');
  const segments = pathPart.split('/').filter(Boolean);
  const query = {};
  if (queryPart) {
    for (const pair of queryPart.split('&')) {
      const [k, v] = pair.split('=');
      query[decodeURIComponent(k)] = decodeURIComponent(v || '');
    }
  }
  return { path: '/' + segments.join('/'), params: { segments }, query };
}

function match(path) {
  const segs = path.split('/').filter(Boolean);
  // iterate keys from most-specific route to least
  const keys = [..._routes.keys()].sort((a, b) => b.split('/').filter(Boolean).length - a.split('/').filter(Boolean).length);
  for (const key of keys) {
    const kSegs = key.split('/').filter(Boolean);
    if (kSegs.length !== segs.length) continue;
    let ok = true;
    const params = {};
    for (let i = 0; i < kSegs.length; i++) {
      if (kSegs[i].startsWith(':')) params[kSegs[i].slice(1)] = segs[i];
      else if (kSegs[i] !== segs[i]) { ok = false; break; }
    }
    if (ok) return { key, params };
  }
  return null;
}

/** Register a route handler. */
export function route(pattern, handler) {
  _routes.set(pattern, handler);
}

/** Programmatically navigate. */
export function navigate(path) {
  if (location.hash === '#' + path) {
    handleHashChange();
  } else {
    location.hash = path;
  }
}

/** Listen to navigation events (after each successful resolution). */
export function onNavigate(fn) {
  _listeners.add(fn);
  return () => _listeners.delete(fn);
}

export function currentRoute() {
  return { ..._current };
}

async function handleHashChange() {
  const parsed = parseHash();
  const m = match(parsed.path) || match('/dashboard');
  const handler = m ? _routes.get(m.key) : _routes.get('/dashboard');
  _current = {
    path: parsed.path,
    params: { ...(m ? m.params : {}), segments: parsed.params.segments },
    query: parsed.query,
  };
  // Sync sidebar active state
  setActiveSidebar();
  // Scroll to top of main
  const main = $('#main');
  if (main) main.scrollTo({ top: 0, behavior: 'instant' });
  // Render
  try {
    await handler(_current);
  } catch (err) {
    console.error('Route handler failed', err);
  }
  // Notify listeners
  for (const fn of _listeners) {
    try { fn(_current); } catch { /* noop */ }
  }
}

function setActiveSidebar() {
  const segments = _current.params.segments;
  const routeName = segments[0] || 'dashboard';
  const links = $$('#navList [data-route]');
  for (const a of links) {
    const r = a.dataset.route;
    a.classList.toggle('is-active', r === routeName);
  }
}

export function startRouter() {
  window.addEventListener('hashchange', handleHashChange);
  if (!location.hash) location.hash = '#/dashboard';
  else handleHashChange();
}
