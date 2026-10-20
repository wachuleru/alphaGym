/* ===========================================================
   GymTrack — Seed demo data
   Marked with `meta.isDemo` so the user can later wipe it.
   =========================================================== */

import { uid, todayISO, toISODate, addDays, fmtDate } from '../utils.js';
import { DEFAULT_WEEKLY_GOAL } from '../config.js';

const DEMO_NAMES = [
  ['Camila', 'Rojas'],
  ['Diego', 'Pérez'],
  ['Valentina', 'Salinas'],
  ['Joaquín', 'Muñoz'],
  ['Francisca', 'Lagos'],
  ['Matías', 'Bravo'],
  ['Renata', 'Castillo'],
  ['Sebastián', 'Tapia'],
  ['Isidora', 'Vergara'],
  ['Felipe', 'Contreras'],
  ['Macarena', 'Soto'],
  ['Tomás', 'Leiva'],
  ['Constanza', 'Araya'],
  ['Ignacio', 'Fuentes'],
];

const DEMO_GOALS = [
  'Mejorar resistencia cardiovascular',
  'Tonificar tren superior',
  'Bajar grasa corporal',
  'Aumentar fuerza en sentadilla',
  'Mejorar movilidad y postura',
  'Preparación para competencia',
  'Ganar masa muscular',
  'Mantener estado físico actual',
];

const ROUTINES_DEMO = [
  {
    name: 'Tren superior · fuerza',
    objective: 'Hipertrofia',
    muscleGroups: ['pecho', 'espalda', 'brazos', 'hombros'],
    exercises: [
      { name: 'Press banca',          muscleGroup: 'Pecho',     sets: 4, reps: '8-10', restSec: 90 },
      { name: 'Remo con barra',       muscleGroup: 'Espalda',   sets: 4, reps: '8-10', restSec: 90 },
      { name: 'Press militar',        muscleGroup: 'Hombros',   sets: 3, reps: '10-12', restSec: 60 },
      { name: 'Curl bíceps',          muscleGroup: 'Brazos',    sets: 3, reps: '12', restSec: 45 },
      { name: 'Tríceps polea',        muscleGroup: 'Brazos',    sets: 3, reps: '12', restSec: 45 },
    ],
  },
  {
    name: 'Tren inferior · potencia',
    objective: 'Fuerza',
    muscleGroups: ['cuádriceps', 'femorales', 'glúteos', 'gemelos'],
    exercises: [
      { name: 'Sentadilla',           muscleGroup: 'Cuádriceps',sets: 5, reps: '5', restSec: 120, weightKg: 60 },
      { name: 'Peso muerto rumano',   muscleGroup: 'Femorales', sets: 4, reps: '6-8', restSec: 90 },
      { name: 'Prensa',               muscleGroup: 'Cuádriceps',sets: 4, reps: '10', restSec: 90 },
      { name: 'Hip thrust',           muscleGroup: 'Glúteos',   sets: 4, reps: '8-10', restSec: 90 },
      { name: 'Elevación gemelos',    muscleGroup: 'Gemelos',   sets: 4, reps: '15', restSec: 45 },
    ],
  },
  {
    name: 'Full body · resistencia',
    objective: 'Resistencia',
    muscleGroups: ['cuerpo completo'],
    exercises: [
      { name: 'Kettlebell swings',    muscleGroup: 'Cuerpo completo', sets: 4, reps: '20', restSec: 45 },
      { name: 'Burpees',              muscleGroup: 'Cuerpo completo', sets: 4, reps: '12', restSec: 45 },
      { name: 'Plancha',              muscleGroup: 'Core',             sets: 3, reps: '45s', restSec: 30 },
      { name: 'Sentadilla goblet',    muscleGroup: 'Cuerpo completo', sets: 4, reps: '15', restSec: 45 },
      { name: 'Remo TRX',             muscleGroup: 'Espalda',          sets: 3, reps: '12', restSec: 45 },
    ],
  },
];

function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function pick(arr) { return arr[rand(0, arr.length - 1)]; }

function genAttendancesForStudent(studentId, weeks = 14, sessionsPerWeek = [0, 0, 1, 1, 2, 2, 3]) {
  const out = [];
  const today = new Date();
  for (let w = weeks; w >= 0; w--) {
    const target = new Date(today);
    target.setDate(target.getDate() - (w * 7 + rand(0, 6)));
    const sessions = pick(sessionsPerWeek);
    for (let s = 0; s < sessions; s++) {
      const d = new Date(target);
      d.setDate(d.getDate() + s);
      if (d > today) continue;
      out.push({
        id: uid('att'),
        studentId,
        dateISO: toISODate(d),
        timeISO: `2026-01-01T${String(rand(6, 21)).padStart(2,'0')}:${rand(0,1) ? '00' : '30'}:00.000Z`,
        type: 'regular',
        notes: '',
        meta: { createdAt: new Date().toISOString(), isDemo: true },
      });
    }
  }
  return out;
}

function genMeasurementsForStudent(studentId, weeks = 10) {
  const out = [];
  const baseWeight = rand(58, 95);
  const baseWaist  = rand(70, 105);
  const baseChest  = rand(85, 115);
  const baseHip    = rand(85, 115);
  const today = new Date();
  let w = baseWeight, waist = baseWaist, chest = baseChest, hip = baseHip;
  for (let i = weeks; i >= 0; i -= 2) {
    const d = new Date(today);
    d.setDate(d.getDate() - i * 7);
    out.push({
      id: uid('mea'),
      studentId,
      date: toISODate(d),
      weightKg: Math.round((w + (Math.random() - 0.5) * 0.6) * 10) / 10,
      waistCm:  Math.round(waist),
      hipCm:    Math.round(hip),
      chestCm:  Math.round(chest),
      armCm:    rand(30, 42),
      thighCm:  rand(48, 65),
      notes: '',
      meta: { createdAt: new Date().toISOString(), isDemo: true },
    });
    w -= 0.4;
    waist -= 0.3;
    chest += 0.2;
    hip -= 0.2;
  }
  return out;
}

function genPaymentsForStudent(studentId, monthlyAmount = 35000, joinedDaysAgo) {
  const out = [];
  const today = new Date();
  const joined = new Date();
  joined.setDate(joined.getDate() - joinedDaysAgo);
  // generate one payment per month since joined day
  let cursor = new Date(joined);
  cursor.setDate(1);
  while (cursor <= today) {
    const dueDate = new Date(cursor);
    const isFuture = dueDate > today;
    const isRecentPast = (today - dueDate) / (1000 * 60 * 60 * 24) < 30;
    out.push({
      id: uid('pay'),
      studentId,
      period: `${['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'][dueDate.getMonth()]} ${dueDate.getFullYear()}`,
      amount: monthlyAmount,
      dueDate: toISODate(dueDate),
      status: isFuture ? 'pending' : (isRecentPast ? (Math.random() < 0.85 ? 'paid' : 'pending') : (Math.random() < 0.97 ? 'paid' : 'overdue')),
      paidAt: null,
      method: pick(['Transferencia', 'Efectivo', 'Webpay', 'Débito']),
      notes: '',
      meta: { createdAt: new Date().toISOString() },
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  // paidAt = dueDate + a few days for paid ones
  return out.map((p) => {
    if (p.status === 'paid') {
      const d = fromISODateHelper(p.dueDate);
      d.setDate(d.getDate() + rand(0, 6));
      d.setHours(rand(9, 21), rand(0, 59), 0, 0);
      return { ...p, paidAt: d.toISOString() };
    }
    return p;
  });
}

// helper kept local to avoid extra import
function fromISODateHelper(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Main seed generator. Returns a full DB-shaped object marked with isDemo. */
export function buildSeed() {
  const studentRecords = [];
  const attendanceRecords = [];
  const measurementRecords = [];
  const paymentRecords = [];
  const routineRecords = [];
  const routineExerciseRecords = [];
  const goalRecords = [];
  const noteRecords = [];

  for (let i = 0; i < DEMO_NAMES.length; i++) {
    const [firstName, lastName] = DEMO_NAMES[i];
    const joinedDaysAgo = rand(30, 220);
    const joinedAt = new Date();
    joinedAt.setDate(joinedAt.getDate() - joinedDaysAgo);
    const monthlyFee = pick([28000, 32000, 35000, 38000, 42000]);
    const id = uid('stu');
    studentRecords.push({
      id,
      firstName,
      lastName,
      sex: pick(['F', 'M']),
      phone: `+56 9 ${rand(6000, 9999)} ${rand(1000, 9999)}`,
      email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@mail.cl`,
      birthdate: '',
      heightCm: rand(155, 188),
      joinedAt: toISODate(joinedAt),
      status: 'active',
      mainGoal: pick(DEMO_GOALS),
      weeklyGoal: DEFAULT_WEEKLY_GOAL,
      preferredTimes: pick(['Mañana', 'Tarde', 'Mediodía']),
      notes: '',
      membershipStart: toISODate(joinedAt),
      membershipEnd: toISODate(new Date(joinedAt.getFullYear(), joinedAt.getMonth() + 6, joinedAt.getDate())),
      meta: { createdAt: new Date().toISOString(), isDemo: true },
    });
    attendanceRecords.push(...genAttendancesForStudent(id));
    measurementRecords.push(...genMeasurementsForStudent(id));
    paymentRecords.push(...genPaymentsForStudent(id, monthlyFee, joinedDaysAgo));
    // assign 1 routine to some students
    if (i % 2 === 0) {
      const tmpl = ROUTINES_DEMO[i % ROUTINES_DEMO.length];
      const routineId = uid('rut');
      routineRecords.push({
        id: routineId,
        studentId: id,
        name: tmpl.name,
        objective: tmpl.objective,
        status: 'active',
        createdAt: toISODate(new Date()),
        meta: { createdAt: new Date().toISOString(), isDemo: true },
      });
      tmpl.exercises.forEach((ex, idx) => {
        routineExerciseRecords.push({
          id: uid('exr'),
          routineId,
          name: ex.name,
          muscleGroup: ex.muscleGroup,
          sets: ex.sets,
          reps: ex.reps,
          durationSec: ex.reps && /^\d+s$/.test(ex.reps) ? Number(ex.reps.replace('s','')) : '',
          weightKg: ex.weightKg || '',
          restSec: ex.restSec || '',
          instructions: '',
          notes: '',
          order: idx,
        });
      });
    }
    // goal for some
    if (i % 3 === 0) {
      goalRecords.push({
        id: uid('goal'),
        studentId: id,
        type: 'weight',
        title: 'Peso objetivo',
        description: '',
        targetValue: Math.round((parseFloat(measurementRecords[measurementRecords.length - 1]?.weightKg || 70) - rand(3, 7)) * 10) / 10,
        unit: 'kg',
        targetDate: toISODate(addDays(new Date(), 60)),
        status: 'active',
        createdAt: todayISO(),
        meta: { createdAt: new Date().toISOString(), isDemo: true },
      });
    }
    // a private note
    noteRecords.push({
      id: uid('nt'),
      studentId: id,
      author: 'admin',
      category: 'progreso',
      body: 'Buen avance. Mostrar la próxima semana.',
      shared: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  return {
    meta: {
      version: 1,
      appVersion: '1.0.0',
      appName: 'GymTrack',
      createdAt: new Date().toISOString(),
      lastExportAt: null,
      lastImportAt: null,
      isDemo: true,
    },
    config: {
      weekStartDay: 1,
      currency: 'CLP',
      defaultWeeklyGoal: 2,
      gymName: 'GymTrack Demo',
      theme: 'dark',
    },
    students: studentRecords,
    attendances: attendanceRecords,
    routines: routineRecords,
    routineExercises: routineExerciseRecords,
    performedSessions: [],
    measurements: measurementRecords,
    goals: goalRecords,
    payments: paymentRecords,
    notes: noteRecords,
  };
}
