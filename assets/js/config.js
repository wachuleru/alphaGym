/* ===========================================================
   GymTrack — config & constants
   =========================================================== */

export const SCHEMA_VERSION = 2;
export const STORAGE_KEY = `gymtrack:db:v${SCHEMA_VERSION}`;
export const LEGACY_STORAGE_KEY = 'gymtrack:db:v1';
export const ARCHIVE_KEY = 'gymtrack:archive:v1';
export const APP_VERSION = '2.0.0';
export const APP_NAME = 'GymTrack';

/**
 * Week starts on Monday (1). Configurable in the future.
 * Using ISO week convention for consistency.
 */
export const WEEK_START_DAY = 1; // Monday

/* Currency */
export const CURRENCY = {
  code: 'CLP',
  symbol: '$',
  /** Format CLP with no decimals and thin separator. */
  format: (n) =>
    Number(n || 0).toLocaleString('es-CL', { maximumFractionDigits: 0 }),
};

/* Date formats */
export const DATE_FMT_DMY = 'DD/MM/AAAA';
export const DATE_FMT_YMD = 'YYYY-MM-DD';

/* ===========================================================
   Levels (gamification based exclusively on CONSTANCIA)
   ===========================================================
   Each level requires:
   - totalAttendances: minimum total valid attendances
   - streakWeeks:     minimum consecutive weeks meeting the
                       student's weekly goal
   - weeklyCompliance: minimum share of recent weeks meeting goal
   Order must be ascending by difficulty.
   =========================================================== */
export const LEVELS = [
  {
    id: 1,
    key: 'principiante',
    name: 'Principiante',
    description: 'Empezando a construir el hábito.',
    bg: 'rgba(148,163,184,0.10)',
    fg: '#94a3b8',
    border: 'rgba(148,163,184,0.30)',
    totalAttendances: 0,
    streakWeeks: 0,
    weeklyCompliance: 0,
  },
  {
    id: 2,
    key: 'constante',
    name: 'Constante',
    description: 'Ya tiene un ritmo semanal.',
    bg: 'rgba(56,189,248,0.12)',
    fg: '#38bdf8',
    border: 'rgba(56,189,248,0.30)',
    totalAttendances: 6,
    streakWeeks: 2,
    weeklyCompliance: 0.5,
  },
  {
    id: 3,
    key: 'comprometido',
    name: 'Comprometido',
    description: 'Cumplió su meta de asistencia por varias semanas seguidas.',
    bg: 'rgba(129,140,248,0.12)',
    fg: '#818cf8',
    border: 'rgba(129,140,248,0.30)',
    totalAttendances: 20,
    streakWeeks: 4,
    weeklyCompliance: 0.65,
  },
  {
    id: 4,
    key: 'disciplinado',
    name: 'Disciplinado',
    description: 'Mantiene la disciplina semanal y suma experiencia.',
    bg: 'rgba(244,198,98,0.16)',
    fg: '#f4c662',
    border: 'rgba(244,198,98,0.40)',
    totalAttendances: 50,
    streakWeeks: 8,
    weeklyCompliance: 0.75,
  },
  {
    id: 5,
    key: 'referente',
    name: 'Referente',
    description: 'Referente del gimnasio: constancia y compromiso.',
    bg: 'linear-gradient(135deg, rgba(244,198,98,0.30), rgba(129,140,248,0.20))',
    fg: '#f4c662',
    border: 'rgba(244,198,98,0.55)',
    totalAttendances: 100,
    streakWeeks: 16,
    weeklyCompliance: 0.85,
  },
];

export const DEFAULT_WEEKLY_GOAL = 2; // sessions per week

export const STUDENT_STATUSES = [
  { value: 'active',    label: 'Activo',     color: 'success' },
  { value: 'inactive',  label: 'Inactivo',   color: 'muted' },
  { value: 'suspended', label: 'Suspendido', color: 'warning' },
];

/* Badges (hitos independientes, sin nivel) */
export const BADGES = [
  { id: 'first_step',    name: 'Primer paso',     desc: 'Primera asistencia registrada.',         icon: 'footprints', check: ({ totalAttendances }) => totalAttendances >= 1 },
  { id: 'ten_sessions',  name: '10 sesiones',     desc: '10 asistencias acumuladas.',             icon: 'check-circle', check: ({ totalAttendances }) => totalAttendances >= 10 },
  { id: 'fifty_sessions',name: '50 sesiones',     desc: '50 asistencias acumuladas.',             icon: 'check-circle-2', check: ({ totalAttendances }) => totalAttendances >= 50 },
  { id: 'streak_4',      name: 'Racha 4 semanas', desc: '4 semanas consecutivas cumpliendo meta.', icon: 'flame', check: ({ streakWeeks }) => streakWeeks >= 4 },
  { id: 'streak_8',      name: 'Racha 8 semanas', desc: '8 semanas consecutivas cumpliendo meta.', icon: 'flame', check: ({ streakWeeks }) => streakWeeks >= 8 },
  { id: 'streak_12',     name: 'Racha 12 semanas',desc: '12 semanas consecutivas cumpliendo meta.',icon: 'crown', check: ({ streakWeeks }) => streakWeeks >= 12 },
  { id: 'measure_3',     name: 'Medición 3',      desc: '3 mediciones registradas.',              icon: 'ruler', check: ({ measurementCount }) => measurementCount >= 3 },
  { id: 'goal_set',      name: 'Objetivo fijado', desc: 'Configuró un objetivo personal.',         icon: 'target', check: ({ hasGoal }) => !!hasGoal },
];

/* Goals measurement units */
export const GOAL_UNITS = ['kg', 'cm', '%', 'sesiones/sem', 'índice', 'otro'];

export const STATUS_PAYMENT = [
  { value: 'pending',  label: 'Pendiente', color: 'warning' },
  { value: 'paid',     label: 'Pagado',    color: 'success' },
  { value: 'overdue',  label: 'Vencido',   color: 'danger'  },
];

/* ===========================================================
   Schema v2 — catálogos cerrados
   =========================================================== */

/** Grupos musculares posibles (lista cerrada). `color` mapea a `.badge--*`. */
export const MUSCLE_GROUPS = [
  { value: 'piernas', label: 'Piernas', color: 'accent'  },
  { value: 'core',    label: 'Core',    color: 'info'    },
  { value: 'espalda', label: 'Espalda', color: 'success' },
  { value: 'brazos',  label: 'Brazos',  color: 'warning' },
];

export const MUSCLE_GROUP_BY_VALUE = Object.fromEntries(
  MUSCLE_GROUPS.map((g) => [g.value, g])
);

/** Implementos posibles en una asistencia. 'otro' es el escape hatch. */
export const IMPLEMENTS = [
  { value: 'peso_corporal', label: 'Peso corporal' },
  { value: 'barra',         label: 'Barra' },
  { value: 'mancuernas',    label: 'Mancuernas' },
  { value: 'kettlebell',    label: 'Kettlebell' },
  { value: 'cable',         label: 'Polea / cable' },
  { value: 'maquina',       label: 'Máquina' },
  { value: 'bandas',        label: 'Bandas elásticas' },
  { value: 'otro',          label: 'Otro' },
];

export const IMPLEMENT_BY_VALUE = Object.fromEntries(
  IMPLEMENTS.map((i) => [i.value, i])
);

/* Chart palette helper */
export const chartPalette = () => {
  const root = getComputedStyle(document.documentElement);
  const raw = root.getPropertyValue('--chart-palette').trim();
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
};
