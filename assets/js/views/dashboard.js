/* ===========================================================
   ALPHA-FIT — Dashboard view
   =========================================================== */

import { $, el, fmtDate, todayISO, fromISODate, fmtCLP, fmtPct, fmtTime, relativeTime, sortBy, MONTHS_ES } from '../utils.js';
import { listStudents, fullName } from '../services/students.js';
import { listAttendances, lastAttendanceFor } from '../services/attendance.js';
import { listPayments, totalReceivedInMonth, refreshOverdueFlags } from '../services/payments.js';
import { computeStudentMetrics, determineLevel } from '../services/levels.js';
import { LEVELS } from '../config.js';
import { getState } from '../storage.js';
import { lineChart, barChart, doughnutChart, waitChart } from '../charts.js';
import { refreshIcons } from '../icons.js';
import { openModal, toast } from '../components.js';

const MONTHS_ES_SHORT = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

function todayLabel() {
  const d = new Date();
  const day = d.getDate();
  const month = MONTHS_ES[d.getMonth()];
  const yr = d.getFullYear();
  const wd = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'][d.getDay()];
  return `${wd} ${day} de ${month} de ${yr}`;
}

function greeting() {
  const h = new Date().getHours();
  if (h < 6)  return 'Buenas noches';
  if (h < 12) return 'Buenos días';
  if (h < 20) return 'Buenas tardes';
  return 'Buenas noches';
}

export async function renderDashboard() {
  refreshOverdueFlags();
  const main = $('#main');
  main.innerHTML = `
    <div class="page-head">
      <div class="page-head__row">
        <div class="stack">
          <span class="crumbs">Inicio</span>
          <h1 class="page-head__title">Dashboard</h1>
        </div>
      </div>
    </div>

    <section class="dash-hero">
      <div class="dash-hero__head">
        <p class="dash-hero__greet" id="dashGreet">${greeting()}, administrador</p>
        <p class="dash-hero__date" id="dashDate">${todayLabel()}</p>
        <div class="dash-hero__quick">
          <button class="btn btn--primary" id="qaRegister"><i data-lucide="plus-circle"></i>Registrar asistencia</button>
          <button class="btn btn--secondary" id="qaAddStudent"><i data-lucide="user-plus"></i>Nuevo alumno</button>
          <button class="btn btn--secondary" id="qaAddMeas"><i data-lucide="scale"></i>Nueva medición</button>
        </div>
      </div>
      <div class="dash-hero__stats" id="dashHeroStats"></div>
    </section>

    <section class="dash-grid">
      <article class="card dash-grid__chart">
        <header class="card__header">
          <div class="stack">
            <h2 class="card__title">Asistencias de la semana</h2>
            <p class="card__subtitle">Comparado con las 4 semanas anteriores</p>
          </div>
          <div class="card__actions">
            <div class="btn-group" id="dashChartPeriod">
              <button class="btn is-active" data-period="6w">6 sem</button>
              <button class="btn" data-period="12w">12 sem</button>
            </div>
          </div>
        </header>
        <div class="card__body" style="height:320px">
          <div class="chart-canvas-wrap"><canvas id="dashAttendanceChart"></canvas></div>
        </div>
      </article>

      <article class="dash-grid__side stack-4">
        <div class="card">
          <header class="card__header"><h3 class="card__title">Actividad reciente</h3></header>
          <div class="card__body"><div class="activity" id="dashActivity"></div></div>
        </div>
        <div class="card">
          <header class="card__header"><h3 class="card__title">Necesitan atención</h3></header>
          <div class="card__body" id="dashAttention"></div>
        </div>
      </article>
    </section>

    <section class="dash-band">
      <article class="card" style="min-height:360px">
        <header class="card__header"><h3 class="card__title">Evolución de alumnos activos</h3></header>
        <div class="card__body" style="height:300px"><div class="chart-canvas-wrap"><canvas id="dashActiveStudentsChart"></canvas></div></div>
      </article>
      <article class="card" style="min-height:360px">
        <header class="card__header"><h3 class="card__title">Ingresos por período (6 meses)</h3></header>
        <div class="card__body" style="height:300px"><div class="chart-canvas-wrap"><canvas id="dashRevenueChart"></canvas></div></div>
      </article>
      <article class="card" style="min-height:360px">
        <header class="card__header"><h3 class="card__title">Distribución de niveles</h3></header>
        <div class="card__body" style="height:300px"><div class="chart-canvas-wrap"><canvas id="dashLevelsChart"></canvas></div></div>
      </article>
    </section>

    <section class="dash-foot">
      <article class="card">
        <header class="card__header"><h3 class="card__title">Estado de pagos del mes</h3></header>
        <div class="card__body" id="dashPaymentsBreakdown"></div>
      </article>
      <article class="card">
        <header class="card__header"><h3 class="card__title">Próximos vencimientos</h3></header>
        <div class="card__body" id="dashUpcoming"></div>
      </article>
    </section>
  `;

  renderHeroStats();
  renderAttentionList();
  renderActivityList();
  renderPaymentsBreakdown();
  renderUpcoming();

  // Charts: build only when Chart.js is loaded and layout is settled
  waitChart(() => {
    buildAttendanceChart();
    buildActiveStudentsChart();
    buildRevenueChart();
    buildLevelsChart();
  });

  bindQuickActions();

  refreshIcons(main);
}

function waitForChart_deprecated() { /* moved to charts.js */ }
void waitForChart_deprecated;

function bindQuickActions() {
  $('#qaRegister')?.addEventListener('click', openAttendanceQuick);
  $('#qaAddStudent')?.addEventListener('click', () => location.hash = '#/students?new=1');
  $('#qaAddMeas')?.addEventListener('click', openMeasurementQuick);

  $('#dashChartPeriod')?.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-period]');
    if (!btn) return;
    const group = btn.parentElement.querySelectorAll('button');
    group.forEach((b) => b.classList.toggle('is-active', b === btn));
    buildAttendanceChart(btn.dataset.period);
  });
}

function calcStats() {
  const db = getState();
  const students = db.students || [];
  const attendances = db.attendances || [];
  const payments = db.payments || [];
  const today = todayISO();
  const month = new Date().getMonth();
  const yr = new Date().getFullYear();

  const activeStudents = students.filter((s) => s.status === 'active');
  const newThisMonth = students.filter((s) => {
    const d = fromISODate(s.joinedAt);
    return d && d.getMonth() === month && d.getFullYear() === yr;
  });
  const attToday = attendances.filter((a) => a.dateISO === today);
  const attThisWeek = (() => {
    const monday = fromISODate(today);
    const dow = monday.getDay();
    const diff = (dow + 6) % 7;
    monday.setDate(monday.getDate() - diff);
    return attendances.filter((a) => fromISODate(a.dateISO) >= monday);
  })();

  // % students meeting weekly goal
  let meetingGoal = 0;
  for (const s of activeStudents) {
    const m = computeStudentMetrics(s, attendances, db.measurements, db.goals, db.closures);
    if (m.streakWeeks >= 1 && m.totalAttendances >= (s.weeklyGoal || 2)) meetingGoal++;
  }
  const compliancePct = activeStudents.length ? (meetingGoal / activeStudents.length) * 100 : 0;

  const noRecent = activeStudents.filter((s) => {
    const last = lastAttendanceFor(s.id);
    if (!last) return true;
    const days = (new Date(today) - fromISODate(last.dateISO)) / 86400000;
    return days > 14;
  });

  const pending = payments.filter((p) => p.status === 'pending');
  const overdue = payments.filter((p) => p.status === 'overdue');
  const receivedThisMonth = totalReceivedInMonth(yr, month);

  return {
    counts: {
      totalStudents: students.length,
      activeStudents: activeStudents.length,
      newThisMonth: newThisMonth.length,
      attToday: attToday.length,
      attThisWeek: attThisWeek.length,
      compliancePct,
      noRecent: noRecent.length,
    },
    lists: {
      noRecent,
      pending,
      overdue,
    },
    financials: {
      receivedThisMonth,
      pendingTotal: pending.reduce((a, p) => a + (Number(p.amount) || 0), 0),
      overdueTotal: overdue.reduce((a, p) => a + (Number(p.amount) || 0), 0),
    },
  };
}

function renderHeroStats() {
  const s = calcStats();
  const hero = $('#dashHeroStats');
  if (!hero) return;
  hero.innerHTML = `
    <div class="stat stat--featured">
      <div class="stat__head">
        <span class="stat__label">Alumnos activos</span>
        <span class="stat__icon"><i data-lucide="users"></i></span>
      </div>
      <span class="stat__value">${s.counts.activeStudents}</span>
      <div class="stat__sub">
        <span>+${s.counts.newThisMonth} este mes</span>
        <span class="t-muted">·</span>
        <span>${s.counts.totalStudents} totales</span>
      </div>
    </div>
    <div class="stat">
      <div class="stat__head">
        <span class="stat__label">Asistencias hoy</span>
        <span class="stat__icon stat__icon--info"><i data-lucide="calendar-check"></i></span>
      </div>
      <span class="stat__value">${s.counts.attToday}</span>
      <div class="stat__sub">${s.counts.attThisWeek} esta semana</div>
    </div>
    <div class="stat">
      <div class="stat__head">
        <span class="stat__label">Ingresos del mes</span>
        <span class="stat__icon stat__icon--success"><i data-lucide="banknote"></i></span>
      </div>
      <span class="stat__value" style="font-size:var(--fs-3xl)">${fmtCLP(s.financials.receivedThisMonth)}</span>
      <div class="stat__sub">${fmtCLP(s.financials.pendingTotal)} pendientes</div>
    </div>
    <div class="stat">
      <div class="stat__head">
        <span class="stat__label">Cumplimiento</span>
        <span class="stat__icon stat__icon--warning"><i data-lucide="flame"></i></span>
      </div>
      <span class="stat__value">${fmtPct(s.counts.compliancePct)}</span>
      <div class="stat__sub">${s.counts.noRecent} sin asistir 14+ días</div>
    </div>
  `;
  refreshIcons(hero);
}

function renderAttentionList() {
  const s = calcStats();
  const root = $('#dashAttention');
  if (!root) return;
  const list = s.lists.noRecent;
  if (!list.length) {
    root.innerHTML = `<div class="empty"><div class="empty__icon"><i data-lucide="check-circle-2"></i></div><div class="empty__title">Todo al día</div><div class="empty__text">Nadie requiere atención inmediata.</div></div>`;
    refreshIcons(root);
    return;
  }
  root.innerHTML = `
    <div class="stack-2">
      ${list.slice(0, 6).map((stu) => {
        const last = lastAttendanceFor(stu.id);
        const daysAgo = last ? Math.round((new Date(todayISO()) - fromISODate(last.dateISO)) / 86400000) : null;
        return `
          <a class="activity__item" href="#/students/${stu.id}" style="text-decoration:none;color:inherit">
            <span class="activity__icon"><i data-lucide="user-minus"></i></span>
            <div class="activity__body">
              <div class="activity__title"><strong>${fullName(stu)}</strong>${last ? ` — sin asistir hace ${daysAgo} días` : ' — nunca registrado'}</div>
              <div class="activity__time">${last ? relativeTime(last.timeISO || last.dateISO + 'T08:00:00Z') : 'sin datos'}</div>
            </div>
          </a>
        `;
      }).join('')}
      ${list.length > 6 ? `<div class="t-muted" style="font-size:var(--fs-xs); padding-top:4px">y ${list.length - 6} más…</div>` : ''}
    </div>
  `;
  refreshIcons(root);
}

function renderActivityList() {
  const db = getState();
  const events = [];
  for (const a of (db.attendances || [])) {
    const s = listStudents().find((x) => x.id === a.studentId);
    if (!s) continue;
    events.push({
      type: 'attendance',
      at: a.timeISO || (a.dateISO + 'T08:00:00Z'),
      title: `<strong>${fullName(s)}</strong> registró asistencia`,
      sub: fmtDate(a.dateISO) + ' · ' + fmtTime(a.timeISO || (a.dateISO + 'T08:00:00Z')),
      icon: 'calendar-check',
    });
  }
  for (const m of (db.measurements || [])) {
    const s = listStudents().find((x) => x.id === m.studentId);
    if (!s) continue;
    events.push({
      type: 'measurement',
      at: m.meta?.createdAt || (m.date + 'T08:00:00Z'),
      title: `<strong>${fullName(s)}</strong> actualizó sus medidas`,
      sub: m.date,
      icon: 'scale',
    });
  }
  for (const p of (db.payments || [])) {
    if (p.status !== 'paid' || !p.paidAt) continue;
    const s = listStudents().find((x) => x.id === p.studentId);
    if (!s) continue;
    events.push({
      type: 'payment',
      at: p.paidAt,
      title: `<strong>${fullName(s)}</strong> pagó ${fmtCLP(p.amount)}`,
      sub: p.period,
      icon: 'credit-card',
    });
  }
  const sorted = sortBy(events, (e) => e.at, 'desc').slice(0, 8);
  const root = $('#dashActivity');
  if (!root) return;
  if (!sorted.length) {
    root.innerHTML = `<div class="empty"><div class="empty__icon"><i data-lucide="activity"></i></div><div class="empty__title">Sin actividad reciente</div><div class="empty__text">Empieza registrando un alumno o una asistencia.</div></div>`;
    refreshIcons(root); return;
  }
  root.innerHTML = sorted.map((e) => `
    <div class="activity__item">
      <span class="activity__icon"><i data-lucide="${e.icon}"></i></span>
      <div class="activity__body">
        <div class="activity__title">${e.title}</div>
        <div class="activity__time">${e.sub} · ${relativeTime(e.at)}</div>
      </div>
    </div>
  `).join('');
  refreshIcons(root);
}

function renderPaymentsBreakdown() {
  const payments = listPayments();
  const overdue = payments.filter((p) => p.status === 'overdue');
  const pending = payments.filter((p) => p.status === 'pending');
  const paid = payments.filter((p) => p.status === 'paid');
  const sumOver = overdue.reduce((a, p) => a + p.amount, 0);
  const sumPen = pending.reduce((a, p) => a + p.amount, 0);
  const sumPaid = paid.reduce((a, p) => a + p.amount, 0);
  const total = sumOver + sumPen + sumPaid || 1;
  const root = $('#dashPaymentsBreakdown');
  if (!root) return;
  if (!payments.length) {
    root.innerHTML = `<div class="empty"><div class="empty__icon"><i data-lucide="credit-card"></i></div><div class="empty__title">Sin pagos registrados</div><div class="empty__text">Genera la primera mensualidad desde la ficha de un alumno.</div></div>`;
    refreshIcons(root); return;
  }
  root.innerHTML = `
    <div class="stack-4">
      <div class="stack-2">
        <div class="between"><span class="t-muted">Pagado</span><strong class="t-success">${fmtCLP(sumPaid)}</strong></div>
        <div class="progress progress--success"><div class="progress__bar" style="width:${(sumPaid/total*100).toFixed(1)}%"></div></div>
      </div>
      <div class="stack-2">
        <div class="between"><span class="t-muted">Pendiente</span><strong class="t-warning">${fmtCLP(sumPen)}</strong></div>
        <div class="progress"><div class="progress__bar" style="width:${(sumPen/total*100).toFixed(1)}%; background:linear-gradient(90deg, var(--c-warning), #f59e0b)"></div></div>
      </div>
      <div class="stack-2">
        <div class="between"><span class="t-muted">Vencido</span><strong class="t-danger">${fmtCLP(sumOver)}</strong></div>
        <div class="progress progress--danger"><div class="progress__bar" style="width:${(sumOver/total*100).toFixed(1)}%"></div></div>
      </div>
    </div>
  `;
}

function renderUpcoming() {
  const payments = listPayments().filter((p) => p.status === 'pending' || p.status === 'overdue');
  const sorted = sortBy(payments, (p) => p.dueDate).slice(0, 6);
  const root = $('#dashUpcoming');
  if (!root) return;
  if (!sorted.length) {
    root.innerHTML = `<div class="empty"><div class="empty__icon"><i data-lucide="check-circle-2"></i></div><div class="empty__title">Sin vencimientos pendientes</div><div class="empty__text">No hay mensualidades abiertas.</div></div>`;
    refreshIcons(root); return;
  }
  root.innerHTML = sorted.map((p) => {
    const s = listStudents().find((x) => x.id === p.studentId);
    return `
      <a href="#/students/${p.studentId}" class="activity__item" style="text-decoration:none;color:inherit">
        <span class="activity__icon" style="background:${p.status === 'overdue' ? 'var(--c-danger-bg)' : 'var(--c-warning-bg)'}; color:${p.status === 'overdue' ? 'var(--c-danger)' : 'var(--c-warning)'}"><i data-lucide="${p.status === 'overdue' ? 'alert-octagon' : 'clock'}"></i></span>
        <div class="activity__body">
          <div class="activity__title"><strong>${s ? fullName(s) : 'Alumno'}</strong> — ${fmtCLP(p.amount)}</div>
          <div class="activity__time">${p.period} · ${fmtDate(p.dueDate)}</div>
        </div>
      </a>
    `;
  }).join('');
  refreshIcons(root);
}

function buildAttendanceChart(periodKey = '6w') {
  const c = $('#dashAttendanceChart');
  if (!c || !window.Chart) return;
  const weeks = periodKey === '12w' ? 12 : 6;
  const labels = [];
  const data = [];
  const today = new Date();
  for (let i = weeks - 1; i >= 0; i--) {
    const monday = new Date(today);
    const day = monday.getDay();
    const diff = (day + 6) % 7;
    monday.setDate(monday.getDate() - diff - i * 7);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const count = (getState().attendances || []).filter((a) => {
      const d = fromISODate(a.dateISO);
      return d >= monday && d <= sunday;
    }).length;
    const monthLabel = MONTHS_ES_SHORT[monday.getMonth()];
    labels.push(`${monday.getDate()} ${monthLabel}`);
    data.push(count);
  }
  lineChart(c, labels, [{
    label: 'Asistencias',
    data,
    backgroundColor: 'rgba(244,198,98,0.18)',
    borderColor: '#f4c662',
    tension: 0.4,
    fill: true,
  }], {
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { display: false }, ticks: { color: '#94a3b8' } },
      y: {
        beginAtZero: true,
        ticks: { precision: 0, color: '#94a3b8' },
        grid: { color: 'rgba(148,163,184,0.08)' },
      },
    },
  });
}

function buildActiveStudentsChart() {
  const c = $('#dashActiveStudentsChart');
  if (!c || !window.Chart) return;
  const db = getState();
  const labels = [];
  const data = [];
  const today = new Date();
  for (let i = 5; i >= 0; i--) {
    const ref = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const next = new Date(today.getFullYear(), today.getMonth() - i + 1, 1);
    const total = (db.students || []).filter((s) => {
      const d = fromISODate(s.joinedAt);
      return d && d <= next;
    }).length;
    labels.push(MONTHS_ES_SHORT[ref.getMonth()]);
    data.push(total);
  }
  barChart(c, labels, [{
    label: 'Alumnos',
    data,
    backgroundColor: 'rgba(56,189,248,0.30)',
    borderColor: '#38bdf8',
    borderWidth: 2,
    borderRadius: { topLeft: 8, topRight: 8 },
    maxBarThickness: 36,
  }], {
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { display: false }, ticks: { color: '#94a3b8' } },
      y: { beginAtZero: true, ticks: { precision: 0, color: '#94a3b8' }, grid: { color: 'rgba(148,163,184,0.08)' } },
    },
  });
}

function buildRevenueChart() {
  const c = $('#dashRevenueChart');
  if (!c || !window.Chart) return;
  const labels = [];
  const data = [];
  const today = new Date();
  for (let i = 5; i >= 0; i--) {
    const ref = new Date(today.getFullYear(), today.getMonth() - i, 1);
    labels.push(MONTHS_ES_SHORT[ref.getMonth()]);
    let sum = 0;
    for (const p of (getState().payments || [])) {
      if (p.status !== 'paid' || !p.paidAt) continue;
      const d = new Date(p.paidAt);
      if (d.getMonth() === ref.getMonth() && d.getFullYear() === ref.getFullYear()) sum += Number(p.amount) || 0;
    }
    data.push(sum);
  }
  barChart(c, labels, [{
    label: 'Ingresos CLP',
    data,
    backgroundColor: 'rgba(52,211,153,0.30)',
    borderColor: '#34d399',
    borderWidth: 2,
    borderRadius: { topLeft: 8, topRight: 8 },
    maxBarThickness: 36,
  }], {
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { display: false }, ticks: { color: '#94a3b8' } },
      y: {
        beginAtZero: true,
        ticks: { color: '#94a3b8', callback: (v) => '$' + (v/1000) + 'k' },
        grid: { color: 'rgba(148,163,184,0.08)' },
      },
    },
  });
}

function buildLevelsChart() {
  const c = $('#dashLevelsChart');
  if (!c || !window.Chart) return;
  const db = getState();
  const labels = LEVELS.map((l) => l.name);
  const counts = LEVELS.map((l) => 0);
  for (const s of (db.students || [])) {
    const m = computeStudentMetrics(s, db.attendances, db.measurements, db.goals, db.closures);
    const lv = determineLevel(m);
    const idx = LEVELS.findIndex((l) => l.id === lv.id);
    if (idx >= 0) counts[idx]++;
  }
  doughnutChart(c, labels, counts, {
    plugins: { legend: { position: 'bottom', labels: { color: '#94a3b8' } } },
  });
}

/* ---------- Quick action: Register attendance ---------- */
function openAttendanceQuick() {
  // Delegado al formulario compartido (schema v2: preload + delta en vivo).
  import('./attendance-form.js').then((mod) =>
    mod.openAttendanceForm({ onSaved: () => renderDashboard() })
  );
}

/* ---------- Quick action: New measurement ---------- */
function openMeasurementQuick() {
  const db = getState();
  const form = el('div', { class: 'stack-4' });

  const sw = el('div', { class: 'field' });
  sw.appendChild(el('label', { class: 'field__label' }, 'Alumno'));
  const sel = el('select', { class: 'select', required: 'true' });
  sel.appendChild(el('option', { value: '' }, 'Selecciona un alumno…'));
  for (const s of db.students.filter((x) => x.status === 'active')) {
    sel.appendChild(el('option', { value: s.id }, fullName(s)));
  }
  sw.appendChild(sel);
  form.appendChild(sw);

  const dw = el('div', { class: 'field' });
  dw.appendChild(el('label', { class: 'field__label' }, 'Fecha'));
  const dateInput = el('input', { class: 'input', type: 'date', value: todayISO() });
  dw.appendChild(dateInput);
  form.appendChild(dw);

  form.appendChild(el('p', { class: 't-muted' }, 'Para un registro completo (peso, medidas, calorías) usa la ficha del alumno.'));

  openModal({
    title: 'Nueva medición rápida',
    size: 'sm',
    body: form,
    actions: [
      { label: 'Cancelar', kind: 'ghost' },
      {
        label: 'Continuar en la ficha', kind: 'primary',
        onClick: () => {
          if (!sel.value) {
            toast({ type: 'warning', message: 'Selecciona un alumno.' });
            return false;
          }
          location.hash = `#/students/${sel.value}/progress?addMeasurement=1&date=${dateInput.value}`;
        },
      },
    ],
  });
}
