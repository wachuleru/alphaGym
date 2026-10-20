/* ===========================================================
   GymTrack — Seed demo data (schema v2)
   Marked with `meta.isDemo` so the user can later wipe it.
   =========================================================== */

import { uid, todayISO, toISODate, addDays } from '../utils.js';
import { DEFAULT_WEEKLY_GOAL, MUSCLE_GROUPS, IMPLEMENTS } from '../config.js';

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

/** Catalog of exercises (reusable across trainings). */
const EXERCISES_DEMO = [
  { name: 'Press banca',          muscleGroups: ['brazos'],                    implement: 'barra',      sets: '4', reps: '8-10', rest: 90,  baseWeight: 50 },
  { name: 'Press inclinado',      muscleGroups: ['brazos'],                    implement: 'mancuernas', sets: '3', reps: '10-12', rest: 75,  baseWeight: 18 },
  { name: 'Remo con barra',       muscleGroups: ['espalda'],                   implement: 'barra',      sets: '4', reps: '8-10',  rest: 90,  baseWeight: 45 },
  { name: 'Dominadas',            muscleGroups: ['espalda', 'brazos'],         implement: 'peso_corporal', sets: '4', reps: '8',  rest: 90,  baseWeight: 0 },
  { name: 'Sentadilla',           muscleGroups: ['piernas'],                   implement: 'barra',      sets: '5', reps: '5',     rest: 120, baseWeight: 60 },
  { name: 'Peso muerto rumano',   muscleGroups: ['piernas', 'espalda'],        implement: 'barra',      sets: '4', reps: '6-8',   rest: 90,  baseWeight: 70 },
  { name: 'Prensa',              muscleGroups: ['piernas'],                   implement: 'maquina',    sets: '4', reps: '10',    rest: 90,  baseWeight: 120 },
  { name: 'Hip thrust',          muscleGroups: ['piernas'],                   implement: 'barra',      sets: '4', reps: '8-10',  rest: 90,  baseWeight: 80 },
  { name: 'Curl bíceps',         muscleGroups: ['brazos'],                    implement: 'mancuernas', sets: '3', reps: '12',    rest: 45,  baseWeight: 12 },
  { name: 'Tríceps polea',       muscleGroups: ['brazos'],                    implement: 'cable',      sets: '3', reps: '12',    rest: 45,  baseWeight: 20 },
  { name: 'Plancha',             muscleGroups: ['core'],                      implement: 'peso_corporal', sets: '3', reps: '45s', rest: 30,  baseWeight: 0 },
  { name: 'Kettlebell swings',   muscleGroups: ['piernas', 'core'],           implement: 'kettlebell', sets: '4', reps: '20',    rest: 45,  baseWeight: 16 },
  { name: 'Remo TRX',            muscleGroups: ['espalda'],                   implement: 'bandas',     sets: '3', reps: '12',    rest: 45,  baseWeight: 0 },
  { name: 'Face pulls',          muscleGroups: ['espalda'],                   implement: 'cable',      sets: '3', reps: '15',    rest: 45,  baseWeight: 18 },
  { name: 'Extensión cuádriceps',muscleGroups: ['piernas'],                   implement: 'maquina',    sets: '3', reps: '12',    rest: 60,  baseWeight: 50 },
  { name: 'Dead hang',           muscleGroups: ['espalda', 'brazos'],         implement: 'peso_corporal', sets: '3', reps: '30s', rest: 45,  baseWeight: 0 },
];

/** Categories that group the demo trainings (the optional layer above them). */
const CATEGORIES_DEMO = [
  { key: 'superior', name: 'Tren superior', color: 'accent',  observation: 'Empuje y tirón' },
  { key: 'inferior', name: 'Tren inferior', color: 'info',    observation: 'Patrón dominante de rodilla y cadera' },
  { key: 'fullbody', name: 'Full body',     color: 'success', observation: 'Sesiones cortas para días con poco tiempo' },
];

/** Training templates (decoupled from students). */
const TRAININGS_DEMO = [
  {
    name: 'Tren superior · fuerza',
    categoryKey: 'superior',
    objective: 'Hipertrofia',
    observation: 'Calentamiento previo 10 min',
    exerciseNames: ['Press banca', 'Remo con barra', 'Press inclinado', 'Curl bíceps', 'Tríceps polea', 'Face pulls'],
  },
  {
    name: 'Tren inferior · potencia',
    categoryKey: 'inferior',
    objective: 'Fuerza',
    observation: 'Priorizar carga; bajar a 8 reps si falla la técnica',
    exerciseNames: ['Sentadilla', 'Peso muerto rumano', 'Prensa', 'Hip thrust', 'Extensión cuádriceps'],
  },
  {
    name: 'Full body · resistencia',
    categoryKey: 'fullbody',
    objective: 'Resistencia',
    observation: 'Pausa mínima entre series',
    exerciseNames: ['Kettlebell swings', 'Dominadas', 'Remo TRX', 'Plancha'],
  },
  {
    name: 'Core y movilidad',
    categoryKey: null,
    objective: 'Prevención',
    observation: 'Sin categoría a propósito: muestra el grupo "Sin categoría"',
    exerciseNames: ['Plancha', 'Dead hang'],
  },
];

function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function pick(arr) { return arr[rand(0, arr.length - 1)]; }

/* ---------- Demo generators ---------- */

function genAttendancesForStudent(studentId, weeks = 10, sessionsPerWeek = [0, 1, 1, 2, 2, 3]) {
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
        trainingId: null,
        dateISO: toISODate(d),
        timeISO: `2026-01-01T${String(rand(6, 21)).padStart(2,'0')}:${rand(0,1) ? '00' : '30'}:00.000Z`,
        type: 'regular',
        notes: '',
        entries: [],
        meta: { createdAt: new Date().toISOString(), isDemo: true },
      });
    }
  }
  return out;
}

function genMeasurementsForStudent(studentId, weeks = 10) {
  const out = [];
  const baseWeight = rand(58, 95);
  const baseWaist = rand(70, 105);
  const baseChest = rand(85, 115);
  const baseHip = rand(85, 115);
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
      waistCm: Math.round(waist),
      hipCm: Math.round(hip),
      chestCm: Math.round(chest),
      armCm: rand(30, 42),
      thighCm: rand(48, 65),
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

function fromISODateHelper(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Build catalog + categories + trainings (need their IDs to assign to attendances). */
function buildTrainings() {
  const cats = EXERCISES_DEMO.map((ex) => {
    const id = uid('exc');
    return {
      id,
      name: ex.name,
      observation: '',
      muscleGroups: ex.muscleGroups,
      status: 'active',
      createdAt: todayISO(),
      meta: { createdAt: new Date().toISOString(), isDemo: true },
      _baseWeight: ex.baseWeight,
      _implement: ex.implement,
    };
  });
  const catByName = new Map(cats.map((c) => [c.name, c]));

  const categories = CATEGORIES_DEMO.map((c) => ({
    id: uid('cat'),
    name: c.name,
    observation: c.observation,
    color: c.color,
    status: 'active',
    createdAt: todayISO(),
    meta: { createdAt: new Date().toISOString(), isDemo: true },
  }));
  const catByKey = new Map(categories.map((c, i) => [CATEGORIES_DEMO[i].key, c.id]));

  const trainings = TRAININGS_DEMO.map((t) => {
    const exerciseIds = t.exerciseNames.map((n) => catByName.get(n).id);
    return {
      id: uid('trn'),
      name: t.name,
      objective: t.objective,
      observation: t.observation,
      categoryId: t.categoryKey ? catByKey.get(t.categoryKey) : null,
      exerciseIds,
      status: 'active',
      createdAt: toISODate(new Date()),
      meta: { createdAt: new Date().toISOString(), isDemo: true },
    };
  });

  return { exercises: cats, trainings, categories };
}

/**
 * For about half the demo students, fully populate the last few attendances
 * with weighted entries from a chosen training, with progressive overload
 * (each session adds +2.5 kg or +1 rep on average).
 */
function genAttendancesWithEntries(studentId, trainings, exercises) {
  const out = [];
  const today = new Date();
  const t = pick(trainings);
  if (!t || !t.exerciseIds.length) return out;
  const sessions = [3, 4, 5];
  for (let s = 0; s < pick(sessions); s++) {
    const d = new Date(today);
    d.setDate(d.getDate() - (s * 7 + rand(0, 3)));
    const dateISO = toISODate(d);
    const entries = t.exerciseIds.map((eid, i) => {
      const ex = exercises.find((x) => x.id === eid);
      const startW = (ex?._baseWeight ?? 0) + rand(-5, 10);
      const sets = String(ex && /(45s|^\d+s$)/.test(ex.reps) ? ex.sets : ex?.sets || '4');
      const reps = String(ex?.reps || '8');
      const weightKg = ex && ex._baseWeight > 0 ? Math.round((startW + s * rand(1, 3)) * 2) / 2 : null;
      const implement = ex?._implement || 'barra';
      return {
        id: uid('ent'),
        exerciseId: eid,
        order: i,
        extra: false,
        name: ex?.name || 'Ejercicio',
        muscleGroups: ex?.muscleGroups || [],
        sets,
        reps,
        weightKg,
        implement,
        observation: '',
        lastWeightKg: weightKg != null && s > 0 ? Math.round((weightKg - rand(1, 3)) * 2) / 2 : null,
      };
    });
    out.push({
      id: uid('att'),
      studentId,
      trainingId: t.id,
      dateISO,
      timeISO: `2026-01-01T${String(rand(6, 21)).padStart(2,'0')}:${rand(0,1) ? '00' : '30'}:00.000Z`,
      type: 'regular',
      notes: '',
      entries,
      meta: { createdAt: new Date().toISOString(), isDemo: true },
    });
  }
  return out;
}

/** Main seed generator. Returns a full DB-shaped object marked with isDemo. */
export function buildSeed() {
  const { exercises, trainings, categories } = buildTrainings();
  const studentRecords = [];
  const attendanceRecords = [];
  const measurementRecords = [];
  const paymentRecords = [];
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

    // Half the students get full weighted-attendance history.
    if (i % 2 === 0) {
      attendanceRecords.push(...genAttendancesWithEntries(id, trainings, exercises));
    }

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
      version: 2,
      appVersion: '2.1.0',
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
    exercises,
    trainingCategories: categories,
    trainings,
    measurements: measurementRecords,
    goals: goalRecords,
    payments: paymentRecords,
    notes: noteRecords,
  };
}
