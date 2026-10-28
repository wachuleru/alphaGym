/* ===========================================================
   ALPHA-FIT — Levels service (the gamification engine)
   Pure functions — easy to test or tweak.
   No IO here. Operates on student + attendances arrays.
   =========================================================== */

import { LEVELS, BADGES, DEFAULT_WEEKLY_GOAL } from '../config.js';
import { startOfWeek, toISODate, addDays, todayISO, fromISODate } from '../utils.js';
import { closureWeekKeys } from './closures.js';

/** How many calendar weeks the weekly-compliance window spans. */
const COMPLIANCE_WINDOW = 12;

/** Hard stop on the backward streak walk — ~5 years. Exempt weeks are skipped. */
const MAX_STREAK_WEEKS = 260;

/** How many calendar weeks the student's weekly strip renders. */
export const STRIP_WEEKS = 8;

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
 *                      but any *earlier* empty week breaks the streak. Exempt weeks are
 *                      stepped over — they neither extend nor break the chain.
 *   weeklyCompliance   share of the last 12 calendar weeks meeting the goal, counting empty
 *                      weeks as failures and never reaching back past the enrollment date.
 *                      Exempt weeks leave the denominator instead of counting as failures.
 *   weeklyGoal          (echo of the student's goal)
 *   firstAttendanceISO  (or null)
 *   lastAttendanceISO   (or null)
 *   measurementCount
 *   hasGoal
 *   exemptWeeks         Set of week keys excluded from both by a closure or the student's
 *                      own `exemptWeeks`
 *   recentWeeks         the last STRIP_WEEKS calendar weeks, exempt ones included, so the
 *                      UI can render a gap instead of silently omitting the week
 */
export function computeStudentMetrics(student, attendances, measurements = [], goals = [], closures = []) {
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

  /* ---- Justified absences ------------------------------------------------
     A week covered by a global closure (feriado nacional, gym cerrado) or by
     one of the student's own `exemptWeeks` is SKIPPED, not forgiven: it does
     not extend the streak, it does not break it, and it is not judged for
     compliance. Losing a session to a holiday is a measurement artifact, not
     a fact about the student's constancia.
  */
  const exemptWeekSet = closureWeekKeys(closures);
  for (const wk of student?.exemptWeeks || []) exemptWeekSet.add(wk);
  const isExempt = (wk) => exemptWeekSet.has(wk);

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

  // No floor here, deliberately. Both candidates are wrong: `joinedAt` defaults
  // to the day the record was created, so a student created today with six weeks
  // of backfilled history would be truncated immediately; and `firstJudgedWeek`
  // is a compliance-window concept (the earlier of enrollment and first
  // attendance), which is later than the start of the record for any late
  // starter. The walk stops where the student's record starts instead — see the
  // `!weekMap.has` test below, which exemptions would otherwise have bypassed.

  // streak: walk backward from the CURRENT week, not from the last attended one.
  // Anchoring on the last attendance let a streak survive forever — a student who
  // stopped showing up kept the racha they had earned weeks ago.
  let streak = 0;
  let cursorKey = currentWeekKey;
  // The current week is still in progress: not having met the goal yet is not a
  // failure, so step back one week without charging a miss.
  if ((weekMap.get(cursorKey) || 0) < goal) {
    cursorKey = weekKeyBefore(cursorKey);
  }
  // `MAX_STREAK_WEEKS` is the only hard stop. Without it a long enough run of
  // justified empty weeks would step past the start of the record and keep going.
  for (let guard = 0; guard < MAX_STREAK_WEEKS; guard++, cursorKey = weekKeyBefore(cursorKey)) {
    const met = (weekMap.get(cursorKey) || 0) >= goal;
    // Justified and empty: the student never got the chance, so the week neither
    // extends nor breaks the chain. Justified AND met: they trained anyway, so it
    // counts like any other good week.
    if (isExempt(cursorKey)) {
      if (met) streak++;
      continue;
    }
    // Nothing recorded and nothing expected — this is where the record starts.
    if (!weekMap.has(cursorKey)) break;
    if (!met) break;
    streak++;
  }

  // weekly compliance — the last N calendar weeks, NOT the last N weeks that
  // happen to contain an attendance. Skipping empty weeks scored a student who
  // walked away at 100%, which in turn inflated their level.
  const window = [];
  let wKey = currentWeekKey;
  for (let i = 0; i < COMPLIANCE_WINDOW; i++) {
    // Never judge a student on weeks before they enrolled.
    if (firstJudgedWeek && wKey < firstJudgedWeek) break;
    // A justified week is not judged: it leaves the denominator instead of
    // scoring as a failure, so one holiday cannot drag a 90% student under a
    // level threshold. If they met the goal anyway it stays in, counted.
    if ((weekMap.get(wKey) || 0) >= goal || !isExempt(wKey)) window.push(wKey);
    wKey = weekKeyBefore(wKey);
  }
  const compliantWeeks = window.filter((k) => (weekMap.get(k) || 0) >= goal).length;
  const weeklyCompliance = window.length ? compliantWeeks / window.length : 0;

  // Calendar weeks for the UI strip. Unlike `weekKeys` these include weeks with
  // no attendance at all, so an empty or exempt week reads as a gap instead of
  // quietly vanishing from the row — which is exactly the week the streak cares about.
  const recentWeeks = [];
  for (let sKey = currentWeekKey, i = 0; i < STRIP_WEEKS; i++, sKey = weekKeyBefore(sKey)) {
    recentWeeks.unshift(sKey);
  }

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
    exemptWeeks: exemptWeekSet,
    recentWeeks,
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
