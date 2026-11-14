/**
 * Shifts by date, on top of the weekly work schedule.
 *
 * A weekly schedule says what a normal week looks like. A shift assignment says
 * what one particular day is for one person: a different schedule's hours (a
 * morning person covering an evening), or a day off (working the weekend and
 * resting on Tuesday). It wins over the weekly schedule for that date only.
 *
 * Everything that judges a day — the attendance evaluator, the door sync,
 * overtime detection, working-day leave counting — resolves a schedule and then
 * asks it for the day's rule. So an override is expressed as a schedule whose
 * rule for that date is the shift, and nothing downstream needs to know.
 *
 * Pure functions; the database side is in workScheduleService.js.
 */
import { weekdayOf, minutesOfDay } from './workScheduleService.js';

const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6];

/**
 * The hours a shift schedule gives a date: that weekday's hours if it works
 * that weekday, else the schedule's first working day. Painting "Morning" on a
 * Saturday means morning hours on Saturday, even if the template rests then.
 */
export function shiftDayTemplate(schedule, date) {
  const days = schedule?.days || [];
  const wd = weekdayOf(date);
  const own = days.find((d) => Number(d.weekday) === wd && d.is_working);
  return own || days.find((d) => d.is_working) || null;
}

/**
 * Apply a date's override to the schedule resolved from the weekly assignment.
 *
 * @param {{schedule:object, source:string}|null} base   what the weekly assignment gives
 * @param {{schedule_id:number|null, is_off:boolean|number}|undefined} override
 * @param {Map<number, object>} schedulesById           schedules with their days
 * @param {string} date 'YYYY-MM-DD'
 * @returns {{schedule:object, source:string}|null}
 */
export function withShiftOverride(base, override, schedulesById, date) {
  if (!override) return base;
  if (override.is_off) {
    const from = base?.schedule || { id: null, name_en: 'Day off', grace_in_minutes: 0, grace_out_minutes: 0 };
    return {
      schedule: { ...from, days: WEEKDAYS.map((weekday) => ({ weekday, is_working: 0, start_time: null, end_time: null, break_minutes: 0 })) },
      source: 'day_off',
    };
  }
  const s = schedulesById.get(Number(override.schedule_id));
  const tpl = s ? shiftDayTemplate(s, date) : null;
  if (!tpl) return base;
  return {
    schedule: { ...s, days: WEEKDAYS.map((weekday) => ({ ...tpl, weekday, is_working: 1 })) },
    source: 'shift',
  };
}

/** A shift that ends on the next calendar day (22:00–06:00). */
export function crossesMidnight(dayRule) {
  if (!dayRule?.is_working || !dayRule.start_time || !dayRule.end_time) return false;
  return minutesOfDay(dayRule.end_time) <= minutesOfDay(dayRule.start_time);
}

export const LIVE_STATES = ['in', 'late', 'not_in', 'expected', 'on_leave', 'absent', 'rest', 'no_schedule'];

/**
 * Where someone is right now, for today's board.
 *
 * @param {object} input
 * @param {{check_in?:string|null, check_out?:string|null, status?:string, late_minutes?:number|null}|null} input.row
 * @param {object|null} input.dayRule   today's rule (null = no schedule)
 * @param {object|null} input.schedule  for the grace minutes
 * @param {boolean} input.holiday       a full-day public holiday
 * @param {boolean} input.onLeave       approved full-day leave today
 * @param {number}  input.nowSec        seconds since local midnight
 */
export function liveState({ row, dayRule, schedule, holiday = false, onLeave = false, nowSec }) {
  // The door feed keeps the first and the latest punch, not in/out direction,
  // so someone who punched is shown as in, with the time last seen.
  if (row?.check_in) {
    return Number(row.late_minutes) > 0 || row.status === 'Late' ? 'late' : 'in';
  }
  if (row?.status === 'On Leave' || onLeave) return 'on_leave';
  if (row?.status === 'Absent') return 'absent';
  if (holiday) return 'rest';
  if (!dayRule) return 'no_schedule';
  if (!dayRule.is_working) return 'rest';
  const startSec = minutesOfDay(dayRule.start_time) * 60;
  const grace = Number(schedule?.grace_in_minutes || 0) * 60;
  return nowSec > startSec + grace ? 'not_in' : 'expected';
}
