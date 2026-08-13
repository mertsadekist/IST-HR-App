/**
 * Running the evaluator over a date range and recording what it thought.
 *
 * Phase 2 of docs/attendance_schedules_and_exceptions_plan.md — SHADOW MODE.
 * The verdict goes into the `eval_*` columns beside the stored values and into
 * `attendance_exceptions`. Nothing here writes `status`, `late_minutes` or
 * `early_leave_minutes`, so no payroll figure can move: payrollService deducts
 * on COUNT(status = 'Absent'), and the engine does not get to touch that until
 * a few weeks of agreement have been seen.
 *
 * Everything is loaded up front and resolved in memory. Twenty-two employees
 * over ninety days is two thousand evaluations, and doing a schedule lookup per
 * day would be two thousand round trips for data that fits in a Map.
 */
import pool from '../config/db.js';
import { listSchedules, resolveDayRule, scheduleSnapshot } from './workScheduleService.js';
import { evaluateDay, eachDate, diffAgainstStored } from './attendanceEvaluator.js';
import { OPEN_STATUSES, EVALUATION_VERSION } from '../config/attendanceExceptions.js';

/**
 * Assignments, company defaults and schedules, arranged so that resolving one
 * employee-day is a Map lookup.
 */
async function loadScheduleIndex(employees, db) {
  const companyIds = [...new Set(employees.map((e) => e.company_id))];
  const schedules = await listSchedules(companyIds, db);
  const byId = new Map(schedules.map((s) => [s.id, s]));

  const defaults = new Map();
  for (const s of schedules) {
    if (s.is_default && s.active) defaults.set(s.company_id, s.id);
  }

  const assignments = new Map();
  if (employees.length) {
    const ids = employees.map((e) => e.id);
    const [rows] = await db.query(
      `SELECT employee_id, schedule_id,
              DATE_FORMAT(effective_from, '%Y-%m-%d') effective_from,
              DATE_FORMAT(effective_to,   '%Y-%m-%d') effective_to
         FROM employee_work_schedules
        WHERE employee_id IN (${ids.map(() => '?').join(',')})
        ORDER BY effective_from DESC`, ids);
    for (const r of rows) {
      if (!assignments.has(r.employee_id)) assignments.set(r.employee_id, []);
      assignments.get(r.employee_id).push(r);
    }
  }

  /** @returns {{schedule: object, source: string}|null} */
  return function resolve(employee, date) {
    const own = assignments.get(employee.id) || [];
    // Sorted newest-first, so the first match is the one in force.
    const hit = own.find((a) => a.effective_from <= date && (!a.effective_to || a.effective_to >= date));
    if (hit && byId.has(hit.schedule_id)) return { schedule: byId.get(hit.schedule_id), source: 'assignment' };
    const def = defaults.get(employee.company_id);
    return def && byId.has(def) ? { schedule: byId.get(def), source: 'company_default' } : null;
  };
}

/** Holidays keyed by date, with group-wide ones (company_id NULL) applying to all. */
async function loadHolidays(from, to, db) {
  const [rows] = await db.query(
    `SELECT company_id, DATE_FORMAT(holiday_date, '%Y-%m-%d') holiday_date, name_en, name_ar, is_half_day
       FROM holidays WHERE holiday_date BETWEEN ? AND ?`, [from, to]);
  const index = new Map();
  for (const h of rows) index.set(`${h.company_id ?? '*'}|${h.holiday_date}`, h);
  return (companyId, date) => index.get(`${companyId}|${date}`) || index.get(`*|${date}`) || null;
}

/** Approved leave, as a per-employee list of ranges. */
async function loadLeave(employees, from, to, db) {
  const index = new Map();
  if (!employees.length) return () => null;
  const ids = employees.map((e) => e.id);
  const [rows] = await db.query(
    `SELECT lr.employee_id,
            DATE_FORMAT(lr.start_date, '%Y-%m-%d') start_date,
            DATE_FORMAT(lr.end_date,   '%Y-%m-%d') end_date,
            lt.name AS leave_type_name
       FROM leave_requests lr
       LEFT JOIN leave_types lt ON lt.id = lr.leave_type_id
      WHERE lr.status = 'Approved'
        AND lr.employee_id IN (${ids.map(() => '?').join(',')})
        AND lr.start_date <= ? AND lr.end_date >= ?`, [...ids, to, from]);
  for (const r of rows) {
    if (!index.has(r.employee_id)) index.set(r.employee_id, []);
    index.get(r.employee_id).push(r);
  }
  return (employeeId, date) =>
    (index.get(employeeId) || []).find((l) => l.start_date <= date && l.end_date >= date) || null;
}

/**
 * @param {object}  opts
 * @param {string}  opts.from        'YYYY-MM-DD'
 * @param {string}  opts.to          'YYYY-MM-DD'
 * @param {number}  [opts.companyId] narrow to one company; omit for all
 * @param {string}  [opts.trigger]   'Manual' | 'Scheduled' | 'Post-Sync'
 * @param {number}  [opts.userId]
 * @param {boolean} [opts.shadow]    true (default) writes nothing authoritative
 */
export async function runEvaluation({
  from, to, companyId = null, trigger = 'Manual', userId = null, shadow = true, db = pool,
} = {}) {
  const dates = eachDate(from, to);
  if (!dates.length) throw new Error('Invalid or empty date range');
  if (!shadow) {
    // Phase 3 turns this on deliberately, after the comparison has been read.
    throw new Error('Live evaluation is not enabled yet — this build only runs in shadow mode');
  }

  const [run] = await db.query('INSERT INTO attendance_evaluation_runs SET ?', {
    company_id: companyId, date_from: from, date_to: to,
    trigger_type: trigger, shadow, started_by: userId,
    evaluation_version: EVALUATION_VERSION,
  });
  const runId = run.insertId;

  const report = {
    days_evaluated: 0, rows_updated: 0,
    exceptions_opened: 0, exceptions_updated: 0, exceptions_closed: 0,
    disagreements: 0,
    by_type: {}, by_status: {}, skipped_no_schedule: 0, sample_disagreements: [],
    // Three "we have no evidence" categories, reported rather than turned into
    // accusations. Each one used to produce absences on the first run.
    days_not_observed: [], untracked_employees: [], dormant_employees: [],
  };

  try {
    const [allEmployees] = await db.query(
      `SELECT id, company_id, first_name, last_name, attendance_id,
              DATE_FORMAT(start_date, '%Y-%m-%d') start_date,
              DATE_FORMAT(end_date,   '%Y-%m-%d') end_date, status
         FROM employees
        WHERE status IN ('Active','Onboarding','Offboarding')
          ${companyId ? 'AND company_id = ?' : ''}`, companyId ? [companyId] : []);

    // Somebody with no device id is not in the fingerprint system at all. Marking
    // them absent every working day says nothing true about them and buries the
    // one fact that matters: they are not being tracked.
    const employees = allEmployees.filter((e) => String(e.attendance_id || '').trim());
    for (const e of allEmployees) {
      if (!String(e.attendance_id || '').trim()) {
        report.untracked_employees.push({ id: e.id, name: `${e.first_name} ${e.last_name}`.trim(), status: e.status });
      }
    }

    const resolveSchedule = await loadScheduleIndex(employees, db);
    const holidayFor = await loadHolidays(from, to, db);
    const leaveFor = await loadLeave(employees, from, to, db);

    const rowIndex = new Map();
    if (employees.length) {
      const ids = employees.map((e) => e.id);
      // TIME_FORMAT and DATE_FORMAT are not cosmetic here. check_in and check_out
      // are DATETIME, and the driver hands back a JS Date shifted into UTC: a
      // punch stored as 11:38 arrives as 07:38Z. Formatting inside MySQL returns
      // the wall clock that was actually recorded, which is the only thing the
      // evaluator may compare a schedule against.
      const [rows] = await db.query(
        `SELECT id, employee_id, DATE_FORMAT(work_date, '%Y-%m-%d') work_date,
                TIME_FORMAT(check_in, '%H:%i:%s')  check_in,
                TIME_FORMAT(check_out, '%H:%i:%s') check_out,
                status, late_minutes, early_leave_minutes, source
           FROM attendance
          WHERE work_date BETWEEN ? AND ?
            AND employee_id IN (${ids.map(() => '?').join(',')})`, [from, to, ...ids]);
      for (const r of rows) rowIndex.set(`${r.employee_id}|${r.work_date}`, r);
    }

    // A date the feed never covered. "Nobody in the company has a row" is the
    // only signal available, and it is a reliable one: the file is one row per
    // employee per day, so a covered day always leaves dozens of rows behind.
    const observedDates = new Set([...rowIndex.values()].map((r) => r.work_date));
    for (const d of dates) if (!observedDates.has(d)) report.days_not_observed.push(d);

    // Somebody with a device id who nonetheless never appears in the whole range
    // has stopped being tracked — almost always an offboarded person whose
    // end_date was never entered. One finding beats one per working day.
    const seenInRange = new Set([...rowIndex.values()].map((r) => r.employee_id));
    const dormant = new Set();
    for (const e of employees) {
      if (!seenInRange.has(e.id)) {
        dormant.add(e.id);
        report.dormant_employees.push({
          id: e.id, name: `${e.first_name} ${e.last_name}`.trim(),
          status: e.status, end_date: e.end_date,
        });
      }
    }

    /** Every (employee, date, type) the engine produced this run. */
    const produced = new Set();

    for (const emp of employees) {
      for (const date of dates) {
        // Nobody is absent before they joined or after they left. Without this
        // every employee collects an ABSENT_NO_RECORD for the whole period
        // preceding their start date.
        if (emp.start_date && date < emp.start_date) continue;
        if (emp.end_date && date > emp.end_date) continue;
        if (dormant.has(emp.id)) continue;

        const row = rowIndex.get(`${emp.id}|${date}`) || null;
        const resolved = resolveSchedule(emp, date);
        const schedule = resolved?.schedule || null;
        const dayRule = schedule ? resolveDayRule(schedule, date) : null;
        if (!schedule) report.skipped_no_schedule++;

        const verdict = evaluateDay({
          date, row, schedule, dayRule,
          holiday: holidayFor(emp.company_id, date),
          leave: leaveFor(emp.id, date),
          observed: observedDates.has(date),
        });
        report.days_evaluated++;
        report.by_status[verdict.status] = (report.by_status[verdict.status] || 0) + 1;

        // The engine's opinion, parked beside the stored values — never on them.
        if (row) {
          await db.query(
            `UPDATE attendance SET eval_status = ?, eval_late_minutes = ?, eval_early_leave_minutes = ?,
                    eval_worked_minutes = ?, expected_in = ?, expected_out = ?, expected_minutes = ?,
                    schedule_id = ?, schedule_snapshot = ?, evaluated_at = NOW(), evaluation_version = ?
              WHERE id = ?`,
            [verdict.status, verdict.late_minutes, verdict.early_leave_minutes,
              verdict.worked_minutes, verdict.expected_in, verdict.expected_out, verdict.expected_minutes,
              schedule ? schedule.id : null,
              schedule && dayRule ? JSON.stringify(scheduleSnapshot(schedule, dayRule)) : null,
              EVALUATION_VERSION, row.id]);
          report.rows_updated++;

          const diff = diffAgainstStored(verdict, row);
          if (diff.differs) {
            report.disagreements++;
            if (report.sample_disagreements.length < 40) {
              report.sample_disagreements.push({
                employee: `${emp.first_name} ${emp.last_name}`.trim(),
                date, fields: diff.fields,
                stored: diff.stored,
                engine: { status: verdict.status, late: verdict.late_minutes, early: verdict.early_leave_minutes },
              });
            }
          }
        }

        for (const exc of verdict.exceptions) {
          produced.add(`${emp.id}|${date}|${exc.type}`);
          report.by_type[exc.type] = (report.by_type[exc.type] || 0) + 1;
          const [res] = await db.query(
            `INSERT INTO attendance_exceptions
               (employee_id, company_id, work_date, attendance_id, type, severity, detail,
                late_minutes, early_leave_minutes, worked_minutes, expected_minutes,
                shadow, evaluation_version)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
             ON DUPLICATE KEY UPDATE
               attendance_id = VALUES(attendance_id), severity = VALUES(severity),
               detail = VALUES(detail), late_minutes = VALUES(late_minutes),
               early_leave_minutes = VALUES(early_leave_minutes),
               worked_minutes = VALUES(worked_minutes), expected_minutes = VALUES(expected_minutes),
               evaluation_version = VALUES(evaluation_version),
               -- A case that had been auto-closed and is now produced again is
               -- reopened. A case a person decided — Resolved or Waived — is
               -- left exactly as they left it.
               status = IF(status = 'Auto-resolved', 'Open', status)`,
            [emp.id, emp.company_id, date, row ? row.id : null, exc.type, exc.severity,
              String(exc.detail || '').slice(0, 600),
              exc.late_minutes ?? verdict.late_minutes, exc.early_leave_minutes ?? verdict.early_leave_minutes,
              verdict.worked_minutes, verdict.expected_minutes, shadow, EVALUATION_VERSION]);
          // affectedRows is 1 for an insert and 2 for an update that changed something.
          if (res.affectedRows === 1) report.exceptions_opened++; else report.exceptions_updated++;
        }
      }
    }

    // Anything still open in this window that the engine no longer produces has
    // been fixed — closed, not deleted, so the trail of what was once wrong
    // survives. Human decisions (Resolved, Waived) are never touched.
    const [open] = await db.query(
      `SELECT id, employee_id, DATE_FORMAT(work_date, '%Y-%m-%d') work_date, type
         FROM attendance_exceptions
        WHERE work_date BETWEEN ? AND ? AND status IN (${OPEN_STATUSES.map(() => '?').join(',')})
          ${companyId ? 'AND company_id = ?' : ''}`,
      [from, to, ...OPEN_STATUSES, ...(companyId ? [companyId] : [])]);
    const stale = open.filter((e) => !produced.has(`${e.employee_id}|${e.work_date}|${e.type}`));
    if (stale.length) {
      await db.query(
        `UPDATE attendance_exceptions SET status = 'Auto-resolved', resolved_at = NOW()
          WHERE id IN (${stale.map(() => '?').join(',')})`, stale.map((e) => e.id));
      report.exceptions_closed = stale.length;
    }

    await db.query(
      `UPDATE attendance_evaluation_runs
          SET days_evaluated = ?, rows_updated = ?, exceptions_opened = ?, exceptions_updated = ?,
              exceptions_closed = ?, disagreements = ?, summary = ?, finished_at = NOW()
        WHERE id = ?`,
      [report.days_evaluated, report.rows_updated, report.exceptions_opened, report.exceptions_updated,
        report.exceptions_closed, report.disagreements, JSON.stringify(report), runId]);

    return { runId, ...report };
  } catch (err) {
    await db.query(
      'UPDATE attendance_evaluation_runs SET error = ?, finished_at = NOW() WHERE id = ?',
      [String(err.message).slice(0, 1000), runId]).catch(() => {});
    throw err;
  }
}
