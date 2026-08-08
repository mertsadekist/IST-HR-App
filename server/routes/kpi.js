import { Router } from 'express';
import pool from '../config/db.js';
import { auth } from '../middleware/auth.js';
import { authorize } from '../middleware/rbac.js';
import { addAudit } from '../services/auditService.js';
import { tenantScope, companyClause, resolveWriteCompanyId } from '../middleware/tenant.js';
import { requireModule, MODULES } from '../config/permissions.js';
import { validate } from '../middleware/validate.js';

const router = Router();
// Reports, KPI and the audit trail are the analytics module — reports even
// aggregates the hiring pipeline, so a role denied recruitment cannot be handed
// this router by default. See config/permissions.js.
router.use(auth, tenantScope, requireModule(MODULES.ANALYTICS));

// GET /api/kpi/tiers (global commission tiers — shared config; see audit TEN-010 for per-company plan)
router.get('/tiers', async (req, res) => {
  try { const [rows] = await pool.query('SELECT * FROM kpi_tiers ORDER BY sort_order'); res.json(rows); }
  catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
});

// POST /api/kpi/tiers
router.post('/tiers', authorize('admin'), async (req, res) => {
  try { const [r] = await pool.query('INSERT INTO kpi_tiers SET ?', req.body); res.status(201).json({ id: r.insertId, ...req.body }); }
  catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
});

// GET /api/kpi/targets
router.get('/targets', async (req, res) => {
  try { const [rows] = await pool.query('SELECT * FROM kpi_targets ORDER BY sort_order'); res.json(rows); }
  catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
});

// GET /api/kpi/hires — list with aggregated data (scoped)
router.get('/hires', async (req, res) => {
  try {
    const co = companyClause(req, 'kh.company_id');
    let sql = `SELECT kh.*, c.name as company_name, c.short_code, c.color_primary
               FROM kpi_hires kh LEFT JOIN companies c ON kh.company_id = c.id WHERE 1=1` + co.clause;
    const params = [...co.params];
    if (req.query.status) { sql += ' AND kh.status = ?'; params.push(req.query.status); }
    sql += ' ORDER BY kh.join_date DESC';
    const [rows] = await pool.query(sql, params);

    // Attach tiers for each hire
    for (const hire of rows) {
      const [tiers] = await pool.query(`SELECT kt.* FROM kpi_hire_tiers kht
        JOIN kpi_tiers kt ON kht.kpi_tier_id = kt.id WHERE kht.kpi_hire_id = ?`, [hire.id]);
      hire.tiers = tiers;
      hire.total_commission = tiers.reduce((s, t) => s + Number(t.amount), 0);
    }
    res.json(rows);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
});

// POST /api/kpi/hires — Log a hire
router.post('/hires', authorize('admin', 'hr_manager'), validate({
  employee_name: { required: true, type: 'string', minLen: 1, maxLen: 255 },
  join_date: { type: 'date' },
}), async (req, res) => {
  try {
    const { employee_name, role, join_date, notes, tier_ids } = req.body;
    const company_id = resolveWriteCompanyId(req, req.body.company_id);
    if (!company_id) return res.status(400).json({ error: 'Company is required' });
    const [result] = await pool.query('INSERT INTO kpi_hires SET ?', {
      employee_name, role, company_id, join_date, notes, created_by: req.user.id
    });
    // Assign tiers
    if (tier_ids?.length) {
      const vals = tier_ids.map(tid => [result.insertId, tid]);
      await pool.query('INSERT INTO kpi_hire_tiers (kpi_hire_id, kpi_tier_id) VALUES ?', [vals]);
      const commission = (await pool.query('SELECT SUM(amount) as total FROM kpi_tiers WHERE id IN (?)', [tier_ids]))[0][0].total || 0;
      await pool.query('UPDATE kpi_hires SET commission = ? WHERE id = ?', [commission, result.insertId]);
    }
    await addAudit(pool, req.user, 'KPI', 'Logged Hire', `${employee_name} — ${role}`);
    res.status(201).json({ id: result.insertId });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
});

// PUT /api/kpi/hires/:id/confirm (company-scoped)
router.put('/hires/:id/confirm', authorize('admin'), async (req, res) => {
  try {
    const co = companyClause(req, 'company_id');
    const [result] = await pool.query("UPDATE kpi_hires SET status = 'Confirmed' WHERE id = ?" + co.clause, [req.params.id, ...co.params]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Hire not found' });
    res.json({ success: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
});

// DELETE /api/kpi/hires/:id (company-scoped)
router.delete('/hires/:id', authorize('admin'), async (req, res) => {
  try {
    const co = companyClause(req, 'company_id');
    const [result] = await pool.query('DELETE FROM kpi_hires WHERE id = ?' + co.clause, [req.params.id, ...co.params]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Hire not found' });
    res.json({ success: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
});

// GET /api/kpi/summary — Dashboard aggregations (scoped)
router.get('/summary', async (req, res) => {
  try {
    const co = companyClause(req, 'company_id');
    const coKh = companyClause(req, 'kh.company_id');
    const [[totals]] = await pool.query(`SELECT COUNT(*) as total_hires,
      SUM(CASE WHEN status='Confirmed' THEN 1 ELSE 0 END) as confirmed,
      SUM(CASE WHEN status='Pending' THEN 1 ELSE 0 END) as pending,
      SUM(commission) as total_commission FROM kpi_hires WHERE 1=1` + co.clause, co.params);
    const [byCompany] = await pool.query(`SELECT c.short_code, c.color_primary, COUNT(kh.id) as count, SUM(kh.commission) as commission
      FROM kpi_hires kh JOIN companies c ON kh.company_id = c.id WHERE 1=1${coKh.clause} GROUP BY c.id ORDER BY count DESC`, coKh.params);
    const [byMonth] = await pool.query(`SELECT DATE_FORMAT(join_date, '%Y-%m') as month, COUNT(*) as count
      FROM kpi_hires WHERE 1=1${co.clause} GROUP BY month ORDER BY month DESC LIMIT 12`, co.params);
    res.json({ totals, byCompany, byMonth });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
});

export default router;
