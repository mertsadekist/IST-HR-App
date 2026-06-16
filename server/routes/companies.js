import { Router } from 'express';
import pool from '../config/db.js';
import { auth } from '../middleware/auth.js';
import { authorize } from '../middleware/rbac.js';
import { addAudit } from '../services/auditService.js';
import { tenantScope, companyClause } from '../middleware/tenant.js';
import { validate } from '../middleware/validate.js';

const router = Router();
router.use(auth, tenantScope);

// GET /api/companies — platform admin sees all; everyone else only their own company
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
    const { name, short_code, currency, address, phone, email, website, industry, crm_platform, color_primary, color_secondary, status, logo } = req.body;
    const [result] = await pool.query(
      'UPDATE companies SET name=?, short_code=?, currency=?, address=?, phone=?, email=?, website=?, industry=?, crm_platform=?, color_primary=?, color_secondary=?, status=?, logo=? WHERE id=?' + co.clause,
      [name, short_code?.toUpperCase(), currency, address, phone, email, website, industry, crm_platform, color_primary, color_secondary, status, logo, req.params.id, ...co.params]
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

export default router;
