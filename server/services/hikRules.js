/**
 * What a day's door punches mean — pure, no database, no clock, no network.
 *
 * ## The rule this whole sync rests on
 *
 * The only reader is on the office entrance door, so a person's day is described
 * by every time they were let in:
 *
 *   - the FIRST punch of the day is the arrival (check-in);
 *   - the LAST punch of the day is the departure (check-out).
 *
 * Nothing in between is interpreted. Someone who goes out for lunch and taps
 * back in simply moves their "last punch" later, which is exactly right.
 *
 * Two refinements keep that rule honest:
 *
 *   - a second tap within `minStayMinutes` of the first is a double-tap on the
 *     reader, not a departure, so the day still has no check-out;
 *   - for a day that is not over yet, the last punch is only "last seen so far".
 *     It is stored (HR wants to see who is in) but never judged: no early-leave
 *     is computed for today, and a single punch is not a "missing" one until the
 *     day has ended.
 *
 * All times are office wall-clock strings, compared as seconds since midnight.
 * Nothing here builds a Date from one, so the server's timezone cannot shift a
 * punch to the wrong side of a schedule.
 */
import { secondsOfDay, minutesOfDay } from './workScheduleService.js';

/** `date` plus `n` days, as 'YYYY-MM-DD', without touching local time. */
export function addDays(date, n) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(date || ''));
  if (!m) return null;
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]) + n * 86_400_000).toISOString().slice(0, 10);
}

/** Whole days from `a` to `b` ('YYYY-MM-DD'), or NaN. */
export function daysBetween(a, b) {
  const pa = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(a || ''));
  const pb = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(b || ''));
  if (!pa || !pb) return NaN;
  return Math.round((Date.UTC(+pb[1], +pb[2] - 1, +pb[3]) - Date.UTC(+pa[1], +pa[2] - 1, +pa[3])) / 86_400_000);
}

/** The calendar date it is right now in `tz`, as 'YYYY-MM-DD'. */
export function localDate(tz, now = new Date()) {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now);
}

/** Seconds since midnight, local to `tz`, for `now`. */
export function localSecondsOfDay(tz, now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(now);
  const get = (t) => Number(parts.find((p) => p.type === t)?.value || 0);
  return get('hour') * 3600 + get('minute') * 60 + get('second');
}

/**
 * Door events -> one bucket per person per day.
 *
 * @param {{person_id: string, person_name?: string, punched_at: string}[]} events
 *   punched_at is 'YYYY-MM-DD HH:MM:SS' in office wall-clock.
 * @returns {Map<string, {person_id: string, person_name: string, date: string, times: string[]}>}
 *   keyed `${person_id}|${date}`, times sorted ascending and de-duplicated.
 */
export function groupPunches(events) {
  const buckets = new Map();
  for (const e of events || []) {
    const m = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})/.exec(String(e.punched_at || ''));
    const person = String(e.person_id ?? '').trim();
    if (!m || !person) continue;
    const key = `${person}|${m[1]}`;
    let b = buckets.get(key);
    if (!b) {
      b = { person_id: person, person_name: '', date: m[1], times: [] };
      buckets.set(key, b);
    }
    if (!b.person_name && e.person_name) b.person_name = String(e.person_name).trim();
    b.times.push(m[2]);
  }
  for (const b of buckets.values()) b.times = [...new Set(b.times)].sort();
  return buckets;
}

const round2 = (n) => Math.round(n * 100) / 100;

/**
 * The attendance fields for a day somebody punched on.
 *
 * @param {object} input
 * @param {string[]} input.times        sorted 'HH:MM:SS' punches, at least one
 * @param {string}   input.date         'YYYY-MM-DD'
 * @param {string}   input.today        'YYYY-MM-DD' in the office timezone
 * @param {object|null} input.schedule  resolved schedule (grace lives here)
 * @param {object|null} input.dayRule   resolveDayRule() output for the date
 * @param {number}   [input.minStayMinutes]
 */
export function deriveDay({ times, date, today, schedule = null, dayRule = null, minStayMinutes = 30 }) {
  const firstSec = secondsOfDay(times[0]);
  const lastSec = secondsOfDay(times[times.length - 1]);
  const complete = date < today;

  const closes = times.length > 1 && (lastSec - firstSec) >= minStayMinutes * 60;
  const checkIn = times[0];
  const checkOut = closes ? times[times.length - 1] : null;

  const working = !!(dayRule && dayRule.is_working);
  const startMin = working ? minutesOfDay(dayRule.start_time) : null;
  const endMin = working ? minutesOfDay(dayRule.end_time) : null;
  const graceIn = schedule?.grace_in_minutes ?? 0;
  const graceOut = schedule?.grace_out_minutes ?? 0;

  // Rounded from seconds — the same convention as the evaluator, so the two
  // never disagree by a minute over the same punch.
  const lateRaw = startMin == null ? 0 : Math.max(0, Math.round((firstSec - startMin * 60) / 60));
  const late = lateRaw > graceIn ? lateRaw : 0;

  // Early departure is a verdict on a finished day. Today's "last punch" is only
  // the latest seen, and calling someone early for it at 11:00 would be false.
  const earlyRaw = (complete && checkOut && endMin != null)
    ? Math.max(0, Math.round((endMin * 60 - lastSec) / 60)) : 0;
  const early = earlyRaw > graceOut ? earlyRaw : 0;

  return {
    check_in: checkIn,
    check_out: checkOut,
    work_hours: checkOut ? round2((lastSec - firstSec) / 3600) : null,
    late_minutes: late || null,
    early_leave_minutes: early || null,
    scheduled_in: working ? dayRule.start_time : null,
    scheduled_out: working ? dayRule.end_time : null,
    status: late > 0 ? 'Late' : 'Present',
    punch_count: times.length,
    complete,
    // Only a finished day can be missing its departure; today is simply in progress.
    missing_checkout: complete && !checkOut,
    in_progress: !complete,
  };
}

/**
 * What to record for somebody who never punched on a finished working day.
 *
 * Returns `{ skip }` whenever the honest answer is "we cannot say": an absence
 * written from missing data costs a person a day's pay, so every doubt resolves
 * to not writing one.
 *
 * @returns {{status: 'Absent'|'On Leave', leave_type?: string, partial_leave?: boolean}
 *          | {skip: 'not_observed'|'no_schedule'|'holiday'|'rest_day'}}
 */
export function deriveAbsence({ schedule, dayRule, holiday = null, leave = null, observed = true }) {
  // The feed produced nothing at all for the day — it was down, or the table was
  // not being filled. That is a day we know nothing about, not an empty office.
  if (!observed) return { skip: 'not_observed' };
  if (!schedule || !dayRule) return { skip: 'no_schedule' };
  if (holiday) return { skip: 'holiday' };
  if (!dayRule.is_working) return { skip: 'rest_day' };
  if (leave?.is_full_day) return { status: 'On Leave', leave_type: leave.leave_type_name || 'leave' };
  return { status: 'Absent', ...(leave ? { partial_leave: true, leave_type: leave.leave_type_name || 'leave' } : {}) };
}

/** The `notes` text stored on an attendance row. */
export function describeDay(d) {
  return [
    `${d.punch_count} door punch${d.punch_count === 1 ? '' : 'es'}`,
    d.late_minutes ? `late ${d.late_minutes}m` : null,
    d.early_leave_minutes ? `left early ${d.early_leave_minutes}m` : null,
    d.in_progress ? 'day in progress — last punch so far' : null,
    d.missing_checkout ? 'single punch — no check-out recorded' : null,
  ].filter(Boolean).join(' · ').slice(0, 500);
}
