/**
 * Shift overrides and the live board — pure unit tests.
 */
import { describe, it, expect } from 'vitest';
import { resolveDayRule } from '../services/workScheduleService.js';
import { withShiftOverride, shiftDayTemplate, crossesMidnight, liveState } from '../services/shiftService.js';

// Mon–Fri 09:00–18:00, weekend off (weekday 0 = Sunday).
const office = {
  id: 1, name_en: 'Office', grace_in_minutes: 10, grace_out_minutes: 10,
  days: [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
    weekday, is_working: weekday >= 1 && weekday <= 5 ? 1 : 0,
    start_time: weekday >= 1 && weekday <= 5 ? '09:00:00' : null,
    end_time: weekday >= 1 && weekday <= 5 ? '18:00:00' : null, break_minutes: 60,
  })),
};
// Evening shift template, defined Mon–Fri only.
const evening = {
  id: 2, name_en: 'Evening', grace_in_minutes: 5, grace_out_minutes: 5,
  days: [1, 2, 3, 4, 5].map((weekday) => ({ weekday, is_working: 1, start_time: '14:00:00', end_time: '23:00:00', break_minutes: 60 })),
};
const byId = new Map([[1, office], [2, evening]]);
const base = { schedule: office, source: 'assignment' };
const SAT = '2026-11-14';
const TUE = '2026-11-17';

describe('withShiftOverride', () => {
  it('leaves the weekly schedule alone without an override', () => {
    expect(withShiftOverride(base, undefined, byId, TUE)).toBe(base);
  });
  it('puts a shift on a weekend day with the template’s hours', () => {
    const r = withShiftOverride(base, { schedule_id: 2, is_off: 0 }, byId, SAT);
    expect(r.source).toBe('shift');
    const rule = resolveDayRule(r.schedule, SAT);
    expect(rule).toMatchObject({ is_working: true, start_time: '14:00:00', end_time: '23:00:00' });
    expect(r.schedule.grace_in_minutes).toBe(5);
  });
  it('makes a working day a day off', () => {
    const r = withShiftOverride(base, { schedule_id: null, is_off: 1 }, byId, TUE);
    expect(r.source).toBe('day_off');
    expect(resolveDayRule(r.schedule, TUE).is_working).toBe(false);
  });
  it('gives a day off even to someone with no weekly schedule', () => {
    const r = withShiftOverride(null, { is_off: 1 }, byId, TUE);
    expect(resolveDayRule(r.schedule, TUE).is_working).toBe(false);
  });
  it('ignores an override pointing at an unknown schedule', () => {
    expect(withShiftOverride(base, { schedule_id: 99 }, byId, TUE)).toBe(base);
  });
});

describe('shiftDayTemplate and crossesMidnight', () => {
  it('uses the weekday’s own hours when it has them', () => {
    expect(shiftDayTemplate(office, TUE).start_time).toBe('09:00:00');
  });
  it('flags a shift that ends the next day', () => {
    expect(crossesMidnight({ is_working: true, start_time: '22:00:00', end_time: '06:00:00' })).toBe(true);
    expect(crossesMidnight({ is_working: true, start_time: '09:00:00', end_time: '18:00:00' })).toBe(false);
  });
});

describe('liveState', () => {
  const dayRule = resolveDayRule(office, TUE);
  const at = (h, m = 0) => h * 3600 + m * 60;
  it('in or late from the punches', () => {
    expect(liveState({ row: { check_in: '08:55' }, dayRule, schedule: office, nowSec: at(11) })).toBe('in');
    expect(liveState({ row: { check_in: '09:40', late_minutes: 40 }, dayRule, schedule: office, nowSec: at(11) })).toBe('late');
    expect(liveState({ row: { check_in: '08:55', check_out: '13:00' }, dayRule, schedule: office, nowSec: at(15) })).toBe('in');
  });
  it('expected before start and grace, not in after', () => {
    expect(liveState({ row: null, dayRule, schedule: office, nowSec: at(9, 5) })).toBe('expected');
    expect(liveState({ row: null, dayRule, schedule: office, nowSec: at(9, 11) })).toBe('not_in');
  });
  it('leave, holiday, rest day and no schedule', () => {
    expect(liveState({ row: null, dayRule, schedule: office, onLeave: true, nowSec: at(11) })).toBe('on_leave');
    expect(liveState({ row: null, dayRule, schedule: office, holiday: true, nowSec: at(11) })).toBe('rest');
    expect(liveState({ row: null, dayRule: resolveDayRule(office, SAT), schedule: office, nowSec: at(11) })).toBe('rest');
    expect(liveState({ row: null, dayRule: null, schedule: null, nowSec: at(11) })).toBe('no_schedule');
  });
});
