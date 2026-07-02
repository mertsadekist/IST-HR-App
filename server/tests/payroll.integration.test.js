/**
 * Payroll module integration tests (F-03): generate (with unpaid-leave + absence
 * deductions), approve, mark-paid, payslips, lifecycle guards, tenant isolation.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import supertest from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../app.js';
import pool from '../config/db.js';

const request = supertest(app);
const tag = `PR${Date.now().toString().slice(-5)}`;
const period = '2026-04';
const f = { ids: {} };
const tokenFor = (u) => jwt.sign({ id: u.id, name: u.name, role: u.role, company_id: u.company_id }, process.env.JWT_SECRET, { expiresIn: '1h' });
const auth = (t) => ({ Authorization: `Bearer ${t}` });
let tokAdminA, tokEmpA, tokHrB, unpaidTypeId;

beforeAll(async () => {
  const [a] = await pool.query('INSERT INTO companies SET ?', { name: `${tag}_A`, short_code: `${tag}A`.slice(0, 10), currency: 'AED', status: 'Active' });
  const [b] = await pool.query('INSERT INTO companies SET ?', { name: `${tag}_B`, short_code: `${tag}B`.slice(0, 10), currency: 'AED', status: 'Active' });
  f.companyA = a.insertId; f.companyB = b.insertId;

  // Employee A: basic 6000, full 10000 → daily 10000/30 = 333.33 (gross-based)
  const [empA] = await pool.query('INSERT INTO employees SET ?', { first_name: tag, last_name: 'EmpA', company_id: f.companyA, status: 'Active', basic_salary: 6000, full_salary: 10000 });
  f.ids.empA = empA.insertId;

  const [uAdminA] = await pool.query('INSERT INTO users SET ?', { username: `${tag}_admA`, password_hash: 'x', name: 'Adm A', role: 'admin', company_id: f.companyA, is_active: 1 });
  const [uEmpA] = await pool.query('INSERT INTO users SET ?', { username: `${tag}_empA`, password_hash: 'x', name: 'Emp A', role: 'employee', company_id: f.companyA, is_active: 1, employee_id: f.ids.empA });
  const [uHrB] = await pool.query('INSERT INTO users SET ?', { username: `${tag}_hrB`, password_hash: 'x', name: 'HR B', role: 'hr_manager', company_id: f.companyB, is_active: 1 });
  f.ids.uAdminA = uAdminA.insertId; f.ids.uEmpA = uEmpA.insertId; f.ids.uHrB = uHrB.insertId;
  tokAdminA = tokenFor({ id: uAdminA.insertId, name: 'Adm A', role: 'admin', company_id: f.companyA });
  tokEmpA = tokenFor({ id: uEmpA.insertId, name: 'Emp A', role: 'employee', company_id: f.companyA });
  tokHrB = tokenFor({ id: uHrB.insertId, name: 'HR B', role: 'hr_manager', company_id: f.companyB });

  const [[unpaid]] = await pool.query("SELECT id FROM leave_types WHERE company_id IS NULL AND name = 'Unpaid Leave' LIMIT 1");
  unpaidTypeId = unpaid.id;

  // 2 approved unpaid-leave days in the period (deduction 2 * (10000/30) = 666.67)
  await pool.query('INSERT INTO leave_requests SET ?', {
    company_id: f.companyA, employee_id: f.ids.empA, leave_type_id: unpaidTypeId,
    start_date: `${period}-10`, end_date: `${period}-11`, days: 2, status: 'Approved',
  });
  // 1 absence day in the period (deduction 1 * (10000/30) = 333.33)
  await pool.query('INSERT INTO attendance SET ?', {
    company_id: f.companyA, employee_id: f.ids.empA, work_date: `${period}-15`, status: 'Absent',
  });
}, 30000);

afterAll(async () => {
  try {
    await pool.query('DELETE FROM payroll_items WHERE company_id IN (?, ?)', [f.companyA, f.companyB]);
    await pool.query('DELETE FROM payroll_runs WHERE company_id IN (?, ?)', [f.companyA, f.companyB]);
    await pool.query('DELETE FROM leave_requests WHERE company_id IN (?, ?)', [f.companyA, f.companyB]);
    await pool.query('DELETE FROM attendance WHERE company_id IN (?, ?)', [f.companyA, f.companyB]);
    await pool.query('DELETE FROM users WHERE id IN (?, ?, ?)', [f.ids.uAdminA, f.ids.uEmpA, f.ids.uHrB]);
    await pool.query('DELETE FROM employees WHERE id = ?', [f.ids.empA]);
    await pool.query('DELETE FROM audit_logs WHERE company_id IN (?, ?)', [f.companyA, f.companyB]);
    await pool.query('DELETE FROM companies WHERE id IN (?, ?)', [f.companyA, f.companyB]);
  } finally { await pool.end(); }
}, 30000);

describe('Payroll lifecycle', () => {
  it('generates a run with unpaid-leave + absence deductions', async () => {
    const res = await request.post('/api/payroll/runs/generate').set(auth(tokAdminA)).send({ period });
    expect(res.status).toBe(201);
    f.ids.runId = res.body.id;
    expect(res.body.employee_count).toBeGreaterThanOrEqual(1);
    // gross 10000; deductions = (2 unpaid + 1 absence) * (10000/30) = 1000; net 9000
    expect(Number(res.body.total_gross)).toBe(10000);
    expect(Number(res.body.total_deductions)).toBe(1000);
    expect(Number(res.body.total_net)).toBe(9000);
  });

  it('run detail lists the employee item with correct net', async () => {
    const res = await request.get(`/api/payroll/runs/${f.ids.runId}`).set(auth(tokAdminA));
    expect(res.status).toBe(200);
    const item = res.body.items.find((i) => i.employee_id === f.ids.empA);
    expect(Number(item.net)).toBe(9000);
    expect(Number(item.unpaid_leave_days)).toBe(2);
    expect(Number(item.absence_days)).toBe(1);
  });

  it('employee cannot see payslip before approval', async () => {
    const res = await request.get(`/api/payroll/payslips/my?period=${period}`).set(auth(tokEmpA));
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(0);
  });

  it('approve then mark-paid; payslip becomes visible to the employee', async () => {
    const appr = await request.put(`/api/payroll/runs/${f.ids.runId}/approve`).set(auth(tokAdminA)).send({});
    expect(appr.status).toBe(200);
    const paid = await request.put(`/api/payroll/runs/${f.ids.runId}/mark-paid`).set(auth(tokAdminA)).send({});
    expect(paid.status).toBe(200);

    const slip = await request.get(`/api/payroll/payslips/my?period=${period}`).set(auth(tokEmpA));
    expect(slip.status).toBe(200);
    expect(slip.body.length).toBe(1);
    expect(Number(slip.body[0].net)).toBe(9400);
  });

  it('cannot mark-paid twice / cannot delete a paid run', async () => {
    const paidAgain = await request.put(`/api/payroll/runs/${f.ids.runId}/mark-paid`).set(auth(tokAdminA)).send({});
    expect(paidAgain.status).toBe(409);
    const del = await request.delete(`/api/payroll/runs/${f.ids.runId}`).set(auth(tokAdminA));
    expect(del.status).toBe(409);
  });
});

describe('Authorization & isolation', () => {
  it('employee cannot generate payroll (403)', async () => {
    const res = await request.post('/api/payroll/runs/generate').set(auth(tokEmpA)).send({ period: '2026-05' });
    expect(res.status).toBe(403);
  });

  it('HR scoped to company B cannot see a company A run (404)', async () => {
    // Single-org model: the selected entity narrows the run lookup.
    const res = await request.get(`/api/payroll/runs/${f.ids.runId}?company_id=${f.companyB}`).set(auth(tokHrB));
    expect(res.status).toBe(404);
  });

  it('rejects malformed period (422)', async () => {
    const res = await request.post('/api/payroll/runs/generate').set(auth(tokAdminA)).send({ period: 'April' });
    expect(res.status).toBe(422);
  });
});
