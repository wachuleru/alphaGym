/* ===========================================================
   GymTrack — Levels service (the gamification engine)
   Pure functions — easy to test or tweak.
   No IO here. Operates on student + attendances arrays.
   =========================================================== */

import { LEVELS, BADGES, DEFAULT_WEEKLY_GOAL } from '../config.js';
import { startOfWeek, toISODate, addDays, diffDays } from '../utils.js';

/**
 * Compute all metrics for a single student given their attendances.
 * Returns:
 *   totalAttendances
 *   weekStats[]         (one entry per ISO week containing >=1 attendance, sorted oldest -> newest)
 *   streakWeeks         (number of consecutive completed weeks ending in the current or last completed week)
 *   weeklyCompliance    (share of recent weeks meeting goal, computed over the
 *                        last 12 weeks; never below 0)
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

  // streak: count consecutive weeks meeting goal, walking backward from the
  // most recent week containing at least one attendance. If the current week
  // has no attendance yet, we don't penalise (open week).
  let streak = 0;
  if (weekKeys.length) {
    let cursor = new Date(weekKeys[weekKeys.length - 1]);
    cursor = startOfWeek(cursor);
    // We iterate backward, week by week, while the prior week met the goal.
    // We stop when we hit a week that didn't meet it.
    while (true) {
      const key = toISODate(cursor);
      const count = weekMap.get(key) || 0;
      if (count >= goal) streak++;
      else break;
      cursor = addDays(cursor, -7);
      // Safety: don't go beyond the first known week
      if (toISODate(cursor) < weekKeys[0]) break;
    }
  }

  // weekly compliance — completed weeks only (last 12)
  const completedWeeks = weekKeys.slice(-12);
  const compliantWeeks = completedWeeks.filter((k) => (weekMap.get(k) || 0) >= goal).length;
  const weeklyCompliance = completedWeeks.length ? compliantWeeks / completedWeeks.length : 0;

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
