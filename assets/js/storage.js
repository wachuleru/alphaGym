/* ===========================================================
   GymTrack — central localStorage layer
   The ONLY module that talks to localStorage.
   Exposes: load(), save(), getState(), setState(), patchCollection(),
            subscribe(), notify(), exportJSON(), importJSON(),
            wipe(), archiveLegacyIfPresent(), getLegacyArchive(),
            downloadLegacyArchive(), restoreLegacyKey(),
            deleteLegacyArchive()
   =========================================================== */

import { SCHEMA_VERSION, APP_VERSION, APP_NAME, STORAGE_KEY, LEGACY_STORAGE_KEY, ARCHIVE_KEY } from './config.js';

/** Default empty database (schema v2) */
function emptyDB() {
  return {
    meta: {
      version: SCHEMA_VERSION,
      appVersion: APP_VERSION,
      appName: APP_NAME,
      createdAt: new Date().toISOString(),
      lastExportAt: null,
      lastImportAt: null,
    },
    config: {
      weekStartDay: 1,
      currency: 'CLP',
      defaultWeeklyGoal: 2,
      gymName: 'GymTrack',
      theme: 'dark',
    },
    students: [],
    attendances: [],
    exercises: [],
    trainings: [],
    trainingCategories: [],
    measurements: [],
    goals: [],
    payments: [],
    notes: [],
  };
}

/** In-memory mirror */
let _db = null;
const _subs = new Set();
let _saveStatus = 'idle'; // 'idle' | 'saving' | 'error'
let _saveError = null;

function notify() {
  for (const fn of _subs) {
    try { fn(_db); } catch (err) { console.warn('subscriber error', err); }
  }
}

/* ---------- Persistence ---------- */

export function load() {
  if (_db) return _db;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    _db = emptyDB();
    save();
    return _db;
  }
  try {
    const parsed = JSON.parse(raw);
    // Light migration: fill missing collections
    const blank = emptyDB();
    _db = { ...blank, ...parsed };
    _db.meta = { ...blank.meta, ...(parsed.meta || {}) };
    _db.config = { ...blank.config, ...(parsed.config || {}) };
    // Force schema version to current (we don't accept downgrades silently)
    _db.meta.version = SCHEMA_VERSION;
    return _db;
  } catch (err) {
    console.error('Failed to parse storage, resetting', err);
    _db = emptyDB();
    save();
    return _db;
  }
}

export function save() {
  _saveStatus = 'saving';
  _saveError = null;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(_db));
    _saveStatus = 'idle';
    notify();
    return true;
  } catch (err) {
    _saveStatus = 'error';
    _saveError = err;
    console.error('Failed to save to localStorage', err);
    notify();
    return false;
  }
}

export function getSaveStatus() {
  return { status: _saveStatus, error: _saveError };
}

/* ---------- Public state ---------- */

export function getState() {
  if (!_db) load();
  return _db;
}

/** Top-level patch. Auto-saves. */
export function setState(updater) {
  if (!_db) load();
  _db = typeof updater === 'function' ? updater(_db) : updater;
  return save();
}

/** Patch a single collection, auto-saves. Returns updated collection. */
export function patchCollection(name, list) {
  if (!_db) load();
  if (!Array.isArray(list)) throw new Error('patchCollection expects an array');
  _db[name] = list;
  save();
  return list;
}

/** Subscribe to state changes. */
export function subscribe(fn) {
  _subs.add(fn);
  return () => _subs.delete(fn);
}

/* ---------- Backup & restore ---------- */

/** Export a complete snapshot as a stable JSON object. */
export function exportJSON() {
  const db = getState();
  const payload = {
    app: APP_NAME,
    schemaVersion: SCHEMA_VERSION,
    appVersion: APP_VERSION,
    exportedAt: new Date().toISOString(),
    data: db,
  };
  db.meta.lastExportAt = payload.exportedAt;
  save();
  return JSON.stringify(payload, null, 2);
}

/**
 * Validate and apply a backup JSON. Returns { ok, summary, error }.
 * On success, replaces the in-memory state and re-saves.
 * v1 backups are rejected with an actionable error.
 */
export function importJSON(text) {
  let parsed;
  try { parsed = JSON.parse(text); }
  catch (err) { return { ok: false, error: 'Archivo no es JSON válido.' }; }

  if (!parsed || typeof parsed !== 'object') return { ok: false, error: 'Formato inválido.' };
  if (parsed.app !== APP_NAME) return { ok: false, error: 'Este archivo no proviene de ' + APP_NAME + '.' };
  if (typeof parsed.schemaVersion !== 'number') return { ok: false, error: 'Falta versión del esquema.' };
  if (parsed.schemaVersion > SCHEMA_VERSION) return { ok: false, error: 'La versión del archivo es más nueva que la aplicación.' };
  if (parsed.schemaVersion < SCHEMA_VERSION) {
    return {
      ok: false,
      error: 'Este respaldo es de la versión anterior (v1). Ya no es compatible. Descárgalo desde "Datos y configuración → Archivo de la versión anterior (v1)" si todavía está disponible.',
    };
  }

  const data = parsed.data;
  if (!data || typeof data !== 'object') return { ok: false, error: 'Falta sección "data".' };
  const expected = emptyDB();
  // Make sure required collections exist
  for (const k of Object.keys(expected)) {
    if (!(k in data)) data[k] = expected[k];
  }
  // Light schema upgrades could go here.
  const summary = {
    students: (data.students || []).length,
    attendances: (data.attendances || []).length,
    exercises: (data.exercises || []).length,
    trainings: (data.trainings || []).length,
    trainingCategories: (data.trainingCategories || []).length,
    measurements: (data.measurements || []).length,
    goals: (data.goals || []).length,
    payments: (data.payments || []).length,
    notes: (data.notes || []).length,
  };
  data.meta = { ...expected.meta, ...(data.meta || {}), lastImportAt: new Date().toISOString(), version: SCHEMA_VERSION };
  data.config = { ...expected.config, ...(data.config || {}) };

  // Replace and save
  _db = data;
  save();
  return { ok: true, summary, exportedAt: parsed.exportedAt };
}

/** Replace state with demo seed data (only if user explicitly accepts). */
export function installSeed(seedData) {
  if (!_db) load();
  _db = seedData;
  return save();
}

/** Reset everything. */
export function wipe() {
  localStorage.removeItem(STORAGE_KEY);
  _db = emptyDB();
  save();
  return _db;
}

/** Bootstrap demo state by removing any state marked as demo. */
export function removeDemo() {
  if (!_db) load();
  const db = _db;
  const isDemo = (x) => x?.meta?.isDemo;

  // Catalog / global templates: filter by meta.isDemo (they have no studentId).
  db.exercises = (db.exercises || []).filter((x) => !isDemo(x));
  db.trainings = (db.trainings || []).filter((t) => !isDemo(t));
  db.trainingCategories = (db.trainingCategories || []).filter((c) => !isDemo(c));

  // Student-scoped collections: drop demo students, cascade the rest.
  db.students = (db.students || []).filter((s) => !isDemo(s));
  const validStudentIds = new Set(db.students.map((s) => s.id));
  db.attendances = (db.attendances || []).filter((a) => validStudentIds.has(a.studentId));
  db.measurements = (db.measurements || []).filter((m) => validStudentIds.has(m.studentId));
  db.payments = (db.payments || []).filter((p) => validStudentIds.has(p.studentId));
  db.goals = (db.goals || []).filter((g) => validStudentIds.has(g.studentId));
  db.notes = (db.notes || []).filter((n) => validStudentIds.has(n.studentId));
  save();
}

/* ===========================================================
   Schema migration: v1 → v2
   The first time a user lands on schema v2 with a v1 database
   still present, we archive it under ARCHIVE_KEY and remove
   the legacy key. The user is informed via a one-shot modal.
   =========================================================== */

const V1_COLLECTIONS = [
  'students', 'attendances', 'routines', 'routineExercises',
  'performedSessions', 'measurements', 'goals', 'payments', 'notes',
];

/**
 * If a v1 database is present and no v2 exists yet, archive it under
 * ARCHIVE_KEY and remove the legacy key. Returns null when no archive
 * was created.
 *
 * Returns { counts, archivedAt } when archived.
 */
export function archiveLegacyIfPresent() {
  if (typeof localStorage === 'undefined') return null;
  const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
  if (!legacy) return null;
  // If v2 already exists, never touch v1.
  if (localStorage.getItem(STORAGE_KEY)) return null;

  let counts = {};
  try {
    const parsed = JSON.parse(legacy);
    counts = Object.fromEntries(
      V1_COLLECTIONS.map((k) => [k, (parsed[k] || []).length])
    );
  } catch {
    counts = { unreadable: true };
  }

  const archivedAt = new Date().toISOString();
  const payload = {
    app: APP_NAME,
    archivedAt,
    fromSchema: 1,
    reason: 'auto-migrate-to-schema-v2',
    counts,
    raw: legacy, // byte-identical so download restores exactly
  };

  try {
    localStorage.setItem(ARCHIVE_KEY, JSON.stringify(payload));
    localStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch (err) {
    console.error('No se pudo archivar v1', err);
    return null; // leave v1 in place; app still boots fine on empty v2
  }
  return { counts, archivedAt };
}

/** Returns the parsed legacy archive payload, or null. */
export function getLegacyArchive() {
  if (typeof localStorage === 'undefined') return null;
  const raw = localStorage.getItem(ARCHIVE_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

/** Download the v1 archive as a JSON file. */
export function downloadLegacyArchive() {
  const arch = getLegacyArchive();
  if (!arch) return false;
  const date = (arch.archivedAt || '').slice(0, 10) || 'legacy';
  const blob = new Blob([arch.raw || '{}'], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `gymtrack_v1_${date}.json`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 0);
  return true;
}

/** Write the archived v1 payload back to LEGACY_STORAGE_KEY so the
 *  user can open it with the old client. Does NOT touch v2 data. */
export function restoreLegacyKey() {
  if (typeof localStorage === 'undefined') return false;
  const arch = getLegacyArchive();
  if (!arch?.raw) return false;
  try {
    localStorage.setItem(LEGACY_STORAGE_KEY, arch.raw);
    return true;
  } catch (err) {
    console.error('No se pudo restaurar v1', err);
    return false;
  }
}

/** Remove the legacy archive. Irreversible. */
export function deleteLegacyArchive() {
  if (typeof localStorage === 'undefined') return false;
  localStorage.removeItem(ARCHIVE_KEY);
  return true;
}
