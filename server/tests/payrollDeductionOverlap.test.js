/**
 * Payroll deductions where leave and absence describe the same day.
 *
 * The two figures used to be computed independently — unpaid-leave days from
 * `leave_requests`, absence days from `attendance` — and neither excluded the
 * other. A day that was both cost the employee twice.
 *
 * It surfaced for real: an employee had not punched since 24 July, so every
 * working day since carried an 'Absent' row, and HR was about to record unpaid
 * leave over exactly that period. At a gross of 3000 the daily rate is 100, so
 * every doubled day was 100 dirhams taken twice.
 *
 * Each employee here isolates one case, because a single fixture mixing them
 * would not say which rule failed.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import supertest from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../app.js';
import pool from '../config/db.js';

const request = supertest(app);
const tag = `PD${Date.now().toString().slice(-6)}`;
const auth = (t) => ({ Authorization: `Bearer ${t}` });

const fx = { company: null, user: null, emps: {} };
let token;
let unpaidTypeId;
let paidTypeId;

/** Gross 3000 → daily rate 3000/30 = 100, so every day of deduction is a round number. */
const GROSS = 3000;
const DAILY = 100;

async function mkEmployee(name) {
  const [r] = await pool.query('INSERT INTO employees SET ?', {
    company_id: fx.company, first_name: tag, last_name: name,
    status: 'Active', basic_salary: 1800, full_salary: GROSS,
  });
  fx.emps[name] = r.insertId;
  return r.insertId;
}
const addLeave = (empId, typeId, from, to, days) => pool.query('INSERT INTO leave_requests SET ?', {
  company_id: fx.company, employee_id: empId, leave_type_id: typeId,
  start_date: from, end_date: to, days, status: 'Approved',
});
const addAbsence = (empId, date) => pool.query('INSERT INTO attendance SET ?', {
  company_id: fx.company, employee_id: empId, work_date: date, status: 'Absent',
});

/** The line payroll produced for one employee. */
async function itemFor(period, empId) {
  const res = await request.post('/api/payroll/runs/generate').set(auth(token))
    .send({ period, company_id: fx.company });
  expect(res.status).toBe(201);
  const [[item]] = await pool.query(
    `SELECT pi.unpaid_leave_days, pi.absence_days, pi.deductions, pi.net
       FROM payroll_items pi JOIN payroll_runs pr ON pr.id = pi.run_id
      WHERE pr.company_id = ? AND pr.period = ? AND pi.employee_id = ?`,
    [fx.company, period, empId]);
  return item;
}

beforeAll(async () => {
  const [c] = await pool.query('INSERT INTO companies SET ?', {
    name: `${tag}_Co`, short_code: tag.slice(0, 10), currency: 'AED', status: 'Active',
  });
  fx.company = c.insertId;

  const [u] = await pool.query('INSERT INTO users SET ?', {
    username: `${tag}_adm`, password_hash: 'x', name: `${tag} Adm`,
    role: 'admin', company_id: fx.company, is_active: 1,
  });
  fx.user = u.insertId;
  token = jwt.sign({ id: u.insertId, name: `${tag} Adm`, role: 'admin', company_id: fx.company },
    process.env.JWT_SECRET, { expiresIn: '1h' });

  [[{ id: unpaidTypeId }]] = [await pool.query(
    "SELECT id FROM leave_types WHERE company_id IS NULL AND is_paid = 0 LIMIT 1").then((r) => r[0])];
  [[{ id: paidTypeId }]] = [await pool.query(
    "SELECT id FROM leave_types WHERE company_id IS NULL AND is_paid = 1 LIMIT 1").then((r) => r[0])];

  // Overlap: three days of unpaid leave, with an Absent row inside it and
  // another outside it.
  const overlap = await mkEmployee('Overlap');
  await addLeave(overlap, unpaidTypeId, '2026-04-10', '2026-04-12', 3);
  await addAbsence(overlap, '2026-04-11');  // inside the leave
  await addAbsence(overlap, '2026-04-20');  // a genuine absence

  // Paid leave with an Absent row on the same day — must cost nothing.
  const paid = await mkEmployee('PaidLeave');
  await addLeave(paid, paidTypeId, '2026-04-05', '2026-04-05', 1);
  await addAbsence(paid, '2026-04-05');

  // Absence with no leave anywhere near it — must still deduct.
  const plain = await mkEmployee('Plain');
  await addAbsence(plain, '2026-04-08');

  // A leave crossing a month boundary: 25 July through 31 August, 38 days.
  const spanning = await mkEmployee('Spanning');
  await addLeave(spanning, unpaidTypeId, '2026-07-25', '2026-08-31', 38);
}, 30000);

afterAll(async () => {
  try {
    if (fx.company) {
      await pool.query('DELETE FROM payroll_items WHERE company_id = ?', [fx.company]);
      await pool.query('DELETE FROM payroll_runs WHERE company_id = ?', [fx.company]);
      await pool.query('DELETE FROM leave_requests WHERE company_id = ?', [fx.company]);
      await pool.query('DELETE FROM attendance WHERE company_id = ?', [fx.company]);
      await pool.query('DELETE FROM audit_logs WHERE company_id = ?', [fx.company]);
      await pool.query('DELETE FROM employees WHERE company_id = ?', [fx.company]);
      await pool.query('DELETE FROM users WHERE id = ?', [fx.user]);
      await pool.query('DELETE FROM companies WHERE id = ?', [fx.company]);
    }
  } finally { /* pool is shared with the other suites */ }
});

describe('a day cannot be deducted twice', () => {
  it('counts an absence inside approved unpaid leave once, as leave', async () => {
    const item = await itemFor('2026-04', fx.emps.Overlap);
    expect(Number(item.unpaid_leave_days)).toBe(3);
    // 11 April is inside the leave; only 20 April is a real absence.
    expect(Number(item.absence_days)).toBe(1);
    expect(Number(item.deductions)).toBe(4 * DAILY);
    // Before the fix this was 5 days — the 11th paid for twice.
    expect(Number(item.deductions)).not.toBe(5 * DAILY);
  });

  it('deducts nothing for a paid-leave day that also carries an Absent row', async () => {
    const item = await itemFor('2026-04', fx.emps.PaidLeave);
    expect(Number(item.unpaid_leave_days)).toBe(0);
    expect(Number(item.absence_days)).toBe(0);
    expect(Number(item.deductions)).toBe(0);
    expect(Number(item.net)).toBe(GROSS);
  });

  it('still deducts an absence that no leave explains', async () => {
    // The exclusion must not become a blanket amnesty.
    const item = await itemFor('2026-04', fx.emps.Plain);
    expect(Number(item.absence_days)).toBe(1);
    expect(Number(item.deductions)).toBe(DAILY);
  });
});

describe('leave crossing a month boundary', () => {
  it('bills July only for the days that fall in July', async () => {
    // 25–31 July inclusive is seven days. The old query keyed on the start
    // month and billed July all 38.
    const item = await itemFor('2026-07', fx.emps.Spanning);
    expect(Number(item.unpaid_leave_days)).toBe(7);
    expect(Number(item.deductions)).toBe(7 * DAILY);
  });

  it('bills August for its own days instead of nothing', async () => {
    const item = await itemFor('2026-08', fx.emps.Spanning);
    expect(Number(item.unpaid_leave_days)).toBe(31);
    expect(Number(item.deductions)).toBe(31 * DAILY);
  });

  it('adds up to the length of the leave, no more and no less', async () => {
    const july = await itemFor('2026-07', fx.emps.Spanning);
    const august = await itemFor('2026-08', fx.emps.Spanning);
    expect(Number(july.unpaid_leave_days) + Number(august.unpaid_leave_days)).toBe(38);
  });

  it('bills a month the leave does not touch nothing at all', async () => {
    const item = await itemFor('2026-06', fx.emps.Spanning);
    expect(Number(item.unpaid_leave_days)).toBe(0);
    expect(Number(item.deductions)).toBe(0);
  });
});
