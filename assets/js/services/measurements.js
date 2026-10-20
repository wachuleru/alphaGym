/* ===========================================================
   GymTrack — Measurements service
   =========================================================== */

import { getState, setState } from '../storage.js';
import { uid, todayISO } from '../utils.js';

export const MEASURE_FIELDS = [
  { key: 'weightKg', label: 'Peso corporal', unit: 'kg',  icon: 'scale' },
  { key: 'waistCm',  label: 'Cintura',       unit: 'cm',  icon: 'ruler' },
  { key: 'hipCm',    label: 'Cadera',        unit: 'cm',  icon: 'ruler' },
  { key: 'chestCm',  label: 'Pecho',         unit: 'cm',  icon: 'ruler' },
  { key: 'armCm',    label: 'Brazo',         unit: 'cm',  icon: 'ruler' },
  { key: 'thighCm',  label: 'Muslo',         unit: 'cm',  icon: 'ruler' },
];

export const MEASURE_KEYS = MEASURE_FIELDS.map((f) => f.key);

export function getMeasureLabel(key) {
  return MEASURE_FIELDS.find((f) => f.key === key)?.label || key;
}
export function getMeasureUnit(key) {
  return MEASURE_FIELDS.find((f) => f.key === key)?.unit || '';
}

export function listMeasurements() { return getState().measurements || []; }
export function forStudent(studentId) {
  return listMeasurements()
    .filter((m) => m.studentId === studentId)
    .sort((a, b) => (a.date < b.date ? -1 : 1));
}

export function createMeasurement(input = {}) {
  const now = new Date().toISOString();
  const record = {
    id: uid('mea'),
    studentId: input.studentId,
    date: input.date || todayISO(),
    notes: input.notes || '',
    meta: { createdAt: now },
  };
  for (const f of MEASURE_FIELDS) record[f.key] = input[f.key] ?? null;
  setState((db) => ({ ...db, measurements: [...db.measurements, record] }));
  return record;
}

export function updateMeasurement(id, patch) {
  setState((db) => ({
    ...db,
    measurements: db.measurements.map((m) => (m.id === id ? { ...m, ...patch } : m)),
  }));
}

export function deleteMeasurement(id) {
  setState((db) => ({
    ...db,
    measurements: db.measurements.filter((m) => m.id !== id),
  }));
}

/** Get the most recent non-null reading of a specific metric for a student. */
export function lastReading(studentId, key) {
  const list = forStudent(studentId);
  for (let i = list.length - 1; i >= 0; i--) {
    const v = list[i][key];
    if (v !== null && v !== undefined && v !== '') return { value: Number(v), at: list[i].date };
  }
  return null;
}

/** Get the FIRST non-null reading for a given metric within an ISO range [from, to]. */
export function firstReading(studentId, key) {
  const list = forStudent(studentId);
  for (const m of list) {
    const v = m[key];
    if (v !== null && v !== undefined && v !== '') return { value: Number(v), at: m.date };
  }
  return null;
}
