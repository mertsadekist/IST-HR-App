/**
 * Employee-document radar rules. Pure unit tests: no database.
 *
 * The parts worth pinning: a UAE national is never reported as missing a
 * residence visa, only a DATED document counts as on record, and the field
 * reader refuses what would put a wrong date on the radar.
 */
import { describe, it, expect } from 'vitest';
import {
  isUaeNational, requiredDocTypes, missingDocTypes, expiryState, readEmployeeDocFields, EMPLOYEE_DOC_TYPES,
} from '../services/employeeDocumentExpiryService.js';

describe('isUaeNational', () => {
  it('recognises the usual spellings, in both languages', () => {
    for (const n of ['UAE', 'uae', 'U.A.E', 'Emirati', 'United Arab Emirates', 'إماراتي', 'الإمارات']) {
      expect(isUaeNational(n)).toBe(true);
    }
  });
  it('does not match other nationalities or an empty field', () => {
    for (const n of ['Egyptian', 'Indian', 'Syrian', '', null, undefined]) {
      expect(isUaeNational(n)).toBe(false);
    }
  });
});

describe('requiredDocTypes / missingDocTypes', () => {
  it('asks an expatriate for all four documents', () => {
    expect(requiredDocTypes('Egyptian')).toEqual(['Passport', 'Residence Visa', 'Emirates ID', 'Labour Card']);
  });
  it('never asks a UAE national for a residence visa', () => {
    expect(requiredDocTypes('Emirati')).not.toContain('Residence Visa');
  });
  it('reports only the documents with no dated record', () => {
    expect(missingDocTypes('Indian', ['Passport', 'Emirates ID'])).toEqual(['Residence Visa', 'Labour Card']);
    expect(missingDocTypes('UAE', ['Passport', 'Emirates ID', 'Labour Card'])).toEqual([]);
    expect(missingDocTypes(null, [])).toHaveLength(4);
  });
});

describe('expiryState', () => {
  it('bands days left the same way company documents do', () => {
    expect(expiryState(null)).toBe('not_set');
    expect(expiryState(-1)).toBe('expired');
    expect(expiryState(0)).toBe('critical');
    expect(expiryState(30)).toBe('critical');
    expect(expiryState(31)).toBe('soon');
    expect(expiryState(90)).toBe('soon');
    expect(expiryState(91)).toBe('valid');
  });
});

describe('readEmployeeDocFields', () => {
  it('keeps only the fields that were sent', () => {
    expect(readEmployeeDocFields({ expiry_date: '2027-03-01' })).toEqual({ data: { expiry_date: '2027-03-01' } });
    expect(readEmployeeDocFields({})).toEqual({ data: {} });
  });
  it('turns empty values into NULL, so a date can be cleared', () => {
    expect(readEmployeeDocFields({ doc_type: '', doc_number: '  ', expiry_date: '' }).data)
      .toEqual({ doc_type: null, doc_number: null, expiry_date: null });
  });
  it('accepts every known type and refuses others', () => {
    for (const t of EMPLOYEE_DOC_TYPES) expect(readEmployeeDocFields({ doc_type: t }).error).toBeUndefined();
    expect(readEmployeeDocFields({ doc_type: 'Driving Licence' }).error).toBeTruthy();
  });
  it('refuses a malformed date', () => {
    expect(readEmployeeDocFields({ expiry_date: '01/03/2027' }).error).toBeTruthy();
    expect(readEmployeeDocFields({ expiry_date: '2027-13-45' }).error).toBeTruthy();
  });
  it('refuses an expiry before the issue date, including against the stored one', () => {
    expect(readEmployeeDocFields({ issue_date: '2026-05-01', expiry_date: '2026-04-01' }).error).toBeTruthy();
    expect(readEmployeeDocFields({ expiry_date: '2026-04-01', current_issue_date: '2026-05-01' }).error).toBeTruthy();
    expect(readEmployeeDocFields({ expiry_date: '2028-04-01', current_issue_date: '2026-05-01' }).error).toBeUndefined();
  });
});
