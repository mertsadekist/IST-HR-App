import { Router } from 'express';
import pool from '../config/db.js';
import { auth } from '../middleware/auth.js';
import { tenantScope, companyClause } from '../middleware/tenant.js';

const router = Router();
router.use(auth, tenantScope);

// GET /api/reports/pipeline — Pipeline report (scoped to caller's company)
router.get('/pipeline', async (req, res) => {
  try {
    const co = companyClause(req, 'c.company_id');
    let sql = `SELECT s.name as stage_name, s.color, s.sort_order, COUNT(c.id) as count
               FROM ats_stages s LEFT JOIN candidates c ON c.current_stage_id = s.id AND c.status = 'Active'` + co.clause;
    const params = [...co.params];
    sql += ' WHERE s.status = ? GROUP BY s.id ORDER BY s.sort_order';
    params.push('Active');
    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
});

// GET /api/reports/journey — Time-to-hire journey report (scoped)
router.get('/journey', async (req, res) => {
  try {
    const co = companyClause(req, 'c.company_id');
    let sql = `SELECT c.id, CONCAT(c.first_name, ' ', c.last_name) as candidate_name,
               v.title as vacancy_title, co.short_code,
               c.created_at as applied_at, c.updated_at,
               TIMESTAMPDIFF(DAY, c.created_at, c.updated_at) as days_in_pipeline,
               s.name as current_stage
               FROM candidates c
               LEFT JOIN vacancies v ON c.vacancy_id = v.id
               LEFT JOIN companies co ON c.company_id = co.id
               LEFT JOIN ats_stages s ON c.current_stage_id = s.id WHERE 1=1` + co.clause;
    const params = [...co.params];
    if (req.query.status) { sql += ' AND c.status = ?'; params.push(req.query.status); }
    sql += ' ORDER BY c.created_at DESC LIMIT 100';
    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
});

// GET /api/reports/employees — Employee status report (scoped to caller's company)
router.get('/employees', async (req, res) => {
  try {
    const e = companyClause(req, 'e.company_id');         // for employees-rooted queries
    const c = companyClause(req, 'c.id');                 // for companies-rooted query
    const [byStatus] = await pool.query(
      `SELECT status, COUNT(*) as count FROM employees e WHERE 1=1${e.clause} GROUP BY status`, e.params);
    const [byCompany] = await pool.query(`SELECT c.short_code, c.name, c.color_primary, COUNT(e.id) as count
      FROM companies c LEFT JOIN employees e ON e.company_id = c.id WHERE 1=1${c.clause} GROUP BY c.id ORDER BY count DESC`, c.params);
    const [byDepartment] = await pool.query(`SELECT d.name as department, c.short_code, COUNT(e.id) as count
      FROM employees e JOIN departments d ON e.department_id = d.id JOIN companies c ON e.company_id = c.id
      WHERE 1=1${e.clause} GROUP BY d.id, d.name, c.short_code ORDER BY count DESC LIMIT 20`, e.params);
    const [recentHires] = await pool.query(`SELECT e.first_name, e.last_name, c.short_code, c.color_primary,
      d.name as department, jt.title as job_title, e.start_date
      FROM employees e LEFT JOIN companies c ON e.company_id = c.id LEFT JOIN departments d ON e.department_id = d.id
      LEFT JOIN job_titles jt ON e.job_title_id = jt.id WHERE 1=1${e.clause} ORDER BY e.start_date DESC LIMIT 10`, e.params);
    res.json({ byStatus, byCompany, byDepartment, recentHires });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
});

// GET /api/reports/onboarding — Onboarding progress report (scoped)
router.get('/onboarding', async (req, res) => {
  try {
    const co = companyClause(req, 'ob.company_id');
    let sql = `SELECT ob.id, e.first_name, e.last_name, c.short_code, c.color_primary,
               ob.status, ob.started_at, ob.completed_at,
               TIMESTAMPDIFF(DAY, ob.started_at, IFNULL(ob.completed_at, NOW())) as duration_days
               FROM onboarding_records ob
               JOIN employees e ON ob.employee_id = e.id
               LEFT JOIN companies c ON ob.company_id = c.id WHERE 1=1` + co.clause;
    const params = [...co.params];
    sql += ' ORDER BY ob.started_at DESC LIMIT 50';
    const [records] = await pool.query(sql, params);

    for (const r of records) {
      const [[cnt]] = await pool.query('SELECT COUNT(*) as total, SUM(status="Complete") as done FROM onboarding_steps WHERE onboarding_id = ?', [r.id]);
      r.total_steps = cnt.total;
      r.completed_steps = cnt.done || 0;
      r.progress = cnt.total > 0 ? Math.round((cnt.done / cnt.total) * 100) : 0;
    }

    const sco = companyClause(req, 'company_id');
    const [[summary]] = await pool.query(`SELECT COUNT(*) as total,
      SUM(status='In Progress') as in_progress, SUM(status='Completed') as completed,
      AVG(CASE WHEN status='Completed' THEN TIMESTAMPDIFF(DAY, started_at, completed_at) END) as avg_days
      FROM onboarding_records WHERE 1=1${sco.clause}`, sco.params);

    res.json({ records, summary });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
});

export default router;
