/**
 * The ranked permission ladder from the assets PRD (Statuses_Access sheet).
 * The ranks are what the privileged-access reports filter on, so an off-by-one
 * here silently changes who counts as elevated. Pure unit tests: no database.
 */
import { describe, it, expect } from 'vitest';
import {
  ACCESS_LEVELS, accessRank, PRIVILEGED_RANK, DIGITAL_STATUSES, RELEASED_STATUSES, SEAT_TYPES,
} from '../config/accessLevels.js';

describe('access ladder', () => {
  it('has the ten levels of the PRD in rank order', () => {
    expect(ACCESS_LEVELS).toEqual([
      'No Access', 'Viewer', 'User', 'Editor', 'Moderator',
      'Analyst', 'Advertiser', 'Admin', 'Super Admin', 'Owner',
    ]);
  });

  it('ranks each level by its position', () => {
    expect(accessRank('No Access')).toBe(0);
    expect(accessRank('Editor')).toBe(3);
    expect(accessRank('Admin')).toBe(7);
    expect(accessRank('Owner')).toBe(9);
  });

  it('treats an unknown level as no access rather than throwing', () => {
    expect(accessRank('Wizard')).toBe(0);
    expect(accessRank(undefined)).toBe(0);
    expect(accessRank(null)).toBe(0);
  });

  it('puts Admin, Super Admin and Owner in the privileged band and nothing else', () => {
    const privileged = ACCESS_LEVELS.filter((l) => accessRank(l) >= PRIVILEGED_RANK);
    expect(privileged).toEqual(['Admin', 'Super Admin', 'Owner']);
  });
});

describe('digital access statuses', () => {
  it('matches the PRD list', () => {
    expect(DIGITAL_STATUSES).toEqual([
      'Available', 'Pending Activation', 'Assigned', 'Active', 'Suspended', 'Revoked', 'Archived',
    ]);
  });

  it('releases a seat only on Revoked and Archived', () => {
    expect(RELEASED_STATUSES).toEqual(['Revoked', 'Archived']);
    // Suspended is deliberately NOT a release: the seat is still paid for while
    // the access is only temporarily blocked.
    expect(RELEASED_STATUSES).not.toContain('Suspended');
  });

  it('offers the three seat classifications', () => {
    expect(SEAT_TYPES).toEqual(['Named seat', 'Pooled seat', 'Not a seat']);
  });
});
