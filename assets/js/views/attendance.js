/* ===========================================================
   GymTrack — Attendance (global) view
   =========================================================== */

import { $, fmtDate, fmtTime, todayISO, fromISODate, debounce, initials } from '../utils.js';
import { listStudents, fullName } from '../services/students.js';
import { listAttendances, deleteAttendance } from '../services/attendance.js';
import { refreshIcons } from '../icons.js';
import { confirmDialog, toast } from '../components.js';
import { barChart, destroyAll, waitChart } from '../charts.js';

const escapeHtml = (s) => String(s || '').replace(/[<>&"']/g, (c) =>
  ({ '<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;' }[c]));

export async function renderAttendance() {
  const main = $('#main');
  main.innerHTML = `
    <div class="page-head">
      <div class="page-head__row">
        <div class="stack">
          <span class="crumbs"><a href="#/dashboard">Inicio</a><span>Asistencia</span></span>
          <h1 class="page-head__title">Asistencia</h1>
          <p class="page-head__sub">Registra, consulta y analiza la asistencia del gimnasio.</p>
        </div>
        <div class="page-head__actions">
          <button class="btn btn--secondary" id="attExportBtn"><i data-lucide="download"></i>Exportar Excel</button>
          <button class="btn btn--primary" id="attQuickReg"><i data-lucide="plus-circle"></i>Registrar asistencia</button>
        </div>
      </div>
    </div>

    <section class="kpi-row kpi-row--3" id="attKPIs"></section>

    <section class="kpi-row kpi-row--2" style="grid-template-columns: 1.5fr 1fr;">
      <article class="card" style="min-height:300px">
        <header class="card__header">
          <div class="stack"><h3 class="card__title">Asistencia por día (últimos 30 días)</h3></div>
          <div class="card__actions"></div>
        </header>
        <div class="card__body" style="height:280px"><div class="chart-canvas-wrap"><canvas id="attChart"></canvas></div></div>
      </article>
      <article class="card">
        <header class="card__header"><h3 class="card__title">Hoy en el gimnasio</h3></header>
        <div class="card__body" id="attToday"></div>
      </article>
    </section>

    <section class="kpi-row kpi-row--2" style="grid-template-columns: 1fr 1fr; gap:var(--sp-5); margin-top: var(--sp-5)">
      <article class="card">
        <header class="card__header">
          <div class="stack"><h3 class="card__title">Historial reciente</h3></div>
          <div class="card__actions">
            <input class="input input--inline" id="attSearch" placeholder="Buscar alumno…" style="width:200px" />
          </div>
        </header>
        <div class="card__body" style="padding:0" id="attRecentBody"></div>
      </article>
      <article class="card">
        <header class="card__header"><h3 class="card__title">Top asistentes del mes</h3></header>
        <div class="card__body" id="attTop"></div>
      </article>
    </section>
  `;

  refreshKPIs();
  refreshRecent();
  refreshToday();
  refreshTop();

  waitChart(() => buildChart());

  $('#attQuickReg').addEventListener('click', openRegister);
  $('#attExportBtn').addEventListener('click', async () => {
    const mod = await import('../services/excel.js');
    mod.exportAttendances();
  });
  $('#attSearch').addEventListener('input', debounce(refreshRecent, 80));

  refreshIcons(main);
}

function refreshKPIs() {
  const att = listAttendances();
  const today = todayISO();
  const todayList = att.filter((a) => a.dateISO === today);
  const monday = (() => {
    const d = new Date();
    const diff = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - diff);
    d.setHours(0,0,0,0);
    return d;
  })();
  const weekList = att.filter((a) => fromISODate(a.dateISO) >= monday);

  // Month KPI: average attendance per student this month
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const monthList = att.filter((a) => fromISODate(a.dateISO) >= monthStart);
  const students = listStudents().filter((s) => s.status === 'active');
  const totalSessions = monthList.length;
  const avgPerStudent = students.length ? (totalSessions / students.length) : 0;

  $('#attKPIs').innerHTML = `
    <div class="kpi kpi--success">
      <span class="kpi__label">Hoy</span>
      <span class="kpi__value">${todayList.length}</span>
      <span class="kpi__sub">sesiones registradas</span>
    </div>
    <div class="kpi kpi--accent">
      <span class="kpi__label">Esta semana</span>
      <span class="kpi__value">${weekList.length}</span>
      <span class="kpi__sub">lunes a hoy</span>
    </div>
    <div class="kpi">
      <span class="kpi__label">Total este mes</span>
      <span class="kpi__value">${monthList.length}</span>
      <span class="kpi__sub">${avgPerStudent.toFixed(1)} promedio por alumno</span>
    </div>
  `;
}

function refreshToday() {
  const att = listAttendances().filter((a) => a.dateISO === todayISO())
    .slice().sort((a, b) => (a.timeISO < b.timeISO ? 1 : -1));
  const root = $('#attToday');
  if (!root) return;
  if (!att.length) {
    root.innerHTML = `<div class="empty"><div class="empty__icon"><i data-lucide="sun"></i></div><div class="empty__title">Aún nadie ha llegado</div><div class="empty__text">Las primeras sesiones del día aparecerán aquí.</div></div>`;
    refreshIcons(root); return;
  }
  root.innerHTML = `
    <div class="stack-2">${att.slice(0, 12).map((a) => {
      const s = listStudents().find((x) => x.id === a.studentId);
      if (!s) return '';
      return `<a class="activity__item" href="#/students/${s.id}" style="text-decoration:none;color:inherit">
        <span class="activity__icon" style="background:var(--c-success-bg);color:var(--c-success)"><i data-lucide="check"></i></span>
        <div class="activity__body">
          <div class="activity__title">${escapeHtml(fullName(s))}</div>
          <div class="activity__time">${fmtTime(a.timeISO || (a.dateISO + 'T08:00:00Z'))}</div>
        </div>
      </a>`;
    }).join('')}</div>
  `;
  refreshIcons(root);
}

function refreshRecent() {
  const term = ($('#attSearch').value || '').toLowerCase();
  const att = listAttendances().slice().sort((a, b) => (a.dateISO < b.dateISO ? 1 : -1));
  const filtered = att.filter((a) => {
    if (!term) return true;
    const s = listStudents().find((x) => x.id === a.studentId);
    return s && fullName(s).toLowerCase().includes(term);
  });
  const root = $('#attRecentBody');
  if (!root) return;
  if (!filtered.length) {
    root.innerHTML = `<div class="empty"><div class="empty__icon"><i data-lucide="calendar-x"></i></div><div class="empty__title">Sin resultados</div></div>`;
    refreshIcons(root); return;
  }
  root.innerHTML = `
    <div class="table-wrap" style="border:none;border-radius:0">
      <table class="table">
        <thead><tr><th>Fecha</th><th>Hora</th><th>Alumno</th><th>Notas</th><th></th></tr></thead>
        <tbody>
          ${filtered.slice(0, 100).map((a) => {
            const s = listStudents().find((x) => x.id === a.studentId);
            return `<tr>
              <td class="t-mono">${fmtDate(a.dateISO)}</td>
              <td class="t-mono">${fmtTime(a.timeISO || (a.dateISO + 'T00:00:00Z'))}</td>
              <td>${s ? `<a href="#/students/${s.id}">${escapeHtml(fullName(s))}</a>` : '<span class="t-muted">eliminado</span>'}</td>
              <td class="t-muted">${escapeHtml(a.notes || '—')}</td>
              <td class="row-actions"><button class="icon-btn" data-act="del" data-id="${a.id}" title="Eliminar"><i data-lucide="trash-2"></i></button></td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>`;
  refreshIcons(root);

  root.addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-act="del"]');
    if (!btn) return;
    const ok = await confirmDialog({ title: 'Eliminar asistencia', message: '¿Eliminar esta asistencia?' });
    if (!ok) return;
    deleteAttendance(btn.dataset.id);
    toast({ type: 'success', message: 'Asistencia eliminada.' });
    refreshKPIs();
    refreshRecent();
    refreshToday();
  });
}

function refreshTop() {
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const att = listAttendances().filter((a) => fromISODate(a.dateISO) >= monthStart);
  const counts = new Map();
  for (const a of att) counts.set(a.studentId, (counts.get(a.studentId) || 0) + 1);
  const top = [...counts.entries()].sort((a,b) => b[1] - a[1]).slice(0, 10);
  const root = $('#attTop');
  if (!root) return;
  if (!top.length) {
    root.innerHTML = `<div class="empty"><div class="empty__icon"><i data-lucide="bar-chart-2"></i></div><div class="empty__title">Sin datos este mes</div></div>`;
    refreshIcons(root); return;
  }
  const max = top[0][1];
  root.innerHTML = `
    <div class="stack-2">${top.map(([sid, count]) => {
      const s = listStudents().find((x) => x.id === sid);
      if (!s) return '';
      const w = (count / max) * 100;
      return `<a class="activity__item" href="#/students/${s.id}" style="text-decoration:none;color:inherit">
        <span class="avatar avatar--sm avatar--accent">${initials(fullName(s))}</span>
        <div class="activity__body">
          <div class="activity__title">${escapeHtml(fullName(s))} <strong style="float:right">${count} sesiones</strong></div>
          <div class="progress" style="margin-top:4px"><div class="progress__bar" style="width:${w.toFixed(1)}%; background:linear-gradient(90deg, var(--c-secondary), #0ea5e9)"></div></div>
        </div>
      </a>`;
    }).join('')}</div>`;
  refreshIcons(root);
}

function buildChart() {
  const c = $('#attChart');
  if (!c || !window.Chart) return;
  const labels = [];
  const data = [];
  const today = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    labels.push(`${d.getDate()}/${d.getMonth()+1}`);
    data.push(listAttendances().filter((a) => a.dateISO === dStr).length);
  }
  barChart(c, labels, [{
    label: 'Asistencias',
    data,
    backgroundColor: 'rgba(244,198,98,0.85)',
    borderRadius: { topLeft: 6, topRight: 6 },
    maxBarThickness: 18,
  }], {
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { display: false }, ticks: { color: '#94a3b8', maxRotation: 0, autoSkip: true, maxTicksLimit: 12 } },
      y: { beginAtZero: true, ticks: { precision: 0, color: '#94a3b8' }, grid: { color: 'rgba(148,163,184,0.08)' } },
    },
  });
}

function openRegister() {
  // Delegado al formulario compartido (schema v2: catálogo + preload + delta).
  import('./attendance-form.js').then((mod) =>
    mod.openAttendanceForm({
      onSaved: () => {
        refreshKPIs();
        refreshRecent();
        refreshToday();
      },
    })
  );
}
