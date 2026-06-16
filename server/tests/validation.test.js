/**
 * Validation + duplicate-guard regression tests (Phase 2: API-001 / DB-004 / SEC-018).
 * Uses the platform admin (seeded) token. Creates and cleans up a couple of rows.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import supertest from 'supertest';
import app from '../app.js';
import pool from '../config/db.js';

const request = supertest(app);
let token;
const made = { candidateIds: [], companyId: null };

beforeAll(async () => {
  const res = await request.post('/api/auth/login').send({ username: 'admin', password: 'admin123' });
  token = res.body.token;
  // Need a company to scope candidate creation as platform admin.
  const [c] = await pool.query('INSERT INTO companies SET ?', { name: `VALTEST${Date.now()%100000}`, short_code: `VT${Date.now()%100000}`.slice(0,10), currency: 'AED', status: 'Active' });
  made.companyId = c.insertId;
}, 30000);

afterAll(async () => {
  try {
    if (made.candidateIds.length) await pool.query('DELETE FROM candidates WHERE id IN (?)', [made.candidateIds]);
    if (made.companyId) await pool.query('DELETE FROM companies WHERE id = ?', [made.companyId]);
  } finally {
    await pool.end();
  }
}, 30000);

const bearer = { };
const auth = () => ({ Authorization: `Bearer ${token}` });

describe('Validation middleware', () => {
  it('login rejects missing fields with 422 (or 400 fast-path)', async () => {
    const res = await request.post('/api/auth/login').send({ username: 'x' });
    expect([400, 422]).toContain(res.status);
  });

  it('employee create rejects invalid email with 422', async () => {
    const res = await request.post('/api/employees').set(auth())
      .send({ first_name: 'A', last_name: 'B', email: 'not-an-email', company_id: made.companyId });
    expect(res.status).toBe(422);
    expect(res.body.errors.some((e) => e.field === 'email')).toBe(true);
  });

  it('employee create rejects negative salary with 422', async () => {
    const res = await request.post('/api/employees').set(auth())
      .send({ first_name: 'A', last_name: 'B', basic_salary: -5, company_id: made.companyId });
    expect(res.status).toBe(422);
    expect(res.body.errors.some((e) => e.field === 'basic_salary')).toBe(true);
  });

  it('accepts numeric strings from form inputs (basic_salary "5000")', async () => {
    const res = await request.post('/api/employees').set(auth())
      .send({ first_name: 'Num', last_name: 'String', basic_salary: '5000', company_id: made.companyId });
    expect(res.status).toBe(201); // cleaned up via company cascade in afterAll
  });

  it('user create rejects invalid role with 422', async () => {
    const res = await request.post('/api/users').set(auth())
      .send({ username: 'valuser1', password: 'longenough', name: 'V', role: 'superhero' });
    expect(res.status).toBe(422);
  });
});

describe('Per-company duplicate email guard (DB-004)', () => {
  it('second candidate with same email in same company → 409', async () => {
    const email = `dupe${Date.now()}@example.com`;
    const a = await request.post('/api/candidates').set(auth())
      .send({ first_name: 'Dupe', last_name: 'One', email, company_id: made.companyId });
    expect(a.status).toBe(201);
    made.candidateIds.push(a.body.id);

    const b = await request.post('/api/candidates').set(auth())
      .send({ first_name: 'Dupe', last_name: 'Two', email, company_id: made.companyId });
    expect(b.status).toBe(409);
    if (b.body.id) made.candidateIds.push(b.body.id);
  });
});
