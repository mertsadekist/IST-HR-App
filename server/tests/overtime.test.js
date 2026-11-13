/**
 * Overtime detection and pay. Pure unit tests: no database.
 */
import { describe, it, expect } from 'vitest';
import { detectOvertime, overtimePay, effectiveRates, LEGAL_RATES } from '../services/overtimeService.js';

const day = { is_working: true, start_time: '09:00', end_time: '18:00' };

describe('detectOvertime', () => {
  it('ignores a normal day and anything under 30 minutes', () => {
    expect(detectOvertime({ checkIn: '08:58:10', checkOut: '18:05:00', dayRule: day })).toBeNull();
    expect(detectOvertime({ checkIn: '09:00', checkOut: '18:29', dayRule: day })).toBeNull();
  });
  it('counts time beyond the scheduled span', () => {
    expect(detectOvertime({ checkIn: '09:00', checkOut: '20:00', dayRule: day }))
      .toEqual({ normal_minutes: 120, night_minutes: 0, rest_minutes: 0 });
  });
  it('lets a late arrival offset staying late', () => {
    expect(detectOvertime({ checkIn: '10:00', checkOut: '19:00', dayRule: day })).toBeNull();
    expect(detectOvertime({ checkIn: '09:30', checkOut: '20:00', dayRule: day }))
      .toEqual({ normal_minutes: 90, night_minutes: 0, rest_minutes: 0 });
  });
  it('splits off the part after 22:00 as night overtime, across midnight too', () => {
    expect(detectOvertime({ checkIn: '09:00', checkOut: '23:00', dayRule: day }))
      .toEqual({ normal_minutes: 240, night_minutes: 60, rest_minutes: 0 });
    expect(detectOvertime({ checkIn: '09:00', checkOut: '01:30', dayRule: day }))
      .toEqual({ normal_minutes: 240, night_minutes: 210, rest_minutes: 0 });
  });
  it('counts every minute on a rest day or holiday', () => {
    expect(detectOvertime({ checkIn: '10:00', checkOut: '14:15', dayRule: { is_working: false } }))
      .toEqual({ normal_minutes: 0, night_minutes: 0, rest_minutes: 255 });
    expect(detectOvertime({ checkIn: '09:00', checkOut: '13:00', dayRule: day, restDay: true }))
      .toEqual({ normal_minutes: 0, night_minutes: 0, rest_minutes: 240 });
  });
  it('needs both punches', () => {
    expect(detectOvertime({ checkIn: '09:00', checkOut: null, dayRule: day })).toBeNull();
  });
});

describe('overtimePay', () => {
  it('pays on basic / 30 / 8 at the legal rates', () => {
    // basic 7200 → 30/day → hourly 30
    const p = overtimePay({ normal_minutes: 120, night_minutes: 60, rest_minutes: 0 }, 7200);
    expect(p.hourly_rate).toBe(30);
    expect(p.amount).toBe(2 * 30 * 1.25 + 1 * 30 * 1.5);
    expect(p.explanation).toContain('2 h x 1.25');
  });
  it('pays rest-day hours at 1.5', () => {
    expect(overtimePay({ normal_minutes: 0, night_minutes: 0, rest_minutes: 240 }, 7200).amount).toBe(180);
  });
});

describe('effectiveRates', () => {
  it('uses the legal minimums by default and when settings try to go lower', () => {
    expect(effectiveRates(null)).toEqual(LEGAL_RATES);
    expect(effectiveRates({ normal: 1.1, night: 2, rest: 'x' })).toEqual({ normal: 1.25, night: 2, rest: 1.5 });
    expect(effectiveRates('{"normal":1.5}')).toEqual({ normal: 1.5, night: 1.5, rest: 1.5 });
  });
});
