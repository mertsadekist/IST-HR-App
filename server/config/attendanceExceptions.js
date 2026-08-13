/**
 * The vocabulary of the attendance evaluator: what can be wrong with a day, how
 * serious it is, and where a case can get to.
 *
 * Phase 2 of docs/attendance_schedules_and_exceptions_plan.md. Shared by the
 * evaluator, the API and the UI so all three agree on the words.
 *
 * The list is deliberately short. The original draft proposed thirteen statuses
 * and a longer type list; every extra one is a decision HR has to make about a
 * ten-minute overrun, and a queue nobody can keep up with gets rubber-stamped,
 * which is worse than no queue at all.
 */

/**
 * `terminal` is the important field. A day that hits a terminal type stops being
 * evaluated there — no hours, no lateness, no early departure are computed from
 * data already known to be incomplete. Without it, one forgotten punch generates
 * four separate cases about the same day.
 */
export const EXCEPTION_TYPES = Object.freeze({
  // No schedule resolves at all: no assignment and no company default. The
  // evaluator refuses to guess a shift rather than inventing nine-to-five.
  NO_SCHEDULE: { severity: 'Blocking', terminal: true },

  // Checked in and never out — or the same time twice. The device reports the
  // last punch of the day as the departure, so a single punch arrives with the
  // check-out empty.
  MISSING_PUNCH: { severity: 'Blocking', terminal: true },

  // The lunch trap. Somebody who punches out at 13:00 for lunch and forgets to
  // punch back in has 13:00 as their last punch, so the file reports a normal
  // departure at 13:00. The data cannot tell that apart from a genuine very
  // early departure, so the exception says so and asks a human, instead of
  // recording a six-hour early leave against them.
  IMPLAUSIBLE_PUNCH: { severity: 'Blocking', terminal: true },

  // A working day with no punches and no approved leave.
  ABSENT_NO_RECORD: { severity: 'Blocking', terminal: true },

  // Punches on a weekly day off or a holiday. NOT a violation — a compensation
  // candidate. There are already 19 such rows in the live data.
  WORKED_ON_DAY_OFF: { severity: 'Info', terminal: false },

  // Punches on a day covered by approved leave. Informational: the leave may
  // need cancelling, or the person came in anyway.
  LEAVE_OVERLAP: { severity: 'Info', terminal: false },

  LATE_ARRIVAL: { severity: 'Review', terminal: false },
  EARLY_DEPARTURE: { severity: 'Review', terminal: false },

  // Short on the day without either end crossing its own threshold — twenty-five
  // minutes late and twenty-five early, against a thirty-minute case threshold.
  // Neither triggers alone; together they are an hour.
  INSUFFICIENT_HOURS: { severity: 'Review', terminal: false },
});

export const EXCEPTION_TYPE_KEYS = Object.keys(EXCEPTION_TYPES);

export const SEVERITIES = Object.freeze(['Blocking', 'Review', 'Info']);

/**
 * Five places a case can be, plus one the engine sets itself.
 *
 * `Auto-resolved` is what an exception becomes when a re-run finds it no longer
 * applies — HR corrected the punch, or a leave request was approved after the
 * fact. It is closed rather than deleted, so the trail of what was once wrong
 * survives.
 */
export const EXCEPTION_STATUSES = Object.freeze([
  'Open', 'Awaiting Employee', 'Awaiting Manager', 'Resolved', 'Waived', 'Auto-resolved',
]);

export const OPEN_STATUSES = Object.freeze(['Open', 'Awaiting Employee', 'Awaiting Manager']);

/**
 * The statuses the evaluator may propose for a day.
 *
 * Wider than `attendance.status`, which has no value for a weekly day off — days
 * off simply have no row today. Keeping the engine's vocabulary separate means
 * Phase 3 can decide how to map it rather than being forced by the old enum.
 */
export const EVAL_STATUSES = Object.freeze([
  'Present', 'Absent', 'Late', 'Half Day', 'On Leave', 'Holiday', 'Weekend', 'Remote', 'Unknown',
]);

/**
 * Bumped whenever the decision logic changes, and stamped on every row and
 * exception the evaluator writes. It is what makes "this day was judged by the
 * old rules" answerable a year from now, and what a re-evaluation filters on.
 */
export const EVALUATION_VERSION = 1;
