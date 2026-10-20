/* ===========================================================
   GymTrack — Trainings service (templates, decoupled from student)
   =========================================================== */

import { getState, setState } from '../storage.js';
import { uid, todayISO } from '../utils.js';
import { listExercises } from './exercises.js';

export function listTrainings({ includeArchived = false } = {}) {
  const all = getState().trainings || [];
  return includeArchived ? all : all.filter((t) => t.status !== 'archived');
}

export function findTraining(id) {
  return (getState().trainings || []).find((t) => t.id === id) || null;
}

export function trainingMap() {
  const m = new Map();
  for (const t of getState().trainings || []) m.set(t.id, t);
  return m;
}

/**
 * Resolve the ordered list of exercise rows for a training, joining against
 * the (active) catalog. Missing catalog entries fall back to a placeholder
 * row so the UI still renders without crashing.
 */
export function exercisesOf(trainingId) {
  const t = findTraining(trainingId);
  if (!t) return [];
  const cat = new Map(listExercises().map((e) => [e.id, e]));
  return (t.exerciseIds || []).map((id, idx) => {
    const ex = cat.get(id);
    return ex
      ? { ...ex, _order: idx }
      : { id, name: 'Ejercicio eliminado', muscleGroups: [], _order: idx, _missing: true };
  });
}

export function createTraining({ name, objective = '', observation = '', exerciseIds = [], status = 'active' } = {}) {
  const t = {
    id: uid('trn'),
    name: name || 'Nuevo entrenamiento',
    objective: objective || '',
    observation: observation || '',
    exerciseIds: Array.isArray(exerciseIds) ? [...exerciseIds] : [],
    status,
    createdAt: todayISO(),
    meta: { createdAt: new Date().toISOString() },
  };
  setState((db) => ({ ...db, trainings: [t, ...(db.trainings || [])] }));
  return t;
}

export function updateTraining(id, patch) {
  setState((db) => ({
    ...db,
    trainings: (db.trainings || []).map((t) =>
      t.id === id
        ? {
            ...t,
            ...patch,
            exerciseIds: Array.isArray(patch.exerciseIds) ? [...patch.exerciseIds] : t.exerciseIds,
          }
        : t
    ),
  }));
  return findTraining(id);
}

/**
 * Hard delete + nullifies the trainingId on attendances that referenced it,
 * so the Workouts tab never renders a dangling name. Past attendance ENTRIES
 * are untouched; their `name`/`muscleGroups` snapshots are preserved.
 */
export function deleteTraining(id) {
  setState((db) => ({
    ...db,
    trainings: (db.trainings || []).filter((t) => t.id !== id),
    attendances: (db.attendances || []).map((a) =>
      a && a.trainingId === id ? { ...a, trainingId: null } : a
    ),
  }));
}
