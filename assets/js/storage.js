/* ===========================================================
   GymTrack — central localStorage layer
   The ONLY module that talks to localStorage.
   Exposes: load(), save(), getState(), setState(), patchState(),
            subscribe(), notify(), exportJSON(), importJSON(),
            wipe()
   =========================================================== */

import { SCHEMA_VERSION, APP_VERSION, APP_NAME } from './config.js';

const STORAGE_KEY = `gymtrack:db:v${SCHEMA_VERSION}`;

/** Default empty database */
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
    routines: [],
    routineExercises: [],
    performedSessions: [],
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
 */
export function importJSON(text) {
  let parsed;
  try { parsed = JSON.parse(text); }
  catch (err) { return { ok: false, error: 'Archivo no es JSON válido.' }; }

  if (!parsed || typeof parsed !== 'object') return { ok: false, error: 'Formato inválido.' };
  if (parsed.app !== APP_NAME) return { ok: false, error: 'Este archivo no proviene de ' + APP_NAME + '.' };
  if (typeof parsed.schemaVersion !== 'number') return { ok: false, error: 'Falta versión del esquema.' };
  if (parsed.schemaVersion > SCHEMA_VERSION) return { ok: false, error: 'La versión del archivo es más nueva que la aplicación.' };

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
    routines: (data.routines || []).length,
    routineExercises: (data.routineExercises || []).length,
    performedSessions: (data.performedSessions || []).length,
    measurements: (data.measurements || []).length,
    goals: (data.goals || []).length,
    payments: (data.payments || []).length,
    notes: (data.notes || []).length,
  };
  data.meta = { ...expected.meta, ...(data.meta || {}), lastImportAt: new Date().toISOString() };
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
  db.students = (db.students || []).filter((s) => !isDemo(s));
  // And cascade remove any attendance / measurement / etc referencing removed students
  const validStudentIds = new Set(db.students.map((s) => s.id));
  db.attendances = (db.attendances || []).filter((a) => validStudentIds.has(a.studentId));
  db.measurements = (db.measurements || []).filter((m) => validStudentIds.has(m.studentId));
  db.payments = (db.payments || []).filter((p) => validStudentIds.has(p.studentId));
  db.routines = (db.routines || []).filter((r) => validStudentIds.has(r.studentId));
  db.routineExercises = (db.routineExercises || []).filter((e) => validStudentIds.has(e.studentId));
  db.performedSessions = (db.performedSessions || []).filter((p) => validStudentIds.has(p.studentId));
  db.goals = (db.goals || []).filter((g) => validStudentIds.has(g.studentId));
  db.notes = (db.notes || []).filter((n) => validStudentIds.has(n.studentId));
  save();
}
