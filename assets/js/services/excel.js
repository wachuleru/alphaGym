/* ===========================================================
   GymTrack — Excel import / export using SheetJS
   Used only on the client. Works entirely in browser.
   =========================================================== */

import { downloadBlob, uid, todayISO, fmtDate } from '../utils.js';
import { listStudents } from './students.js';
import { listAttendances } from './attendance.js';
import { listMeasurements, MEASURE_FIELDS } from './measurements.js';
import { listPayments } from './payments.js';
import { listRoutines, listRoutineExercises } from './workouts.js';
import { listGoals } from './goals.js';

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
  const rows = listAttendances().map((a) => {
    const s = studentById.get(a.studentId);
    return [
      a.id,
      a.studentId,
      s ? studentFullName(s) : '',
      a.dateISO,
      a.timeISO,
      a.type,
      a.notes,
    ];
  });
  const headers = ['ID', 'ID Alumno', 'Alumno', 'Fecha', 'Hora', 'Tipo', 'Notas'];
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
  const exByRid = new Map();
  for (const e of listRoutineExercises()) {
    if (!exByRid.has(e.routineId)) exByRid.set(e.routineId, []);
    exByRid.get(e.routineId).push(e);
  }
  const headerA = ['ID Rutina', 'ID Alumno', 'Alumno', 'Nombre rutina', 'Objetivo', 'Estado', 'Fecha creación', '# Ejercicios'];
  const headerB = ['ID Rutina', 'ID Alumno', 'Alumno', 'Ejercicio', 'Grupo muscular', 'Series', 'Repeticiones', 'Peso (kg)', 'Descanso (s)', 'Notas'];
  const routines = listRoutines().map((r) => {
    const s = studentById.get(r.studentId);
    return [
      r.id, r.studentId, s ? studentFullName(s) : '', r.name, r.objective, r.status, r.createdAt, (exByRid.get(r.id) || []).length
    ];
  });
  const exercises = [];
  for (const r of listRoutines()) {
    const s = studentById.get(r.studentId);
    for (const e of (exByRid.get(r.id) || [])) {
      exercises.push([r.id, r.studentId, s ? studentFullName(s) : '', e.name, e.muscleGroup, e.sets, e.reps, e.weightKg, e.restSec, e.notes]);
    }
  }
  const wb = checkXLSX().utils.book_new();
  checkXLSX().utils.book_append_sheet(wb, aoaToSheet(headerA, routines), 'Rutinas');
  checkXLSX().utils.book_append_sheet(wb, aoaToSheet(headerB, exercises), 'Ejercicios');
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
