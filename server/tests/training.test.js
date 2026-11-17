/**
 * Training records, certificate expiry and skills — pure unit tests.
 */
import { describe, it, expect } from 'vitest';
import {
  validateCourse, expiresFrom, validateTraining, trainingState, mandatoryGaps, validateSkills,
} from '../services/trainingService.js';

const today = '2026-11-14';

describe('courses', () => {
  it('accepts a course with or without validity', () => {
    expect(validateCourse({ name: 'First aid', validity_months: 24, mandatory: true }).data).toMatchObject({ validity_months: 24, mandatory: 1 });
    expect(validateCourse({ name: 'Excel' }).data.validity_months).toBeNull();
    expect(validateCourse({ name: '' }).error).toBeTruthy();
    expect(validateCourse({ name: 'x', validity_months: 0 }).error).toBeTruthy();
  });
});

describe('expiresFrom', () => {
  it('runs to the day before the same date N months on', () => {
    expect(expiresFrom('2026-03-15', 12)).toBe('2027-03-14');
    expect(expiresFrom('2026-01-31', 1)).toBe('2026-02-27');
    expect(expiresFrom('2026-03-15', null)).toBeNull();
  });
});

describe('validateTraining', () => {
  const course = { id: 1, validity_months: 24 };
  it('defaults the expiry from the course', () => {
    expect(validateTraining({ completed_on: '2026-05-01' }, course, today).data.expires_on).toBe('2028-04-30');
  });
  it('keeps an explicit expiry, and none for a course without validity', () => {
    expect(validateTraining({ completed_on: '2026-05-01', expires_on: '2027-01-01' }, course, today).data.expires_on).toBe('2027-01-01');
    expect(validateTraining({ completed_on: '2026-05-01' }, { id: 2 }, today).data.expires_on).toBeNull();
  });
  it('refuses a future completion or an expiry before it', () => {
    expect(validateTraining({ completed_on: '2026-12-01' }, course, today).error).toBeTruthy();
    expect(validateTraining({ completed_on: '2026-05-01', expires_on: '2026-04-01' }, course, today).error).toBeTruthy();
    expect(validateTraining({ completed_on: '2026-05-01' }, null, today).error).toBeTruthy();
  });
});

describe('trainingState and mandatoryGaps', () => {
  it('classifies expiry', () => {
    expect(trainingState(null, today)).toBe('no_expiry');
    expect(trainingState('2026-11-01', today)).toBe('expired');
    expect(trainingState('2026-12-20', today)).toBe('expiring');
    expect(trainingState('2027-06-01', today)).toBe('valid');
  });
  it('lists mandatory courses missing or only expired', () => {
    const mandatory = [{ id: 1, name: 'First aid' }, { id: 2, name: 'Fire safety' }, { id: 3, name: 'Code of conduct' }];
    const records = [{ course_id: 1, expires_on: '2026-01-01' }, { course_id: 1, expires_on: '2028-01-01' }, { course_id: 2, expires_on: '2026-10-01' }];
    expect(mandatoryGaps(mandatory, records, today)).toEqual([
      { course_id: 2, name: 'Fire safety', reason: 'expired' },
      { course_id: 3, name: 'Code of conduct', reason: 'missing' },
    ]);
  });
});

describe('validateSkills', () => {
  it('keeps one level per skill on the 1–5 scale', () => {
    expect(validateSkills([{ skill_id: 4, level: 3 }, { skill_id: 4, level: 5 }]).data).toEqual([{ skill_id: 4, level: 3 }]);
    expect(validateSkills([{ skill_id: 4, level: 7 }]).error).toBeTruthy();
    expect(validateSkills('x').error).toBeTruthy();
  });
});
