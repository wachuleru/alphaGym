/* ===========================================================
   Training categories service
   A grouping layer ABOVE trainings ("Tren superior", "Full body",
   "Cardio", "Movilidad"). Categories carry no exercises of their
   own — they only organise the routines, and never carry any
   execution data.

   Modelled on exercises.js: managed collection, soft delete.
   =========================================================== */

import { getState, setState } from '../storage.js';
import { uid, todayISO } from '../utils.js';
import { BADGE_TONES } from '../config.js';

export function listCategories({ includeArchived = false } = {}) {
  const all = getState().trainingCategories || [];
  return includeArchived ? all : all.filter((c) => c.status !== 'archived');
}

export function findCategory(id) {
  return (getState().trainingCategories || []).find((c) => c.id === id) || null;
}

export function categoryMap() {
  const m = new Map();
  for (const c of getState().trainingCategories || []) m.set(c.id, c);
  return m;
}

/** Trim + coerce so a category name is always display-safe. */
function normalizeName(name) {
  return String(name || '').trim().slice(0, 60);
}

export function createCategory({ name, observation = '', color = 'accent', status = 'active' } = {}) {
  const cat = {
    id: uid('cat'),
    name: normalizeName(name) || 'Nueva categoría',
    observation: String(observation || '').trim(),
    color: BADGE_TONES.includes(color) ? color : BADGE_TONES[0],
    status,
    createdAt: todayISO(),
    meta: { createdAt: new Date().toISOString() },
  };
  setState((db) => ({ ...db, trainingCategories: [cat, ...(db.trainingCategories || [])] }));
  return cat;
}

export function updateCategory(id, patch) {
  setState((db) => ({
    ...db,
    trainingCategories: (db.trainingCategories || []).map((c) => {
      if (c.id !== id) return c;
      const next = { ...c, ...patch };
      if ('name' in patch) next.name = normalizeName(patch.name) || c.name;
      if ('color' in patch) next.color = BADGE_TONES.includes(patch.color) ? patch.color : c.color;
      if ('observation' in patch) next.observation = String(patch.observation || '').trim();
      return next;
    }),
  }));
  return findCategory(id);
}

/**
 * Soft delete: archives the category and detaches it from the trainings that
 * referenced it (they fall into "Sin categoría"). Trainings themselves are
 * never touched — regrouping must not delete a routine.
 */
export function deleteCategory(id) {
  setState((db) => ({
    ...db,
    trainingCategories: (db.trainingCategories || []).map((c) =>
      c.id === id ? { ...c, status: 'archived' } : c
    ),
    trainings: (db.trainings || []).map((t) =>
      t && t.categoryId === id ? { ...t, categoryId: null } : t
    ),
  }));
}

/**
 * Group trainings by category for display. Trainings with no category (or a
 * dangling one) are collected under `null` so they stay reachable instead of
 * vanishing from the list.
 *
 * Returns [{ category, trainings }] with the uncategorised bucket last.
 */
export function groupTrainingsByCategory(trainings, categories) {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const buckets = new Map();

  for (const t of trainings) {
    const cat = t.categoryId && byId.has(t.categoryId) ? byId.get(t.categoryId) : null;
    const key = cat ? cat.id : null;
    if (!buckets.has(key)) buckets.set(key, { category: cat, trainings: [] });
    buckets.get(key).trainings.push(t);
  }

  const named = [...buckets.entries()].filter(([k]) => k !== null);
  named.sort((a, b) => {
    const an = (a[1].category?.name || '').toLowerCase();
    const bn = (b[1].category?.name || '').toLowerCase();
    return an.localeCompare(bn);
  });

  const groups = named.map(([, v]) => v);
  if (buckets.has(null)) groups.push(buckets.get(null));
  return groups;
}