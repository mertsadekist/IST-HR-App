import { Router } from 'express';
import pool from '../config/db.js';
import { auth } from '../middleware/auth.js';
import { authorize } from '../middleware/rbac.js';
import { tenantScope, companyClause, resolveWriteCompanyId } from '../middleware/tenant.js';
import { addAudit } from '../services/auditService.js';
import { validateSchedule, REPORT_KEYS } from '../services/reportScheduleService.js';
import { sendScheduledReport } from '../services/reportScheduler.js';

/**
 * Reports emailed on a schedule (Settings → Scheduled reports). A schedule
 * with no company covers every company the sender can see.
 */
const router = Router();
router.use(auth, tenantScope);
const MANAGE = ['admin', 'hr_manager'];

const load = async (req, id) => {
  const co = companyClause(req, 'company_id');
  // A schedule with no company belongs to the whole group, visible to all managers.
  const [[row]] = await pool.query(
    `SELECT * FROM report_schedules WHERE id = ? AND (company_id IS NULL OR 1=1${co.clause})`, [id, ...co.params]);
  return row || null;
};

router.get('/', authorize(...MANAGE), async (req, res) => {
  try {
    const co = companyClause(req, 'rs.company_id');
    const [rows] = await pool.query(
      `SELECT rs.*, c.name AS company_name, DATE_FORMAT(rs.last_sent_on, '%Y-%m-%d') AS last_sent_on
         FROM report_schedules rs LEFT JOIN companies c ON c.id = rs.company_id
        WHERE (rs.company_id IS NULL OR 1=1${co.clause}) ORDER BY rs.name`, co.params);
    res.json({ schedules: rows, reports: REPORT_KEYS });
  } catch (err) { console.error('GET /report-schedules error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

router.post('/', authorize(...MANAGE), async (req, res) => {
  try {
    const v = validateSchedule(req.body);
    if (v.error) return res.status(422).json({ error: v.error });
    const companyId = req.body.all_companies ? null : resolveWriteCompanyId(req, req.body.company_id);
    const [r] = await pool.query('INSERT INTO report_schedules SET ?', { ...v.data, company_id: companyId, created_by: req.user.id });
    await addAudit(pool, req.user, 'Reports', 'Schedule Created', `"${v.data.name}" (${v.data.report_key}, ${v.data.frequency}) to ${v.data.recipients}`, companyId);
    res.status(201).json({ id: r.insertId });
  } catch (err) { console.error('POST /report-schedules error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

router.put('/:id', authorize(...MANAGE), async (req, res) => {
  try {
    const row = await load(req, req.params.id);
    if (!row) return res.status(404).json({ error: 'Schedule not found' });
    const v = validateSchedule(req.body);
    if (v.error) return res.status(422).json({ error: v.error });
    await pool.query('UPDATE report_schedules SET ? WHERE id = ?', [v.data, row.id]);
    await addAudit(pool, req.user, 'Reports', 'Schedule Updated', `"${v.data.name}" (${v.data.report_key}, ${v.data.frequency}) to ${v.data.recipients}`, row.company_id);
    res.json({ success: true });
  } catch (err) { console.error('PUT /report-schedules/:id error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

// Send it now, to check what the recipients will get. Does not move the schedule.
router.post('/:id/send-now', authorize(...MANAGE), async (req, res) => {
  try {
    const row = await load(req, req.params.id);
    if (!row) return res.status(404).json({ error: 'Schedule not found' });
    const out = await sendScheduledReport(pool, row, { markSent: false, sentBy: req.user.id });
    if (!out.sent) return res.status(502).json({ error: out.error || 'Send failed' });
    res.json(out);
  } catch (err) { console.error('POST /report-schedules/:id/send-now error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

router.delete('/:id', authorize('admin'), async (req, res) => {
  try {
    const row = await load(req, req.params.id);
    if (!row) return res.status(404).json({ error: 'Schedule not found' });
    await pool.query('DELETE FROM report_schedules WHERE id = ?', [row.id]);
    await addAudit(pool, req.user, 'Reports', 'Schedule Deleted', `"${row.name}"`, row.company_id);
    res.json({ success: true });
  } catch (err) { console.error('DELETE /report-schedules/:id error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

export default router;
