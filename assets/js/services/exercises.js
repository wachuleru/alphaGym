/* ===========================================================
   GymTrack — Exercises service (catalog)
   =========================================================== */

import { getState, setState } from '../storage.js';
import { uid, todayISO } from '../utils.js';

export function listExercises({ includeArchived = false } = {}) {
  const all = getState().exercises || [];
  return includeArchived ? all : all.filter((e) => e.status !== 'archived');
}

export function findExercise(id) {
  return (getState().exercises || []).find((e) => e.id === id) || null;
}

export function exerciseMap() {
  const m = new Map();
  for (const e of getState().exercises || []) m.set(e.id, e);
  return m;
}

export function createExercise({ name, observation = '', muscleGroups = [], status = 'active' } = {}) {
  const ex = {
    id: uid('exc'),
    name: name || 'Ejercicio',
    observation: observation || '',
    muscleGroups: Array.isArray(muscleGroups) ? [...muscleGroups] : [],
    status,
    createdAt: todayISO(),
    meta: { createdAt: new Date().toISOString() },
  };
  setState((db) => ({ ...db, exercises: [ex, ...(db.exercises || [])] }));
  return ex;
}

export function updateExercise(id, patch) {
  setState((db) => ({
    ...db,
    exercises: (db.exercises || []).map((e) =>
      e.id === id
        ? {
            ...e,
            ...patch,
            muscleGroups: patch.muscleGroups
              ? (Array.isArray(patch.muscleGroups) ? [...patch.muscleGroups] : [])
              : e.muscleGroups,
          }
        : e
    ),
  }));
  return findExercise(id);
}

/**
 * Soft-ish delete: archives the catalog row but keeps the snapshots in past
 * attendance entries intact (history never rots). The trainer sees a confirm
 * message stating this.
 */
export function deleteExercise(id) {
  setState((db) => ({
    ...db,
    exercises: (db.exercises || []).map((e) =>
      e.id === id ? { ...e, status: 'archived' } : e
    ),
  }));
}
