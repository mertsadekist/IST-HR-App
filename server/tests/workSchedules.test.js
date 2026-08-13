/**
 * Work schedules — the reference data the attendance evaluator will be built on.
 *
 * Two halves. The pure functions are tested without a database, because they are
 * where the arithmetic that will eventually decide somebody's pay actually lives.
 * The API half runs against the real database inside a throwaway company, and
 * asserts the two rules that would do real damage if they broke: that an
 * assignment cannot cross a company boundary, and that changing a schedule in
 * September does not re-interpret August.
 *
 * Nothing here touches the `attendance` table. Phase 1 is reference data only,
 * and a test that wrote an attendance row would be testing something that does
 * not exist yet.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import supertest from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../app.js';
import pool from '../config/db.js';
import {
  weekdayOf, minutesOfDay, formatMinutes, expectedNetMinutes, resolveDayRule,
  validateScheduleDays, scheduleSnapshot, resolveScheduleId, resolveEffectiveSchedule,
} from '../services/workScheduleService.js';

// ───────────────────────── pure ─────────────────────────

describe('weekdayOf', () => {
  it('reads the weekday straight from the string', () => {
    expect(weekdayOf('2026-08-16')).toBe(0); // Sunday
    expect(weekdayOf('2026-08-17')).toBe(1); // Monday
    expect(weekdayOf('2026-08-15')).toBe(6); // Saturday
  });

  it('does not shift with the server timezone', () => {
    // The reason this is not `new Date(str).getDay()`: that parses as UTC
    // midnight, so any zone west of Greenwich reports the previous day and the
    // shift a day is judged against would depend on where the server runs.
    const saved = process.env.TZ;
    for (const tz of ['UTC', 'America/Los_Angeles', 'Asia/Dubai', 'Pacific/Kiritimati']) {
      process.env.TZ = tz;
      expect(weekdayOf('2026-08-15')).toBe(6);
    }
    process.env.TZ = saved;
  });

  it('returns null for anything that is not a date', () => {
    expect(weekdayOf('')).toBeNull();
    expect(weekdayOf(null)).toBeNull();
    expect(weekdayOf('15/08/2026')).toBeNull();
  });
});

describe('minutesOfDay', () => {
  it('converts wall-clock to minutes since midnight', () => {
    expect(minutesOfDay('00:00:00')).toBe(0);
    expect(minutesOfDay('10:00:00')).toBe(600);
    expect(minutesOfDay('19:00')).toBe(1140);
    expect(minutesOfDay('23:59:59')).toBe(1439);
  });

  it('rejects nonsense rather than coercing it to zero', () => {
    expect(minutesOfDay('25:00')).toBeNull();
    expect(minutesOfDay('10:75')).toBeNull();
    expect(minutesOfDay('lunchtime')).toBeNull();
    expect(minutesOfDay(null)).toBeNull();
  });

  it('round-trips through formatMinutes', () => {
    expect(formatMinutes(minutesOfDay('14:35:00'))).toBe('14:35');
  });
});

describe('expectedNetMinutes — the break is policy, not measurement', () => {
  it('subtracts the meal break from the span', () => {
    // 10:00–19:00 with an hour for lunch.
    expect(expectedNetMinutes({ is_working: true, start_time: '10:00:00', end_time: '19:00:00', break_minutes: 60 })).toBe(480);
  });

  it('gives the no-meal-break variant the same eight hours', () => {
    // This is the whole reason the arrangement needs no special case: a shift
    // ending at 18:00 with no break is the same net day as one ending at 19:00
    // with an hour off, so one formula covers both.
    expect(expectedNetMinutes({ is_working: true, start_time: '10:00:00', end_time: '18:00:00', break_minutes: 0 })).toBe(480);
  });

  it('handles the short Saturday', () => {
    expect(expectedNetMinutes({ is_working: true, start_time: '10:00:00', end_time: '15:00:00', break_minutes: 0 })).toBe(300);
  });

  it('is zero on a non-working day', () => {
    expect(expectedNetMinutes({ is_working: false })).toBe(0);
    expect(expectedNetMinutes(null)).toBe(0);
  });

  it('never returns a negative, however absurd the break', () => {
    expect(expectedNetMinutes({ is_working: true, start_time: '10:00:00', end_time: '11:00:00', break_minutes: 600 })).toBe(0);
  });
});

describe('resolveDayRule', () => {
  const schedule = {
    id: 1, name_en: 'RE Standard', timezone: 'Asia/Dubai',
    grace_in_minutes: 10, grace_out_minutes: 10,
    late_case_minutes: 30, early_case_minutes: 30, half_day_threshold_pct: 50,
    days: [
      { weekday: 0, is_working: false },
      ...[1, 2, 3, 4, 5].map((weekday) => ({ weekday, is_working: true, start_time: '10:00:00', end_time: '19:00:00', break_minutes: 60 })),
      { weekday: 6, is_working: true, start_time: '10:00:00', end_time: '15:00:00', break_minutes: 0 },
    ],
  };

  it('gives the full shift on a weekday', () => {
    const rule = resolveDayRule(schedule, '2026-08-17'); // Monday
    expect(rule.is_working).toBe(true);
    expect(rule.start_time).toBe('10:00:00');
    expect(rule.expected_minutes).toBe(480);
  });

  it('gives the short shift on Saturday', () => {
    const rule = resolveDayRule(schedule, '2026-08-15');
    expect(rule.end_time).toBe('15:00:00');
    expect(rule.expected_minutes).toBe(300);
  });

  it('reports Sunday as not working', () => {
    // The device would call this a nine-hour absence. It is the weekly day off.
    const rule = resolveDayRule(schedule, '2026-08-16');
    expect(rule.is_working).toBe(false);
    expect(rule.expected_minutes).toBe(0);
  });

  it('does not invent a shift for a weekday the schedule never listed', () => {
    expect(resolveDayRule({ id: 2, days: [] }, '2026-08-17').is_working).toBe(false);
  });

  it('carries the thresholds into the snapshot that will be frozen on the row', () => {
    const snap = scheduleSnapshot(schedule, resolveDayRule(schedule, '2026-08-15'));
    expect(snap).toMatchObject({
      schedule_id: 1, weekday: 6, is_working: true,
      end_time: '15:00:00', expected_minutes: 300,
      grace_in_minutes: 10, late_case_minutes: 30,
    });
  });
});

describe('validateScheduleDays', () => {
  const working = (weekday) => ({ weekday, is_working: true, start_time: '10:00:00', end_time: '19:00:00', break_minutes: 60 });

  it('always returns seven days, filling absent ones as non-working', () => {
    const { errors, days } = validateScheduleDays([1, 2, 3, 4, 5].map(working));
    expect(errors).toEqual([]);
    expect(days).toHaveLength(7);
    expect(days.filter((d) => d.is_working).map((d) => d.weekday)).toEqual([1, 2, 3, 4, 5]);
    expect(days.find((d) => d.weekday === 0).is_working).toBe(false);
  });

  it('refuses a working day with no times', () => {
    const { errors } = validateScheduleDays([{ weekday: 1, is_working: true }]);
    expect(errors.join(' ')).toMatch(/start time is missing/);
    expect(errors.join(' ')).toMatch(/end time is missing/);
  });

  it('refuses a break longer than the shift', () => {
    // Left unchecked this yields negative expected hours, which would quietly
    // poison every calculation built on top of it.
    const { errors } = validateScheduleDays([
      { weekday: 1, is_working: true, start_time: '10:00:00', end_time: '12:00:00', break_minutes: 180 },
    ]);
    expect(errors.join(' ')).toMatch(/break is longer than the shift/);
  });

  it('refuses a week with no working day at all', () => {
    const { errors } = validateScheduleDays([{ weekday: 1, is_working: false }]);
    expect(errors).toContain('A schedule needs at least one working day');
  });

  it('rejects a duplicated or out-of-range weekday', () => {
    expect(validateScheduleDays([working(1), working(1)]).errors.join(' ')).toMatch(/more than once/);
    expect(validateScheduleDays([working(9)]).errors.join(' ')).toMatch(/weekday must be 0–6/);
  });

  it('collects every problem at once rather than stopping at the first', () => {
    const { errors } = validateScheduleDays([
      { weekday: 1, is_working: true },
      { weekday: 2, is_working: true, start_time: '10:00', end_time: '11:00', break_minutes: 90 },
    ]);
    expect(errors.length).toBeGreaterThan(2);
  });
});

// ───────────────────────── seeded reality ─────────────────────────

describe('the seeded IST schedules describe the real working week', () => {
  it('gives IST Real Estate a working Saturday and Sunday off', async () => {
    const [[re]] = await pool.query(
      "SELECT id FROM work_schedules WHERE name_en = 'IST Real Estate — Standard'");
    if (!re) return; // migration not applied on this database
    const [days] = await pool.query(
      "SELECT weekday, is_working, TIME_FORMAT(end_time,'%H:%i') end_time FROM work_schedule_days WHERE schedule_id = ? ORDER BY weekday", [re.id]);
    expect(days.find((d) => d.weekday === 6)).toMatchObject({ is_working: 1, end_time: '15:00' });
    expect(days.find((d) => d.weekday === 0).is_working).toBe(0);
  });

  it('gives IST Markets both Saturday and Sunday off', async () => {
    const [[mk]] = await pool.query(
      "SELECT id FROM work_schedules WHERE name_en = 'IST Markets — Standard'");
    if (!mk) return;
    const [days] = await pool.query(
      'SELECT weekday, is_working FROM work_schedule_days WHERE schedule_id = ?', [mk.id]);
    expect(days.find((d) => d.weekday === 6).is_working).toBe(0);
    expect(days.find((d) => d.weekday === 0).is_working).toBe(0);
  });
});

// ───────────────────────── API, in a throwaway company ─────────────────────────

const request = supertest(app);
const tag = `WS${Date.now().toString().slice(-6)}`;
const bearer = (t) => ({ Authorization: `Bearer ${t}` });

const fx = { companyA: null, companyB: null, empA: null, empB: null, schedA: null, schedB: null, userId: null };
let tokAdmin;

beforeAll(async () => {
  const [a] = await pool.query('INSERT INTO companies SET ?', { name: `${tag}_A`, short_code: `${tag}A`.slice(0, 10), currency: 'AED', status: 'Active' });
  const [b] = await pool.query('INSERT INTO companies SET ?', { name: `${tag}_B`, short_code: `${tag}B`.slice(0, 10), currency: 'AED', status: 'Active' });
  fx.companyA = a.insertId;
  fx.companyB = b.insertId;

  const [u] = await pool.query('INSERT INTO users SET ?', {
    name: `${tag} Admin`, username: `${tag}_admin`, email: `${tag}@example.test`,
    password_hash: 'x', role: 'admin', company_id: null, is_active: 1,
  });
  fx.userId = u.insertId;
  tokAdmin = jwt.sign({ id: u.insertId, name: `${tag} Admin`, role: 'admin', company_id: null },
    process.env.JWT_SECRET, { expiresIn: '1h' });

  const mkEmp = async (companyId, first) => {
    const [r] = await pool.query('INSERT INTO employees SET ?', {
      company_id: companyId, first_name: first, last_name: tag,
      email: `${tag}.${first}@example.test`, status: 'Active', start_date: '2026-01-01',
    });
    return r.insertId;
  };
  fx.empA = await mkEmp(fx.companyA, 'Ayla');
  fx.empB = await mkEmp(fx.companyB, 'Bilal');
});

afterAll(async () => {
  // Schedules and assignments cascade from the companies.
  if (fx.companyA) await pool.query('DELETE FROM companies WHERE id IN (?, ?)', [fx.companyA, fx.companyB]);
  if (fx.userId) await pool.query('DELETE FROM users WHERE id = ?', [fx.userId]);
});

describe('POST /api/work-schedules', () => {
  it('creates a schedule with its seven days', async () => {
    const res = await request.post('/api/work-schedules').set(bearer(tokAdmin)).send({
      company_id: fx.companyA,
      name_en: `${tag} Standard`,
      is_default: true,
      days: [1, 2, 3, 4, 5].map((weekday) => ({ weekday, is_working: true, start_time: '10:00:00', end_time: '19:00:00', break_minutes: 60 })),
    });
    expect(res.status).toBe(201);
    expect(res.body.days).toHaveLength(7);
    fx.schedA = res.body.id;
  });

  it('refuses a malformed week with 422 and says what is wrong', async () => {
    const res = await request.post('/api/work-schedules').set(bearer(tokAdmin)).send({
      company_id: fx.companyA, name_en: `${tag} Broken`,
      days: [{ weekday: 1, is_working: true, start_time: 'noon', end_time: '19:00' }],
    });
    expect(res.status).toBe(422);
    expect(res.body.error).toMatch(/start time/);
  });

  it('refuses a duplicate name in the same company', async () => {
    const res = await request.post('/api/work-schedules').set(bearer(tokAdmin)).send({
      company_id: fx.companyA, name_en: `${tag} Standard`,
      days: [{ weekday: 1, is_working: true, start_time: '10:00', end_time: '19:00' }],
    });
    expect(res.status).toBe(409);
  });

  it('keeps exactly one default per company', async () => {
    const res = await request.post('/api/work-schedules').set(bearer(tokAdmin)).send({
      company_id: fx.companyA, name_en: `${tag} No Break`, is_default: true,
      days: [1, 2, 3, 4, 5].map((weekday) => ({ weekday, is_working: true, start_time: '10:00:00', end_time: '18:00:00', break_minutes: 0 })),
    });
    expect(res.status).toBe(201);
    const [[count]] = await pool.query(
      'SELECT COUNT(*) c FROM work_schedules WHERE company_id = ? AND is_default = TRUE', [fx.companyA]);
    expect(count.c).toBe(1);
  });
});

describe('assignment', () => {
  it('puts an employee on a schedule', async () => {
    const res = await request.post('/api/work-schedules/assignments').set(bearer(tokAdmin))
      .send({ employee_id: fx.empA, schedule_id: fx.schedA, effective_from: '2026-08-01' });
    expect(res.status).toBe(201);
  });

  it('refuses to assign across a company boundary', async () => {
    // The damaging case: company B's employee judged against company A's
    // working week, which is a different Saturday.
    const res = await request.post('/api/work-schedules/assignments').set(bearer(tokAdmin))
      .send({ employee_id: fx.empB, schedule_id: fx.schedA, effective_from: '2026-08-01' });
    expect(res.status).toBe(422);
    expect(res.body.error).toMatch(/different company/i);
  });

  it('rejects a missing or malformed effective date', async () => {
    const res = await request.post('/api/work-schedules/assignments').set(bearer(tokAdmin))
      .send({ employee_id: fx.empA, schedule_id: fx.schedA, effective_from: 'soon' });
    expect(res.status).toBe(400);
  });

  it('closes the previous assignment when a new one starts', async () => {
    const [[second]] = await pool.query(
      'SELECT id FROM work_schedules WHERE company_id = ? AND name_en = ?', [fx.companyA, `${tag} No Break`]);
    const res = await request.post('/api/work-schedules/assignments').set(bearer(tokAdmin))
      .send({ employee_id: fx.empA, schedule_id: second.id, effective_from: '2026-09-01' });
    expect(res.status).toBe(201);

    const [rows] = await pool.query(
      `SELECT DATE_FORMAT(effective_from,'%Y-%m-%d') f, DATE_FORMAT(effective_to,'%Y-%m-%d') t
         FROM employee_work_schedules WHERE employee_id = ? ORDER BY effective_from`, [fx.empA]);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({ f: '2026-08-01', t: '2026-08-31' });
    expect(rows[1].t).toBeNull();
  });

  it('does not let September reinterpret August', async () => {
    // The entire reason the assignment is effective-dated. A day in August must
    // still resolve to the shift that was in force in August.
    const [[second]] = await pool.query(
      'SELECT id FROM work_schedules WHERE company_id = ? AND name_en = ?', [fx.companyA, `${tag} No Break`]);
    expect((await resolveScheduleId(fx.empA, '2026-08-15')).schedule_id).toBe(fx.schedA);
    expect((await resolveScheduleId(fx.empA, '2026-09-15')).schedule_id).toBe(second.id);
    // And a date before anything was assigned falls back rather than guessing.
    const early = await resolveScheduleId(fx.empA, '2026-07-01');
    expect(early.source).toBe('company_default');
  });

  it('resolves the whole rule for a day, with the source of the schedule', async () => {
    const eff = await resolveEffectiveSchedule(fx.empA, '2026-08-17'); // a Monday
    expect(eff.source).toBe('assignment');
    expect(eff.dayRule.expected_minutes).toBe(480);
    expect(eff.snapshot.schedule_id).toBe(fx.schedA);
  });

  it('falls back to the company default for an employee nobody assigned', async () => {
    const eff = await resolveEffectiveSchedule(fx.empB, '2026-08-17');
    // Company B has no schedules at all, so there is nothing to fall back to —
    // and the resolver says so instead of inventing a nine-to-five.
    expect(eff).toBeNull();
  });
});

describe('deleting a schedule', () => {
  it('refuses while employees are still on it, rather than cascading the history away', async () => {
    const res = await request.delete(`/api/work-schedules/${fx.schedA}`).set(bearer(tokAdmin));
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/assigned to/);
  });
});

describe('holidays', () => {
  // Far-future dates on purpose. An earlier version of this suite used December
  // 2026 and started failing the moment the real UAE calendar was seeded — the
  // group-wide National Day already occupied that date. Fixtures must not live
  // in a year anyone's real data can reach.
  const YEAR = 2099;
  const DAY_ONE = `${YEAR}-12-02`;
  const DAY_TWO = `${YEAR}-12-03`;
  let holidayId;

  it('records one for a single company', async () => {
    const res = await request.post('/api/work-schedules/holidays').set(bearer(tokAdmin))
      .send({ company_id: fx.companyA, holiday_date: DAY_ONE, name_en: `${tag} National Day` });
    expect(res.status).toBe(201);
    holidayId = res.body.id;
  });

  it('refuses a second holiday on the same date for that company', async () => {
    const res = await request.post('/api/work-schedules/holidays').set(bearer(tokAdmin))
      .send({ company_id: fx.companyA, holiday_date: DAY_ONE, name_en: 'Duplicate' });
    expect(res.status).toBe(409);
  });

  it('rejects a date that is not a date', async () => {
    const res = await request.post('/api/work-schedules/holidays').set(bearer(tokAdmin))
      .send({ company_id: fx.companyA, holiday_date: 'next Tuesday', name_en: 'Nope' });
    expect(res.status).toBe(400);
  });

  it('lists it for that company', async () => {
    const res = await request.get(`/api/work-schedules/holidays?year=${YEAR}&company_id=${fx.companyA}`).set(bearer(tokAdmin));
    expect(res.status).toBe(200);
    expect(res.body.some((h) => h.id === holidayId && h.holiday_date === DAY_ONE)).toBe(true);
  });

  it('shows a group-wide holiday to every company rather than hiding it', async () => {
    // company_id NULL means "all companies", so it has to survive the scope
    // filter — the naive `AND company_id = ?` would drop it.
    const res = await request.post('/api/work-schedules/holidays').set(bearer(tokAdmin))
      .send({ all_companies: true, holiday_date: DAY_TWO, name_en: `${tag} Group Holiday` });
    expect(res.status).toBe(201);

    const scoped = await request.get(`/api/work-schedules/holidays?year=${YEAR}&company_id=${fx.companyB}`).set(bearer(tokAdmin));
    expect(scoped.body.some((h) => h.holiday_date === DAY_TWO)).toBe(true);

    await pool.query('DELETE FROM holidays WHERE id = ?', [res.body.id]);
  });
});

describe('coverage — who still needs a schedule', () => {
  it('reports the assigned one for an employee who has it, and nothing for one who does not', async () => {
    const res = await request.get(`/api/work-schedules/coverage?company_id=${fx.companyA}`).set(bearer(tokAdmin));
    expect(res.status).toBe(200);
    const ayla = res.body.find((r) => r.id === fx.empA);
    expect(ayla.schedule_id).toBeTruthy();

    const resB = await request.get(`/api/work-schedules/coverage?company_id=${fx.companyB}`).set(bearer(tokAdmin));
    const bilal = resB.body.find((r) => r.id === fx.empB);
    expect(bilal.schedule_id).toBeNull();
    expect(bilal.default_schedule_name).toBeNull();
  });
});
