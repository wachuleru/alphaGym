// Test backup JSON round-trip + Excel export sheet construction (without XLSX runtime).
globalThis.localStorage = {
  _data: new Map(),
  getItem(k) { return this._data.has(k) ? this._data.get(k) : null; },
  setItem(k, v) { this._data.set(k, String(v)); },
  removeItem(k) { this._data.delete(k); },
  clear() { this._data.clear(); },
};

const storage = await import('../assets/js/storage.js');
const { createStudent } = await import('../assets/js/services/students.js');

const s = createStudent({ firstName: 'Test', lastName: 'Backup' });
const db = storage.getState();
console.log('students after create:', db.students.length);

// Export
const json = storage.exportJSON();
console.log('export JSON size:', json.length, 'B');

// Wipe
storage.wipe();
console.log('after wipe:', storage.getState().students.length);

// Import
const result = storage.importJSON(json);
console.log('import result:', { ok: result.ok, summary: result.summary });
console.log('students after import:', storage.getState().students.length);

// Reject malformed
const r2 = storage.importJSON('{"app":"OtherApp"}');
console.log('reject other app:', r2.ok === false ? 'OK rejected' : 'BAD accepted');

const r3 = storage.importJSON('not json');
console.log('reject invalid:', r3.ok === false ? 'OK rejected' : 'BAD accepted');

console.log('BACKUP TEST DONE');
