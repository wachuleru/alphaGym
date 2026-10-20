/* ===========================================================
   GymTrack — Payments service
   =========================================================== */

import { getState, setState } from '../storage.js';
import { uid, todayISO, fmtDate, fromISODate, addMonths, toISODate, diffDays } from '../utils.js';

export function listPayments() { return getState().payments || []; }
export function forStudent(studentId) {
  return listPayments().filter((p) => p.studentId === studentId)
    .slice().sort((a, b) => (a.dueDate < b.dueDate ? 1 : -1));
}

export function findPayment(id) {
  return listPayments().find((p) => p.id === id) || null;
}

export function createPayment(input = {}) {
  const record = {
    id: uid('pay'),
    studentId: input.studentId,
    period: input.period || '',          // "Marzo 2026"
    amount: Number(input.amount) || 0,
    dueDate: input.dueDate || todayISO(),
    status: input.status || 'pending',   // pending | paid | overdue
    paidAt: input.paidAt || null,
    method: input.method || '',
    notes: input.notes || '',
    meta: { createdAt: new Date().toISOString() },
  };
  setState((db) => ({ ...db, payments: [record, ...db.payments] }));
  return record;
}

export function updatePayment(id, patch) {
  setState((db) => ({
    ...db,
    payments: db.payments.map((p) => (p.id === id ? { ...p, ...patch } : p)),
  }));
  // Auto-correct overdue status
  setState((db) => ({
    ...db,
    payments: db.payments.map((p) => {
      if (p.id !== id) return p;
      if (p.status === 'pending' && p.dueDate && diffDays(todayISO(), p.dueDate) < 0) {
        return { ...p, status: 'overdue' };
      }
      return p;
    }),
  }));
  return findPayment(id);
}

export function deletePayment(id) {
  setState((db) => ({ ...db, payments: db.payments.filter((p) => p.id !== id) }));
}

export function markPaid(id, method = '', paidAt = null) {
  return updatePayment(id, {
    status: 'paid',
    paidAt: paidAt || new Date().toISOString(),
    method,
  });
}

/** Auto-flag any pending whose due date is in the past. */
export function refreshOverdueFlags() {
  setState((db) => {
    const today = todayISO();
    return {
      ...db,
      payments: db.payments.map((p) => {
        if (p.status === 'pending' && p.dueDate && diffDays(today, p.dueDate) < 0) {
          return { ...p, status: 'overdue' };
        }
        return p;
      }),
    };
  });
}

export function totalReceivedInMonth(year, month) {
  return listPayments()
    .filter((p) => p.status === 'paid' && p.paidAt)
    .filter((p) => {
      const d = fromISODate(p.dueDate);
      return d && d.getFullYear() === year && d.getMonth() === month;
    })
    .reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
}

export function totalReceivedInRange(fromISO, toISO) {
  return listPayments()
    .filter((p) => p.status === 'paid' && p.paidAt)
    .filter((p) => p.dueDate >= fromISO && p.dueDate <= toISO)
    .reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
}

export function totalPending() {
  return listPayments()
    .filter((p) => p.status === 'pending')
    .reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
}

export function totalOverdue() {
  return listPayments()
    .filter((p) => p.status === 'overdue')
    .reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
}

export function nextDueFor(studentId) {
  return forStudent(studentId).find((p) => p.status === 'pending' || p.status === 'overdue') || null;
}

/** Convenience: generate next monthly payment for a student. */
export function generateNextMonthly(studentId, amount, anchorISO) {
  const baseDue = anchorISO ? fromISODate(anchorISO) : new Date();
  const next = addMonths(baseDue, 1);
  const period = `${['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'][next.getMonth()]} ${next.getFullYear()}`;
  return createPayment({
    studentId,
    period,
    amount,
    dueDate: toISODate(next),
    status: 'pending',
  });
}
