/* ===========================================================
   GymTrack — Students service
   =========================================================== */

import { getState, setState } from '../storage.js';
import { uid, todayISO } from '../utils.js';
import { DEFAULT_WEEKLY_GOAL } from '../config.js';

export function listStudents() {
  return getState().students || [];
}
export function findStudent(id) {
  return listStudents().find((s) => s.id === id) || null;
}

export function createStudent(input = {}) {
  const now = new Date().toISOString();
  const student = {
    id: uid('stu'),
    firstName: input.firstName?.trim() || 'Sin nombre',
    lastName:  input.lastName?.trim()  || '',
    sex:       (input.sex === 'F' || input.sex === 'M') ? input.sex : '',
    phone:     input.phone?.trim()     || '',
    email:     input.email?.trim()     || '',
    birthdate: input.birthdate || '',
    heightCm:  Number(input.heightCm) > 0 ? Number(input.heightCm) : null,
    joinedAt:  input.joinedAt  || todayISO(),
    status:    input.status    || 'active',
    mainGoal:  input.mainGoal  || '',
    weeklyGoal: Number(input.weeklyGoal) > 0 ? Number(input.weeklyGoal) : DEFAULT_WEEKLY_GOAL,
    preferredTimes: input.preferredTimes || '',
    notes: '',
    membershipStart:  input.membershipStart  || null,
    membershipEnd:    input.membershipEnd    || null,
    meta: { createdAt: now, updatedAt: now, isDemo: !!input.isDemo },
  };
  setState((db) => ({ ...db, students: [student, ...db.students] }));
  return student;
}

export function updateStudent(id, patch) {
  setState((db) => ({
    ...db,
    students: db.students.map((s) =>
      s.id === id ? { ...s, ...patch, meta: { ...(s.meta || {}), updatedAt: new Date().toISOString() } } : s
    ),
  }));
  return findStudent(id);
}

export function setStudentStatus(id, status) {
  return updateStudent(id, { status });
}

export function deleteStudent(id) {
  setState((db) => {
    const students = db.students.filter((s) => s.id !== id);
    return { ...db, students };
  });
}

export function fullName(s) {
  if (!s) return '';
  return [s.firstName, s.lastName].filter(Boolean).join(' ').trim();
}
