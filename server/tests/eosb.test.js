import { describe, it, expect } from 'vitest';
import { calculateEOSB } from '../services/eosbService.js';

// Helper to build a last-working-day exactly N years after start.
const yearsAfter = (start, years) => {
  const d = new Date(start);
  d.setFullYear(d.getFullYear() + years);
  return d;
};

describe('EOSB calculation', () => {
  it('less than one year of service → not eligible, zero', () => {
    const r = calculateEOSB({ startDate: '2025-01-01', lastWorkingDay: '2025-07-01', basicSalary: 9000 });
    expect(r.eligible).toBe(false);
    expect(r.eosb_amount).toBe(0);
    expect(r.reason).toMatch(/less than one year/i);
  });

  it('3 years termination → 21 days/year on a 9000 basic', () => {
    const r = calculateEOSB({ startDate: '2021-01-01', lastWorkingDay: yearsAfter('2021-01-01', 3), basicSalary: 9000, departureType: 'Termination' });
    expect(r.eligible).toBe(true);
    // daily wage = 300; ~3 years * 21 = ~63 days * 300 ≈ 18,900 (allow leap-day drift)
    expect(r.daily_wage).toBe(300);
    expect(r.gratuity_days).toBeGreaterThanOrEqual(62.5);
    expect(r.gratuity_days).toBeLessThanOrEqual(63.5);
    expect(r.eosb_amount).toBeGreaterThan(18000);
    expect(r.eosb_amount).toBeLessThan(19200);
  });

  it('beyond 5 years uses 30 days/year for the extra period', () => {
    const r = calculateEOSB({ startDate: '2018-01-01', lastWorkingDay: yearsAfter('2018-01-01', 7), basicSalary: 6000, departureType: 'Termination' });
    // 5*21 + 2*30 = 165 days (approx, leap drift)
    expect(r.gratuity_days).toBeGreaterThanOrEqual(164);
    expect(r.gratuity_days).toBeLessThanOrEqual(166);
    // daily = 200 → ~33,000
    expect(r.eosb_amount).toBeGreaterThan(32500);
    expect(r.eosb_amount).toBeLessThan(33500);
  });

  it('caps total gratuity at 2 years total wage', () => {
    // Very long service should hit the 24-month cap.
    const r = calculateEOSB({ startDate: '1990-01-01', lastWorkingDay: '2025-01-01', basicSalary: 10000, departureType: 'Termination' });
    expect(r.cap_applied).toBe(true);
    expect(r.eosb_amount).toBe(240000); // 10000 * 24
  });

  it('legacy resignation reduction: 2 years → one third', () => {
    const r = calculateEOSB(
      { startDate: '2022-01-01', lastWorkingDay: yearsAfter('2022-01-01', 2), basicSalary: 9000, departureType: 'Resignation' },
      { applyLegacyResignationReduction: true }
    );
    expect(r.reduction_factor).toBe(0.33);
    // full would be ~2*21*300 = 12,600; reduced ~4,200
    expect(r.eosb_amount).toBeGreaterThan(4000);
    expect(r.eosb_amount).toBeLessThan(4400);
  });

  it('default resignation (post-2022) is NOT reduced', () => {
    const full = calculateEOSB({ startDate: '2022-01-01', lastWorkingDay: yearsAfter('2022-01-01', 2), basicSalary: 9000, departureType: 'Termination' });
    const resign = calculateEOSB({ startDate: '2022-01-01', lastWorkingDay: yearsAfter('2022-01-01', 2), basicSalary: 9000, departureType: 'Resignation' });
    expect(resign.reduction_factor).toBe(1);
    expect(resign.eosb_amount).toBe(full.eosb_amount);
  });

  it('unpaid leave days reduce the service period', () => {
    const withLeave = calculateEOSB({ startDate: '2021-01-01', lastWorkingDay: yearsAfter('2021-01-01', 3), basicSalary: 9000, unpaidLeaveDays: 60 });
    const without = calculateEOSB({ startDate: '2021-01-01', lastWorkingDay: yearsAfter('2021-01-01', 3), basicSalary: 9000, unpaidLeaveDays: 0 });
    expect(withLeave.service_days).toBe(without.service_days - 60);
    expect(withLeave.eosb_amount).toBeLessThan(without.eosb_amount);
  });

  it('rejects invalid input', () => {
    expect(calculateEOSB({ startDate: 'nope', lastWorkingDay: '2025-01-01', basicSalary: 9000 }).eligible).toBe(false);
    expect(calculateEOSB({ startDate: '2025-01-01', lastWorkingDay: '2020-01-01', basicSalary: 9000 }).eligible).toBe(false);
    expect(calculateEOSB({ startDate: '2020-01-01', lastWorkingDay: '2025-01-01', basicSalary: 0 }).eligible).toBe(false);
  });
});
