/**
 * Leave balances beyond the yearly entitlement: the adjustment ledger.
 *
 * The entitlement itself still comes from the policy (service-based annual
 * leave, a type's default days, or an explicit `leave_balances.entitled`
 * override). On top of it sit ledger rows, each with a written reason:
 *
 *   Opening        days brought in when the system started (CSV import)
 *   Adjustment     a correction either way
 *   Carry Forward  unused days from the year before, up to the type's limit
 *   Lapse          carried days that expired unused (negative)
 *   Encashment     days paid out through payroll instead of taken (negative)
 *
 * Remaining = entitlement + sum(ledger) − used. Payroll uses the same sum, so
 * days carried or opened are paid when taken, and days encashed are not.
 *
 * Pure functions here; the routes do the storing.
 */

export const ADJUSTMENT_KINDS = ['Opening', 'Adjustment', 'Carry Forward', 'Lapse', 'Encashment'];
/** Kinds HR enters by hand. The others are written by year-end and encashment actions. */
export const MANUAL_KINDS = ['Opening', 'Adjustment'];
export const DAY_BASES = ['calendar', 'working'];

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

/** Validate a manual ledger row. Opening balances are never negative. */
export function validateAdjustment({ kind, days, reason }) {
  if (!MANUAL_KINDS.includes(kind)) return { error: 'Choose opening balance or adjustment' };
  const d = round2(days);
  if (!Number.isFinite(d) || d === 0) return { error: 'Enter the number of days' };
  if (Math.abs(d) > 366) return { error: 'That is more than a year of leave' };
  if (kind === 'Opening' && d < 0) return { error: 'An opening balance cannot be negative' };
  const why = String(reason || '').trim();
  if (why.length < 3) return { error: 'Give a reason' };
  return { data: { kind, days: d, reason: why.slice(0, 500) } };
}

/**
 * Days to carry into the next year.
 * @param {number} remaining unused days at the end of the year
 * @param {number|null} maxDays the type's limit; null = no limit, 0 = none carried
 */
export function carryForwardDays(remaining, maxDays) {
  const r = Math.max(0, round2(remaining));
  if (maxDays == null) return r;
  return Math.min(r, Math.max(0, round2(maxDays)));
}

/** The date carried days expire on: the last day of the Nth month of the year, or null. */
export function carryExpiry(toYear, months) {
  if (months == null || !(Number(months) > 0)) return null;
  const m = Math.min(12, Math.round(Number(months)));
  const last = new Date(Date.UTC(toYear, m, 0)).getUTCDate();
  return `${toYear}-${String(m).padStart(2, '0')}-${String(last).padStart(2, '0')}`;
}

/**
 * Carried days that lapse at expiry. Carried days are used first, so whatever
 * was taken by the expiry date comes out of them.
 */
export function lapsedDays(carried, usedByExpiry) {
  return Math.max(0, round2(Number(carried) - Math.max(0, Number(usedByExpiry) || 0)));
}

/** Pay for encashed days: basic / 30 a day, as the final settlement does. */
export function encashmentAmount(basic, days) {
  return round2((Number(basic) || 0) / 30 * (Number(days) || 0));
}

/** Every 'YYYY-MM-DD' from `from` to `to` inclusive (at most 400). */
export function datesBetween(from, to) {
  const p = (s) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ''));
    return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : null;
  };
  const out = [];
  let cur = p(from);
  const end = p(to);
  if (cur == null || end == null || cur > end) return out;
  for (let guard = 0; cur <= end && guard < 400; guard++, cur += 86_400_000) {
    out.push(new Date(cur).toISOString().slice(0, 10));
  }
  return out;
}

/**
 * How many days a request costs.
 *
 * Calendar types count every date. Working-day types skip the employee's rest
 * days and public holidays; a half-day holiday counts as half.
 *
 * @param {string[]} dates
 * @param {{basis:string, isWorking:(date:string)=>boolean, holidays:Map<string,{half:boolean,name:string}>}} opts
 * @returns {{days:number, excluded:{date:string, why:'rest'|'holiday', name?:string}[]}}
 */
export function countLeaveDays(dates, { basis = 'calendar', isWorking = () => true, holidays = new Map() } = {}) {
  if (basis !== 'working') return { days: dates.length, excluded: [] };
  let days = 0;
  const excluded = [];
  for (const d of dates) {
    if (!isWorking(d)) { excluded.push({ date: d, why: 'rest' }); continue; }
    const h = holidays.get(d);
    if (h && !h.half) { excluded.push({ date: d, why: 'holiday', name: h.name }); continue; }
    days += h?.half ? 0.5 : 1;
  }
  return { days: round2(days), excluded };
}

/**
 * Advisory checks shown before a request is sent. None of them blocks: HR
 * decides, and a policy exception is theirs to make.
 * @returns {string[]} warning codes
 */
export function requestWarnings({ type, days, serviceMonths, noticeGiven, remaining, hasOverlap }) {
  const w = [];
  if (type.eligibility_months && serviceMonths != null && serviceMonths < Number(type.eligibility_months)) w.push('eligibility');
  if (type.max_days_per_request && days > Number(type.max_days_per_request)) w.push('max_per_request');
  if (type.notice_days && noticeGiven != null && noticeGiven < Number(type.notice_days)) w.push('notice');
  if (type.requires_document) w.push('document');
  if (remaining != null && days > remaining) w.push('over_balance');
  if (hasOverlap) w.push('overlap');
  return w;
}

/**
 * Parse an opening-balances CSV: employee, leave type, days, reason (optional).
 * The first row may be a header. Commas inside quotes are kept.
 * @returns {{rows:{line:number, employee:string, leave_type:string, days:number, reason:string}[], errors:{line:number, error:string}[]}}
 */
export function parseOpeningCsv(text) {
  const rows = [];
  const errors = [];
  const lines = String(text || '').replace(/^﻿/, '').split(/\r?\n/);
  lines.forEach((raw, i) => {
    const line = i + 1;
    if (!raw.trim()) return;
    const cells = splitCsvLine(raw).map((c) => c.trim());
    if (i === 0 && /employee/i.test(cells[0] || '') && !/^\d/.test(cells[2] || '')) return; // header
    const [employee, leaveType, daysText, ...rest] = cells;
    const days = Number(String(daysText || '').replace(',', '.'));
    if (!employee) { errors.push({ line, error: 'No employee' }); return; }
    if (!leaveType) { errors.push({ line, error: 'No leave type' }); return; }
    if (!Number.isFinite(days) || days < 0 || days > 366) { errors.push({ line, error: 'Days must be a number from 0 to 366' }); return; }
    rows.push({ line, employee, leave_type: leaveType, days: round2(days), reason: rest.join(',').trim() });
  });
  return { rows, errors };
}

function splitCsvLine(s) {
  const out = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (quoted) {
      if (ch === '"' && s[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',' || ch === ';') { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

/** An .ics calendar entry for an approved leave (all-day, end exclusive). */
export function leaveIcs({ uid, title, start, end, description = '' }) {
  const ymd = (s) => s.replaceAll('-', '');
  const next = new Date(Date.UTC(+end.slice(0, 4), +end.slice(5, 7) - 1, +end.slice(8, 10) + 1)).toISOString().slice(0, 10);
  const esc = (v) => String(v).replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n');
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//IST HR//Leave//EN', 'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT', `UID:${uid}`, `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${ymd(start)}`, `DTEND;VALUE=DATE:${ymd(next)}`,
    `SUMMARY:${esc(title)}`, ...(description ? [`DESCRIPTION:${esc(description)}`] : []),
    'TRANSP:OPAQUE', 'END:VEVENT', 'END:VCALENDAR', '',
  ].join('\r\n');
}
