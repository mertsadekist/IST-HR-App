/**
 * Single-organization, multi-company scoping test suite.
 *
 * This is ONE organization that owns several companies (entities). Internal
 * staff (admin / hr_manager / recruiter) operate ACROSS every company and
 * switch entities in the UI; the role governs *permissions*, the selected
 * entity (`company_id` in the query/body) governs which company's data is
 * shown. Self-service users (employee) stay pinned to their own company.
 *
 * This suite verifies that model end-to-end:
 *   - cross-company roles see the whole organization, and narrow to the
 *     selected entity when one is supplied;
 *   - employees are pinned to their own company and cannot widen scope;
 *   - writes land under the selected entity;
 *   - permissions still hold (no self-escalation, hr_manager cannot delete,
 *     company management gated to platform admins).
 *
 * Strategy: the `auth` middleware only verifies the JWT (no DB lookup), so we
 * seed two real companies + users/records, then mint tokens for users of each
 * company and assert the matrix. All fixtures are torn down in afterAll.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import supertest from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../app.js';
import pool from '../config/db.js';
import bcrypt from 'bcryptjs';
import { encrypt } from '../services/cryptoService.js';

// Revealing a stored credential requires the caller to re-enter their own
// password (docs/secrets_protection_design.md §4), so fixture users need a real
// hash rather than a placeholder.
const FIXTURE_PASSWORD = 'FixtureP@ssw0rd';
const FIXTURE_PASSWORD_HASH = bcrypt.hashSync(FIXTURE_PASSWORD, 4);

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

let tokHrA, tokEmpA, tokAdminB, tokPlatform;

beforeAll(async () => {
  // --- Companies ---
  const [a] = await pool.query('INSERT INTO companies SET ?', { name: `${tag}_A`, short_code: `${tag}A`.slice(0, 10), currency: 'AED', status: 'Active' });
  const [b] = await pool.query('INSERT INTO companies SET ?', { name: `${tag}_B`, short_code: `${tag}B`.slice(0, 10), currency: 'AED', status: 'Active' });
  fixture.companyA = a.insertId;
  fixture.companyB = b.insertId;

  // --- Users (real rows so created_by / FK constraints hold) ---
  const mkUser = async (role, companyId, suffix) => {
    const [u] = await pool.query('INSERT INTO users SET ?', {
      username: `${tag}_${suffix}`, password_hash: FIXTURE_PASSWORD_HASH, name: `${tag} ${suffix}`,
      role, company_id: companyId, is_active: 1,
    });
    return u.insertId;
  };
  fixture.ids.hrA = await mkUser('hr_manager', fixture.companyA, 'hrA');
  fixture.ids.empA = await mkUser('employee', fixture.companyA, 'empA');
  fixture.ids.adminB = await mkUser('admin', fixture.companyB, 'adminB'); // company-bound admin (not a platform admin)

  tokHrA = tokenFor({ id: fixture.ids.hrA, name: 'hrA', role: 'hr_manager', company_id: fixture.companyA });
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

  const [docB] = await pool.query('INSERT INTO company_documents SET ?', {
    company_id: fixture.companyB, category: 'General', file_name: `${tag}.txt`,
    file_type: 'text/plain', file_size: 4, file_data: Buffer.from('test'), uploaded_by: fixture.ids.adminB,
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
    await pool.query('DELETE FROM candidates WHERE id = ?', [ids.candB]);
    await pool.query('DELETE FROM employees WHERE id IN (?, ?)', [ids.empRecA, ids.empRecB]);
    await pool.query('DELETE FROM users WHERE id IN (?, ?, ?)', [ids.hrA, ids.empA, ids.adminB]);
    await pool.query('DELETE FROM audit_logs WHERE company_id IN (?, ?)', [companyA, companyB]);
    await pool.query('DELETE FROM companies WHERE id IN (?, ?)', [companyA, companyB]);
  } catch (e) {
    console.error('Isolation teardown error:', e.message);
  } finally {
    await pool.end();
  }
}, 30000);

describe('Cross-company roles see the whole organization', () => {
  it('hr_manager with no entity selected sees employees from EVERY company', async () => {
    const res = await request.get('/api/employees?limit=200').set(bearer(tokHrA));
    expect(res.status).toBe(200);
    const ids = res.body.data.map((e) => e.id);
    expect(ids).toContain(fixture.ids.empRecA);
    expect(ids).toContain(fixture.ids.empRecB); // company B is visible — single-org model
  });

  it('selecting an entity narrows the result to that company only', async () => {
    const res = await request.get(`/api/employees?company_id=${fixture.companyB}&limit=200`).set(bearer(tokHrA));
    expect(res.status).toBe(200);
    const ids = res.body.data.map((e) => e.id);
    expect(ids).toContain(fixture.ids.empRecB);
    expect(ids).not.toContain(fixture.ids.empRecA);
    expect(res.body.data.every((e) => e.company_id === fixture.companyB)).toBe(true);
  });

  it('hr_manager can read a record in another company by id (cross-company)', async () => {
    const res = await request.get(`/api/employees/${fixture.ids.empRecB}`).set(bearer(tokHrA));
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(fixture.ids.empRecB);
  });

  // Reading a stored credential is no longer an HR function — see
  // docs/secrets_protection_design.md §4. Cross-company reach is unchanged for
  // internal staff; what changed is that only an admin may reveal, only over
  // POST, and only with a reason that lands in the audit log.
  it('hr_manager can no longer reveal a stored password', async () => {
    const res = await request.post(`/api/assets/${fixture.ids.asgB}/reveal-password`)
      .set(bearer(tokHrA)).send({ reason: 'checking the credential works', password: FIXTURE_PASSWORD });
    expect(res.status).toBe(403);
  });

  it('admin can reveal a company-B asset password cross-company, with a reason', async () => {
    const res = await request.post(`/api/assets/${fixture.ids.asgB}/reveal-password`)
      .set(bearer(tokAdminB)).send({ reason: 'rotating this shared credential', password: FIXTURE_PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.password).toBe('superSecretB');
  });

  it('refuses a reveal with no stated reason', async () => {
    const res = await request.post(`/api/assets/${fixture.ids.asgB}/reveal-password`)
      .set(bearer(tokAdminB)).send({ password: FIXTURE_PASSWORD });
    expect(res.status).toBe(422);
  });

  // Step-up authentication: a valid session is not enough to read a credential.
  it('refuses a reveal without the callers own password', async () => {
    const res = await request.post(`/api/assets/${fixture.ids.asgB}/reveal-password`)
      .set(bearer(tokAdminB)).send({ reason: 'rotating this shared credential' });
    expect(res.status).toBe(422);
    expect(res.body.step_up_required).toBe(true);
  });

  it('refuses a reveal when that password is wrong', async () => {
    const res = await request.post(`/api/assets/${fixture.ids.asgB}/reveal-password`)
      .set(bearer(tokAdminB)).send({ reason: 'rotating this shared credential', password: 'not-my-password' });
    expect(res.status).toBe(401);
  });
});

/**
 * The employee directory used to be readable by an employee account, scoped to
 * their own company. That was never a feature — GET /api/employees selects
 * `e.*`, so it handed every colleague's salary, IBAN and passport number to
 * anyone with a login. The module gate (config/permissions.js) now refuses the
 * router outright for that role, which is why these assert 403 rather than a
 * filtered 200.
 */
describe('Employee self-service cannot reach the operational modules', () => {
  it('employee is refused the employee directory outright', async () => {
    const res = await request.get('/api/employees?limit=200').set(bearer(tokEmpA));
    expect(res.status).toBe(403);
  });

  it('a client-supplied company_id does not get an employee past the gate', async () => {
    const res = await request.get(`/api/employees?company_id=${fixture.companyB}&limit=200`).set(bearer(tokEmpA));
    expect(res.status).toBe(403);
  });

  it('employee cannot read a record in another company by id', async () => {
    const res = await request.get(`/api/employees/${fixture.ids.empRecB}`).set(bearer(tokEmpA));
    expect(res.status).toBe(403);
  });

  it('nor the assets register, where the same records are reachable another way', async () => {
    const res = await request.get('/api/assets').set(bearer(tokEmpA));
    expect(res.status).toBe(403);
  });

  // The point of closing the hole is that self-service still works — an
  // employee reaches their own things through routes that resolve the employee
  // from the token, so no company_id in the query can widen them.
  it('but the portal still serves that employee their own assets', async () => {
    const res = await request.get(`/api/portal/my-assets?company_id=${fixture.companyB}`).set(bearer(tokEmpA));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.every((a) => a.company_id === fixture.companyA)).toBe(true);
    expect(res.body.map((a) => a.name)).not.toContain(`${tag} AccountB`);
  });
});

describe('Write scoping follows the selected entity', () => {
  it('POST /candidates lands under the selected entity (body company_id)', async () => {
    const res = await request.post('/api/candidates').set(bearer(tokHrA))
      .send({ first_name: tag, last_name: 'Created', company_id: fixture.companyB });
    expect(res.status).toBe(201);
    fixture.ids.createdCandidate = res.body.id;
    const [[row]] = await pool.query('SELECT company_id FROM candidates WHERE id = ?', [res.body.id]);
    expect(row.company_id).toBe(fixture.companyB);
  });

  it('POST /candidates with no entity and no body company_id is rejected (400)', async () => {
    const res = await request.post('/api/candidates').set(bearer(tokHrA))
      .send({ first_name: tag, last_name: 'NoCompany' });
    expect(res.status).toBe(400);
  });
});

describe('Permissions hold regardless of company visibility', () => {
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

  it('hr_manager cannot delete (delete is admin-only)', async () => {
    const res = await request.delete(`/api/employees/${fixture.ids.empRecA}`).set(bearer(tokHrA));
    expect(res.status).toBe(403);
    const [[row]] = await pool.query('SELECT id FROM employees WHERE id = ?', [fixture.ids.empRecA]);
    expect(row).toBeTruthy(); // still exists
  });

  it('company-bound admin cannot create a new company (platform-admin only)', async () => {
    const res = await request.post('/api/companies').set(bearer(tokAdminB))
      .send({ name: `${tag}_X`, short_code: `${tag}X`.slice(0, 10), currency: 'AED' });
    expect(res.status).toBe(403);
  });
});

describe('Entity selection narrows audit + companies for cross-company roles', () => {
  it('hr_manager /audit narrows to the selected entity', async () => {
    const res = await request.get(`/api/audit?company_id=${fixture.companyB}&limit=100`).set(bearer(tokHrA));
    expect(res.status).toBe(200);
    expect(res.body.data.every((row) => row.company_id === fixture.companyB)).toBe(true);
  });

  it('hr_manager /companies sees every company; selecting one narrows it', async () => {
    const all = await request.get('/api/companies').set(bearer(tokHrA));
    expect(all.status).toBe(200);
    const allIds = all.body.map((c) => c.id);
    expect(allIds).toContain(fixture.companyA);
    expect(allIds).toContain(fixture.companyB); // cross-company visibility

    const narrowed = await request.get(`/api/companies?company_id=${fixture.companyA}`).set(bearer(tokHrA));
    const nIds = narrowed.body.map((c) => c.id);
    expect(nIds).toContain(fixture.companyA);
    expect(nIds).not.toContain(fixture.companyB);

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
