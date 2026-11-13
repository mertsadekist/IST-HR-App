/**
 * Approval chains — the pure parts. No database.
 */
import { describe, it, expect } from 'vitest';
import { validateSteps, nextOpenStep, freezeSteps } from '../services/approvalService.js';

const people = {
  direct_manager: [10],
  second_manager: [],
  byRole: new Map([['hr_manager', [20, 21]], ['admin', [1]]]),
  activeUsers: new Set([1, 10, 20, 21, 30]),
};

describe('validateSteps', () => {
  it('accepts known step types', () => {
    expect(validateSteps([{ type: 'direct_manager' }, { type: 'role', role: 'hr_manager' }, { type: 'user', user_id: 5 }])).toBeNull();
    expect(validateSteps([])).toBeNull();
  });
  it('refuses unknown types, missing roles or people, and long chains', () => {
    expect(validateSteps([{ type: 'ceo' }])).toBeTruthy();
    expect(validateSteps([{ type: 'role', role: 'employee' }])).toBeTruthy();
    expect(validateSteps([{ type: 'user' }])).toBeTruthy();
    expect(validateSteps(Array(7).fill({ type: 'direct_manager' }))).toBeTruthy();
    expect(validateSteps('x')).toBeTruthy();
  });
});

describe('freezeSteps', () => {
  it('resolves each step to the people who approve it', () => {
    const s = freezeSteps([{ type: 'direct_manager' }, { type: 'role', role: 'hr_manager' }, { type: 'user', user_id: 30 }], people, 99);
    expect(s.map((x) => x.approvers)).toEqual([[10], [20, 21], [30]]);
    expect(s.every((x) => !x.skipped)).toBe(true);
  });
  it('skips a step nobody can approve, and says why', () => {
    const s = freezeSteps([{ type: 'second_manager' }, { type: 'user', user_id: 77 }], people, 99);
    expect(s.map((x) => [x.skipped, x.skip_reason])).toEqual([[true, 'no_manager'], [true, 'no_approver']]);
  });
  it('never lets the requester approve their own request', () => {
    const s = freezeSteps([{ type: 'role', role: 'hr_manager' }, { type: 'direct_manager' }], people, 10);
    expect(s[0].approvers).toEqual([20, 21]);
    expect(s[1]).toMatchObject({ approvers: [], skipped: true });
  });
});

describe('nextOpenStep', () => {
  const steps = [{ approvers: [], skipped: true }, { approvers: [10] }, { approvers: [] , skipped: true }, { approvers: [20] }];
  it('finds the next step that someone can approve', () => {
    expect(nextOpenStep(steps)).toBe(1);
    expect(nextOpenStep(steps, 2)).toBe(3);
  });
  it('returns null when the chain is done', () => {
    expect(nextOpenStep(steps, 4)).toBeNull();
    expect(nextOpenStep([{ approvers: [], skipped: true }])).toBeNull();
  });
});
