/**
 * Announcements, policies and the disciplinary file — pure unit tests.
 */
import { describe, it, expect } from 'vitest';
import {
  validateAnnouncement, isLive, validatePolicy, nextVersion, ackProgress, validateCase, mostSerious,
} from '../services/hrServicesService.js';

const today = '2026-11-18';

describe('announcements', () => {
  it('needs a title and a body, and no past expiry', () => {
    expect(validateAnnouncement({ title: 'Office closed', body: 'For National Day', priority: 'important', expires_on: '2026-12-04' }, today).data.priority).toBe('important');
    expect(validateAnnouncement({ title: 'x', body: '' }, today).error).toBeTruthy();
    expect(validateAnnouncement({ title: 'x', body: 'y', expires_on: '2026-11-01' }, today).error).toBeTruthy();
    expect(validateAnnouncement({ title: 'x', body: 'y', priority: 'urgent' }, today).data.priority).toBe('normal');
  });
  it('is live once published and until it expires', () => {
    expect(isLive({ published_at: '2026-11-01', expires_on: null }, today)).toBe(true);
    expect(isLive({ published_at: '2026-11-01', expires_on: '2026-11-10' }, today)).toBe(false);
    expect(isLive({ published_at: null }, today)).toBe(false);
  });
});

describe('policies', () => {
  it('validates and defaults to requiring acknowledgement', () => {
    expect(validatePolicy({ title: 'Code of conduct', category: 'Code of Conduct' }).data).toMatchObject({ requires_ack: 1, category: 'Code of Conduct' });
    expect(validatePolicy({ title: 'x', requires_ack: false }).data.requires_ack).toBe(0);
    expect(validatePolicy({ title: '' }).error).toBeTruthy();
  });
  it('starts at version 1 and goes up on each republication', () => {
    expect(nextVersion(1, false)).toBe(1);
    expect(nextVersion(1, true)).toBe(2);
    expect(nextVersion(3, true)).toBe(4);
  });
  it('reports acknowledgement progress', () => {
    expect(ackProgress(30, 40)).toEqual({ done: 30, total: 40, percent: 75 });
    expect(ackProgress(5, 0)).toEqual({ done: 0, total: 0, percent: 0 });
  });
});

describe('disciplinary cases', () => {
  const base = { employee_id: 7, category: 'Attendance', action: 'Written Warning', incident_date: '2026-11-10', description: 'Late five times in October' };
  it('accepts a case', () => {
    expect(validateCase(base, today).data).toMatchObject({ employee_id: 7, letter_id: null });
  });
  it('refuses a future incident, an unknown action or no description', () => {
    expect(validateCase({ ...base, incident_date: '2026-12-01' }, today).error).toBeTruthy();
    expect(validateCase({ ...base, action: 'Fine' }, today).error).toBeTruthy();
    expect(validateCase({ ...base, description: ' ' }, today).error).toBeTruthy();
  });
  it('finds the most serious action on record', () => {
    expect(mostSerious(['Verbal Warning', 'Final Warning', 'Written Warning'])).toBe('Final Warning');
    expect(mostSerious([])).toBeNull();
  });
});
