/* ===========================================================
   GymTrack — Workouts service (routines, exercises, sessions)
   =========================================================== */

import { getState, setState } from '../storage.js';
import { uid, todayISO } from '../utils.js';

/* Routines are templates. Each routine has many routineExercises. */

export function listRoutines() { return getState().routines || []; }
export function listRoutineExercises() { return getState().routineExercises || []; }
export function listPerformedSessions() { return getState().performedSessions || []; }

export function findRoutine(id) { return listRoutines().find((r) => r.id === id) || null; }
export function exercisesOfRoutine(routineId) {
  return listRoutineExercises()
    .filter((e) => e.routineId === routineId)
    .sort((a, b) => (a.order || 0) - (b.order || 0));
}
export function routinesForStudent(studentId) {
  return listRoutines().filter((r) => r.studentId === studentId);
}

/* CRUD Routines */
export function createRoutine({ studentId, name, objective, status = 'active' }) {
  const routine = {
    id: uid('rut'),
    studentId: studentId || null,
    name: name || 'Nueva rutina',
    objective: objective || '',
    status,
    createdAt: todayISO(),
    meta: { createdAt: new Date().toISOString() },
  };
  setState((db) => ({ ...db, routines: [routine, ...db.routines] }));
  return routine;
}

export function updateRoutine(id, patch) {
  setState((db) => ({
    ...db,
    routines: db.routines.map((r) => (r.id === id ? { ...r, ...patch } : r)),
  }));
}

export function deleteRoutine(id) {
  setState((db) => ({
    ...db,
    routines: db.routines.filter((r) => r.id !== id),
    routineExercises: db.routineExercises.filter((e) => e.routineId !== id),
  }));
}

/* CRUD Routine exercises */
export function addExercise(input = {}) {
  const ex = {
    id: uid('exr'),
    routineId: input.routineId,
    name: input.name || 'Ejercicio',
    muscleGroup: input.muscleGroup || '',
    sets: input.sets || '',
    reps: input.reps || '',
    durationSec: input.durationSec || '',
    weightKg: input.weightKg || '',
    restSec: input.restSec || '',
    instructions: input.instructions || '',
    notes: input.notes || '',
    order: input.order || 0,
  };
  setState((db) => ({ ...db, routineExercises: [...db.routineExercises, ex] }));
  return ex;
}

export function updateExercise(id, patch) {
  setState((db) => ({
    ...db,
    routineExercises: db.routineExercises.map((e) => (e.id === id ? { ...e, ...patch } : e)),
  }));
}

export function deleteExercise(id) {
  setState((db) => ({ ...db, routineExercises: db.routineExercises.filter((e) => e.id !== id) }));
}

/* Performed sessions (a routine actually executed) */
export function addPerformedSession(input = {}) {
  const session = {
    id: uid('ses'),
    studentId: input.studentId,
    routineId: input.routineId || null,
    name: input.name || 'Sesión',
    date: input.date || todayISO(),
    durationMin: input.durationMin || '',
    notes: input.notes || '',
    entries: Array.isArray(input.entries) ? input.entries : [],
    meta: { createdAt: new Date().toISOString() },
  };
  setState((db) => ({ ...db, performedSessions: [session, ...db.performedSessions] }));
  return session;
}

export function deletePerformedSession(id) {
  setState((db) => ({ ...db, performedSessions: db.performedSessions.filter((s) => s.id !== id) }));
}

export function sessionsForStudent(studentId) {
  return listPerformedSessions().filter((s) => s.studentId === studentId);
}
