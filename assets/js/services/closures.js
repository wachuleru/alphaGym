/* ===========================================================
   Closures service — justified absences.

   A closure exempts the WEEK that contains it. An exempt week is
   skipped, not forgiven: it does not extend the streak, it does not
   break it, and it leaves the weekly-compliance denominator. That is
   the whole point — a national holiday or a gym closure costs the
   student a session they never had a chance to train.

   Nothing is applied here. `computeStudentMetrics` reads the list on
   every render, so deleting a closure instantly restores the verdict.
   =========================================================== */

import { getState, setState } from '../storage.js';
import { uid, todayISO, toISODate, startOfWeek, addDays, diffDays, isISODate } from '../utils.js';

/** Cap on how long a single closure can span, so a typo can't blank a year. */
const MAX_SPAN_DAYS = 31;

/**
 * The Monday of the week containing `dateISO`, as `YYYY-MM-DD`.
 * Every step goes through the local-date helpers: `new Date('YYYY-MM-DD')`
 * parses as UTC and lands on the previous day in Chile.
 */
export function weekKeyOf(dateISO) {
  return toISODate(startOfWeek(dateISO));
}

export function listClosures() {
  return (getState().closures || [])
    .slice()
    .sort((a, b) => (a.dateISO < b.dateISO ? -1 : 1));
}

export function findClosure(id) {
  return listClosures().find((c) => c.id === id) || null;
}

/**
 * Create a closure. `endISO` is optional and defaults to `dateISO`, which is
 * what a single national holiday wants; a gym shut for a week sets both.
 * Returns `{ ok, closure, error }` so the caller can surface the reason.
 */
export function createClosure({ dateISO, endISO = null, name = '' } = {}) {
  if (!isISODate(dateISO)) return { ok: false, error: 'Indica una fecha válida.' };
  const start = dateISO;
  const end = endISO || dateISO;
  if (!isISODate(end)) return { ok: false, error: 'La fecha de término no es válida.' };
  if (end < start) return { ok: false, error: 'La fecha de término es anterior a la de inicio.' };
  if (diffDays(end, start) > MAX_SPAN_DAYS) {
    return { ok: false, error: `El rango no puede superar ${MAX_SPAN_DAYS} días.` };
  }
  if (listClosures().some((c) => c.dateISO === start)) {
    return { ok: false, error: 'Ya hay un cierre registrado en esa fecha.' };
  }
  const closure = {
    id: uid('clo'),
    dateISO: start,
    endISO: end,
    name: String(name).trim() || 'Justificación',
    createdAt: todayISO(),
    meta: { createdAt: new Date().toISOString() },
  };
  setState((db) => ({ ...db, closures: [...(db.closures || []), closure] }));
  return { ok: true, closure };
}

export function updateClosure(id, patch) {
  setState((db) => ({
    ...db,
    closures: (db.closures || []).map((c) =>
      c.id === id
        ? {
            ...c,
            name: patch.name !== undefined ? String(patch.name).trim() || 'Justificación' : c.name,
            endISO: patch.endISO !== undefined ? (patch.endISO || c.dateISO) : c.endISO,
          }
        : c
    ),
  }));
  return findClosure(id);
}

export function deleteClosure(id) {
  setState((db) => ({ ...db, closures: (db.closures || []).filter((c) => c.id !== id) }));
}

/** Every day a closure covers, as `YYYY-MM-DD`. */
function closureDays(c) {
  const end = c.endISO || c.dateISO;
  const out = [];
  // Bounded by MAX_SPAN_DAYS + 1, so a hand-edited record can't loop forever.
  for (let i = 0; i <= MAX_SPAN_DAYS; i++) {
    const d = toISODate(addDays(c.dateISO, i));
    out.push(d);
    if (d >= end) break;
  }
  return out;
}

/**
 * The set of week keys covered by global closures. Two closures landing in the
 * same week collapse into one — that week is either judged or it is not.
 */
export function closureWeekKeys(closures) {
  const set = new Set();
  for (const c of closures || []) {
    if (!c?.dateISO) continue;
    for (const day of closureDays(c)) set.add(weekKeyOf(day));
  }
  return set;
}