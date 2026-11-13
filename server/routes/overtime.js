import { Router } from 'express';
import pool from '../config/db.js';
import { auth } from '../middleware/auth.js';
import { authorize } from '../middleware/rbac.js';
import { requireModule, MODULES } from '../config/permissions.js';
import { tenantScope, companyClause } from '../middleware/tenant.js';
import { addAudit } from '../services/auditService.js';
import { getAppSetting } from '../services/appSettings.js';
import { resolveScheduleId, getScheduleWithDays, resolveDayRule, holidaysBetween } from '../services/workScheduleService.js';
import { detectOvertime, overtimePay, effectiveRates } from '../services/overtimeService.js';

// Overtime: detected from attendance or entered by HR, approved or rejected,
// then paid by the payroll run of its month (services/overtimeService.js).
const router = Router();
router.use(auth, tenantScope, requireModule(MODULES.HR));

const PERIOD_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const minutes = (r, approved) => (approved && r.status === 'Approved'
  ? { normal_minutes: r.approved_normal ?? 0, night_minutes: r.approved_night ?? 0, rest_minutes: r.approved_rest ?? 0 }
  : { normal_minutes: r.normal_minutes, night_minutes: r.night_minutes, rest_minutes: r.rest_minutes });

/** A record already taken by a submitted run or a final settlement cannot change. */
async function loadRecord(req, id) {
  const co = companyClause(req, 'o.company_id');
  const [[r]] = await pool.query(
    `SELECT o.*, DATE_FORMAT(o.work_date, '%Y-%m-%d') AS work_date, pr.status AS run_status,
            TRIM(CONCAT(COALESCE(e.first_name, ''), ' ', COALESCE(e.last_name, ''))) AS employee_name
       FROM overtime_records o
       JOIN employees e ON e.id = o.employee_id
       LEFT JOIN payroll_items pi ON pi.id = o.item_id
       LEFT JOIN payroll_runs pr ON pr.id = pi.run_id
      WHERE o.id = ?` + co.clause, [id, ...co.params]);
  if (!r) return null;
  r.locked = (!!r.run_status && r.run_status !== 'Draft') || !!r.settlement_id;
  return r;
}

// GET /api/overtime?period=YYYY-MM&status=
router.get('/', authorize('admin', 'hr_manager', 'accountant'), async (req, res) => {
  try {
    const co = companyClause(req, 'o.company_id');
    const params = [...co.params];
    let where = 'WHERE 1=1' + co.clause;
    if (req.query.period && PERIOD_RE.test(req.query.period)) { where += " AND DATE_FORMAT(o.work_date, '%Y-%m') = ?"; params.push(req.query.period); }
    if (req.query.status) { where += ' AND o.status = ?'; params.push(req.query.status); }
    const [rows] = await pool.query(
      `SELECT o.*, DATE_FORMAT(o.work_date, '%Y-%m-%d') AS work_date, e.basic_salary, pr.status AS run_status,
              TRIM(CONCAT(COALESCE(e.first_name, ''), ' ', COALESCE(e.last_name, ''))) AS employee_name,
              u.name AS decided_by_name
         FROM overtime_records o
         JOIN employees e ON e.id = o.employee_id
         LEFT JOIN payroll_items pi ON pi.id = o.item_id
         LEFT JOIN payroll_runs pr ON pr.id = pi.run_id
         LEFT JOIN users u ON u.id = o.decided_by
        ${where}
        ORDER BY o.work_date DESC, employee_name`, params);
    const rates = effectiveRates(await getAppSetting('overtime_rates'));
    res.json({
      rates,
      rows: rows.map((r) => {
        // What it pays: the stored amount once a run has taken it, else a preview.
        const preview = overtimePay(minutes(r, true), r.basic_salary, rates);
        const { basic_salary: _omit, ...rest } = r;
        return { ...rest, amount: r.item_id && r.amount != null ? Number(r.amount) : preview.amount, explanation: preview.explanation,
          locked: (!!r.run_status && r.run_status !== 'Draft') || !!r.settlement_id };
      }),
    });
  } catch (err) { console.error('GET /overtime error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

// POST /api/overtime/detect { period } — scan the month's attendance and add
// Pending records for days with overtime. Days already recorded are left alone,
// so it can be run again safely; today is never judged (the day is not over).
router.post('/detect', authorize('admin', 'hr_manager'), async (req, res) => {
  try {
    const { period } = req.body || {};
    if (!PERIOD_RE.test(String(period || ''))) return res.status(422).json({ error: 'Choose a month' });
    if (req.companyId == null) return res.status(400).json({ error: 'Select a company first' });
    const from = `${period}-01`;
    const [[{ last }]] = await pool.query("SELECT DATE_FORMAT(LAST_DAY(?), '%Y-%m-%d') AS last", [from]);

    const [rows] = await pool.query(
      `SELECT a.employee_id, DATE_FORMAT(a.work_date, '%Y-%m-%d') AS work_date,
              TIME_FORMAT(a.check_in, '%H:%i:%s') AS check_in, TIME_FORMAT(a.check_out, '%H:%i:%s') AS check_out
         FROM attendance a JOIN employees e ON e.id = a.employee_id
        WHERE a.company_id = ? AND a.work_date BETWEEN ? AND ? AND a.work_date < CURDATE()
          AND a.check_in IS NOT NULL AND a.check_out IS NOT NULL
          AND e.is_owner = FALSE
          AND NOT EXISTS (SELECT 1 FROM overtime_records o WHERE o.employee_id = a.employee_id AND o.work_date = a.work_date)`,
      [req.companyId, from, last]);

    const holidays = new Map((await holidaysBetween(req.companyId, from, last)).map((h) => [h.holiday_date, h]));
    const schedules = new Map();
    let created = 0;
    for (const r of rows) {
      const resolved = await resolveScheduleId(r.employee_id, r.work_date);
      let dayRule = null;
      if (resolved) {
        if (!schedules.has(resolved.schedule_id)) schedules.set(resolved.schedule_id, await getScheduleWithDays(resolved.schedule_id));
        dayRule = resolveDayRule(schedules.get(resolved.schedule_id), r.work_date);
      }
      // No schedule at all: nothing to measure against, so nothing is assumed.
      if (!resolved) continue;
      const holiday = holidays.get(r.work_date);
      const found = detectOvertime({ checkIn: r.check_in, checkOut: r.check_out, dayRule, restDay: !!holiday && !holiday.is_half_day });
      if (!found) continue;
      const [ins] = await pool.query('INSERT IGNORE INTO overtime_records SET ?', {
        company_id: req.companyId, employee_id: r.employee_id, work_date: r.work_date, source: 'Detected',
        check_in: r.check_in, check_out: r.check_out, ...found, created_by: req.user.id,
      });
      created += ins.affectedRows;
    }
    await addAudit(pool, req.user, 'Overtime', 'Detected', `Overtime detection for ${period}: ${created} new day(s) from ${rows.length} attendance row(s)`);
    res.json({ success: true, created, scanned: rows.length });
  } catch (err) { console.error('POST /overtime/detect error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

const cleanMinutes = (b) => {
  const m = {};
  for (const k of ['normal_minutes', 'night_minutes', 'rest_minutes']) {
    const v = Math.round(Number(b?.[k] || 0));
    if (!Number.isFinite(v) || v < 0 || v > 24 * 60) return null;
    m[k] = v;
  }
  return m;
};

// POST /api/overtime — entered by HR (work outside the door system, a site visit…)
router.post('/', authorize('admin', 'hr_manager'), async (req, res) => {
  try {
    const { employee_id, work_date, reason } = req.body || {};
    if (!DATE_RE.test(String(work_date || ''))) return res.status(422).json({ error: 'Choose the date' });
    const m = cleanMinutes(req.body);
    if (!m || !(m.normal_minutes + m.night_minutes + m.rest_minutes > 0)) return res.status(422).json({ error: 'Enter the overtime minutes' });
    if (!String(reason || '').trim()) return res.status(422).json({ error: 'A reason is required' });
    const co = companyClause(req, 'company_id');
    const [[emp]] = await pool.query('SELECT id, company_id, first_name, last_name FROM employees WHERE id = ?' + co.clause, [employee_id, ...co.params]);
    if (!emp) return res.status(404).json({ error: 'Employee not found' });
    const [[exists]] = await pool.query('SELECT id FROM overtime_records WHERE employee_id = ? AND work_date = ?', [emp.id, work_date]);
    if (exists) return res.status(409).json({ error: 'There is already an overtime record for that day; edit it instead' });
    await pool.query('INSERT INTO overtime_records SET ?', {
      company_id: emp.company_id, employee_id: emp.id, work_date, source: 'Manual', ...m,
      reason: String(reason).trim().slice(0, 500), created_by: req.user.id,
    });
    await addAudit(pool, req.user, 'Overtime', 'Added', `Overtime on ${work_date} for ${emp.first_name} ${emp.last_name}: ${reason}`);
    res.status(201).json({ success: true });
  } catch (err) { console.error('POST /overtime error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

// PUT /api/overtime/:id/approve { normal_minutes?, night_minutes?, rest_minutes?, note? }
// Approving fewer minutes than were found is normal: the approver knows whether
// the evening was work.
router.put('/:id/approve', authorize('admin', 'hr_manager'), async (req, res) => {
  try {
    const r = await loadRecord(req, req.params.id);
    if (!r) return res.status(404).json({ error: 'Not found' });
    if (r.locked) return res.status(409).json({ error: 'Already paid by a payroll run or settlement' });
    const given = req.body && ['normal_minutes', 'night_minutes', 'rest_minutes'].some((k) => req.body[k] !== undefined);
    const m = given ? cleanMinutes(req.body) : { normal_minutes: r.normal_minutes, night_minutes: r.night_minutes, rest_minutes: r.rest_minutes };
    if (!m || !(m.normal_minutes + m.night_minutes + m.rest_minutes > 0)) return res.status(422).json({ error: 'Approve at least one minute, or reject it' });
    await pool.query(
      `UPDATE overtime_records SET status = 'Approved', approved_normal = ?, approved_night = ?, approved_rest = ?,
              decision_note = ?, decided_by = ?, decided_at = NOW() WHERE id = ?`,
      [m.normal_minutes, m.night_minutes, m.rest_minutes, req.body?.note ? String(req.body.note).slice(0, 500) : null, req.user.id, r.id]);
    await addAudit(pool, req.user, 'Overtime', 'Approved',
      `Overtime of ${r.employee_name} on ${r.work_date} approved: ${m.normal_minutes}/${m.night_minutes}/${m.rest_minutes} min (normal/night/rest)`);
    res.json({ success: true, needs_regenerate: r.run_status === 'Draft' });
  } catch (err) { console.error('PUT /overtime/:id/approve error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

router.put('/:id/reject', authorize('admin', 'hr_manager'), async (req, res) => {
  try {
    const r = await loadRecord(req, req.params.id);
    if (!r) return res.status(404).json({ error: 'Not found' });
    if (r.locked) return res.status(409).json({ error: 'Already paid by a payroll run or settlement' });
    await pool.query(
      `UPDATE overtime_records SET status = 'Rejected', approved_normal = NULL, approved_night = NULL, approved_rest = NULL,
              decision_note = ?, decided_by = ?, decided_at = NOW() WHERE id = ?`,
      [req.body?.note ? String(req.body.note).slice(0, 500) : null, req.user.id, r.id]);
    await addAudit(pool, req.user, 'Overtime', 'Rejected', `Overtime of ${r.employee_name} on ${r.work_date} rejected`);
    res.json({ success: true, needs_regenerate: r.run_status === 'Draft' });
  } catch (err) { console.error('PUT /overtime/:id/reject error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

// Admin only, like every delete.
router.delete('/:id', authorize('admin'), async (req, res) => {
  try {
    const r = await loadRecord(req, req.params.id);
    if (!r) return res.status(404).json({ error: 'Not found' });
    if (r.locked) return res.status(409).json({ error: 'Already paid by a payroll run or settlement' });
    await pool.query('DELETE FROM overtime_records WHERE id = ?', [r.id]);
    await addAudit(pool, req.user, 'Overtime', 'Deleted', `Overtime record of ${r.employee_name} on ${r.work_date} deleted`);
    res.json({ success: true, needs_regenerate: r.run_status === 'Draft' });
  } catch (err) { console.error('DELETE /overtime/:id error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

export default router;
