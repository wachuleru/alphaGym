/* ===========================================================
   ALPHA-FIT — Entry logic (pure)
   Preload algorithm, draft assembly, weight delta formatter.

   Pure: only depends on utils.js. No DOM, no localStorage.
   Importable from Node tests without shims.
   =========================================================== */

import { uid } from '../utils.js';

/* ---------- Helpers ---------- */

const num = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const round2 = (n) => Math.round(n * 100) / 100;
const fmtKg = (n) => {
  // dot decimal — toLocaleString('es-CL') renders commas, we don't want that.
  const abs = Math.abs(n);
  return Number.isInteger(abs) ? String(abs) : String(abs);
};

/* ---------- Preload ---------- */

/**
 * Build a Map<exerciseId, mostRecentEntry> for a student, scoped to attendances
 * strictly before `beforeISO` and excluding the attendance being edited.
 *
 * - sorted ascending by dateISO + timeISO lexicographically
 * - first occurrence per exerciseId wins (= most recent)
 */
export function priorEntriesIndex(attendances, { studentId, beforeISO, excludeAttendanceId = null }) {
  const idx = new Map();
  if (!studentId || !beforeISO) return idx;

  const scoped = (attendances || [])
    .filter((a) =>
      a &&
      a.studentId === studentId &&
      a.id !== excludeAttendanceId &&
      typeof a.dateISO === 'string' &&
      a.dateISO < beforeISO &&
      Array.isArray(a.entries)
    )
    .sort((a, b) =>
      `${a.dateISO}${a.timeISO || ''}`.localeCompare(`${b.dateISO}${b.timeISO || ''}`)
    );

  // walk newest (last) → first (oldest); first write wins
  for (let i = scoped.length - 1; i >= 0; i--) {
    const a = scoped[i];
    for (const e of a.entries) {
      if (e && e.exerciseId && !idx.has(e.exerciseId)) {
        idx.set(e.exerciseId, e);
      }
    }
  }
  return idx;
}

/**
 * Assemble draft entries for a new attendance, given a training.
 * Prescription (sets/reps/weightKg/implement) comes only from prior history
 * — never from the catalog. Identity (name/muscleGroups) comes from the
 * catalog when it exists, otherwise from the last snapshot.
 */
export function buildDraftEntries({ attendances, exercises, training, studentId, dateISO, excludeAttendanceId = null }) {
  const catalog = new Map((exercises || []).map((e) => [e.id, e]));
  const prior = priorEntriesIndex(attendances, { studentId, beforeISO: dateISO, excludeAttendanceId });
  const ids = training && Array.isArray(training.exerciseIds) ? training.exerciseIds : [];

  return ids.map((exerciseId, i) => {
    const ex = catalog.get(exerciseId);
    const prev = prior.get(exerciseId);

    return {
      id: uid('ent'),
      exerciseId,
      order: i,
      extra: false,
      // identity from catalog, fallback to last snapshot
      name:         ex?.name         ?? prev?.name         ?? 'Ejercicio eliminado',
      muscleGroups: Array.isArray(ex?.muscleGroups) ? [...ex.muscleGroups] : (Array.isArray(prev?.muscleGroups) ? [...prev.muscleGroups] : []),
      // prescription from history only
      sets:      prev?.sets      ?? '',
      reps:      prev?.reps      ?? '',
      weightKg:  typeof prev?.weightKg === 'number' ? prev.weightKg : null,
      implement: prev?.implement ?? '',
      observation: '',
      lastWeightKg: typeof prev?.weightKg === 'number' ? prev.weightKg : null,
    };
  });
}

/**
 * Draft entry for an exercise the trainer adds on the spot — same field
 * mapping, marked extra, no guaranteed prior history.
 */
export function draftEntryForExercise({ exercise, prior = null }) {
  return {
    id: uid('ent'),
    exerciseId: exercise.id,
    order: 0, // caller re-orders after
    extra: true,
    name: exercise.name || 'Ejercicio',
    muscleGroups: Array.isArray(exercise.muscleGroups) ? [...exercise.muscleGroups] : [],
    sets:      prior?.sets      ?? '',
    reps:      prior?.reps      ?? '',
    weightKg:  typeof prior?.weightKg === 'number' ? prior.weightKg : null,
    implement: prior?.implement ?? '',
    observation: '',
    lastWeightKg: typeof prior?.weightKg === 'number' ? prior.weightKg : null,
  };
}

/* ---------- Delta ---------- */

/**
 * Compute weight delta between current and previous.
 * Decimal with dot. Always emits signed kg. Percentage is integer (rounded).
 *
 * @param {number|string|null} current
 * @param {number|string|null} previous
 * @returns {{ kg: number|null, pct: number|null, text: string, tone: 'up'|'down'|'muted' }}
 */
export function weightDelta(current, previous) {
  const cur = num(current);
  const prev = num(previous);

  if (cur === null || prev === null) {
    return { kg: null, pct: null, text: '— sin registro previo', tone: 'muted' };
  }
  if (cur === prev) {
    return { kg: 0, pct: 0, text: '0 kg · sin cambio', tone: 'muted' };
  }

  const kg = round2(cur - prev);
  const sign = kg > 0 ? '+' : '-';
  const p = prev !== 0 ? Math.round((kg / prev) * 100) : null;
  const pctText = p === null ? '' : ` · ${sign}${Math.abs(p)}%`;

  return {
    kg,
    pct: p,
    text: `${sign}${fmtKg(kg)} kg${pctText}`,
    tone: kg > 0 ? 'up' : 'down',
  };
}
