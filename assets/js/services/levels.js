/* ===========================================================
   GymTrack — Levels service (the gamification engine)
   Pure functions — easy to test or tweak.
   No IO here. Operates on student + attendances arrays.
   =========================================================== */

import { LEVELS, BADGES, DEFAULT_WEEKLY_GOAL } from '../config.js';
import { startOfWeek, toISODate, addDays, todayISO, fromISODate } from '../utils.js';

/** How many calendar weeks the weekly-compliance window spans. */
const COMPLIANCE_WINDOW = 12;

/**
 * The Monday of the week before a `YYYY-MM-DD` Monday, as `YYYY-MM-DD`.
 * Pure string→string: every step goes through `fromISODate` (local), never
 * `new Date(str)` (UTC). Mixing the two is what made streaks read one week short
 * in Chile, and it can silently return a key that isn't in `weekMap` at all.
 */
function weekKeyBefore(mondayISO) {
  return toISODate(addDays(fromISODate(mondayISO), -7));
}

/**
 * Compute all metrics for a single student given their attendances.
 * Nothing here is persisted: every number is derived from `attendances` on each
 * render, so a corrected or backdated attendance is reflected immediately.
 *
 * Returns:
 *   totalAttendances
 *   weekKeys/weekMap   (weeks that contain >=1 attendance, ascending; consumed by the UI strip)
 *   streakWeeks        consecutive weeks meeting the goal, counting back from the current
 *                      week. The current week is OPEN: not meeting it yet costs nothing,
 *                      but any *earlier* empty week breaks the streak.
 *   weeklyCompliance   share of the last 12 calendar weeks meeting the goal, counting empty
 *                      weeks as failures and never reaching back past the enrollment date
 *   weeklyGoal          (echo of the student's goal)
 *   firstAttendanceISO  (or null)
 *   lastAttendanceISO   (or null)
 *   measurementCount
 *   hasGoal
 */
export function computeStudentMetrics(student, attendances, measurements = [], goals = []) {
  const goal = student?.weeklyGoal || DEFAULT_WEEKLY_GOAL;
  const own = attendances
    .filter((a) => a.studentId === student.id)
    .slice()
    .sort((a, b) => (a.dateISO < b.dateISO ? -1 : 1));

  // unique date strings
  const dateSet = new Set();
  for (const a of own) if (a.dateISO) dateSet.add(a.dateISO);
  const allDates = [...dateSet].sort();

  // group by week (week starts Monday, configured in config.WEEK_START_DAY)
  const weekMap = new Map();
  for (const iso of allDates) {
    const ws = toISODate(startOfWeek(iso));
    weekMap.set(ws, (weekMap.get(ws) || 0) + 1);
  }
  const weekKeys = [...weekMap.keys()].sort(); // ascending ISO, sorts chronologically

  // The Monday of the current week. `todayISO()` gives a local YYYY-MM-DD and
  // `fromISODate` parses it as local midnight — do NOT feed these keys to
  // `new Date()`, which parses them as UTC and lands on the previous day in
  // every negative-offset timezone (Chile included).
  const currentWeekKey = toISODate(startOfWeek(todayISO()));

  // streak: walk backward from the CURRENT week, not from the last attended one.
  // Anchoring on the last attendance let a streak survive forever — a student who
  // stopped showing up kept the racha they had earned weeks ago.
  let streak = 0;
  let cursorKey = currentWeekKey;
  // The current week is still in progress: not having met the goal yet is not a
  // failure, so step back one week without charging a miss. Every earlier empty
  // week, on the other hand, does break it — that's the whole point of a streak.
  if ((weekMap.get(cursorKey) || 0) < goal) {
    cursorKey = weekKeyBefore(cursorKey);
  }
  // `weekMap.has` is both the "met the goal" test and the "don't wander past the
  // student's history" guard: a gap in the map ends the streak, and so does the
  // start of their record.
  while (weekMap.has(cursorKey)) {
    if ((weekMap.get(cursorKey) || 0) < goal) break;
    streak++;
    cursorKey = weekKeyBefore(cursorKey);
  }

  // weekly compliance — the last N calendar weeks, NOT the last N weeks that
  // happen to contain an attendance. Skipping empty weeks scored a student who
  // walked away at 100%, which in turn inflated their level.
  //
  // The window never reaches back before the student was in the gym. That's the
  // EARLIER of `joinedAt` and their first recorded attendance: a record created
  // today but backfilled with six weeks of history has to be judged on those six
  // weeks, otherwise the window collapses to this single week and compliance
  // becomes a coin flip.
  const enrolledWeek = student?.joinedAt || student?.membershipStart
    ? toISODate(startOfWeek(student.joinedAt || student.membershipStart))
    : null;
  const firstAttWeek = allDates[0] ? toISODate(startOfWeek(allDates[0])) : null;
  const firstJudgedWeek = enrolledWeek && firstAttWeek
    ? (enrolledWeek < firstAttWeek ? enrolledWeek : firstAttWeek)
    : (enrolledWeek || firstAttWeek);
  const window = [];
  let wKey = currentWeekKey;
  for (let i = 0; i < COMPLIANCE_WINDOW; i++) {
    // Never judge a student on weeks before they enrolled.
    if (firstJudgedWeek && wKey < firstJudgedWeek) break;
    window.push(wKey);
    wKey = weekKeyBefore(wKey);
  }
  const compliantWeeks = window.filter((k) => (weekMap.get(k) || 0) >= goal).length;
  const weeklyCompliance = window.length ? compliantWeeks / window.length : 0;

  // measurement count + goal flag
  const measurementCount = measurements.filter((m) => m.studentId === student.id).length;
  const hasGoal = goals.some((g) => g.studentId === student.id);

  return {
    totalAttendances: own.length,
    weekKeys,
    weekMap,
    streakWeeks: streak,
    weeklyCompliance,
    weeklyGoal: goal,
    firstAttendanceISO: allDates[0] || null,
    lastAttendanceISO: allDates[allDates.length - 1] || null,
    measurementCount,
    hasGoal,
  };
}

/**
 * Determine current level by inspecting metrics.
 * Uses the HIGHEST level whose thresholds the metrics meet OR exceed.
 * If a student fails one threshold of a level, they stay at the previous one.
 */
export function determineLevel(metrics) {
  let current = LEVELS[0];
  for (const lv of LEVELS) {
    if (
      metrics.totalAttendances >= lv.totalAttendances &&
      metrics.streakWeeks >= lv.streakWeeks &&
      metrics.weeklyCompliance >= lv.weeklyCompliance
    ) current = lv;
    else break;
  }
  return current;
}

/** Progress (0..1) toward the *next* level. 1 if already max. */
export function progressToNext(metrics) {
  const cur = determineLevel(metrics);
  const curIdx = LEVELS.findIndex((l) => l.id === cur.id);
  if (curIdx === LEVELS.length - 1) return 1;
  const next = LEVELS[curIdx + 1];

  // We'll compute progress as the average of three normalized values:
  // - attendances toward next
  // - streakWeeks toward next
  // - compliance toward next
  const norm = (val, req) => Math.min(1, val / Math.max(1, req));
  const att = norm(metrics.totalAttendances, next.totalAttendances);
  const str = norm(metrics.streakWeeks, next.streakWeeks);
  const cmp = norm(metrics.weeklyCompliance, next.weeklyCompliance);
  return Math.round(((att + str + cmp) / 3) * 100) / 100;
}

/** List of badges earned, with their definitions. */
export function earnedBadges(metrics) {
  return BADGES.filter((b) => {
    try { return !!b.check(metrics); } catch { return false; }
  }).map((b) => ({ id: b.id, name: b.name, desc: b.desc, icon: b.icon }));
}

/** All badges (earned + locked) for display. */
export function allBadgesWithStatus(metrics) {
  const earned = new Set(earnedBadges(metrics).map((b) => b.id));
  return BADGES.map((b) => ({
    ...b,
    earned: earned.has(b.id),
  }));
}
