/**
 * Onboarding v2 end-to-end test: drives the full gated stage machine through the
 * REST API (CV seeded via DB to avoid an external AI call), plus the multi-offer
 * guard, gate enforcement, and tenant isolation.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import supertest from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../app.js';
import pool from '../config/db.js';

const request = supertest(app);
const tag = `OB${Date.now().toString().slice(-5)}`;
const f = { ids: {} };
const tokenFor = (u) => jwt.sign({ id: u.id, name: u.name, role: u.role, company_id: u.company_id }, process.env.JWT_SECRET, { expiresIn: '1h' });
const auth = (t) => ({ Authorization: `Bearer ${t}` });
let tokHrA, tokAdminA, tokHrB;

beforeAll(async () => {
  const [a] = await pool.query('INSERT INTO companies SET ?', { name: `${tag}_A`, short_code: `${tag}A`.slice(0, 10), currency: 'AED', status: 'Active' });
  const [b] = await pool.query('INSERT INTO companies SET ?', { name: `${tag}_B`, short_code: `${tag}B`.slice(0, 10), currency: 'AED', status: 'Active' });
  f.companyA = a.insertId; f.companyB = b.insertId;
  const [uHrA] = await pool.query('INSERT INTO users SET ?', { username: `${tag}_hrA`, password_hash: 'x', name: 'HR A', role: 'hr_manager', company_id: f.companyA, is_active: 1, email: `${tag}hra@example.com` });
  const [uAdminA] = await pool.query('INSERT INTO users SET ?', { username: `${tag}_admA`, password_hash: 'x', name: 'Adm A', role: 'admin', company_id: f.companyA, is_active: 1 });
  const [uHrB] = await pool.query('INSERT INTO users SET ?', { username: `${tag}_hrB`, password_hash: 'x', name: 'HR B', role: 'hr_manager', company_id: f.companyB, is_active: 1 });
  f.ids.uHrA = uHrA.insertId; f.ids.uAdminA = uAdminA.insertId; f.ids.uHrB = uHrB.insertId;
  tokHrA = tokenFor({ id: uHrA.insertId, name: 'HR A', role: 'hr_manager', company_id: f.companyA });
  tokAdminA = tokenFor({ id: uAdminA.insertId, name: 'Adm A', role: 'admin', company_id: f.companyA });
  tokHrB = tokenFor({ id: uHrB.insertId, name: 'HR B', role: 'hr_manager', company_id: f.companyB });
}, 30000);

afterAll(async () => {
  try {
    // employees created by finalize
    await pool.query('DELETE FROM employees WHERE company_id IN (?, ?)', [f.companyA, f.companyB]);
    // onboarding_* cascade from onboarding_records / companies
    await pool.query('DELETE FROM onboarding_records WHERE company_id IN (?, ?)', [f.companyA, f.companyB]);
    await pool.query('DELETE FROM email_log WHERE company_id IN (?, ?)', [f.companyA, f.companyB]);
    await pool.query('DELETE FROM users WHERE id IN (?, ?, ?)', [f.ids.uHrA, f.ids.uAdminA, f.ids.uHrB]);
    await pool.query('DELETE FROM audit_logs WHERE company_id IN (?, ?)', [f.companyA, f.companyB]);
    await pool.query('DELETE FROM companies WHERE id IN (?, ?)', [f.companyA, f.companyB]);
  } finally { await pool.end(); }
}, 30000);

describe('Onboarding v2 — full gated lifecycle', () => {
  it('creates a draft', async () => {
    const res = await request.post('/api/onboarding/v2').set(auth(tokHrA)).send({});
    expect(res.status).toBe(201);
    expect(res.body.stage).toBe('DRAFT');
    f.ids.onb = res.body.id;
  });

  it('blocks advancing out of DRAFT without a CV (422)', async () => {
    const res = await request.post(`/api/onboarding/v2/${f.ids.onb}/advance`).set(auth(tokHrA)).send({});
    expect(res.status).toBe(422);
    expect(res.body.missing.join(' ')).toMatch(/CV/i);
  });

  it('CV present → advance to CV_UPLOADED', async () => {
    // Seed a CV file + link to profile (simulates a processed upload without the AI call)
    const [file] = await pool.query('INSERT INTO onboarding_files SET ?', { onboarding_id: f.ids.onb, company_id: f.companyA, kind: 'cv', file_name: 'cv.pdf', storage_key: 'seed.pdf', uploaded_by: f.ids.uHrA });
    await pool.query('UPDATE onboarding_profiles SET cv_file_id = ? WHERE onboarding_id = ?', [file.insertId, f.ids.onb]);
    const res = await request.post(`/api/onboarding/v2/${f.ids.onb}/advance`).set(auth(tokHrA)).send({});
    expect(res.status).toBe(200);
    expect(res.body.stage).toBe('CV_UPLOADED');
  });

  it('requires a complete + verified profile before HR review', async () => {
    // advance now would require profile completion at UNDER_HR_REVIEW after moving there;
    // first move CV_UPLOADED → UNDER_HR_REVIEW (CV_UPLOADED only needs profile to exist)
    let res = await request.post(`/api/onboarding/v2/${f.ids.onb}/advance`).set(auth(tokHrA)).send({});
    expect(res.status).toBe(200);
    expect(res.body.stage).toBe('UNDER_HR_REVIEW');

    // advancing now should fail — profile incomplete + unverified
    res = await request.post(`/api/onboarding/v2/${f.ids.onb}/advance`).set(auth(tokHrA)).send({});
    expect(res.status).toBe(422);

    // fill + verify
    await request.put(`/api/onboarding/v2/${f.ids.onb}/profile`).set(auth(tokHrA))
      .send({ first_name: 'Sara', last_name: 'Khan', email: 'sara@example.com', phone: '+971500000000', nationality: 'UAE' });
    await request.post(`/api/onboarding/v2/${f.ids.onb}/verify-profile`).set(auth(tokHrA)).send({});
  });

  it('HR Manager approves → HR_APPROVED', async () => {
    const res = await request.post(`/api/onboarding/v2/${f.ids.onb}/review`).set(auth(tokHrA)).send({ decision: 'Approved', note: 'Strong fit' });
    expect(res.status).toBe(200);
    const det = await request.get(`/api/onboarding/v2/${f.ids.onb}`).set(auth(tokHrA));
    expect(det.body.stage).toBe('HR_APPROVED');
  });

  it('creates an offer and enforces the multi-offer guard', async () => {
    const o1 = await request.post(`/api/onboarding/v2/${f.ids.onb}/offers`).set(auth(tokHrA))
      .send({ job_title: 'Engineer', work_location: 'Dubai', joining_date: '2026-08-01', basic_salary: 9000, offer_expiry_date: '2026-07-15', candidate_name: 'Sara Khan' });
    expect(o1.status).toBe(201);
    f.ids.offer = o1.body.id;
    // second offer blocked while the first is still open (Draft)
    const o2 = await request.post(`/api/onboarding/v2/${f.ids.onb}/offers`).set(auth(tokHrA))
      .send({ job_title: 'Engineer', work_location: 'Dubai', joining_date: '2026-08-01', basic_salary: 9500, offer_expiry_date: '2026-07-15' });
    expect(o2.status).toBe(409);
    expect(o2.body.blocking_offer_id).toBe(f.ids.offer);
  });

  it('sends the offer (email failure is non-blocking) then records acceptance', async () => {
    const send = await request.post(`/api/onboarding/v2/offers/${f.ids.offer}/send`).set(auth(tokHrA)).send({});
    expect(send.status).toBe(200);
    let det = await request.get(`/api/onboarding/v2/${f.ids.onb}`).set(auth(tokHrA));
    expect(det.body.stage).toBe('OFFER_SENT');

    const resp = await request.post(`/api/onboarding/v2/offers/${f.ids.offer}/respond`).set(auth(tokHrA)).send({ response: 'Accepted' });
    expect(resp.status).toBe(200);
    det = await request.get(`/api/onboarding/v2/${f.ids.onb}`).set(auth(tokHrA));
    expect(det.body.stage).toBe('OFFER_ACCEPTED');
  });

  it('signed offer must be uploaded AND verified to proceed to documents', async () => {
    // upload (multipart) a small signed file
    const up = await request.post(`/api/onboarding/v2/${f.ids.onb}/signed-offer`).set(auth(tokHrA))
      .attach('file', Buffer.from('%PDF-1.4 signed'), 'signed.pdf');
    expect(up.status).toBe(200);
    const verify = await request.post(`/api/onboarding/v2/${f.ids.onb}/signed-offer/verify`).set(auth(tokHrA)).send({ status: 'Verified' });
    expect(verify.status).toBe(200);
    const det = await request.get(`/api/onboarding/v2/${f.ids.onb}`).set(auth(tokHrA));
    expect(det.body.stage).toBe('DOCUMENTS_COLLECTION');
    expect(det.body.documents.length).toBeGreaterThan(0);
  });

  it('blocks advancing until required documents are verified, then advances to visa', async () => {
    let det = await request.get(`/api/onboarding/v2/${f.ids.onb}`).set(auth(tokHrA));
    const blocked = await request.post(`/api/onboarding/v2/${f.ids.onb}/advance`).set(auth(tokHrA)).send({});
    expect(blocked.status).toBe(422);

    // verify every required document
    for (const d of det.body.documents.filter((x) => x.required)) {
      const v = await request.post(`/api/onboarding/v2/documents/${d.id}/verify`).set(auth(tokHrA)).send({ status: 'Verified' });
      expect(v.status).toBe(200);
    }
    const adv = await request.post(`/api/onboarding/v2/${f.ids.onb}/advance`).set(auth(tokHrA)).send({});
    expect(adv.status).toBe(200);
    expect(adv.body.stage).toBe('VISA_RESIDENCY');
  });

  it('visa can be skipped as Not Applicable → bank details', async () => {
    const adv = await request.post(`/api/onboarding/v2/${f.ids.onb}/advance`).set(auth(tokHrA)).send({ visa_not_applicable: true });
    expect(adv.status).toBe(200);
    expect(adv.body.stage).toBe('BANK_DETAILS');
  });

  it('bank details validated + verified → ready → completed (employee created)', async () => {
    // invalid IBAN rejected
    const bad = await request.put(`/api/onboarding/v2/${f.ids.onb}/bank`).set(auth(tokHrA))
      .send({ bank_name: 'ENBD', account_holder_name: 'Sara Khan', account_number: '123', iban: 'NOPE' });
    expect(bad.status).toBe(422);

    const ok = await request.put(`/api/onboarding/v2/${f.ids.onb}/bank`).set(auth(tokHrA))
      .send({ bank_name: 'ENBD', account_holder_name: 'Sara Khan', account_number: '123456', iban: 'AE070331234567890123456' });
    expect(ok.status).toBe(200);

    // not verified yet → advance blocked
    const blocked = await request.post(`/api/onboarding/v2/${f.ids.onb}/advance`).set(auth(tokHrA)).send({});
    expect(blocked.status).toBe(422);

    await request.post(`/api/onboarding/v2/${f.ids.onb}/bank/verify`).set(auth(tokHrA)).send({});
    const toReady = await request.post(`/api/onboarding/v2/${f.ids.onb}/advance`).set(auth(tokHrA)).send({});
    expect(toReady.body.stage).toBe('READY_FOR_EMPLOYMENT');

    const toDone = await request.post(`/api/onboarding/v2/${f.ids.onb}/advance`).set(auth(tokHrA)).send({});
    expect(toDone.body.stage).toBe('COMPLETED');

    const det = await request.get(`/api/onboarding/v2/${f.ids.onb}`).set(auth(tokHrA));
    expect(det.body.stage).toBe('COMPLETED');
    expect(det.body.employee_id).toBeTruthy();
  });
});

describe('Onboarding v2 — authorization & isolation', () => {
  it("HR of company B cannot read company A's onboarding (404)", async () => {
    const res = await request.get(`/api/onboarding/v2/${f.ids.onb}`).set(auth(tokHrB));
    expect(res.status).toBe(404);
  });

  it('rejection requires a reason (422)', async () => {
    const c = await request.post('/api/onboarding/v2').set(auth(tokHrA)).send({});
    const res = await request.post(`/api/onboarding/v2/${c.body.id}/review`).set(auth(tokHrA)).send({ decision: 'Rejected' });
    expect(res.status).toBe(422);
  });
});
