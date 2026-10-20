// Real logic test — exercises the levels engine, payments, student metrics.
// We patch localStorage with a minimal in-memory shim so storage.js can run.

globalThis.localStorage = {
  _data: new Map(),
  getItem(k) { return this._data.has(k) ? this._data.get(k) : null; },
  setItem(k, v) { this._data.set(k, String(v)); },
  removeItem(k) { this._data.delete(k); },
  clear() { this._data.clear(); },
};

const { listStudents, createStudent, fullName } = await import('../assets/js/services/students.js');
const { register, listAttendances } = await import('../assets/js/services/attendance.js');
const { createPayment, markPaid, listPayments, totalReceivedInMonth } = await import('../assets/js/services/payments.js');
const { computeStudentMetrics, determineLevel, progressToNext, earnedBadges } = await import('../assets/js/services/levels.js');
const { buildSeed } = await import('../assets/js/services/seed.js');
const { createExercise, findExercise, deleteExercise } = await import('../assets/js/services/exercises.js');
const { createTraining, findTraining, exercisesOf, deleteTraining, listTrainings, updateTraining } = await import('../assets/js/services/trainings.js');
const { createCategory, findCategory, listCategories, updateCategory, deleteCategory, groupTrainingsByCategory } =
  await import('../assets/js/services/categories.js');
const { saveAttendance, findAttendance, findAttendanceOn, draftForAttendance, attendancesWithEntries } =
  await import('../assets/js/services/attendance.js');

/* ---------- Tiny assertion harness ---------- */
let passed = 0, failed = 0;
function ok(cond, label) {
  if (cond) { passed++; }
  else { failed++; console.log('  FAIL:', label); }
}
function eq(a, b, label) { ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`); }

const stu = createStudent({ firstName: 'Camila', lastName: 'Rojas', weeklyGoal: 2 });
console.log('created:', stu.id, fullName(stu));

// Register 12 attendances over 6 weeks (2 per week)
const today = new Date();
for (let w = 5; w >= 0; w--) {
  for (let d = 0; d < 2; d++) {
    const date = new Date(today);
    date.setDate(date.getDate() - w * 7 - d);
    register({ studentId: stu.id, dateISO: date.toISOString().slice(0, 10) });
  }
}
console.log('attendances:', listAttendances().length);

const metrics = computeStudentMetrics(stu, listAttendances());
console.log('metrics:', { total: metrics.totalAttendances, streak: metrics.streakWeeks, compliance: metrics.weeklyCompliance });

const level = determineLevel(metrics);
console.log('level:', level.name);

const progress = progressToNext(metrics);
console.log('progress to next:', (progress * 100).toFixed(0) + '%');

const badges = earnedBadges(metrics);
console.log('badges:', badges.map((b) => b.name));

// Payment flow
const p = createPayment({ studentId: stu.id, period: 'Oct 2026', amount: 35000, dueDate: '2026-10-31', status: 'pending' });
markPaid(p.id, 'Transferencia');
const sum = totalReceivedInMonth(2026, 9);
console.log('payments:', listPayments().length, 'received Oct 2026:', sum);

// Build seed and verify it produces data
const seed = buildSeed();
console.log('seed produced students:', seed.students.length);
console.log('seed produced attendances:', seed.attendances.length);

/* ============================================================
   Schema v2 — catálogo, entrenamientos y entradas de asistencia
   ============================================================ */
console.log('\n--- schema v2 ---');

const bench = createExercise({ name: 'Press banca', muscleGroups: ['brazos', 'espalda'], observation: 'Banco plano' });
const squat = createExercise({ name: 'Sentadilla', muscleGroups: ['piernas'] });
const trn = createTraining({ name: 'Tren A', objective: 'Fuerza', exerciseIds: [squat.id, bench.id] });
eq(exercisesOf(trn.id).length, 2, 'exercisesOf returns the 2 training exercises');
eq(exercisesOf(trn.id)[0].id, squat.id, 'exercisesOf preserves the declared order');

const S2 = '2026-03-';
const mkEntries = (kg) => ([
  { exerciseId: squat.id, sets: '5', reps: '5', weightKg: kg, implement: 'barra', name: squat.name, muscleGroups: squat.muscleGroups },
  { exerciseId: bench.id, sets: '4', reps: '8', weightKg: 50, implement: 'barra', name: bench.name, muscleGroups: bench.muscleGroups, extra: true },
]);

/* 1) Round-trip de entradas ------------------------------------ */
const a1 = saveAttendance({ studentId: stu.id, trainingId: trn.id, dateISO: S2 + '01', entries: mkEntries(60) });
ok(a1.created, 'saveAttendance creates a new record');
const r1 = findAttendance(a1.attendance.id);
eq(r1.entries.length, 2, 'entries survive the round-trip');
eq(r1.entries[0].exerciseId, squat.id, 'entry keeps its exerciseId');
eq(r1.entries[0].weightKg, 60, 'entry keeps its weightKg');
eq(r1.entries[0].name, 'Sentadilla', 'entry snapshots the exercise name');
eq(r1.entries[0].lastWeightKg, null, 'first-ever entry has no baseline');
eq(r1.entries[1].extra, true, 'one-off entry keeps extra:true');
eq(r1.entries[0].order, 0, 'entries are ordered by position');
eq(r1.entries[1].order, 1, 'entries are ordered by position (2nd)');

/* 2) Dupe del mismo día → edita, no duplica ------------------- */
const dupe = saveAttendance({ studentId: stu.id, trainingId: trn.id, dateISO: S2 + '01', entries: mkEntries(65) });
eq(dupe.created, false, 'same-day save flips into edit mode');
eq(dupe.attendance.id, a1.attendance.id, 'same-day save reuses the record id');
eq(listAttendances().filter((a) => a.studentId === stu.id && a.dateISO === S2 + '01').length, 1,
  'same-day save does not create a duplicate attendance');
eq(findAttendance(a1.attendance.id).entries[0].weightKg, 65, 'same-day save overwrites the entries');
eq(findAttendanceOn(stu.id, S2 + '01', 'regular').id, a1.attendance.id, 'findAttendanceOn finds it');

/* 3) lastWeightKg se recalcula al guardar (backdating) -------- */
const a2 = saveAttendance({ studentId: stu.id, trainingId: trn.id, dateISO: S2 + '08', entries: mkEntries(70) });
eq(findAttendance(a2.attendance.id).entries[0].lastWeightKg, 65, 'baseline picks the most recent prior session');

// Backdating: register the earlier session AFTER the later one, then re-save.
const a3 = saveAttendance({ studentId: stu.id, trainingId: trn.id, dateISO: S2 + '05', entries: mkEntries(62) });
eq(findAttendance(a3.attendance.id).entries[0].lastWeightKg, 65,
  'a session backdated between two others still resolves its baseline');
const again = saveAttendance({ id: a2.attendance.id, studentId: stu.id, trainingId: trn.id, dateISO: S2 + '08', entries: mkEntries(70) });
eq(findAttendance(again.attendance.id).entries[0].lastWeightKg, 62,
  're-saving recomputes the baseline after backdating (not frozen at creation)');
const again2 = saveAttendance({ id: a2.attendance.id, studentId: stu.id, trainingId: trn.id, dateISO: S2 + '08', entries: mkEntries(70) });
eq(findAttendance(again2.attendance.id).entries[0].lastWeightKg, 62, 're-saving is idempotent (no drift)');

/* 4) El borrador precarga desde el historial ------------------ */
const draft = draftForAttendance({ studentId: stu.id, dateISO: S2 + '15', trainingId: null });
eq(draft.entries.length, 0, 'draft without a training is empty');
const draft2 = draftForAttendance({ studentId: stu.id, dateISO: S2 + '15', trainingId: trn.id });
eq(draft2.entries.length, 2, 'draft with a training has one entry per training exercise');
eq(draft2.entries[0].exerciseId, squat.id, 'draft follows the training order');
eq(draft2.entries[0].lastWeightKg, 70, 'draft carries the most recent weight as baseline');

eq(attendancesWithEntries(stu.id).length, 3, 'attendancesWithEntries filters and sorts');

/* 5) El historial sobrevive al borrado del catálogo ---------- */
deleteExercise(bench.id);
eq(findExercise(bench.id)?.status, 'archived', 'deleteExercise soft-archives');
eq(findAttendance(a1.attendance.id).entries[1].name, 'Press banca',
  'historical entry still renders its snapshotted name after the catalog row is archived');

/* 6) Borrar un entrenamiento nulifica trainingId ------------- */
deleteTraining(trn.id);
eq(findAttendance(a2.attendance.id).trainingId, null, 'deleteTraining nullifies trainingId on past attendances');
eq(findAttendance(a2.attendance.id).entries.length, 2, 'deleteTraining leaves the executed entries intact');

/* 7) Categorías: CRUD ---------------------------------------- */
console.log('\n--- categorías ---');

const catSuperior = createCategory({ name: 'Tren superior', observation: 'Empuje y tirón', color: 'accent' });
const catInferior = createCategory({ name: 'Tren inferior', color: 'info' });
eq(listCategories().length, 2, 'createCategory adds to the collection');
eq(findCategory(catSuperior.id).name, 'Tren superior', 'findCategory resolves by id');
eq(findCategory(catSuperior.id).color, 'accent', 'category keeps its badge tone');
eq(createCategory({ name: '  Con espacios  ', color: 'inventado' }).color, 'accent',
  'unknown tone falls back to the first BADGE_TONE');
eq(listCategories().some((c) => c.name === 'Con espacios'), true, 'category name is trimmed');

// Two trainings, one in each category, one with none at all.
const tSup = createTraining({ name: 'Superior A', categoryId: catSuperior.id, exerciseIds: [bench.id] });
const tInf = createTraining({ name: 'Inferior A', categoryId: catInferior.id, exerciseIds: [squat.id] });
const tLibre = createTraining({ name: 'Sin categoría', exerciseIds: [squat.id] });
eq(findTraining(tSup.id).categoryId, catSuperior.id, 'createTraining persists categoryId');
eq(findTraining(tLibre.id).categoryId, null, 'a training without category stores null, not undefined');

eq(listTrainings({ categoryId: catSuperior.id }).length, 1, 'listTrainings filters by categoryId');
eq(listTrainings({ categoryId: catInferior.id })[0].id, tInf.id, 'the filter returns the right training');
eq(listTrainings({ categoryId: null }).length, 1, 'categoryId:null is a real filter ("Sin categoría")');
eq(listTrainings({ categoryId: null })[0].id, tLibre.id, '"Sin categoría" returns the uncategorised one');
eq(listTrainings().length, 3, 'omitting categoryId does not filter at all');

updateTraining(tSup.id, { name: 'Superior A' });
eq(findTraining(tSup.id).categoryId, catSuperior.id, 'updateTraining without categoryId keeps the old one');
updateTraining(tSup.id, { categoryId: null });
eq(findTraining(tSup.id).categoryId, null, 'updateTraining can detach a training to "Sin categoría"');
updateTraining(tSup.id, { categoryId: catSuperior.id });

updateCategory(catSuperior.id, { name: 'Superior' });
eq(findCategory(catSuperior.id).name, 'Superior', 'updateCategory renames');

/* 8) Agrupación para la vista de entrenamientos --------------- */
// `catSuperior` was renamed to "Superior" above, which sorts before "Tren inferior".
const groups = groupTrainingsByCategory(listTrainings(), listCategories());
eq(groups.length, 3, 'groupTrainingsByCategory makes one bucket per used category plus the uncategorised one');
eq(groups[0].category.name, 'Superior', 'named groups sort alphabetically');
eq(groups[1].category.name, 'Tren inferior', 'named groups sort alphabetically (2nd)');
eq(groups[2].category, null, 'the uncategorised bucket is always last');
eq(groups[2].trainings.map((t) => t.id).includes(tLibre.id), true,
  'an uncategorised training stays reachable instead of vanishing');
eq(groups[0].trainings.length, 1, 'each bucket only holds its own trainings');

// A training pointing at a deleted category must fall into the safe bucket.
updateTraining(tInf.id, { categoryId: 'cat_inexistente' });
const dangling = groupTrainingsByCategory(listTrainings(), listCategories());
eq(dangling[dangling.length - 1].trainings.map((t) => t.id).includes(tInf.id), true,
  'a dangling categoryId falls back to "Sin categoría" rather than disappearing');
updateTraining(tInf.id, { categoryId: catInferior.id });

/* 9) Borrar una categoría NO borra entrenamientos -------------- */
deleteCategory(catInferior.id);
eq(findCategory(catInferior.id)?.status, 'archived', 'deleteCategory soft-archives');
eq(listCategories().some((c) => c.id === catInferior.id), false, 'archived categories leave the active list');
eq(findCategory(catInferior.id)?.name, 'Tren inferior', 'the archived record is still on disk');
eq(findTraining(tInf.id).categoryId, null, 'trainings are detached to "Sin categoría"');
eq(findTraining(tInf.id).name, 'Inferior A', 'regrouping never deletes a training');
eq(listTrainings().length, 3, 'all trainings survive the category deletion');

/* 10) Los datos demo traen la capa de categorías --------------- */
eq(seed.trainingCategories.length, 3, 'demo seeds 3 categories');
const seedCatIds = new Set(seed.trainingCategories.map((c) => c.id));
eq(seed.trainings.filter((t) => t.categoryId && seedCatIds.has(t.categoryId)).length, 3,
  'demo trainings point at real category ids');
eq(seed.trainings.some((t) => t.categoryId === null), true,
  'demo keeps one uncategorised training so the "Sin categoría" bucket is visible');
eq(groupTrainingsByCategory(seed.trainings, seed.trainingCategories).length, 4,
  'the demo groups into 3 named buckets + "Sin categoría"');

console.log(`\n${failed === 0 ? 'ALL OK' : 'FAILURES'}: ${passed} passed, ${failed} failed.`);
