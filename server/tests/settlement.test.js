/**
 * Final settlement rules. Pure unit tests: no database.
 */
import { describe, it, expect } from 'vitest';
import {
  salaryDays, finalSalaryFrom, accruedAnnualLeave, buildSettlement, addDays,
} from '../services/settlementService.js';
import { calculateEOSB } from '../services/eosbService.js';

describe('salaryDays', () => {
  it('counts a whole calendar month as 30 days, whatever its length', () => {
    expect(salaryDays('2026-01-01', '2026-01-31')).toBe(30);
    expect(salaryDays('2026-02-01', '2026-02-28')).toBe(30);
  });
  it('counts a partial month by its actual days', () => {
    expect(salaryDays('2026-03-01', '2026-03-15')).toBe(15);
    expect(salaryDays('2026-03-10', '2026-03-31')).toBe(22);
  });
  it('spans months', () => {
    expect(salaryDays('2026-03-01', '2026-04-10')).toBe(40);
    expect(salaryDays('2026-12-20', '2027-01-31')).toBe(12 + 30);
  });
  it('is zero when the range is empty or reversed', () => {
    expect(salaryDays('2026-05-01', '2026-04-30')).toBe(0);
    expect(salaryDays(null, '2026-04-30')).toBe(0);
  });
});

describe('finalSalaryFrom', () => {
  it('starts the day after the last month payroll paid', () => {
    expect(finalSalaryFrom('2026-09', '2020-01-01')).toBe('2026-10-01');
    expect(finalSalaryFrom('2026-12', '2020-01-01')).toBe('2027-01-01');
  });
  it('starts at the start date when nothing was paid, or when they started later', () => {
    expect(finalSalaryFrom(null, '2026-08-15')).toBe('2026-08-15');
    expect(finalSalaryFrom('2026-07', '2026-08-15')).toBe('2026-08-15');
  });
});

describe('accruedAnnualLeave', () => {
  it('accrues nothing under six months', () => {
    expect(accruedAnnualLeave('2026-03-01', '2026-08-20')).toBe(0);
  });
  it('accrues two days per completed month from six to twelve months', () => {
    expect(accruedAnnualLeave('2026-01-10', '2026-09-20')).toBe(16);
  });
  it('accrues 30 days a year pro rata in the leaving year after a year of service', () => {
    expect(accruedAnnualLeave('2020-05-01', '2026-12-31')).toBe(30);
    expect(accruedAnnualLeave('2020-05-01', '2026-06-30')).toBe(round(30 * 181 / 365));
  });
});
const round = (n) => Math.round(n * 100) / 100;

describe('buildSettlement', () => {
  const employee = { basic_salary: 6000, full_salary: 9000, start_date: '2021-01-01' };

  it('adds final salary, unused leave and gratuity, each with its working', () => {
    const s = buildSettlement({
      employee, lastWorkingDay: '2026-10-15', departureType: 'Resignation',
      lastPaidPeriod: '2026-09', annualTakenThisYear: 10,
    });
    const byCode = Object.fromEntries(s.lines.map((l) => [l.code, l]));
    expect(byCode.FINAL_SALARY).toMatchObject({ quantity: 15, amount: 4500 });
    const accrued = accruedAnnualLeave('2021-01-01', '2026-10-15');
    expect(byCode.LEAVE_ENCASHMENT.quantity).toBe(round(accrued - 10));
    expect(byCode.LEAVE_ENCASHMENT.amount).toBe(round(round(accrued - 10) * 200));
    const eosb = calculateEOSB({ startDate: '2021-01-01', lastWorkingDay: '2026-10-15', basicSalary: 6000, departureType: 'Resignation' });
    expect(byCode.GRATUITY.amount).toBe(eosb.eosb_amount);
    expect(s.totals.net).toBe(round(4500 + byCode.LEAVE_ENCASHMENT.amount + eosb.eosb_amount));
    expect(s.facts.due_date).toBe('2026-10-29');
  });

  it('pays leave on basic, not gross', () => {
    const s = buildSettlement({ employee, lastWorkingDay: '2026-10-15', lastPaidPeriod: '2026-10', leaveDaysOverride: 5 });
    expect(s.lines.find((l) => l.code === 'LEAVE_ENCASHMENT')).toMatchObject({ quantity: 5, rate: 200, amount: 1000 });
    expect(s.lines.find((l) => l.code === 'FINAL_SALARY')).toBeUndefined();
  });

  it('deducts outstanding loans and nets one-time items and manual lines', () => {
    const s = buildSettlement({
      employee, lastWorkingDay: '2026-10-15', lastPaidPeriod: '2026-10', leaveDaysOverride: 0,
      loans: [{ id: 7, type: 'Loan', outstanding: 1200 }],
      adjustments: [{ id: 3, kind: 'earning', label: 'Q3 bonus', amount: 800 }],
      manualLines: [{ kind: 'deduction', label: 'Notice not served', amount: 300 }],
    });
    expect(s.lines.find((l) => l.code === 'LOAN')).toMatchObject({ amount: 1200, ref_id: 7, kind: 'deduction' });
    expect(s.lines.find((l) => l.code === 'ONE_TIME')).toMatchObject({ amount: 800, ref_id: 3, kind: 'earning' });
    expect(s.lines.find((l) => l.code === 'MANUAL')).toMatchObject({ source: 'manual', kind: 'deduction' });
    expect(s.totals.deductions).toBe(1500);
  });

  it('never pays a negative amount: what is owed beyond dues is a shortfall', () => {
    const s = buildSettlement({
      employee: { basic_salary: 3000, full_salary: 3000, start_date: '2026-06-01' },
      lastWorkingDay: '2026-10-05', lastPaidPeriod: '2026-09', leaveDaysOverride: 0,
      loans: [{ id: 1, type: 'Advance', outstanding: 2000 }],
    });
    expect(s.totals.earnings).toBe(500);
    expect(s.totals.net).toBe(0);
    expect(s.totals.shortfall).toBe(1500);
  });

  it('has no gratuity under a year of service', () => {
    const s = buildSettlement({ employee: { ...employee, start_date: '2026-03-01' }, lastWorkingDay: '2026-10-15', lastPaidPeriod: '2026-09' });
    expect(s.lines.find((l) => l.code === 'GRATUITY')).toBeUndefined();
    expect(s.facts.gratuity.eligible).toBe(false);
  });

  it('dates the deadline 14 days after the last working day', () => {
    expect(addDays('2026-12-25', 14)).toBe('2027-01-08');
  });
});
