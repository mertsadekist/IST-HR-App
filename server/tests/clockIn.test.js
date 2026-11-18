/**
 * Portal clock-in rules — pure unit tests.
 */
import { describe, it, expect } from 'vitest';
import { normalizeSettings, validateSettings, distanceMeters, nearestSite, checkPunch } from '../services/clockInService.js';

const office = { name: 'Business Bay office', lat: 25.1865, lng: 55.2654, radius_m: 200 };

describe('settings', () => {
  it('is off by default', () => {
    expect(normalizeSettings(null)).toMatchObject({ enabled: false, who: 'all', require_location: true, sites: [] });
  });
  it('refuses a site without coordinates or with an absurd radius', () => {
    expect(validateSettings({ sites: [{ name: 'x', lat: 25, lng: 55, radius_m: 5 }] }).error).toBeTruthy();
    expect(validateSettings({ sites: [office] }).data.sites).toHaveLength(1);
  });
});

describe('distance', () => {
  it('is about right over a known distance', () => {
    // Business Bay to Dubai Marina, roughly 19 km apart.
    const d = distanceMeters(25.1865, 55.2654, 25.0805, 55.1403);
    expect(d).toBeGreaterThan(16000);
    expect(d).toBeLessThan(20000);
  });
  it('finds the nearest site', () => {
    const r = nearestSite([office, { name: 'Marina', lat: 25.0805, lng: 55.1403, radius_m: 300 }], 25.1866, 55.2655);
    expect(r.site.name).toBe('Business Bay office');
    expect(r.within).toBe(true);
  });
});

describe('checkPunch', () => {
  const on = { enabled: true };
  it('refuses when switched off', () => {
    expect(checkPunch({}, { employeeId: 1, lat: 25, lng: 55 })).toEqual({ ok: false, reason: 'disabled' });
  });
  it('lets only listed people punch when so set', () => {
    expect(checkPunch({ ...on, who: 'listed', employee_ids: [7] }, { employeeId: 8, lat: 25, lng: 55, accuracy: 10 }).reason).toBe('not_allowed');
    expect(checkPunch({ ...on, who: 'listed', employee_ids: [7] }, { employeeId: 7, lat: 25, lng: 55, accuracy: 10 }).ok).toBe(true);
  });
  it('needs a location unless switched off, and a precise one', () => {
    expect(checkPunch(on, { employeeId: 1 }).reason).toBe('location_required');
    expect(checkPunch({ ...on, require_location: false }, { employeeId: 1 }).ok).toBe(true);
    expect(checkPunch(on, { employeeId: 1, lat: 25, lng: 55, accuracy: 900 }).reason).toBe('location_inaccurate');
  });
  it('keeps punches inside the sites when there are any', () => {
    expect(checkPunch({ ...on, sites: [office] }, { employeeId: 1, lat: 25.1866, lng: 55.2655, accuracy: 15 }).ok).toBe(true);
    const far = checkPunch({ ...on, sites: [office] }, { employeeId: 1, lat: 25.0805, lng: 55.1403, accuracy: 15 });
    expect(far.reason).toBe('outside_sites');
    expect(far.distance_m).toBeGreaterThan(1000);
  });
});
