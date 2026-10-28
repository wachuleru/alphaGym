/* ===========================================================
   ALPHA-FIT — Notes service (private, NOT exported in reports by default)
   =========================================================== */

import { getState, setState } from '../storage.js';
import { uid } from '../utils.js';

export function listNotes() { return getState().notes || []; }
export function forStudent(studentId) {
  return listNotes().filter((n) => n.studentId === studentId)
    .slice()
    .sort((a, b) => (a.createdAt > b.createdAt ? -1 : 1));
}

export function createNote(input = {}) {
  const now = new Date().toISOString();
  const record = {
    id: uid('nt'),
    studentId: input.studentId,
    author: input.author || 'admin',
    category: input.category || 'general',
    body: input.body || '',
    shared: !!input.shared, // when true, included in reports when explicitly chosen
    createdAt: now,
    updatedAt: now,
  };
  setState((db) => ({ ...db, notes: [record, ...db.notes] }));
  return record;
}

export function updateNote(id, patch) {
  setState((db) => ({
    ...db,
    notes: db.notes.map((n) => (n.id === id ? { ...n, ...patch, updatedAt: new Date().toISOString() } : n)),
  }));
}

export function deleteNote(id) {
  setState((db) => ({ ...db, notes: db.notes.filter((n) => n.id !== id) }));
}
