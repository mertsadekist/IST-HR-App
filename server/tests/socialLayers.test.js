/**
 * Social-media governance vocabularies (assets PRD Phase 4).
 *
 * The personal-email check is the one with real teeth: governance rule 4 forbids
 * a free provider as the sole owner or recovery route, and the whole
 * personal-email-risk report rests on this function being right.
 * Pure unit tests: no database.
 */
import { describe, it, expect } from 'vitest';
import {
  ASSET_LAYERS, SOCIAL_ACCOUNT_STATUSES, SOCIAL_ACCESS_STATUSES,
  SOCIAL_RIGHTS, SOCIAL_ACCESS_CLOSED, isPersonalEmail,
} from '../config/socialLayers.js';

describe('asset layers', () => {
  it('are the three the PRD separates permissions across', () => {
    expect(ASSET_LAYERS).toEqual([
      'Page / Profile / Channel',
      'Business / Portfolio Manager',
      'Ads Manager / Advertising Account',
    ]);
  });
});

describe('statuses', () => {
  it('start an account at "To Be Completed", the workbook value', () => {
    expect(SOCIAL_ACCOUNT_STATUSES[0]).toBe('To Be Completed');
    expect(SOCIAL_ACCOUNT_STATUSES).toContain('Archived');
  });

  it('close an access grant only on Removed', () => {
    expect(SOCIAL_ACCESS_CLOSED).toEqual(['Removed']);
    // Suspended is not closure: the person keeps the record and may return.
    expect(SOCIAL_ACCESS_CLOSED).not.toContain('Suspended');
    expect(SOCIAL_ACCESS_STATUSES).toContain('Suspended');
  });
});

describe('rights', () => {
  it('tracks the seven the PRD lists, billing and user management among them', () => {
    expect(SOCIAL_RIGHTS).toHaveLength(7);
    expect(SOCIAL_RIGHTS).toContain('can_manage_billing');
    expect(SOCIAL_RIGHTS).toContain('can_manage_users');
    expect(SOCIAL_RIGHTS).toContain('can_publish');
  });
});

describe('isPersonalEmail', () => {
  it('flags the common free providers', () => {
    for (const e of ['a@gmail.com', 'b@hotmail.com', 'c@outlook.com', 'd@yahoo.com',
      'e@icloud.com', 'f@protonmail.com', 'g@mail.ru', 'h@qq.com']) {
      expect(isPersonalEmail(e), e).toBe(true);
    }
  });

  it('accepts a corporate domain', () => {
    expect(isPersonalEmail('mert@istmarkets.com')).toBe(false);
    expect(isPersonalEmail('hr@istrealestate.ae')).toBe(false);
  });

  it('is case-insensitive on the domain', () => {
    expect(isPersonalEmail('A@GMAIL.COM')).toBe(true);
  });

  it('does not flag a corporate domain that merely contains a provider name', () => {
    expect(isPersonalEmail('ops@gmail-agency.com')).toBe(false);
    expect(isPersonalEmail('team@notyahoo.com')).toBe(false);
  });

  it('treats a missing or malformed value as not flagged rather than throwing', () => {
    expect(isPersonalEmail(null)).toBe(false);
    expect(isPersonalEmail('')).toBe(false);
    expect(isPersonalEmail('no-at-sign')).toBe(false);
  });
});
