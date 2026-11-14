/**
 * Appraisals and hiring requests — pure unit tests.
 */
import { describe, it, expect } from 'vitest';
import {
  validateCycle, validateGoals, weightedScore, afterSelfReview, editableBy, rating, validateRequisition,
} from '../services/reviewService.js';

describe('validateCycle', () => {
  it('accepts a cycle and refuses a reversed period or due dates', () => {
    expect(validateCycle({ name: '2026 annual', period_start: '2026-01-01', period_end: '2026-12-31', self_due: '2027-01-15', manager_due: '2027-01-31' }).data.name).toBe('2026 annual');
    expect(validateCycle({ name: 'x', period_start: '2026-12-31', period_end: '2026-01-01' }).error).toBeTruthy();
    expect(validateCycle({ name: 'x', period_start: '2026-01-01', period_end: '2026-12-31', self_due: '2027-02-01', manager_due: '2027-01-01' }).error).toBeTruthy();
    expect(validateCycle({ period_start: '2026-01-01', period_end: '2026-12-31' }).error).toBeTruthy();
  });
});

describe('ratings and goals', () => {
  it('keeps ratings on the 1–5 scale', () => {
    expect(rating('4')).toBe(4);
    expect(rating('')).toBeNull();
    expect(rating(7)).toBeUndefined();
  });
  it('requires titles and weights adding up to 100', () => {
    expect(validateGoals([{ title: 'Sales', weight: 60 }, { title: 'Training', weight: 40 }]).data).toHaveLength(2);
    expect(validateGoals([{ title: 'Sales', weight: 60 }, { title: 'Training', weight: 30 }]).error).toBeTruthy();
    expect(validateGoals([{ title: '' }]).error).toBeTruthy();
    expect(validateGoals([{ title: 'A', self_score: 9 }]).error).toBeTruthy();
    expect(validateGoals([{ title: 'A' }, { title: 'B' }]).data).toHaveLength(2);
  });
  it('weights the manager’s scores, falling back to the employee’s', () => {
    const goals = [{ weight: 60, self_score: 5, manager_score: 4 }, { weight: 40, self_score: 3, manager_score: null }];
    expect(weightedScore(goals)).toBe(3.6);
    expect(weightedScore(goals, 'self')).toBe(4.2);
    expect(weightedScore([{ self_score: 2 }, { self_score: 4 }])).toBe(3);
    expect(weightedScore([{ title: 'x' }])).toBeNull();
  });
});

describe('review flow', () => {
  it('goes to the manager when there is one who signs in, else to HR', () => {
    expect(afterSelfReview(true)).toBe('Manager Review');
    expect(afterSelfReview(false)).toBe('HR Review');
  });
  it('lets each side write only at its own stage', () => {
    expect(editableBy({ status: 'Self Review', isEmployee: true })).toBe('self');
    expect(editableBy({ status: 'Self Review', isManager: true })).toBeNull();
    expect(editableBy({ status: 'Manager Review', isManager: true })).toBe('manager');
    expect(editableBy({ status: 'HR Review', isHR: true })).toBe('hr');
    expect(editableBy({ status: 'Completed', isHR: true })).toBeNull();
  });
});

describe('validateRequisition', () => {
  const base = { title: 'Sales Agent', head_count: 2, reason: 'New', justification: 'Two new projects launching', budget_min: 6000, budget_max: 9000 };
  it('accepts a request', () => {
    expect(validateRequisition(base, '2026-11-14').data).toMatchObject({ head_count: 2, reason: 'New', replaces_employee_id: null });
  });
  it('needs the person replaced, a sane range and no past start', () => {
    expect(validateRequisition({ ...base, reason: 'Replacement' }, '2026-11-14').error).toBeTruthy();
    expect(validateRequisition({ ...base, budget_min: 9000, budget_max: 6000 }, '2026-11-14').error).toBeTruthy();
    expect(validateRequisition({ ...base, target_start: '2026-01-01' }, '2026-11-14').error).toBeTruthy();
    expect(validateRequisition({ ...base, justification: '' }, '2026-11-14').error).toBeTruthy();
  });
});
