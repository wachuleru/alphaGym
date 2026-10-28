/* ===========================================================
   ALPHA-FIT — Student detail (tabs)
   =========================================================== */

import { $, el, fmtDate, fmtCLP, fmtDateTime, fmtPct, todayISO, fromISODate, initials, fmtTime, relativeTime, debounce } from '../utils.js';
import { findStudent, fullName } from '../services/students.js';
import { listAttendances, deleteAttendance, attendancesWithEntries } from '../services/attendance.js';
import { listMeasurements, MEASURE_FIELDS, getMeasureLabel, getMeasureUnit, lastReading } from '../services/measurements.js';
import { computeIMC, classifyIMC, computeICE, classifyICE, computeICC, classifyICC, IMC_BANDS } from '../services/health.js';
import { forStudent as paymentsFor, forStudent as paymentsForStudent } from '../services/payments.js';
import { findTraining } from '../services/trainings.js';
import { findCategory } from '../services/categories.js';
import { weightDelta } from '../services/entries.js';
import { listClosures } from '../services/closures.js';
import { openAttendanceForm } from './attendance-form.js';
import { forStudent as goalsForStudent, createGoal, deleteGoal } from '../services/goals.js';
import { forStudent as notesForStudent, createNote, updateNote, deleteNote } from '../services/notes.js';
import {
  computeStudentMetrics, determineLevel, progressToNext, earnedBadges, allBadgesWithStatus,
} from '../services/levels.js';
import { LEVELS, MUSCLE_GROUP_BY_VALUE, NO_CATEGORY_LABEL } from '../config.js';
import { openModal, confirmDialog, toast, toastError } from '../components.js';
import { refreshIcons } from '../icons.js';
import { lineChart, barChart, doughnutChart, destroyChart, waitChart } from '../charts.js';

const escapeHtml = (s) => String(s || '').replace(/[<>&"']/g, (c) =>
  ({ '<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;' }[c]));

export async function renderStudentDetail(params) {
  const id = params.params.id;
  const tab = params.params.segments[2] || 'resumen';
  const student = findStudent(id);
  if (!student) {
    $('#main').innerHTML = `
      <div class="page-head"><div class="page-head__row">
        <div class="stack"><span class="crumbs"><a href="#/dashboard">Inicio</a><span><a href="#/students">Alumnos</a></span></span>
        <h1 class="page-head__title">Alumno no encontrado</h1></div></div></div>
      <div class="empty">
        <div class="empty__icon"><i data-lucide="user-x"></i></div>
        <div class="empty__title">No existe este alumno</div>
        <div class="empty__text">Es posible que la ficha haya sido eliminada o el enlace esté roto.</div>
        <div class="empty__actions"><a class="btn btn--primary" href="#/students">Volver al listado</a></div>
      </div>`;
    refreshIcons($('#main'));
    return;
  }

  const allAtt = listAttendances().filter((a) => a.studentId === student.id);
  const metrics = computeStudentMetrics(student, allAtt, [], [], listClosures());
  const level = determineLevel(metrics);

  const main = $('#main');
  main.innerHTML = `
    <div class="page-head">
      <div class="page-head__row">
        <div class="stack">
          <span class="crumbs">
            <a href="#/dashboard">Inicio</a>
            <span><a href="#/students">Alumnos</a></span>
            <span>${escapeHtml(fullName(student))}</span>
          </span>
        </div>
        <div class="page-head__actions">
          <button class="btn btn--secondary" id="sdPrintReport"><i data-lucide="printer"></i>Imprimir informe</button>
          <button class="btn btn--secondary" id="sdEditStudent"><i data-lucide="pencil"></i>Editar</button>
        </div>
      </div>
    </div>

    <section class="student-hero">
      <span class="avatar avatar--lg avatar--accent">${initials(fullName(student))}</span>
      <div class="student-hero__main">
        <h1 class="student-hero__name">${escapeHtml(fullName(student))}</h1>
        <div class="student-hero__sub">
          <span>Inscrito el <strong>${fmtDate(student.joinedAt)}</strong></span>
          <span>·</span>
          <span>${student.email || 'sin email'}</span>
          <span>·</span>
          <span>${student.phone || 'sin teléfono'}</span>
        </div>
        <div class="student-hero__chips">
          <span class="badge ${student.status === 'active' ? 'badge--success' : student.status === 'inactive' ? 'badge--muted' : 'badge--warning'}">${student.status === 'active' ? 'Activo' : student.status === 'inactive' ? 'Inactivo' : 'Suspendido'}</span>
          <span class="level-pill" style="--level-bg:${level.bg}; --level-fg:${level.fg}; --level-border:${level.border}">
            <span class="level-pill__dot"></span>${level.name}
          </span>
          ${student.mainGoal ? `<span class="badge"><i data-lucide="target"></i>${escapeHtml(student.mainGoal)}</span>` : ''}
          ${student.heightCm ? `<span class="badge badge--muted"><i data-lucide="ruler"></i>${student.heightCm} cm</span>` : ''}
          <span class="badge badge--muted">Frecuencia ${student.weeklyGoal || 2} /sem</span>
        </div>
      </div>
    </section>

    <div class="kpi-row">
      <div class="kpi">
        <span class="kpi__label">Asistencias del mes</span>
        <span class="kpi__value">${filterByMonth(listAttendances().filter((a) => a.studentId === student.id), new Date()).length}</span>
        <span class="kpi__sub">${metrics.totalAttendances} totales</span>
      </div>
      <div class="kpi kpi--success">
        <span class="kpi__label">Racha actual</span>
        <span class="kpi__value">${metrics.streakWeeks} sem</span>
        <span class="kpi__sub">cumpliendo meta semanal</span>
      </div>
      <div class="kpi kpi--accent">
        <span class="kpi__label">Total registradas</span>
        <span class="kpi__value">${metrics.totalAttendances}</span>
        <span class="kpi__sub">desde su primera visita</span>
      </div>
      ${(() => {
        const lw = lastReading(student.id, 'weightKg');
        return `<div class="kpi">
          <span class="kpi__label">Último peso</span>
          <span class="kpi__value">${lw ? lw.value + ' kg' : '—'}</span>
          <span class="kpi__sub">${lw ? fmtDate(lw.at) : 'sin registros'}</span>
        </div>`;
      })()}
    </div>

    <div class="tabs" id="sdTabs" role="tablist">
      <button class="tab ${tab === 'resumen' ? 'is-active' : ''}" data-tab="resumen" role="tab">Resumen</button>
      <button class="tab ${tab === 'attendance' ? 'is-active' : ''}" data-tab="attendance" role="tab">Asistencia <span class="tab__count">${metrics.totalAttendances}</span></button>
      <button class="tab ${tab === 'workouts' ? 'is-active' : ''}" data-tab="workouts" role="tab">Entrenamientos</button>
      <button class="tab ${tab === 'progress' ? 'is-active' : ''}" data-tab="progress" role="tab">Progreso físico</button>
      <button class="tab ${tab === 'goals' ? 'is-active' : ''}" data-tab="goals" role="tab">Objetivos</button>
      <button class="tab ${tab === 'payments' ? 'is-active' : ''}" data-tab="payments" role="tab">Pagos</button>
      <button class="tab ${tab === 'notes' ? 'is-active' : ''}" data-tab="notes" role="tab">Notas</button>
      <button class="tab ${tab === 'level' ? 'is-active' : ''}" data-tab="level" role="tab">Nivel y logros</button>
    </div>

    <div id="sdContent" class="stack-5" style="margin-top:var(--sp-5);"></div>
  `;

  $('#sdTabs').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-tab]');
    if (!btn) return;
    location.hash = `#/students/${id}/${btn.dataset.tab}`;
  });
  $('#sdEditStudent').addEventListener('click', () => location.hash = `#/students?edit=${id}`);
  $('#sdPrintReport').addEventListener('click', () => location.hash = `#/reports?student=${id}`);

  renderTabContent(student, tab, metrics);

  refreshIcons(main);
}

// Augment metrics with helpers used in this file
function monthThisMonth() {
  const today = new Date();
  return (this.attendancesThisMonth || []).length;
}

/* ---------- Tab renderer ---------- */

function renderTabContent(student, tab, metrics) {
  const root = $('#sdContent');
  if (!root) return;

  // Compute extra metrics data we need in tabs
  const own = listAttendances().filter((a) => a.studentId === student.id);
  Object.assign(metrics, { attendancesThisMonth: filterByMonth(own, new Date()) });

  if (tab === 'resumen') {
    root.innerHTML = `
      ${renderSummaryKPIs(student, metrics)}
      <section class="kpi-row kpi-row--2" style="grid-template-columns:1fr 1fr;gap:var(--sp-5)">
        <article class="card">
          <header class="card__header"><h3 class="card__title">Progreso al siguiente nivel</h3></header>
          <div class="card__body" id="sdProgressBlock"></div>
        </article>
        <article class="card">
          <header class="card__header"><h3 class="card__title">Próximos vencimientos</h3></header>
          <div class="card__body" id="sdNextPayments"></div>
        </article>
      </section>
    `;
    renderProgressBlock(student, metrics);
    renderNextPayments(student);
    refreshIcons(root);
    return;
  }

  if (tab === 'attendance') return renderAttendanceTab(root, student);
  if (tab === 'workouts')  return renderWorkoutsTab(root, student);
  if (tab === 'progress')  return renderProgressTab(root, student);
  if (tab === 'goals')     return renderGoalsTab(root, student);
  if (tab === 'payments')  return renderPaymentsTab(root, student);
  if (tab === 'notes')     return renderNotesTab(root, student);
  if (tab === 'level')     return renderLevelTab(root, student);
}

function renderSummaryKPIs(student, metrics) {
  const lastAtt = metrics.lastAttendanceISO ? fmtDate(metrics.lastAttendanceISO) : '—';
  const total = metrics.totalAttendances;
  const recent = (() => {
    const goal = student.weeklyGoal || 2;
    // Calendar weeks, not "weeks that happen to contain an attendance": an empty
    // week is exactly what the streak punishes, so it has to be visible here.
    return (metrics.recentWeeks || []).map((k) => {
      const label = fmtDate(k);
      if (metrics.exemptWeeks?.has(k)) {
        return `<div class="stat__delta stat__delta--flat" title="Semana del ${escapeHtml(label)}: justificada, no cuenta">libre</div>`;
      }
      const cnt = metrics.weekMap.get(k) || 0;
      const tone = cnt >= goal ? 'stat__delta--up' : 'stat__delta--down';
      return `<div class="stat__delta ${tone}" title="Semana del ${escapeHtml(label)}">${cnt}/${goal}</div>`;
    }).join('');
  })();

  const wl = lastReading(student.id, 'weightKg');
  const goal = (metrics.goals || [])[0] || null;
  const weightDelta = wl ? '' : '';

  return `
    <section class="kpi-row kpi-row--3">
      <div class="kpi">
        <span class="kpi__label">Asistencias este mes</span>
        <span class="kpi__value">${filterByMonth(listAttendances().filter((a) => a.studentId === student.id), new Date()).length}</span>
        <span class="kpi__sub">${total} totales</span>
      </div>
      <div class="kpi kpi--success">
        <span class="kpi__label">Última asistencia</span>
        <span class="kpi__value">${escapeHtml(lastAtt)}</span>
        <span class="kpi__sub">${metrics.firstAttendanceISO ? 'Ingresó el ' + fmtDate(metrics.firstAttendanceISO) : 'sin registros'}</span>
      </div>
      <div class="kpi kpi--accent">
        <span class="kpi__label">Cumplimiento semanal (12 sem)</span>
        <span class="kpi__value">${fmtPct(metrics.weeklyCompliance * 100)}</span>
        <span class="kpi__sub">${metrics.streakWeeks} semana(s) consecutivas</span>
      </div>
    </section>
  `;
}

function renderProgressBlock(student, metrics) {
  const root = $('#sdProgressBlock');
  if (!root) return;
  const nextIdx = LEVELS.findIndex((l) => l.id === determineLevel(metrics).id) + 1;
  const progress = progressToNext(metrics);
  if (nextIdx >= LEVELS.length) {
    root.innerHTML = `
      <div class="stack-3">
        <div class="level-pill" style="--level-bg:${determineLevel(metrics).bg}; --level-fg:${determineLevel(metrics).fg}; --level-border:${determineLevel(metrics).border}">
          <span class="level-pill__dot"></span>${determineLevel(metrics).name}
        </div>
        <p class="t-muted">Ha alcanzado el nivel máximo disponible.</p>
      </div>`;
    return;
  }
  const next = LEVELS[nextIdx];
  const lv = determineLevel(metrics);
  root.innerHTML = `
    <div class="stack-3">
      <div class="between">
        <div class="cell-name">
          <div class="stack">
            <span class="cell-name__main">${lv.name}</span>
            <span class="cell-name__sub">Nivel actual</span>
          </div>
        </div>
        <div class="text-right">
          <span class="cell-name__main h-display" style="color:${next.fg}">${next.name}</span><br>
          <span class="cell-name__sub">Próximo nivel · ${Math.round(progress * 100)}%</span>
        </div>
      </div>
      <div class="progress"><div class="progress__bar" style="width:${(progress * 100).toFixed(1)}%"></div></div>
      <div class="stack-2 t-muted" style="font-size:var(--fs-xs)">
        <div>Asistencias: <strong>${metrics.totalAttendances}</strong> / ${next.totalAttendances}</div>
        <div>Racha: <strong>${metrics.streakWeeks}</strong> / ${next.streakWeeks} semana(s) consecutivas</div>
        <div>Cumplimiento: <strong>${fmtPct(metrics.weeklyCompliance * 100)}</strong> / ${fmtPct(next.weeklyCompliance * 100)}</div>
      </div>
    </div>
  `;
}

function renderNextPayments(student) {
  const root = $('#sdNextPayments');
  if (!root) return;
  const list = paymentsFor(student.id).slice(0, 4);
  if (!list.length) {
    root.innerHTML = `<div class="empty"><div class="empty__icon"><i data-lucide="credit-card"></i></div><div class="empty__title">Sin pagos registrados</div><div class="empty__text">Genera una mensualidad desde esta sección.</div></div>`;
    refreshIcons(root);
    return;
  }
  root.innerHTML = `
    <div class="stack-2">
      ${list.map((p) => `
        <div class="activity__item">
          <span class="activity__icon" style="background:${p.status === 'paid' ? 'var(--c-success-bg)' : p.status === 'overdue' ? 'var(--c-danger-bg)' : 'var(--c-warning-bg)'}; color:${p.status === 'paid' ? 'var(--c-success)' : p.status === 'overdue' ? 'var(--c-danger)' : 'var(--c-warning)'}">
            <i data-lucide="${p.status === 'paid' ? 'check' : p.status === 'overdue' ? 'alert-octagon' : 'clock'}"></i>
          </span>
          <div class="activity__body">
            <div class="activity__title"><strong>${escapeHtml(p.period)}</strong> — ${fmtCLP(p.amount)}</div>
            <div class="activity__time">${fmtDate(p.dueDate)} · ${p.status === 'paid' ? 'pagado' : p.status === 'pending' ? 'pendiente' : 'vencido'}</div>
          </div>
        </div>`).join('')}
    </div>
  `;
  refreshIcons(root);
}

function filterByMonth(list, refDate) {
  const y = refDate.getFullYear();
  const m = refDate.getMonth();
  return list.filter((a) => {
    const d = fromISODate(a.dateISO || a.date);
    return d && d.getFullYear() === y && d.getMonth() === m;
  });
}

/* ---------- Tab: Attendance ---------- */
function renderAttendanceTab(root, student) {
  const att = listAttendances().filter((a) => a.studentId === student.id)
    .slice()
    .sort((a, b) => (a.dateISO < b.dateISO ? 1 : -1));

  root.innerHTML = `
    <section style="display:grid; grid-template-columns: 1.5fr 1fr; gap:var(--sp-5)" class="grid-2col">
      <article class="card">
        <header class="card__header">
          <div class="stack"><h3 class="card__title">Historial reciente</h3><p class="card__subtitle">Últimas sesiones registradas</p></div>
          <div class="card__actions">
            <button class="btn btn--primary btn--sm" id="sdRegisterAtt"><i data-lucide="plus"></i>Nueva asistencia</button>
          </div>
        </header>
        <div class="card__body" style="padding:0">
          ${att.length === 0
            ? `<div class="empty"><div class="empty__icon"><i data-lucide="calendar-x"></i></div><div class="empty__title">Sin asistencias registradas</div><div class="empty__text">Utiliza el botón superior para registrar la primera.</div></div>`
            : `<div class="table-wrap" style="border:none;border-radius:0">
                <table class="table">
                  <thead><tr><th>Fecha</th><th>Hora</th><th>Tipo</th><th>Notas</th><th></th></tr></thead>
                  <tbody>
                    ${att.slice(0, 50).map((a) => `
                      <tr>
                        <td class="t-mono">${fmtDate(a.dateISO)}</td>
                        <td class="t-mono">${fmtTime(a.timeISO || (a.dateISO + 'T00:00:00Z'))}</td>
                        <td><span class="badge">${escapeHtml(a.type || 'regular')}</span></td>
                        <td class="t-muted">${escapeHtml(a.notes || '—')}</td>
                        <td class="row-actions">
                          <button class="icon-btn" data-act="delete" data-id="${a.id}" title="Eliminar"><i data-lucide="trash-2"></i></button>
                        </td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>`}
        </div>
      </article>

      <article class="card">
        <header class="card__header"><h3 class="card__title">Resumen de constancia</h3></header>
        <div class="card__body" id="sdAttKPIs"></div>
        <div class="card__footer">
          <a class="btn btn--ghost btn--sm" href="#/attendance">Ver asistencia global</a>
        </div>
      </article>
    </section>
    <style>.grid-2col{grid-template-columns: 1.5fr 1fr;} @media (max-width: 960px){.grid-2col{grid-template-columns:1fr;}}</style>
  `;

  // KPIs
  const allAtt = att;
  const total = allAtt.length;
  const monthList = filterByMonth(allAtt, new Date());
  const weekList = (() => {
    const today = new Date();
    const monday = new Date(today);
    const diff = (monday.getDay() + 6) % 7;
    monday.setDate(monday.getDate() - diff);
    return allAtt.filter((a) => fromISODate(a.dateISO) >= monday);
  })();
  const streak = (() => {
    const m = computeStudentMetrics(student, allAtt, [], [], listClosures());
    return m.streakWeeks;
  })();
  const compliance = fmtPct(computeStudentMetrics(student, allAtt, [], [], listClosures()).weeklyCompliance);

  $('#sdAttKPIs').innerHTML = `
    <div class="stack-4">
      <div class="kpi">
        <span class="kpi__label">Sesiones este mes</span>
        <span class="kpi__value">${monthList.length}</span>
        <span class="kpi__sub">${monthList.filter((m) => {
          const weekday = fromISODate(m.dateISO).getDay();
          return weekday !== 0 && weekday !== 6;
        }).length} entre semana</span>
      </div>
      <div class="kpi">
        <span class="kpi__label">Esta semana</span>
        <span class="kpi__value">${weekList.length}</span>
        <span class="kpi__sub">de ${student.weeklyGoal || 2} objetivo</span>
      </div>
      <div class="kpi">
        <span class="kpi__label">Racha actual</span>
        <span class="kpi__value">${streak} sem</span>
        <span class="kpi__sub">cumpliendo meta</span>
      </div>
      <div class="kpi">
        <span class="kpi__label">Cumplimiento 12 semanas</span>
        <span class="kpi__value">${compliance}</span>
        <span class="kpi__sub">incluye semanas futuras como no vencidas</span>
      </div>
    </div>
  `;

  // Bind delete
  $('#sdContent').addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-act="delete"]');
    if (!btn) return;
    const id = btn.dataset.id;
    const ok = await confirmDialog({
      title: 'Eliminar asistencia',
      message: '¿Eliminar esta asistencia? No se puede deshacer.',
      confirmLabel: 'Eliminar',
    });
    if (!ok) return;
    const mod = await import('../services/attendance.js');
    mod.deleteAttendance(id);
    toast({ type: 'success', message: 'Asistencia eliminada.' });
    renderAttendanceTab($('#sdContent'), student);
  });

  $('#sdRegisterAtt')?.addEventListener('click', async () => {
    openAttendanceForm({ studentId: student.id, onSaved: () => {
      renderAttendanceTab($('#sdContent'), student);
      // If the user is also browsing Workouts tab, refresh it.
      const t = $('.tab.is-active')?.dataset.tab;
      if (t === 'workouts') renderWorkoutsTab($('#sdContent'), student);
    }});
  });

  refreshIcons(root);
}

/* ---------- Tab: Workouts ---------- */
function renderWorkoutsTab(root, student) {
  const sessions = listForStudentWithEntries(student.id);

  if (!sessions.length) {
    root.innerHTML = `
      <article class="card">
        <header class="card__header">
          <div class="stack">
            <h3 class="card__title">Historial de entrenamientos</h3>
            <p class="card__subtitle">Sesiones registradas con peso, series y reps.</p>
          </div>
          <div class="card__actions">
            <button class="btn btn--primary btn--sm" id="sdNewAtt"><i data-lucide="plus"></i>Nueva asistencia</button>
          </div>
        </header>
        <div class="card__body">
          <div class="empty">
            <div class="empty__icon"><i data-lucide="dumbbell"></i></div>
            <div class="empty__title">Sin entrenamientos registrados</div>
            <div class="empty__text">Registra la primera asistencia con sus ejercicios y pesos.</div>
            <div class="empty__actions"><button class="btn btn--primary" id="sdNewAttEmpty"><i data-lucide="plus"></i>Nueva asistencia</button></div>
          </div>
        </div>
      </article>`;
    bindWorkoutsTab(root, student);
    refreshIcons(root);
    return;
  }

  root.innerHTML = `
    <section style="display:flex; flex-direction:column; gap:var(--sp-5)">
      <article class="card">
        <header class="card__header">
          <div class="stack">
            <h3 class="card__title">Historial de entrenamientos</h3>
            <p class="card__subtitle">${sessions.length} sesión(es) · ${countDistinctExercises(sessions)} ejercicio(s) distinto(s) · última ${fmtDate(sessions[0].dateISO)}</p>
          </div>
          <div class="card__actions">
            <button class="btn btn--primary btn--sm" id="sdNewAtt"><i data-lucide="plus"></i>Nueva asistencia</button>
          </div>
        </header>
        <div class="card__body" style="padding:0">
          <div class="stack-2" style="padding:var(--sp-3)">
            ${sessions.slice(0, 30).map((s) => attendanceCard(s)).join('')}
          </div>
        </div>
      </article>
    </section>
  `;
  bindWorkoutsTab(root, student);
  refreshIcons(root);
}

function listForStudentWithEntries(studentId) {
  return attendancesWithEntries(studentId);
}

function countDistinctExercises(sessions) {
  const ids = new Set();
  for (const s of sessions) for (const e of (s.entries || [])) if (e.exerciseId) ids.add(e.exerciseId);
  return ids.size;
}

function attendanceCard(attendance) {
  const training = attendance.trainingId ? findTraining(attendance.trainingId) : null;
  // Three different reasons to have no name here — don't collapse them.
  const title = training
    ? training.name
    : attendance.trainingId ? 'Entrenamiento eliminado' : 'Sesión libre';
  const obsTitle = training && training.observation ? training.observation : (attendance.notes || '');

  // Build prior index for this attendance so we can compute deltas in the card.
  const all = listAttendances();
  const priorMap = new Map();
  const scoped = all
    .filter((a) => a.studentId === attendance.studentId
      && a.id !== attendance.id
      && a.dateISO < attendance.dateISO
      && Array.isArray(a.entries))
    .sort((a, b) => `${b.dateISO}${b.timeISO || ''}`.localeCompare(`${a.dateISO}${a.timeISO || ''}`));
  for (const a of scoped) {
    for (const e of a.entries) {
      if (e.exerciseId && !priorMap.has(e.exerciseId)) priorMap.set(e.exerciseId, e);
    }
  }

  const rows = (attendance.entries || []).map((e) => {
    const prev = priorMap.get(e.exerciseId);
    const d = weightDelta(e.weightKg, prev?.weightKg ?? null);
    const groups = (e.muscleGroups || [])
      .map((g) => (MUSCLE_GROUP_BY_VALUE[g] || { label: g }).label)
      .map(escapeHtml).join(' · ');
    const wt = typeof e.weightKg === 'number' ? `${e.weightKg} kg` : '—';
    return `
      <div class="exercise-row">
        <div class="exercise-row__name">
          ${escapeHtml(e.name || 'Ejercicio')}
          ${e.extra ? '<span class="badge badge--warning" style="margin-left:6px"><i data-lucide="plus"></i>Añadido</span>' : ''}
          <small>${groups || '—'}</small>
        </div>
        <div class="t-mono">${escapeHtml(String(e.sets || '—'))} × ${escapeHtml(String(e.reps || '—'))}</div>
        <div class="t-mono">${wt}</div>
        <div class="weight-delta" style="color:${d.tone === 'up' ? 'var(--c-success)' : d.tone === 'down' ? 'var(--c-danger)' : 'var(--c-text-muted)'}">${escapeHtml(d.text)}</div>
      </div>`;
  }).join('');

  const cat = training?.categoryId ? findCategory(training.categoryId) : null;

  return `
    <article class="routine-card">
      <header class="routine-card__head">
        <div class="cell-name">
          <div class="stack">
            <span class="routine-card__title">${escapeHtml(title)} · ${fmtDate(attendance.dateISO)} ${fmtTime(attendance.timeISO)}</span>
            <span class="routine-card__sub">${attendance.entries.length} ejercicio(s) · ${escapeHtml(obsTitle || training?.objective || '—')}</span>
            ${training ? `<div class="row gap-2" style="flex-wrap:wrap;margin-top:6px">
              ${cat
                ? `<span class="badge badge--${escapeHtml(cat.color)}"><i data-lucide="folder"></i>${escapeHtml(cat.name)}</span>`
                : `<span class="badge badge--muted">${escapeHtml(NO_CATEGORY_LABEL)}</span>`}
              ${training.objective ? `<span class="badge badge--info">${escapeHtml(training.objective)}</span>` : ''}
            </div>` : ''}
          </div>
        </div>
        <div class="row gap-2">
          <button class="btn btn--ghost btn--sm" data-act="editAtt" data-id="${attendance.id}"><i data-lucide="pencil"></i>Editar</button>
          <button class="btn btn--danger btn--sm" data-act="delAtt" data-id="${attendance.id}"><i data-lucide="trash-2"></i></button>
        </div>
      </header>
      <div class="exercise-list">${rows}</div>
    </article>`;
}

function bindWorkoutsTab(root, student) {
  const rerender = () => renderWorkoutsTab($('#sdContent'), student);
  const openNew = () => openAttendanceForm({ studentId: student.id, onSaved: rerender });
  $('#sdNewAtt')?.addEventListener('click', openNew);
  $('#sdNewAttEmpty')?.addEventListener('click', openNew);

  // `root` survives re-renders (only its innerHTML is replaced), and saving a
  // session re-runs this binder — so drop the previous handler or every save
  // would add one more and "Editar" would open N stacked modals.
  if (root.__gtWorkoutsClick) root.removeEventListener('click', root.__gtWorkoutsClick);
  root.__gtWorkoutsClick = async (e) => {
    const editBtn = e.target.closest('button[data-act="editAtt"]');
    const delBtn = e.target.closest('button[data-act="delAtt"]');
    if (editBtn) {
      const att = listAttendances().find((a) => a.id === editBtn.dataset.id);
      if (att) openAttendanceForm({ studentId: att.studentId, existing: att, onSaved: rerender });
    }
    if (delBtn) {
      const id = delBtn.dataset.id;
      const ok = await confirmDialog({ title: 'Eliminar asistencia', message: '¿Eliminar esta asistencia con sus ejercicios? No se puede deshacer.', confirmLabel: 'Eliminar', confirmKind: 'danger' });
      if (!ok) return;
      deleteAttendance(id);
      toast({ type: 'success', message: 'Asistencia eliminada.' });
      rerender();
    }
  };
  root.addEventListener('click', root.__gtWorkoutsClick);
}

/* ---------- Tab: Progress ---------- */
function renderProgressTab(root, student) {
  const meas = listMeasurements().filter((m) => m.studentId === student.id)
    .slice().sort((a, b) => (a.date < b.date ? -1 : 1));

  const usedKeys = MEASURE_FIELDS.filter((f) => meas.some((m) => m[f.key] != null && m[f.key] !== '')).map((f) => f.key);
  const selectedKey = usedKeys[0] || 'weightKg';

  root.innerHTML = `
    <section style="display:flex; flex-direction:column; gap:var(--sp-5)">
      <article class="card">
        <header class="card__header">
          <div class="stack"><h3 class="card__title">Progreso físico</h3><p class="card__subtitle">Gráficos históricos por medición</p></div>
          <div class="card__actions">
            <select class="select input--inline" id="sdProgressMetric">
              ${MEASURE_FIELDS.filter((f) => meas.some((m) => m[f.key] != null && m[f.key] !== '')).map((f) => `<option value="${f.key}">${escapeHtml(f.label)} (${f.unit})</option>`).join('')}
            </select>
            <button class="btn btn--primary btn--sm" id="sdAddMeasurement"><i data-lucide="plus"></i>Nueva medición</button>
          </div>
        </header>
        <div class="card__body" style="height:300px"><div class="chart-canvas-wrap"><canvas id="sdProgressChart"></canvas></div></div>
        <div class="card__footer" id="sdProgressFooter">
          <span class="t-muted">${meas.length} medición(es) registrada(s)</span>
        </div>
      </article>

      <article class="card">
        <header class="card__header"><h3 class="card__title">Últimos valores</h3></header>
        <div class="card__body">
          ${meas.length === 0
            ? `<div class="empty"><div class="empty__icon"><i data-lucide="ruler"></i></div><div class="empty__title">Sin mediciones registradas</div><div class="empty__text">Agrega la primera con el botón superior.</div></div>`
            : (() => {
                const last = meas[meas.length - 1];
                const baselineHeight = student.heightCm;
                const imc  = computeIMC(last.weightKg, baselineHeight);
                const imcC = classifyIMC(imc);
                const ice  = computeICE(last.waistCm, baselineHeight);
                const iceC = classifyICE(ice);
                const icc  = computeICC(last.waistCm, last.hipCm);
                const iccC = classifyICC(icc, student.sex);
                const indexCards = [
                  { code: 'IMC', name: 'Índice de Masa Corporal', value: imcC, unit: 'kg/m²', note: 'OMS' },
                  { code: 'ICE', name: 'Índice Cintura-Estatura', value: iceC, unit: '',      note: 'Riesgo cardiovascular' },
                  { code: 'ICC', name: 'Índice Cintura-Cadera',   value: iccC, unit: '',      note: student.sex ? `Umbrales ${student.sex === 'F' ? 'mujer' : 'varón'}` : 'Define sexo del alumno' },
                ];
                return `
                  <div class="measure-list">${indexCards.map((c) => `
                    <div class="measure-item measure-item--index">
                      <div class="measure-item__label"><strong>${escapeHtml(c.code)}</strong> <span class="t-muted" style="font-weight:400">· ${escapeHtml(c.name)}</span></div>
                      <div class="measure-item__value">${c.value ? c.value[c.code.toLowerCase()] : '—'}${c.unit ? ' <span class="t-muted">' + c.unit + '</span>' : ''}</div>
                      <div class="measure-item__delta" style="color:${c.value?.color || 'var(--c-text-muted)'}">${c.value ? escapeHtml(c.value.label) : 'Faltan datos'}</div>
                      <div class="t-muted" style="font-size:var(--fs-xs); margin-top:2px">${escapeHtml(c.note)}${c.value?.risk ? ' · ' + escapeHtml(c.value.risk) : ''}</div>
                    </div>
                  `).join('')}</div>
                  <h4 class="t-muted" style="font-size:var(--fs-sm); margin: var(--sp-4) 0 var(--sp-2); text-transform:uppercase; letter-spacing:.04em">Medidas</h4>
                  <div class="measure-list">${MEASURE_FIELDS.filter((f) => last[f.key] != null && last[f.key] !== '').map((f) => {
                    const prev = meas.slice(0, -1).filter((m) => m[f.key] != null && m[f.key] !== '').slice(-1)[0];
                    const delta = prev ? (Number(last[f.key]) - Number(prev[f.key])) : 0;
                    const color = delta > 0 ? 't-success' : delta < 0 ? 't-danger' : 't-muted';
                    return `<div class="measure-item">
                      <div class="measure-item__label">${escapeHtml(f.label)}</div>
                      <div class="measure-item__value">${last[f.key]} <span class="t-muted">${f.unit}</span></div>
                      <div class="measure-item__delta ${color}">${prev ? (delta > 0 ? '+' : '−') + Math.abs(delta).toLocaleString('es-CL', { maximumFractionDigits: 2 }) + ' vs anterior' : '— primera lectura'}</div>
                    </div>`;
                  }).join('')}</div>
                `;
              })()}
        </div>
      </article>

      <article class="card">
        <header class="card__header"><h3 class="card__title">Historial completo</h3></header>
        <div class="card__body" style="padding:0">
          ${meas.length === 0 ? '<div class="empty"><div class="empty__icon"><i data-lucide="calendar"></i></div><div class="empty__title">Sin historial</div></div>' : `
            <div class="table-wrap" style="border:none;border-radius:0">
              <table class="table">
                <thead><tr>
                  <th>Fecha</th>
                  ${MEASURE_FIELDS.filter((f) => meas.some((m) => m[f.key] != null && m[f.key] !== '')).map((f) => `<th class="num">${escapeHtml(f.label)} (${f.unit})</th>`).join('')}
                </tr></thead>
                <tbody>
                  ${meas.slice().reverse().map((m) => `
                    <tr>
                      <td class="t-mono">${fmtDate(m.date)}</td>
                      ${MEASURE_FIELDS.filter((f) => meas.some((mm) => mm[f.key] != null && mm[f.key] !== '')).map((f) => `<td class="num">${m[f.key] != null && m[f.key] !== '' ? m[f.key] : '<span class="t-subtle">—</span>'}</td>`).join('')}
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          `}
        </div>
      </article>
    </section>
  `;

  // Default chart render
  const metricSelector = $('#sdProgressMetric');
  if (metricSelector) metricSelector.value = selectedKey;
  metricSelector?.addEventListener('change', () => drawProgressChart(student, metricSelector.value));
  $('#sdAddMeasurement')?.addEventListener('click', () => openMeasurementForm(student, () => renderProgressTab($('#sdContent'), student)));

  // Draw chart after Chart.js is ready
  waitChart(() => drawProgressChart(student, metricSelector.value));
  refreshIcons(root);
}

function waitForChart_deprecated() { /* moved to charts.js */ }
void waitForChart_deprecated;

function drawProgressChart(student, metricKey) {
  const c = $('#sdProgressChart');
  if (!c || !window.Chart) return;
  const meas = listMeasurements().filter((m) => m.dateISO || m.date)
    .slice().sort((a, b) => (a.date < b.date ? -1 : 1));
  const pts = meas
    .map((m) => ({ x: m.date, y: Number(m[metricKey]) }))
    .filter((p) => Number.isFinite(p.y));

  destroyChart(c);

  if (pts.length === 0) {
    // Empty state handled by parent view already; bail out.
    return;
  }

  const f = MEASURE_FIELDS.find((mf) => mf.key === metricKey);
  const labels = pts.map((p) => fmtDate(p.x, 'short'));

  // IMC background bands: only when charting weight AND the student has height on file
  const baselineHeight = Number(student.heightCm) || null;
  const showBands = metricKey === 'weightKg' && baselineHeight && baselineHeight > 0;
  const heightM = showBands ? baselineHeight / 100 : null;
  const bandRanges = showBands ? IMC_BANDS.map((b) => ({
    ...b,
    pesoMin: b.min * heightM * heightM,
    pesoMax: b.max === Infinity ? b.min * heightM * heightM * 2 : b.max * heightM * heightM,
  })) : [];

  // Y-axis range: data-driven (ignore the sentinel "min: 0" of the under band)
  let yMin = null, yMax = null;
  if (showBands) {
    const dataMin = Math.min(...pts.map((p) => p.y));
    const dataMax = Math.max(...pts.map((p) => p.y));
    const underTopKg = IMC_BANDS[0].max * heightM * heightM; // 18.5 * h²
    // yMin: just below the lowest data point, never lower than 18.5*h² (so the "under" band has a meaningful top)
    yMin = Math.min(dataMin, underTopKg) * 0.95;
    // yMax: high enough to show the top of the highest finite band (Obesidad III starts at 40*h²)
    const topBand = IMC_BANDS[IMC_BANDS.length - 1];
    const obesityIiiTopKg = topBand.min * heightM * heightM; // 40*h²
    yMax = Math.max(dataMax, obesityIiiTopKg) * 1.05;
  }

  const bandPlugin = showBands ? {
    id: 'imcBands',
    beforeDatasetsDraw(chart) {
      const { ctx, chartArea, scales } = chart;
      if (!scales.y) return;
      ctx.save();
      for (const band of bandRanges) {
        // y-axis convention: lower values are at the BOTTOM (higher pixel y)
        const top    = Math.max(scales.y.getPixelForValue(band.pesoMax), chartArea.top);
        const bottom = Math.min(scales.y.getPixelForValue(band.pesoMin), chartArea.bottom);
        if (bottom <= top) continue;
        ctx.fillStyle = hexToRgba(band.color, 0.18);
        ctx.fillRect(chartArea.left, top, chartArea.right - chartArea.left, bottom - top);
        if (bottom - top > 16) {
          ctx.fillStyle = hexToRgba(band.color, 0.85);
          ctx.font = '600 10px Inter, system-ui, sans-serif';
          ctx.textAlign = 'right';
          ctx.textBaseline = 'middle';
          ctx.fillText(band.label, chartArea.right - 4, (top + bottom) / 2);
        }
      }
      ctx.restore();
    },
  } : null;

  const chartOptions = {
    plugins: {
      legend: { display: false },
      tooltip: { mode: 'index', intersect: false },
    },
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

  lineChart(c, labels, [{
    label: `${f.label} (${f.unit})`,
    data: pts.map((p) => p.y),
    borderColor: '#f4c662',
    backgroundColor: 'rgba(244,198,98,0.15)',
    fill: true,
    tension: 0.35,
    pointRadius: 4,
  }], { ...chartOptions, inlinePlugins });

  // Footer info
  const foot = $('#sdProgressFooter');
  const last = pts[pts.length - 1]?.y;
  const first = pts[0]?.y;
  if (foot && last != null && first != null) {
    const delta = last - first;
    const sign = delta > 0 ? '+' : delta < 0 ? '−' : '';
    foot.innerHTML = `
      <span class="t-muted">${pts.length} lectura(s) · primera: <strong>${first} ${f.unit}</strong> · última: <strong>${last} ${f.unit}</strong> · cambio: <strong class="${delta > 0 ? 't-success' : delta < 0 ? 't-danger' : 't-muted'}">${sign}${Math.abs(delta).toLocaleString('es-CL', { maximumFractionDigits: 2 })} ${f.unit}</strong></span>
    `;
  }
}

function openMeasurementForm(student, onSaved) {
  const dialog = el('div');
  dialog.innerHTML = `
    <form class="form-grid" id="meaForm">
      <div class="field col-4">
        <label class="field__label">Fecha *</label>
        <input class="input" type="date" id="meaDate" value="${todayISO()}" required />
      </div>
      ${MEASURE_FIELDS.map((f) => `
        <div class="field col-3">
          <label class="field__label">${escapeHtml(f.label)} (${f.unit})</label>
          <input class="input" type="number" step="0.1" id="mea_${f.key}" />
        </div>
      `).join('')}
      <div class="field col-12">
        <label class="field__label">Notas</label>
        <textarea class="textarea" id="meaNotes" rows="2"></textarea>
      </div>
    </form>
  `;
  openModal({
    title: 'Nueva medición',
    size: 'lg',
    body: dialog,
    actions: [
      { label: 'Cancelar', kind: 'ghost' },
      {
        label: 'Guardar', kind: 'primary',
        onClick: () => {
          const data = { studentId: student.id, date: dialog.querySelector('#meaDate').value };
          for (const f of MEASURE_FIELDS) {
            const v = dialog.querySelector(`#mea_${f.key}`).value;
            if (v !== '') data[f.key] = Number(v);
          }
          data.notes = dialog.querySelector('#meaNotes').value;
          const m = (window.__gt && window.__gt.measurements) || null;
          import('../services/measurements.js').then((mod) => {
            mod.createMeasurement(data);
            toast({ type: 'success', message: 'Medición guardada.' });
            onSaved && onSaved();
          });
        },
      },
    ],
  });
  refreshIcons(dialog);
}

/* ---------- Tab: Goals ---------- */
function renderGoalsTab(root, student) {
  const goals = goalsForStudent(student.id);
  root.innerHTML = `
    <section style="display:flex; flex-direction:column; gap:var(--sp-5)">
      <article class="card">
        <header class="card__header">
          <div class="stack"><h3 class="card__title">Objetivos</h3><p class="card__subtitle">Configura metas individuales</p></div>
          <div class="card__actions">
            <button class="btn btn--primary btn--sm" id="sdNewGoal"><i data-lucide="plus"></i>Nuevo objetivo</button>
          </div>
        </header>
        <div class="card__body">
          ${goals.length === 0
            ? `<div class="empty"><div class="empty__icon"><i data-lucide="target"></i></div><div class="empty__title">Sin objetivos definidos</div><div class="empty__text">Los objetivos personales ayudan a mantener la motivación.</div></div>`
            : `<div class="stack-3">${goals.map((g) => `
                <div class="routine-card">
                  <div class="routine-card__head">
                    <div class="stack">
                      <span class="routine-card__title">${escapeHtml(g.title)}</span>
                      <span class="routine-card__sub">${escapeHtml(g.description || '')}</span>
                    </div>
                    <span class="badge ${g.status === 'active' ? 'badge--accent' : g.status === 'achieved' ? 'badge--success' : 'badge--muted'}">${g.status === 'active' ? 'En curso' : g.status === 'achieved' ? 'Logrado' : g.status === 'abandoned' ? 'Descartado' : 'Activo'}</span>
                  </div>
                  <div class="row gap-4" style="color:var(--c-text-muted); font-size:var(--fs-sm); flex-wrap:wrap">
                    ${g.targetValue != null ? `<span>Meta: <strong style="color:var(--c-text)">${g.targetValue} ${g.unit}</strong></span>` : ''}
                    ${g.targetDate ? `<span>Fecha objetivo: <strong style="color:var(--c-text)">${fmtDate(g.targetDate)}</strong></span>` : ''}
                  </div>
                  <div class="row gap-2">
                    <button class="btn btn--ghost btn--sm" data-act="editGoal" data-id="${g.id}"><i data-lucide="pencil"></i>Editar</button>
                    <button class="btn btn--danger btn--sm" data-act="delGoal" data-id="${g.id}"><i data-lucide="trash-2"></i>Eliminar</button>
                  </div>
                </div>
              `).join('')}</div>`
          }
        </div>
      </article>
    </section>
  `;

  $('#sdNewGoal')?.addEventListener('click', () => openGoalForm(student, null, () => renderGoalsTab($('#sdContent'), student)));
  root.addEventListener('click', async (e) => {
    const edit = e.target.closest('button[data-act="editGoal"]');
    const del = e.target.closest('button[data-act="delGoal"]');
    if (edit) {
      const id = edit.dataset.id;
      const g = goals.find((x) => x.id === id);
      openGoalForm(student, g, () => renderGoalsTab($('#sdContent'), student));
    }
    if (del) {
      const ok = await confirmDialog({ title: 'Eliminar objetivo', message: '¿Eliminar este objetivo?' });
      if (!ok) return;
      deleteGoal(del.dataset.id);
      toast({ type: 'success', message: 'Objetivo eliminado.' });
      renderGoalsTab($('#sdContent'), student);
    }
  });

  refreshIcons(root);
}

function openGoalForm(student, existing, onSaved) {
  const g = existing || {};
  const dialog = el('div');
  dialog.innerHTML = `
    <div class="form-grid">
      <div class="field col-8"><label class="field__label">Título *</label><input class="input" id="goalTitle" value="${escapeHtml(g.title || '')}" /></div>
      <div class="field col-4">
        <label class="field__label">Tipo</label>
        <select class="select" id="goalType">
          <option value="weight" ${g.type === 'weight' ? 'selected' : ''}>Peso</option>
          <option value="measurement" ${g.type === 'measurement' ? 'selected' : ''}>Medición</option>
          <option value="attendance" ${g.type === 'attendance' ? 'selected' : ''}>Asistencia</option>
          <option value="custom" ${g.type === 'custom' ? 'selected' : ''}>Personalizado</option>
        </select>
      </div>
      <div class="field col-12"><label class="field__label">Descripción</label><input class="input" id="goalDesc" value="${escapeHtml(g.description || '')}" /></div>
      <div class="field col-4"><label class="field__label">Valor meta</label><input class="input" type="number" step="0.1" id="goalValue" value="${g.targetValue != null ? g.targetValue : ''}" /></div>
      <div class="field col-4">
        <label class="field__label">Unidad</label>
        <select class="select" id="goalUnit">
          ${['kg','cm','%','sesiones/sem','índice','otro'].map((u) => `<option value="${u}" ${g.unit === u ? 'selected' : ''}>${u}</option>`).join('')}
        </select>
      </div>
      <div class="field col-4"><label class="field__label">Fecha objetivo</label><input class="input" type="date" id="goalDate" value="${g.targetDate || ''}" /></div>
      <div class="field col-12">
        <label class="field__label">Estado</label>
        <select class="select" id="goalStatus">
          <option value="active"    ${g.status === 'active' ? 'selected' : ''}>Activo</option>
          <option value="achieved"  ${g.status === 'achieved' ? 'selected' : ''}>Logrado</option>
          <option value="abandoned" ${g.status === 'abandoned' ? 'selected' : ''}>Descartado</option>
        </select>
      </div>
    </div>
  `;
  openModal({
    title: existing ? 'Editar objetivo' : 'Nuevo objetivo',
    size: 'lg',
    body: dialog,
    actions: [
      { label: 'Cancelar', kind: 'ghost' },
      {
        label: 'Guardar', kind: 'primary',
        onClick: () => {
          const title = dialog.querySelector('#goalTitle').value.trim();
          if (!title) { toastError('El título es obligatorio.'); return false; }
          const data = {
            studentId: student.id,
            title,
            type: dialog.querySelector('#goalType').value,
            description: dialog.querySelector('#goalDesc').value,
            targetValue: dialog.querySelector('#goalValue').value === '' ? null : Number(dialog.querySelector('#goalValue').value),
            unit: dialog.querySelector('#goalUnit').value,
            targetDate: dialog.querySelector('#goalDate').value,
            status: dialog.querySelector('#goalStatus').value,
          };
          if (existing) updateGoal(existing.id, data);
          else createGoal(data);
          toast({ type: 'success', message: existing ? 'Objetivo actualizado.' : 'Objetivo creado.' });
          onSaved && onSaved();
        },
      },
    ],
  });
  refreshIcons(dialog);
}

/* ---------- Tab: Payments ---------- */
function renderPaymentsTab(root, student) {
  const payments = paymentsForStudent(student.id);
  root.innerHTML = `
    <section style="display:flex; flex-direction:column; gap:var(--sp-5)">
      <article class="card">
        <header class="card__header">
          <div class="stack"><h3 class="card__title">Pagos</h3><p class="card__subtitle">Historial y mensualidades</p></div>
          <div class="card__actions">
            <button class="btn btn--primary btn--sm" id="sdNewPayment"><i data-lucide="plus"></i>Nuevo pago</button>
          </div>
        </header>
        <div class="card__body" style="padding:0">
          ${payments.length === 0
            ? `<div class="empty"><div class="empty__icon"><i data-lucide="credit-card"></i></div><div class="empty__title">Sin pagos registrados</div><div class="empty__text">Genera la primera mensualidad con el botón superior.</div></div>`
            : `<div class="table-wrap" style="border:none;border-radius:0">
                <table class="table">
                  <thead><tr><th>Período</th><th class="num">Monto</th><th>Vencimiento</th><th>Pago</th><th>Estado</th><th>Método</th><th></th></tr></thead>
                  <tbody>
                    ${payments.map((p) => {
                      const stClass = p.status === 'paid' ? 'badge--success' : p.status === 'overdue' ? 'badge--danger' : 'badge--warning';
                      const stLabel = p.status === 'paid' ? 'Pagado' : p.status === 'overdue' ? 'Vencido' : 'Pendiente';
                      return `
                        <tr>
                          <td><strong>${escapeHtml(p.period)}</strong></td>
                          <td class="num">${fmtCLP(p.amount)}</td>
                          <td class="t-mono">${fmtDate(p.dueDate)}</td>
                          <td class="t-mono">${p.paidAt ? fmtDate(p.paidAt.slice(0,10)) : '—'}</td>
                          <td><span class="badge ${stClass}">${stLabel}</span></td>
                          <td class="t-muted">${escapeHtml(p.method || '—')}</td>
                          <td class="row-actions">
                            ${p.status !== 'paid' ? `<button class="btn btn--success btn--sm" data-act="markPaid" data-id="${p.id}"><i data-lucide="check"></i>Pagar</button>` : ''}
                            <button class="icon-btn" data-act="delPay" data-id="${p.id}"><i data-lucide="trash-2"></i></button>
                          </td>
                        </tr>
                      `;
                    }).join('')}
                  </tbody>
                </table>
              </div>`}
        </div>
      </article>
    </section>
  `;

  $('#sdNewPayment')?.addEventListener('click', () => openPaymentForm(student, null, () => renderPaymentsTab($('#sdContent'), student)));

  root.addEventListener('click', async (e) => {
    const del = e.target.closest('button[data-act="delPay"]');
    const pay = e.target.closest('button[data-act="markPaid"]');
    if (del) {
      const ok = await confirmDialog({ title: 'Eliminar pago', message: '¿Eliminar este registro de pago?' });
      if (!ok) return;
      const mod = await import('../services/payments.js');
      mod.deletePayment(del.dataset.id);
      toast({ type: 'success', message: 'Pago eliminado.' });
      renderPaymentsTab($('#sdContent'), student);
    }
    if (pay) {
      const mod = await import('../services/payments.js');
      mod.markPaid(pay.dataset.id, 'Efectivo');
      toast({ type: 'success', message: 'Pago registrado.' });
      renderPaymentsTab($('#sdContent'), student);
    }
  });
  refreshIcons(root);
}

function openPaymentForm(student, existing, onSaved) {
  const p = existing || {};
  const dialog = el('div');
  dialog.innerHTML = `
    <div class="form-grid">
      <div class="field col-6"><label class="field__label">Período *</label><input class="input" id="payPeriod" value="${escapeHtml(p.period || '')}" placeholder="Marzo 2026" /></div>
      <div class="field col-6"><label class="field__label">Monto (CLP) *</label><input class="input" type="number" id="payAmount" value="${p.amount || ''}" /></div>
      <div class="field col-6"><label class="field__label">Vencimiento *</label><input class="input" type="date" id="payDue" value="${p.dueDate || todayISO()}" /></div>
      <div class="field col-6">
        <label class="field__label">Estado</label>
        <select class="select" id="payStatus">
          <option value="pending" ${p.status === 'pending' ? 'selected' : ''}>Pendiente</option>
          <option value="paid"    ${p.status === 'paid' ? 'selected' : ''}>Pagado</option>
          <option value="overdue" ${p.status === 'overdue' ? 'selected' : ''}>Vencido</option>
        </select>
      </div>
      <div class="field col-6"><label class="field__label">Método</label><input class="input" id="payMethod" value="${escapeHtml(p.method || '')}" placeholder="Transferencia, efectivo…" /></div>
      <div class="field col-6"><label class="field__label">Fecha pago</label><input class="input" type="date" id="payPaidAt" value="${p.paidAt ? p.paidAt.slice(0,10) : ''}" /></div>
      <div class="field col-12"><label class="field__label">Notas</label><textarea class="textarea" id="payNotes" rows="2">${escapeHtml(p.notes || '')}</textarea></div>
    </div>
  `;
  openModal({
    title: existing ? 'Editar pago' : 'Nuevo pago',
    size: 'lg',
    body: dialog,
    actions: [
      { label: 'Cancelar', kind: 'ghost' },
      {
        label: 'Guardar', kind: 'primary',
        onClick: () => {
          const data = {
            studentId: student.id,
            period: dialog.querySelector('#payPeriod').value.trim(),
            amount: Number(dialog.querySelector('#payAmount').value) || 0,
            dueDate: dialog.querySelector('#payDue').value,
            status: dialog.querySelector('#payStatus').value,
            method: dialog.querySelector('#payMethod').value,
            paidAt: dialog.querySelector('#payPaidAt').value ? new Date(dialog.querySelector('#payPaidAt').value).toISOString() : null,
            notes: dialog.querySelector('#payNotes').value,
          };
          if (!data.period || !data.dueDate || !data.amount) { toastError('Período, monto y vencimiento son obligatorios.'); return false; }
          const m = (async () => (await import('../services/payments.js')))();
          m.then((mod) => {
            if (existing) mod.updatePayment(existing.id, data);
            else mod.createPayment(data);
            toast({ type: 'success', message: existing ? 'Pago actualizado.' : 'Pago registrado.' });
            onSaved && onSaved();
          });
        },
      },
    ],
  });
  refreshIcons(dialog);
}

/* ---------- Tab: Notes ---------- */
function renderNotesTab(root, student) {
  const notes = notesForStudent(student.id);
  root.innerHTML = `
    <section style="display:flex; flex-direction:column; gap:var(--sp-5)">
      <article class="card">
        <header class="card__header">
          <div class="stack"><h3 class="card__title">Notas internas</h3><p class="card__subtitle">Privadas; se incluyen en informes solo si las marcas como "compartibles".</p></div>
          <div class="card__actions"><button class="btn btn--primary btn--sm" id="sdNewNote"><i data-lucide="plus"></i>Nueva nota</button></div>
        </header>
        <div class="card__body">
          ${notes.length === 0
            ? `<div class="empty"><div class="empty__icon"><i data-lucide="sticky-note"></i></div><div class="empty__title">Sin notas</div><div class="empty__text">Anota aquí consideraciones del alumno.</div></div>`
            : `<div class="stack-3">${notes.map((n) => `
                <div class="routine-card">
                  <div class="routine-card__head">
                    <div class="stack">
                      <span class="routine-card__title">${escapeHtml(n.category || 'General')}</span>
                      <span class="routine-card__sub">${fmtDate(n.createdAt.slice(0,10))} · ${escapeHtml(n.author)}</span>
                    </div>
                    ${n.shared ? '<span class="badge badge--accent"><i data-lucide="share-2"></i>Compartible</span>' : '<span class="badge badge--muted">Privada</span>'}
                  </div>
                  <p style="white-space:pre-wrap; color:var(--c-text); margin:0">${escapeHtml(n.body)}</p>
                  <div class="row gap-2">
                    <button class="btn btn--ghost btn--sm" data-act="editNote" data-id="${n.id}"><i data-lucide="pencil"></i>Editar</button>
                    <button class="btn btn--danger btn--sm" data-act="delNote" data-id="${n.id}"><i data-lucide="trash-2"></i>Eliminar</button>
                  </div>
                </div>
              `).join('')}</div>`
          }
        </div>
      </article>
    </section>
  `;
  $('#sdNewNote')?.addEventListener('click', () => openNoteForm(student, null, () => renderNotesTab($('#sdContent'), student)));
  root.addEventListener('click', async (e) => {
    const edit = e.target.closest('button[data-act="editNote"]');
    const del = e.target.closest('button[data-act="delNote"]');
    if (edit) {
      const id = edit.dataset.id;
      const n = notes.find((x) => x.id === id);
      openNoteForm(student, n, () => renderNotesTab($('#sdContent'), student));
    }
    if (del) {
      const ok = await confirmDialog({ title: 'Eliminar nota', message: '¿Eliminar esta nota?' });
      if (!ok) return;
      deleteNote(del.dataset.id);
      toast({ type: 'success', message: 'Nota eliminada.' });
      renderNotesTab($('#sdContent'), student);
    }
  });
  refreshIcons(root);
}

function openNoteForm(student, existing, onSaved) {
  const n = existing || {};
  const dialog = el('div');
  dialog.innerHTML = `
    <div class="form-grid">
      <div class="field col-6">
        <label class="field__label">Categoría</label>
        <select class="select" id="noteCat">
          ${['general','progreso','salud','técnica','otro'].map((c) => `<option value="${c}" ${n.category === c ? 'selected' : ''}>${c}</option>`).join('')}
        </select>
      </div>
      <div class="field col-6" style="justify-content:flex-end">
        <label class="checkbox">
          <input type="checkbox" id="noteShared" ${n.shared ? 'checked' : ''} />
          Compartir con el alumno (sólo si se selecciona al generar informe)
        </label>
      </div>
      <div class="field col-12">
        <label class="field__label">Nota</label>
        <textarea class="textarea" id="noteBody" rows="4">${escapeHtml(n.body || '')}</textarea>
      </div>
    </div>
  `;
  openModal({
    title: existing ? 'Editar nota' : 'Nueva nota',
    body: dialog,
    actions: [
      { label: 'Cancelar', kind: 'ghost' },
      {
        label: 'Guardar', kind: 'primary',
        onClick: () => {
          const body = dialog.querySelector('#noteBody').value.trim();
          if (!body) { toastError('La nota no puede estar vacía.'); return false; }
          const data = {
            studentId: student.id,
            category: dialog.querySelector('#noteCat').value,
            body,
            shared: dialog.querySelector('#noteShared').checked,
          };
          if (existing) updateNote(existing.id, data);
          else createNote(data);
          toast({ type: 'success', message: existing ? 'Nota actualizada.' : 'Nota guardada.' });
          onSaved && onSaved();
        },
      },
    ],
  });
  refreshIcons(dialog);
}

/* ---------- Tab: Level ---------- */
function renderLevelTab(root, student) {
  const own = listAttendances().filter((a) => a.studentId === student.id);
  const meas = listMeasurements().filter((m) => m.studentId === student.id);
  const goals = goalsForStudent(student.id);
  const metrics = computeStudentMetrics(student, own, meas, goals, listClosures());
  const level = determineLevel(metrics);
  const badges = allBadgesWithStatus(metrics);
  const earned = earnedBadges(metrics);

  root.innerHTML = `
    <section style="display:flex; flex-direction:column; gap:var(--sp-5)">
      <article class="card">
        <header class="card__header"><h3 class="card__title">Escalera de niveles</h3></header>
        <div class="card__body">
          <div class="stack-4">
            ${LEVELS.map((lv) => {
              const reached = metrics.totalAttendances >= lv.totalAttendances && metrics.streakWeeks >= lv.streakWeeks && metrics.weeklyCompliance >= lv.weeklyCompliance;
              const isCurrent = lv.id === level.id;
              return `
                <div class="routine-card" style="border-color:${reached ? lv.border : 'var(--c-border)'}">
                  <div class="routine-card__head">
                    <div class="cell-name">
                      <div class="stack">
                        <span class="routine-card__title">${lv.name}</span>
                        <span class="routine-card__sub">${escapeHtml(lv.description)}</span>
                      </div>
                    </div>
                    <div class="row gap-2">
                      ${isCurrent ? '<span class="badge badge--accent">Actual</span>' : (reached ? '<span class="badge badge--success">Alcanzado</span>' : '<span class="badge badge--muted">Pendiente</span>')}
                      <span class="level-pill" style="--level-bg:${lv.bg}; --level-fg:${lv.fg}; --level-border:${lv.border}"><span class="level-pill__dot"></span>${lv.name}</span>
                    </div>
                  </div>
                  <div class="row gap-4" style="color:var(--c-text-muted); font-size:var(--fs-sm)">
                    <span>≥ ${lv.totalAttendances} sesiones</span>
                    <span>≥ ${lv.streakWeeks} semanas seguidas</span>
                    <span>≥ ${(lv.weeklyCompliance * 100).toFixed(0)}% cumplimiento</span>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      </article>

      <article class="card">
        <header class="card__header"><h3 class="card__title">Insignias</h3></header>
        <div class="card__body">
          <div class="badge-grid">
            ${badges.map((b) => `
              <div class="badge-card ${b.earned ? '' : 'is-locked'}">
                <div class="badge-card__icon"><i data-lucide="${b.icon}"></i></div>
                <div class="stack">
                  <span class="badge-card__name">${escapeHtml(b.name)}</span>
                  <span class="badge-card__desc">${escapeHtml(b.desc)}</span>
                </div>
              </div>
            `).join('')}
          </div>
          ${earned.length === 0 ? '<p class="t-muted" style="margin-top:var(--sp-4)">Aún no se han obtenido insignias. Continúa cumpliendo la meta semanal.</p>' : ''}
        </div>
      </article>

      <article class="card">
        <header class="card__header"><h3 class="card__title">Cómo se calcula</h3></header>
        <div class="card__body">
          <div class="muted-block">
            El nivel se basa <strong>exclusivamente en la constancia</strong>: total de asistencias, semanas consecutivas cumpliendo la meta semanal y cumplimiento de las últimas 12 semanas.
            Las <strong>medidas físicas no afectan el nivel</strong> para evitar penalizaciones por un peso que fluctúa naturalmente.
            La semana se considera de lunes a domingo. Una asistencia duplicada no duplica experiencia, y las semanas futuras no se cuentan como incumplidas.
          </div>
        </div>
      </article>
    </section>
  `;
  refreshIcons(root);
}


function hexToRgba(hex, alpha) {
  if (!hex) return 'rgba(0,0,0,0)';
  if (hex.startsWith('rgb')) return hex;
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
