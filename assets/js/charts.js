/* ===========================================================
   GymTrack — Charts helpers
   Tiny wrapper around Chart.js with shared dark theme.
   We track instances to destroy them between renders.
   =========================================================== */

import { chartPalette } from './config.js';

const _instances = new Map();

function defaultOpts() {
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'nearest', intersect: false },
    plugins: {
      legend: {
        display: true,
        position: 'bottom',
        labels: {
          color: '#94a3b8',
          font: { family: 'Inter', size: 11, weight: '600' },
          usePointStyle: true,
          boxWidth: 8,
          boxHeight: 8,
          padding: 12,
        },
      },
      tooltip: {
        backgroundColor: '#0c1530',
        titleColor: '#f1f5f9',
        bodyColor: '#cbd5e1',
        borderColor: '#243353',
        borderWidth: 1,
        padding: 10,
        cornerRadius: 8,
        titleFont: { family: 'Inter', size: 12, weight: '700' },
        bodyFont: { family: 'Inter', size: 12 },
        displayColors: true,
        boxPadding: 4,
      },
    },
    scales: {
      x: {
        grid: { color: 'rgba(148,163,184,0.08)', drawBorder: false },
        ticks: { color: '#64748b', font: { family: 'Inter', size: 11 } },
        border: { display: false },
      },
      y: {
        grid: { color: 'rgba(148,163,184,0.08)', drawBorder: false },
        ticks: { color: '#64748b', font: { family: 'Inter', size: 11 } },
        border: { display: false },
      },
    },
  };
}

function destroyExisting(canvas) {
  if (_instances.has(canvas)) {
    try { _instances.get(canvas).destroy(); } catch { /* noop */ }
    _instances.delete(canvas);
  }
}

function setupCanvas(canvas) {
  destroyExisting(canvas);
  // ensure height is at least its CSS height
  canvas.style.display = 'block';
  if (canvas.clientHeight === 0) canvas.style.minHeight = canvas.dataset.minHeight || '220px';
}

function commonDatasetsColors() {
  return chartPalette();
}

export function lineChart(canvas, labels, datasets, opts = {}) {
  if (!window.Chart) return null;
  setupCanvas(canvas);
  const palette = commonDatasetsColors();
  datasets.forEach((d, i) => {
    if (!d.borderColor) {
      const c = palette[i % palette.length];
      d.borderColor = c;
      if (d.fill && !d.backgroundColor) {
        d.backgroundColor = hexAlpha(c, 0.15);
      }
    }
    if (!d.tension && d.tension !== 0) d.tension = 0.35;
    if (!d.pointRadius) d.pointRadius = 3;
    if (!d.pointHoverRadius) d.pointHoverRadius = 5;
    if (!d.borderWidth) d.borderWidth = 2.5;
  });
  // inlinePlugins (custom key) → top-level cfg.plugins (Chart.js inline plugins)
  // opts.plugins → cfg.options.plugins (legend/tooltip/options config)
  const { inlinePlugins = [], ...optsRest } = opts;
  const cfg = {
    type: 'line',
    data: { labels, datasets },
    options: { ...defaultOpts(), ...optsRest },
    plugins: Array.isArray(inlinePlugins) ? inlinePlugins : [],
  };
  const c = new window.Chart(canvas, cfg);
  _instances.set(canvas, c);
  return c;
}

export function barChart(canvas, labels, datasets, opts = {}) {
  if (!window.Chart) return null;
  setupCanvas(canvas);
  const palette = commonDatasetsColors();
  datasets.forEach((d, i) => {
    if (!d.backgroundColor) {
      const c = palette[i % palette.length];
      d.backgroundColor = hexAlpha(c, d.stacked ? 0.85 : 0.85);
      d.borderRadius = { topLeft: 6, topRight: 6 };
      d.borderSkipped = false;
      d.maxBarThickness = 32;
    }
  });
  const { inlinePlugins = [], ...optsRest } = opts;
  const cfg = {
    type: 'bar',
    data: { labels, datasets },
    options: { ...defaultOpts(), ...optsRest },
    plugins: Array.isArray(inlinePlugins) ? inlinePlugins : [],
  };
  const c = new window.Chart(canvas, cfg);
  _instances.set(canvas, c);
  return c;
}

export function doughnutChart(canvas, labels, data, opts = {}) {
  if (!window.Chart) return null;
  setupCanvas(canvas);
  const palette = commonDatasetsColors();
  const { inlinePlugins = [], ...optsRest } = opts;
  const cfg = {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: palette,
        borderColor: '#0a1124',
        borderWidth: 3,
        hoverOffset: 6,
      }],
    },
    options: {
      ...defaultOpts(),
      cutout: '70%',
      plugins: {
        ...defaultOpts().plugins,
        legend: { ...defaultOpts().plugins.legend, position: 'right' },
        tooltip: defaultOpts().plugins.tooltip,
      },
      scales: {},
      ...optsRest,
    },
    plugins: Array.isArray(inlinePlugins) ? inlinePlugins : [],
  };
  const c = new window.Chart(canvas, cfg);
  _instances.set(canvas, c);
  return c;
}

export function destroyChart(canvas) { destroyExisting(canvas); }
export function destroyAll() {
  for (const c of _instances.values()) {
    try { c.destroy(); } catch { /* noop */ }
  }
  _instances.clear();
}

/**
 * Defers the callback until Chart.js is loaded AND the canvas has its
 * final layout dimensions. Chart.js measures the canvas synchronously on
 * construction; if we call it before layout, the canvas can be 0-sized
 * and the chart renders invisibly.
 */
export function waitChart(cb) {
  const run = () => requestAnimationFrame(() => requestAnimationFrame(cb));
  if (typeof window !== 'undefined' && window.Chart) return run();
  if (typeof window === 'undefined') return;
  let n = 0;
  const t = setInterval(() => {
    if (window.Chart) { clearInterval(t); run(); }
    else if (++n > 50) clearInterval(t);
  }, 100);
}

function hexAlpha(hex, alpha) {
  if (hex.startsWith('rgb')) return hex;
  hex = hex.replace('#', '');
  if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('');
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
