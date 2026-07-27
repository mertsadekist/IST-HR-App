/**
 * Leave Management module tests (F-02): lifecycle, balance debit/credit,
 * insufficient-balance block, employee self-service scoping, tenant isolation.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import supertest from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../app.js';
import pool from '../config/db.js';

const request = supertest(app);
const tag = `LV${Date.now().toString().slice(-5)}`;
const f = { ids: {} };

const tokenFor = (u) => jwt.sign({ id: u.id, name: u.name, role: u.role, company_id: u.company_id }, process.env.JWT_SECRET, { expiresIn: '1h' });
const auth = (t) => ({ Authorization: `Bearer ${t}` });
let tokHrA, tokEmpA, tokHrB, annualTypeId;

// A decision now has to be documented: the written request must be on file and
// the deciding manager named. Helper attaches a stand-in scan of the request.
const PROOF_PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const attachRequestProof = (requestId, token) => request
  .post(`/api/leave/requests/${requestId}/files`).set(auth(token))
  .field('kind', 'request_proof')
  .attach('file', PROOF_PNG, { filename: 'request.png', contentType: 'image/png' });
const DECISION = { approver_name: 'Line Manager' };

beforeAll(async () => {
  const [a] = await pool.query('INSERT INTO companies SET ?', { name: `${tag}_A`, short_code: `${tag}A`.slice(0, 10), currency: 'AED', status: 'Active' });
  const [b] = await pool.query('INSERT INTO companies SET ?', { name: `${tag}_B`, short_code: `${tag}B`.slice(0, 10), currency: 'AED', status: 'Active' });
  f.companyA = a.insertId; f.companyB = b.insertId;

  const [empA] = await pool.query('INSERT INTO employees SET ?', { first_name: tag, last_name: 'EmpA', company_id: f.companyA, status: 'Active' });
  f.ids.empA = empA.insertId;

  const [uHrA] = await pool.query('INSERT INTO users SET ?', { username: `${tag}_hrA`, password_hash: 'x', name: 'HR A', role: 'hr_manager', company_id: f.companyA, is_active: 1 });
  const [uEmpA] = await pool.query('INSERT INTO users SET ?', { username: `${tag}_empA`, password_hash: 'x', name: 'Emp A', role: 'employee', company_id: f.companyA, is_active: 1, employee_id: f.ids.empA });
  const [uHrB] = await pool.query('INSERT INTO users SET ?', { username: `${tag}_hrB`, password_hash: 'x', name: 'HR B', role: 'hr_manager', company_id: f.companyB, is_active: 1 });
  f.ids.uHrA = uHrA.insertId; f.ids.uEmpA = uEmpA.insertId; f.ids.uHrB = uHrB.insertId;

  tokHrA = tokenFor({ id: uHrA.insertId, name: 'HR A', role: 'hr_manager', company_id: f.companyA });
  tokEmpA = tokenFor({ id: uEmpA.insertId, name: 'Emp A', role: 'employee', company_id: f.companyA });
  tokHrB = tokenFor({ id: uHrB.insertId, name: 'HR B', role: 'hr_manager', company_id: f.companyB });

  // Use the global "Annual Leave" type
  const [[annual]] = await pool.query("SELECT id FROM leave_types WHERE company_id IS NULL AND name = 'Annual Leave' LIMIT 1");
  annualTypeId = annual.id;
}, 30000);

afterAll(async () => {
  try {
    await pool.query('DELETE FROM leave_requests WHERE company_id IN (?, ?)', [f.companyA, f.companyB]);
    await pool.query('DELETE FROM leave_balances WHERE company_id IN (?, ?)', [f.companyA, f.companyB]);
    await pool.query('DELETE FROM users WHERE id IN (?, ?, ?)', [f.ids.uHrA, f.ids.uEmpA, f.ids.uHrB]);
    await pool.query('DELETE FROM employees WHERE id = ?', [f.ids.empA]);
    await pool.query('DELETE FROM audit_logs WHERE company_id IN (?, ?)', [f.companyA, f.companyB]);
    await pool.query('DELETE FROM companies WHERE id IN (?, ?)', [f.companyA, f.companyB]);
  } finally { await pool.end(); }
}, 30000);

describe('Leave types', () => {
  it('global types are visible to a scoped user', async () => {
    const res = await request.get('/api/leave/types').set(auth(tokHrA));
    expect(res.status).toBe(200);
    expect(res.body.some((t) => t.name === 'Annual Leave')).toBe(true);
  });
});

describe('Leave lifecycle + balance', () => {
  it('HR sets entitlement, employee requests, HR approves → balance debited', async () => {
    // Entitlement: 10 days annual for 2026
    const setBal = await request.post('/api/leave/balances').set(auth(tokHrA))
      .send({ employee_id: f.ids.empA, leave_type_id: annualTypeId, year: 2026, entitled: 10 });
    expect(setBal.status).toBe(201);

    // Employee requests 3 days (2026-03-02 .. 2026-03-04 inclusive = 3)
    const reqRes = await request.post('/api/leave/requests').set(auth(tokEmpA))
      .send({ leave_type_id: annualTypeId, start_date: '2026-03-02', end_date: '2026-03-04', reason: 'trip' });
    expect(reqRes.status).toBe(201);
    expect(reqRes.body.days).toBe(3);
    f.ids.req1 = reqRes.body.id;

    // A decision requires the written request on file + the deciding manager named
    const noProof = await request.put(`/api/leave/requests/${f.ids.req1}/approve`).set(auth(tokHrA)).send(DECISION);
    expect(noProof.status).toBe(422);
    expect((await attachRequestProof(f.ids.req1, tokHrA)).status).toBe(201);
    const noName = await request.put(`/api/leave/requests/${f.ids.req1}/approve`).set(auth(tokHrA)).send({});
    expect(noName.status).toBe(422);

    // HR approves
    const appr = await request.put(`/api/leave/requests/${f.ids.req1}/approve`).set(auth(tokHrA)).send(DECISION);
    expect(appr.status).toBe(200);

    // Balance now shows used 3, remaining 7
    const bals = await request.get(`/api/leave/balances?employee_id=${f.ids.empA}&year=2026`).set(auth(tokHrA));
    const annual = bals.body.find((b) => b.leave_type_id === annualTypeId);
    expect(Number(annual.used)).toBe(3);
    expect(Number(annual.remaining)).toBe(7);
  });

  it('blocks approval when paid balance is insufficient', async () => {
    // Request 20 days (more than remaining 7)
    const reqRes = await request.post('/api/leave/requests').set(auth(tokEmpA))
      .send({ leave_type_id: annualTypeId, start_date: '2026-06-01', end_date: '2026-06-20' });
    expect(reqRes.status).toBe(201);
    f.ids.req2 = reqRes.body.id;
    await attachRequestProof(f.ids.req2, tokHrA);
    const appr = await request.put(`/api/leave/requests/${f.ids.req2}/approve`).set(auth(tokHrA)).send(DECISION);
    expect(appr.status).toBe(400);
    expect(appr.body.error).toMatch(/insufficient/i);
  });

  it('cancelling an approved request credits the balance back', async () => {
    const cancel = await request.put(`/api/leave/requests/${f.ids.req1}/cancel`).set(auth(tokEmpA)).send({});
    expect(cancel.status).toBe(200);
    const bals = await request.get(`/api/leave/balances?employee_id=${f.ids.empA}&year=2026`).set(auth(tokHrA));
    const annual = bals.body.find((b) => b.leave_type_id === annualTypeId);
    expect(Number(annual.used)).toBe(0);
  });
});

describe('Self-service scoping & isolation', () => {
  it('employee only sees their own requests', async () => {
    const res = await request.get('/api/leave/requests').set(auth(tokEmpA));
    expect(res.status).toBe(200);
    expect(res.body.every((r) => r.employee_id === f.ids.empA)).toBe(true);
  });

  it('employee cannot approve requests', async () => {
    const res = await request.put(`/api/leave/requests/${f.ids.req2}/approve`).set(auth(tokEmpA)).send({});
    expect(res.status).toBe(403);
  });

  it('HR scoped to company B cannot approve a company A request (404)', async () => {
    // Single-org model: the selected entity narrows the request lookup.
    const res = await request.put(`/api/leave/requests/${f.ids.req2}/approve?company_id=${f.companyB}`).set(auth(tokHrB)).send({});
    expect(res.status).toBe(404);
  });

  it('rejects end_date before start_date with 422', async () => {
    const res = await request.post('/api/leave/requests').set(auth(tokEmpA))
      .send({ leave_type_id: annualTypeId, start_date: '2026-05-10', end_date: '2026-05-01' });
    expect(res.status).toBe(422);
  });
});
