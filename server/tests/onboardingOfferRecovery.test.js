/**
 * Two ways an onboarding used to get stuck, and the way out of it.
 *
 * **A rejected offer was a dead end.** "Advance stage" only required that an
 * offer had been *sent*, so a record could be pushed to OFFER_ACCEPTED while the
 * candidate had said nothing. If they then rejected it, the stage kept asserting
 * an acceptance that never happened — and because the offers panel only appears
 * on the offer stages, there was no longer anywhere to raise a replacement. The
 * real record this came from (ARMAN KHAN, OFR-ISTRE-00008) was worked around by
 * creating a second, duplicate onboarding for the same person.
 *
 * **There was no way to stop.** The cancel endpoint existed but nothing called
 * it, and it ignored the employee profile that accepting an offer creates — so
 * someone who withdrew after a week stayed on the staff list, in payroll, in
 * attendance and in the WPS file.
 *
 * Records are seeded straight into the database at the stage under test rather
 * than driven through five stages of API calls: these tests are about what
 * happens at the offer and the exit, not about the road there.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import supertest from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../app.js';
import pool from '../config/db.js';

const request = supertest(app);
const tag = `OFR${Date.now().toString().slice(-6)}`;
const auth = (t) => ({ Authorization: `Bearer ${t}` });
const f = { records: [], employees: [] };
let tokHr, tokAdmin, tokRecruiter;

const tokenFor = (u) => jwt.sign(u, process.env.JWT_SECRET, { expiresIn: '1h' });

/** An onboarding sitting at `stage`, with `offers` already on it. */
async function seedRecord(stage, offers = [], extra = {}) {
  const [r] = await pool.query('INSERT INTO onboarding_records SET ?', {
    company_id: f.company, stage, status: 'In Progress',
    assigned_to: f.uHr, created_by: f.uHr, ...extra,
  });
  await pool.query('INSERT INTO onboarding_profiles SET ?', {
    onboarding_id: r.insertId, company_id: f.company,
    first_name: 'Test', last_name: tag, email: `${tag}@example.com`,
  });
  await pool.query('INSERT INTO onboarding_approvals SET ?', {
    onboarding_id: r.insertId, company_id: f.company, decision: 'Approved', decided_by: f.uHr,
  });
  const ids = [];
  for (const [i, o] of offers.entries()) {
    const [x] = await pool.query('INSERT INTO onboarding_offers SET ?', {
      onboarding_id: r.insertId, company_id: f.company,
      offer_number: `${tag}-${r.insertId}-${i + 1}`, version: i + 1,
      job_title: 'Tele Sales Executive', work_location: 'Business Bay, Dubai',
      joining_date: '2099-01-05', basic_salary: 3000, offer_expiry_date: '2099-01-01',
      created_by: f.uHr, ...o,
    });
    ids.push(x.insertId);
  }
  f.records.push(r.insertId);
  return { id: r.insertId, offerIds: ids };
}

beforeAll(async () => {
  const [c] = await pool.query('INSERT INTO companies SET ?', {
    name: `${tag} Co`, short_code: tag.slice(0, 10), currency: 'AED', status: 'Active',
  });
  f.company = c.insertId;
  const mk = async (role, name) => {
    const [u] = await pool.query('INSERT INTO users SET ?', {
      username: `${tag}_${role}`, password_hash: 'x', name, role,
      company_id: f.company, is_active: 1,
    });
    return u.insertId;
  };
  f.uHr = await mk('hr_manager', 'HR Manager');
  f.uAdmin = await mk('admin', 'Admin');
  // `users.role` has no hr_specialist — the enum is
  // admin/hr_manager/recruiter/accountant/employee. A recruiter is the
  // nearest real role that must not be able to end somebody's hire.
  f.uRec = await mk('recruiter', 'Recruiter');
  tokHr = tokenFor({ id: f.uHr, name: 'HR Manager', role: 'hr_manager', company_id: f.company });
  tokAdmin = tokenFor({ id: f.uAdmin, name: 'Admin', role: 'admin', company_id: f.company });
  tokRecruiter = tokenFor({ id: f.uRec, name: 'Recruiter', role: 'recruiter', company_id: f.company });
}, 30000);

afterAll(async () => {
  try {
    await pool.query('DELETE FROM employees WHERE company_id = ?', [f.company]);
    await pool.query('DELETE FROM onboarding_records WHERE company_id = ?', [f.company]);
    await pool.query('DELETE FROM audit_logs WHERE company_id = ?', [f.company]);
    await pool.query('DELETE FROM notifications WHERE company_id = ?', [f.company]).catch(() => {});
    await pool.query('DELETE FROM users WHERE company_id = ?', [f.company]);
    await pool.query('DELETE FROM companies WHERE id = ?', [f.company]);
  } finally { await pool.end(); }
}, 30000);

const stageOf = async (id) => {
  const [[r]] = await pool.query('SELECT stage, status, rejection_reason FROM onboarding_records WHERE id = ?', [id]);
  return r;
};

describe('a rejected offer is not a dead end', () => {
  it('rejecting the only live offer rewinds the stage so a new offer can be raised', async () => {
    const { id, offerIds } = await seedRecord('OFFER_SENT', [{ status: 'Sent' }]);

    const res = await request.post(`/api/onboarding/v2/offers/${offerIds[0]}/respond`)
      .set(auth(tokHr)).send({ response: 'Rejected', rejection_reason: 'Wants a higher basic' });
    expect(res.status).toBe(200);

    expect((await stageOf(id)).stage).toBe('HR_APPROVED');
  });

  it('rewinds from OFFER_ACCEPTED too — the stage the record wrongly reached', async () => {
    // Exactly ARMAN KHAN's record: advanced to "Offer Accepted" while the offer
    // was still unanswered, then the offer was rejected.
    const { id, offerIds } = await seedRecord('OFFER_ACCEPTED', [{ status: 'Sent' }]);

    await request.post(`/api/onboarding/v2/offers/${offerIds[0]}/respond`)
      .set(auth(tokHr)).send({ response: 'Rejected', rejection_reason: 'Changed their mind' });

    expect((await stageOf(id)).stage).toBe('HR_APPROVED');
  });

  it('and the replacement offer can actually be created afterwards', async () => {
    const { id, offerIds } = await seedRecord('OFFER_ACCEPTED', [{ status: 'Sent' }]);
    await request.post(`/api/onboarding/v2/offers/${offerIds[0]}/respond`)
      .set(auth(tokHr)).send({ response: 'Rejected', rejection_reason: 'Needs a revised letter' });

    const res = await request.post(`/api/onboarding/v2/${id}/offers`).set(auth(tokHr)).send({
      job_title: 'Tele Sales Executive', work_location: 'Business Bay, Dubai',
      joining_date: '2099-02-01', basic_salary: 3500, offer_expiry_date: '2099-01-20',
    });
    expect(res.status).toBe(201);
  });

  it('leaves the stage alone when another offer is still live', async () => {
    const { id, offerIds } = await seedRecord('OFFER_SENT', [
      { status: 'Sent' },
      { status: 'Draft' },
    ]);
    await request.post(`/api/onboarding/v2/offers/${offerIds[0]}/respond`)
      .set(auth(tokHr)).send({ response: 'Rejected', rejection_reason: 'Superseded' });

    expect((await stageOf(id)).stage).toBe('OFFER_SENT');
  });

  it('will not advance past OFFER_SENT while the offer is unanswered', async () => {
    // The bug that created the drift in the first place.
    const { id } = await seedRecord('OFFER_SENT', [{ status: 'Sent' }]);
    const res = await request.post(`/api/onboarding/v2/${id}/advance`).set(auth(tokHr)).send({});
    expect(res.status).toBe(422);
    expect(res.body.missing.join(' ')).toMatch(/response/i);
    expect((await stageOf(id)).stage).toBe('OFFER_SENT');
  });

  it('nor with only a rejected offer on file', async () => {
    const { id } = await seedRecord('OFFER_SENT', [{ status: 'Rejected', rejection_reason: 'no' }]);
    const res = await request.post(`/api/onboarding/v2/${id}/advance`).set(auth(tokHr)).send({});
    expect(res.status).toBe(422);
  });
});

describe('ending the onboarding journey', () => {
  it('requires a reason', async () => {
    const { id } = await seedRecord('DOCUMENTS_COLLECTION');
    const res = await request.post(`/api/onboarding/v2/${id}/cancel`).set(auth(tokHr)).send({});
    expect(res.status).toBe(422);
    expect((await stageOf(id)).stage).toBe('DOCUMENTS_COLLECTION');
  });

  it('records the reason on the record and in the activity log', async () => {
    const { id } = await seedRecord('DOCUMENTS_COLLECTION');
    const reason = 'Withdrew after one week — accepted another offer';
    const res = await request.post(`/api/onboarding/v2/${id}/cancel`).set(auth(tokHr)).send({ reason });
    expect(res.status).toBe(200);

    const r = await stageOf(id);
    expect(r.stage).toBe('CANCELLED');
    expect(r.status).toBe('Cancelled');
    expect(r.rejection_reason).toBe(reason);

    const [events] = await pool.query(
      "SELECT detail FROM onboarding_events WHERE onboarding_id = ? AND event_type = 'cancelled'", [id]);
    expect(events).toHaveLength(1);
    expect(events[0].detail).toContain(reason);
  });

  it('exits the employee profile the accepted offer created, on the last day worked', async () => {
    // The whole point. Without this the person stays Active on the staff list
    // and keeps turning up in payroll, attendance and the WPS file.
    const [e] = await pool.query('INSERT INTO employees SET ?', {
      company_id: f.company, first_name: 'Test', last_name: tag,
      start_date: '2099-01-05', status: 'Onboarding',
      basic_salary: 3000, full_salary: 3000,
    });
    f.employees.push(e.insertId);
    const { id } = await seedRecord('DOCUMENTS_COLLECTION', [], { employee_id: e.insertId });

    const res = await request.post(`/api/onboarding/v2/${id}/cancel`).set(auth(tokHr))
      .send({ reason: 'Withdrew', last_working_day: '2099-01-12' });
    expect(res.status).toBe(200);
    expect(res.body.employee_exited).toMatchObject({ id: e.insertId, end_date: '2099-01-12' });

    const [[emp]] = await pool.query(
      "SELECT status, DATE_FORMAT(end_date, '%Y-%m-%d') AS end_date FROM employees WHERE id = ?", [e.insertId]);
    expect(emp.status).toBe('Exited');
    // Read back through DATE_FORMAT: a bare DATE off the driver arrives as a JS
    // Date shifted to UTC and reads a day early west of Greenwich.
    expect(emp.end_date).toBe('2099-01-12');
  });

  it('falls back to today when no last working day is given', async () => {
    const [e] = await pool.query('INSERT INTO employees SET ?', {
      company_id: f.company, first_name: 'NoDate', last_name: tag,
      start_date: '2099-01-05', status: 'Onboarding',
    });
    const { id } = await seedRecord('BANK_DETAILS', [], { employee_id: e.insertId });
    const res = await request.post(`/api/onboarding/v2/${id}/cancel`).set(auth(tokHr))
      .send({ reason: 'Withdrew' });
    expect(res.status).toBe(200);

    const [[{ today }]] = await pool.query("SELECT DATE_FORMAT(CURDATE(), '%Y-%m-%d') AS today");
    expect(res.body.employee_exited.end_date).toBe(today);
  });

  it('refuses a completed onboarding — that person leaves through Offboarding', async () => {
    const { id } = await seedRecord('COMPLETED', [], { status: 'Completed' });
    const res = await request.post(`/api/onboarding/v2/${id}/cancel`).set(auth(tokHr))
      .send({ reason: 'Resigned' });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/Offboarding/i);
    expect((await stageOf(id)).stage).toBe('COMPLETED');
  });

  it('refuses to cancel twice', async () => {
    const { id } = await seedRecord('VISA_RESIDENCY');
    await request.post(`/api/onboarding/v2/${id}/cancel`).set(auth(tokHr)).send({ reason: 'First' });
    const again = await request.post(`/api/onboarding/v2/${id}/cancel`).set(auth(tokHr)).send({ reason: 'Second' });
    expect(again.status).toBe(409);

    const r = await stageOf(id);
    expect(r.rejection_reason).toBe('First');
  });

  it('is open to admins and HR managers, but not to a recruiter', async () => {
    const a = await seedRecord('DOCUMENTS_COLLECTION');
    expect((await request.post(`/api/onboarding/v2/${a.id}/cancel`).set(auth(tokAdmin))
      .send({ reason: 'By admin' })).status).toBe(200);

    const b = await seedRecord('DOCUMENTS_COLLECTION');
    expect((await request.post(`/api/onboarding/v2/${b.id}/cancel`).set(auth(tokRecruiter))
      .send({ reason: 'By a recruiter' })).status).toBe(403);
    expect((await stageOf(b.id)).stage).toBe('DOCUMENTS_COLLECTION');
  });
});
