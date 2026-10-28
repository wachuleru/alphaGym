/* ===========================================================
   ALPHA-FIT — Attendance service (schema v2)
   Each attendance now carries `trainingId` and `entries[]`
   of the workout actually performed that day.
   =========================================================== */

import { getState, setState } from '../storage.js';
import { uid, todayISO, fromISODate } from '../utils.js';
import { listExercises, exerciseMap } from './exercises.js';
import { findTraining } from './trainings.js';
import {
  priorEntriesIndex,
  buildDraftEntries,
  weightDelta,
} from './entries.js';

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
 * Same-day duplicate lookup. Used by the form to flip into edit mode
 * instead of silently dropping the user's input.
 */
export function findAttendanceOn(studentId, dateISO, type = 'regular') {
  if (!studentId || !dateISO) return null;
  return listAttendances().find(
    (a) => a.studentId === studentId && a.dateISO === dateISO && a.type === type
  ) || null;
}

/**
 * Backwards-compatible simple register — used by tests and the seed.
 * Returns the existing record on a same-day same-type dupe (legacy
 * behaviour). Prefer `saveAttendance` for the UI.
 */
export function register({ studentId, dateISO, timeISO, type = 'regular', notes = '' } = {}) {
  const d = dateISO || todayISO();
  const t = timeISO || new Date().toISOString();
  const all = listAttendances();
  const dupe = all.find(
    (a) => a.studentId === studentId && a.dateISO === d && a.type === type
  );
  if (dupe) return dupe;
  const record = {
    id: uid('att'),
    studentId,
    trainingId: null,
    dateISO: d,
    timeISO: t,
    type,
    notes,
    entries: [],
    meta: { createdAt: new Date().toISOString(), isDemo: false },
  };
  setState((db) => ({ ...db, attendances: [record, ...(db.attendances || [])] }));
  return record;
}

export function updateAttendance(id, patch) {
  setState((db) => ({
    ...db,
    attendances: (db.attendances || []).map((a) => (a.id === id ? { ...a, ...patch } : a)),
  }));
  return findAttendance(id);
}

export function deleteAttendance(id) {
  setState((db) => ({
    ...db,
    attendances: (db.attendances || []).filter((a) => a.id !== id),
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

/* ===========================================================
   Schema v2 extras
   =========================================================== */

/**
 * Build the form draft: preloads each training exercise's previous
 * weight/reps/sets/implement for this student. When `trainingId` is null
 * we return an empty list (the trainer then adds exercises manually).
 */
export function draftForAttendance({
  studentId,
  trainingId = null,
  dateISO,
  excludeAttendanceId = null,
} = {}) {
  if (!studentId || !dateISO) return { entries: [] };
  const training = trainingId ? findTraining(trainingId) : null;
  const entries = buildDraftEntries({
    attendances: listAttendances(),
    exercises: listExercises(),
    training,
    studentId,
    dateISO,
    excludeAttendanceId,
  });
  return { entries };
}

/**
 * Single write path for the form. Computes `lastWeightKg` for every entry
 * (idempotent — handles backdating and re-saves).
 *
 * Returns `{ attendance, created }` where created is true on insert.
 */
export function saveAttendance({
  id = null,
  studentId,
  trainingId = null,
  dateISO,
  timeISO = null,
  type = 'regular',
  notes = '',
  entries = [],
} = {}) {
  if (!studentId || !dateISO) throw new Error('Faltan studentId o dateISO.');

  // Use the existing record when id is provided, otherwise fall back to the
  // same-day match so the form transitions from "create" to "edit" naturally.
  let existing = id ? findAttendance(id) : findAttendanceOn(studentId, dateISO, type);
  const created = !existing;

  // Recompute lastWeightKg for every entry from the (post-update) history.
  // We do this in a two-pass approach to keep things simple and pure:
  //   1. Get prior indexes *before* the write, excluding this record.
  //   2. After write, attendance entries are exactly what was passed in.
  // For NEW attendances the prior index already excludes by not matching;
  // for EXISTING we exclude by id during computation.
  const excludeId = existing?.id || null;
  const all = listAttendances();
  const finalDateISO = dateISO;

  const prior = priorEntriesIndex(all, {
    studentId,
    beforeISO: finalDateISO,
    excludeAttendanceId: excludeId,
  });

  const finalEntries = entries.map((e, i) => ({
    id: e.id || uid('ent'),
    exerciseId: e.exerciseId,
    order: i,
    extra: !!e.extra,
    // snapshot fields
    name:         e.name ?? '',
    muscleGroups: Array.isArray(e.muscleGroups) ? [...e.muscleGroups] : [],
    sets:         e.sets ?? '',
    reps:         e.reps ?? '',
    weightKg:     typeof e.weightKg === 'number' ? e.weightKg : (e.weightKg === '' || e.weightKg == null ? null : Number(e.weightKg) || null),
    implement:    e.implement ?? '',
    observation:  e.observation ?? '',
    // baseline for delta
    lastWeightKg: prior.has(e.exerciseId) ? prior.get(e.exerciseId).weightKg : (typeof e.lastWeightKg === 'number' ? e.lastWeightKg : null),
  }));

  // Make sure the displayed `lastWeightKg` matches the *current* typed value
  // when the user re-saves the same attendance without changes (avoids drift).
  const record = {
    id: existing?.id || uid('att'),
    studentId,
    trainingId,
    dateISO,
    timeISO: existing?.timeISO || timeISO || new Date().toISOString(),
    type,
    notes,
    entries: finalEntries,
    meta: existing?.meta || { createdAt: new Date().toISOString() },
  };

  setState((db) => {
    const list = db.attendances || [];
    const next = created ? [record, ...list] : list.map((a) => (a.id === record.id ? record : a));
    return { ...db, attendances: next };
  });

  return { attendance: record, created };
}

/**
 * Attendances for the student, sorted newest first, only those with at
 * least one entry (used by the Workouts tab and reports).
 */
export function attendancesWithEntries(studentId) {
  return listAttendances()
    .filter((a) => a.studentId === studentId && Array.isArray(a.entries) && a.entries.length > 0)
    .slice()
    .sort((a, b) => {
      const k = `${b.dateISO}${b.timeISO || ''}`.localeCompare(`${a.dateISO}${a.timeISO || ''}`);
      return k !== 0 ? k : (b.id > a.id ? 1 : -1);
    });
}

// Re-export the delta helper so service consumers can import from one place.
export { weightDelta };
