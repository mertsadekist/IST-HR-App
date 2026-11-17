/**
 * Compliance helpers — pure unit tests.
 */
import { describe, it, expect } from 'vitest';
import {
  sortAttention, lawValueFor, emiratisationStatus, wpsDates, fixedDeadlines, validateLawValue,
} from '../services/complianceService.js';

describe('sortAttention', () => {
  it('drops empty items and puts the most urgent first', () => {
    const r = sortAttention([
      { key: 'a', severity: 'medium', count: 9 }, { key: 'b', severity: 'critical', count: 1 },
      { key: 'c', severity: 'critical', count: 4 }, { key: 'd', severity: 'high', count: 0 },
    ]);
    expect(r.map((i) => i.key)).toEqual(['c', 'b', 'a']);
  });
});

describe('lawValueFor', () => {
  const rows = [{ key: 't', year: 2024, value: 6 }, { key: 't', year: 2026, value: 10 }, { key: 'f', year: 2025, value: 96000 }];
  it('takes the latest year at or before the one asked', () => {
    expect(lawValueFor(rows, 't', 2025)).toBe(6);
    expect(lawValueFor(rows, 't', 2027)).toBe(10);
    expect(lawValueFor(rows, 't', 2023)).toBeNull();
  });
});

describe('emiratisationStatus', () => {
  it('works out the required nationals, the gap and the fine', () => {
    expect(emiratisationStatus({ headcount: 87, nationals: 3, targetPercent: 10, finePerYear: 108000 }))
      .toMatchObject({ applies: true, required: 8, gap: 5, fine: 540000, actual_percent: 3.4 });
  });
  it('does not apply below the minimum headcount', () => {
    expect(emiratisationStatus({ headcount: 30, nationals: 0, targetPercent: 10, finePerYear: 108000 }))
      .toMatchObject({ applies: false, required: 0, gap: 0, fine: 0 });
  });
  it('never reports a negative gap', () => {
    expect(emiratisationStatus({ headcount: 60, nationals: 9, targetPercent: 10, finePerYear: 1 }).gap).toBe(0);
  });
});

describe('WPS and fixed deadlines', () => {
  it('late from 15 days after the month ends', () => {
    expect(wpsDates('2026-10')).toEqual({ period_end: '2026-10-31', late_from: '2026-11-15' });
    expect(wpsDates('2026-02')).toEqual({ period_end: '2026-02-28', late_from: '2026-03-15' });
  });
  it('lists the month’s fixed deadlines', () => {
    expect(fixedDeadlines('2026-11').map((d) => d.kind)).toEqual(['wps_late', 'salary_month_end']);
    expect(fixedDeadlines('2026-06').map((d) => d.kind)).toContain('emiratisation_midyear');
    expect(fixedDeadlines('2027-01')[0]).toMatchObject({ kind: 'wps_late', period: '2026-12', date: '2027-01-15' });
  });
});

describe('validateLawValue', () => {
  it('accepts a known key and refuses nonsense', () => {
    expect(validateLawValue({ key: 'emiratisation_target_percent', year: 2027, value: 12 }).data.value).toBe(12);
    expect(validateLawValue({ key: 'emiratisation_target_percent', year: 2027, value: 120 }).error).toBeTruthy();
    expect(validateLawValue({ key: 'other', year: 2027, value: 1 }).error).toBeTruthy();
  });
});
