import { describe, it, expect } from 'vitest';
import { computePayrollItem } from '../services/payrollService.js';

describe('Payroll item computation', () => {
  it('no deductions → net equals full salary', () => {
    const r = computePayrollItem({ basicSalary: 6000, fullSalary: 10000 });
    expect(r.allowances).toBe(4000);
    expect(r.gross).toBe(10000);
    expect(r.deductions).toBe(0);
    expect(r.net).toBe(10000);
  });

  it('unpaid leave deducts daily rate × days (gross/30)', () => {
    // daily = 10000/30 = 333.33; 3 unpaid days → 1000 deduction
    const r = computePayrollItem({ basicSalary: 6000, fullSalary: 10000, unpaidLeaveDays: 3 });
    expect(r.daily_rate).toBe(333.33);
    expect(r.deductions).toBe(1000);
    expect(r.net).toBe(9000);
  });

  it('absence days and extra deductions stack', () => {
    const r = computePayrollItem({ basicSalary: 9000, fullSalary: 9000, absenceDays: 2, extraDeductions: 150 });
    // daily = 300; 2 absences → 600; + 150 = 750
    expect(r.allowances).toBe(0);
    expect(r.deductions).toBe(750);
    expect(r.net).toBe(8250);
  });

  it('net never goes negative', () => {
    const r = computePayrollItem({ basicSalary: 3000, fullSalary: 3000, unpaidLeaveDays: 60 });
    expect(r.net).toBe(0);
  });

  it('full salary below basic is corrected up to basic', () => {
    const r = computePayrollItem({ basicSalary: 5000, fullSalary: 0 });
    expect(r.gross).toBe(5000);
    expect(r.allowances).toBe(0);
  });
});
