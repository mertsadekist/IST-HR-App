/**
 * Attendance module tests (F-01): self-service check-in/out, HR recording,
 * monthly summary, tenant isolation, validation.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import supertest from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../app.js';
import pool from '../config/db.js';

const request = supertest(app);
const tag = `AT${Date.now().toString().slice(-5)}`;
const f = { ids: {} };
const tokenFor = (u) => jwt.sign({ id: u.id, name: u.name, role: u.role, company_id: u.company_id }, process.env.JWT_SECRET, { expiresIn: '1h' });
const auth = (t) => ({ Authorization: `Bearer ${t}` });
let tokHrA, tokEmpA, tokHrB;
const month = new Date().toISOString().slice(0, 7);

beforeAll(async () => {
  const [a] = await pool.query('INSERT INTO companies SET ?', { name: `${tag}_A`, short_code: `${tag}A`.slice(0, 10), currency: 'AED', status: 'Active' });
  const [b] = await pool.query('INSERT INTO companies SET ?', { name: `${tag}_B`, short_code: `${tag}B`.slice(0, 10), currency: 'AED', status: 'Active' });
  f.companyA = a.insertId; f.companyB = b.insertId;
  const [empA] = await pool.query('INSERT INTO employees SET ?', { first_name: tag, last_name: 'EmpA', company_id: f.companyA, status: 'Active' });
  const [empB] = await pool.query('INSERT INTO employees SET ?', { first_name: tag, last_name: 'EmpB', company_id: f.companyB, status: 'Active' });
  f.ids.empA = empA.insertId; f.ids.empB = empB.insertId;

  const [uHrA] = await pool.query('INSERT INTO users SET ?', { username: `${tag}_hrA`, password_hash: 'x', name: 'HR A', role: 'hr_manager', company_id: f.companyA, is_active: 1 });
  const [uEmpA] = await pool.query('INSERT INTO users SET ?', { username: `${tag}_empA`, password_hash: 'x', name: 'Emp A', role: 'employee', company_id: f.companyA, is_active: 1, employee_id: f.ids.empA });
  const [uHrB] = await pool.query('INSERT INTO users SET ?', { username: `${tag}_hrB`, password_hash: 'x', name: 'HR B', role: 'hr_manager', company_id: f.companyB, is_active: 1 });
  f.ids.uHrA = uHrA.insertId; f.ids.uEmpA = uEmpA.insertId; f.ids.uHrB = uHrB.insertId;
  tokHrA = tokenFor({ id: uHrA.insertId, name: 'HR A', role: 'hr_manager', company_id: f.companyA });
  tokEmpA = tokenFor({ id: uEmpA.insertId, name: 'Emp A', role: 'employee', company_id: f.companyA });
  tokHrB = tokenFor({ id: uHrB.insertId, name: 'HR B', role: 'hr_manager', company_id: f.companyB });
}, 30000);

afterAll(async () => {
  try {
    await pool.query('DELETE FROM attendance WHERE company_id IN (?, ?)', [f.companyA, f.companyB]);
    await pool.query('DELETE FROM users WHERE id IN (?, ?, ?)', [f.ids.uHrA, f.ids.uEmpA, f.ids.uHrB]);
    await pool.query('DELETE FROM employees WHERE id IN (?, ?)', [f.ids.empA, f.ids.empB]);
    await pool.query('DELETE FROM audit_logs WHERE company_id IN (?, ?)', [f.companyA, f.companyB]);
    await pool.query('DELETE FROM companies WHERE id IN (?, ?)', [f.companyA, f.companyB]);
  } finally { await pool.end(); }
}, 30000);

describe('Self-service check-in/out', () => {
  it('employee can check in, double check-in blocked, then check out', async () => {
    const ci = await request.post('/api/attendance/check-in').set(auth(tokEmpA)).send({});
    expect(ci.status).toBe(200);
    expect(['Present', 'Late']).toContain(ci.body.status);

    const dup = await request.post('/api/attendance/check-in').set(auth(tokEmpA)).send({});
    expect(dup.status).toBe(409);

    const co = await request.post('/api/attendance/check-out').set(auth(tokEmpA)).send({});
    expect(co.status).toBe(200);
    expect(typeof co.body.work_hours).toBe('number');
  });

  it('check-out without check-in fails for an employee with no record', async () => {
    // HR has no employee profile → check-in returns 400
    const res = await request.post('/api/attendance/check-out').set(auth(tokHrA)).send({});
    expect([400]).toContain(res.status);
  });
});

describe('HR recording + summary', () => {
  it('HR records attendance with hours; summary reflects it', async () => {
    const rec = await request.post('/api/attendance').set(auth(tokHrA)).send({
      employee_id: f.ids.empA, work_date: `${month}-05`,
      check_in: `${month}-05 09:00:00`, check_out: `${month}-05 17:00:00`, status: 'Present',
    });
    expect(rec.status).toBe(201);

    const sum = await request.get(`/api/attendance/summary?employee_id=${f.ids.empA}&month=${month}`).set(auth(tokHrA));
    expect(sum.status).toBe(200);
    expect(sum.body.total_hours).toBeGreaterThanOrEqual(8);
  });

  it('rejects check_out before check_in (422)', async () => {
    const res = await request.post('/api/attendance').set(auth(tokHrA)).send({
      employee_id: f.ids.empA, work_date: `${month}-06`,
      check_in: `${month}-06 17:00:00`, check_out: `${month}-06 09:00:00`,
    });
    expect(res.status).toBe(422);
  });

  it('rejects invalid status (422)', async () => {
    const res = await request.post('/api/attendance').set(auth(tokHrA)).send({
      employee_id: f.ids.empA, work_date: `${month}-07`, status: 'Teleporting',
    });
    expect(res.status).toBe(422);
  });
});

describe('Entity scoping', () => {
  it('HR scoped to company B cannot record attendance for a company A employee (404)', async () => {
    // Single-org model: the selected entity (body company_id) narrows the
    // employee lookup, so a company-A employee is out of scope for entity B.
    const res = await request.post('/api/attendance').set(auth(tokHrB)).send({
      employee_id: f.ids.empA, company_id: f.companyB, work_date: `${month}-08`, status: 'Present',
    });
    expect(res.status).toBe(404);
  });

  it('employee list shows only own attendance', async () => {
    const res = await request.get('/api/attendance').set(auth(tokEmpA));
    expect(res.status).toBe(200);
    expect(res.body.every((r) => r.employee_id === f.ids.empA)).toBe(true);
  });

  it('employee cannot record attendance via HR endpoint (403)', async () => {
    const res = await request.post('/api/attendance').set(auth(tokEmpA)).send({
      employee_id: f.ids.empA, work_date: `${month}-09`, status: 'Present',
    });
    expect(res.status).toBe(403);
  });
});
