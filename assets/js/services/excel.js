/* ===========================================================
   GymTrack — Excel import / export using SheetJS
   Used only on the client. Works entirely in browser.
   =========================================================== */

import { downloadBlob, uid, todayISO, fmtDate } from '../utils.js';
import { listStudents } from './students.js';
import { listAttendances } from './attendance.js';
import { listMeasurements, MEASURE_FIELDS } from './measurements.js';
import { listPayments } from './payments.js';
import { listExercises as listAllExercises } from './exercises.js';
import { listTrainings, exercisesOf as exercisesOfTraining } from './trainings.js';
import { listGoals } from './goals.js';
import { MUSCLE_GROUP_BY_VALUE, IMPLEMENT_BY_VALUE } from '../config.js';
import { weightDelta } from './entries.js';

/* ===========================================================
   UTILITIES
   =========================================================== */

function checkXLSX() {
  if (typeof window === 'undefined' || !window.XLSX) {
    throw new Error('SheetJS no está disponible. Verifica tu conexión a internet y recarga la página.');
  }
  return window.XLSX;
}

/** Build an array-of-arrays sheet from headers + rows */
function aoaToSheet(headers, rows) {
  const XLSX = checkXLSX();
  const aoa = [headers, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  return ws;
}

function downloadWorkbook(wb, filename) {
  const XLSX = checkXLSX();
  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([out], { type: 'application/octet-stream' });
  downloadBlob(blob, filename);
}

function studentFullName(s) {
  return [s.firstName, s.lastName].filter(Boolean).join(' ').trim();
}

/* ===========================================================
   EXPORTS
   =========================================================== */

export function exportStudents() {
  const headers = ['ID', 'Nombre', 'Apellido', 'Nombre completo', 'Email', 'Teléfono', 'Fecha nacimiento', 'Fecha inscripción', 'Estado', 'Objetivo', 'Meta semanal', 'Horarios', 'Inicio membresía', 'Vencimiento membresía'];
  const rows = listStudents().map((s) => [
    s.id,
    s.firstName,
    s.lastName,
    studentFullName(s),
    s.email,
    s.phone,
    s.birthdate,
    s.joinedAt,
    s.status,
    s.mainGoal,
    s.weeklyGoal,
    s.preferredTimes,
    s.membershipStart || '',
    s.membershipEnd || '',
  ]);
  const wb = checkXLSX().utils.book_new();
  checkXLSX().utils.book_append_sheet(wb, aoaToSheet(headers, rows), 'Alumnos');
  downloadWorkbook(wb, `gymtrack_alumnos_${todayISO()}.xlsx`);
}

export function exportAttendances() {
  const studentById = new Map(listStudents().map((s) => [s.id, s]));
  const trainingById = new Map(listTrainings().map((t) => [t.id, t]));
  const rows = listAttendances().map((a) => {
    const s = studentById.get(a.studentId);
    const t = a.trainingId ? trainingById.get(a.trainingId) : null;
    const n = Array.isArray(a.entries) ? a.entries.length : 0;
    const sumKg = Array.isArray(a.entries)
      ? a.entries.reduce((acc, e) => acc + (typeof e.weightKg === 'number' ? e.weightKg : 0), 0)
      : 0;
    return [
      a.id,
      a.studentId,
      s ? studentFullName(s) : '',
      a.dateISO,
      a.timeISO,
      a.type,
      t ? t.name : '',
      n,
      n ? Math.round(sumKg * 100) / 100 : '',
      a.notes,
    ];
  });
  const headers = ['ID', 'ID Alumno', 'Alumno', 'Fecha', 'Hora', 'Tipo', 'Entrenamiento', 'N° ejercicios', 'Σ volumen (kg)', 'Notas'];
  const wb = checkXLSX().utils.book_new();
  checkXLSX().utils.book_append_sheet(wb, aoaToSheet(headers, rows), 'Asistencias');
  downloadWorkbook(wb, `gymtrack_asistencias_${todayISO()}.xlsx`);
}

export function exportMeasurements() {
  const studentById = new Map(listStudents().map((s) => [s.id, s]));
  const headers = ['ID', 'ID Alumno', 'Alumno', 'Fecha', ...MEASURE_FIELDS.map((f) => f.label + ` (${f.unit})`), 'Notas'];
  const rows = listMeasurements().map((m) => {
    const s = studentById.get(m.studentId);
    return [
      m.id,
      m.studentId,
      s ? studentFullName(s) : '',
      m.date,
      ...MEASURE_FIELDS.map((f) => m[f.key] ?? ''),
      m.notes || '',
    ];
  });
  const wb = checkXLSX().utils.book_new();
  checkXLSX().utils.book_append_sheet(wb, aoaToSheet(headers, rows), 'Mediciones');
  downloadWorkbook(wb, `gymtrack_mediciones_${todayISO()}.xlsx`);
}

export function exportPayments() {
  const studentById = new Map(listStudents().map((s) => [s.id, s]));
  const headers = ['ID', 'ID Alumno', 'Alumno', 'Período', 'Monto CLP', 'Vencimiento', 'Estado', 'Fecha pago', 'Método', 'Notas'];
  const rows = listPayments().map((p) => {
    const s = studentById.get(p.studentId);
    return [
      p.id,
      p.studentId,
      s ? studentFullName(s) : '',
      p.period,
      p.amount,
      p.dueDate,
      p.status,
      p.paidAt || '',
      p.method || '',
      p.notes || '',
    ];
  });
  const wb = checkXLSX().utils.book_new();
  checkXLSX().utils.book_append_sheet(wb, aoaToSheet(headers, rows), 'Pagos');
  downloadWorkbook(wb, `gymtrack_pagos_${todayISO()}.xlsx`);
}

export function exportWorkouts() {
  const studentById = new Map(listStudents().map((s) => [s.id, s]));
  const exById = new Map(listAllExercises({ includeArchived: true }).map((e) => [e.id, e]));

  /* Sheet 1: Catalog */
  const headerCatalog = ['ID', 'Nombre', 'Grupos musculares', 'Observación', 'Estado', 'Fecha creación'];
  const rowsCatalog = listAllExercises({ includeArchived: true }).map((e) => [
    e.id,
    e.name,
    (e.muscleGroups || []).map((g) => (MUSCLE_GROUP_BY_VALUE[g] || { label: g }).label).join(', '),
    e.observation || '',
    e.status,
    e.createdAt || '',
  ]);

  /* Sheet 2: Trainings */
  const headerTraining = ['ID', 'Nombre', 'Objetivo', 'Observación', 'Estado', 'N° ejercicios', 'Ejercicios (en orden)'];
  const rowsTraining = listTrainings({ includeArchived: true }).map((t) => {
    const ex = exercisesOfTraining(t.id);
    return [
      t.id,
      t.name,
      t.objective || '',
      t.observation || '',
      t.status,
      ex.length,
      ex.map((e) => e.name).join(' → '),
    ];
  });

  /* Sheet 3: Attendance x Student (one row per exercise per attendance) */
  // For the prior weight we read other attendances chronologically.
  const allAtt = listAttendances();
  const sorted = allAtt.slice().sort((a, b) =>
    `${a.dateISO}${a.timeISO || ''}`.localeCompare(`${b.dateISO}${b.timeISO || ''}`)
  );
  const trainingById = new Map(listTrainings({ includeArchived: true }).map((t) => [t.id, t]));
  // Distinguish "no template was used" from "the template was deleted".
  const trainingLabel = (a) =>
    !a.trainingId ? 'Sesión libre' : (trainingById.get(a.trainingId)?.name || 'Entrenamiento eliminado');
  // priorMap[sid][exerciseId] -> weightKg
  const priorByStudent = new Map();
  for (const a of sorted) {
    const bag = priorByStudent.get(a.studentId) || new Map();
    for (const e of (a.entries || [])) {
      if (!bag.has(e.exerciseId)) bag.set(e.exerciseId, typeof e.weightKg === 'number' ? e.weightKg : null);
    }
    priorByStudent.set(a.studentId, bag);
  }

  const headerAtt = [
    'Fecha', 'Alumno', 'Entrenamiento', 'Ejercicio', 'Grupos', 'Series', 'Repeticiones',
    'Implemento', 'Peso (kg)', 'Peso anterior (kg)', 'Δ kg', 'Δ %', 'Añadido', 'Observación',
  ];
  const rowsAtt = [];
  for (const a of sorted) {
    const s = studentById.get(a.studentId);
    for (const e of (a.entries || [])) {
      const prior = priorByStudent.get(a.studentId)?.get(e.exerciseId) ?? null;
      const cur = typeof e.weightKg === 'number' ? e.weightKg : null;
      const d = weightDelta(cur, prior);
      const prevKg = prior != null ? prior : '';
      const groups = (e.muscleGroups || []).map((g) => (MUSCLE_GROUP_BY_VALUE[g] || { label: g }).label).join(', ');
      const impl = (IMPLEMENT_BY_VALUE[e.implement] || { label: e.implement || '' }).label;
      rowsAtt.push([
        a.dateISO,
        s ? studentFullName(s) : '',
        trainingLabel(a),
        e.name || (exById.get(e.exerciseId)?.name) || 'Ejercicio eliminado',
        groups,
        e.sets ?? '',
        e.reps ?? '',
        impl,
        cur != null ? cur : '',
        prevKg,
        d.kg != null ? d.kg : '',
        d.pct != null ? d.pct : '',
        e.extra ? 'Sí' : 'No',
        e.observation || '',
      ]);
      // Update the priorMap for the next attendance (most-recent-wins).
      const bag = priorByStudent.get(a.studentId);
      bag.set(e.exerciseId, cur);
    }
  }

  const wb = checkXLSX().utils.book_new();
  checkXLSX().utils.book_append_sheet(wb, aoaToSheet(headerCatalog, rowsCatalog), 'Ejercicios');
  checkXLSX().utils.book_append_sheet(wb, aoaToSheet(headerTraining, rowsTraining), 'Entrenamientos');
  checkXLSX().utils.book_append_sheet(wb, aoaToSheet(headerAtt, rowsAtt), 'Entrenamiento x Alumno');
  downloadWorkbook(wb, `gymtrack_entrenamientos_${todayISO()}.xlsx`);
}

/* ===========================================================
   TEMPLATES for IMPORT
   =========================================================== */

export function downloadStudentsTemplate() {
  const headers = ['Nombre*', 'Apellido', 'Email', 'Teléfono', 'Fecha nacimiento (YYYY-MM-DD)', 'Fecha inscripción (YYYY-MM-DD)', 'Estado', 'Objetivo principal', 'Meta semanal (sesiones)', 'Horarios habituales'];
  const example = ['Ejemplo Nombre', 'Ejemplo Apellido', 'ejemplo@mail.cl', '+56 9 0000 0000', '1995-06-15', todayISO(), 'active', 'Mejorar resistencia', 2, 'Mañana'];
  const wb = checkXLSX().utils.book_new();
  checkXLSX().utils.book_append_sheet(wb, aoaToSheet(headers, [example]), 'Alumnos');
  downloadWorkbook(wb, 'gymtrack_plantilla_alumnos.xlsx');
}

export function downloadMeasurementsTemplate() {
  const headers = ['ID Alumno*', 'Alumno (texto)', 'Fecha (YYYY-MM-DD)*', ...MEASURE_FIELDS.map((f) => `${f.label} (${f.unit})`), 'Notas'];
  const example = ['stu_xxxxx', 'Nombre Apellido (opcional)', todayISO(), ...MEASURE_FIELDS.map(() => ''), 'Notas'];
  const wb = checkXLSX().utils.book_new();
  checkXLSX().utils.book_append_sheet(wb, aoaToSheet(headers, [example]), 'Mediciones');
  downloadWorkbook(wb, 'gymtrack_plantilla_mediciones.xlsx');
}

/* ===========================================================
   IMPORT
   Returns { ok, created, updated, skipped, errors }.
   =========================================================== */

export async function importFile(file, kind) {
  const XLSX = checkXLSX();
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });

  if (kind === 'students') return importStudents(wb);
  if (kind === 'measurements') return importMeasurements(wb);
  throw new Error('Tipo de importación no soportado: ' + kind);
}

function getSheet(wb, expected) {
  const XLSX = checkXLSX();
  const name = wb.SheetNames.find((n) => n === expected) || wb.SheetNames[0];
  if (!name) return [];
  return XLSX.utils.sheet_to_json(wb.Sheets[name], { defval: '', raw: true });
}

async function importStudents(wb) {
  const rows = getSheet(wb, 'Alumnos');
  const errors = [];
  const created = [];
  const skipped = [];
  if (!rows.length) return { ok: false, errors: ['Hoja "Alumnos" vacía.'], created, skipped };

  const db = (await import('../storage.js')).getState();
  const existing = db.students;
  const existingByFull = new Map(existing.map((s) => [studentFullName(s).toLowerCase(), s]));

  const newStudents = [...db.students];

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const firstName = String(r['Nombre*'] ?? r['Nombre'] ?? '').trim();
    if (!firstName) {
      errors.push(`Fila ${i + 2}: falta "Nombre*". Se omitió.`);
      skipped.push(i + 1);
      continue;
    }
    const lastName = String(r['Apellido'] ?? '').trim();
    const fullName = (firstName + ' ' + lastName).trim().toLowerCase();

    if (existingByFull.has(fullName)) {
      skipped.push(i + 1);
      continue;
    }

    const id = uid('stu');
    const record = {
      id,
      firstName,
      lastName,
      phone: String(r['Teléfono'] || '').trim(),
      email: String(r['Email'] || '').trim(),
      birthdate: normalizeISODate(r['Fecha nacimiento (YYYY-MM-DD)']),
      joinedAt: normalizeISODate(r['Fecha inscripción (YYYY-MM-DD)']) || todayISO(),
      status: String(r['Estado'] || 'active').trim(),
      mainGoal: String(r['Objetivo principal'] || '').trim(),
      weeklyGoal: Number(r['Meta semanal (sesiones)']) > 0 ? Number(r['Meta semanal (sesiones)']) : 2,
      preferredTimes: String(r['Horarios habituales'] || '').trim(),
      notes: '',
      membershipStart: null,
      membershipEnd: null,
      meta: { createdAt: new Date().toISOString(), isDemo: false },
    };
    newStudents.unshift(record);
    created.push(record);
    existingByFull.set(fullName, record);
  }

  if (created.length) {
    (await import('../storage.js')).setState((db) => ({ ...db, students: newStudents }));
  }
  return { ok: errors.length === 0, errors, created, skipped };
}

async function importMeasurements(wb) {
  const rows = getSheet(wb, 'Mediciones');
  const errors = [];
  const created = [];
  const skipped = [];

  if (!rows.length) return { ok: false, errors: ['Hoja "Mediciones" vacía.'], created, skipped };

  const db = (await import('../storage.js')).getState();
  const studentsById = new Map(db.students.map((s) => [s.id, s]));
  const studentsByFull = new Map(db.students.map((s) => [studentFullName(s).toLowerCase(), s]));

  const newMeasurements = [...db.measurements];

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    let studentId = String(r['ID Alumno*'] ?? r['ID Alumno'] ?? '').trim();
    if (!studentId) {
      const fullName = String(r['Alumno (texto)'] ?? r['Alumno'] ?? '').trim().toLowerCase();
      if (!fullName) { errors.push(`Fila ${i + 2}: falta "ID Alumno*" o nombre.`); skipped.push(i + 1); continue; }
      const s = studentsByFull.get(fullName);
      if (!s) { errors.push(`Fila ${i + 2}: el alumno "${fullName}" no existe.`); skipped.push(i + 1); continue; }
      studentId = s.id;
    }
    if (!studentsById.has(studentId)) { errors.push(`Fila ${i + 2}: ID "${studentId}" no corresponde a un alumno.`); skipped.push(i + 1); continue; }

    const dateRaw = r['Fecha (YYYY-MM-DD)*'] ?? r['Fecha (YYYY-MM-DD)'] ?? r['Fecha'];
    const date = normalizeISODate(dateRaw);
    if (!date) { errors.push(`Fila ${i + 2}: fecha inválida.`); skipped.push(i + 1); continue; }

    const record = {
      id: uid('mea'),
      studentId,
      date,
      notes: String(r['Notas'] || '').trim(),
      meta: { createdAt: new Date().toISOString() },
    };
    for (const f of MEASURE_FIELDS) {
      // Try header by label
      const byLabel = r[`${f.label} (${f.unit})`];
      record[f.key] = byLabel === '' || byLabel === undefined || byLabel === null ? null : Number(byLabel);
    }
    newMeasurements.push(record);
    created.push(record);
  }

  if (created.length) {
    (await import('../storage.js')).setState((db) => ({ ...db, measurements: newMeasurements }));
  }
  return { ok: errors.length === 0, errors, created, skipped };
}

/* ===========================================================
   Helpers
   =========================================================== */

function normalizeISODate(v) {
  if (!v) return '';
  if (typeof v === 'number') {
    // Excel serial
    const XLSX = checkXLSX();
    try {
      const d = XLSX.SSF.parse_date_code(v);
      if (d) return `${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`;
    } catch { /* noop */ }
  }
  const s = String(v).trim();
  if (!s) return '';
  // DD/MM/YYYY
  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (m) {
    const dd = m[1].padStart(2, '0');
    const mm = m[2].padStart(2, '0');
    return `${m[3]}-${mm}-${dd}`;
  }
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return '';
}
