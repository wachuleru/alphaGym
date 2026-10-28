/* ===========================================================
   ALPHA-FIT — Individual student reports
   Builds printable HTML for the chosen sections.
   =========================================================== */

import { fmtDate, fmtCLP, fromISODate } from '../utils.js';
import { LEVELS, MUSCLE_GROUP_BY_VALUE, IMPLEMENT_BY_VALUE, NO_CATEGORY_LABEL, APP_NAME } from '../config.js';
import { computeStudentMetrics, determineLevel, progressToNext, earnedBadges } from './levels.js';
import { listClosures } from './closures.js';
import { fullName } from './students.js';
import { listAttendances } from './attendance.js';
import { listMeasurements, MEASURE_FIELDS, getMeasureLabel, getMeasureUnit } from './measurements.js';
import { forStudent as paymentsForStudent } from './payments.js';
import { listTrainings, findTraining } from './trainings.js';
import { findCategory, listCategories } from './categories.js';
import { forStudent as goalsForStudent } from './goals.js';
import { forStudent as notesForStudent } from './notes.js';
import { weightDelta } from './entries.js';

/* ---------- Section selector (defaults) ---------- */
export const DEFAULT_SECTIONS = {
  attendance: true,
  level: true,
  workouts: true,
  weight: true,
  measurements: true,
  goals: true,
  payments: true,
  notes: false, // off by default
};

export function buildReportContext(student, opts) {
  const sections = { ...DEFAULT_SECTIONS, ...(opts?.sections || {}) };
  const period = {
    fromISO: opts?.fromISO || null,
    toISO: opts?.toISO || null,
  };
  const allAtt = listAttendances().filter((a) => a.studentId === student.id);
  const metrics = computeStudentMetrics(student, allAtt, listMeasurements(), [], listClosures());

  // Pre-compute workout sessions for the print block (newest first, last 10).
  const workoutSessions = allAtt
    .filter((a) => Array.isArray(a.entries) && a.entries.length > 0)
    .slice()
    .sort((a, b) => `${b.dateISO}${b.timeISO || ''}`.localeCompare(`${a.dateISO}${a.timeISO || ''}`))
    .slice(0, 10);

  return {
    student,
    sections,
    period,
    metrics,
    level: determineLevel(metrics),
    progress: progressToNext(metrics),
    badges: earnedBadges(metrics),
    attendances: allAtt,
    measurements: listMeasurements().filter((m) => m.studentId === student.id),
    payments: paymentsForStudent(student.id),
    trainings: listTrainings(),
    categories: listCategories(),
    workoutSessions,
    goals: goalsForStudent(student.id),
    notes: notesForStudent(student.id).filter((n) => n.shared),
    generatedAt: new Date().toISOString(),
    trainerComment: opts?.trainerComment || '',
  };
}

/* ---------- HTML rendering ----------
   We render the same DOM the printable preview shows.
*/

function numDelta(curr, prev) {
  if (curr == null || isNaN(curr) || prev == null || isNaN(prev)) return '';
  const diff = curr - prev;
  if (Math.abs(diff) < 0.0001) return '';
  const sign = diff > 0 ? '+' : '−';
  return `${sign}${Math.abs(diff).toLocaleString('es-CL', { maximumFractionDigits: 2 })}`;
}

function pctDelta(curr, prev) {
  if (curr == null || isNaN(curr) || prev == null || !prev) return '';
  const diff = ((curr - prev) / prev) * 100;
  if (Math.abs(diff) < 0.05) return '';
  const sign = diff > 0 ? '+' : '−';
  return `${sign}${Math.abs(diff).toFixed(1)}%`;
}

function escape(s) {
  return String(s || '').replace(/[<>&"']/g, (c) => ({
    '<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;'
  }[c]));
}

function fmtPeriod(p) {
  if (!p?.fromISO && !p?.toISO) return 'Historial completo';
  const f = p.fromISO ? fmtDate(p.fromISO) : '—';
  const t = p.toISO   ? fmtDate(p.toISO)   : '—';
  return `${f} a ${t}`;
}

export function renderReport(ctx, gymName = APP_NAME) {
  const e = escape;
  const s = ctx.student;
  const full = fullName(s);
  const lvl = ctx.level;

  const attendanceInPeriod = ctx.attendances.filter((a) =>
    (!ctx.period.fromISO || a.dateISO >= ctx.period.fromISO) &&
    (!ctx.period.toISO || a.dateISO <= ctx.period.toISO)
  );

  const monthlyCount = (() => {
    const groups = {};
    for (const a of attendanceInPeriod) {
      const d = fromISODate(a.dateISO);
      const k = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      groups[k] = (groups[k] || 0) + 1;
    }
    return Object.entries(groups).map(([k, v]) => `${k}: ${v}`).join(' · ');
  })();

  const measurementsInPeriod = ctx.measurements.filter((m) =>
    (!ctx.period.fromISO || m.date >= ctx.period.fromISO) &&
    (!ctx.period.toISO || m.date <= ctx.period.toISO)
  );

  const weightReadings = measurementsInPeriod.filter((m) => m.weightKg != null && m.weightKg !== '');
  const weightLine = (() => {
    if (weightReadings.length < 1) return '<tr><td>Peso</td><td>—</td><td>—</td><td>—</td></tr>';
    const first = weightReadings[0];
    const last = weightReadings[weightReadings.length - 1];
    return `
      <tr>
        <td>Peso corporal (kg)</td>
        <td>${last.weightKg}</td>
        <td>${first.weightKg}</td>
        <td>${numDelta(last.weightKg, first.weightKg)}${pctDelta(last.weightKg, first.weightKg) ? ' (' + pctDelta(last.weightKg, first.weightKg) + ')' : ''}</td>
      </tr>
    `;
  })();

  let measureRows = '';
  for (const f of MEASURE_FIELDS) {
    if (f.key === 'weightKg') continue;
    const readings = measurementsInPeriod.filter((m) => m[f.key] != null && m[f.key] !== '');
    if (!readings.length) continue;
    const first = readings[0];
    const last = readings[readings.length - 1];
    measureRows += `
      <tr>
        <td>${f.label} (${f.unit})</td>
        <td>${last[f.key]}</td>
        <td>${first[f.key]}</td>
        <td>${numDelta(last[f.key], first[f.key])}${pctDelta(last[f.key], first[f.key]) ? ' (' + pctDelta(last[f.key], first[f.key]) + ')' : ''}</td>
      </tr>`;
  }

  const goalBlock = (() => {
    if (!ctx.goals.length) return '';
    const g = ctx.goals[0];
    return `
      <div class="report-row">
        <div><small>Objetivo principal</small><strong>${e(g.title)}${g.targetValue != null ? ` — ${g.targetValue} ${e(g.unit)}` : ''}</strong></div>
        <div><small>Fecha objetivo</small><strong>${g.targetDate ? fmtDate(g.targetDate) : 'Sin fecha'}</strong></div>
      </div>
    `;
  })();

  return `
    <article class="report-paper print-payload">
      <header>
        <div class="report-brand">
          <img class="report-brand__logo" src="./assets/img/logo-ink.svg" alt="" width="54" height="32" />
          <div class="report-brand__text">
            <strong>${e(gymName)}</strong>
            <small>Gestión integral del gimnasio</small>
          </div>
        </div>
        <h1>Informe de progreso</h1>
        <div class="report-meta">
          Generado el ${fmtDate(ctx.generatedAt.slice(0,10))} ·
          Alumno: <strong>${e(full)}</strong> · Período: <strong>${fmtPeriod(ctx.period)}</strong>
        </div>
      </header>

      <section class="report-section">
        <h2 class="report-section__title">Resumen general</h2>
        <div class="report-row">
          <div><small>Estado</small><strong>${e(s.status === 'active' ? 'Activo' : s.status === 'inactive' ? 'Inactivo' : 'Suspendido')}</strong></div>
          <div><small>Fecha de inscripción</small><strong>${fmtDate(s.joinedAt)}</strong></div>
        </div>
        <div class="report-row">
          <div><small>Objetivo principal</small><strong>${e(s.mainGoal) || '—'}</strong></div>
          <div><small>Frecuencia semanal</small><strong>${s.weeklyGoal || 2} sesiones/semana</strong></div>
        </div>
        ${goalBlock}
      </section>

      ${ctx.sections.attendance ? `
        <section class="report-section">
          <h2 class="report-section__title">Asistencia</h2>
          <div class="report-row">
            <div><small>Total de sesiones</small><strong>${ctx.metrics.totalAttendances}</strong></div>
            <div><small>Última asistencia</small><strong>${ctx.metrics.lastAttendanceISO ? fmtDate(ctx.metrics.lastAttendanceISO) : '—'}</strong></div>
          </div>
          <div class="report-row">
            <div><small>Sesiones en el período</small><strong>${attendanceInPeriod.length}</strong></div>
            <div><small>Racha actual</small><strong>${ctx.metrics.streakWeeks} semana(s) consecutivas</strong></div>
          </div>
          <div class="report-row">
            <div><small>Cumplimiento semanal (12 sem)</small><strong>${(ctx.metrics.weeklyCompliance * 100).toFixed(0)}%</strong></div>
            <div><small>Por mes</small><strong>${monthlyCount || '—'}</strong></div>
          </div>
        </section>
      ` : ''}

      ${ctx.sections.level ? `
        <section class="report-section">
          <h2 class="report-section__title">Nivel y constancia</h2>
          <div class="report-row">
            <div><small>Nivel actual</small><strong>${e(lvl.name)}</strong></div>
            <div><small>Progreso al siguiente nivel</small><strong>${(ctx.progress * 100).toFixed(0)}%</strong></div>
          </div>
          <div class="report-row">
            <div><small>Insignias obtenidas</small><strong>${ctx.badges.map((b) => b.name).join(', ') || '—'}</strong></div>
          </div>
        </section>
      ` : ''}

      ${ctx.sections.workouts ? `
        <section class="report-section">
          <h2 class="report-section__title">Entrenamientos y pesos por sesión</h2>
          ${ctx.workoutSessions.length === 0 ? '<p style="color:#64748b">Sin sesiones registradas con ejercicios.</p>' : ''}
          ${ctx.workoutSessions.map((a) => {
            const t = a.trainingId ? findTraining(a.trainingId) : null;
            // Distinguish "no template was used" from "the template was deleted".
            const title = t ? t.name : (a.trainingId ? 'Entrenamiento eliminado' : 'Sesión libre');
            // Resolve prior entries strictly before this date, same student.
            const allAtt = listAttendances().filter((x) => x.studentId === a.studentId && x.dateISO < a.dateISO && Array.isArray(x.entries));
            allAtt.sort((x, y) => `${y.dateISO}${y.timeISO || ''}`.localeCompare(`${x.dateISO}${x.timeISO || ''}`));
            const priorMap = new Map();
            for (const x of allAtt) for (const e of x.entries) if (!priorMap.has(e.exerciseId)) priorMap.set(e.exerciseId, e);
            const cat = t?.categoryId ? findCategory(t.categoryId) : null;
            const catTag = t ? (cat ? cat.name : NO_CATEGORY_LABEL) : '';
            return `
              <h3 style="margin:0 0 6px">${e(title)} — ${fmtDate(a.dateISO)}${catTag ? ` <small style="color:#64748b;font-weight:400">(${e(catTag)})</small>` : ''}</h3>
              <table style="width:100%; border-collapse:collapse; font-size:12px; margin-bottom:8px">
                <thead><tr style="background:#f1f5f9"><th align="left" style="padding:6px">Ejercicio</th><th align="left" style="padding:6px">Grupo</th><th align="left" style="padding:6px">Series×Reps</th><th align="left" style="padding:6px">Peso</th><th align="left" style="padding:6px">Δ vs anterior</th><th align="left" style="padding:6px">Obs.</th></tr></thead>
                <tbody>
                  ${a.entries.map((x) => {
                    const grp = (x.muscleGroups || []).map((g) => (MUSCLE_GROUP_BY_VALUE[g] || { label: g }).label).join(', ');
                    const prev = priorMap.get(x.exerciseId);
                    const wt = typeof x.weightKg === 'number' ? `${x.weightKg} kg` : '—';
                    const d = weightDelta(x.weightKg, prev?.weightKg ?? null);
                    return `
                      <tr style="border-bottom:1px solid #e2e8f0">
                        <td style="padding:6px">${e(x.name)}${x.extra ? ' <em>(+)</em>' : ''}</td>
                        <td style="padding:6px">${e(grp || '—')}</td>
                        <td style="padding:6px">${e(String(x.sets || '—'))} × ${e(String(x.reps || '—'))}</td>
                        <td style="padding:6px">${wt}</td>
                        <td style="padding:6px">${e(d.text)}</td>
                        <td style="padding:6px">${e(x.observation || '')}</td>
                      </tr>`;
                  }).join('')}
                </tbody>
              </table>
            `;
          }).join('')}
        </section>
      ` : ''}

      ${(ctx.sections.weight || ctx.sections.measurements) ? `
        <section class="report-section">
          <h2 class="report-section__title">Progreso físico</h2>
          ${weightReadings.length === 0 && !measureRows ? '<p>Sin mediciones en el período.</p>' : ''}
          ${ctx.sections.weight && weightReadings.length ? `
            <h3 style="margin:0 0 6px">Peso corporal</h3>
            <table style="width:100%; border-collapse:collapse; font-size:12px; margin-bottom:8px">
              <thead><tr style="background:#f1f5f9"><th align="left" style="padding:6px">Medición</th><th align="left" style="padding:6px">Valor actual</th><th align="left" style="padding:6px">Valor inicial</th><th align="left" style="padding:6px">Cambio</th></tr></thead>
              <tbody>${weightLine}</tbody>
            </table>
          ` : ''}
          ${ctx.sections.measurements && measureRows ? `
            <h3 style="margin:12px 0 6px">Medidas corporales</h3>
            <table style="width:100%; border-collapse:collapse; font-size:12px">
              <thead><tr style="background:#f1f5f9"><th align="left" style="padding:6px">Medición</th><th align="left" style="padding:6px">Último</th><th align="left" style="padding:6px">Primero</th><th align="left" style="padding:6px">Cambio</th></tr></thead>
              <tbody>${measureRows}</tbody>
            </table>
          ` : ''}
        </section>
      ` : ''}

      ${ctx.sections.goals ? `
        <section class="report-section">
          <h2 class="report-section__title">Objetivos</h2>
          ${ctx.goals.length === 0 ? '<p>Sin objetivos registrados.</p>' :
            `<ul style="margin:0; padding-left:18px">
              ${ctx.goals.map((g) => `
                <li><strong>${e(g.title)}</strong>${g.targetValue != null ? ` · Meta: ${g.targetValue} ${e(g.unit)}` : ''}${g.targetDate ? ` · Para: ${fmtDate(g.targetDate)}` : ''}${g.status !== 'active' ? ` · [${e(g.status)}]` : ''}</li>
              `).join('')}
            </ul>`
          }
        </section>
      ` : ''}

      ${ctx.sections.payments ? `
        <section class="report-section">
          <h2 class="report-section__title">Pagos</h2>
          ${ctx.payments.length === 0 ? '<p>Sin pagos registrados.</p>' : `
            <table style="width:100%; border-collapse:collapse; font-size:12px">
              <thead><tr style="background:#f1f5f9"><th align="left" style="padding:6px">Período</th><th align="left" style="padding:6px">Monto</th><th align="left" style="padding:6px">Vencimiento</th><th align="left" style="padding:6px">Estado</th></tr></thead>
              <tbody>
                ${ctx.payments.slice(0, 12).map((p) => `
                  <tr style="border-bottom:1px solid #e2e8f0">
                    <td style="padding:6px">${e(p.period)}</td>
                    <td style="padding:6px">${fmtCLP(p.amount)}</td>
                    <td style="padding:6px">${fmtDate(p.dueDate)}</td>
                    <td style="padding:6px">${e(p.status === 'paid' ? 'Pagado' : p.status === 'pending' ? 'Pendiente' : 'Vencido')}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          `}
        </section>
      ` : ''}

      ${ctx.sections.notes && ctx.notes.length ? `
        <section class="report-section">
          <h2 class="report-section__title">Comentarios del entrenador</h2>
          <ul style="margin:0; padding-left:18px">
            ${ctx.notes.map((n) => `<li>${fmtDate(n.createdAt.slice(0,10))} — ${e(n.body)}</li>`).join('')}
          </ul>
        </section>
      ` : ''}

      ${ctx.trainerComment ? `
        <section class="report-section">
          <h2 class="report-section__title">Comentario final del entrenador</h2>
          <p>${e(ctx.trainerComment)}</p>
        </section>
      ` : ''}

      <footer style="margin-top:24px; padding-top:16px; border-top:1px solid #e2e8f0; color:#94a3b8; font-size:11px">
        Generado con ${APP_NAME} · Los datos provienen del registro administrativo.
      </footer>
    </article>
  `;
}
