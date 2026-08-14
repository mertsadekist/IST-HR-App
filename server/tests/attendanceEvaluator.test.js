/**
 * The evaluator, exhaustively, without a database.
 *
 * This is the arithmetic that will eventually decide whether somebody is marked
 * absent, and an absent day costs a full day's gross in payrollService. Every
 * branch of the ordered decision is exercised here, including the ones whose
 * whole purpose is to REFUSE to reach a conclusion.
 */
import { describe, it, expect } from 'vitest';
import { evaluateDay, eachDate, fmtDuration, diffAgainstStored } from '../services/attendanceEvaluator.js';
import { resolveDayRule } from '../services/workScheduleService.js';

// IST Real Estate — Standard: Mon–Fri 10:00–19:00 with an hour for lunch,
// Saturday 10:00–15:00, Sunday off.
const RE = {
  id: 1, name_en: 'IST Real Estate — Standard', timezone: 'Asia/Dubai',
  grace_in_minutes: 10, grace_out_minutes: 10,
  late_case_minutes: 30, early_case_minutes: 30, half_day_threshold_pct: 50,
  days: [
    { weekday: 0, is_working: false },
    ...[1, 2, 3, 4, 5].map((weekday) => ({ weekday, is_working: true, start_time: '10:00:00', end_time: '19:00:00', break_minutes: 60 })),
    { weekday: 6, is_working: true, start_time: '10:00:00', end_time: '15:00:00', break_minutes: 0 },
  ],
};

const MONDAY = '2026-08-17';
const SATURDAY = '2026-08-15';
const SUNDAY = '2026-08-16';

/** Evaluate a day on the standard schedule. */
const on = (date, row, extra = {}) => evaluateDay({
  date, row, schedule: RE, dayRule: resolveDayRule(RE, date), ...extra,
});
const types = (v) => v.exceptions.map((e) => e.type);

describe('eachDate', () => {
  it('walks the range inclusively', () => {
    expect(eachDate('2026-08-14', '2026-08-17')).toEqual(['2026-08-14', '2026-08-15', '2026-08-16', '2026-08-17']);
  });
  it('crosses a month boundary', () => {
    expect(eachDate('2026-08-30', '2026-09-01')).toEqual(['2026-08-30', '2026-08-31', '2026-09-01']);
  });
  it('returns nothing for a reversed or malformed range', () => {
    expect(eachDate('2026-08-17', '2026-08-14')).toEqual([]);
    expect(eachDate('nonsense', '2026-08-14')).toEqual([]);
  });
  it('is bounded, so a mistyped year cannot hang the request', () => {
    expect(eachDate('2026-01-01', '2099-01-01').length).toBe(5000);
  });
});

describe('1 — no schedule', () => {
  it('refuses to guess a shift', () => {
    const v = evaluateDay({ date: MONDAY, row: { check_in: '10:00:00', check_out: '19:00:00' }, schedule: null, dayRule: null });
    expect(types(v)).toEqual(['NO_SCHEDULE']);
    expect(v.status).toBe('Unknown');
    // No conclusion at all — not "present", not "absent".
    expect(v.late_minutes).toBeNull();
    expect(v.worked_minutes).toBeNull();
  });
});

describe('2 — holidays', () => {
  const holiday = { name_en: 'National Day', holiday_date: MONDAY };

  it('is a holiday, not an absence', () => {
    const v = on(MONDAY, null, { holiday });
    expect(v.status).toBe('Holiday');
    expect(v.exceptions).toEqual([]);
  });

  it('treats working through it as compensation, not a violation', () => {
    const v = on(MONDAY, { check_in: '10:00:00', check_out: '19:00:00' }, { holiday });
    expect(types(v)).toEqual(['WORKED_ON_DAY_OFF']);
    expect(v.exceptions[0].severity).toBe('Info');
    expect(v.exceptions[0].detail).toContain('National Day');
  });
});

describe('3 — the weekly day off', () => {
  it('reports Sunday as a day off, not a nine-hour absence', () => {
    // This is the case the device gets wrong: it applies one 10:00–19:00
    // schedule to everybody and knows nothing about the weekly rest day.
    const v = on(SUNDAY, null);
    expect(v.status).toBe('Weekend');
    expect(v.expected_minutes).toBe(0);
    expect(v.exceptions).toEqual([]);
  });

  it('flags Sunday work as a compensation candidate', () => {
    const v = on(SUNDAY, { check_in: '11:00:00', check_out: '16:00:00' });
    expect(types(v)).toEqual(['WORKED_ON_DAY_OFF']);
  });

  it('treats the short Saturday as a normal working day for Real Estate', () => {
    const v = on(SATURDAY, { check_in: '10:00:00', check_out: '15:00:00' });
    expect(v.status).toBe('Present');
    expect(v.expected_minutes).toBe(300);
    expect(v.early_leave_minutes).toBe(0);
    // The device, which thinks the day ends at 19:00, would call this a
    // four-hour early departure. It is a completed shift.
    expect(v.exceptions).toEqual([]);
  });
});

describe('4 — approved leave excuses the day, it does not replace it', () => {
  const fullDay = { start_date: MONDAY, end_date: MONDAY, days: 1, is_full_day: 1, leave_type_name: 'Annual Leave' };
  const partial = { start_date: MONDAY, end_date: MONDAY, days: 0.13, is_full_day: 0, leave_type_name: 'Immediate Leave' };

  it('is leave when nobody turned up', () => {
    const v = on(MONDAY, null, { leave: fullDay });
    expect(v.status).toBe('On Leave');
    expect(v.exceptions).toEqual([]);
  });

  it('is a WORKED day when he turned up, however the leave was filed', () => {
    // The case this was written for. Mert filed an hour of leave for a blood
    // test, came in at 11:00 and worked to 19:00. The first version erased the
    // whole day as "On Leave" — eight hours he actually worked.
    const v = on(MONDAY, { check_in: '11:00:00', check_out: '19:00:00' }, { leave: partial });
    expect(v.status).toBe('Late');
    expect(v.late_minutes).toBe(60);
    expect(v.worked_minutes).toBe(420);
    expect(v.status).not.toBe('On Leave');
  });

  it('excuses the lateness rather than raising a case about it', () => {
    // HR already decided this. Asking them to explain it again is noise.
    const v = on(MONDAY, { check_in: '11:00:00', check_out: '19:00:00' }, { leave: partial });
    expect(v.exceptions).toEqual([]);
    expect(v.excused).toBe(true);
    expect(v.excused_by).toBe('Immediate Leave');
  });

  it('still records the minutes, so the report shows the time missed', () => {
    const v = on(MONDAY, { check_in: '11:00:00', check_out: '19:00:00' }, { leave: partial });
    expect(v.late_minutes).toBe(60);
  });

  it('excuses an early departure the same way', () => {
    const v = on(MONDAY, { check_in: '10:00:00', check_out: '17:00:00' }, { leave: partial });
    expect(v.exceptions).toEqual([]);
    expect(v.early_leave_minutes).toBe(120);
  });

  it('a full day worked against approved leave is worth flagging, not punishing', () => {
    const v = on(MONDAY, { check_in: '10:00:00', check_out: '19:00:00' }, { leave: fullDay });
    expect(types(v)).toEqual(['LEAVE_OVERLAP']);
    expect(v.exceptions[0].severity).toBe('Info');
    expect(v.exceptions[0].detail).toMatch(/may need cancelling/);
    expect(v.status).toBe('Present');
  });

  it('will not let a fraction of a day stand in for a whole missing one', () => {
    // No punches and 0.13 of a day approved: that is an absence with a small
    // excuse against it, not a day off.
    const v = on(MONDAY, null, { leave: partial });
    expect(v.status).toBe('Absent');
    expect(types(v)).toEqual(['ABSENT_NO_RECORD']);
    expect(v.excused).toBe(true);
    expect(v.exceptions[0].detail).toMatch(/covers only/);
  });
});

describe('5 — absence', () => {
  it('opens a blocking case for a working day with nothing at all', () => {
    const v = on(MONDAY, null);
    expect(v.status).toBe('Absent');
    expect(types(v)).toEqual(['ABSENT_NO_RECORD']);
    expect(v.exceptions[0].severity).toBe('Blocking');
  });
});

describe('6 — the missing punch', () => {
  it('stops rather than inventing an early departure', () => {
    const v = on(MONDAY, { check_in: '10:05:00', check_out: null });
    expect(types(v)).toEqual(['MISSING_PUNCH']);
    expect(v.status).toBe('Present');
    // The point of the terminal step: no hours are derived from half a day's
    // data, and no second case is raised about the same day.
    expect(v.worked_minutes).toBeNull();
    expect(v.early_leave_minutes).toBeNull();
    expect(v.exceptions).toHaveLength(1);
  });

  it('catches the single punch reported in both columns', () => {
    const v = on(MONDAY, { check_in: '10:05:00', check_out: '10:05:00' });
    expect(types(v)).toEqual(['MISSING_PUNCH']);
  });

  it('catches a checkout with no check-in', () => {
    expect(types(on(MONDAY, { check_in: null, check_out: '19:00:00' }))).toEqual(['MISSING_PUNCH']);
  });
});

describe('7 — the lunch trap', () => {
  it('will not call a 13:00 last punch a six-hour early departure', () => {
    // Somebody punches out for lunch at 13:00 and forgets to punch back in.
    // The device reports 13:00 as their departure. The data cannot tell that
    // apart from a genuine early exit, so the engine says so instead of
    // accusing them.
    const v = on(MONDAY, { check_in: '10:00:00', check_out: '13:00:00' });
    expect(types(v)).toEqual(['IMPLAUSIBLE_PUNCH']);
    expect(v.status).toBe('Half Day');
    expect(v.early_leave_minutes).toBeNull();
    expect(v.exceptions[0].detail).toMatch(/lunch break/i);
    expect(v.exceptions[0].severity).toBe('Blocking');
  });

  it('lets a normal short day through to the ordinary rules', () => {
    // 10:00–17:00 is 6h net of the break — above half of 8h, so it is an early
    // departure to be reviewed, not an unreadable day.
    const v = on(MONDAY, { check_in: '10:00:00', check_out: '17:00:00' });
    expect(types(v)).toEqual(['EARLY_DEPARTURE']);
    expect(v.worked_minutes).toBe(360);
  });

  it('scales with the schedule rather than a fixed hour', () => {
    // On the five-hour Saturday, leaving at 12:00 is 2h — under half of 5h.
    expect(types(on(SATURDAY, { check_in: '10:00:00', check_out: '12:00:00' }))).toEqual(['IMPLAUSIBLE_PUNCH']);
    // …but the same 12:00 departure from a 10:00–15:00 day at 12:40 is not.
    expect(types(on(SATURDAY, { check_in: '10:00:00', check_out: '12:40:00' }))).toEqual(['EARLY_DEPARTURE']);
  });
});

describe('8/9 — the arithmetic and the thresholds', () => {
  it('records a full clean day with nothing to review', () => {
    const v = on(MONDAY, { check_in: '10:00:00', check_out: '19:00:00' });
    expect(v.status).toBe('Present');
    expect(v.worked_minutes).toBe(480);   // 9h gross − 1h break
    expect(v.late_minutes).toBe(0);
    expect(v.exceptions).toEqual([]);
  });

  it('ignores lateness inside the grace period entirely', () => {
    const v = on(MONDAY, { check_in: '10:08:00', check_out: '19:00:00' });
    expect(v.late_minutes).toBe(0);
    expect(v.status).toBe('Present');
    expect(v.exceptions).toEqual([]);
  });

  it('counts the whole overrun once grace is passed, not just the excess', () => {
    // Grace is a tolerance, not a discount: 20 minutes late is 20, not 10.
    const v = on(MONDAY, { check_in: '10:20:00', check_out: '19:00:00' });
    expect(v.late_minutes).toBe(20);
    expect(v.status).toBe('Late');
    // …but 20 is under the 30-minute case threshold, so nobody is asked about it.
    expect(v.exceptions).toEqual([]);
  });

  it('opens a case past the threshold', () => {
    const v = on(MONDAY, { check_in: '10:45:00', check_out: '19:00:00' });
    expect(v.late_minutes).toBe(45);
    expect(types(v)).toEqual(['LATE_ARRIVAL']);
    expect(v.exceptions[0].detail).toContain('45m');
  });

  it('raises both ends when both are bad', () => {
    const v = on(MONDAY, { check_in: '11:00:00', check_out: '18:00:00' });
    expect(types(v).sort()).toEqual(['EARLY_DEPARTURE', 'LATE_ARRIVAL']);
    expect(v.late_minutes).toBe(60);
    expect(v.early_leave_minutes).toBe(60);
  });

  it('catches the day that is short at both ends without either crossing a threshold', () => {
    // 25 late and 25 early, against a 30-minute threshold each: neither fires
    // alone, and together they are nearly an hour.
    const v = on(MONDAY, { check_in: '10:25:00', check_out: '18:35:00' });
    expect(types(v)).toEqual(['INSUFFICIENT_HOURS']);
    expect(v.worked_minutes).toBe(430);
  });

  it('does not raise INSUFFICIENT_HOURS on top of a specific one', () => {
    const v = on(MONDAY, { check_in: '11:00:00', check_out: '19:00:00' });
    expect(types(v)).toEqual(['LATE_ARRIVAL']);
  });

  it('gives the no-meal-break variant the same verdict for a different clock', () => {
    // The whole reason that arrangement needs no special case in the engine.
    const noBreak = {
      ...RE, id: 2, name_en: 'No Meal Break',
      days: RE.days.map((d) => (d.weekday >= 1 && d.weekday <= 5
        ? { ...d, end_time: '18:00:00', break_minutes: 0 } : d)),
    };
    const v = evaluateDay({
      date: MONDAY, row: { check_in: '10:00:00', check_out: '18:00:00' },
      schedule: noBreak, dayRule: resolveDayRule(noBreak, MONDAY),
    });
    expect(v.status).toBe('Present');
    expect(v.worked_minutes).toBe(480);
    expect(v.exceptions).toEqual([]);
  });

  it('honours per-schedule thresholds rather than hardcoded ones', () => {
    const strict = { ...RE, grace_in_minutes: 0, late_case_minutes: 5 };
    const v = evaluateDay({
      date: MONDAY, row: { check_in: '10:06:00', check_out: '19:00:00' },
      schedule: strict, dayRule: resolveDayRule(strict, MONDAY),
    });
    expect(types(v)).toEqual(['LATE_ARRIVAL']);
    expect(v.late_minutes).toBe(6);
  });
});

describe('the order holds', () => {
  it('prefers the holiday over the absence', () => {
    expect(on(MONDAY, null, { holiday: { name_en: 'Eid' } }).status).toBe('Holiday');
  });
  it('prefers the day off over the absence', () => {
    expect(on(SUNDAY, null).status).toBe('Weekend');
  });
  it('prefers a full day of leave over the absence', () => {
    expect(on(MONDAY, null, { leave: { leave_type_name: 'Sick Leave', days: 1, is_full_day: 1 } }).status)
      .toBe('On Leave');
  });
  it('never returns more than one blocking exception for a day', () => {
    const cases = [
      on(MONDAY, null),
      on(MONDAY, { check_in: '10:00:00', check_out: null }),
      on(MONDAY, { check_in: '10:00:00', check_out: '12:00:00' }),
      evaluateDay({ date: MONDAY, row: null, schedule: null, dayRule: null }),
    ];
    for (const v of cases) {
      expect(v.exceptions.filter((e) => e.severity === 'Blocking')).toHaveLength(1);
    }
  });
});

describe('fmtDuration', () => {
  it('reads the way a person would say it', () => {
    expect(fmtDuration(45)).toBe('45m');
    expect(fmtDuration(60)).toBe('1h');
    expect(fmtDuration(85)).toBe('1h 25m');
    expect(fmtDuration(0)).toBe('0m');
  });
});

describe('diffAgainstStored — what shadow mode is for', () => {
  it('spots the device calling a completed Saturday an early departure', () => {
    const v = on(SATURDAY, { check_in: '10:00:00', check_out: '15:00:00' });
    const stored = { status: 'Present', late_minutes: 0, early_leave_minutes: 240 };
    const d = diffAgainstStored(v, stored);
    expect(d.differs).toBe(true);
    expect(d.fields).toContain('early_leave_minutes');
  });

  it('says nothing when the two agree', () => {
    const v = on(MONDAY, { check_in: '10:00:00', check_out: '19:00:00' });
    expect(diffAgainstStored(v, { status: 'Present', late_minutes: 0, early_leave_minutes: 0 }).differs).toBe(false);
  });

  it('does not treat a missing stored value as a disagreement', () => {
    const v = on(MONDAY, { check_in: '10:00:00', check_out: '19:00:00' });
    expect(diffAgainstStored(v, { status: 'Present', late_minutes: null, early_leave_minutes: null }).differs).toBe(false);
  });
});
