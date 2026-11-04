/**
 * What a day's door punches mean. Pure — no database, no Hik server.
 *
 * The rule under test is the one the whole sync rests on: the FIRST punch of the
 * day is the check-in and the LAST is the check-out, because the only reader is
 * on the office entrance.
 */
import { describe, it, expect } from 'vitest';
import {
  addDays, daysBetween, localDate, groupPunches, deriveDay, deriveAbsence, describeDay,
} from '../services/hikRules.js';
import { resolveDayRule } from '../services/workScheduleService.js';

// Mon–Fri 10:00–19:00, one hour break, ten minutes' grace each way.
const schedule = {
  id: 1, grace_in_minutes: 10, grace_out_minutes: 10,
  days: [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
    weekday, is_working: weekday >= 1 && weekday <= 5,
    start_time: weekday >= 1 && weekday <= 5 ? '10:00:00' : null,
    end_time: weekday >= 1 && weekday <= 5 ? '19:00:00' : null,
    break_minutes: weekday >= 1 && weekday <= 5 ? 60 : 0,
  })),
};
const MON = '2026-08-17';
const SAT = '2026-08-15';
const rule = (date) => resolveDayRule(schedule, date);
const day = (times, date = MON, today = '2026-08-20', extra = {}) =>
  deriveDay({ times, date, today, schedule, dayRule: rule(date), ...extra });

describe('date helpers', () => {
  it('adds days across month and year boundaries without the local timezone', () => {
    expect(addDays('2026-08-31', 1)).toBe('2026-09-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('nonsense', 1)).toBeNull();
  });

  it('counts the days between two dates', () => {
    expect(daysBetween('2026-08-01', '2026-08-31')).toBe(30);
    expect(daysBetween('2026-08-17', '2026-08-17')).toBe(0);
  });

  it('reads "today" in the office zone, not the server zone', () => {
    // 23:30 UTC on the 17th is already the 18th in Dubai (UTC+4).
    const at = new Date('2026-08-17T23:30:00Z');
    expect(localDate('Asia/Dubai', at)).toBe('2026-08-18');
    expect(localDate('UTC', at)).toBe('2026-08-17');
  });
});

describe('groupPunches', () => {
  const ev = (person_id, punched_at, person_name = '') => ({ person_id, punched_at, person_name });

  it('buckets by person and calendar day, sorted ascending', () => {
    const g = groupPunches([
      ev('2006', '2026-08-17 17:05:00'), ev('2006', '2026-08-17 10:01:00'),
      ev('2006', '2026-08-18 09:58:00'), ev('2018', '2026-08-17 11:00:00'),
    ]);
    expect(g.size).toBe(3);
    expect(g.get('2006|2026-08-17').times).toEqual(['10:01:00', '17:05:00']);
  });

  it('collapses the same punch reported twice', () => {
    const g = groupPunches([ev('1', '2026-08-17 10:00:00'), ev('1', '2026-08-17 10:00:00')]);
    expect(g.get('1|2026-08-17').times).toEqual(['10:00:00']);
  });

  it('keeps the first name it sees and trims person ids', () => {
    const g = groupPunches([ev(' 77 ', '2026-08-17 10:00:00', 'Sara'), ev('77', '2026-08-17 12:00:00', 'Other')]);
    expect(g.get('77|2026-08-17').person_name).toBe('Sara');
  });

  it('ignores rows it cannot read rather than inventing a day', () => {
    const g = groupPunches([ev('', '2026-08-17 10:00:00'), ev('1', 'not a time'), ev(null, null)]);
    expect(g.size).toBe(0);
  });
});

describe('deriveDay — first punch in, last punch out', () => {
  it('takes the first punch as check-in and the last as check-out', () => {
    const d = day(['10:01:05', '13:02:00', '14:01:00', '19:12:30']);
    expect(d.check_in).toBe('10:01:05');
    expect(d.check_out).toBe('19:12:30');
    expect(d.punch_count).toBe(4);
    expect(d.work_hours).toBe(9.19);
  });

  it('a person who steps out for lunch and taps back in is still in until the last tap', () => {
    const d = day(['10:00:00', '13:00:00', '14:00:00']);
    expect(d.check_out).toBe('14:00:00');
  });

  it('a single punch is a check-in with no check-out — on a finished day it is flagged missing', () => {
    const d = day(['10:19:13']);
    expect(d.check_in).toBe('10:19:13');
    expect(d.check_out).toBeNull();
    expect(d.work_hours).toBeNull();
    expect(d.missing_checkout).toBe(true);
  });

  it('two taps within the minimum stay are a double-tap, not an arrival and a departure', () => {
    const d = day(['10:00:00', '10:01:30']);
    expect(d.check_out).toBeNull();
    expect(d.missing_checkout).toBe(true);
  });

  it('honours a different minimum stay', () => {
    expect(day(['10:00:00', '10:20:00'], MON, '2026-08-20', { minStayMinutes: 15 }).check_out).toBe('10:20:00');
    expect(day(['10:00:00', '10:20:00'], MON, '2026-08-20', { minStayMinutes: 30 }).check_out).toBeNull();
  });
});

describe('deriveDay — lateness and early leave', () => {
  it('is Present inside the grace period', () => {
    const d = day(['10:09:00', '19:00:00']);
    expect(d.status).toBe('Present');
    expect(d.late_minutes).toBeNull();
  });

  it('is Late past grace, and the whole overrun counts — grace is a tolerance, not a discount', () => {
    const d = day(['10:25:00', '19:00:00']);
    expect(d.status).toBe('Late');
    expect(d.late_minutes).toBe(25);
  });

  it('records early departure on a finished day but keeps the Present status', () => {
    const d = day(['10:00:00', '16:50:00']);
    expect(d.status).toBe('Present');
    expect(d.early_leave_minutes).toBe(130);
  });

  it('does not call anyone early while the day is still in progress', () => {
    // Same punches, but it is still the same day at 11:00: the "last punch" is
    // only the latest seen so far.
    const d = day(['10:00:00', '11:00:00'], MON, MON);
    expect(d.early_leave_minutes).toBeNull();
    expect(d.in_progress).toBe(true);
    expect(d.missing_checkout).toBe(false);
  });

  it('a single punch today is simply somebody who has arrived', () => {
    const d = day(['10:02:00'], MON, MON);
    expect(d.missing_checkout).toBe(false);
    expect(d.in_progress).toBe(true);
  });

  it('stores the shift the day was judged against', () => {
    const d = day(['10:00:00', '19:00:00']);
    expect(d.scheduled_in).toBe('10:00:00');
    expect(d.scheduled_out).toBe('19:00:00');
  });

  it('keeps punches on a rest day as Present with no verdict on lateness', () => {
    const d = day(['11:30:00', '15:00:00'], SAT);
    expect(d.status).toBe('Present');
    expect(d.late_minutes).toBeNull();
    expect(d.scheduled_in).toBeNull();
  });

  it('still records the punches when no schedule resolves at all', () => {
    const d = deriveDay({ times: ['10:00:00', '19:00:00'], date: MON, today: '2026-08-20', schedule: null, dayRule: null });
    expect(d.status).toBe('Present');
    expect(d.check_in).toBe('10:00:00');
  });
});

describe('deriveAbsence — only ever from evidence', () => {
  const working = { schedule, dayRule: rule(MON) };

  it('a working day with no punches and no leave is Absent', () => {
    expect(deriveAbsence({ ...working })).toEqual({ status: 'Absent' });
  });

  it('a day the feed said nothing about is not an absence', () => {
    expect(deriveAbsence({ ...working, observed: false })).toEqual({ skip: 'not_observed' });
  });

  it('no schedule means nobody can say it was a working day', () => {
    expect(deriveAbsence({ schedule: null, dayRule: null })).toEqual({ skip: 'no_schedule' });
  });

  it('a holiday and a rest day are never absences', () => {
    expect(deriveAbsence({ ...working, holiday: { name_en: 'National Day' } })).toEqual({ skip: 'holiday' });
    expect(deriveAbsence({ schedule, dayRule: rule(SAT) })).toEqual({ skip: 'rest_day' });
  });

  it('approved full-day leave is On Leave, not Absent — payroll would otherwise take the day twice', () => {
    const r = deriveAbsence({ ...working, leave: { is_full_day: 1, leave_type_name: 'Annual Leave' } });
    expect(r).toEqual({ status: 'On Leave', leave_type: 'Annual Leave' });
  });

  it('a partial leave does not cover a day nobody came to', () => {
    const r = deriveAbsence({ ...working, leave: { is_full_day: 0, leave_type_name: 'Hourly' } });
    expect(r.status).toBe('Absent');
    expect(r.partial_leave).toBe(true);
  });
});

describe('describeDay', () => {
  it('states the evidence behind the row', () => {
    const n = describeDay(day(['10:25:00', '16:50:00']));
    expect(n).toMatch(/2 door punches/);
    expect(n).toMatch(/late 25m/);
    expect(n).toMatch(/left early 130m/);
  });

  it('says so for a single punch', () => {
    expect(describeDay(day(['10:00:00']))).toMatch(/single punch/);
  });
});
