import { describe, it, expect } from 'vitest';
import {
  normalizeExportSettings, validateExportSettings, bankCodeFromIban, employerFor,
  sifReadiness, buildSif, buildZohoJournal,
} from '../services/payrollExportService.js';

const settings = normalizeExportSettings({
  routing_codes: { '033': '203320101', '086': '808610001' },
  companies: { 1: { bank_routing_code: '808610001' } },
});
const company = { id: 1, name: 'IST Real Estate', mol_id: '1234567' };
const emp = (o) => ({
  employee_id: 1, first_name: 'Sara', last_name: 'Ali', personal_no: '00411089670224',
  iban: 'AE07 0331 2345 6789 0123 456', net: 9000, variable: 500, absence_days: 1, unpaid_leave_days: 1, ...o,
});

describe('export settings', () => {
  it('fills defaults and rejects bad routing codes', () => {
    const s = normalizeExportSettings('not json');
    expect(s.zoho.payable_account).toBe('Salaries Payable');
    expect(validateExportSettings(s)).toBeNull();
    expect(validateExportSettings(normalizeExportSettings({ routing_codes: { '033': '12345' } }))).toMatch(/9 digits/);
    expect(validateExportSettings(normalizeExportSettings({ routing_codes: { AB: '123456789' } }))).toMatch(/3 digits/);
  });
  it('reads the bank code out of a UAE IBAN', () => {
    expect(bankCodeFromIban('AE07 0331 2345 6789 0123 456')).toBe('033');
    expect(bankCodeFromIban('GB29NWBK60161331926819')).toBeNull();
  });
  it('pads the MOL id to the 13-digit employer id', () => {
    expect(employerFor(company, settings)).toEqual({ employer_id: '0000001234567', bank_routing_code: '808610001' });
  });
});

describe('SIF', () => {
  it('reports what is missing', () => {
    const r = sifReadiness({ company, settings, items: [emp({ personal_no: '123' }), emp({ employee_id: 2, iban: 'AE070991234567890123456' })] });
    expect(r.ready).toBe(false);
    expect(r.employeeIssues[0].missing).toEqual(['PERSONAL_NO']);
    expect(r.employeeIssues[1].missing).toEqual(['ROUTING']);
    expect(r.unknown_bank_codes).toEqual(['099']);
    expect(sifReadiness({ company: { id: 2 }, settings, items: [emp()] }).companyIssues).toEqual(['EMPLOYER_ID', 'EMPLOYER_ROUTING']);
  });
  it('writes EDR lines and an SCR whose total is the net paid', () => {
    const now = new Date(2026, 6, 31, 9, 5, 7);
    const sif = buildSif({ company, period: '2026-07', settings, now, reference: 'Payroll 2026-07',
      items: [emp(), emp({ employee_id: 2, net: 4000.5, variable: 0, absence_days: 0, unpaid_leave_days: 0, iban: 'AE070861234567890123456' })] });
    const lines = sif.content.trim().split('\r\n');
    expect(lines[0]).toBe('EDR,00411089670224,203320101,AE070331234567890123456,2026-07-01,2026-07-31,31,8500.00,500.00,2');
    expect(lines[1]).toBe('EDR,00411089670224,808610001,AE070861234567890123456,2026-07-01,2026-07-31,31,4000.50,0.00,0');
    expect(lines[2]).toBe('SCR,0000001234567,808610001,2026-07-31,0905,072026,2,13000.50,AED,Payroll 2026-07');
    expect(sif.fileName).toBe('0000001234567260731090507.SIF');
  });
  it('never lets the variable part exceed the net', () => {
    const sif = buildSif({ company, period: '2026-02', settings, items: [emp({ net: 300, variable: 900 })] });
    expect(sif.content.split('\r\n')[0]).toContain(',2026-02-28,28,0.00,300.00,');
  });
});

describe('Zoho Books journal', () => {
  const run = { id: 7, period: '2026-07' };
  const lines = [
    { kind: 'earning', code: 'BASIC', amount: 6000, department: 'Sales' },
    { kind: 'earning', code: 'HOUSING', amount: 3000, department: 'Sales' },
    { kind: 'earning', code: 'BASIC', amount: 5000, department: 'Finance' },
    { kind: 'deduction', code: 'ABSENCE', amount: 300, department: 'Sales' },
    { kind: 'deduction', code: 'LOAN', amount: 1000, department: 'Finance' },
  ];
  it('balances, nets leave against the expense and credits the payable', () => {
    const s = normalizeExportSettings({ zoho: { accounts: { HOUSING: 'Housing Allowance' } } });
    const j = buildZohoJournal({ run, company, lines, settings: s, journalDate: '2026-07-31' });
    expect(j.balanced).toBe(true);
    expect(j.totalDebit).toBe(13700);
    const find = (a, c) => j.rows.find((r) => r.account === a && r.centre === c);
    expect(find('Salaries and Employee Wages', 'Sales').debit).toBe(5700);
    expect(find('Housing Allowance', 'Sales').debit).toBe(3000);
    expect(find('Employee Advances', 'Finance').credit).toBe(1000);
    expect(find('Salaries Payable', '').credit).toBe(12700);
    expect(j.content.split('\r\n')[0]).toBe('﻿Journal Date,Reference Number,Notes,Journal Type,Currency,Account,Description,Cost Centre,Debit,Credit');
    expect(j.reference).toBe('PAYROLL-2026-07-7');
  });
  it('drops the cost centre when switched off', () => {
    const s = normalizeExportSettings({ zoho: { cost_centre: 'none' } });
    const j = buildZohoJournal({ run, company, lines, settings: s, journalDate: '2026-07-31' });
    expect(j.rows.every((r) => r.centre === '')).toBe(true);
    expect(j.rows.find((r) => r.account === 'Salaries and Employee Wages').debit).toBe(13700);
  });
});
