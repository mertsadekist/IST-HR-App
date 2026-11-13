/**
 * Payroll v2 rules. Pure unit tests: no database.
 *
 * The invariant that matters most: the payslip lines are a breakdown, never a
 * second calculation — earnings sum to gross and deductions to deductions,
 * exactly, whatever the rounding.
 */
import { describe, it, expect } from 'vitest';
import { computePayrollItem } from '../services/payrollService.js';
import {
  buildPayslipLines, groupLeaveByType, activeComponents, isValidUaeIban, computeVariance, checkRun, loanInstalmentsFor,
} from '../services/payrollV2.js';

const sum = (lines, kind) => Math.round(lines.filter((l) => l.kind === kind).reduce((s, l) => s + l.amount, 0) * 100) / 100;

describe('buildPayslipLines', () => {
  it('adds up exactly to the calculated gross and deductions', () => {
    for (const [basic, full, unpaid, absence] of [
      [6000, 10000, 2, 1], [3333, 7777, 1.5, 3], [4100, 4100, 0.5, 0], [5000, 12345.67, 7, 2], [9000, 9000, 0, 0],
    ]) {
      const calc = computePayrollItem({ basicSalary: basic, fullSalary: full, unpaidLeaveDays: unpaid, absenceDays: absence });
      const lines = buildPayslipLines({ calc, leaveByType: unpaid ? [{ name: 'Unpaid Leave', days: unpaid }] : [] });
      expect(sum(lines, 'earning')).toBe(calc.gross);
      expect(sum(lines, 'deduction')).toBe(calc.deductions);
    }
  });

  it('shows one allowance line when there is no breakdown', () => {
    const calc = computePayrollItem({ basicSalary: 6000, fullSalary: 10000 });
    const lines = buildPayslipLines({ calc });
    expect(lines.map((l) => l.code)).toEqual(['BASIC', 'ALLOWANCE']);
    expect(lines[1].amount).toBe(4000);
  });

  it('lists components and puts the unaccounted rest on its own line', () => {
    const calc = computePayrollItem({ basicSalary: 6000, fullSalary: 10000 });
    const lines = buildPayslipLines({ calc, components: [
      { code: 'HOUSING', label: 'Housing', amount: 2500 }, { code: 'TRANSPORT', label: 'Transport', amount: 1000 },
    ] });
    expect(lines.map((l) => l.code)).toEqual(['BASIC', 'HOUSING', 'TRANSPORT', 'ALLOWANCE_OTHER']);
    expect(lines.at(-1).amount).toBe(500);
    expect(sum(lines, 'earning')).toBe(10000);
  });

  it('never changes gross when components exceed the contract total', () => {
    const calc = computePayrollItem({ basicSalary: 6000, fullSalary: 10000 });
    const lines = buildPayslipLines({ calc, components: [{ code: 'HOUSING', label: 'Housing', amount: 4500 }] });
    expect(lines.at(-1)).toMatchObject({ code: 'ALLOWANCE_OTHER', amount: -500 });
    expect(sum(lines, 'earning')).toBe(10000);
  });

  it('splits leave by type and keeps absence separate', () => {
    const calc = computePayrollItem({ basicSalary: 6000, fullSalary: 9000, unpaidLeaveDays: 3, absenceDays: 1 });
    const lines = buildPayslipLines({ calc, leaveByType: [{ name: 'Unpaid Leave', days: 2 }, { name: 'Sick Leave', days: 1 }] });
    const ded = lines.filter((l) => l.kind === 'deduction');
    expect(ded.map((l) => [l.code, l.label, l.quantity, l.amount])).toEqual([
      ['LEAVE', 'Unpaid Leave', 2, 600], ['LEAVE', 'Sick Leave', 1, 300], ['ABSENCE', 'Unexcused absence', 1, 300],
    ]);
  });

  it('falls back to one leave line when the grouping does not reconcile', () => {
    const calc = computePayrollItem({ basicSalary: 6000, fullSalary: 9000, unpaidLeaveDays: 3 });
    const lines = buildPayslipLines({ calc, leaveByType: [{ name: 'Unpaid Leave', days: 2 }] });
    expect(lines.filter((l) => l.code === 'LEAVE')).toHaveLength(1);
    expect(sum(lines, 'deduction')).toBe(900);
  });
});

describe('one-time items and loans', () => {
  it('pays additions on top of gross without touching the daily rate', () => {
    const calc = computePayrollItem({ basicSalary: 6000, fullSalary: 9000, absenceDays: 1, extraEarnings: 1500 });
    expect(calc.daily_rate).toBe(300);
    expect(calc.additions).toBe(1500);
    expect(calc.net).toBe(9000 + 1500 - 300);
  });

  it('itemises bonuses, loan instalments and one-time deductions, adding up exactly', () => {
    const calc = computePayrollItem({ basicSalary: 6000, fullSalary: 9000, absenceDays: 1, extraEarnings: 1500, extraDeductions: 700 });
    const lines = buildPayslipLines({ calc, extras: [
      { kind: 'earning', code: 'BONUS', label: 'Q3 bonus', amount: 1000 },
      { kind: 'earning', code: 'COMMISSION', label: 'Commission', amount: 500 },
      { kind: 'deduction', code: 'LOAN', label: 'Loan instalment', amount: 500 },
      { kind: 'deduction', code: 'DEDUCTION', label: 'Damaged laptop', amount: 200 },
    ] });
    expect(lines.map((l) => l.code)).toEqual(['BASIC', 'ALLOWANCE', 'BONUS', 'COMMISSION', 'ABSENCE', 'LOAN', 'DEDUCTION']);
    expect(sum(lines, 'earning')).toBe(calc.gross + calc.additions);
    expect(sum(lines, 'deduction')).toBe(calc.deductions);
  });

  it('keeps an unitemised remainder on its own line', () => {
    const calc = computePayrollItem({ basicSalary: 5000, fullSalary: 5000, extraDeductions: 300 });
    const lines = buildPayslipLines({ calc, extras: [{ kind: 'deduction', code: 'LOAN', label: 'Loan', amount: 200 }] });
    expect(lines.filter((l) => l.kind === 'deduction').map((l) => [l.code, l.amount])).toEqual([['LOAN', 200], ['EXTRA', 100]]);
  });

  it('takes equal instalments from the start month, and only what is left at the end', () => {
    const loan = { id: 1, type: 'Loan', principal: 1000, instalment: 400, start_period: '2026-05', status: 'Active' };
    expect(loanInstalmentsFor([{ ...loan, repaid: 0 }], '2026-04')).toEqual([]);
    expect(loanInstalmentsFor([{ ...loan, repaid: 0 }], '2026-05')).toEqual([{ loan_id: 1, type: 'Loan', amount: 400, outstanding_after: 600 }]);
    expect(loanInstalmentsFor([{ ...loan, repaid: 800 }], '2026-07')).toEqual([{ loan_id: 1, type: 'Loan', amount: 200, outstanding_after: 0 }]);
    expect(loanInstalmentsFor([{ ...loan, repaid: 1000 }], '2026-08')).toEqual([]);
  });

  it('skips cancelled and settled loans', () => {
    const base = { id: 2, type: 'Advance', principal: 500, instalment: 500, start_period: '2026-01', repaid: 0 };
    expect(loanInstalmentsFor([{ ...base, status: 'Cancelled' }, { ...base, id: 3, status: 'Settled' }], '2026-02')).toEqual([]);
  });
});

describe('groupLeaveByType / activeComponents', () => {
  it('groups per-day leave lines by type and skips fully paid days', () => {
    expect(groupLeaveByType([
      { leave_type_name: 'Sick Leave', deduction_days: 0.5 }, { leave_type_name: 'Sick Leave', deduction_days: 0.5 },
      { leave_type_name: 'Annual Leave', deduction_days: 0 }, { leave_type_name: 'Unpaid Leave', deduction_days: 1 },
    ])).toEqual([{ name: 'Sick Leave', days: 1 }, { name: 'Unpaid Leave', days: 1 }]);
  });

  it('keeps components that overlap the period', () => {
    const c = [
      { code: 'A', effective_from: null, effective_to: null },
      { code: 'B', effective_from: '2026-05-01', effective_to: null },
      { code: 'C', effective_from: '2026-01-01', effective_to: '2026-03-31' },
      { code: 'D', effective_from: '2026-04-15', effective_to: '2026-04-20' },
    ];
    expect(activeComponents(c, '2026-04-01', '2026-04-30').map((x) => x.code)).toEqual(['A', 'D']);
  });
});

describe('isValidUaeIban', () => {
  it('accepts a checksum-valid UAE IBAN, with or without spaces', () => {
    expect(isValidUaeIban('AE070331234567890123456')).toBe(true);
    expect(isValidUaeIban('ae07 0331 2345 6789 0123 456')).toBe(true);
  });
  it('refuses a wrong checksum, length or country', () => {
    expect(isValidUaeIban('AE080331234567890123456')).toBe(false);
    expect(isValidUaeIban('AE07033123456789012345')).toBe(false);
    expect(isValidUaeIban('SA070331234567890123456')).toBe(false);
    expect(isValidUaeIban('')).toBe(false);
  });
});

describe('computeVariance', () => {
  const prev = [{ employee_id: 1, name: 'A', gross: 10000, deductions: 0, net: 10000 },
    { employee_id: 2, name: 'B', gross: 5000, deductions: 0, net: 5000 },
    { employee_id: 3, name: 'C', gross: 4000, deductions: 0, net: 4000 }];
  const cur = [{ employee_id: 1, name: 'A', gross: 10000, deductions: 1500, net: 8500 },
    { employee_id: 2, name: 'B', gross: 5000, deductions: 0, net: 5000 },
    { employee_id: 4, name: 'D', gross: 7000, deductions: 0, net: 7000 }];

  it('flags a change above 10% and says what moved', () => {
    const a = computeVariance(cur, prev).find((r) => r.employee_id === 1);
    expect(a).toMatchObject({ status: 'changed', prev_net: 10000, net: 8500, diff: -1500, pct: -15, flagged: true });
    expect(a.changes).toEqual([{ kind: 'deduction', code: 'DEDUCTIONS', label: 'Deductions', prev: 0, cur: 1500 }]);
  });

  it('reports unchanged, new and departed employees', () => {
    const rows = computeVariance(cur, prev);
    expect(rows.find((r) => r.employee_id === 2)).toMatchObject({ status: 'same', flagged: false });
    expect(rows.find((r) => r.employee_id === 4)).toMatchObject({ status: 'new', flagged: true });
    expect(rows.find((r) => r.employee_id === 3)).toMatchObject({ status: 'left', net: null });
  });

  it('flags nobody as new on the very first run', () => {
    expect(computeVariance(cur, []).every((r) => r.status === 'new' && !r.flagged)).toBe(true);
  });
});

describe('checkRun', () => {
  const good = {
    employee_id: 1, name: 'A', gross: 10000, allowances: 4000, deductions: 0, net: 10000,
    labour_contract_status: 'Issued', employment_status: 'Active', work_permit_no: '123', personal_no: '456',
    iban: 'AE070331234567890123456', bank_name: 'ENBD', bank_verified: 1, component_sum: null,
  };

  it('passes a complete run', () => {
    expect(checkRun({ items: [good], company: { mol_id: '999' } })).toMatchObject({ ok: true, errors: [] });
  });

  it('blocks missing WPS data, a bad IBAN, a missing MOL ID and a zero salary', () => {
    const r = checkRun({ items: [
      { ...good, employee_id: 2, work_permit_no: null, iban: null },
      { ...good, employee_id: 3, iban: 'AE080331234567890123456' },
      { ...good, employee_id: 4, gross: 0 },
    ], company: {} });
    expect(r.ok).toBe(false);
    expect(r.errors.map((e) => e.code).sort()).toEqual(['COMPANY_MOL_MISSING', 'IBAN_INVALID', 'NO_SALARY', 'WPS_MISSING']);
    expect(r.errors.find((e) => e.code === 'WPS_MISSING').detail).toEqual(['work_permit_no', 'iban']);
  });

  it('does not ask for WPS data from someone without an issued labour contract', () => {
    const r = checkRun({ items: [{ ...good, labour_contract_status: 'Not Issued', iban: null }], company: {} });
    expect(r.ok).toBe(true);
    expect(r.warnings.map((w) => w.code)).toEqual(['NOT_IN_WPS']);
  });

  it('warns on heavy deductions, a component mismatch and a big change', () => {
    const r = checkRun({
      items: [{ ...good, deductions: 6000, net: 4000, component_sum: 3500 }],
      company: { mol_id: '1' },
      variance: [{ employee_id: 1, name: 'A', status: 'changed', flagged: true, prev_net: 10000, net: 4000, pct: -60 }],
    });
    expect(r.ok).toBe(true);
    expect(r.warnings.map((w) => w.code)).toEqual(['DEDUCTIONS_OVER_HALF', 'COMPONENTS_MISMATCH', 'BIG_CHANGE']);
  });
});
