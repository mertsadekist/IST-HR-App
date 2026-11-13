/**
 * Portal requests — validation. Pure unit tests: no database.
 */
import { describe, it, expect } from 'vitest';
import { validateNewRequest, defaultReimbursementPeriod } from '../services/employeeRequestService.js';

const today = '2026-11-13';

describe('validateNewRequest', () => {
  it('accepts a letter request and defaults the language', () => {
    const r = validateNewRequest('letter', { letter_type: 'NOC', purpose: 'Visa for travel' }, today);
    expect(r.data).toMatchObject({ title: 'NOC', amount: null, details: { language: 'en', purpose: 'Visa for travel' } });
  });
  it('refuses a letter without a known type or a purpose', () => {
    expect(validateNewRequest('letter', { letter_type: 'Reference', purpose: 'x' }, today).error).toBeTruthy();
    expect(validateNewRequest('letter', { letter_type: 'NOC', purpose: '  ' }, today).error).toBeTruthy();
  });

  it('accepts an expense and rounds the amount', () => {
    const r = validateNewRequest('expense', { category: 'Transport', amount: '45.678', expense_date: '2026-11-10', description: 'Taxi to client' }, today);
    expect(r.data).toMatchObject({ amount: 45.68, details: { category: 'Transport', expense_date: '2026-11-10' } });
  });
  it('refuses an expense in the future, with no amount or over the limit', () => {
    const base = { category: 'Meals', amount: 20, expense_date: '2026-11-10', description: 'Lunch' };
    expect(validateNewRequest('expense', { ...base, expense_date: '2026-11-20' }, today).error).toBeTruthy();
    expect(validateNewRequest('expense', { ...base, amount: 0 }, today).error).toBeTruthy();
    expect(validateNewRequest('expense', { ...base, amount: 100001 }, today).error).toBeTruthy();
    expect(validateNewRequest('expense', { ...base, category: 'Gifts' }, today).error).toBeTruthy();
  });

  it('accepts an advance and works out the instalment', () => {
    const r = validateNewRequest('advance', { amount: 3000, months: 4, reason: 'School fees' }, today);
    expect(r.data.details).toEqual({ months: 4, instalment: 750, reason: 'School fees' });
  });
  it('refuses an advance repaid over too many months or with no reason', () => {
    expect(validateNewRequest('advance', { amount: 3000, months: 30, reason: 'x' }, today).error).toBeTruthy();
    expect(validateNewRequest('advance', { amount: 3000, months: 3, reason: '' }, today).error).toBeTruthy();
  });

  it('accepts an HR case', () => {
    const r = validateNewRequest('case', { category: 'Payroll', subject: 'Missing allowance', description: 'Housing not paid in October' }, today);
    expect(r.data).toMatchObject({ title: 'Missing allowance', details: { category: 'Payroll' } });
  });
  it('refuses an unknown type', () => {
    expect(validateNewRequest('loan', {}, today).error).toBeTruthy();
  });
});

describe('defaultReimbursementPeriod', () => {
  it('is the next month, across a year end too', () => {
    expect(defaultReimbursementPeriod('2026-11-13')).toBe('2026-12');
    expect(defaultReimbursementPeriod('2026-12-31')).toBe('2027-01');
  });
});
