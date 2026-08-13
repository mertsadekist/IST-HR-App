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
import { runEvaluation, shadowProgress } from '../services/attendanceEvaluationRunner.js';
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
      shadow: await shadowProgress(),
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

// ─────────────────────── resolving a case ───────────────────────

/**
 * How much of a day a case costs.
 *
 * A full-day absence is one day. Everything else is the minutes lost against the
 * length of that day, so a 74-minute late arrival on an eight-hour day is 0.15
 * and costs about fifteen dirhams rather than the hundred a whole day would.
 * Rounded to two places because leave_requests.days is DECIMAL(6,2), and floored
 * at 0.01 so a one-minute case cannot round away to nothing.
 */
export function daysForException(exc) {
  if (exc.type === 'ABSENT_NO_RECORD' || exc.type === 'IMPLAUSIBLE_PUNCH') return 1;
  const expected = Number(exc.expected_minutes) || 0;
  const lost = (Number(exc.late_minutes) || 0) + (Number(exc.early_leave_minutes) || 0)
    || Math.max(0, expected - (Number(exc.worked_minutes) || 0));
  if (!expected || !lost) return 1;
  return Math.min(1, Math.max(0.01, Math.round((lost / expected) * 100) / 100));
}

// POST /api/attendance-evaluation/exceptions/:id/leave
//
// Records why a case happened, as a leave of the type HR chooses. The type is
// what decides whether it costs anything — paid types deduct nothing, unpaid
// ones deduct their fraction of a day through the normal payroll path. Creating
// the leave, closing the case and re-judging the day all happen together, so HR
// does one thing and the queue clears itself.
router.post('/exceptions/:id(\\d+)/leave', authorize('admin', 'hr_manager'), async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const co = companyClause(req, 'x.company_id');
    const [[exc]] = await pool.query(
      `SELECT x.*, DATE_FORMAT(x.work_date, '%Y-%m-%d') work_date_s
         FROM attendance_exceptions x WHERE x.id = ?` + co.clause, [req.params.id, ...co.params]);
    if (!exc) return res.status(404).json({ error: 'Case not found' });
    if (exc.leave_request_id) return res.status(409).json({ error: 'This case already has a leave record against it' });

    const leaveTypeId = Number(req.body.leave_type_id);
    if (!leaveTypeId) return res.status(400).json({ error: 'Choose a reason' });
    const [[type]] = await pool.query(
      'SELECT id, name, is_paid FROM leave_types WHERE id = ? AND (company_id IS NULL OR company_id = ?)',
      [leaveTypeId, exc.company_id]);
    if (!type) return res.status(404).json({ error: 'That reason is not available for this company' });

    // HR may override the computed share — a policy may treat any late arrival
    // as half a day regardless of the minutes.
    const days = req.body.days != null
      ? Math.min(1, Math.max(0.01, Number(req.body.days)))
      : daysForException(exc);
    if (!Number.isFinite(days)) return res.status(400).json({ error: 'Invalid day count' });

    await conn.beginTransaction();
    const [lv] = await conn.query('INSERT INTO leave_requests SET ?', {
      company_id: exc.company_id, employee_id: exc.employee_id, leave_type_id: type.id,
      start_date: exc.work_date_s, end_date: exc.work_date_s, days,
      reason: (req.body.reason || '').trim()
        || `${String(exc.type).replace(/_/g, ' ').toLowerCase()} on ${exc.work_date_s}`,
      status: 'Approved', decided_by: req.user.id, decided_at: new Date(),
      approver_name: (req.body.approver_name || req.user.name || '').slice(0, 200),
      created_by: req.user.id,
    });

    const minutes = (Number(exc.late_minutes) || 0) + (Number(exc.early_leave_minutes) || 0);
    await conn.query(
      `UPDATE attendance_exceptions
          SET leave_request_id = ?, excused_minutes = ?, status = 'Resolved',
              resolution = ?, resolved_by = ?, resolved_at = NOW()
        WHERE id = ?`,
      [lv.insertId, minutes || null,
        `${type.name} (${type.is_paid ? 'paid' : 'unpaid'}) — ${days} day`
        + (req.body.reason ? `: ${String(req.body.reason).trim().slice(0, 400)}` : ''),
        req.user.id, exc.id]);
    await conn.commit();

    await addAudit(pool, req.user, 'Attendance', 'Case Resolved',
      `${exc.type} on ${exc.work_date_s} for employee #${exc.employee_id} recorded as `
      + `${type.name} (${type.is_paid ? 'paid' : 'unpaid'}), ${days} day`);

    // A full day of leave changes the verdict for the day; a partial one does
    // not, and must not. Either way the case stays Resolved — the re-run only
    // reopens cases it had auto-closed itself.
    try {
      await runEvaluation({
        from: exc.work_date_s, to: exc.work_date_s,
        companyId: exc.company_id, userId: req.user.id, trigger: 'Manual',
      });
    } catch (e) {
      console.error('post-resolution re-check failed (the leave record stands):', e.message);
    }

    res.status(201).json({ leave_request_id: lv.insertId, days, paid: !!type.is_paid });
  } catch (err) {
    await conn.rollback().catch(() => {});
    console.error('POST /attendance-evaluation/exceptions/:id/leave error:', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    conn.release();
  }
});

// PUT /api/attendance-evaluation/exceptions/:id — waive or move a case along
// without a leave record behind it.
router.put('/exceptions/:id(\\d+)', authorize('admin', 'hr_manager'), async (req, res) => {
  try {
    if (!EXCEPTION_STATUSES.includes(req.body.status)) {
      return res.status(400).json({ error: 'Unknown status' });
    }
    const closing = ['Resolved', 'Waived'].includes(req.body.status);
    const co = companyClause(req, 'company_id');
    const [r] = await pool.query(
      `UPDATE attendance_exceptions
          SET status = ?, resolution = ?, resolved_by = ?, resolved_at = ${closing ? 'NOW()' : 'NULL'}
        WHERE id = ?` + co.clause,
      [req.body.status, (req.body.resolution || '').slice(0, 600) || null,
        closing ? req.user.id : null, req.params.id, ...co.params]);
    if (!r.affectedRows) return res.status(404).json({ error: 'Case not found' });
    await addAudit(pool, req.user, 'Attendance', 'Case Updated',
      `Case #${req.params.id} set to ${req.body.status}`);
    res.json({ success: true });
  } catch (err) {
    console.error('PUT /attendance-evaluation/exceptions/:id error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/attendance-evaluation/report — one line per employee.
//
// The management view: how many days each person was absent, late or left early
// over the period, how much of it has been explained, and what the explanations
// cost. Absences and unexplained cases lead, because those are the ones that
// still need somebody.
router.get('/report', async (req, res) => {
  try {
    const { from, to } = range(req);
    const co = companyClause(req, 'x.company_id');
    const [rows] = await pool.query(
      // MAX(c.name) rather than a bare c.name: the company comes from a joined
      // table and is not functionally dependent on e.id, so only_full_group_by
      // rejects it — but only when no company filter is applied, because a
      // constant company_id makes MySQL treat it as determined. The bug is
      // therefore invisible to any request that names a company.
      `SELECT e.id AS employee_id, CONCAT(e.first_name, ' ', e.last_name) name,
              e.status AS employee_status, MAX(c.name) AS company_name,
              COUNT(*) total_cases,
              SUM(x.type = 'ABSENT_NO_RECORD') absences,
              SUM(x.type = 'LATE_ARRIVAL') late_arrivals,
              SUM(x.type = 'EARLY_DEPARTURE') early_departures,
              SUM(x.type = 'INSUFFICIENT_HOURS') short_days,
              SUM(x.type IN ('MISSING_PUNCH','IMPLAUSIBLE_PUNCH')) unreadable_days,
              SUM(x.type = 'WORKED_ON_DAY_OFF') worked_days_off,
              COALESCE(SUM(x.late_minutes), 0) late_minutes,
              COALESCE(SUM(x.early_leave_minutes), 0) early_minutes,
              SUM(x.status IN (${OPEN_STATUSES.map(() => '?').join(',')})) still_open,
              SUM(x.leave_request_id IS NOT NULL) explained,
              COALESCE(SUM(CASE WHEN lt.is_paid = 1 THEN lr.days ELSE 0 END), 0) paid_days,
              COALESCE(SUM(CASE WHEN lt.is_paid = 0 THEN lr.days ELSE 0 END), 0) unpaid_days
         FROM attendance_exceptions x
         JOIN employees e ON e.id = x.employee_id
         LEFT JOIN companies c ON c.id = x.company_id
         LEFT JOIN leave_requests lr ON lr.id = x.leave_request_id
         LEFT JOIN leave_types lt ON lt.id = lr.leave_type_id
        WHERE x.work_date BETWEEN ? AND ?` + co.clause + `
        GROUP BY e.id
        ORDER BY still_open DESC, absences DESC, total_cases DESC`,
      [...OPEN_STATUSES, from, to, ...co.params]);
    res.json({ from, to, rows });
  } catch (err) {
    console.error('GET /attendance-evaluation/report error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/attendance-evaluation/reasons — the leave types offered as reasons,
// with whether each one costs the employee anything.
router.get('/reasons', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, name, is_paid, paid_mode FROM leave_types
        WHERE company_id IS NULL OR company_id = ? ORDER BY is_paid DESC, name`,
      [req.companyId || 0]);
    res.json(rows);
  } catch (err) {
    console.error('GET /attendance-evaluation/reasons error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
