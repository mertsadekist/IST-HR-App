/**
 * Overtime: found in attendance, approved by HR, paid through payroll.
 *
 * Pure and unit-tested. Nothing is paid because it was detected: a detected day
 * is a Pending record until someone approves it (and may approve fewer minutes
 * than were found), and only approved minutes reach the payroll run.
 *
 * Detection, per attendance day with both punches:
 *   - a working day: minutes present beyond the scheduled span. Arriving late
 *     offsets staying late, so time made up is not overtime. Anything under
 *     MIN_MINUTES is ignored — a few minutes at the door is not overtime.
 *     The part after the scheduled end that falls between 22:00 and 04:00 is
 *     night overtime.
 *   - a rest day or a full holiday: every minute present is rest-day overtime.
 *
 * Pay (UAE Federal Decree-Law 33/2021, art. 19), on the BASIC wage:
 *   hourly rate = basic / 30 / 8
 *   normal x 1.25, night (22:00-04:00) x 1.5, rest day or holiday x 1.5
 * The multipliers are the legal minimums and can be raised in app settings
 * (`overtime_rates`), never lowered below them.
 */
import { minutesOfDay } from './workScheduleService.js';

export const MIN_MINUTES = 30;
export const HOURS_PER_DAY = 8;
export const LEGAL_RATES = { normal: 1.25, night: 1.5, rest: 1.5 };

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const DAY = 24 * 60;
const NIGHT_START = 22 * 60;
const NIGHT_END = 4 * 60;

/** Settings may raise a rate; anything missing or below the legal minimum falls back to it. */
export function effectiveRates(configured) {
  let cfg = configured;
  if (typeof cfg === 'string') { try { cfg = JSON.parse(cfg); } catch { cfg = null; } }
  const out = { ...LEGAL_RATES };
  for (const k of Object.keys(LEGAL_RATES)) {
    const v = Number(cfg?.[k]);
    if (Number.isFinite(v) && v >= LEGAL_RATES[k]) out[k] = v;
  }
  return out;
}

/** Minutes of [a, b) (absolute minutes, b may pass midnight) inside 22:00-04:00. */
function nightOverlap(a, b) {
  let total = 0;
  // Night windows that can touch a span starting on day 0: [22:00, 28:00) of the
  // previous, same and next day.
  for (const base of [-DAY, 0, DAY]) {
    const ws = base + NIGHT_START, we = base + DAY + NIGHT_END;
    total += Math.max(0, Math.min(b, we) - Math.max(a, ws));
  }
  return total;
}

/**
 * @param {object} input
 * @param {string} input.checkIn  'HH:MM[:SS]'
 * @param {string} input.checkOut 'HH:MM[:SS]' (before checkIn = next day)
 * @param {{is_working:boolean, start_time:string, end_time:string}|null} input.dayRule
 * @param {boolean} [input.restDay] a full holiday, or no working rule for the day
 * @returns {{normal_minutes:number, night_minutes:number, rest_minutes:number}|null}
 */
export function detectOvertime({ checkIn, checkOut, dayRule, restDay = false }) {
  const inM = minutesOfDay(String(checkIn || '').slice(0, 5));
  const outRaw = minutesOfDay(String(checkOut || '').slice(0, 5));
  if (inM == null || outRaw == null) return null;
  const outM = outRaw >= inM ? outRaw : outRaw + DAY;
  const present = outM - inM;
  if (present <= 0) return null;

  if (restDay || !dayRule || !dayRule.is_working) {
    if (present < MIN_MINUTES) return null;
    return { normal_minutes: 0, night_minutes: 0, rest_minutes: present };
  }

  const start = minutesOfDay(dayRule.start_time);
  const endRaw = minutesOfDay(dayRule.end_time);
  if (start == null || endRaw == null) return null;
  const end = endRaw >= start ? endRaw : endRaw + DAY;
  const extra = present - (end - start);
  if (extra < MIN_MINUTES) return null;

  // Night minutes only come from staying after the scheduled end.
  const after = Math.max(0, outM - end);
  const night = Math.min(extra, nightOverlap(end, end + after));
  return { normal_minutes: extra - night, night_minutes: night, rest_minutes: 0 };
}

/**
 * @param {{normal_minutes:number, night_minutes:number, rest_minutes:number}} minutes
 * @param {number} basicSalary monthly basic
 * @param {{normal:number, night:number, rest:number}} [rates]
 */
export function overtimePay(minutes, basicSalary, rates = LEGAL_RATES) {
  const hourly = Math.max(0, Number(basicSalary) || 0) / 30 / HOURS_PER_DAY;
  const part = (m, r) => (Math.max(0, Number(m) || 0) / 60) * hourly * r;
  const amount = round2(part(minutes.normal_minutes, rates.normal)
    + part(minutes.night_minutes, rates.night) + part(minutes.rest_minutes, rates.rest));
  const hrs = (m) => round2((Number(m) || 0) / 60);
  const bits = [];
  if (minutes.normal_minutes > 0) bits.push(`${hrs(minutes.normal_minutes)} h x ${rates.normal}`);
  if (minutes.night_minutes > 0) bits.push(`${hrs(minutes.night_minutes)} h night x ${rates.night}`);
  if (minutes.rest_minutes > 0) bits.push(`${hrs(minutes.rest_minutes)} h rest day x ${rates.rest}`);
  return {
    amount,
    hourly_rate: round2(hourly),
    explanation: bits.length ? `${bits.join(' + ')} at ${round2(hourly).toFixed(2)}/h (basic / 30 / ${HOURS_PER_DAY})` : '',
  };
}
