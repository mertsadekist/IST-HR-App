/**
 * Work schedules, per-employee assignment, and the holiday calendar.
 *
 * Phase 1 of docs/attendance_schedules_and_exceptions_plan.md — the reference
 * data the attendance evaluator will be built on. Nothing here reads or writes
 * the `attendance` table, so nothing on this router can change a recorded day,
 * a status, or anyone's pay.
 *
 * Module-gated on HR and OPERATIONS: the employee file carries the assignment,
 * and the schedule builder lives in Settings.
 */
import { Router } from 'express';
import pool from '../config/db.js';
import { auth } from '../middleware/auth.js';
import { requireModule, MODULES } from '../config/permissions.js';
import { authorize } from '../middleware/rbac.js';
import { addAudit } from '../services/auditService.js';
import { tenantScope, companyClause, resolveWriteCompanyId } from '../middleware/tenant.js';
import { validate } from '../middleware/validate.js';
import {
  listSchedules, getScheduleWithDays, validateScheduleDays,
  resolveEffectiveSchedule, assignmentHistory, expectedNetMinutes,
} from '../services/workScheduleService.js';

const router = Router();
router.use(auth, tenantScope, requireModule(MODULES.HR, MODULES.OPERATIONS));

const isDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ''));

/** The company ids this request may read, or null for all of them. */
function scopedCompanyIds(req) {
  return req.companyId == null ? null : [req.companyId];
}

/** Refuses a schedule that belongs to a company outside the caller's scope. */
async function assertScheduleInScope(req, scheduleId) {
  const co = companyClause(req, 'company_id');
  const [[row]] = await pool.query(
    'SELECT id, company_id FROM work_schedules WHERE id = ?' + co.clause,
    [scheduleId, ...co.params]);
  return row || null;
}

// ─────────────────────────── schedules ───────────────────────────

// GET /api/work-schedules — every schedule in scope, each with its 7 day rows
// and a convenience total of expected weekly minutes.
router.get('/', async (req, res) => {
  try {
    const ids = scopedCompanyIds(req);
    let schedules;
    if (ids) {
      schedules = await listSchedules(ids);
    } else {
      const [all] = await pool.query('SELECT id FROM companies');
      schedules = await listSchedules(all.map((c) => c.id));
    }
    res.json(schedules.map((s) => ({
      ...s,
      weekly_minutes: (s.days || []).reduce((sum, d) => sum + expectedNetMinutes(d), 0),
      working_days: (s.days || []).filter((d) => d.is_working).length,
    })));
  } catch (err) {
    console.error('GET /work-schedules error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/work-schedules/:id
router.get('/:id(\\d+)', async (req, res) => {
  try {
    if (!(await assertScheduleInScope(req, req.params.id))) {
      return res.status(404).json({ error: 'Schedule not found' });
    }
    res.json(await getScheduleWithDays(req.params.id));
  } catch (err) {
    console.error('GET /work-schedules/:id error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/work-schedules
router.post('/', authorize('admin', 'hr_manager'), validate({
  name_en: { required: true, type: 'string', minLen: 1, maxLen: 150 },
}), async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const company_id = resolveWriteCompanyId(req, req.body.company_id);
    if (!company_id) return res.status(400).json({ error: 'Company is required' });

    const { errors, days } = validateScheduleDays(req.body.days);
    if (errors.length) return res.status(422).json({ error: errors.join('; '), errors });

    await conn.beginTransaction();
    // Exactly one default per company. MySQL cannot express that as a partial
    // unique index, so it is enforced here — inside the transaction, so a second
    // request cannot land between the clear and the insert.
    if (req.body.is_default) {
      await conn.query('UPDATE work_schedules SET is_default = FALSE WHERE company_id = ?', [company_id]);
    }
    const [result] = await conn.query('INSERT INTO work_schedules SET ?', {
      company_id,
      name_en: String(req.body.name_en).trim(),
      name_ar: req.body.name_ar ? String(req.body.name_ar).trim() : null,
      timezone: req.body.timezone || 'Asia/Dubai',
      grace_in_minutes: Number(req.body.grace_in_minutes) || 0,
      grace_out_minutes: Number(req.body.grace_out_minutes) || 0,
      late_case_minutes: Number(req.body.late_case_minutes) || 0,
      early_case_minutes: Number(req.body.early_case_minutes) || 0,
      half_day_threshold_pct: Number(req.body.half_day_threshold_pct) || 50,
      is_default: !!req.body.is_default,
      active: req.body.active !== false,
      notes: req.body.notes || null,
      created_by: req.user.id,
    });
    for (const d of days) {
      await conn.query('INSERT INTO work_schedule_days SET ?', { schedule_id: result.insertId, ...d });
    }
    await conn.commit();

    await addAudit(pool, req.user, 'Work Schedules', 'Created', `Schedule "${req.body.name_en}" created`);
    res.status(201).json(await getScheduleWithDays(result.insertId));
  } catch (err) {
    await conn.rollback().catch(() => {});
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'A schedule with that name already exists for this company' });
    console.error('POST /work-schedules error:', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    conn.release();
  }
});

// PUT /api/work-schedules/:id — the day rows are replaced wholesale, which is
// how the editor sends them: seven rows describing the week as it should now be.
router.put('/:id(\\d+)', authorize('admin', 'hr_manager'), async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const existing = await assertScheduleInScope(req, req.params.id);
    if (!existing) return res.status(404).json({ error: 'Schedule not found' });

    let days = null;
    if (req.body.days !== undefined) {
      const checked = validateScheduleDays(req.body.days);
      if (checked.errors.length) return res.status(422).json({ error: checked.errors.join('; '), errors: checked.errors });
      days = checked.days;
    }

    const fields = {};
    for (const k of ['name_en', 'name_ar', 'timezone', 'notes']) {
      if (req.body[k] !== undefined) fields[k] = req.body[k] || null;
    }
    for (const k of ['grace_in_minutes', 'grace_out_minutes', 'late_case_minutes', 'early_case_minutes', 'half_day_threshold_pct']) {
      if (req.body[k] !== undefined) fields[k] = Number(req.body[k]) || 0;
    }
    if (req.body.active !== undefined) fields.active = !!req.body.active;
    if (req.body.is_default !== undefined) fields.is_default = !!req.body.is_default;

    await conn.beginTransaction();
    if (fields.is_default) {
      await conn.query('UPDATE work_schedules SET is_default = FALSE WHERE company_id = ? AND id <> ?',
        [existing.company_id, req.params.id]);
    }
    if (Object.keys(fields).length) {
      await conn.query('UPDATE work_schedules SET ? WHERE id = ?', [fields, req.params.id]);
    }
    if (days) {
      await conn.query('DELETE FROM work_schedule_days WHERE schedule_id = ?', [req.params.id]);
      for (const d of days) {
        await conn.query('INSERT INTO work_schedule_days SET ?', { schedule_id: Number(req.params.id), ...d });
      }
    }
    await conn.commit();

    await addAudit(pool, req.user, 'Work Schedules', 'Updated', `Schedule #${req.params.id} updated`);
    res.json(await getScheduleWithDays(req.params.id));
  } catch (err) {
    await conn.rollback().catch(() => {});
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'A schedule with that name already exists for this company' });
    console.error('PUT /work-schedules/:id error:', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    conn.release();
  }
});

// DELETE /api/work-schedules/:id
router.delete('/:id(\\d+)', authorize('admin'), async (req, res) => {
  try {
    if (!(await assertScheduleInScope(req, req.params.id))) {
      return res.status(404).json({ error: 'Schedule not found' });
    }
    // The FK would cascade the assignments away silently, taking the record of
    // who worked which shift with it. Refuse instead and let HR reassign.
    const [[inUse]] = await pool.query(
      'SELECT COUNT(*) c FROM employee_work_schedules WHERE schedule_id = ?', [req.params.id]);
    if (inUse.c) {
      return res.status(409).json({
        error: `This schedule is assigned to ${inUse.c} employee record(s). Reassign them first, or mark the schedule inactive.`,
      });
    }
    await pool.query('DELETE FROM work_schedules WHERE id = ?', [req.params.id]);
    await addAudit(pool, req.user, 'Work Schedules', 'Deleted', `Schedule #${req.params.id} deleted`);
    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /work-schedules/:id error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─────────────────────────── assignments ───────────────────────────

// GET /api/work-schedules/assignments/:employeeId — full history, newest first
router.get('/assignments/:employeeId(\\d+)', async (req, res) => {
  try {
    const co = companyClause(req, 'company_id');
    const [[emp]] = await pool.query(
      'SELECT id FROM employees WHERE id = ?' + co.clause, [req.params.employeeId, ...co.params]);
    if (!emp) return res.status(404).json({ error: 'Employee not found' });

    const today = new Date().toISOString().slice(0, 10);
    const effective = await resolveEffectiveSchedule(req.params.employeeId, today);
    res.json({
      history: await assignmentHistory(req.params.employeeId),
      // What today would actually be judged against, and whether that comes from
      // an explicit assignment or the company default.
      effective: effective && {
        schedule_id: effective.schedule.id,
        name_en: effective.schedule.name_en,
        name_ar: effective.schedule.name_ar,
        source: effective.source,
        today: effective.dayRule,
      },
    });
  } catch (err) {
    console.error('GET /work-schedules/assignments error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/work-schedules/assignments — put an employee on a schedule from a date
router.post('/assignments', authorize('admin', 'hr_manager'), async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { employee_id, schedule_id, effective_from, note } = req.body;
    if (!employee_id || !schedule_id) return res.status(400).json({ error: 'Employee and schedule are required' });
    if (!isDate(effective_from)) return res.status(400).json({ error: 'A valid effective-from date (YYYY-MM-DD) is required' });

    const co = companyClause(req, 'company_id');
    const [[emp]] = await pool.query(
      'SELECT id, company_id FROM employees WHERE id = ?' + co.clause, [employee_id, ...co.params]);
    if (!emp) return res.status(404).json({ error: 'Employee not found' });

    const schedule = await assertScheduleInScope(req, schedule_id);
    if (!schedule) return res.status(404).json({ error: 'Schedule not found' });
    // A schedule belongs to a company, and so does its working week. Assigning
    // across companies would judge somebody against a Saturday they do not work.
    if (Number(schedule.company_id) !== Number(emp.company_id)) {
      return res.status(422).json({ error: "That schedule belongs to a different company than the employee's record" });
    }

    await conn.beginTransaction();
    // Close whatever was open, the day before the new one starts. Without this
    // the previous assignment runs forever and the resolver has to guess.
    await conn.query(
      `UPDATE employee_work_schedules
          SET effective_to = DATE_SUB(?, INTERVAL 1 DAY)
        WHERE employee_id = ? AND effective_to IS NULL AND effective_from < ?`,
      [effective_from, employee_id, effective_from]);
    const [result] = await conn.query('INSERT INTO employee_work_schedules SET ?', {
      employee_id, schedule_id, company_id: emp.company_id,
      effective_from, effective_to: null,
      note: note || null, assigned_by: req.user.id,
    });
    await conn.commit();

    await addAudit(pool, req.user, 'Work Schedules', 'Assigned',
      `Employee #${employee_id} assigned to schedule #${schedule_id} from ${effective_from}`);
    res.status(201).json({ id: result.insertId });
  } catch (err) {
    await conn.rollback().catch(() => {});
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'That employee already has an assignment starting on this date' });
    }
    console.error('POST /work-schedules/assignments error:', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    conn.release();
  }
});

// DELETE /api/work-schedules/assignments/:id — undo a mistaken assignment
router.delete('/assignments/:id(\\d+)', authorize('admin', 'hr_manager'), async (req, res) => {
  try {
    const co = companyClause(req, 'company_id');
    const [result] = await pool.query(
      'DELETE FROM employee_work_schedules WHERE id = ?' + co.clause, [req.params.id, ...co.params]);
    if (!result.affectedRows) return res.status(404).json({ error: 'Assignment not found' });
    await addAudit(pool, req.user, 'Work Schedules', 'Unassigned', `Schedule assignment #${req.params.id} removed`);
    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /work-schedules/assignments/:id error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/work-schedules/coverage — who has no explicit assignment yet.
// The queue HR works through after Phase 1 ships.
router.get('/coverage', async (req, res) => {
  try {
    const co = companyClause(req, 'e.company_id');
    const [rows] = await pool.query(
      `SELECT e.id, e.first_name, e.last_name, e.attendance_id, e.company_id, c.name AS company_name,
              ws.id AS schedule_id, ws.name_en AS schedule_name, ws.name_ar AS schedule_name_ar,
              DATE_FORMAT(ews.effective_from, '%Y-%m-%d') effective_from,
              def.name_en AS default_schedule_name
         FROM employees e
         LEFT JOIN companies c ON c.id = e.company_id
         LEFT JOIN employee_work_schedules ews
                ON ews.id = (SELECT x.id FROM employee_work_schedules x
                              WHERE x.employee_id = e.id AND x.effective_from <= CURDATE()
                                AND (x.effective_to IS NULL OR x.effective_to >= CURDATE())
                              ORDER BY x.effective_from DESC LIMIT 1)
         LEFT JOIN work_schedules ws ON ws.id = ews.schedule_id
         LEFT JOIN work_schedules def ON def.company_id = e.company_id AND def.is_default = TRUE AND def.active = TRUE
        WHERE e.status IN ('Active','Onboarding')` + co.clause + `
        ORDER BY (ws.id IS NOT NULL), c.name, e.first_name`,
      co.params);
    res.json(rows);
  } catch (err) {
    console.error('GET /work-schedules/coverage error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─────────────────────────── holidays ───────────────────────────

// GET /api/work-schedules/holidays?year=2026
router.get('/holidays', async (req, res) => {
  try {
    const year = /^\d{4}$/.test(String(req.query.year || '')) ? req.query.year : new Date().getFullYear();
    // A NULL company_id means "every company", so it must survive the scope
    // filter rather than being excluded by it.
    const co = companyClause(req, 'h.company_id');
    const clause = co.clause ? ' AND (h.company_id IS NULL OR h.company_id = ?)' : '';
    const [rows] = await pool.query(
      `SELECT h.id, h.company_id, DATE_FORMAT(h.holiday_date, '%Y-%m-%d') holiday_date,
              h.name_en, h.name_ar, h.is_half_day, h.notes, c.name AS company_name
         FROM holidays h
         LEFT JOIN companies c ON c.id = h.company_id
        WHERE YEAR(h.holiday_date) = ?` + clause + ' ORDER BY h.holiday_date',
      [year, ...co.params]);
    res.json(rows);
  } catch (err) {
    console.error('GET /work-schedules/holidays error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/work-schedules/holidays — company_id omitted means all companies
router.post('/holidays', authorize('admin', 'hr_manager'), validate({
  name_en: { required: true, type: 'string', minLen: 1, maxLen: 150 },
}), async (req, res) => {
  try {
    if (!isDate(req.body.holiday_date)) return res.status(400).json({ error: 'A valid date (YYYY-MM-DD) is required' });
    const companyId = req.body.all_companies ? null : resolveWriteCompanyId(req, req.body.company_id);
    if (!req.body.all_companies && !companyId) {
      return res.status(400).json({ error: 'Choose a company, or mark the holiday as applying to all of them' });
    }

    // MySQL permits many NULLs in a unique index, so uq_holiday_company_date does
    // not stop two identical group-wide holidays. Check explicitly.
    const [[dupe]] = await pool.query(
      'SELECT id FROM holidays WHERE holiday_date = ? AND company_id <=> ?', [req.body.holiday_date, companyId]);
    if (dupe) return res.status(409).json({ error: 'A holiday is already recorded for that date' });

    const [result] = await pool.query('INSERT INTO holidays SET ?', {
      company_id: companyId,
      holiday_date: req.body.holiday_date,
      name_en: String(req.body.name_en).trim(),
      name_ar: req.body.name_ar ? String(req.body.name_ar).trim() : null,
      is_half_day: !!req.body.is_half_day,
      notes: req.body.notes || null,
      created_by: req.user.id,
    });
    await addAudit(pool, req.user, 'Work Schedules', 'Created',
      `Holiday "${req.body.name_en}" on ${req.body.holiday_date}`);
    res.status(201).json({ id: result.insertId });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'A holiday is already recorded for that date' });
    console.error('POST /work-schedules/holidays error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/work-schedules/holidays/:id
router.put('/holidays/:id(\\d+)', authorize('admin', 'hr_manager'), async (req, res) => {
  try {
    const fields = {};
    if (req.body.name_en !== undefined) fields.name_en = String(req.body.name_en).trim();
    if (req.body.name_ar !== undefined) fields.name_ar = req.body.name_ar || null;
    if (req.body.notes !== undefined) fields.notes = req.body.notes || null;
    if (req.body.is_half_day !== undefined) fields.is_half_day = !!req.body.is_half_day;
    if (req.body.holiday_date !== undefined) {
      if (!isDate(req.body.holiday_date)) return res.status(400).json({ error: 'A valid date (YYYY-MM-DD) is required' });
      fields.holiday_date = req.body.holiday_date;
    }
    if (!Object.keys(fields).length) return res.status(400).json({ error: 'Nothing to update' });

    const co = companyClause(req, 'company_id');
    const clause = co.clause ? ' AND (company_id IS NULL OR company_id = ?)' : '';
    const [result] = await pool.query(
      'UPDATE holidays SET ? WHERE id = ?' + clause, [fields, req.params.id, ...co.params]);
    if (!result.affectedRows) return res.status(404).json({ error: 'Holiday not found' });
    await addAudit(pool, req.user, 'Work Schedules', 'Updated', `Holiday #${req.params.id} updated`);
    res.json({ success: true });
  } catch (err) {
    console.error('PUT /work-schedules/holidays/:id error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/work-schedules/holidays/:id
router.delete('/holidays/:id(\\d+)', authorize('admin'), async (req, res) => {
  try {
    const co = companyClause(req, 'company_id');
    const clause = co.clause ? ' AND (company_id IS NULL OR company_id = ?)' : '';
    const [result] = await pool.query('DELETE FROM holidays WHERE id = ?' + clause, [req.params.id, ...co.params]);
    if (!result.affectedRows) return res.status(404).json({ error: 'Holiday not found' });
    await addAudit(pool, req.user, 'Work Schedules', 'Deleted', `Holiday #${req.params.id} deleted`);
    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /work-schedules/holidays/:id error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
