/**
 * Multi-company isolation test suite (audit 03 §9 / 08 §7).
 *
 * Verifies that the tenantScope middleware and per-route company scoping added
 * in Phase 1 prevent cross-company reads/writes/deletes and privilege escalation.
 *
 * Strategy: the `auth` middleware only verifies the JWT (no DB lookup), so we
 * seed two real companies + users/records, then mint tokens for users of each
 * company and assert the isolation matrix. All fixtures are torn down in afterAll.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import supertest from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../app.js';
import pool from '../config/db.js';
import { encrypt } from '../services/cryptoService.js';

const request = supertest(app);
const tag = `IS${Date.now().toString().slice(-5)}`; // 7-char ASCII marker; short codes stay <= 10 and unique per company

const fixture = { companyA: null, companyB: null, ids: {} };

function tokenFor(user) {
  return jwt.sign(
    { id: user.id, name: user.name, role: user.role, company_id: user.company_id },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
}
const bearer = (t) => ({ Authorization: `Bearer ${t}` });

let tokHrA, tokHrB, tokEmpA, tokAdminB, tokPlatform;

beforeAll(async () => {
  // --- Companies ---
  const [a] = await pool.query('INSERT INTO companies SET ?', { name: `${tag}_A`, short_code: `${tag}A`.slice(0, 10), currency: 'AED', status: 'Active' });
  const [b] = await pool.query('INSERT INTO companies SET ?', { name: `${tag}_B`, short_code: `${tag}B`.slice(0, 10), currency: 'AED', status: 'Active' });
  fixture.companyA = a.insertId;
  fixture.companyB = b.insertId;

  // --- Users (real rows so created_by / FK constraints hold) ---
  const mkUser = async (role, companyId, suffix) => {
    const [u] = await pool.query('INSERT INTO users SET ?', {
      username: `${tag}_${suffix}`, password_hash: 'x', name: `${tag} ${suffix}`,
      role, company_id: companyId, is_active: 1,
    });
    return u.insertId;
  };
  fixture.ids.hrA = await mkUser('hr_manager', fixture.companyA, 'hrA');
  fixture.ids.hrB = await mkUser('hr_manager', fixture.companyB, 'hrB');
  fixture.ids.empA = await mkUser('employee', fixture.companyA, 'empA');
  fixture.ids.adminB = await mkUser('admin', fixture.companyB, 'adminB'); // company-bound admin

  tokHrA = tokenFor({ id: fixture.ids.hrA, name: 'hrA', role: 'hr_manager', company_id: fixture.companyA });
  tokHrB = tokenFor({ id: fixture.ids.hrB, name: 'hrB', role: 'hr_manager', company_id: fixture.companyB });
  tokEmpA = tokenFor({ id: fixture.ids.empA, name: 'empA', role: 'employee', company_id: fixture.companyA });
  tokAdminB = tokenFor({ id: fixture.ids.adminB, name: 'adminB', role: 'admin', company_id: fixture.companyB });
  tokPlatform = tokenFor({ id: fixture.ids.hrA, name: 'plat', role: 'admin', company_id: null }); // platform admin (no company)

  // --- Records in each company ---
  const [empA] = await pool.query('INSERT INTO employees SET ?', { first_name: tag, last_name: 'A', company_id: fixture.companyA, status: 'Active' });
  const [empB] = await pool.query('INSERT INTO employees SET ?', { first_name: tag, last_name: 'B', company_id: fixture.companyB, status: 'Active' });
  fixture.ids.empRecA = empA.insertId;
  fixture.ids.empRecB = empB.insertId;

  const [candB] = await pool.query('INSERT INTO candidates SET ?', { first_name: tag, last_name: 'CandB', company_id: fixture.companyB, status: 'Active' });
  fixture.ids.candB = candB.insertId;

  const [vacB] = await pool.query('INSERT INTO vacancies SET ?', { title: `${tag} VacB`, company_id: fixture.companyB, created_by: fixture.ids.hrB, status: 'Open' });
  fixture.ids.vacB = vacB.insertId;

  const [docB] = await pool.query('INSERT INTO company_documents SET ?', {
    company_id: fixture.companyB, category: 'General', file_name: `${tag}.txt`,
    file_type: 'text/plain', file_size: 4, file_data: Buffer.from('test'), uploaded_by: fixture.ids.hrB,
  });
  fixture.ids.docB = docB.insertId;

  // Asset in company B with an encrypted password (for reveal-password test)
  const enc = encrypt('superSecretB');
  const [asgB] = await pool.query('INSERT INTO asset_assignments SET ?', {
    company_id: fixture.companyB, employee_id: fixture.ids.empRecB, name: `${tag} AccountB`,
    asset_type: 'Account', account_username: 'svcB', status: 'Active',
    encrypted_password: enc.encrypted, password_iv: enc.iv, password_tag: enc.tag,
  });
  fixture.ids.asgB = asgB.insertId;
}, 30000);

afterAll(async () => {
  const { ids, companyA, companyB } = fixture;
  try {
    // Clean child rows first, then users, then companies (cascade handles the rest)
    if (ids.createdCandidate) await pool.query('DELETE FROM candidates WHERE id = ?', [ids.createdCandidate]);
    await pool.query('DELETE FROM asset_assignments WHERE id = ?', [ids.asgB]);
    await pool.query('DELETE FROM company_documents WHERE id = ?', [ids.docB]);
    await pool.query('DELETE FROM vacancies WHERE id = ?', [ids.vacB]);
    await pool.query('DELETE FROM candidates WHERE id = ?', [ids.candB]);
    await pool.query('DELETE FROM employees WHERE id IN (?, ?)', [ids.empRecA, ids.empRecB]);
    await pool.query('DELETE FROM users WHERE id IN (?, ?, ?, ?)', [ids.hrA, ids.hrB, ids.empA, ids.adminB]);
    await pool.query('DELETE FROM audit_logs WHERE company_id IN (?, ?)', [companyA, companyB]);
    await pool.query('DELETE FROM companies WHERE id IN (?, ?)', [companyA, companyB]);
  } catch (e) {
    console.error('Isolation teardown error:', e.message);
  } finally {
    await pool.end();
  }
}, 30000);

describe('List scoping', () => {
  it('hrA /employees returns only company A rows (no company B employee)', async () => {
    const res = await request.get('/api/employees?limit=100').set(bearer(tokHrA));
    expect(res.status).toBe(200);
    const ids = res.body.data.map((e) => e.id);
    expect(ids).toContain(fixture.ids.empRecA);
    expect(ids).not.toContain(fixture.ids.empRecB);
    expect(res.body.data.every((e) => e.company_id === fixture.companyA)).toBe(true);
  });

  it('client-supplied company_id cannot widen scope', async () => {
    const res = await request.get(`/api/employees?company_id=${fixture.companyB}&limit=100`).set(bearer(tokHrA));
    expect(res.status).toBe(200);
    expect(res.body.data.every((e) => e.company_id === fixture.companyA)).toBe(true);
  });
});

describe('IDOR — cross-company :id access returns 404', () => {
  it('GET /employees/:id (B) as hrA → 404', async () => {
    const res = await request.get(`/api/employees/${fixture.ids.empRecB}`).set(bearer(tokHrA));
    expect(res.status).toBe(404);
  });
  it('GET /candidates/:id (B) as hrA → 404', async () => {
    const res = await request.get(`/api/candidates/${fixture.ids.candB}`).set(bearer(tokHrA));
    expect(res.status).toBe(404);
  });
  it('GET /vacancies/:id (B) as hrA → 404', async () => {
    const res = await request.get(`/api/vacancies/${fixture.ids.vacB}`).set(bearer(tokHrA));
    expect(res.status).toBe(404);
  });
  it('GET /documents/:id/download (B) as hrA → 404', async () => {
    const res = await request.get(`/api/documents/${fixture.ids.docB}/download`).set(bearer(tokHrA));
    expect(res.status).toBe(404);
  });
  it('GET /assets/:id/reveal-password (B) as hrA → 404 (no credential leak)', async () => {
    const res = await request.get(`/api/assets/${fixture.ids.asgB}/reveal-password`).set(bearer(tokHrA));
    expect(res.status).toBe(404);
    expect(res.body.password).toBeUndefined();
  });
  it('PUT /vacancies/:id (B) as hrA → 404', async () => {
    const res = await request.put(`/api/vacancies/${fixture.ids.vacB}`).set(bearer(tokHrA)).send({ title: 'hacked' });
    expect(res.status).toBe(404);
  });
});

describe('Write scoping', () => {
  it('POST /candidates ignores body.company_id and writes under caller company', async () => {
    const res = await request.post('/api/candidates').set(bearer(tokHrA))
      .send({ first_name: tag, last_name: 'Created', company_id: fixture.companyB });
    expect(res.status).toBe(201);
    fixture.ids.createdCandidate = res.body.id;
    const [[row]] = await pool.query('SELECT company_id FROM candidates WHERE id = ?', [res.body.id]);
    expect(row.company_id).toBe(fixture.companyA);
  });
});

describe('Authorization', () => {
  it('employee cannot escalate own role via PUT /users/:id', async () => {
    const res = await request.put(`/api/users/${fixture.ids.empA}`).set(bearer(tokEmpA)).send({ role: 'admin' });
    expect(res.status).toBe(403);
    const [[u]] = await pool.query('SELECT role FROM users WHERE id = ?', [fixture.ids.empA]);
    expect(u.role).toBe('employee');
  });

  it('employee cannot toggle onboarding checklist items', async () => {
    const res = await request.put('/api/onboarding/checklist/1').set(bearer(tokEmpA)).send({ is_checked: true });
    expect(res.status).toBe(403);
  });

  it('company-bound admin cannot delete another company employee (404)', async () => {
    const res = await request.delete(`/api/employees/${fixture.ids.empRecA}`).set(bearer(tokAdminB));
    expect(res.status).toBe(404);
    const [[row]] = await pool.query('SELECT id FROM employees WHERE id = ?', [fixture.ids.empRecA]);
    expect(row).toBeTruthy(); // still exists
  });

  it('company-bound admin cannot create a new company', async () => {
    const res = await request.post('/api/companies').set(bearer(tokAdminB))
      .send({ name: `${tag}_X`, short_code: `${tag}X`.slice(0, 10), currency: 'AED' });
    expect(res.status).toBe(403);
  });
});

describe('Audit + companies scoping', () => {
  it('hrA /audit never returns company B events', async () => {
    const res = await request.get('/api/audit?limit=100').set(bearer(tokHrA));
    expect(res.status).toBe(200);
    expect(res.body.data.every((row) => row.company_id !== fixture.companyB)).toBe(true);
  });

  it('hrA /companies returns only company A; platform admin sees both', async () => {
    const a = await request.get('/api/companies').set(bearer(tokHrA));
    expect(a.status).toBe(200);
    const aIds = a.body.map((c) => c.id);
    expect(aIds).toContain(fixture.companyA);
    expect(aIds).not.toContain(fixture.companyB);

    const p = await request.get('/api/companies').set(bearer(tokPlatform));
    const pIds = p.body.map((c) => c.id);
    expect(pIds).toContain(fixture.companyA);
    expect(pIds).toContain(fixture.companyB);
  });
});

describe('Unauthenticated access', () => {
  it('rejects requests without a token', async () => {
    const res = await request.get('/api/employees');
    expect(res.status).toBe(401);
  });
});
