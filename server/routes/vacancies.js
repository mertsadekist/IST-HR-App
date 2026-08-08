import { Router } from 'express';
import pool from '../config/db.js';
import { auth } from '../middleware/auth.js';
import { authorize } from '../middleware/rbac.js';
import { requireModule, MODULES } from '../config/permissions.js';
import { addAudit } from '../services/auditService.js';
import { tenantScope, companyClause, resolveWriteCompanyId } from '../middleware/tenant.js';
import { validate } from '../middleware/validate.js';

const router = Router();
// Recruitment is a module the accountant role has no access to at all, reads
// included — see config/permissions.js. Mounted here rather than per-route so a
// new endpoint in this file cannot forget it.
router.use(auth, tenantScope, requireModule(MODULES.RECRUITMENT));

// GET /api/vacancies?status=X&page=1&limit=20 (scoped to caller's company)
router.get('/', async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const offset = (page - 1) * limit;

    const co = companyClause(req, 'v.company_id');
    const coCount = companyClause(req, 'company_id');
    let sql = `SELECT v.*, c.name as company_name, c.short_code, c.color_primary,
               d.name as department_name, jt.title as job_title_name,
               (SELECT COUNT(*) FROM candidates WHERE vacancy_id = v.id) as candidate_count
               FROM vacancies v
               LEFT JOIN companies c ON v.company_id = c.id
               LEFT JOIN departments d ON v.department_id = d.id
               LEFT JOIN job_titles jt ON v.job_title_id = jt.id
               WHERE 1=1` + co.clause;
    let countSql = 'SELECT COUNT(*) as total FROM vacancies WHERE 1=1' + coCount.clause;
    const params = [...co.params];
    const countParams = [...coCount.params];

    if (req.query.status) {
      sql += ' AND v.status = ?'; params.push(req.query.status);
      countSql += ' AND status = ?'; countParams.push(req.query.status);
    }
    if (req.query.search) {
      sql += ' AND v.title LIKE ?'; params.push(`%${req.query.search}%`);
      countSql += ' AND title LIKE ?'; countParams.push(`%${req.query.search}%`);
    }

    sql += ' ORDER BY v.created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const [rows] = await pool.query(sql, params);
    const [[countResult]] = await pool.query(countSql, countParams);

    res.json({
      data: rows,
      total: countResult.total,
      page,
      limit,
      totalPages: Math.ceil(countResult.total / limit),
    });
  } catch (err) {
    console.error('GET /vacancies error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/vacancies/:id (company-scoped)
router.get('/:id', async (req, res) => {
  try {
    const co = companyClause(req, 'v.company_id');
    const [rows] = await pool.query(`
      SELECT v.*, c.name as company_name, c.short_code,
             d.name as department_name, jt.title as job_title_name
      FROM vacancies v
      LEFT JOIN companies c ON v.company_id = c.id
      LEFT JOIN departments d ON v.department_id = d.id
      LEFT JOIN job_titles jt ON v.job_title_id = jt.id
      WHERE v.id = ?` + co.clause, [req.params.id, ...co.params]);
    if (!rows.length) return res.status(404).json({ error: 'Vacancy not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('GET /vacancies/:id error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/vacancies
router.post('/', authorize('admin', 'hr_manager', 'recruiter'), validate({
  title: { required: true, type: 'string', minLen: 1, maxLen: 255 },
  // Matches the DB enum / lifecycle: Draft → Published → Paused/Closed/Archived.
  // Legacy values (Open, On Hold) are accepted so older rows never fail validation.
  status: { type: 'string', enum: ['Draft', 'Published', 'Paused', 'Closed', 'Archived', 'Open', 'On Hold'] },
}), async (req, res) => {
  try {
    const company_id = resolveWriteCompanyId(req, req.body.company_id);
    if (!company_id) return res.status(400).json({ error: 'Company is required' });
    const data = { ...req.body, company_id, created_by: req.user.id };
    const [result] = await pool.query('INSERT INTO vacancies SET ?', data);
    await addAudit(pool, req.user, 'Vacancies', 'Created', `Vacancy "${data.title}" created`);
    res.status(201).json({ id: result.insertId, ...data });
  } catch (err) {
    console.error('POST /vacancies error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/vacancies/:id (company-scoped; cannot move record to another company)
router.put('/:id', authorize('admin', 'hr_manager', 'recruiter'), async (req, res) => {
  try {
    const { company_id, ...data } = req.body; // never allow re-tenanting
    const co = companyClause(req, 'company_id');
    const [result] = await pool.query('UPDATE vacancies SET ? WHERE id = ?' + co.clause, [data, req.params.id, ...co.params]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Vacancy not found' });
    await addAudit(pool, req.user, 'Vacancies', 'Updated', `Vacancy #${req.params.id} updated`);
    res.json({ success: true });
  } catch (err) {
    console.error('PUT /vacancies/:id error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Generate a URL-safe public slug for a vacancy.
function slugify(s) {
  return String(s || 'job').toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-').slice(0, 80);
}

// POST /api/vacancies/:id/publish — generate public slug + set Published
router.post('/:id/publish', authorize('admin', 'hr_manager'), async (req, res) => {
  try {
    const co = companyClause(req, 'v.company_id');
    const [[v]] = await pool.query('SELECT v.*, c.short_code FROM vacancies v LEFT JOIN companies c ON v.company_id = c.id WHERE v.id = ?' + co.clause, [req.params.id, ...co.params]);
    if (!v) return res.status(404).json({ error: 'Vacancy not found' });
    // Required fields for publishing
    const missing = [];
    if (!v.title) missing.push('Job title');
    if (!v.work_location) missing.push('Work location');
    if (!v.employment_type) missing.push('Employment type');
    if (!v.workplace_type) missing.push('Workplace type');
    if (!v.description) missing.push('Job description');
    if (missing.length) return res.status(422).json({ error: 'Cannot publish — complete required fields', missing });

    const slug = v.public_slug || `${slugify(v.title)}-${(v.short_code || 'co').toLowerCase()}-${v.id}`;
    await pool.query("UPDATE vacancies SET status = 'Published', public_slug = ?, published_at = COALESCE(published_at, NOW()) WHERE id = ?", [slug, v.id]);
    await addAudit(pool, req.user, 'Vacancies', 'Published', `Vacancy #${v.id} published (slug ${slug})`);
    res.json({ success: true, public_slug: slug });
  } catch (err) { console.error('publish error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

// POST /api/vacancies/:id/:action — pause | close | archive
router.post('/:id/:action(pause|close|archive)', authorize('admin', 'hr_manager'), async (req, res) => {
  try {
    const map = { pause: 'Paused', close: 'Closed', archive: 'Archived' };
    const status = map[req.params.action];
    const co = companyClause(req, 'company_id');
    const [result] = await pool.query('UPDATE vacancies SET status = ?' + (req.params.action === 'close' ? ', closed_at = NOW()' : '') + ' WHERE id = ?' + co.clause, [status, req.params.id, ...co.params]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Vacancy not found' });
    await addAudit(pool, req.user, 'Vacancies', status, `Vacancy #${req.params.id} → ${status}`);
    res.json({ success: true, status });
  } catch (err) { console.error('vacancy action error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

// DELETE /api/vacancies/:id (company-scoped) — admin only (hr_manager cannot delete)
router.delete('/:id', authorize('admin'), async (req, res) => {
  try {
    const co = companyClause(req, 'company_id');
    const [result] = await pool.query('DELETE FROM vacancies WHERE id = ?' + co.clause, [req.params.id, ...co.params]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Vacancy not found' });
    await addAudit(pool, req.user, 'Vacancies', 'Deleted', `Vacancy #${req.params.id} deleted`);
    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /vacancies/:id error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
