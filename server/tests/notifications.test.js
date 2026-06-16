/**
 * Notifications module tests (F-08): personal scoping (a user only sees their own),
 * unread count, mark-read/read-all, and a producer firing (leave approval notifies
 * the requesting employee's user).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import supertest from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../app.js';
import pool from '../config/db.js';

const request = supertest(app);
const tag = `NT${Date.now().toString().slice(-5)}`;
const f = { ids: {} };
const tokenFor = (u) => jwt.sign({ id: u.id, name: u.name, role: u.role, company_id: u.company_id }, process.env.JWT_SECRET, { expiresIn: '1h' });
const auth = (t) => ({ Authorization: `Bearer ${t}` });
let tokHrA, tokEmpA;
let annualTypeId;

beforeAll(async () => {
  const [a] = await pool.query('INSERT INTO companies SET ?', { name: `${tag}_A`, short_code: `${tag}A`.slice(0, 10), currency: 'AED', status: 'Active' });
  f.companyA = a.insertId;
  const [emp] = await pool.query('INSERT INTO employees SET ?', { first_name: tag, last_name: 'Emp', company_id: f.companyA, status: 'Active' });
  f.ids.emp = emp.insertId;
  const [uHr] = await pool.query('INSERT INTO users SET ?', { username: `${tag}_hr`, password_hash: 'x', name: 'HR', role: 'hr_manager', company_id: f.companyA, is_active: 1 });
  const [uEmp] = await pool.query('INSERT INTO users SET ?', { username: `${tag}_emp`, password_hash: 'x', name: 'Emp U', role: 'employee', company_id: f.companyA, is_active: 1, employee_id: f.ids.emp });
  f.ids.uHr = uHr.insertId; f.ids.uEmp = uEmp.insertId;
  tokHrA = tokenFor({ id: uHr.insertId, name: 'HR', role: 'hr_manager', company_id: f.companyA });
  tokEmpA = tokenFor({ id: uEmp.insertId, name: 'Emp U', role: 'employee', company_id: f.companyA });
  const [[annual]] = await pool.query("SELECT id FROM leave_types WHERE company_id IS NULL AND name='Annual Leave' LIMIT 1");
  annualTypeId = annual.id;
}, 30000);

afterAll(async () => {
  try {
    await pool.query('DELETE FROM notifications WHERE company_id = ?', [f.companyA]);
    await pool.query('DELETE FROM leave_requests WHERE company_id = ?', [f.companyA]);
    await pool.query('DELETE FROM leave_balances WHERE company_id = ?', [f.companyA]);
    await pool.query('DELETE FROM users WHERE id IN (?, ?)', [f.ids.uHr, f.ids.uEmp]);
    await pool.query('DELETE FROM employees WHERE id = ?', [f.ids.emp]);
    await pool.query('DELETE FROM audit_logs WHERE company_id = ?', [f.companyA]);
    await pool.query('DELETE FROM companies WHERE id = ?', [f.companyA]);
  } finally { await pool.end(); }
}, 30000);

describe('Notifications — personal scoping & lifecycle', () => {
  it('a leave request notifies HR; HR sees it, the employee does not', async () => {
    // Employee files a leave request → HR managers get notified
    const req1 = await request.post('/api/leave/requests').set(auth(tokEmpA))
      .send({ leave_type_id: annualTypeId, start_date: '2026-09-01', end_date: '2026-09-02' });
    expect(req1.status).toBe(201);

    const hrCount = await request.get('/api/notifications/unread-count').set(auth(tokHrA));
    expect(hrCount.body.count).toBeGreaterThanOrEqual(1);

    const hrList = await request.get('/api/notifications').set(auth(tokHrA));
    expect(hrList.body.some((n) => n.title === 'New leave request')).toBe(true);

    // The employee should not see HR's notification
    const empList = await request.get('/api/notifications').set(auth(tokEmpA));
    expect(empList.body.some((n) => n.title === 'New leave request')).toBe(false);
  });

  it('approval notifies the requesting employee', async () => {
    // set entitlement + create + approve
    await request.post('/api/leave/balances').set(auth(tokHrA)).send({ employee_id: f.ids.emp, leave_type_id: annualTypeId, year: 2026, entitled: 20 });
    const lr = await request.post('/api/leave/requests').set(auth(tokEmpA)).send({ leave_type_id: annualTypeId, start_date: '2026-10-01', end_date: '2026-10-02' });
    await request.put(`/api/leave/requests/${lr.body.id}/approve`).set(auth(tokHrA)).send({});

    const empList = await request.get('/api/notifications').set(auth(tokEmpA));
    expect(empList.body.some((n) => n.title === 'Leave approved')).toBe(true);
  });

  it('mark one read and read-all', async () => {
    const list = await request.get('/api/notifications?unread=1').set(auth(tokHrA));
    expect(list.body.length).toBeGreaterThan(0);
    const one = list.body[0];
    const r = await request.put(`/api/notifications/${one.id}/read`).set(auth(tokHrA));
    expect(r.status).toBe(200);

    await request.put('/api/notifications/read-all').set(auth(tokHrA));
    const after = await request.get('/api/notifications/unread-count').set(auth(tokHrA));
    expect(after.body.count).toBe(0);
  });

  it('cannot mark another user notification read (404)', async () => {
    // create a notification directly for HR, try to read it as employee
    const [n] = await pool.query('INSERT INTO notifications SET ?', { user_id: f.ids.uHr, company_id: f.companyA, type: 'info', title: 'HR only' });
    const res = await request.put(`/api/notifications/${n.insertId}/read`).set(auth(tokEmpA));
    expect(res.status).toBe(404);
  });
});
