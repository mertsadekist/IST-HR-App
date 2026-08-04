/**
 * Domain renewal alert thresholds (assets PRD Phase 5).
 *
 * The suppression logic is what keeps the feature usable: alerting every six
 * hours trains everyone to ignore the notice, and then the domain lapses anyway.
 * Pure unit tests: no database.
 */
import { describe, it, expect } from 'vitest';
import { thresholdFor, alreadyAlerted, RENEWAL_THRESHOLDS } from '../services/domainRenewalService.js';

describe('thresholdFor', () => {
  it('stays quiet while the renewal is far off', () => {
    expect(thresholdFor(365)).toBeNull();
    expect(thresholdFor(31)).toBeNull();
  });

  it('picks the tightest threshold the domain has crossed', () => {
    expect(thresholdFor(30)).toBe('30');
    expect(thresholdFor(20)).toBe('30');
    expect(thresholdFor(14)).toBe('14');
    expect(thresholdFor(8)).toBe('14');
    expect(thresholdFor(7)).toBe('7');
    expect(thresholdFor(2)).toBe('7');
    expect(thresholdFor(1)).toBe('1');
    expect(thresholdFor(0)).toBe('1');
  });

  it('treats an already-passed renewal as its own loudest case', () => {
    expect(thresholdFor(-1)).toBe('expired');
    expect(thresholdFor(-90)).toBe('expired');
  });

  it('says nothing when there is no renewal date', () => {
    expect(thresholdFor(null)).toBeNull();
    expect(thresholdFor(undefined)).toBeNull();
  });
});

describe('alreadyAlerted', () => {
  it('lets the first alert through', () => {
    expect(alreadyAlerted(null, '30')).toBe(false);
    expect(alreadyAlerted('', '30')).toBe(false);
  });

  it('suppresses a repeat of the same threshold', () => {
    expect(alreadyAlerted('30', '30')).toBe(true);
    expect(alreadyAlerted('7', '7')).toBe(true);
  });

  it('lets a tighter threshold through after a looser one', () => {
    expect(alreadyAlerted('30', '14')).toBe(false);
    expect(alreadyAlerted('14', '7')).toBe(false);
    expect(alreadyAlerted('7', '1')).toBe(false);
    expect(alreadyAlerted('1', 'expired')).toBe(false);
  });

  it('suppresses a looser threshold after a tighter one, so alerts never go backwards', () => {
    expect(alreadyAlerted('7', '30')).toBe(true);
    expect(alreadyAlerted('1', '14')).toBe(true);
  });

  it('treats expired as terminal', () => {
    expect(alreadyAlerted('expired', '1')).toBe(true);
    expect(alreadyAlerted('expired', 'expired')).toBe(true);
    expect(alreadyAlerted('expired', '30')).toBe(true);
  });

  it('walks a full renewal cycle with exactly one alert per threshold', () => {
    let sent = null;
    const fired = [];
    for (const daysLeft of [45, 30, 25, 20, 14, 12, 7, 5, 1, 0, -1, -2]) {
      const th = thresholdFor(daysLeft);
      if (th && !alreadyAlerted(sent, th)) { fired.push(`${daysLeft}d→${th}`); sent = th; }
    }
    expect(fired).toEqual(['30d→30', '14d→14', '7d→7', '1d→1', '-1d→expired']);
    expect(fired).toHaveLength(RENEWAL_THRESHOLDS.length + 1);
  });
});
