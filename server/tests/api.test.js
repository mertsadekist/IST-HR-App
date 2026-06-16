import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import supertest from 'supertest';
import app from '../app.js';

let server;
let request;
let token;

beforeAll(async () => {
  server = app.listen(0); // random port
  request = supertest(app);

  // Login to get token
  const res = await request.post('/api/auth/login').send({ username: 'admin', password: 'admin123' });
  token = res.body.token;
});

afterAll(() => {
  if (server) server.close();
});

describe('Health Check', () => {
  it('GET /api/health should return ok', async () => {
    const res = await request.get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});

describe('Authentication', () => {
  it('POST /api/auth/login with valid credentials', async () => {
    const res = await request.post('/api/auth/login').send({ username: 'admin', password: 'admin123' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body).toHaveProperty('user');
  });

  it('POST /api/auth/login with invalid credentials should fail', async () => {
    const res = await request.post('/api/auth/login').send({ username: 'admin', password: 'wrong' });
    expect(res.status).toBe(401);
  });

  it('GET /api/auth/me with valid token', async () => {
    const res = await request.get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('name');
  });

  it('GET /api/auth/me without token should fail', async () => {
    const res = await request.get('/api/auth/me');
    expect(res.status).toBe(401);
  });
});

describe('Companies API', () => {
  it('GET /api/companies should return array', async () => {
    const res = await request.get('/api/companies').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe('Departments API', () => {
  it('GET /api/departments should return array', async () => {
    const res = await request.get('/api/departments').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe('Candidates API', () => {
  it('GET /api/candidates should return paginated data', async () => {
    const res = await request.get('/api/candidates').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('total');
    expect(res.body).toHaveProperty('totalPages');
  });
});

describe('Vacancies API', () => {
  it('GET /api/vacancies should return paginated data', async () => {
    const res = await request.get('/api/vacancies').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('total');
  });
});

describe('Employees API', () => {
  it('GET /api/employees should return data', async () => {
    const res = await request.get('/api/employees').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });
});

describe('Dashboard API', () => {
  it('GET /api/dashboard/stats should return counts', async () => {
    const res = await request.get('/api/dashboard/stats').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('candidates');
    expect(res.body).toHaveProperty('vacancies');
    expect(res.body).toHaveProperty('employees');
  });

  it('GET /api/dashboard/pipeline should return stages', async () => {
    const res = await request.get('/api/dashboard/pipeline').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe('Settings API', () => {
  it('GET /api/settings/ats-stages should return stages', async () => {
    const res = await request.get('/api/settings/ats-stages').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe('Audit API', () => {
  it('GET /api/audit should return paginated logs', async () => {
    const res = await request.get('/api/audit').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
  });
});

describe('Reports API', () => {
  it('GET /api/reports/pipeline should return data', async () => {
    const res = await request.get('/api/reports/pipeline').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('GET /api/reports/employees should return report', async () => {
    const res = await request.get('/api/reports/employees').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('byStatus');
  });
});

describe('Backup API', () => {
  it('GET /api/backup/export should return JSON backup', async () => {
    const res = await request.get('/api/backup/export').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('version');
    expect(res.body).toHaveProperty('tables');
  });
});
