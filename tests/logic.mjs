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

console.log('ALL OK');
