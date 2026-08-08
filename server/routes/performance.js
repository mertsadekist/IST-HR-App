import { Router } from 'express';
import pool from '../config/db.js';
import { auth } from '../middleware/auth.js';
import { requireModule, MODULES } from '../config/permissions.js';
import { authorize } from '../middleware/rbac.js';
import { addAudit } from '../services/auditService.js';
import { tenantScope, companyClause, resolveWriteCompanyId } from '../middleware/tenant.js';
import { validate } from '../middleware/validate.js';

const router = Router();
// Module-gated so reads are refused too, not just writes.
// See config/permissions.js and docs/roles_and_permissions.md.
router.use(auth, tenantScope, requireModule(MODULES.HR));

// GET /api/performance — List performance targets (scoped)
router.get('/', async (req, res) => {
  try {
    const co = companyClause(req, 'pt.company_id');
    let sql = `SELECT pt.*, e.first_name, e.last_name, c.name as company_name, c.short_code, c.color_primary, c.currency as company_currency
               FROM performance_targets pt
               LEFT JOIN employees e ON pt.employee_id = e.id
               LEFT JOIN companies c ON pt.company_id = c.id WHERE 1=1` + co.clause;
    const params = [...co.params];
    if (req.query.status) { sql += ' AND pt.status = ?'; params.push(req.query.status); }
    if (req.query.quarter) { sql += ' AND pt.quarter = ?'; params.push(req.query.quarter); }
    sql += ' ORDER BY pt.created_at DESC';
    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
});

// POST /api/performance
router.post('/', authorize('admin', 'hr_manager'), validate({
  employee_id: { required: true, type: 'integer' },
  target_amount: { type: 'number', min: 0 },
}), async (req, res) => {
  try {
    const { employee_id, quarter, target_amount, currency, kpi_notes } = req.body;
    const company_id = resolveWriteCompanyId(req, req.body.company_id);
    if (!company_id) return res.status(400).json({ error: 'Company is required' });
    // Auto-fill company currency if not provided
    let finalCurrency = currency;
    if (!finalCurrency) {
      const [[comp]] = await pool.query('SELECT currency FROM companies WHERE id = ?', [company_id]);
      finalCurrency = comp?.currency || 'AED';
    }
    const [result] = await pool.query('INSERT INTO performance_targets SET ?', {
      employee_id, company_id, quarter, target_amount, currency: finalCurrency, kpi_notes
    });
    await addAudit(pool, req.user, 'Performance', 'Created', `Target for employee #${employee_id} — Q${quarter}`);
    res.status(201).json({ id: result.insertId });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
});

// PUT /api/performance/:id (company-scoped)
router.put('/:id', authorize('admin', 'hr_manager'), async (req, res) => {
  try {
    const { company_id, ...data } = req.body;
    const co = companyClause(req, 'company_id');
    const [result] = await pool.query('UPDATE performance_targets SET ? WHERE id = ?' + co.clause, [data, req.params.id, ...co.params]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Target not found' });
    res.json({ success: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
});

// PUT /api/performance/:id/sign — Sign/acknowledge target
// Only the target's own employee (matched via users.employee_id) or HR/admin may sign.
router.put('/:id/sign', async (req, res) => {
  try {
    const co = companyClause(req, 'company_id');
    const [[target]] = await pool.query('SELECT id, employee_id FROM performance_targets WHERE id = ?' + co.clause, [req.params.id, ...co.params]);
    if (!target) return res.status(404).json({ error: 'Target not found' });

    const isHR = ['admin', 'hr_manager'].includes(req.user.role);
    if (!isHR) {
      const [[me]] = await pool.query('SELECT employee_id FROM users WHERE id = ?', [req.user.id]);
      if (!me || me.employee_id !== target.employee_id) {
        return res.status(403).json({ error: 'You can only sign your own target' });
      }
    }
    await pool.query('UPDATE performance_targets SET signed_at = NOW() WHERE id = ?', [req.params.id]);
    await addAudit(pool, req.user, 'Performance', 'Signed', `Target #${req.params.id} signed by ${req.user.name}`);
    res.json({ success: true, signed_at: new Date() });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
});

// DELETE /api/performance/:id (company-scoped)
router.delete('/:id', authorize('admin'), async (req, res) => {
  try {
    const co = companyClause(req, 'company_id');
    const [result] = await pool.query('DELETE FROM performance_targets WHERE id = ?' + co.clause, [req.params.id, ...co.params]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Target not found' });
    res.json({ success: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
});

export default router;
