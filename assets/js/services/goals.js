/* ===========================================================
   GymTrack — Goals service
   =========================================================== */

import { getState, setState } from '../storage.js';
import { uid, todayISO } from '../utils.js';

export function listGoals() { return getState().goals || []; }
export function forStudent(studentId) {
  return listGoals().filter((g) => g.studentId === studentId);
}

export function createGoal(input = {}) {
  const record = {
    id: uid('goal'),
    studentId: input.studentId,
    type: input.type || 'custom',       // weight | measurement | attendance | custom
    title: input.title || 'Objetivo',
    description: input.description || '',
    targetValue: input.targetValue ?? null,
    unit: input.unit || '',
    targetDate: input.targetDate || null,
    status: input.status || 'active',   // active | achieved | abandoned
    createdAt: todayISO(),
    meta: { createdAt: new Date().toISOString() },
  };
  setState((db) => ({ ...db, goals: [record, ...db.goals] }));
  return record;
}

export function updateGoal(id, patch) {
  setState((db) => ({
    ...db,
    goals: db.goals.map((g) => (g.id === id ? { ...g, ...patch } : g)),
  }));
}
export function deleteGoal(id) {
  setState((db) => ({ ...db, goals: db.goals.filter((g) => g.id !== id) }));
}
