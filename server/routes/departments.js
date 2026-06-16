import { Router } from 'express';
import pool from '../config/db.js';
import { auth } from '../middleware/auth.js';
import { authorize } from '../middleware/rbac.js';
import { addAudit } from '../services/auditService.js';
import { tenantScope, companyClause, resolveWriteCompanyId } from '../middleware/tenant.js';
import { validate } from '../middleware/validate.js';

const router = Router();
router.use(auth, tenantScope);

// GET /api/departments (scoped to caller's company)
router.get('/', async (req, res) => {
  try {
    const co = companyClause(req, 'company_id');
    const [rows] = await pool.query('SELECT * FROM departments WHERE 1=1' + co.clause + ' ORDER BY sort_order, name', co.params);
    res.json(rows);
  } catch (err) {
    console.error('GET /departments error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/departments
router.post('/', authorize('admin', 'hr_manager'), validate({
  name: { required: true, type: 'string', minLen: 1, maxLen: 255 },
}), async (req, res) => {
  try {
    const company_id = resolveWriteCompanyId(req, req.body.company_id);
    if (!company_id) return res.status(400).json({ error: 'Company is required' });
    const [result] = await pool.query('INSERT INTO departments SET ?', { ...req.body, company_id });
    await addAudit(pool, req.user, 'Departments', 'Created', `Department "${req.body.name}" created`);
    res.status(201).json({ id: result.insertId, ...req.body, company_id });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Department already exists for this company' });
    console.error('POST /departments error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/departments/:id (scoped)
router.put('/:id', authorize('admin', 'hr_manager'), async (req, res) => {
  try {
    const { company_id, ...data } = req.body;
    const co = companyClause(req, 'company_id');
    const [result] = await pool.query('UPDATE departments SET ? WHERE id = ?' + co.clause, [data, req.params.id, ...co.params]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Department not found' });
    await addAudit(pool, req.user, 'Departments', 'Updated', `Department #${req.params.id} updated`);
    res.json({ success: true });
  } catch (err) {
    console.error('PUT /departments/:id error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/departments/:id (scoped)
router.delete('/:id', authorize('admin'), async (req, res) => {
  try {
    const co = companyClause(req, 'company_id');
    const [result] = await pool.query('DELETE FROM departments WHERE id = ?' + co.clause, [req.params.id, ...co.params]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Department not found' });
    await addAudit(pool, req.user, 'Departments', 'Deleted', `Department #${req.params.id} deleted`);
    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /departments/:id error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
