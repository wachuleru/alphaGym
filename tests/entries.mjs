#!/usr/bin/env node
/* ===========================================================
   GymTrack — tests for pure entry logic
   Run: `node tests/entries.mjs`
   =========================================================== */

import { priorEntriesIndex, buildDraftEntries, weightDelta } from '../assets/js/services/entries.js';

let pass = 0;
let fail = 0;
const failures = [];

function check(name, cond, detail) {
  if (cond) { pass++; }
  else { fail++; failures.push({ name, detail }); console.log('  ✗', name, detail || ''); }
}

function eq(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

/* ---------- Fixtures ---------- */

const EX_PUSH = { id: 'exc_push', name: 'Press banca', muscleGroups: ['brazos'] };
const EX_SQUAT = { id: 'exc_squat', name: 'Sentadilla', muscleGroups: ['piernas', 'core'] };
const TRAINING = {
  id: 'trn_a',
  name: 'Tren superior',
  exerciseIds: ['exc_push', 'exc_squat'],
};

const ATT_PUSH = (overrides = {}) => ({
  id: 'att_1',
  studentId: 'stu_1',
  trainingId: 'trn_a',
  dateISO: '2026-10-10',
  timeISO: '2026-10-10T10:00:00.000Z',
  type: 'regular',
  entries: [
    { id: 'ent_1', exerciseId: 'exc_push',  order: 0, sets: '4', reps: '8', weightKg: 60, implement: 'barra' },
    { id: 'ent_2', exerciseId: 'exc_squat', order: 1, sets: '4', reps: '6', weightKg: 80, implement: 'barra' },
  ],
  ...overrides,
});

console.log('GymTrack — entries.js tests\n');

/* ---------- priorEntriesIndex ---------- */

console.log('priorEntriesIndex');

{
  const hist = [
    ATT_PUSH({ id: 'att_old', dateISO: '2026-09-01', timeISO: '2026-09-01T10:00:00.000Z',
      entries: [{ id: 'e1', exerciseId: 'exc_push', sets: '3', reps: '10', weightKg: 50, implement: 'barra' }] }),
    ATT_PUSH({ id: 'att_mid', dateISO: '2026-10-01', timeISO: '2026-10-01T10:00:00.000Z',
      entries: [{ id: 'e1', exerciseId: 'exc_push', sets: '4', reps: '8', weightKg: 55, implement: 'barra' }] }),
  ];
  const idx = priorEntriesIndex(hist, { studentId: 'stu_1', beforeISO: '2026-10-10' });
  check('returns most recent prior entry per exercise', idx.get('exc_push')?.weightKg === 55,
    `(got ${idx.get('exc_push')?.weightKg})`);
  check('other student excluded', !priorEntriesIndex(hist, { studentId: 'stu_other', beforeISO: '2026-10-10' }).has('exc_push'));
}

{
  const hist = [
    ATT_PUSH({ id: 'att_self', dateISO: '2026-10-09', entries: [{ id: 'e1', exerciseId: 'exc_push', weightKg: 999 }] }),
  ];
  const idx = priorEntriesIndex(hist, { studentId: 'stu_1', beforeISO: '2026-10-15', excludeAttendanceId: 'att_self' });
  check('excludes the attendance being edited', !idx.has('exc_push'),
    `(should be empty, got weight ${idx.get('exc_push')?.weightKg})`);
}

{
  const hist = [
    ATT_PUSH({ id: 'att_same_day', dateISO: '2026-10-10', entries: [{ id: 'e1', exerciseId: 'exc_push', weightKg: 999 }] }),
    ATT_PUSH({ id: 'att_future',  dateISO: '2026-11-01', entries: [{ id: 'e1', exerciseId: 'exc_push', weightKg: 999 }] }),
  ];
  const idx = priorEntriesIndex(hist, { studentId: 'stu_1', beforeISO: '2026-10-10' });
  check('strict beforeISO excludes same day and future', !idx.has('exc_push'));
}

{
  const hist = [
    ATT_PUSH({ id: 'att_a', dateISO: '2026-10-09', timeISO: '2026-10-09T08:00:00.000Z',
      entries: [{ id: 'e1', exerciseId: 'exc_push', weightKg: 40 }] }),
    ATT_PUSH({ id: 'att_b', dateISO: '2026-10-09', timeISO: '2026-10-09T18:00:00.000Z',
      entries: [{ id: 'e1', exerciseId: 'exc_push', weightKg: 50 }] }),
  ];
  const idx = priorEntriesIndex(hist, { studentId: 'stu_1', beforeISO: '2026-10-10' });
  check('same-day tie broken by timeISO (later wins)', idx.get('exc_push')?.weightKg === 50);
}

/* ---------- buildDraftEntries ---------- */

console.log('\nbuildDraftEntries');

{
  const hist = [
    ATT_PUSH({ id: 'att_1', dateISO: '2026-10-10',
      entries: [{ id: 'e1', exerciseId: 'exc_push', sets: '4', reps: '8', weightKg: 60, implement: 'barra' },
                { id: 'e2', exerciseId: 'exc_squat', sets: '4', reps: '6', weightKg: 80, implement: 'barra' }] }),
  ];
  const drafts = buildDraftEntries({
    attendances: hist,
    exercises: [EX_PUSH, EX_SQUAT],
    training: TRAINING,
    studentId: 'stu_1',
    dateISO: '2026-10-17',
  });
  check('preserves training order', drafts[0].exerciseId === 'exc_push' && drafts[1].exerciseId === 'exc_squat');
  check('count equals training length', drafts.length === 2);
  check('prescription copied from history, not catalog', drafts[0].weightKg === 60 && drafts[0].reps === '8');
  check('identity from catalog name', drafts[0].name === 'Press banca');
  check('lastWeightKg mirrors prior weightKg', drafts[0].lastWeightKg === 60);
  check('extra flag false for training-sourced', drafts.every((d) => d.extra === false));
}

{
  const drafts = buildDraftEntries({
    attendances: [],
    exercises: [EX_PUSH, EX_SQUAT],
    training: TRAINING,
    studentId: 'stu_1',
    dateISO: '2026-10-17',
  });
  check('first-ever session → weightKg null', drafts[0].weightKg === null && drafts[0].lastWeightKg === null);
}

{
  const drafts = buildDraftEntries({
    attendances: [],
    exercises: [],
    training: { exerciseIds: ['exc_missing'] },
    studentId: 'stu_1',
    dateISO: '2026-10-17',
  });
  check('missing catalog → identity fallback to "Ejercicio eliminado"', drafts[0].name === 'Ejercicio eliminado');
}

/* ---------- weightDelta ---------- */

console.log('\nweightDelta');

{
  const d = weightDelta(65, 60);
  check('+5 kg case', d.kg === 5 && d.pct === 8 && d.text === '+5 kg · +8%' && d.tone === 'up',
    `(got ${JSON.stringify(d)})`);
}

{
  const d = weightDelta(77.5, 80);
  check('-2.5 kg case (dot, not comma)', d.kg === -2.5 && d.pct === -3 && d.text === '-2.5 kg · -3%' && d.tone === 'down',
    `(got ${JSON.stringify(d)})`);
}

{
  const d = weightDelta(60, 60);
  check('no change', d.kg === 0 && d.text === '0 kg · sin cambio' && d.tone === 'muted',
    `(got ${JSON.stringify(d)})`);
}

{
  const d = weightDelta(5, 0);
  check('prev 0 → kg signed, no percentage', d.kg === 5 && d.pct === null && d.text === '+5 kg' && d.tone === 'up',
    `(got ${JSON.stringify(d)})`);
}

{
  const d = weightDelta(null, 60);
  check('null current → muted "sin registro previo"',
    d.text === '— sin registro previo' && d.tone === 'muted' && d.kg === null,
    `(got ${JSON.stringify(d)})`);
}

{
  const d = weightDelta('65', 60); // string current
  check('accepts string current', d.kg === 5 && d.text === '+5 kg · +8%');
}

{
  const d = weightDelta(65, null);
  check('null previous → muted',
    d.text === '— sin registro previo' && d.tone === 'muted');
}

/* ---------- Report ---------- */

console.log(`\n${fail === 0 ? 'ALL OK' : 'FAILED'}: ${pass} passed, ${fail} failed.`);
process.exit(fail === 0 ? 0 : 1);
