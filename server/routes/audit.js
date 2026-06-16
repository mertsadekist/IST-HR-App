import { Router } from 'express';
import pool from '../config/db.js';
import { auth } from '../middleware/auth.js';
import { tenantScope, companyClause } from '../middleware/tenant.js';

const router = Router();
router.use(auth, tenantScope);

// GET /api/audit?page=1&limit=50&module=X&user_id=X
router.get('/', async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const offset = (page - 1) * limit;

    const co = companyClause(req, 'company_id');
    let sql = 'SELECT * FROM audit_logs WHERE 1=1' + co.clause;
    let countSql = 'SELECT COUNT(*) as total FROM audit_logs WHERE 1=1' + co.clause;
    const params = [...co.params];
    const countParams = [...co.params];

    if (req.query.module) {
      sql += ' AND module = ?'; params.push(req.query.module);
      countSql += ' AND module = ?'; countParams.push(req.query.module);
    }
    if (req.query.user_id) {
      sql += ' AND user_id = ?'; params.push(req.query.user_id);
      countSql += ' AND user_id = ?'; countParams.push(req.query.user_id);
    }
    if (req.query.search) {
      sql += ' AND detail LIKE ?'; params.push(`%${req.query.search}%`);
      countSql += ' AND detail LIKE ?'; countParams.push(`%${req.query.search}%`);
    }

    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const [rows] = await pool.query(sql, params);
    const [countResult] = await pool.query(countSql, countParams);

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

// GET /api/audit/export — Export audit logs as JSON
router.get('/export', async (req, res) => {
  try {
    const co = companyClause(req, 'company_id');
    let sql = 'SELECT * FROM audit_logs WHERE 1=1' + co.clause;
    const params = [...co.params];
    if (req.query.module) { sql += ' AND module = ?'; params.push(req.query.module); }
    if (req.query.user_id) { sql += ' AND user_id = ?'; params.push(req.query.user_id); }
    if (req.query.from) { sql += ' AND created_at >= ?'; params.push(req.query.from); }
    if (req.query.to) { sql += ' AND created_at <= ?'; params.push(req.query.to); }
    sql += ' ORDER BY created_at DESC';
    const [rows] = await pool.query(sql, params);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="audit_export_${new Date().toISOString().split('T')[0]}.json"`);
    res.json({ exported_at: new Date().toISOString(), count: rows.length, logs: rows });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
});

export default router;
