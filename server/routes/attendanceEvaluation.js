/**
 * The attendance evaluator's output: run it, read what it thought, compare it
 * against what is stored.
 *
 * Phase 2 of docs/attendance_schedules_and_exceptions_plan.md — SHADOW MODE.
 * Every route here is read-only with respect to attendance: the evaluator writes
 * to `eval_*` columns and `attendance_exceptions`, and never to `status`,
 * `late_minutes` or `early_leave_minutes`. No figure payroll reads can move.
 */
import { Router } from 'express';
import pool from '../config/db.js';
import { auth } from '../middleware/auth.js';
import { requireModule, MODULES } from '../config/permissions.js';
import { authorize } from '../middleware/rbac.js';
import { addAudit } from '../services/auditService.js';
import { tenantScope, companyClause } from '../middleware/tenant.js';
import { runEvaluation } from '../services/attendanceEvaluationRunner.js';
import { EXCEPTION_TYPES, EXCEPTION_STATUSES, OPEN_STATUSES } from '../config/attendanceExceptions.js';

const router = Router();
router.use(auth, tenantScope, requireModule(MODULES.HR));

const isDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ''));

/** Defaults to the last 30 days, which is the window anyone actually reviews. */
function range(req) {
  const to = isDate(req.query.to) ? req.query.to : new Date().toISOString().slice(0, 10);
  let from = req.query.from;
  if (!isDate(from)) {
    const d = new Date(`${to}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - 30);
    from = d.toISOString().slice(0, 10);
  }
  return { from, to };
}

// POST /api/attendance-evaluation/run
router.post('/run', authorize('admin', 'hr_manager'), async (req, res) => {
  try {
    const from = isDate(req.body.from) ? req.body.from : null;
    const to = isDate(req.body.to) ? req.body.to : null;
    if (!from || !to) return res.status(400).json({ error: 'A valid from and to date (YYYY-MM-DD) are required' });
    if (from > to) return res.status(400).json({ error: 'The start date is after the end date' });

    // The runner does one round trip per employee-day. A quarter is about two
    // thousand of them and takes minutes — long enough that a wider range would
    // hit the request timeout and look like a failure while still running.
    // Longer replays belong on the command line.
    const days = Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1;
    if (days > 92) {
      return res.status(422).json({ error: `That range is ${days} days. Evaluate at most 92 days at a time.` });
    }

    const result = await runEvaluation({
      from, to,
      companyId: req.companyId ?? null,
      trigger: 'Manual',
      userId: req.user.id,
      shadow: true,
    });
    await addAudit(pool, req.user, 'Attendance', 'Evaluated',
      `Shadow evaluation ${from} → ${to}: ${result.days_evaluated} day(s), `
      + `${result.exceptions_opened} new exception(s), ${result.disagreements} disagreement(s)`);
    res.json(result);
  } catch (err) {
    console.error('POST /attendance-evaluation/run error:', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// GET /api/attendance-evaluation/runs
router.get('/runs', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT r.id, r.company_id, DATE_FORMAT(r.date_from, '%Y-%m-%d') date_from,
              DATE_FORMAT(r.date_to, '%Y-%m-%d') date_to, r.trigger_type, r.shadow,
              r.days_evaluated, r.rows_updated, r.exceptions_opened, r.exceptions_updated,
              r.exceptions_closed, r.disagreements, r.summary, r.error,
              r.started_at, r.finished_at, u.name AS started_by_name
         FROM attendance_evaluation_runs r
         LEFT JOIN users u ON u.id = r.started_by
        ORDER BY r.started_at DESC LIMIT 20`);
    res.json(rows);
  } catch (err) {
    console.error('GET /attendance-evaluation/runs error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/attendance-evaluation/summary — the headline numbers for the page
router.get('/summary', async (req, res) => {
  try {
    const { from, to } = range(req);
    const co = companyClause(req, 'x.company_id');

    const [byType] = await pool.query(
      `SELECT x.type, x.severity, x.status, COUNT(*) n
         FROM attendance_exceptions x
        WHERE x.work_date BETWEEN ? AND ?` + co.clause + ' GROUP BY x.type, x.severity, x.status',
      [from, to, ...co.params]);

    const coa = companyClause(req, 'a.company_id');
    const [[agreement]] = await pool.query(
      `SELECT COUNT(*) evaluated,
              SUM(a.eval_status IS NOT NULL AND a.status IS NOT NULL AND a.eval_status <> a.status) status_differs,
              SUM(a.eval_late_minutes IS NOT NULL AND a.late_minutes IS NOT NULL
                  AND a.eval_late_minutes <> a.late_minutes) late_differs,
              SUM(a.eval_early_leave_minutes IS NOT NULL AND a.early_leave_minutes IS NOT NULL
                  AND a.eval_early_leave_minutes <> a.early_leave_minutes) early_differs
         FROM attendance a
        WHERE a.work_date BETWEEN ? AND ? AND a.evaluated_at IS NOT NULL` + coa.clause,
      [from, to, ...coa.params]);

    // Absences concentrated in a few people are a different story from absences
    // spread thin — usually somebody offboarded whose end date was never entered.
    const [topPeople] = await pool.query(
      `SELECT x.employee_id, CONCAT(e.first_name, ' ', e.last_name) name, e.status AS employee_status,
              DATE_FORMAT(e.end_date, '%Y-%m-%d') end_date, COUNT(*) n,
              SUM(x.type = 'ABSENT_NO_RECORD') absences
         FROM attendance_exceptions x JOIN employees e ON e.id = x.employee_id
        WHERE x.work_date BETWEEN ? AND ?` + co.clause + `
        GROUP BY x.employee_id ORDER BY n DESC LIMIT 15`, [from, to, ...co.params]);

    res.json({
      from, to,
      by_type: byType,
      agreement: {
        evaluated: Number(agreement.evaluated) || 0,
        status_differs: Number(agreement.status_differs) || 0,
        late_differs: Number(agreement.late_differs) || 0,
        early_differs: Number(agreement.early_differs) || 0,
      },
      top_people: topPeople,
      open_statuses: OPEN_STATUSES,
      types: Object.fromEntries(Object.entries(EXCEPTION_TYPES).map(([k, v]) => [k, v.severity])),
      statuses: EXCEPTION_STATUSES,
    });
  } catch (err) {
    console.error('GET /attendance-evaluation/summary error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/attendance-evaluation/exceptions
router.get('/exceptions', async (req, res) => {
  try {
    const { from, to } = range(req);
    const co = companyClause(req, 'x.company_id');
    const filters = [];
    const params = [from, to, ...co.params];

    if (req.query.type && EXCEPTION_TYPES[req.query.type]) { filters.push('x.type = ?'); params.push(req.query.type); }
    if (req.query.severity) { filters.push('x.severity = ?'); params.push(req.query.severity); }
    if (req.query.status === 'open') {
      filters.push(`x.status IN (${OPEN_STATUSES.map(() => '?').join(',')})`);
      params.push(...OPEN_STATUSES);
    } else if (req.query.status && EXCEPTION_STATUSES.includes(req.query.status)) {
      filters.push('x.status = ?');
      params.push(req.query.status);
    }
    if (req.query.employee_id) { filters.push('x.employee_id = ?'); params.push(Number(req.query.employee_id)); }

    const [rows] = await pool.query(
      `SELECT x.id, x.employee_id, x.company_id, DATE_FORMAT(x.work_date, '%Y-%m-%d') work_date,
              x.type, x.severity, x.detail, x.late_minutes, x.early_leave_minutes,
              x.worked_minutes, x.expected_minutes, x.status, x.resolution, x.shadow,
              x.first_seen_at, x.resolved_at,
              CONCAT(e.first_name, ' ', e.last_name) employee_name, e.status AS employee_status,
              c.name AS company_name,
              TIME_FORMAT(a.check_in, '%H:%i')  check_in,
              TIME_FORMAT(a.check_out, '%H:%i') check_out,
              a.status AS stored_status, a.eval_status,
              a.late_minutes AS stored_late, a.early_leave_minutes AS stored_early,
              u.name AS resolved_by_name
         FROM attendance_exceptions x
         JOIN employees e ON e.id = x.employee_id
         LEFT JOIN companies c ON c.id = x.company_id
         LEFT JOIN attendance a ON a.id = x.attendance_id
         LEFT JOIN users u ON u.id = x.resolved_by
        WHERE x.work_date BETWEEN ? AND ?` + co.clause
        + (filters.length ? ' AND ' + filters.join(' AND ') : '')
        + " ORDER BY FIELD(x.severity,'Blocking','Review','Info'), x.work_date DESC LIMIT 500",
      params);
    res.json(rows);
  } catch (err) {
    console.error('GET /attendance-evaluation/exceptions error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/attendance-evaluation/comparison — every day where the engine and the
// stored record disagree. This is the whole point of shadow mode.
router.get('/comparison', async (req, res) => {
  try {
    const { from, to } = range(req);
    const co = companyClause(req, 'a.company_id');
    const [rows] = await pool.query(
      `SELECT a.id, a.employee_id, DATE_FORMAT(a.work_date, '%Y-%m-%d') work_date,
              CONCAT(e.first_name, ' ', e.last_name) employee_name,
              TIME_FORMAT(a.check_in, '%H:%i')  check_in,
              TIME_FORMAT(a.check_out, '%H:%i') check_out,
              a.status stored_status, a.late_minutes stored_late, a.early_leave_minutes stored_early,
              a.eval_status, a.eval_late_minutes, a.eval_early_leave_minutes, a.eval_worked_minutes,
              TIME_FORMAT(a.expected_in, '%H:%i')  expected_in,
              TIME_FORMAT(a.expected_out, '%H:%i') expected_out,
              a.expected_minutes, a.source, ws.name_en schedule_name
         FROM attendance a
         JOIN employees e ON e.id = a.employee_id
         LEFT JOIN work_schedules ws ON ws.id = a.schedule_id
        WHERE a.work_date BETWEEN ? AND ? AND a.evaluated_at IS NOT NULL` + co.clause + `
          AND ( (a.status IS NOT NULL AND a.eval_status <> a.status)
             OR (a.late_minutes IS NOT NULL AND a.eval_late_minutes IS NOT NULL
                 AND a.eval_late_minutes <> a.late_minutes)
             OR (a.early_leave_minutes IS NOT NULL AND a.eval_early_leave_minutes IS NOT NULL
                 AND a.eval_early_leave_minutes <> a.early_leave_minutes) )
        ORDER BY a.work_date DESC, employee_name LIMIT 500`, [from, to, ...co.params]);
    res.json(rows);
  } catch (err) {
    console.error('GET /attendance-evaluation/comparison error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
