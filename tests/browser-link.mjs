// Mimic browser module-link phase: try to import every view and check it links.
// SyntaxErrors about missing exports fire here, before any function runs.
import { pathToFileURL } from 'node:url';

const views = [
  'assets/js/views/dashboard.js',
  'assets/js/views/attendance.js',
  'assets/js/views/workouts.js',
  'assets/js/views/students.js',
  'assets/js/views/student-detail.js',
  'assets/js/views/payments.js',
  'assets/js/views/progress.js',
  'assets/js/views/reports.js',
  'assets/js/views/settings.js',
  'assets/js/app.js',
  'assets/js/router.js',
  'assets/js/storage.js',
  'assets/js/services/students.js',
  'assets/js/services/attendance.js',
  'assets/js/services/exercises.js',
  'assets/js/services/trainings.js',
  'assets/js/services/entries.js',
  'assets/js/services/levels.js',
  'assets/js/services/payments.js',
  'assets/js/services/measurements.js',
  'assets/js/services/seed.js',
  'assets/js/services/excel.js',
  'assets/js/services/reports.js',
  'assets/js/services/goals.js',
  'assets/js/services/notes.js',
  'assets/js/charts.js',
  'assets/js/components.js',
  'assets/js/icons.js',
];

let ok = 0, fail = 0;
for (const v of views) {
  try {
    // dynamic import returns a fully-linked module or throws
    await import(pathToFileURL(v).href);
    ok++;
  } catch (e) {
    fail++;
    console.log(`FAIL ${v}`);
    console.log(`  ${e.message}`);
  }
}
console.log(`\n${ok}/${views.length} modules linked successfully.`);
process.exit(fail ? 1 : 0);
