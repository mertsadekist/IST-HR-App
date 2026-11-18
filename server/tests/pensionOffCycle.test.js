import { describe, it, expect } from 'vitest';
import { pensionSchemeFor, pensionRates, pensionContribution } from '../services/pensionService.js';
import { validateOffCycle, offCycleItems } from '../services/offCycleService.js';
import { checkRun } from '../services/payrollV2.js';
import { normalizeExportSettings, buildZohoJournal } from '../services/payrollExportService.js';

describe('GPSSA scheme', () => {
  it('applies to UAE nationals only, by start date, unless set by hand', () => {
    expect(pensionSchemeFor({ nationality: 'Emirati', start_date: '2024-02-01' })).toBe('new');
    expect(pensionSchemeFor({ nationality: 'UAE', start_date: '2019-05-01' })).toBe('old');
    expect(pensionSchemeFor({ nationality: 'Indian', start_date: '2024-02-01' })).toBeNull();
    expect(pensionSchemeFor({ nationality: 'Emirati', pension_scheme: 'none' })).toBeNull();
    expect(pensionSchemeFor({ nationality: 'Saudi', pension_scheme: 'new' })).toBe('new');
  });
});

describe('GPSSA contribution', () => {
  const newRates = pensionRates([], 'new', 2026);
  it('takes 11% from the employee; the government covers 2.5 points below AED 20,000', () => {
    expect(pensionContribution({ salary: 15000, scheme: 'new', rates: newRates }))
      .toMatchObject({ base: 15000, employee: 1650, employer: 1875, government: 375 });
    expect(pensionContribution({ salary: 25000, scheme: 'new', rates: newRates }))
      .toMatchObject({ employee: 2750, employer: 3750, government: 0 });
  });
  it('bounds the contribution salary', () => {
    expect(pensionContribution({ salary: 2000, scheme: 'new', rates: newRates }).base).toBe(3000);
    expect(pensionContribution({ salary: 90000, scheme: 'new', rates: newRates }).base).toBe(70000);
    expect(pensionContribution({ salary: 60000, scheme: 'old', rates: pensionRates([], 'old', 2026) }))
      .toMatchObject({ base: 50000, employee: 2500, employer: 6250 });
  });
  it('reads the rates from the law values of the year', () => {
    const rows = [{ key: 'gpssa_new_employee_percent', year: 2027, value: 12 }];
    expect(pensionRates(rows, 'new', 2026).employee).toBe(11);
    expect(pensionRates(rows, 'new', 2027).employee).toBe(12);
  });
});

describe('off-cycle runs', () => {
  const body = { period: '2026-07', title: 'Q2 bonus', lines: [
    { employee_id: 4, kind: 'earning', category: 'Bonus', amount: 5000 },
    { employee_id: 4, kind: 'deduction', category: 'Correction', label: 'Overpaid June', amount: 400 },
    { employee_id: 9, kind: 'earning', category: 'Commission', amount: 1200.5 },
  ] };
  it('validates and groups the lines per employee', () => {
    const v = validateOffCycle(body);
    expect(v.data.lines[1]).toMatchObject({ code: 'CORRECTION_DED', label: 'Overpaid June' });
    const { items } = offCycleItems(v.data.lines);
    expect(items.find((i) => i.employee_id === 4)).toMatchObject({ additions: 5000, deductions: 400, net: 4600 });
    expect(items.find((i) => i.employee_id === 9).net).toBe(1200.5);
  });
  it('refuses bad input and a negative net', () => {
    expect(validateOffCycle({ ...body, title: 'x' }).error).toMatch(/title/);
    expect(validateOffCycle({ ...body, lines: [{ employee_id: 1, kind: 'deduction', category: 'Bonus', amount: 5 }] }).error).toMatch(/category/);
    const v = validateOffCycle({ ...body, lines: [{ employee_id: 1, kind: 'deduction', category: 'Other', amount: 5 }] });
    expect(offCycleItems(v.data.lines).error).toMatch(/exceed/);
  });
  it('does not flag a missing salary in an off-cycle run', () => {
    const items = [{ employee_id: 1, name: 'A', gross: 0, deductions: 0, labour_contract_status: 'Not Issued' }];
    expect(checkRun({ items, company: {} }).errors.map((e) => e.code)).toContain('NO_SALARY');
    expect(checkRun({ items, company: {}, offCycle: true }).errors).toEqual([]);
  });
});

describe('Zoho journal with pension', () => {
  it('posts the employee and employer shares to the GPSSA payable', () => {
    const j = buildZohoJournal({
      run: { id: 1, period: '2026-07' }, company: { name: 'X' }, settings: normalizeExportSettings({ zoho: { cost_centre: 'none' } }), journalDate: '2026-07-31',
      lines: [
        { kind: 'earning', code: 'BASIC', amount: 15000 },
        { kind: 'deduction', code: 'PENSION', amount: 1650 },
        { kind: 'employer', code: 'PENSION_EMPLOYER', amount: 1875 },
      ],
    });
    expect(j.balanced).toBe(true);
    const acc = (a) => j.rows.find((r) => r.account === a);
    expect(acc('GPSSA Payable').credit).toBe(3525);
    expect(acc('Employer Pension Contributions').debit).toBe(1875);
    expect(acc('Salaries Payable').credit).toBe(13350);
  });
});
