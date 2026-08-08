import { Router } from 'express';
import pool from '../config/db.js';
import { auth } from '../middleware/auth.js';
import { tenantScope, companyClause } from '../middleware/tenant.js';
import { canAccessModule, MODULES } from '../config/permissions.js';

const router = Router();
router.use(auth, tenantScope);

// The dashboard is the one place recruitment figures reach a role that is
// otherwise blocked from the module. Blanking them here keeps the denial whole
// rather than relying on the page not to draw the card.
const seesRecruitment = (req) => canAccessModule(req.user.role, MODULES.RECRUITMENT);

// GET /api/dashboard/stats — scoped to caller's company (admin: all or ?company_id=X)
router.get('/stats', async (req, res) => {
  try {
    const co = companyClause(req, 'company_id');
    const companyFilter = co.clause;
    const params = co.params;

    const recruitment = seesRecruitment(req);
    const [[candidateCount]] = recruitment ? await pool.query(
      `SELECT COUNT(*) as count FROM candidates WHERE status = 'Active'${companyFilter}`, params
    ) : [[{ count: 0 }]];
    const [[vacancyCount]] = recruitment ? await pool.query(
      `SELECT COUNT(*) as count FROM vacancies WHERE status = 'Open'${companyFilter}`, params
    ) : [[{ count: 0 }]];
    const [[employeeCount]] = await pool.query(
      `SELECT COUNT(*) as count FROM employees WHERE status IN ('Active', 'Onboarding')${companyFilter}`, params
    );
    const [[monthHires]] = await pool.query(
      `SELECT COUNT(*) as count FROM employees WHERE status = 'Active' AND MONTH(start_date) = MONTH(CURDATE()) AND YEAR(start_date) = YEAR(CURDATE())${companyFilter}`, params
    );

    res.json({
      candidates: candidateCount.count,
      vacancies: vacancyCount.count,
      employees: employeeCount.count,
      monthHires: monthHires.count,
      recruitment, // lets the page drop the two cards instead of showing zeros
    });
  } catch (err) {
    console.error('GET /dashboard/stats error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/dashboard/pipeline — scoped to caller's company
router.get('/pipeline', async (req, res) => {
  try {
    if (!seesRecruitment(req)) return res.json([]);
    const co = companyClause(req, 'c.company_id');
    let sql = `SELECT s.id, s.name, s.color, s.text_color, s.sort_order,
               COUNT(c.id) as candidate_count
               FROM ats_stages s
               LEFT JOIN candidates c ON c.current_stage_id = s.id AND c.status = 'Active'` + co.clause;
    const params = [...co.params];
    sql += ' GROUP BY s.id ORDER BY s.sort_order';
    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error('GET /dashboard/pipeline error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/dashboard/recent-activity?limit=10 — scoped to caller's company
router.get('/recent-activity', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 10, 50);
    const co = companyClause(req, 'company_id');
    const [rows] = await pool.query(
      'SELECT * FROM audit_logs WHERE 1=1' + co.clause + ' ORDER BY created_at DESC LIMIT ?',
      [...co.params, limit]
    );
    res.json(rows);
  } catch (err) {
    console.error('GET /dashboard/recent-activity error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/dashboard/hires-by-month?months=6 — scoped to caller's company
router.get('/hires-by-month', async (req, res) => {
  try {
    const months = parseInt(req.query.months) || 6;
    const co = companyClause(req, 'company_id');
    const [rows] = await pool.query(`
      SELECT DATE_FORMAT(start_date, '%Y-%m') as month,
             COUNT(*) as count
      FROM employees
      WHERE start_date >= DATE_SUB(CURDATE(), INTERVAL ? MONTH)` + co.clause + `
      GROUP BY DATE_FORMAT(start_date, '%Y-%m')
      ORDER BY month
    `, [months, ...co.params]);
    res.json(rows);
  } catch (err) {
    console.error('GET /dashboard/hires-by-month error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
