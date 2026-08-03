/**
 * WPS salary file builder — layout and arithmetic.
 *
 * The expected cell positions and merge ranges below were taken from the
 * company's own submitted Ministry of Labour file, so a regression here means
 * the generated workbook no longer matches what the bank/ministry accepts.
 * Pure unit tests: no database needed.
 */
import { describe, it, expect } from 'vitest';
import XLSX from 'xlsx';
import { buildWpsWorkbook, wpsReadiness, formatPayrollMonth } from '../services/wpsService.js';

const company = {
  name: 'I S T REAL ESTATE L.L.C', mol_id: '2080452',
  wps_contact_person: 'HR Officer', wps_contact_mobile: '0501112222',
  wps_contact_phone: '043210000', wps_contact_fax: '043210001', wps_contact_email: 'hr@example.test',
};
const items = [
  { employee_id: 1, first_name: 'Mert', last_name: 'Sadak', work_permit_no: '121791084',
    personal_no: '00411089670224', bank_name: 'Mashreq Bank', iban: 'AE870330000019101608741',
    absence_days: 0, unpaid_leave_days: 0, gross: 11000, net: 11000 },
  { employee_id: 2, first_name: 'Ana', last_name: 'Silva', work_permit_no: '987654321',
    personal_no: '00411089670225', bank_name: 'Emirates NBD', iban: 'AE070331234567890999999',
    absence_days: 1, unpaid_leave_days: 2, gross: 9000, net: 8100.55 },
];

const sheetOf = (opts = {}) => {
  const { buffer } = buildWpsWorkbook({ company, period: '2026-07', items, ...opts });
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  return { ws, aoa: XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, blankrows: true }) };
};

describe('formatPayrollMonth', () => {
  it('renders the month the way the official sheet spells it', () => {
    expect(formatPayrollMonth('2026-07')).toBe('JULY-2026');
    expect(formatPayrollMonth('2026-01')).toBe('JANUARY-2026');
    expect(formatPayrollMonth('2026-12')).toBe('DECEMBER-2026');
  });
});

describe('wpsReadiness', () => {
  it('passes when every identifier is present', () => {
    expect(wpsReadiness({ company, items }).ready).toBe(true);
  });

  it('names the company issue when the MOL ID is missing', () => {
    const r = wpsReadiness({ company: { name: 'X' }, items });
    expect(r.ready).toBe(false);
    expect(r.companyIssues).toHaveLength(1);
  });

  it('lists exactly which fields each employee is missing', () => {
    const r = wpsReadiness({ company, items: [{ employee_id: 9, first_name: 'No', last_name: 'Data' }] });
    expect(r.ready).toBe(false);
    expect(r.employeeIssues).toEqual([
      { employee_id: 9, name: 'No Data', missing: ['Work Permit No', 'Personal No', 'IBAN', 'Bank name'] },
    ]);
  });
});

describe('buildWpsWorkbook', () => {
  it('places the title block in column D on rows 1-3', () => {
    const { aoa } = sheetOf();
    expect(aoa[0][3]).toBe('COMPANY NAME:- I S T REAL ESTATE L.L.C');
    expect(aoa[1][3]).toBe('MOL ID No:-   2080452');
    expect(aoa[2][3]).toBe('PAYROLL FOR THE MONTH OF  JULY-2026');
  });

  it('writes the two-row header with the salary group on row 7', () => {
    const { aoa } = sheetOf();
    expect(aoa[6][0]).toBe('Sl.No');
    expect(aoa[6][6]).toBe('NO OF DAYS ABSENT');
    expect(aoa[6][7]).toBe("Employee's Net Salary");
    expect(aoa[7].slice(7)).toEqual(['Fixed Portion', 'Variable Portion', 'Total Payment']);
  });

  it('starts employee rows at row 9 and numbers them sequentially', () => {
    const { aoa } = sheetOf();
    expect(aoa[8][0]).toBe(1);
    expect(aoa[8][1]).toBe('MERT SADAK');
    expect(aoa[9][0]).toBe(2);
  });

  it('maps Fixed Portion to gross and Total Payment to net', () => {
    const { aoa } = sheetOf();
    expect(aoa[8][7]).toBe(11000);
    expect(aoa[8][9]).toBe(11000);
    expect(aoa[9][7]).toBe(9000);
    expect(aoa[9][9]).toBe(8100.55);
  });

  it('sums absence and unpaid-leave days into the absent column', () => {
    const { aoa } = sheetOf();
    expect(aoa[9][6]).toBe(3);
  });

  it('totals the Total Payment column, not the Fixed column', () => {
    const { aoa } = sheetOf();
    const totalRow = aoa.find((r) => r[0] === 'Total in Dirhams');
    expect(totalRow[9]).toBe(19100.55);
  });

  it('keeps identifiers as text so leading zeros survive', () => {
    const { ws } = sheetOf();
    expect(ws.C9.t).toBe('s');
    expect(ws.D9.t).toBe('s');
    expect(ws.D9.v).toBe('00411089670224');
    expect(ws.F9.t).toBe('s');
  });

  it('writes the contact block after the total', () => {
    const { aoa } = sheetOf();
    const lines = aoa.slice(11).map((r) => r[1]).filter(Boolean);
    expect(lines).toEqual([
      'CONTACT PERSON -  HR Officer', 'MOBILE - 0501112222', 'TELEPHONE - 043210000',
      'FAX - 043210001', 'EMAIL - hr@example.test',
    ]);
  });

  it('reproduces the merge ranges of the official sheet', () => {
    const { ws } = sheetOf();
    const has = (r1, c1, r2, c2) => ws['!merges'].some(
      (m) => m.s.r === r1 && m.s.c === c1 && m.e.r === r2 && m.e.c === c2);
    expect(has(0, 3, 0, 5)).toBe(true);   // COMPANY NAME → D:F
    expect(has(6, 7, 6, 9)).toBe(true);   // Employee's Net Salary → H:J
    expect(has(6, 0, 7, 0)).toBe(true);   // Sl.No spans both header rows
    expect(has(10, 0, 10, 6)).toBe(true); // Total in Dirhams → A:G
  });

  it('rounds to fils rather than accumulating float error', () => {
    const cents = Array.from({ length: 3 }, (_, i) => ({
      employee_id: i, first_name: 'A', last_name: String(i), gross: 0.1, net: 0.1,
    }));
    const { grandTotal } = buildWpsWorkbook({ company, period: '2026-07', items: cents });
    expect(grandTotal).toBe(0.3);
  });
});
