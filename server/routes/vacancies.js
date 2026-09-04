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

// A vacancy is only publishable once a candidate could actually read it and
// decide to apply. The same list gates every route that can set Published.
const PUBLISH_REQUIRED = [
  ['title', 'Job title'],
  ['work_location', 'Work location'],
  ['employment_type', 'Employment type'],
  ['workplace_type', 'Workplace type'],
  ['description', 'Job description'],
];

const missingForPublish = (v) => PUBLISH_REQUIRED
  .filter(([field]) => v[field] === null || v[field] === undefined || v[field] === '')
  .map(([, label]) => label);

/** Generate a URL-safe public slug for a vacancy. */
function slugify(s) {
  return String(s || 'job').toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-').slice(0, 80);
}

const slugFor = (v) => `${slugify(v.title)}-${(v.short_code || 'co').toLowerCase()}-${v.id}`;

/**
 * Gives a vacancy its public address the moment it becomes Published.
 *
 * Publishing used to happen in one place — POST /:id/publish — which validated
 * and generated the slug. But `status` is an ordinary field on create and update
 * too, so saving the edit form with the status set to Published produced a
 * vacancy that says Published everywhere in the UI and has no public URL at all.
 * Three of the five published vacancies were in that state, including one HR was
 * trying to send out.
 *
 * Called after any write that could leave a vacancy Published. Idempotent: a
 * vacancy that already has a slug keeps it, so the address never moves under a
 * link somebody has already shared.
 */
async function ensurePublicSlug(vacancyId) {
  const [[v]] = await pool.query(
    'SELECT v.*, c.short_code FROM vacancies v LEFT JOIN companies c ON c.id = v.company_id WHERE v.id = ?',
    [vacancyId]);
  if (!v || v.status !== 'Published' || v.public_slug) return v?.public_slug || null;
  const slug = slugFor(v);
  await pool.query(
    "UPDATE vacancies SET public_slug = ?, published_at = COALESCE(published_at, NOW()) WHERE id = ?",
    [slug, v.id]);
  return slug;
}

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
    // Creating straight into Published is allowed, but only for a vacancy a
    // candidate could actually read — the same bar POST /:id/publish applies.
    if (data.status === 'Published') {
      const missing = missingForPublish(data);
      if (missing.length) {
        return res.status(422).json({ error: 'Cannot publish — complete required fields', missing });
      }
    }
    const [result] = await pool.query('INSERT INTO vacancies SET ?', data);
    const public_slug = await ensurePublicSlug(result.insertId);
    await addAudit(pool, req.user, 'Vacancies', 'Created', `Vacancy "${data.title}" created`);
    res.status(201).json({ id: result.insertId, ...data, public_slug });
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

    // Saving the edit form with the status set to Published is a publish, and is
    // held to the same bar. Checked against the record as it WOULD be after the
    // update, not the body alone — the description may already be on the row and
    // simply not be part of this edit.
    if (data.status === 'Published') {
      const [[current]] = await pool.query(
        'SELECT * FROM vacancies WHERE id = ?' + co.clause, [req.params.id, ...co.params]);
      if (!current) return res.status(404).json({ error: 'Vacancy not found' });
      const missing = missingForPublish({ ...current, ...data });
      if (missing.length) {
        return res.status(422).json({ error: 'Cannot publish — complete required fields', missing });
      }
    }

    const [result] = await pool.query('UPDATE vacancies SET ? WHERE id = ?' + co.clause, [data, req.params.id, ...co.params]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Vacancy not found' });
    const public_slug = await ensurePublicSlug(req.params.id);
    await addAudit(pool, req.user, 'Vacancies', 'Updated', `Vacancy #${req.params.id} updated`);
    res.json({ success: true, public_slug });
  } catch (err) {
    console.error('PUT /vacancies/:id error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/vacancies/:id/publish — generate public slug + set Published
router.post('/:id/publish', authorize('admin', 'hr_manager'), async (req, res) => {
  try {
    const co = companyClause(req, 'v.company_id');
    const [[v]] = await pool.query('SELECT v.*, c.short_code FROM vacancies v LEFT JOIN companies c ON v.company_id = c.id WHERE v.id = ?' + co.clause, [req.params.id, ...co.params]);
    if (!v) return res.status(404).json({ error: 'Vacancy not found' });
    const missing = missingForPublish(v);
    if (missing.length) return res.status(422).json({ error: 'Cannot publish — complete required fields', missing });

    const slug = v.public_slug || slugFor(v);
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
