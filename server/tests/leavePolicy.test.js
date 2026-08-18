/**
 * The leave policy arithmetic, exhaustively and without a database.
 *
 * This decides how much of somebody's salary is withheld when they are ill or on
 * maternity leave, so every boundary in the policy is pinned here — including the
 * ones that only matter on the day somebody crosses them.
 */
import { describe, it, expect } from 'vitest';
import {
  completedMonths, annualEntitlement, splitAcrossTiers, tiersFromIsPaid, leaveDeductionForPeriod,
} from '../services/leavePolicyService.js';

// Policy: 90 days a year — 15 at full pay, 30 at half, 45 unpaid.
const SICK = [
  { from_day: 1, to_day: 15, pay_factor: 1 },
  { from_day: 16, to_day: 45, pay_factor: 0.5 },
  { from_day: 46, to_day: 90, pay_factor: 0 },
];
// Policy: 60 days — 45 full, 15 half — then up to 45 unpaid for complications.
const MATERNITY = [
  { from_day: 1, to_day: 45, pay_factor: 1 },
  { from_day: 46, to_day: 60, pay_factor: 0.5 },
  { from_day: 61, to_day: 105, pay_factor: 0 },
];

describe('completedMonths', () => {
  it('counts a month only once the date comes round again', () => {
    expect(completedMonths('2026-01-15', '2026-02-14')).toBe(0);
    expect(completedMonths('2026-01-15', '2026-02-15')).toBe(1);
    expect(completedMonths('2026-01-15', '2026-02-16')).toBe(1);
  });

  it('counts a full year', () => {
    expect(completedMonths('2025-08-14', '2026-08-14')).toBe(12);
    expect(completedMonths('2025-08-15', '2026-08-14')).toBe(11);
  });

  it('never goes negative for a future start date', () => {
    expect(completedMonths('2027-01-01', '2026-08-14')).toBe(0);
  });

  it('returns zero rather than NaN for junk', () => {
    expect(completedMonths(null, '2026-08-14')).toBe(0);
    expect(completedMonths('2026-08-14', 'tomorrow')).toBe(0);
  });
});

describe('annualEntitlement', () => {
  it('gives thirty days once a year of service is complete', () => {
    expect(annualEntitlement('2025-01-01', '2026-08-14')).toBe(30);
    expect(annualEntitlement('2025-08-14', '2026-08-14')).toBe(30);
  });

  it('accrues two days per completed month between six and twelve', () => {
    expect(annualEntitlement('2026-02-14', '2026-08-14')).toBe(12);  // 6 months
    expect(annualEntitlement('2026-01-14', '2026-08-14')).toBe(14);  // 7 months
    expect(annualEntitlement('2025-09-14', '2026-08-14')).toBe(22);  // 11 months
  });

  it('gives nothing statutory below six months', () => {
    // Not an oversight — anything granted here is Management's discretion, which
    // the system records as an explicit balance override rather than a rule.
    expect(annualEntitlement('2026-03-14', '2026-08-14')).toBe(0);   // 5 months
    expect(annualEntitlement('2026-08-05', '2026-08-14')).toBe(0);
  });

  it('steps cleanly across each boundary', () => {
    expect(annualEntitlement('2026-02-15', '2026-08-14')).toBe(0);   // 5 months
    expect(annualEntitlement('2026-02-14', '2026-08-14')).toBe(12);  // 6 months
    expect(annualEntitlement('2025-08-15', '2026-08-14')).toBe(22);  // 11 months
    expect(annualEntitlement('2025-08-14', '2026-08-14')).toBe(30);  // 12 months
  });
});

describe('splitAcrossTiers — sick leave', () => {
  it('pays the first fifteen days in full', () => {
    const s = splitAcrossTiers(SICK, 0, 15);
    expect(s).toMatchObject({ full_days: 15, half_days: 0, unpaid_days: 0, deduction_days: 0 });
  });

  it('splits a twenty-day absence into fifteen full and five half', () => {
    const s = splitAcrossTiers(SICK, 0, 20);
    expect(s.full_days).toBe(15);
    expect(s.half_days).toBe(5);
    expect(s.deduction_days).toBe(2.5);
  });

  it('charges the same twenty days differently once twelve are already used', () => {
    // The whole reason the tier depends on prior use. Three days of full pay
    // remain, and the other seventeen fall to half.
    const s = splitAcrossTiers(SICK, 12, 20);
    expect(s.full_days).toBe(3);
    expect(s.half_days).toBe(17);
    expect(s.deduction_days).toBe(8.5);
  });

  it('reaches the unpaid band after forty-five days', () => {
    const s = splitAcrossTiers(SICK, 45, 10);
    expect(s.full_days).toBe(0);
    expect(s.half_days).toBe(0);
    expect(s.unpaid_days).toBe(10);
    expect(s.deduction_days).toBe(10);
  });

  it('covers the whole ninety days in one request correctly', () => {
    const s = splitAcrossTiers(SICK, 0, 90);
    expect(s).toMatchObject({ full_days: 15, half_days: 30, unpaid_days: 45 });
    expect(s.deduction_days).toBe(60);   // 30 × 0.5 + 45 × 1
  });

  it('treats everything past the ninetieth day as unpaid', () => {
    // A policy that stops at ninety is not granting the ninety-first at full pay
    // by having said nothing about it.
    const s = splitAcrossTiers(SICK, 90, 5);
    expect(s.unpaid_days).toBe(5);
    expect(s.deduction_days).toBe(5);
  });

  it('handles a request that straddles the end of the schedule', () => {
    const s = splitAcrossTiers(SICK, 88, 4);
    expect(s.unpaid_days).toBe(4);
    expect(s.deduction_days).toBe(4);
  });
});

describe('splitAcrossTiers — maternity', () => {
  it('pays the first forty-five days in full', () => {
    expect(splitAcrossTiers(MATERNITY, 0, 45).deduction_days).toBe(0);
  });

  it('drops to half pay for the last fifteen of the sixty', () => {
    const s = splitAcrossTiers(MATERNITY, 0, 60);
    expect(s.full_days).toBe(45);
    expect(s.half_days).toBe(15);
    expect(s.deduction_days).toBe(7.5);
  });

  it('makes the complication days unpaid', () => {
    const s = splitAcrossTiers(MATERNITY, 60, 45);
    expect(s.unpaid_days).toBe(45);
    expect(s.deduction_days).toBe(45);
  });
});

describe('splitAcrossTiers — fractions of a day', () => {
  it('consumes only the fraction requested', () => {
    // An hour's lateness explained as leave is 0.13 of a day. Rounding it up is
    // how somebody loses a whole day's pay for a blood test.
    const s = splitAcrossTiers(tiersFromIsPaid(false), 0, 0.13);
    expect(s.unpaid_days).toBe(0.13);
    expect(s.deduction_days).toBe(0.13);
  });

  it('costs nothing at all when the type is paid', () => {
    expect(splitAcrossTiers(tiersFromIsPaid(true), 0, 0.13).deduction_days).toBe(0);
  });

  it('splits a fraction that lands on a tier boundary', () => {
    // Half a day starting at 14.75 used: 0.25 at full pay, 0.25 at half.
    const s = splitAcrossTiers(SICK, 14.75, 0.5);
    expect(s.full_days).toBe(0.25);
    expect(s.half_days).toBe(0.25);
    expect(s.deduction_days).toBe(0.13);
  });
});

describe('splitAcrossTiers — degenerate input', () => {
  it('returns nothing for a zero-length request', () => {
    expect(splitAcrossTiers(SICK, 0, 0).deduction_days).toBe(0);
  });

  it('treats a type with no tiers at all as unpaid rather than free', () => {
    // Failing open here would silently pay for everything.
    const s = splitAcrossTiers([], 0, 3);
    expect(s.unpaid_days).toBe(3);
    expect(s.deduction_days).toBe(3);
  });

  it('reproduces the old flat behaviour from is_paid', () => {
    expect(splitAcrossTiers(tiersFromIsPaid(true), 0, 10).deduction_days).toBe(0);
    expect(splitAcrossTiers(tiersFromIsPaid(false), 0, 10).deduction_days).toBe(10);
  });

  it('clamps a nonsensical pay factor instead of paying more than full', () => {
    const s = splitAcrossTiers([{ from_day: 1, to_day: null, pay_factor: 3 }], 0, 5);
    expect(s.deduction_days).toBe(0);
    expect(s.full_days).toBe(5);
  });
});

describe('leaveDeductionForPeriod — a date cannot be charged twice', () => {
  const UNPAID = new Map([[1, [{ from_day: 1, to_day: null, pay_factor: 0 }]]]);
  const pools = new Map([[1, 1]]);
  const caps = new Map([[1, null]]);
  const run = (requests) => leaveDeductionForPeriod({
    requests, tiersByType: UNPAID, poolByType: pools, capByType: caps,
    periodStart: '2026-08-01', periodEnd: '2026-08-31',
  });

  it('charges a plain block once', () => {
    expect(run([{ id: 1, leave_type_id: 1, start_date: '2026-08-01', end_date: '2026-08-03', days: 3 }])
      .deduction_days).toBe(3);
  });

  it('does not charge a day twice when a single-day request sits inside a block', () => {
    // The live case: a three-week block approved, then single days filed inside
    // the same range. Both were charged, and a 3000-dirham salary lost 1000 twice
    // over.
    const totals = run([
      { id: 1, leave_type_id: 1, start_date: '2026-08-01', end_date: '2026-08-05', days: 5 },
      { id: 2, leave_type_id: 1, start_date: '2026-08-02', end_date: '2026-08-02', days: 1 },
      { id: 3, leave_type_id: 1, start_date: '2026-08-03', end_date: '2026-08-03', days: 1 },
    ]);
    expect(totals.deduction_days).toBe(5);
    expect(totals.overlaps).toHaveLength(2);
    expect(totals.overlaps[0]).toMatchObject({ date: '2026-08-02', requested: 1, charged: 0 });
  });

  it('reports the overlap rather than swallowing it', () => {
    // Silently discarding the duplicate would fix the money and hide the data
    // problem that caused it.
    const totals = run([
      { id: 1, leave_type_id: 1, start_date: '2026-08-10', end_date: '2026-08-10', days: 1 },
      { id: 2, leave_type_id: 1, start_date: '2026-08-10', end_date: '2026-08-10', days: 1 },
    ]);
    expect(totals.deduction_days).toBe(1);
    expect(totals.overlaps).toHaveLength(1);
    expect(totals.overlaps[0].request_id).toBe(2);
  });

  it('still allows two halves of the same day to add to one', () => {
    // A legitimate split must survive the cap.
    const totals = run([
      { id: 1, leave_type_id: 1, start_date: '2026-08-12', end_date: '2026-08-12', days: 0.5 },
      { id: 2, leave_type_id: 1, start_date: '2026-08-12', end_date: '2026-08-12', days: 0.5 },
    ]);
    expect(totals.deduction_days).toBe(1);
    expect(totals.overlaps).toHaveLength(0);
  });

  it('charges only the room left when a partial overruns a claimed day', () => {
    const totals = run([
      { id: 1, leave_type_id: 1, start_date: '2026-08-14', end_date: '2026-08-14', days: 0.75 },
      { id: 2, leave_type_id: 1, start_date: '2026-08-14', end_date: '2026-08-14', days: 0.5 },
    ]);
    expect(totals.deduction_days).toBe(1);
    expect(totals.overlaps[0]).toMatchObject({ requested: 0.5, charged: 0.25 });
  });
});
