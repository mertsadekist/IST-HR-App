/**
 * Leave balance ledger, carry-forward, day counting — pure unit tests.
 */
import { describe, it, expect } from 'vitest';
import {
  validateAdjustment, carryForwardDays, carryExpiry, lapsedDays, encashmentAmount,
  datesBetween, countLeaveDays, requestWarnings, parseOpeningCsv, leaveIcs,
} from '../services/leaveBalanceService.js';

describe('validateAdjustment', () => {
  it('accepts an opening balance and a negative correction', () => {
    expect(validateAdjustment({ kind: 'Opening', days: '12.5', reason: 'Balance from old system' }).data.days).toBe(12.5);
    expect(validateAdjustment({ kind: 'Adjustment', days: -2, reason: 'Double counted' }).data.days).toBe(-2);
  });
  it('refuses a negative opening, zero days, no reason or a system kind', () => {
    expect(validateAdjustment({ kind: 'Opening', days: -1, reason: 'x y z' }).error).toBeTruthy();
    expect(validateAdjustment({ kind: 'Adjustment', days: 0, reason: 'x y z' }).error).toBeTruthy();
    expect(validateAdjustment({ kind: 'Adjustment', days: 1, reason: '' }).error).toBeTruthy();
    expect(validateAdjustment({ kind: 'Encashment', days: 1, reason: 'abc' }).error).toBeTruthy();
  });
});

describe('carry forward', () => {
  it('carries up to the limit, all with no limit, none at zero', () => {
    expect(carryForwardDays(12, 5)).toBe(5);
    expect(carryForwardDays(3, 5)).toBe(3);
    expect(carryForwardDays(12, null)).toBe(12);
    expect(carryForwardDays(12, 0)).toBe(0);
    expect(carryForwardDays(-4, 5)).toBe(0);
  });
  it('expires at the end of the Nth month', () => {
    expect(carryExpiry(2027, 3)).toBe('2027-03-31');
    expect(carryExpiry(2028, 2)).toBe('2028-02-29');
    expect(carryExpiry(2027, null)).toBeNull();
    expect(carryExpiry(2027, 0)).toBeNull();
  });
  it('lapses what was not used by expiry', () => {
    expect(lapsedDays(5, 2)).toBe(3);
    expect(lapsedDays(5, 9)).toBe(0);
  });
});

describe('encashmentAmount', () => {
  it('is basic / 30 per day', () => {
    expect(encashmentAmount(9000, 4)).toBe(1200);
    expect(encashmentAmount(10000, 1.5)).toBe(500);
  });
});

describe('countLeaveDays', () => {
  const dates = datesBetween('2026-12-01', '2026-12-07'); // Tue..Mon
  it('counts every date on a calendar basis', () => {
    expect(countLeaveDays(dates).days).toBe(7);
  });
  it('skips rest days and holidays on a working-day basis', () => {
    const isWorking = (d) => ![6, 0].includes(new Date(`${d}T00:00:00Z`).getUTCDay()); // Sat, Sun off
    const holidays = new Map([['2026-12-02', { half: false, name: 'National Day' }], ['2026-12-03', { half: true, name: 'Eve' }]]);
    const r = countLeaveDays(dates, { basis: 'working', isWorking, holidays });
    // Tue 1, Wed 2 holiday, Thu 3 half, Fri 4, Sat 5 rest, Sun 6 rest, Mon 7
    expect(r.days).toBe(3.5);
    expect(r.excluded.map((e) => e.why)).toEqual(['holiday', 'rest', 'rest']);
  });
});

describe('requestWarnings', () => {
  it('flags eligibility, length, notice, document, balance and overlap', () => {
    const type = { eligibility_months: 24, max_days_per_request: 10, notice_days: 30, requires_document: 1 };
    expect(requestWarnings({ type, days: 12, serviceMonths: 10, noticeGiven: 5, remaining: 8, hasOverlap: true }))
      .toEqual(['eligibility', 'max_per_request', 'notice', 'document', 'over_balance', 'overlap']);
    expect(requestWarnings({ type: {}, days: 2, serviceMonths: 30, noticeGiven: 60, remaining: 10, hasOverlap: false })).toEqual([]);
  });
});

describe('parseOpeningCsv', () => {
  it('reads rows, skips the header and reports bad lines', () => {
    const csv = 'employee,leave type,days,reason\nali@ist.ae,Annual Leave,12.5,"From old system, 2026"\n\n17,Sick Leave,abc,\n,Annual Leave,3,';
    const r = parseOpeningCsv(csv);
    expect(r.rows).toEqual([{ line: 2, employee: 'ali@ist.ae', leave_type: 'Annual Leave', days: 12.5, reason: 'From old system, 2026' }]);
    expect(r.errors.map((e) => e.line)).toEqual([4, 5]);
  });
});

describe('leaveIcs', () => {
  it('is an all-day event with an exclusive end date', () => {
    const ics = leaveIcs({ uid: 'leave-7@ist', title: 'Annual Leave', start: '2026-12-30', end: '2026-12-31' });
    expect(ics).toContain('DTSTART;VALUE=DATE:20261230');
    expect(ics).toContain('DTEND;VALUE=DATE:20270101');
  });
});
