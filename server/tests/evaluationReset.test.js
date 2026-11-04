/**
 * "Clear and re-check" on Attendance Checks, and the rule that a day still in
 * progress is never judged. Real database, throwaway company; like the other
 * evaluator tests it refuses a non-local DB_HOST unless ALLOW_REMOTE_DB_TESTS=1.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import supertest from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../app.js';
import pool from '../config/db.js';
import { runEvaluation } from '../services/attendanceEvaluationRunner.js';

const LOCAL = ['127.0.0.1', 'localhost', '::1'].includes(String(process.env.DB_HOST || '').trim());
const suite = LOCAL || process.env.ALLOW_REMOTE_DB_TESTS === '1' ? describe : describe.skip;

const tag = `RS${Date.now().toString().slice(-6)}`;
const MON = '2026-08-17';
const TUE = '2026-08-18';
const fx = { company: null, admin: null, manager: null, emp: null, waived: null };

suite('clear and re-check', () => {
  const request = supertest(app);
  const bearer = (id, role) => ({
    Authorization: `Bearer ${jwt.sign({ id, name: `${tag} ${role}`, role, company_id: null }, process.env.JWT_SECRET, { expiresIn: '1h' })}`,
  });

  beforeAll(async () => {
    const [co] = await pool.query('INSERT INTO companies SET ?', { name: `${tag}_Co`, short_code: tag, currency: 'AED', status: 'Active' });
    fx.company = co.insertId;
    const mkUser = async (role) => (await pool.query('INSERT INTO users SET ?', {
      name: `${tag} ${role}`, username: `${tag}_${role}`, password_hash: 'x', role, is_active: 1,
    }))[0].insertId;
    fx.admin = await mkUser('admin');
    fx.manager = await mkUser('hr_manager');

    const [s] = await pool.query('INSERT INTO work_schedules SET ?', {
      company_id: fx.company, name_en: `${tag} Std`, is_default: true,
      grace_in_minutes: 10, grace_out_minutes: 10, late_case_minutes: 30, early_case_minutes: 30,
    });
    for (let weekday = 0; weekday <= 6; weekday++) {
      const w = weekday >= 1 && weekday <= 5;
      await pool.query('INSERT INTO work_schedule_days SET ?', {
        schedule_id: s.insertId, weekday, is_working: w,
        start_time: w ? '10:00:00' : null, end_time: w ? '19:00:00' : null, break_minutes: w ? 60 : 0,
      });
    }
    const [e] = await pool.query('INSERT INTO employees SET ?', {
      company_id: fx.company, first_name: 'Reset', last_name: tag, email: `${tag}@x.test`,
      status: 'Active', start_date: '2026-01-01', attendance_id: `ZZR-${tag}`,
    });
    fx.emp = e.insertId;
    // Monday: an hour late. Tuesday: on time.
    for (const [d, ci] of [[MON, '11:00:00'], [TUE, '10:00:00']]) {
      await pool.query('INSERT INTO attendance SET ?', {
        company_id: fx.company, employee_id: fx.emp, work_date: d,
        check_in: `${d} ${ci}`, check_out: `${d} 19:00:00`, status: 'Present', source: 'Hik Central',
      });
    }
    await runEvaluation({ from: MON, to: TUE, companyId: fx.company, userId: fx.admin });

    // A stale case the engine would no longer raise, and one HR already decided.
    await pool.query('INSERT INTO attendance_exceptions SET ?', {
      employee_id: fx.emp, company_id: fx.company, work_date: TUE, type: 'ABSENT_NO_RECORD',
      severity: 'Blocking', detail: 'stale', status: 'Open', shadow: true,
    });
    const [w] = await pool.query('INSERT INTO attendance_exceptions SET ?', {
      employee_id: fx.emp, company_id: fx.company, work_date: TUE, type: 'EARLY_DEPARTURE',
      severity: 'Review', detail: 'decided', status: 'Waived', resolution: 'HR waived', resolved_by: fx.admin, shadow: true,
    });
    fx.waived = w.insertId;
  });

  afterAll(async () => {
    if (fx.company) await pool.query('DELETE FROM companies WHERE id = ?', [fx.company]);
    for (const id of [fx.admin, fx.manager]) if (id) await pool.query('DELETE FROM users WHERE id = ?', [id]);
  });

  const cases = async () => (await pool.query(
    `SELECT DATE_FORMAT(work_date, '%Y-%m-%d') d, type, status FROM attendance_exceptions
      WHERE employee_id = ? ORDER BY work_date, type`, [fx.emp]))[0];

  it('is refused to anyone but an admin', async () => {
    const res = await request.post('/api/attendance-evaluation/reset')
      .set(bearer(fx.manager, 'hr_manager')).send({ from: MON, to: TUE, company_id: fx.company });
    expect(res.status).toBe(403);
  });

  it('validates the range', async () => {
    const back = await request.post('/api/attendance-evaluation/reset').set(bearer(fx.admin, 'admin')).send({ from: TUE, to: MON });
    expect(back.status).toBe(400);
    const long = await request.post('/api/attendance-evaluation/reset').set(bearer(fx.admin, 'admin')).send({ from: '2026-01-01', to: TUE });
    expect(long.status).toBe(422);
  });

  it('drops untouched cases, keeps decided ones, and judges the days again', async () => {
    const res = await request.post(`/api/attendance-evaluation/reset?company_id=${fx.company}`)
      .set(bearer(fx.admin, 'admin')).send({ from: MON, to: TUE });
    expect(res.status).toBe(200);
    expect(res.body.cases_cleared).toBeGreaterThanOrEqual(2);   // the stale one and Monday's own
    expect(res.body.days_evaluated).toBeGreaterThan(0);

    const after = await cases();
    // The stale absence is gone and is not raised again — Tuesday has punches.
    expect(after.find((c) => c.d === TUE && c.type === 'ABSENT_NO_RECORD')).toBeUndefined();
    // The decision HR took survives untouched.
    const [[w]] = await pool.query('SELECT status, resolution FROM attendance_exceptions WHERE id = ?', [fx.waived]);
    expect(w).toMatchObject({ status: 'Waived', resolution: 'HR waived' });
    // Monday's lateness is raised afresh.
    expect(after.find((c) => c.d === MON && c.type === 'LATE_ARRIVAL')).toMatchObject({ status: 'Open' });

    const [[mon]] = await pool.query(
      'SELECT status, eval_status, eval_late_minutes FROM attendance WHERE employee_id = ? AND work_date = ?', [fx.emp, MON]);
    expect(mon).toMatchObject({ status: 'Present', eval_status: 'Late', eval_late_minutes: 60 });  // record untouched
  });

  it('never judges a day that is still in progress', async () => {
    // "Today" is Tuesday: only Monday may be evaluated.
    const r = await runEvaluation({ from: MON, to: TUE, companyId: fx.company, userId: fx.admin, today: TUE });
    expect(r.days_evaluated).toBe(1);
    const only = await runEvaluation({ from: TUE, to: TUE, companyId: fx.company, userId: fx.admin, today: TUE });
    expect(only).toMatchObject({ days_evaluated: 0, not_finished: true });
  });
});
