/* ===========================================================
   ALPHA-FIT — Students service
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
    // Week keys (the Monday, YYYY-MM-DD) excused from streak and compliance,
    // for absences a global closure can't cover: illness, travel, permission.
    exemptWeeks: Array.isArray(input.exemptWeeks) ? [...input.exemptWeeks] : [],
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

/** Week keys excused for this student, ascending. */
export function exemptWeeksOf(student) {
  return [...(student?.exemptWeeks || [])].sort();
}

/**
 * Excuse (or re-impose) a week for one student. Storing the Monday rather than
 * the date picked in the UI keeps this idempotent: any day of the same week
 * resolves to the same key, so the caller never has to normalise first.
 * Returns the updated student, or null when the week key is malformed.
 */
export function setWeekExempt(studentId, weekKey, exempt = true) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(weekKey || ''))) return null;
  const patch = {};
  if (exempt) {
    const current = exemptWeeksOf(findStudent(studentId));
    if (!current.includes(weekKey)) current.push(weekKey);
    patch.exemptWeeks = current;
  } else {
    patch.exemptWeeks = exemptWeeksOf(findStudent(studentId)).filter((w) => w !== weekKey);
  }
  return updateStudent(studentId, patch);
}
