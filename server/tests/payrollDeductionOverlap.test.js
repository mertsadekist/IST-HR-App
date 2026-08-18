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

describe('sick leave is charged at the rate the policy sets, not a flat one', () => {
  let sickTypeId;
  let sickEmp;

  beforeAll(async () => {
    [[{ id: sickTypeId }]] = [await pool.query(
      "SELECT id FROM leave_types WHERE company_id IS NULL AND name = 'Sick Leave'").then((r) => r[0])];
    sickEmp = await mkEmployee('Sick');
    // Twenty consecutive days from 1 May: the policy's first fifteen at full pay,
    // then five at half.
    await addLeave(sickEmp, sickTypeId, '2026-05-01', '2026-05-20', 20);
  });

  it('pays the first fifteen days and halves the next five', async () => {
    // A flat is_paid flag would have deducted either nothing at all or all
    // twenty days. The right answer is two and a half.
    const item = await itemFor('2026-05', sickEmp);
    expect(Number(item.unpaid_leave_days)).toBeCloseTo(2.5, 2);
    expect(Number(item.deductions)).toBeCloseTo(2.5 * DAILY, 2);
    expect(Number(item.net)).toBeCloseTo(GROSS - 2.5 * DAILY, 2);
  });

  it('carries the year\'s counter into the next request instead of restarting', async () => {
    // Another ten days in June. Fifteen full-pay days are already gone, so all
    // ten fall in the half-pay band — five days' pay, not none.
    await addLeave(sickEmp, sickTypeId, '2026-06-01', '2026-06-10', 10);
    const item = await itemFor('2026-06', sickEmp);
    expect(Number(item.unpaid_leave_days)).toBeCloseTo(5, 2);
    expect(Number(item.deductions)).toBeCloseTo(5 * DAILY, 2);
  });

  it('charges May the same as before, unaffected by the later request', async () => {
    // The June request must not retroactively change May's payslip.
    const item = await itemFor('2026-05', sickEmp);
    expect(Number(item.unpaid_leave_days)).toBeCloseTo(2.5, 2);
  });
});

describe('annual leave is capped by length of service', () => {
  let annualTypeId;

  beforeAll(async () => {
    [[{ id: annualTypeId }]] = [await pool.query(
      "SELECT id FROM leave_types WHERE company_id IS NULL AND name = 'Annual Leave'").then((r) => r[0])];
  });

  it('pays it in full for somebody with a year behind them', async () => {
    const [r] = await pool.query('INSERT INTO employees SET ?', {
      company_id: fx.company, first_name: tag, last_name: 'Senior',
      status: 'Active', basic_salary: 1800, full_salary: GROSS, start_date: '2024-01-01',
    });
    await addLeave(r.insertId, annualTypeId, '2026-09-01', '2026-09-10', 10);
    const item = await itemFor('2026-09', r.insertId);
    expect(Number(item.deductions)).toBe(0);
  });

  it('deducts the days beyond the entitlement of somebody newer', async () => {
    // Started 10 March, so by the end of October seven months are complete —
    // fourteen days at two per month. Taking twenty puts six beyond the
    // entitlement, and days beyond it are not free.
    const [r] = await pool.query('INSERT INTO employees SET ?', {
      company_id: fx.company, first_name: tag, last_name: 'Newer',
      status: 'Active', basic_salary: 1800, full_salary: GROSS, start_date: '2026-03-10',
    });
    await addLeave(r.insertId, annualTypeId, '2026-10-01', '2026-10-20', 20);
    const item = await itemFor('2026-10', r.insertId);
    expect(Number(item.unpaid_leave_days)).toBeCloseTo(6, 2);
    expect(Number(item.deductions)).toBeCloseTo(6 * DAILY, 2);
  });

  it('does not strip the entitlement of somebody whose start date is missing', async () => {
    // Failing the other way would silently cost a long-serving employee their
    // whole annual allowance because of a blank field in their record.
    const [r] = await pool.query('INSERT INTO employees SET ?', {
      company_id: fx.company, first_name: tag, last_name: 'NoDate',
      status: 'Active', basic_salary: 1800, full_salary: GROSS,
    });
    await addLeave(r.insertId, annualTypeId, '2026-11-02', '2026-11-06', 5);
    const item = await itemFor('2026-11', r.insertId);
    expect(Number(item.deductions)).toBe(0);
  });
});

describe('emergency leave comes out of the annual balance', () => {
  it('costs nothing while annual leave remains', async () => {
    const [[emergency]] = await pool.query(
      "SELECT id FROM leave_types WHERE company_id IS NULL AND name = 'Emergency Leave'");
    const [r] = await pool.query('INSERT INTO employees SET ?', {
      company_id: fx.company, first_name: tag, last_name: 'Emerg',
      status: 'Active', basic_salary: 1800, full_salary: GROSS, start_date: '2024-01-01',
    });
    await addLeave(r.insertId, emergency.id, '2026-12-01', '2026-12-03', 3);
    const item = await itemFor('2026-12', r.insertId);
    expect(Number(item.deductions)).toBe(0);
  });

  it('becomes unpaid once the annual balance is exhausted', async () => {
    // The policy says so explicitly, and it falls out of the shared counter
    // rather than needing a rule of its own.
    const [[annual]] = await pool.query(
      "SELECT id FROM leave_types WHERE company_id IS NULL AND name = 'Annual Leave'");
    const [[emergency]] = await pool.query(
      "SELECT id FROM leave_types WHERE company_id IS NULL AND name = 'Emergency Leave'");
    const [r] = await pool.query('INSERT INTO employees SET ?', {
      company_id: fx.company, first_name: tag, last_name: 'Exhausted',
      status: 'Active', basic_salary: 1800, full_salary: GROSS, start_date: '2024-01-01',
    });
    // Thirty days of annual in January uses the whole entitlement.
    await addLeave(r.insertId, annual.id, '2026-01-01', '2026-01-30', 30);
    await addLeave(r.insertId, emergency.id, '2026-02-02', '2026-02-04', 3);
    const item = await itemFor('2026-02', r.insertId);
    expect(Number(item.unpaid_leave_days)).toBeCloseTo(3, 2);
    expect(Number(item.deductions)).toBeCloseTo(3 * DAILY, 2);
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
  }, 20000);

  it('bills a month the leave does not touch nothing at all', async () => {
    const item = await itemFor('2026-06', fx.emps.Spanning);
    expect(Number(item.unpaid_leave_days)).toBe(0);
    expect(Number(item.deductions)).toBe(0);
  });
});

describe('the salary explanation workbook', () => {
  let explainRunId;

  beforeAll(async () => {
    const res = await request.post('/api/payroll/runs/generate').set(auth(token))
      .send({ period: '2026-04', company_id: fx.company });
    expect(res.status).toBe(201);
    explainRunId = res.body.id;
  }, 30000);

  it('explains every employee, not only the ones who lost money', async () => {
    const { buildPayrollExplanation } = await import('../services/payrollExplainerService.js');
    const data = await buildPayrollExplanation(pool, explainRunId);
    expect(data.employees.length).toBeGreaterThan(0);
    // Somebody with a clean month still gets a line saying so — "why was I paid
    // this" is a fair question even when the answer is "in full".
    const clean = data.employees.find((e) => e.lines.length === 0);
    expect(clean.summary).toMatch(/Full pay/);
  });

  it('carries the arithmetic on every charged day', async () => {
    const { buildPayrollExplanation } = await import('../services/payrollExplainerService.js');
    const data = await buildPayrollExplanation(pool, explainRunId);
    const overlap = data.employees.find((e) => e.employee_id === fx.emps.Overlap);
    expect(overlap.lines.length).toBeGreaterThan(0);
    for (const l of overlap.lines) {
      expect(l.calculation).toMatch(/\/ 30 =/);
      expect(l.calculation).toMatch(/withheld =/);
      expect(l.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(l.day).toBeTruthy();
    }
  });

  it('reconciles with the figure the payslip actually stored', async () => {
    // The document would be worse than useless if it explained a number the
    // payslip does not carry, so every line is checked against the stored total.
    const { buildPayrollExplanation } = await import('../services/payrollExplainerService.js');
    const data = await buildPayrollExplanation(pool, explainRunId);
    for (const e of data.employees) {
      expect(e.matches, `${e.name}: explained ${e.recomputed_deduction} vs stored ${e.stored_deduction}`).toBe(true);
    }
  });

  it('produces a workbook with all three sheets', async () => {
    const { buildPayrollExplanation } = await import('../services/payrollExplainerService.js');
    const { renderPayrollExplanationWorkbook } = await import('../services/payrollExplainerWorkbook.js');
    const buffer = await renderPayrollExplanationWorkbook(await buildPayrollExplanation(pool, explainRunId));
    expect(buffer.length).toBeGreaterThan(5000);

    const ExcelJS = (await import('exceljs')).default;
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer);
    expect(wb.worksheets.map((w) => w.name)).toEqual(['Summary', 'Deduction detail', 'Policy']);
    // The policy sheet has to carry the tiers, or the reader cannot check the rule.
    const policy = wb.getWorksheet('Policy');
    const text = JSON.stringify(policy.getSheetValues());
    expect(text).toMatch(/Sick Leave/);
    expect(text).toMatch(/Days 16/);
  });

  it('serves it over the API on a Draft run', async () => {
    // Deliberately available before approval: that is when a wrong deduction can
    // still be fixed.
    const res = await request.get(`/api/payroll/runs/${explainRunId}/explanation?company_id=${fx.company}`)
      .set(auth(token)).buffer().parse((r, cb) => {
        const chunks = [];
        r.on('data', (c) => chunks.push(c));
        r.on('end', () => cb(null, Buffer.concat(chunks)));
      });
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/spreadsheetml/);
    expect(res.headers['content-disposition']).toMatch(/Salary-Explanation/);
    expect(res.headers['x-reconcile-mismatches']).toBe('0');
  }, 30000);

  it('refuses a run belonging to another company', async () => {
    const [other] = await pool.query('INSERT INTO companies SET ?', {
      name: `${tag}_Other`, short_code: `${tag}O`.slice(0, 10), currency: 'AED', status: 'Active',
    });
    const res = await request.get(`/api/payroll/runs/${explainRunId}/explanation?company_id=${other.insertId}`)
      .set(auth(token));
    expect(res.status).toBe(404);
    await pool.query('DELETE FROM companies WHERE id = ?', [other.insertId]);
  });
});

describe('a rest day is never an absence, however the device reported it', () => {
  // The live case: the fingerprint device emits a row for every registered ID
  // every day, including people's days off, and reports "no punches" for them.
  // The importer stored that as an absence and payroll charged a full day, so six
  // employees lost 1100 dirhams for a Saturday none of them work.
  let monFriEmp;
  let sixDayEmp;
  let monFriSchedule;

  beforeAll(async () => {
    // Mon–Fri, Saturday and Sunday off.
    const [s] = await pool.query('INSERT INTO work_schedules SET ?', {
      company_id: fx.company, name_en: `${tag} MonFri`, is_default: false,
    });
    monFriSchedule = s.insertId;
    for (let weekday = 0; weekday <= 6; weekday++) {
      const working = weekday >= 1 && weekday <= 5;
      await pool.query('INSERT INTO work_schedule_days SET ?', {
        schedule_id: monFriSchedule, weekday, is_working: working,
        start_time: working ? '10:00:00' : null, end_time: working ? '19:00:00' : null,
        break_minutes: working ? 60 : 0,
      });
    }

    monFriEmp = await mkEmployee('MonFri');
    await pool.query('INSERT INTO employee_work_schedules SET ?', {
      employee_id: monFriEmp, schedule_id: monFriSchedule, company_id: fx.company,
      effective_from: '2026-01-01',
    });
    // 2026-03-07 is a Saturday: his day off.
    await addAbsence(monFriEmp, '2026-03-07');
    // 2026-03-09 is a Monday: a real absence.
    await addAbsence(monFriEmp, '2026-03-09');

    // Somebody with no assignment at all, on a company with no default schedule
    // either — the absence must still count.
    sixDayEmp = await mkEmployee('NoSchedule');
    await addAbsence(sixDayEmp, '2026-03-07');
  }, 30000);

  it('does not charge a Saturday to somebody whose schedule ends on Friday', async () => {
    const item = await itemFor('2026-03', monFriEmp);
    expect(Number(item.absence_days)).toBe(1);          // the Monday only
    expect(Number(item.deductions)).toBe(DAILY);
    expect(Number(item.deductions)).not.toBe(2 * DAILY);
  });

  it('still charges the working day either side of it', async () => {
    const { buildPayrollExplanation } = await import('../services/payrollExplainerService.js');
    const [[run]] = await pool.query(
      "SELECT id FROM payroll_runs WHERE company_id = ? AND period = '2026-03'", [fx.company]);
    const data = await buildPayrollExplanation(pool, run.id);
    const e = data.employees.find((x) => x.employee_id === monFriEmp);
    expect(e.lines.map((l) => l.date)).toEqual(['2026-03-09']);
  });

  it('still charges an absence when no schedule resolves at all', async () => {
    // Failing the other way would quietly stop deducting for anyone whose
    // schedule was never set up. No schedule is not evidence of a rest day.
    const item = await itemFor('2026-03', sixDayEmp);
    expect(Number(item.absence_days)).toBe(1);
    expect(Number(item.deductions)).toBe(DAILY);
  });

  it('keeps the explanation reconciled with the payslip', async () => {
    const { buildPayrollExplanation } = await import('../services/payrollExplainerService.js');
    const [[run]] = await pool.query(
      "SELECT id FROM payroll_runs WHERE company_id = ? AND period = '2026-03'", [fx.company]);
    const data = await buildPayrollExplanation(pool, run.id);
    for (const e of data.employees) {
      expect(e.matches, `${e.name}: explained ${e.recomputed_deduction} vs stored ${e.stored_deduction}`).toBe(true);
    }
  });
});
