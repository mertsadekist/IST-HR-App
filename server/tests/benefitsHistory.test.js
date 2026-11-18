/**
 * Benefits and record history — pure unit tests.
 */
import { describe, it, expect } from 'vitest';
import {
  validatePolicy, validateEnrolment, validateEntitlement, addMonths, nextTicketDue, validateUsage,
} from '../services/benefitsService.js';
import { diffFields, mask } from '../services/historyService.js';

const today = '2026-11-18';

describe('insurance', () => {
  it('needs an insurer and a period', () => {
    expect(validatePolicy({ provider: 'Daman', start_date: '2026-01-01', end_date: '2026-12-31' }).data.provider).toBe('Daman');
    expect(validatePolicy({ provider: 'Daman', start_date: '2026-12-31', end_date: '2026-01-01' }).error).toBeTruthy();
  });
  it('takes dependents with a relation', () => {
    const r = validateEnrolment({ policy_id: 3, category: 'B', dependents: [{ name: 'Sara', relation: 'Spouse' }, { name: 'Omar', relation: 'Child', dob: '2020-05-01' }] });
    expect(r.data.dependents).toHaveLength(2);
    expect(validateEnrolment({ policy_id: 3, dependents: [{ name: 'X', relation: 'Cousin' }] }).error).toBeTruthy();
    expect(validateEnrolment({}).error).toBeTruthy();
  });
});

describe('air ticket', () => {
  const ent = { frequency_months: 12, start_from: '2025-03-01', max_amount: 2500 };
  it('validates the entitlement', () => {
    expect(validateEntitlement({ frequency_months: 24, ticket_class: 'Economy', start_from: '2025-01-01' }).data.frequency_months).toBe(24);
    expect(validateEntitlement({ frequency_months: 18, start_from: '2025-01-01' }).error).toBeTruthy();
  });
  it('adds months, clamped to the month end', () => {
    expect(addMonths('2025-03-01', 12)).toBe('2026-03-01');
    expect(addMonths('2024-02-29', 12)).toBe('2025-02-28');
  });
  it('falls due N months after the last use, or after the start', () => {
    expect(nextTicketDue(ent, null)).toBe('2026-03-01');
    expect(nextTicketDue(ent, '2026-04-10')).toBe('2027-04-10');
    expect(nextTicketDue(null, null)).toBeNull();
  });
  it('validates a use: cap, date, and the payroll month for cash', () => {
    expect(validateUsage({ used_on: '2026-11-01', mode: 'Ticket', amount: 1800 }, ent, today).data.period).toBeNull();
    expect(validateUsage({ used_on: '2026-11-01', mode: 'Cash', amount: 2000, period: '2026-12' }, ent, today).data.period).toBe('2026-12');
    expect(validateUsage({ used_on: '2026-11-01', mode: 'Cash', amount: 2000 }, ent, today).error).toBeTruthy();
    expect(validateUsage({ used_on: '2026-11-01', mode: 'Ticket', amount: 3000 }, ent, today).error).toBeTruthy();
    expect(validateUsage({ used_on: '2026-12-01', mode: 'Ticket', amount: 100 }, ent, today).error).toBeTruthy();
  });
});

describe('record history', () => {
  it('lists only the fields that changed', () => {
    const before = { first_name: 'Ali', basic_salary: '9000.00', start_date: new Date('2025-01-05T00:00:00Z'), phone: null };
    const after = { first_name: 'Ali', basic_salary: 9500, start_date: '2025-01-05', phone: '' };
    expect(diffFields(before, after)).toEqual([{ field: 'basic_salary', from: 9000, to: 9500 }]);
  });
  it('masks bank numbers', () => {
    expect(mask('AE070331234567890123456')).toBe('••••3456');
    expect(diffFields({ iban: 'AE070331234567890123456' }, { iban: 'AE070331234567890129999' }))
      .toEqual([{ field: 'iban', from: '••••3456', to: '••••9999' }]);
  });
});
