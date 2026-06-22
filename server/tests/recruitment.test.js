/**
 * Recruitment module E2E: publish vacancy → public apply (consent gate, dedupe,
 * duplicate block, UTM) → internal applicant management (stage, interview,
 * evaluation, convert-to-onboarding) → tenant isolation.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import supertest from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../app.js';
import pool from '../config/db.js';

const request = supertest(app);
const tag = `RC${Date.now().toString().slice(-5)}`;
const f = { ids: {} };
const tokenFor = (u) => jwt.sign({ id: u.id, name: u.name, role: u.role, company_id: u.company_id }, process.env.JWT_SECRET, { expiresIn: '1h' });
const auth = (t) => ({ Authorization: `Bearer ${t}` });
let tokHrA, tokHrB;

beforeAll(async () => {
  const [a] = await pool.query('INSERT INTO companies SET ?', { name: `${tag}_A`, short_code: `${tag}A`.slice(0, 10), currency: 'AED', status: 'Active' });
  const [b] = await pool.query('INSERT INTO companies SET ?', { name: `${tag}_B`, short_code: `${tag}B`.slice(0, 10), currency: 'AED', status: 'Active' });
  f.companyA = a.insertId; f.companyB = b.insertId;
  // ensure a default ATS stage exists (global seed normally provides one)
  const [[def]] = await pool.query('SELECT id FROM ats_stages WHERE is_default = TRUE LIMIT 1');
  if (!def) await pool.query("INSERT INTO ats_stages (name,color,text_color,sort_order,is_default) VALUES ('New Applicants','#eee','#333',1,TRUE)");

  const [uHrA] = await pool.query('INSERT INTO users SET ?', { username: `${tag}_hrA`, password_hash: 'x', name: 'HR A', role: 'hr_manager', company_id: f.companyA, is_active: 1, email: `${tag}hra@x.com` });
  const [uHrB] = await pool.query('INSERT INTO users SET ?', { username: `${tag}_hrB`, password_hash: 'x', name: 'HR B', role: 'hr_manager', company_id: f.companyB, is_active: 1 });
  f.ids.uHrA = uHrA.insertId; f.ids.uHrB = uHrB.insertId;
  tokHrA = tokenFor({ id: uHrA.insertId, name: 'HR A', role: 'hr_manager', company_id: f.companyA });
  tokHrB = tokenFor({ id: uHrB.insertId, name: 'HR B', role: 'hr_manager', company_id: f.companyB });

  // vacancy in company A
  const [v] = await pool.query('INSERT INTO vacancies SET ?', {
    title: `${tag} Engineer`, company_id: f.companyA, status: 'Draft', work_location: 'Dubai',
    employment_type: 'Full-time', workplace_type: 'Onsite', description: 'Build things', recruitment_owner: uHrA.insertId,
  });
  f.ids.vacancy = v.insertId;
}, 30000);

afterAll(async () => {
  try {
    await pool.query('DELETE FROM application_events WHERE company_id IN (?,?)', [f.companyA, f.companyB]);
    await pool.query('DELETE FROM candidate_evaluations WHERE company_id IN (?,?)', [f.companyA, f.companyB]);
    await pool.query('DELETE FROM interviews WHERE company_id IN (?,?)', [f.companyA, f.companyB]);
    await pool.query('DELETE FROM application_consents WHERE company_id IN (?,?)', [f.companyA, f.companyB]);
    await pool.query('DELETE FROM application_files WHERE company_id IN (?,?)', [f.companyA, f.companyB]);
    await pool.query('DELETE FROM job_applications WHERE company_id IN (?,?)', [f.companyA, f.companyB]);
    await pool.query('DELETE FROM onboarding_records WHERE company_id IN (?,?)', [f.companyA, f.companyB]);
    await pool.query('DELETE FROM candidates WHERE company_id IN (?,?)', [f.companyA, f.companyB]);
    await pool.query('DELETE FROM vacancies WHERE company_id IN (?,?)', [f.companyA, f.companyB]);
    await pool.query('DELETE FROM users WHERE id IN (?,?)', [f.ids.uHrA, f.ids.uHrB]);
    await pool.query('DELETE FROM email_log WHERE company_id IN (?,?)', [f.companyA, f.companyB]);
    await pool.query('DELETE FROM audit_logs WHERE company_id IN (?,?)', [f.companyA, f.companyB]);
    await pool.query('DELETE FROM companies WHERE id IN (?,?)', [f.companyA, f.companyB]);
  } finally { await pool.end(); }
}, 30000);

describe('Vacancy publishing', () => {
  it('publishes the vacancy and returns a public slug', async () => {
    const res = await request.post(`/api/vacancies/${f.ids.vacancy}/publish`).set(auth(tokHrA)).send({});
    expect(res.status).toBe(200);
    expect(res.body.public_slug).toBeTruthy();
    f.slug = res.body.public_slug;
  });
});

describe('Public application', () => {
  it('serves the public job view (no auth) with company branding', async () => {
    const res = await request.get(`/api/public/jobs/${f.slug}`);
    expect(res.status).toBe(200);
    expect(res.body.company_name).toContain(tag);
    expect(res.body.title).toContain('Engineer');
  });

  it('rejects application without consent (422)', async () => {
    const res = await request.post(`/api/public/jobs/${f.slug}/apply`)
      .field('first_name', 'Lana').field('last_name', 'Ali').field('email', `${tag}cand@x.com`).field('phone', '+971500000000');
    expect(res.status).toBe(422);
  });

  it('accepts a complete application with UTM + consent', async () => {
    const res = await request.post(`/api/public/jobs/${f.slug}/apply`)
      .field('first_name', 'Lana').field('last_name', 'Ali').field('email', `${tag}cand@x.com`)
      .field('phone', '+971500000000').field('consent', 'true')
      .field('utm_source', 'linkedin').field('utm_campaign', 'q3-hiring')
      .attach('cv', Buffer.from('%PDF-1.4 cv'), 'lana-cv.pdf');
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });

  it('blocks a duplicate application to the same vacancy (409)', async () => {
    const res = await request.post(`/api/public/jobs/${f.slug}/apply`)
      .field('first_name', 'Lana').field('last_name', 'Ali').field('email', `${tag}cand@x.com`)
      .field('phone', '+971500000000').field('consent', 'true');
    expect(res.status).toBe(409);
  });
});

describe('Internal applicant management', () => {
  it('lists the application for HR with source captured', async () => {
    const res = await request.get(`/api/applications?vacancy_id=${f.ids.vacancy}`).set(auth(tokHrA));
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
    f.ids.application = res.body[0].id;
    expect(res.body[0].source).toBe('linkedin');
    expect(res.body[0].stage).toBe('New Application');
  });

  it('cross-company HR scoped to its own entity does not see company A’s application', async () => {
    // Single-org model: when HR-B selects its own entity, company A is excluded.
    const res = await request.get(`/api/applications?vacancy_id=${f.ids.vacancy}&company_id=${f.companyB}`).set(auth(tokHrB));
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(0);
    const detail = await request.get(`/api/applications/${f.ids.application}?company_id=${f.companyB}`).set(auth(tokHrB));
    expect(detail.status).toBe(404);
  });

  it('with no entity selected, cross-company HR sees the whole organization', async () => {
    // Single-org model: internal staff span every company when no entity is chosen.
    const res = await request.get(`/api/applications?vacancy_id=${f.ids.vacancy}`).set(auth(tokHrB));
    expect(res.status).toBe(200);
    expect(res.body.some((a) => a.id === f.ids.application)).toBe(true);
  });

  it('moves stage, schedules interview, submits evaluation', async () => {
    const mv = await request.put(`/api/applications/${f.ids.application}/stage`).set(auth(tokHrA)).send({ stage: 'Shortlisted' });
    expect(mv.status).toBe(200);
    const iv = await request.post(`/api/applications/${f.ids.application}/interviews`).set(auth(tokHrA)).send({ type: 'Technical', interviewers: 'Sam', scheduled_at: '2026-09-01 10:00:00' });
    expect(iv.status).toBe(201);
    const ev = await request.post(`/api/applications/${f.ids.application}/evaluations`).set(auth(tokHrA)).send({ overall: 4, skills_match: 5, recommendation: 'Hire', feedback: 'Strong' });
    expect(ev.status).toBe(201);
    const detail = await request.get(`/api/applications/${f.ids.application}`).set(auth(tokHrA));
    expect(detail.body.interviews.length).toBe(1);
    expect(detail.body.evaluations.length).toBe(1);
    expect(detail.body.events.length).toBeGreaterThanOrEqual(3);
  });

  it('source analytics reflects the application', async () => {
    const res = await request.get('/api/applications/stats/sources').set(auth(tokHrA));
    expect(res.status).toBe(200);
    expect(res.body.find((r) => r.source === 'linkedin')?.applications).toBe(1);
  });

  it('converts to onboarding (creates linked onboarding record)', async () => {
    const res = await request.post(`/api/applications/${f.ids.application}/convert`).set(auth(tokHrA)).send({});
    expect(res.status).toBe(201);
    expect(res.body.onboarding_id).toBeTruthy();
    f.ids.onboarding = res.body.onboarding_id;

    // application is now Hired + linked
    const detail = await request.get(`/api/applications/${f.ids.application}`).set(auth(tokHrA));
    expect(detail.body.stage).toBe('Hired');
    expect(detail.body.onboarding_id).toBe(f.ids.onboarding);

    // onboarding record exists with seeded profile
    const [[obp]] = await pool.query('SELECT first_name, profile_verified FROM onboarding_profiles WHERE onboarding_id = ?', [f.ids.onboarding]);
    expect(obp.first_name).toBe('Lana');
    expect(!!obp.profile_verified).toBe(true);

    // converting again is blocked
    const again = await request.post(`/api/applications/${f.ids.application}/convert`).set(auth(tokHrA)).send({});
    expect(again.status).toBe(409);
  });
});
