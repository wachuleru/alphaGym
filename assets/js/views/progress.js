/* ===========================================================
   GymTrack — Progress (measurements overview)
   =========================================================== */

import { $, el, fmtDate, fmtCLP, initials } from '../utils.js';
import { fullName, listStudents } from '../services/students.js';
import { listMeasurements, MEASURE_FIELDS } from '../services/measurements.js';
import { IMC_BANDS } from '../services/health.js';
import { refreshIcons } from '../icons.js';
import { lineChart, barChart, doughnutChart, destroyChart, waitChart } from '../charts.js';

const escapeHtml = (s) => String(s || '').replace(/[<>&"']/g, (c) =>
  ({ '<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;' }[c]));

export async function renderProgress() {
  const main = $('#main');
  const meas = listMeasurements();
  const students = listStudents();

  main.innerHTML = `
    <div class="page-head">
      <div class="page-head__row">
        <div class="stack">
          <span class="crumbs"><a href="#/dashboard">Inicio</a><span>Progreso físico</span></span>
          <h1 class="page-head__title">Progreso físico</h1>
          <p class="page-head__sub">Análisis de peso, medidas e índices de salud del gimnasio.</p>
        </div>
        <div class="page-head__actions">
          <button class="btn btn--secondary" id="prExportBtn"><i data-lucide="download"></i>Exportar Excel</button>
        </div>
      </div>
    </div>

    <section class="kpi-row">
      <div class="kpi">
        <span class="kpi__label">Mediciones totales</span>
        <span class="kpi__value">${meas.length}</span>
        <span class="kpi__sub">en todo el gimnasio</span>
      </div>
      <div class="kpi kpi--accent">
        <span class="kpi__label">Alumnos con mediciones</span>
        <span class="kpi__value">${new Set(meas.map((m) => m.studentId)).size}</span>
        <span class="kpi__sub">de ${students.length} totales</span>
      </div>
      <div class="kpi kpi--success">
        <span class="kpi__label">Mediciones este mes</span>
        <span class="kpi__value">${meas.filter((m) => {
          const d = new Date(m.date);
          const now = new Date();
          return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
        }).length}</span>
        <span class="kpi__sub">registros recientes</span>
      </div>
      <div class="kpi">
        <span class="kpi__label">Alumnos con estatura registrada</span>
        <span class="kpi__value">${students.filter((s) => s.heightCm != null && s.heightCm !== '').length}</span>
        <span class="kpi__sub">en su ficha</span>
      </div>
    </section>

    <section class="kpi-row kpi-row--2" style="grid-template-columns: 1fr 1fr; gap:var(--sp-5); margin-top: var(--sp-5)">
      <article class="card">
        <header class="card__header">
          <div class="stack"><h3 class="card__title">Promedio de peso</h3><p class="card__subtitle">Evolución mensual</p></div>
        </header>
        <div class="card__body" style="height:280px"><div class="chart-canvas-wrap"><canvas id="prWeightChart"></canvas></div></div>
      </article>
      <article class="card">
        <header class="card__header">
          <div class="stack"><h3 class="card__title">Distribución de IMC</h3><p class="card__subtitle">Clasificación OMS por alumno (último peso)</p></div>
        </header>
        <div class="card__body" style="height:280px"><div class="chart-canvas-wrap"><canvas id="prIMCChart"></canvas></div></div>
      </article>
    </section>

    <section class="card" style="margin-top: var(--sp-5)">
      <header class="card__header">
        <div class="stack"><h3 class="card__title">Últimos registros por alumno</h3><p class="card__subtitle">Para abrir la ficha completa</p></div>
      </header>
      <div class="card__body" style="padding:0" id="prTable"></div>
    </section>
  `;

  $('#prExportBtn').addEventListener('click', async () => {
    const m = await import('../services/excel.js');
    m.exportMeasurements();
  });

  refreshTable();

  waitChart(() => {
    buildWeightChart();
    buildIMCChart();
  });

  refreshIcons(main);
}

function refreshTable() {
  const students = listStudents();
  const meas = listMeasurements();
  const recentByStudent = new Map();
  for (const s of students) {
    const own = meas.filter((m) => m.studentId === s.id).sort((a, b) => (a.date < b.date ? -1 : 1));
    if (own.length) recentByStudent.set(s.id, own[own.length - 1]);
  }
  const list = [...recentByStudent.entries()];
  const root = $('#prTable');
  if (!root) return;
  if (!list.length) {
    root.innerHTML = `<div class="empty"><div class="empty__icon"><i data-lucide="ruler"></i></div><div class="empty__title">Sin mediciones</div><div class="empty__text">Registra la primera medición desde la ficha de un alumno.</div></div>`;
    refreshIcons(root); return;
  }
  list.sort((a, b) => (a[1].date < b[1].date ? 1 : -1));
  root.innerHTML = `
    <div class="table-wrap" style="border:none;border-radius:0">
      <table class="table">
        <thead><tr><th>Alumno</th><th>Fecha</th><th class="num">Peso (kg)</th><th class="num">Estatura (cm)</th><th class="num">Cintura (cm)</th><th class="num">Cadera (cm)</th><th class="num">IMC</th><th class="num">Mediciones</th></tr></thead>
        <tbody>
          ${list.map(([sid, m]) => {
            const s = students.find((x) => x.id === sid);
            const total = meas.filter((mm) => mm.studentId === sid).length;
            const imcRaw = m.weightKg && s?.heightCm ? (m.weightKg / Math.pow(s.heightCm/100, 2)) : null;
            const imcText = imcRaw ? imcRaw.toFixed(1) : '—';
            return `<tr>
              <td><a href="#/students/${sid}/progress" class="cell-name" style="text-decoration:none;color:inherit"><span class="avatar avatar--sm avatar--accent">${initials(fullName(s))}</span><span>${escapeHtml(fullName(s))}</span></a></td>
              <td class="t-mono">${fmtDate(m.date)}</td>
              <td class="num">${m.weightKg ?? '—'}</td>
              <td class="num">${s?.heightCm ?? '—'}</td>
              <td class="num">${m.waistCm ?? '—'}</td>
              <td class="num">${m.hipCm ?? '—'}</td>
              <td class="num">${imcText}</td>
              <td class="num"><span class="badge badge--muted">${total}</span></td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
  refreshIcons(root);
}

function buildWeightChart() {
  const c = $('#prWeightChart');
  if (!c || !window.Chart) return;
  const meas = listMeasurements().slice().sort((a,b) => (a.date < b.date ? -1 : 1));
  const byMonth = new Map();
  for (const m of meas) {
    if (!Number.isFinite(Number(m.weightKg))) continue;
    const d = new Date(m.date);
    const k = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    if (!byMonth.has(k)) byMonth.set(k, []);
    byMonth.get(k).push(Number(m.weightKg));
  }
  const labels = [...byMonth.keys()].sort();
  const data = labels.map((k) => {
    const arr = byMonth.get(k);
    return arr.reduce((a, b) => a + b, 0) / arr.length;
  });
  if (!data.length) return;
  lineChart(c, labels.map((k) => k.slice(5)), [{
    label: 'Promedio kg',
    data,
    borderColor: '#f4c662',
    backgroundColor: 'rgba(244,198,98,0.18)',
    fill: true,
    tension: 0.35,
  }], {
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { display: false }, ticks: { color: '#94a3b8' } },
      y: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(148,163,184,0.08)' } },
    },
  });
}

function buildIMCChart() {
  const c = $('#prIMCChart');
  if (!c || !window.Chart) return;
  const meas = listMeasurements();
  const students = listStudents();
  // For each student, take the most recent measurement that has weight
  const byStudent = new Map();
  for (const s of students) {
    if (!s.heightCm) continue;
    const own = meas.filter((m) => m.studentId === s.id).sort((a, b) => (a.date < b.date ? -1 : 1));
    const last = own.find((m) => m.weightKg != null && m.weightKg !== '');
    if (last) byStudent.set(s.id, { name: fullName(s), imc: Number(last.weightKg) / Math.pow(Number(s.heightCm) / 100, 2) });
  }
  if (byStudent.size === 0) return;
  const counts = new Array(IMC_BANDS.length).fill(0);
  for (const { imc } of byStudent.values()) {
    const idx = IMC_BANDS.findIndex((b) => imc >= b.min && imc < b.max);
    if (idx >= 0) counts[idx]++;
  }
  doughnutChart(c, IMC_BANDS.map((b) => b.label), counts, {
    plugins: {
      legend: {
        display: true,
        position: 'right',
        labels: { color: '#94a3b8', font: { family: 'Inter', size: 11 }, boxWidth: 10, padding: 8 },
      },
    },
  });
}

function waitChart_deprecated() { /* moved to charts.js */ }
void waitChart_deprecated;
