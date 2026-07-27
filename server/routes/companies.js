import { Router } from 'express';
import multer from 'multer';
import fs from 'fs';
import pool from '../config/db.js';
import { auth } from '../middleware/auth.js';
import { authorize } from '../middleware/rbac.js';
import { addAudit } from '../services/auditService.js';
import { tenantScope, companyClause } from '../middleware/tenant.js';
import { validate } from '../middleware/validate.js';
import { ensureUploadDir, uploadPath } from '../config/storage.js';

const router = Router();
router.use(auth, tenantScope);

// Letterhead upload (A4 background for generated documents). Stored on the
// persistent uploads volume so it survives redeploys.
const LH_EXT = { 'application/pdf': 'pdf', 'image/png': 'png', 'image/jpeg': 'jpg' };
const letterheadUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, ensureUploadDir('letterheads')),
    filename: (req, file, cb) => cb(null, `lh_${req.params.id}_${Date.now()}.${LH_EXT[file.mimetype] || 'bin'}`),
  }),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (LH_EXT[file.mimetype]) return cb(null, true);
    cb(new Error('Letterhead must be a PDF, PNG, or JPG'));
  },
});

// GET /api/companies — cross-company roles (and platform admin) see every
// company; a selected entity narrows the list; employees see only their own.
router.get('/', async (req, res) => {
  try {
    const co = companyClause(req, 'id');
    const [rows] = await pool.query(
      'SELECT * FROM companies WHERE deleted_at IS NULL' + co.clause + ' ORDER BY name', co.params
    );
    res.json(rows);
  } catch (err) {
    console.error('GET /companies error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/companies/:id (scoped)
router.get('/:id', async (req, res) => {
  try {
    const co = companyClause(req, 'id');
    const [rows] = await pool.query('SELECT * FROM companies WHERE id = ?' + co.clause, [req.params.id, ...co.params]);
    if (!rows.length) return res.status(404).json({ error: 'Company not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('GET /companies/:id error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/companies — only a platform admin may create new tenants
router.post('/', authorize('admin'), validate({
  name: { required: true, type: 'string', minLen: 1, maxLen: 255 },
  short_code: { required: true, type: 'string', minLen: 1, maxLen: 20 },
  currency: { required: true, type: 'string', minLen: 1, maxLen: 10 },
  email: { type: 'email' },
}), async (req, res) => {
  if (!req.isPlatformAdmin) return res.status(403).json({ error: 'Only a platform administrator can create companies' });
  try {
    const { name, short_code, currency, address, phone, email, website, industry, crm_platform, color_primary, color_secondary, status } = req.body;

    if (!name || !short_code || !currency) {
      return res.status(400).json({ error: 'Name, short_code, and currency are required' });
    }

    const [result] = await pool.query('INSERT INTO companies SET ?', {
      name, short_code: short_code.toUpperCase(), currency, address, phone, email, website, industry, crm_platform,
      color_primary: color_primary || '#6D28D9',
      color_secondary: color_secondary || '#1D1245',
      status: status || 'Active',
    });

    await addAudit(pool, req.user, 'Companies', 'Created', `Company "${name}" (${short_code}) created`);
    res.status(201).json({ id: result.insertId, name, short_code });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Short code already exists' });
    }
    console.error('POST /companies error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/companies/:id (scoped — company admins may edit only their own)
router.put('/:id', authorize('admin'), async (req, res) => {
  try {
    const co = companyClause(req, 'id');
    const { name, short_code, currency, address, phone, email, website, industry, crm_platform, color_primary, color_secondary, status, logo, salary_review_approver_id } = req.body;

    // Official mail domains, comma-separated. Normalized (lowercased, trimmed,
    // "@" and any scheme stripped) so the employee email builder can match them.
    let email_domains = null;
    if (req.body.email_domains != null && String(req.body.email_domains).trim() !== '') {
      const parts = String(req.body.email_domains).split(',').map((d) => d.trim().toLowerCase().replace(/^@+/, '').replace(/^https?:\/\//, '')).filter(Boolean);
      const bad = parts.find((d) => !/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(d));
      if (bad) return res.status(422).json({ error: `"${bad}" is not a valid email domain` });
      email_domains = [...new Set(parts)].join(',').slice(0, 500);
    }

    // The approver gains real approval authority (see PUT /salary-reviews/:id/decision),
    // so restrict the pick to admin/hr_manager accounts even if called outside the UI.
    if (salary_review_approver_id) {
      const [[approverUser]] = await pool.query('SELECT role FROM users WHERE id = ?', [salary_review_approver_id]);
      if (!approverUser || !['admin', 'hr_manager'].includes(approverUser.role)) {
        return res.status(422).json({ error: 'Salary Review Approver must be an admin or hr_manager user' });
      }
    }

    const [result] = await pool.query(
      'UPDATE companies SET name=?, short_code=?, currency=?, address=?, phone=?, email=?, website=?, email_domains=?, industry=?, crm_platform=?, color_primary=?, color_secondary=?, status=?, logo=?, salary_review_approver_id=? WHERE id=?' + co.clause,
      [name, short_code?.toUpperCase(), currency, address, phone, email, website, email_domains, industry, crm_platform, color_primary, color_secondary, status, logo, salary_review_approver_id || null, req.params.id, ...co.params]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Company not found' });
    await addAudit(pool, req.user, 'Companies', 'Updated', `Company #${req.params.id} updated`);
    res.json({ success: true });
  } catch (err) {
    console.error('PUT /companies/:id error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/companies/:id — soft delete only, platform admin only (DB-001: never hard-cascade a tenant)
router.delete('/:id', authorize('admin'), async (req, res) => {
  try {
    if (!req.isPlatformAdmin) return res.status(403).json({ error: 'Only a platform administrator can archive companies' });
    const [result] = await pool.query('UPDATE companies SET deleted_at = NOW(), status = ? WHERE id = ? AND deleted_at IS NULL', ['Inactive', req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Company not found' });
    await addAudit(pool, req.user, 'Companies', 'Archived', `Company #${req.params.id} archived (soft delete)`);
    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /companies/:id error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ==================== Letterhead (A4 background for documents) ====================

// GET /api/companies/:id/letterhead — stream the stored letterhead file (scoped).
// Any authenticated user in the company may read it (needed to compose documents).
router.get('/:id/letterhead', async (req, res) => {
  try {
    const co = companyClause(req, 'id');
    const [[c]] = await pool.query('SELECT letterhead_path, letterhead_type FROM companies WHERE id = ?' + co.clause, [req.params.id, ...co.params]);
    if (!c || !c.letterhead_path) return res.status(404).json({ error: 'No letterhead set' });
    const filePath = uploadPath('letterheads', c.letterhead_path);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Letterhead file missing on disk' });
    const ct = c.letterhead_type === 'pdf' ? 'application/pdf' : (c.letterhead_type === 'png' ? 'image/png' : 'image/jpeg');
    res.type(ct);
    res.sendFile(filePath);
  } catch (err) {
    console.error('GET /companies/:id/letterhead error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/companies/:id/letterhead — upload/replace the letterhead (admin only, scoped).
router.post('/:id/letterhead', authorize('admin'), letterheadUpload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'A letterhead file is required' });
    const co = companyClause(req, 'id');
    const [[c]] = await pool.query('SELECT letterhead_path FROM companies WHERE id = ?' + co.clause, [req.params.id, ...co.params]);
    if (!c) {
      fs.unlink(req.file.path, () => {});
      return res.status(404).json({ error: 'Company not found' });
    }
    // Remove the previous file if any.
    if (c.letterhead_path) {
      fs.unlink(uploadPath('letterheads', c.letterhead_path), () => {});
    }
    const type = LH_EXT[req.file.mimetype] === 'pdf' ? 'pdf' : (LH_EXT[req.file.mimetype] === 'png' ? 'png' : 'jpg');
    await pool.query('UPDATE companies SET letterhead_path = ?, letterhead_type = ? WHERE id = ?', [req.file.filename, type, req.params.id]);
    await addAudit(pool, req.user, 'Companies', 'Letterhead Updated', `Letterhead set for company #${req.params.id}`);
    res.json({ success: true, type });
  } catch (err) {
    console.error('POST /companies/:id/letterhead error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/companies/:id/letterhead-margins — save the content margins (mm) JSON.
router.put('/:id/letterhead-margins', authorize('admin'), async (req, res) => {
  try {
    const { top, bottom, left, right } = req.body || {};
    const num = (v, d) => { const n = Number(v); return Number.isFinite(n) && n >= 0 && n <= 200 ? n : d; };
    const margins = { top: num(top, 50), bottom: num(bottom, 40), left: num(left, 18), right: num(right, 18) };
    const co = companyClause(req, 'id');
    const [result] = await pool.query('UPDATE companies SET letterhead_margins = ? WHERE id = ?' + co.clause, [JSON.stringify(margins), req.params.id, ...co.params]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Company not found' });
    res.json({ success: true, margins });
  } catch (err) {
    console.error('PUT /companies/:id/letterhead-margins error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/companies/:id/letterhead — remove the letterhead (admin only, scoped).
router.delete('/:id/letterhead', authorize('admin'), async (req, res) => {
  try {
    const co = companyClause(req, 'id');
    const [[c]] = await pool.query('SELECT letterhead_path FROM companies WHERE id = ?' + co.clause, [req.params.id, ...co.params]);
    if (!c) return res.status(404).json({ error: 'Company not found' });
    if (c.letterhead_path) fs.unlink(uploadPath('letterheads', c.letterhead_path), () => {});
    await pool.query('UPDATE companies SET letterhead_path = NULL, letterhead_type = NULL WHERE id = ?', [req.params.id]);
    await addAudit(pool, req.user, 'Companies', 'Letterhead Removed', `Letterhead removed for company #${req.params.id}`);
    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /companies/:id/letterhead error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
