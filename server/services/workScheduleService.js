/**
 * Resolving which shift an employee was supposed to work on a given day.
 *
 * Phase 1 of docs/attendance_schedules_and_exceptions_plan.md. Nothing here
 * judges attendance — that is the evaluator in Phase 2. This module answers one
 * question, and the evaluator will be built on top of it:
 *
 *     on 2026-08-15, what was this employee's expected start, end and break?
 *
 * The date-handling rules are strict, and they are the reason most of this file
 * is pure functions over strings:
 *
 *  - **Dates are 'YYYY-MM-DD' strings, never Date objects.** A DATE column read
 *    into a JS Date shifts a day in any zone behind UTC. This codebase has paid
 *    for that once already; every query here uses DATE_FORMAT.
 *  - **Times are wall-clock.** The fingerprint feed reports local times, and every
 *    comparison is done in minutes since midnight. There is no UTC conversion
 *    anywhere in this feature.
 *  - **weekday is 0 = Sunday … 6 = Saturday**, matching both `Date.getDay()` and
 *    MySQL's `DAYOFWEEK() - 1`, so the number means the same thing on both sides.
 */
import pool from '../config/db.js';

/**
 * Weekday for a 'YYYY-MM-DD' string, 0 = Sunday.
 *
 * Built through Date.UTC deliberately: `new Date('2026-08-15')` is parsed as UTC
 * midnight, so `.getDay()` on a machine west of Greenwich reports the 14th. The
 * server's zone must not be able to change which shift a day is judged against.
 */
export function weekdayOf(dateStr) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(dateStr || ''));
  if (!m) return null;
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).getUTCDay();
}

/** 'HH:MM:SS' or 'HH:MM' → minutes since midnight. Null for anything else. */
export function minutesOfDay(time) {
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(String(time || '').trim());
  if (!m) return null;
  const h = +m[1];
  const min = +m[2];
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/**
 * 'HH:MM:SS' → seconds since midnight.
 *
 * Punch times carry seconds and the source device rounds to the nearest minute
 * when it reports lateness. Truncating instead would disagree with it by a minute
 * on roughly half of all rows, and shadow mode would drown in one-minute
 * "disagreements" that mean nothing. Schedule times are whole minutes, so only
 * punches need this.
 */
export function secondsOfDay(time) {
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(String(time || '').trim());
  if (!m) return null;
  const h = +m[1];
  const min = +m[2];
  const s = +(m[3] || 0);
  if (h > 23 || min > 59 || s > 59) return null;
  return h * 3600 + min * 60 + s;
}

/** Minutes since midnight → 'HH:MM'. */
export function formatMinutes(mins) {
  if (mins == null || Number.isNaN(mins)) return null;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * The expected *net* working minutes for a day rule — the span minus the meal
 * break.
 *
 * The break is subtracted from policy rather than measured, because it cannot be
 * measured: the device reports the first punch as the arrival and the last as the
 * departure, so time away at lunch never appears in the data. This is exactly why
 * the "no meal break" arrangement is modelled as a schedule ending at 18:00 with
 * a zero break — both variants come out at the same 480 minutes.
 */
export function expectedNetMinutes(dayRule) {
  if (!dayRule || !dayRule.is_working) return 0;
  const start = minutesOfDay(dayRule.start_time);
  const end = minutesOfDay(dayRule.end_time);
  if (start == null || end == null) return 0;
  // An end before the start means the shift crosses midnight. No IST schedule
  // does today, but returning a negative number here would silently poison every
  // downstream calculation, so wrap instead.
  const span = end >= start ? end - start : (24 * 60 - start) + end;
  return Math.max(0, span - (Number(dayRule.break_minutes) || 0));
}

/**
 * The rule for one date, given a schedule that already carries its `days`.
 * Pure — this is the function the evaluator will call for every row.
 *
 * @returns {{is_working: boolean, start_time: string|null, end_time: string|null,
 *            break_minutes: number, expected_minutes: number, weekday: number}}
 */
export function resolveDayRule(schedule, dateStr) {
  const weekday = weekdayOf(dateStr);
  const empty = { is_working: false, start_time: null, end_time: null, break_minutes: 0, expected_minutes: 0, weekday };
  if (!schedule || weekday == null) return empty;
  const day = (schedule.days || []).find((d) => Number(d.weekday) === weekday);
  if (!day || !day.is_working) return empty;
  return {
    is_working: true,
    start_time: day.start_time,
    end_time: day.end_time,
    break_minutes: Number(day.break_minutes) || 0,
    expected_minutes: expectedNetMinutes(day),
    weekday,
  };
}

/**
 * What gets frozen onto the attendance row when the evaluator runs.
 *
 * Storing the resolved rule with the day is what makes a past decision
 * re-explainable. The alternative — walking a graph of versioned policy tables to
 * reconstruct what the rule *was* — is far more code and far easier to get
 * subtly wrong a year later.
 */
export function scheduleSnapshot(schedule, dayRule) {
  if (!schedule) return null;
  return {
    schedule_id: schedule.id,
    schedule_name: schedule.name_en,
    timezone: schedule.timezone,
    weekday: dayRule.weekday,
    is_working: dayRule.is_working,
    start_time: dayRule.start_time,
    end_time: dayRule.end_time,
    break_minutes: dayRule.break_minutes,
    expected_minutes: dayRule.expected_minutes,
    grace_in_minutes: schedule.grace_in_minutes,
    grace_out_minutes: schedule.grace_out_minutes,
    late_case_minutes: schedule.late_case_minutes,
    early_case_minutes: schedule.early_case_minutes,
    half_day_threshold_pct: schedule.half_day_threshold_pct,
  };
}

/**
 * Checks a submitted set of day rules and fills in the gaps.
 *
 * Pure, and returns problems rather than throwing, so the route can report all of
 * them at once instead of making the user fix one per attempt. A weekday that is
 * simply absent from the payload becomes a non-working day — that is what "not
 * listed as a working day" means, and it keeps the UI from having to send seven
 * rows to describe a five-day week.
 *
 * @returns {{errors: string[], days: object[]}} days is always 7 rows, weekday 0–6.
 */
export function validateScheduleDays(input) {
  const errors = [];
  const byWeekday = new Map();

  for (const raw of Array.isArray(input) ? input : []) {
    const weekday = Number(raw?.weekday);
    if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) {
      errors.push(`weekday must be 0–6, got "${raw?.weekday}"`);
      continue;
    }
    if (byWeekday.has(weekday)) {
      errors.push(`weekday ${weekday} appears more than once`);
      continue;
    }

    const isWorking = raw.is_working === true || raw.is_working === 1 || raw.is_working === '1';
    if (!isWorking) {
      byWeekday.set(weekday, { weekday, is_working: false, start_time: null, end_time: null, break_minutes: 0 });
      continue;
    }

    const start = minutesOfDay(raw.start_time);
    const end = minutesOfDay(raw.end_time);
    if (start == null) errors.push(`weekday ${weekday}: start time is missing or malformed`);
    if (end == null) errors.push(`weekday ${weekday}: end time is missing or malformed`);
    if (start != null && end != null && end === start) {
      errors.push(`weekday ${weekday}: start and end are the same time`);
    }

    const brk = Number(raw.break_minutes) || 0;
    if (brk < 0 || brk > 8 * 60) errors.push(`weekday ${weekday}: break must be between 0 and 480 minutes`);
    // A break longer than the shift would produce negative expected hours and
    // poison everything downstream.
    if (start != null && end != null && end > start && brk >= end - start) {
      errors.push(`weekday ${weekday}: the break is longer than the shift`);
    }

    byWeekday.set(weekday, {
      weekday,
      is_working: true,
      start_time: raw.start_time,
      end_time: raw.end_time,
      break_minutes: brk,
    });
  }

  const days = [];
  for (let weekday = 0; weekday <= 6; weekday++) {
    days.push(byWeekday.get(weekday)
      || { weekday, is_working: false, start_time: null, end_time: null, break_minutes: 0 });
  }
  if (!days.some((d) => d.is_working)) errors.push('A schedule needs at least one working day');
  return { errors, days };
}

/** One schedule with its seven day rows, or null. */
export async function getScheduleWithDays(scheduleId, db = pool) {
  const [[schedule]] = await db.query('SELECT * FROM work_schedules WHERE id = ?', [scheduleId]);
  if (!schedule) return null;
  const [days] = await db.query(
    `SELECT weekday, is_working,
            TIME_FORMAT(start_time, '%H:%i:%s') start_time,
            TIME_FORMAT(end_time, '%H:%i:%s') end_time,
            break_minutes
       FROM work_schedule_days WHERE schedule_id = ? ORDER BY weekday`, [scheduleId]);
  return { ...schedule, days };
}

/** Every schedule for a company, each with its days. */
export async function listSchedules(companyIds, db = pool) {
  const ids = (Array.isArray(companyIds) ? companyIds : [companyIds]).filter(Boolean);
  if (!ids.length) return [];
  const [schedules] = await db.query(
    `SELECT * FROM work_schedules WHERE company_id IN (${ids.map(() => '?').join(',')})
      ORDER BY company_id, is_default DESC, name_en`, ids);
  if (!schedules.length) return [];
  const [days] = await db.query(
    `SELECT schedule_id, weekday, is_working,
            TIME_FORMAT(start_time, '%H:%i:%s') start_time,
            TIME_FORMAT(end_time, '%H:%i:%s') end_time,
            break_minutes
       FROM work_schedule_days
      WHERE schedule_id IN (${schedules.map(() => '?').join(',')}) ORDER BY weekday`,
    schedules.map((s) => s.id));
  return schedules.map((s) => ({ ...s, days: days.filter((d) => d.schedule_id === s.id) }));
}

/**
 * The assignment in force for an employee on a date: the latest one starting on
 * or before it whose end has not passed.
 *
 * Falls back to the company default when the employee has no assignment, which is
 * the state every employee is in until HR assigns them. `source` says which of
 * the two answered, because "judged against the company default" and "judged
 * against the shift HR chose" are different facts and the UI should not blur them.
 *
 * @returns {Promise<{schedule_id: number, source: 'assignment'|'company_default'}|null>}
 */
export async function resolveScheduleId(employeeId, dateStr, db = pool) {
  const [[assigned]] = await db.query(
    `SELECT schedule_id FROM employee_work_schedules
      WHERE employee_id = ? AND effective_from <= ?
        AND (effective_to IS NULL OR effective_to >= ?)
      ORDER BY effective_from DESC LIMIT 1`, [employeeId, dateStr, dateStr]);
  if (assigned) return { schedule_id: assigned.schedule_id, source: 'assignment' };

  const [[fallback]] = await db.query(
    `SELECT ws.id FROM work_schedules ws
       JOIN employees e ON e.company_id = ws.company_id
      WHERE e.id = ? AND ws.is_default = TRUE AND ws.active = TRUE
      LIMIT 1`, [employeeId]);
  return fallback ? { schedule_id: fallback.id, source: 'company_default' } : null;
}

/**
 * The whole answer for one employee-day: the schedule, the resolved rule and the
 * snapshot. Returns null when no schedule can be resolved at all — the evaluator
 * will treat that as its own exception rather than guessing a shift.
 */
export async function resolveEffectiveSchedule(employeeId, dateStr, db = pool) {
  const resolved = await resolveScheduleId(employeeId, dateStr, db);
  if (!resolved) return null;
  const schedule = await getScheduleWithDays(resolved.schedule_id, db);
  if (!schedule) return null;
  const dayRule = resolveDayRule(schedule, dateStr);
  return { schedule, dayRule, source: resolved.source, snapshot: scheduleSnapshot(schedule, dayRule) };
}

/**
 * The assignment history for an employee, newest first, with schedule names.
 * Dates come back as strings — see the note at the top of this file.
 */
export async function assignmentHistory(employeeId, db = pool) {
  const [rows] = await db.query(
    `SELECT ews.id, ews.schedule_id, ews.note,
            DATE_FORMAT(ews.effective_from, '%Y-%m-%d') effective_from,
            DATE_FORMAT(ews.effective_to, '%Y-%m-%d') effective_to,
            ws.name_en, ws.name_ar, u.name AS assigned_by_name
       FROM employee_work_schedules ews
       JOIN work_schedules ws ON ws.id = ews.schedule_id
       LEFT JOIN users u ON u.id = ews.assigned_by
      WHERE ews.employee_id = ?
      ORDER BY ews.effective_from DESC`, [employeeId]);
  return rows;
}

/**
 * Holidays covering a date range, for a company. A row with a NULL company_id
 * applies to every company.
 */
export async function holidaysBetween(companyId, from, to, db = pool) {
  const [rows] = await db.query(
    `SELECT id, company_id, DATE_FORMAT(holiday_date, '%Y-%m-%d') holiday_date,
            name_en, name_ar, is_half_day, notes
       FROM holidays
      WHERE holiday_date BETWEEN ? AND ?
        AND (company_id IS NULL OR company_id = ?)
      ORDER BY holiday_date`, [from, to, companyId || 0]);
  return rows;
}
