import { Router } from 'express';
import pool from '../config/db.js';
import { auth } from '../middleware/auth.js';
import { tenantScope, companyClause } from '../middleware/tenant.js';

const router = Router();
router.use(auth, tenantScope);

// datetime-local inputs send "YYYY-MM-DDTHH:mm" — normalise to a MySQL datetime.
const normDate = (s) => String(s).replace('T', ' ');

/**
 * Builds the optional WHERE fragment shared by the list, export and count.
 * Supported query params: module (exact), action (exact), user (name LIKE),
 * user_id (exact), search/detail (detail LIKE), from / to (created_at range).
 */
function auditFilters(req) {
  const clauses = [];
  const params = [];
  if (req.query.module) { clauses.push('module = ?'); params.push(req.query.module); }
  if (req.query.action) { clauses.push('action = ?'); params.push(req.query.action); }
  if (req.query.user) { clauses.push('user_name LIKE ?'); params.push(`%${req.query.user}%`); }
  if (req.query.user_id) { clauses.push('user_id = ?'); params.push(req.query.user_id); }
  if (req.query.search) { clauses.push('detail LIKE ?'); params.push(`%${req.query.search}%`); }
  if (req.query.from) { clauses.push('created_at >= ?'); params.push(normDate(req.query.from)); }
  if (req.query.to) { clauses.push('created_at <= ?'); params.push(normDate(req.query.to)); }
  return { clause: clauses.length ? ' AND ' + clauses.join(' AND ') : '', params };
}

// GET /api/audit/facets — distinct modules & actions (company-scoped) for filter dropdowns
router.get('/facets', async (req, res) => {
  try {
    const co = companyClause(req, 'company_id');
    const [mods] = await pool.query(
      'SELECT DISTINCT module FROM audit_logs WHERE 1=1' + co.clause + ' ORDER BY module', co.params
    );
    const [acts] = await pool.query(
      'SELECT DISTINCT action FROM audit_logs WHERE 1=1' + co.clause + ' ORDER BY action', co.params
    );
    res.json({ modules: mods.map((r) => r.module), actions: acts.map((r) => r.action) });
  } catch (err) {
    console.error('GET /audit/facets error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/audit?page=1&limit=50&module=&action=&user=&search=&from=&to=
router.get('/', async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const offset = (page - 1) * limit;

    const co = companyClause(req, 'company_id');
    const f = auditFilters(req);
    const where = ' WHERE 1=1' + co.clause + f.clause;
    const baseParams = [...co.params, ...f.params];

    const [rows] = await pool.query(
      'SELECT * FROM audit_logs' + where + ' ORDER BY created_at DESC LIMIT ? OFFSET ?',
      [...baseParams, limit, offset]
    );
    const [countResult] = await pool.query('SELECT COUNT(*) as total FROM audit_logs' + where, baseParams);

    res.json({
      data: rows,
      total: countResult[0].total,
      page,
      limit,
      totalPages: Math.ceil(countResult[0].total / limit),
    });
  } catch (err) {
    console.error('GET /audit error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/audit/export — Export the (optionally filtered) audit logs as JSON
router.get('/export', async (req, res) => {
  try {
    const co = companyClause(req, 'company_id');
    const f = auditFilters(req);
    const [rows] = await pool.query(
      'SELECT * FROM audit_logs WHERE 1=1' + co.clause + f.clause + ' ORDER BY created_at DESC',
      [...co.params, ...f.params]
    );
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="audit_export_${new Date().toISOString().split('T')[0]}.json"`);
    res.json({ exported_at: new Date().toISOString(), count: rows.length, logs: rows });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
});

export default router;
