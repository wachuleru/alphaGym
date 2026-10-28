/* ===========================================================
   ALPHA-FIT — Lucide helpers
   The CDN script defines `window.lucide`. We re-render icons
   after every DOM mutation via `app.refreshIcons()`.
   =========================================================== */

let _ready = false;

function tryRun() {
  if (typeof window === 'undefined') return false;
  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    try { window.lucide.createIcons(); _ready = true; } catch { /* noop */ }
  }
  return _ready;
}

export function initIcons() {
  if (tryRun()) return;
  const t = setInterval(() => {
    if (tryRun()) clearInterval(t);
  }, 80);
  setTimeout(() => clearInterval(t), 5000);
}

/** Re-create all <i data-lucide="*"> elements into <svg>. Call after every render. */
export function refreshIcons(root = document) {
  if (!window.lucide) {
    // lucide not loaded yet — wait briefly then retry
    setTimeout(() => refreshIcons(root), 60);
    return;
  }
  try { window.lucide.createIcons(root); } catch (err) { /* noop */ }
}

/** Helper: turn a list of icon names + their data into inline SVG strings */
export function svg(name, attrs = {}) {
  const base = (window.lucide && window.lucide.icons && window.lucide.icons[name])
    ? null : null;
  // We'll just rely on lucide.createIcons() at render time
  return `<i data-lucide="${name}"${Object.entries(attrs).map(([k, v]) => ` data-${k}="${v}"`).join('')}></i>`;
}
