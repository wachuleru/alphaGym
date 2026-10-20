// Smoke test: verify the chart wiring works end-to-end with the real charts.js.
import { MEASURE_FIELDS } from '../assets/js/services/measurements.js';
import { IMC_BANDS } from '../assets/js/services/health.js';

let lastCfg = null;
class FakeChart {
  constructor(canvas, cfg) { lastCfg = cfg; }
  destroy() {}
}
globalThis.window = { Chart: FakeChart };
globalThis.getComputedStyle = () => ({ getPropertyValue: () => '#f4c662' });
const fakeCanvas = {
  id: 'sdProgressChart',
  clientHeight: 300,
  style: {},
  dataset: {},
};
globalThis.document = {
  querySelector: (sel) => sel === '#sdProgressChart' ? fakeCanvas : null,
  querySelectorAll: () => [],
  documentElement: {},
};

const { lineChart } = await import('../assets/js/charts.js');

const student = { heightCm: 170, sex: 'M' };
const metricKey = 'weightKg';
const meas = [
  { date: '2026-01-01', weightKg: 75 },
  { date: '2026-04-01', weightKg: 72 },
  { date: '2026-07-01', weightKg: 70 },
  { date: '2026-10-01', weightKg: 68 },
];
const pts = meas.map((m) => ({ x: m.date, y: Number(m.weightKg) })).filter((p) => Number.isFinite(p.y));
const labels = pts.map((p) => p.x);

const baselineHeight = Number(student.heightCm) || null;
const showBands = metricKey === 'weightKg' && baselineHeight && baselineHeight > 0;
const heightM = showBands ? baselineHeight / 100 : null;
const bandRanges = showBands ? IMC_BANDS.map((b) => ({
  ...b,
  pesoMin: b.min * heightM * heightM,
  pesoMax: b.max === Infinity ? b.min * heightM * heightM * 2 : b.max * heightM * heightM,
})) : [];

let yMin = null, yMax = null;
if (showBands) {
  const dataMin = Math.min(...pts.map((p) => p.y));
  const dataMax = Math.max(...pts.map((p) => p.y));
  const underTopKg = IMC_BANDS[0].max * heightM * heightM;
  yMin = Math.min(dataMin, underTopKg) * 0.95;
  const obesityIiiTopKg = IMC_BANDS[IMC_BANDS.length - 1].min * heightM * heightM;
  yMax = Math.max(dataMax, obesityIiiTopKg) * 1.05;
}

const bandPlugin = showBands ? { id: 'imcBands', beforeDatasetsDraw() {} } : null;

const chartOptions = {
  plugins: { legend: { display: false }, tooltip: { mode: 'index', intersect: false } },
  scales: {
    x: { grid: { display: false }, ticks: { color: '#94a3b8' } },
    y: {
      beginAtZero: false,
      ticks: { color: '#94a3b8' },
      grid: { color: 'rgba(148,163,184,0.08)' },
      ...(yMin != null ? { suggestedMin: yMin } : {}),
      ...(yMax != null ? { suggestedMax: yMax } : {}),
    },
  },
};
const inlinePlugins = [bandPlugin].filter(Boolean);

lineChart(fakeCanvas, labels, [{ label: 'Peso (kg)', data: pts.map((p) => p.y), borderColor: '#f4c662' }], { ...chartOptions, inlinePlugins });

console.log('cfg.type:', lastCfg.type);
console.log('cfg.options.scales.y.suggestedMin:', lastCfg.options.scales.y.suggestedMin?.toFixed(2));
console.log('cfg.options.scales.y.suggestedMax:', lastCfg.options.scales.y.suggestedMax?.toFixed(2));
console.log('cfg.options.plugins keys:', Object.keys(lastCfg.options.plugins));
console.log('cfg.options.plugins.legend.display:', lastCfg.options.plugins.legend.display);
console.log('cfg.plugins:', lastCfg.plugins.length, 'inline plugin(s)');
console.log('cfg.plugins[0].id:', lastCfg.plugins[0]?.id);

function assert(cond, msg) {
  if (!cond) { console.error('FAIL:', msg); process.exit(1); }
  console.log('  OK ', msg);
}

assert(lastCfg.type === 'line', 'Chart type is "line"');
assert(lastCfg.data.labels.length === 4, '4 labels (one per measurement)');
assert(lastCfg.data.datasets[0].data.length === 4, '4 data points');
assert(lastCfg.data.labels[0] < lastCfg.data.labels[3], 'X axis is ascending by date');
assert(Math.abs(lastCfg.data.datasets[0].data[0] - 75) < 0.01, 'First data point is 75 kg');
assert(Math.abs(lastCfg.data.datasets[0].data[3] - 68) < 0.01, 'Last data point is 68 kg');
assert(lastCfg.options.scales.y.suggestedMin > 50, 'suggestedMin is > 50 (covers under-weight band sensibly)');
assert(lastCfg.options.scales.y.suggestedMax > 100, 'suggestedMax is > 100 (covers obese bands)');
assert(lastCfg.options.plugins.legend.display === false, 'Legend hidden');
assert(!('0' in lastCfg.options.plugins), 'No numeric keys in options.plugins (no pollution)');
assert(!('1' in lastCfg.options.plugins), 'No numeric key "1" in options.plugins');
assert(Array.isArray(lastCfg.plugins) && lastCfg.plugins.length === 1, '1 inline plugin at top-level cfg.plugins');
assert(lastCfg.plugins[0].id === 'imcBands', 'Inline plugin id is "imcBands"');
assert(!('imcBands' in lastCfg.options.plugins), 'No "imcBands" key in options.plugins (would shadow)');

console.log('\nChart wiring test passed.');
