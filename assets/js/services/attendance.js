/* ===========================================================
   GymTrack — Attendance service
   =========================================================== */

import { getState, setState } from '../storage.js';
import { uid, todayISO, fmtDateTime, fromISODate } from '../utils.js';

export function listAttendances() {
  return getState().attendances || [];
}

export function findAttendance(id) {
  return listAttendances().find((a) => a.id === id) || null;
}

export function listForStudent(studentId) {
  return listAttendances().filter((a) => a.studentId === studentId);
}

/**
 * Register a single attendance for student on a given date.
 * If a duplicate exists (same student + same date), returns the existing one.
 * `atISO` is an optional ISO timestamp for time-of-day; defaults to now.
 */
export function register({ studentId, dateISO, timeISO, type = 'regular', notes = '' }) {
  const d = dateISO || todayISO();
  const all = listAttendances();
  const dupe = all.find((a) => a.studentId === studentId && a.dateISO === d && a.type === type);
  if (dupe) return dupe;

  const t = timeISO || new Date().toISOString();
  const record = {
    id: uid('att'),
    studentId,
    dateISO: d,
    timeISO: t,
    type,
    notes,
    meta: { createdAt: new Date().toISOString(), isDemo: false },
  };
  setState((db) => ({ ...db, attendances: [...db.attendances, record] }));
  return record;
}

export function updateAttendance(id, patch) {
  setState((db) => ({
    ...db,
    attendances: db.attendances.map((a) =>
      a.id === id ? { ...a, ...patch } : a
    ),
  }));
  return findAttendance(id);
}

export function deleteAttendance(id) {
  setState((db) => ({
    ...db,
    attendances: db.attendances.filter((a) => a.id !== id),
  }));
}

/** Aggregations */
export function countOnDate(dateISO) {
  const target = dateISO || todayISO();
  return listAttendances().filter((a) => a.dateISO === target);
}

export function forStudentThisMonth(studentId, refDate = new Date()) {
  const y = refDate.getFullYear();
  const m = refDate.getMonth();
  return listAttendances().filter((a) => {
    if (a.studentId !== studentId) return false;
    const d = fromISODate(a.dateISO);
    return d && d.getFullYear() === y && d.getMonth() === m;
  });
}

export function forStudentToday(studentId) {
  return listAttendances().filter((a) => a.studentId === studentId && a.dateISO === todayISO());
}

export function lastAttendanceFor(studentId) {
  return listAttendances()
    .filter((a) => a.studentId === studentId)
    .slice()
    .sort((a, b) => (a.dateISO < b.dateISO ? 1 : -1))[0] || null;
}
