/**
 * Judging one employee-day against the schedule they were supposed to work.
 *
 * Phase 2 of docs/attendance_schedules_and_exceptions_plan.md. This module is
 * **pure** — no database, no clock, no I/O. Everything it needs is passed in,
 * which is deliberate: this is the arithmetic that will eventually decide whether
 * somebody is marked absent, and an absent day costs a full day's gross in
 * payrollService. It has to be testable exhaustively without a fixture.
 *
 * ## The order is the design
 *
 * `evaluateDay` runs top to bottom and **stops at the first terminal step**:
 *
 *   1. no schedule resolves            → NO_SCHEDULE            ┐
 *   2. holiday                         → Holiday                │
 *   3. weekly day off                  → Weekend                │ terminal
 *   4. approved leave covers the date  → On Leave               │
 *   5. no punches at all               → ABSENT_NO_RECORD       │
 *   6. checked in, never out           → MISSING_PUNCH          │
 *   7. implausibly short               → IMPLAUSIBLE_PUNCH      ┘
 *   8. compute late / early / net
 *   9. thresholds → LATE_ARRIVAL, EARLY_DEPARTURE, INSUFFICIENT_HOURS
 *
 * Steps 2–4 still report WORKED_ON_DAY_OFF or LEAVE_OVERLAP if punches exist,
 * because working on a day off is a fact worth surfacing — as compensation, not
 * as a violation.
 *
 * Stopping matters. Steps 6 and 7 deliberately compute no hours: deriving
 * lateness from data already known to be incomplete produces confident nonsense,
 * and one forgotten punch would otherwise raise four cases about the same day.
 *
 * ## What the feed can and cannot say
 *
 * The device reports the **first punch as the arrival and the last as the
 * departure**, and nothing in between. So:
 *
 *  - break time can never be measured; it is deducted from the schedule as
 *    policy (see expectedNetMinutes in workScheduleService);
 *  - a single punch arrives with the check-out empty — detectable, step 6;
 *  - somebody who punches out for lunch and forgets to punch back in has that
 *    lunch punch reported as their departure. Step 7 exists entirely for them.
 *
 * All times are wall-clock, compared in minutes since midnight. No UTC, no Date.
 */
import { minutesOfDay, secondsOfDay, formatMinutes } from './workScheduleService.js';
import { EXCEPTION_TYPES, EVALUATION_VERSION } from '../config/attendanceExceptions.js';

/** Every 'YYYY-MM-DD' from `from` to `to` inclusive, without touching local time. */
export function eachDate(from, to) {
  const out = [];
  const parse = (s) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ''));
    return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : null;
  };
  let cur = parse(from);
  const end = parse(to);
  if (cur == null || end == null || cur > end) return out;
  // A hard stop: a mistyped year would otherwise loop for centuries and the
  // caller would see a hung request rather than a bad parameter.
  for (let guard = 0; cur <= end && guard < 5000; guard++, cur += 86_400_000) {
    out.push(new Date(cur).toISOString().slice(0, 10));
  }
  return out;
}

const exception = (type, detail, extra = {}) => ({
  type,
  severity: EXCEPTION_TYPES[type].severity,
  detail,
  ...extra,
});

/**
 * @param {object}      input
 * @param {string}      input.date        'YYYY-MM-DD'
 * @param {object|null} input.row         the attendance row, or null if none exists
 * @param {object|null} input.schedule    the resolved schedule (thresholds live here)
 * @param {object|null} input.dayRule     resolveDayRule() output for this date
 * @param {object|null} input.holiday     a holidays row covering the date, or null
 * @param {object|null} input.leave       an approved leave request covering it, or null
 * @param {boolean}     [input.observed]  did the feed cover this date at all?
 *
 * @returns {{status: string, late_minutes: number|null, early_leave_minutes: number|null,
 *            worked_minutes: number|null, expected_minutes: number|null,
 *            expected_in: string|null, expected_out: string|null,
 *            exceptions: object[], evaluation_version: number}}
 */
export function evaluateDay({ date, row, schedule, dayRule, holiday = null, leave = null, observed = true }) {
  // Seconds, not minutes: the device rounds lateness to the nearest minute and
  // truncating here would disagree with it on about half of all rows.
  const checkInSec = secondsOfDay(row?.check_in);
  const checkOutSec = secondsOfDay(row?.check_out);
  const checkIn = checkInSec == null ? null : Math.floor(checkInSec / 60);
  const checkOut = checkOutSec == null ? null : Math.floor(checkOutSec / 60);
  const hasAnyPunch = checkInSec != null || checkOutSec != null;

  const base = {
    date,
    status: 'Unknown',
    late_minutes: null,
    early_leave_minutes: null,
    worked_minutes: null,
    expected_minutes: dayRule?.expected_minutes ?? null,
    expected_in: dayRule?.is_working ? formatMinutes(minutesOfDay(dayRule.start_time)) : null,
    expected_out: dayRule?.is_working ? formatMinutes(minutesOfDay(dayRule.end_time)) : null,
    exceptions: [],
    evaluation_version: EVALUATION_VERSION,
  };

  // 1 ── no schedule at all
  if (!schedule || !dayRule) {
    return { ...base, exceptions: [exception('NO_SCHEDULE',
      'No work schedule resolves for this employee — there is no assignment and no company default.')] };
  }

  // 2 ── public or company holiday
  if (holiday) {
    const name = holiday.name_en || 'Holiday';
    return {
      ...base,
      status: 'Holiday',
      expected_minutes: 0,
      exceptions: hasAnyPunch
        ? [exception('WORKED_ON_DAY_OFF', `Worked on ${name}, a holiday. Candidate for time off in lieu or paid compensation.`)]
        : [],
    };
  }

  // 3 ── the weekly day off
  if (!dayRule.is_working) {
    return {
      ...base,
      status: 'Weekend',
      expected_minutes: 0,
      exceptions: hasAnyPunch
        ? [exception('WORKED_ON_DAY_OFF', 'Worked on a scheduled day off. Candidate for time off in lieu or paid compensation.')]
        : [],
    };
  }

  // 4 ── approved leave
  if (leave) {
    const kind = leave.leave_type_name || 'leave';
    return {
      ...base,
      status: 'On Leave',
      exceptions: hasAnyPunch
        ? [exception('LEAVE_OVERLAP', `Punched in while on approved ${kind}. The leave may need cancelling for this day.`)]
        : [],
    };
  }

  // 5 ── absent, but only if the day was actually observed
  //
  // A day the feed never covered is not an absence — it is a day we know nothing
  // about. Without this guard the first run marked all 27 staff absent on 13 Aug
  // purely because that morning's file had not arrived yet. In live mode that is
  // 27 people losing a day's gross to a sync that ran late.
  //
  // Refusing to conclude from missing data is the same principle as steps 6 and 7.
  if (!hasAnyPunch) {
    if (!observed) {
      return { ...base, status: 'Unknown', exceptions: [] };
    }
    return {
      ...base,
      status: 'Absent',
      worked_minutes: 0,
      exceptions: [exception('ABSENT_NO_RECORD',
        'A working day with no punches and no approved leave.')],
    };
  }

  // 6 ── checked in but never out
  //
  // Equal times count too: a single punch is both the first and the last of the
  // day, and some exports report it in both columns rather than leaving one empty.
  if (checkIn == null || checkOut == null || checkOut === checkIn) {
    const present = formatMinutes(checkIn ?? checkOut);
    return {
      ...base,
      status: 'Present',
      exceptions: [exception('MISSING_PUNCH',
        `Only one punch recorded (${present}). Hours cannot be calculated until the missing time is supplied.`)],
    };
  }

  const grossSec = checkOutSec > checkInSec ? checkOutSec - checkInSec : (86_400 - checkInSec) + checkOutSec;
  const netMinutes = Math.max(0, Math.round(grossSec / 60) - (dayRule.break_minutes || 0));
  const expected = dayRule.expected_minutes || 0;

  // 7 ── implausibly short — probably a forgotten punch, possibly a real half day
  //
  // The data cannot tell those apart, so the exception says exactly that and asks
  // a human. Recording it as a four-hour early departure would be a confident
  // accusation built on a guess.
  const halfDayFloor = Math.round(expected * ((schedule.half_day_threshold_pct ?? 50) / 100));
  if (expected > 0 && netMinutes < halfDayFloor) {
    return {
      ...base,
      status: 'Half Day',
      worked_minutes: netMinutes,
      exceptions: [exception('IMPLAUSIBLE_PUNCH',
        `Only ${fmtDuration(netMinutes)} against ${fmtDuration(expected)} expected `
        + `(${formatMinutes(checkIn)}–${formatMinutes(checkOut)}). Either a genuine early departure, `
        + 'or the last punch of the day was a lunch break the employee never returned from.',
        { late_minutes: null, early_leave_minutes: null })],
    };
  }

  // 8 ── the actual arithmetic
  const startAt = minutesOfDay(dayRule.start_time);
  const endAt = minutesOfDay(dayRule.end_time);
  const graceIn = schedule.grace_in_minutes ?? 0;
  const graceOut = schedule.grace_out_minutes ?? 0;

  // Rounded from seconds, matching how the device reports the same figures.
  const lateRaw = startAt == null ? 0 : Math.max(0, Math.round((checkInSec - startAt * 60) / 60));
  const earlyRaw = endAt == null ? 0 : Math.max(0, Math.round((endAt * 60 - checkOutSec) / 60));
  // Within grace, nothing happened. Past it the whole overrun counts, not just
  // the part beyond grace — grace is a tolerance, not a discount.
  const late = lateRaw > graceIn ? lateRaw : 0;
  const early = earlyRaw > graceOut ? earlyRaw : 0;

  // 9 ── thresholds
  const exceptions = [];
  if (late >= (schedule.late_case_minutes ?? 30)) {
    exceptions.push(exception('LATE_ARRIVAL',
      `Arrived ${fmtDuration(late)} after ${formatMinutes(startAt)}.`, { late_minutes: late }));
  }
  if (early >= (schedule.early_case_minutes ?? 30)) {
    exceptions.push(exception('EARLY_DEPARTURE',
      `Left ${fmtDuration(early)} before ${formatMinutes(endAt)}.`, { early_leave_minutes: early }));
  }
  // Short overall without either end crossing its own threshold.
  if (!exceptions.length && expected > 0 && netMinutes < expected - (graceIn + graceOut)) {
    exceptions.push(exception('INSUFFICIENT_HOURS',
      `Worked ${fmtDuration(netMinutes)} against ${fmtDuration(expected)} expected, `
      + 'without either arrival or departure crossing its own threshold.'));
  }

  return {
    ...base,
    status: netMinutes < halfDayFloor ? 'Half Day' : (late > 0 ? 'Late' : 'Present'),
    late_minutes: late,
    early_leave_minutes: early,
    worked_minutes: netMinutes,
    expected_minutes: expected,
    exceptions,
  };
}

/** '1h 25m', for the human-readable detail on an exception. */
export function fmtDuration(minutes) {
  const m = Math.max(0, Math.round(Number(minutes) || 0));
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem ? `${h}h ${rem}m` : `${h}h`;
}

/**
 * Does the engine disagree with what is stored? Used by the shadow-mode
 * comparison, which is the entire point of Phase 2.
 *
 * A row with no stored status is not a disagreement — there is nothing to
 * disagree with. Days with no row at all are reported separately by the runner.
 */
export function diffAgainstStored(evaluated, row) {
  if (!row) return { differs: true, fields: ['status'], stored: null };
  const fields = [];
  if (row.status && evaluated.status !== row.status) fields.push('status');
  const storedLate = row.late_minutes == null ? null : Number(row.late_minutes);
  const storedEarly = row.early_leave_minutes == null ? null : Number(row.early_leave_minutes);
  if (evaluated.late_minutes != null && storedLate != null && evaluated.late_minutes !== storedLate) fields.push('late_minutes');
  if (evaluated.early_leave_minutes != null && storedEarly != null && evaluated.early_leave_minutes !== storedEarly) {
    fields.push('early_leave_minutes');
  }
  return { differs: fields.length > 0, fields, stored: { status: row.status, late: storedLate, early: storedEarly } };
}
