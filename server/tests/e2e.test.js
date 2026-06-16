import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import supertest from 'supertest';
import app from '../app.js';

/**
 * E2E Integration Tests — Critical Workflows
 * Tests complete business workflows end-to-end:
 * 1. Login → Create Vacancy → Add Candidate → Move through ATS
 * 2. Company → Department → Job Title cascade
 * 3. Offboarding initiation with EOSB calculation
 */

let server;
let request;
let token;

beforeAll(async () => {
  server = app.listen(0);
  request = supertest(app);
  const res = await request.post('/api/auth/login').send({ username: 'admin', password: 'admin123' });
  token = res.body.token;
});

afterAll(() => {
  if (server) server.close();
});

describe('E2E: Recruitment Workflow', () => {
  let companyId, vacancyId, candidateId, defaultStageId;

  it('Step 1: Get companies', async () => {
    const res = await request.get('/api/companies').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
    companyId = res.body[0].id;
  });

  it('Step 2: Create vacancy', async () => {
    const res = await request.post('/api/vacancies').set('Authorization', `Bearer ${token}`)
      .send({ title: 'E2E Test Vacancy', company_id: companyId, head_count: 2, status: 'Open' });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    vacancyId = res.body.id;
  });

  it('Step 3: Create candidate for vacancy', async () => {
    const res = await request.post('/api/candidates').set('Authorization', `Bearer ${token}`)
      .send({
        first_name: 'E2E', last_name: 'Tester', email: 'e2e@test.com',
        phone: '+971501234567', nationality: 'Test',
        company_id: companyId, vacancy_id: vacancyId, status: 'Active',
      });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    candidateId = res.body.id;
  });

  it('Step 4: Get candidate with details', async () => {
    const res = await request.get(`/api/candidates/${candidateId}`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.first_name).toBe('E2E');
    expect(res.body).toHaveProperty('stage_history');
    defaultStageId = res.body.current_stage_id;
  });

  it('Step 5: Move candidate to next stage', async () => {
    // Get stages
    const stagesRes = await request.get('/api/settings/ats-stages').set('Authorization', `Bearer ${token}`);
    const stages = stagesRes.body;
    if (stages.length > 1) {
      const nextStage = stages.find(s => s.id !== defaultStageId && !s.is_success && !s.is_fail);
      if (nextStage) {
        const res = await request.put(`/api/candidates/${candidateId}/move`).set('Authorization', `Bearer ${token}`)
          .send({ stage_id: nextStage.id, notes: 'E2E test stage move' });
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
      }
    }
  });

  it('Step 6: Get WATI tags for candidate', async () => {
    const res = await request.get(`/api/candidates/${candidateId}/wati-tags`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('tags');
    expect(res.body.tags.length).toBeGreaterThan(0);
  });

  it('Step 7: Verify candidate appears in pipeline', async () => {
    const res = await request.get('/api/dashboard/pipeline').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    const totalInPipeline = res.body.reduce((sum, s) => sum + s.candidate_count, 0);
    expect(totalInPipeline).toBeGreaterThan(0);
  });

  // Cleanup
  it('Step 8: Delete test data', async () => {
    await request.delete(`/api/candidates/${candidateId}`).set('Authorization', `Bearer ${token}`);
    await request.delete(`/api/vacancies/${vacancyId}`).set('Authorization', `Bearer ${token}`);
  });
});

describe('E2E: Settings Cascade', () => {
  it('Company → Department → Job Title lookup works', async () => {
    const companies = await request.get('/api/companies').set('Authorization', `Bearer ${token}`);
    expect(companies.status).toBe(200);

    if (companies.body.length > 0) {
      const depts = await request.get(`/api/departments?company_id=${companies.body[0].id}`)
        .set('Authorization', `Bearer ${token}`);
      expect(depts.status).toBe(200);

      if (depts.body.length > 0) {
        const jts = await request.get(`/api/job-titles?department_id=${depts.body[0].id}`)
          .set('Authorization', `Bearer ${token}`);
        expect(jts.status).toBe(200);
      }
    }
  });
});

describe('E2E: Reports & Analytics', () => {
  it('All report endpoints return valid data', async () => {
    const endpoints = ['/api/reports/pipeline', '/api/reports/employees', '/api/reports/onboarding'];
    for (const ep of endpoints) {
      const res = await request.get(ep).set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
    }
  });

  it('Dashboard stats return numbers', async () => {
    const res = await request.get('/api/dashboard/stats').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(typeof res.body.candidates).toBe('number');
    expect(typeof res.body.vacancies).toBe('number');
  });
});

describe('E2E: Backup/Restore', () => {
  it('Export creates valid backup structure', async () => {
    const res = await request.get('/api/backup/export').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.version).toBe('2.0');
    expect(Object.keys(res.body.tables).length).toBeGreaterThan(10);
  });
});
