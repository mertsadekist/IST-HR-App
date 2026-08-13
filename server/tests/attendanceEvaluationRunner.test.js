/**
 * The evaluator runner, against a real database inside a throwaway company.
 *
 * The first test is the one that matters most. Shadow mode's entire promise is
 * that running the engine cannot change anything anyone is paid on, and
 * payrollService deducts a full day's gross for every row with
 * status = 'Absent'. If that promise breaks, the damage is money.
 *
 * Device ids are global — `importRows` matches on employees.attendance_id across
 * every company — so the fixture uses a `ZZE-` namespace no real employee can
 * hold, and the teardown asserts the live attendance row count is unchanged.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import supertest from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../app.js';
import pool from '../config/db.js';
import { runEvaluation } from '../services/attendanceEvaluationRunner.js';

const tag = `EV${Date.now().toString().slice(-6)}`;
const fx = { company: null, schedule: null, tracked: null, untracked: null, dormant: null, user: null };
let liveRowsBefore;

// Mon 17 Aug – Fri 21 Aug 2026, all working days on the seeded pattern.
const MON = '2026-08-17';
const TUE = '2026-08-18';
const WED = '2026-08-19';
const SUN = '2026-08-16';

// check_in / check_out are DATETIME, not TIME — the date part has to be supplied
// or MySQL rejects a bare clock time.
const addRow = (employeeId, date, checkIn, checkOut, status = 'Present', extra = {}) =>
  pool.query('INSERT INTO attendance SET ?', {
    employee_id: employeeId, company_id: fx.company, work_date: date,
    check_in: checkIn ? `${date} ${checkIn}` : null,
    check_out: checkOut ? `${date} ${checkOut}` : null,
    status, source: 'CSV Import', ...extra,
  });

beforeAll(async () => {
  [[{ c: liveRowsBefore }]] = [await pool.query('SELECT COUNT(*) c FROM attendance').then((r) => r[0])];

  const [co] = await pool.query('INSERT INTO companies SET ?', {
    name: `${tag}_Co`, short_code: `${tag}`.slice(0, 10), currency: 'AED', status: 'Active',
  });
  fx.company = co.insertId;

  const [u] = await pool.query('INSERT INTO users SET ?', {
    name: `${tag} Admin`, username: `${tag}_admin`, password_hash: 'x', role: 'admin', is_active: 1,
  });
  fx.user = u.insertId;

  // Mon–Fri 10:00–19:00 with an hour break; Sat and Sun off.
  const [s] = await pool.query('INSERT INTO work_schedules SET ?', {
    company_id: fx.company, name_en: `${tag} Standard`, is_default: true,
    grace_in_minutes: 10, grace_out_minutes: 10, late_case_minutes: 30, early_case_minutes: 30,
  });
  fx.schedule = s.insertId;
  for (let weekday = 0; weekday <= 6; weekday++) {
    const working = weekday >= 1 && weekday <= 5;
    await pool.query('INSERT INTO work_schedule_days SET ?', {
      schedule_id: fx.schedule, weekday, is_working: working,
      start_time: working ? '10:00:00' : null, end_time: working ? '19:00:00' : null,
      break_minutes: working ? 60 : 0,
    });
  }

  const mkEmp = async (first, deviceId) => {
    const [r] = await pool.query('INSERT INTO employees SET ?', {
      company_id: fx.company, first_name: first, last_name: tag,
      email: `${tag}.${first}@example.test`, status: 'Active', start_date: '2026-01-01',
      attendance_id: deviceId,
    });
    return r.insertId;
  };
  fx.tracked = await mkEmp('Tracked', `ZZE-${tag}-1`);
  fx.untracked = await mkEmp('Untracked', null);       // no device id at all
  fx.dormant = await mkEmp('Dormant', `ZZE-${tag}-2`); // has one, never punches

  // Monday: clean. Tuesday: 50 minutes late. Wednesday: single punch.
  await addRow(fx.tracked, MON, '10:00:00', '19:00:00', 'Present');
  await addRow(fx.tracked, TUE, '10:50:00', '19:00:00', 'Present');
  await addRow(fx.tracked, WED, '10:02:00', null, 'Present');
});

afterAll(async () => {
  if (fx.company) await pool.query('DELETE FROM companies WHERE id = ?', [fx.company]);
  if (fx.user) await pool.query('DELETE FROM users WHERE id = ?', [fx.user]);
  const [[{ c: after }]] = [await pool.query('SELECT COUNT(*) c FROM attendance').then((r) => r[0])];
  // The fixture's own rows cascade with the company; anything else would mean
  // the test reached outside its sandbox.
  expect(after).toBe(liveRowsBefore);
});

describe('shadow mode writes nothing anyone is paid on', () => {
  it('leaves status, late_minutes and early_leave_minutes exactly as they were', async () => {
    const before = await storedRows();
    await runEvaluation({ from: SUN, to: WED, companyId: fx.company, userId: fx.user });
    const after = await storedRows();
    expect(after).toEqual(before);
  });

  it('records its opinion in the eval_ columns instead', async () => {
    const [[tue]] = await pool.query(
      'SELECT status, late_minutes, eval_status, eval_late_minutes, eval_worked_minutes, expected_minutes, schedule_id, schedule_snapshot '
      + 'FROM attendance WHERE employee_id = ? AND work_date = ?', [fx.tracked, TUE]);
    expect(tue.status).toBe('Present');       // untouched
    expect(tue.late_minutes).toBeNull();      // untouched
    expect(tue.eval_status).toBe('Late');     // the engine's view
    expect(tue.eval_late_minutes).toBe(50);
    expect(tue.expected_minutes).toBe(480);
    expect(tue.schedule_id).toBe(fx.schedule);
    const snap = typeof tue.schedule_snapshot === 'string' ? JSON.parse(tue.schedule_snapshot) : tue.schedule_snapshot;
    expect(snap).toMatchObject({ schedule_id: fx.schedule, expected_minutes: 480, start_time: '10:00:00' });
  });

  it('refuses to run live at all in this build', async () => {
    await expect(runEvaluation({ from: MON, to: MON, companyId: fx.company, shadow: false }))
      .rejects.toThrow(/shadow mode/i);
  });
});

describe('it only concludes where it has evidence', () => {
  it('raises no absence on a day the feed never covered', async () => {
    // Thursday and Friday have no rows for anybody, so nothing is known about
    // them. Before this guard the first live run marked all 27 staff absent on
    // a day whose file had simply not arrived yet.
    await runEvaluation({ from: MON, to: '2026-08-21', companyId: fx.company, userId: fx.user });
    const [rows] = await pool.query(
      `SELECT DATE_FORMAT(work_date, '%Y-%m-%d') d FROM attendance_exceptions
        WHERE company_id = ? AND type = 'ABSENT_NO_RECORD'`, [fx.company]);
    expect(rows.map((r) => r.d)).not.toContain('2026-08-20');
    expect(rows.map((r) => r.d)).not.toContain('2026-08-21');
  });

  it('says nothing about an employee with no device id', async () => {
    const [[n]] = await pool.query(
      'SELECT COUNT(*) c FROM attendance_exceptions WHERE employee_id = ?', [fx.untracked]);
    expect(n.c).toBe(0);
  });

  it('says nothing about an employee who never appears in the range', async () => {
    // Usually somebody offboarded whose end date was never entered. One finding
    // in the run summary beats one absence per working day.
    const [[n]] = await pool.query(
      'SELECT COUNT(*) c FROM attendance_exceptions WHERE employee_id = ?', [fx.dormant]);
    expect(n.c).toBe(0);
    const res = await runEvaluation({ from: MON, to: WED, companyId: fx.company, userId: fx.user });
    expect(res.dormant_employees.map((e) => e.id)).toContain(fx.dormant);
    expect(res.untracked_employees.map((e) => e.id)).toContain(fx.untracked);
  });

  it('never treats the weekly day off as an absence', async () => {
    const [[n]] = await pool.query(
      `SELECT COUNT(*) c FROM attendance_exceptions WHERE company_id = ? AND work_date = ?`, [fx.company, SUN]);
    expect(n.c).toBe(0);
  });
});

describe('the cases it does raise', () => {
  it('raises exactly the right ones', async () => {
    await runEvaluation({ from: SUN, to: WED, companyId: fx.company, userId: fx.user });
    const [rows] = await pool.query(
      `SELECT DATE_FORMAT(work_date, '%Y-%m-%d') d, type FROM attendance_exceptions
        WHERE company_id = ? ORDER BY d`, [fx.company]);
    expect(rows).toEqual([
      { d: TUE, type: 'LATE_ARRIVAL' },
      { d: WED, type: 'MISSING_PUNCH' },
    ]);
  });

  it('updates rather than duplicates when run again', async () => {
    await runEvaluation({ from: SUN, to: WED, companyId: fx.company, userId: fx.user });
    await runEvaluation({ from: SUN, to: WED, companyId: fx.company, userId: fx.user });
    const [[n]] = await pool.query('SELECT COUNT(*) c FROM attendance_exceptions WHERE company_id = ?', [fx.company]);
    expect(n.c).toBe(2);
  });

  it('counts a case as new only once, however often it re-runs', async () => {
    // Not a nicety — the morning email leads with "N new case(s)". Getting this
    // wrong announced a dozen new cases every day for cases that had existed for
    // a week, which is the fastest way to train somebody to stop reading it.
    //
    // The cause is worth remembering: `INSERT … ON DUPLICATE KEY UPDATE` is
    // documented to return affectedRows 1 for an insert and 2 for a changed
    // update, but on this connection an unchanged upsert also returns 1. The
    // Drive importer hit the same trap. Neither may derive "was it new" from it.
    await pool.query('DELETE FROM attendance_exceptions WHERE company_id = ?', [fx.company]);

    const first = await runEvaluation({ from: SUN, to: WED, companyId: fx.company, userId: fx.user });
    expect(first.exceptions_opened).toBe(2);
    expect(first.exceptions_updated).toBe(0);
    expect(first.opened_cases).toHaveLength(2);

    const second = await runEvaluation({ from: SUN, to: WED, companyId: fx.company, userId: fx.user });
    expect(second.exceptions_opened).toBe(0);
    expect(second.exceptions_updated).toBe(2);
    // Nothing new means nothing to name in the email.
    expect(second.opened_cases).toEqual([]);

    const third = await runEvaluation({ from: SUN, to: WED, companyId: fx.company, userId: fx.user });
    expect(third.exceptions_opened).toBe(0);
  });

  it('closes a case once the day is fixed, rather than deleting it', async () => {
    await pool.query('UPDATE attendance SET check_out = ? WHERE employee_id = ? AND work_date = ?',
      [`${WED} 19:00:00`, fx.tracked, WED]);
    await runEvaluation({ from: SUN, to: WED, companyId: fx.company, userId: fx.user });
    const [[exc]] = await pool.query(
      "SELECT status FROM attendance_exceptions WHERE company_id = ? AND type = 'MISSING_PUNCH'", [fx.company]);
    expect(exc.status).toBe('Auto-resolved');
  });

  it('reopens it if the fault comes back', async () => {
    await pool.query('UPDATE attendance SET check_out = NULL WHERE employee_id = ? AND work_date = ?',
      [fx.tracked, WED]);
    await runEvaluation({ from: SUN, to: WED, companyId: fx.company, userId: fx.user });
    const [[exc]] = await pool.query(
      "SELECT status FROM attendance_exceptions WHERE company_id = ? AND type = 'MISSING_PUNCH'", [fx.company]);
    expect(exc.status).toBe('Open');
  });

  it('never overwrites a decision a person made', async () => {
    // Waived and Resolved are human judgements. A re-run may update the detail
    // and the minutes, but it must not drag the case back to Open.
    await pool.query(
      "UPDATE attendance_exceptions SET status = 'Waived', resolution = 'Agreed with manager' "
      + 'WHERE company_id = ? AND type = ?', [fx.company, 'LATE_ARRIVAL']);
    await runEvaluation({ from: SUN, to: WED, companyId: fx.company, userId: fx.user });
    const [[exc]] = await pool.query(
      "SELECT status, resolution FROM attendance_exceptions WHERE company_id = ? AND type = 'LATE_ARRIVAL'",
      [fx.company]);
    expect(exc.status).toBe('Waived');
    expect(exc.resolution).toBe('Agreed with manager');
  });
});

describe('the run log', () => {
  it('records what happened, so a sweep can be explained afterwards', async () => {
    const res = await runEvaluation({ from: SUN, to: WED, companyId: fx.company, userId: fx.user });
    const [[run]] = await pool.query('SELECT * FROM attendance_evaluation_runs WHERE id = ?', [res.runId]);
    expect(run.shadow).toBe(1);
    expect(run.days_evaluated).toBeGreaterThan(0);
    expect(run.finished_at).toBeTruthy();
    expect(run.evaluation_version).toBe(1);
    await pool.query('DELETE FROM attendance_evaluation_runs WHERE company_id = ?', [fx.company]);
  });

  it('rejects a reversed range instead of silently doing nothing', async () => {
    await expect(runEvaluation({ from: WED, to: MON, companyId: fx.company })).rejects.toThrow(/date range/i);
  });
});

describe('the API', () => {
  const request = supertest(app);
  let tok;
  const bearer = () => ({ Authorization: `Bearer ${tok}` });

  beforeAll(() => {
    tok = jwt.sign({ id: fx.user, name: `${tag} Admin`, role: 'admin', company_id: null },
      process.env.JWT_SECRET, { expiresIn: '1h' });
  });

  it('runs on demand and reports what it did', async () => {
    const res = await request.post('/api/attendance-evaluation/run').set(bearer())
      .send({ from: SUN, to: WED, company_id: fx.company });
    expect(res.status).toBe(200);
    expect(res.body.days_evaluated).toBeGreaterThan(0);
  });

  it('rejects a malformed range rather than guessing one', async () => {
    const bad = await request.post('/api/attendance-evaluation/run').set(bearer()).send({ from: 'soon', to: WED });
    expect(bad.status).toBe(400);
    const reversed = await request.post('/api/attendance-evaluation/run').set(bearer()).send({ from: WED, to: SUN });
    expect(reversed.status).toBe(400);
  });

  it('summarises agreement and the people cases cluster on', async () => {
    const res = await request.get(`/api/attendance-evaluation/summary?from=${SUN}&to=${WED}&company_id=${fx.company}`).set(bearer());
    expect(res.status).toBe(200);
    expect(res.body.agreement.evaluated).toBeGreaterThan(0);
    expect(Array.isArray(res.body.top_people)).toBe(true);
  });

  it('lists the cases, and filters to the open ones', async () => {
    const all = await request.get(`/api/attendance-evaluation/exceptions?from=${SUN}&to=${WED}&company_id=${fx.company}`).set(bearer());
    expect(all.status).toBe(200);
    expect(all.body.length).toBeGreaterThan(0);
    const open = await request.get(`/api/attendance-evaluation/exceptions?from=${SUN}&to=${WED}&company_id=${fx.company}&status=open`).set(bearer());
    expect(open.body.every((e) => ['Open', 'Awaiting Employee', 'Awaiting Manager'].includes(e.status))).toBe(true);
  });

  it('returns only days where the two actually disagree', async () => {
    const res = await request.get(`/api/attendance-evaluation/comparison?from=${SUN}&to=${WED}&company_id=${fx.company}`).set(bearer());
    expect(res.status).toBe(200);
    for (const r of res.body) {
      const differs = (r.stored_status && r.eval_status !== r.stored_status)
        || (r.stored_late != null && r.eval_late_minutes != null && r.eval_late_minutes !== r.stored_late)
        || (r.stored_early != null && r.eval_early_leave_minutes != null && r.eval_early_leave_minutes !== r.stored_early);
      expect(differs).toBe(true);
    }
  });

  it('is closed to roles with no HR module', async () => {
    const recruiter = jwt.sign({ id: fx.user, name: 'R', role: 'recruiter', company_id: fx.company },
      process.env.JWT_SECRET, { expiresIn: '1h' });
    const res = await request.get('/api/attendance-evaluation/summary').set({ Authorization: `Bearer ${recruiter}` });
    expect(res.status).toBe(403);
  });

  it('will not let a non-manager set the engine running', async () => {
    const accountant = jwt.sign({ id: fx.user, name: 'A', role: 'accountant', company_id: fx.company },
      process.env.JWT_SECRET, { expiresIn: '1h' });
    const res = await request.post('/api/attendance-evaluation/run')
      .set({ Authorization: `Bearer ${accountant}` }).send({ from: SUN, to: WED });
    expect(res.status).toBe(403);
  });
});

/** The three columns shadow mode promises never to touch. */
async function storedRows() {
  const [rows] = await pool.query(
    `SELECT id, status, late_minutes, early_leave_minutes FROM attendance
      WHERE company_id = ? ORDER BY id`, [fx.company]);
  return rows;
}
