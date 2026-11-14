import { Router } from 'express';
import pool from '../config/db.js';
import { auth } from '../middleware/auth.js';
import { authorize } from '../middleware/rbac.js';
import { tenantScope, companyClause } from '../middleware/tenant.js';
import { addAudit } from '../services/auditService.js';
import { listSchedules, resolveDayRule } from '../services/workScheduleService.js';
import { loadScheduleIndex, loadHolidays, loadLeave } from '../services/attendanceEvaluationRunner.js';
import { localDate, localSecondsOfDay } from '../services/hikRules.js';
import { liveState, crossesMidnight, LIVE_STATES } from '../services/shiftService.js';

// Today's live board, the month's roster (attendance and shifts per person and
// day) and painting shifts onto it. Mounted on /api/attendance before
// routes/attendance.js, whose PUT /:id would otherwise catch PUT /shifts.
const router = Router();
router.use(auth, tenantScope);

const VIEW = ['admin', 'hr_manager', 'hr_specialist'];
const EDIT = ['admin', 'hr_manager'];
const ACTIVE = ['Onboarding', 'Active', 'Offboarding'];
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const tz = () => process.env.TZ || 'Asia/Dubai';
const fail = (res, where, err) => { console.error(`${where} error:`, err); res.status(500).json({ error: 'Internal server error' }); };
const hm = (t) => (t ? String(t).slice(0, 5) : null);

/** People HR is looking at: on the books, in scope, owners left out (they keep their own hours). */
async function scopedEmployees(req) {
  const co = companyClause(req, 'e.company_id');
  const [rows] = await pool.query(
    `SELECT e.id, e.company_id, e.first_name, e.last_name, e.status, d.name AS department,
            DATE_FORMAT(e.start_date, '%Y-%m-%d') AS start_date
       FROM employees e LEFT JOIN departments d ON d.id = e.department_id
      WHERE e.status IN (?) AND e.is_owner = FALSE${co.clause}
      ORDER BY d.name, e.first_name, e.last_name`, [ACTIVE, ...co.params]);
  return rows;
}

function datesOfMonth(month) {
  const [y, m] = month.split('-').map(Number);
  const n = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return Array.from({ length: n }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`);
}

// GET /api/attendance/live — where everyone is right now.
router.get('/live', authorize(...VIEW), async (req, res) => {
  try {
    const today = localDate(tz());
    const nowSec = localSecondsOfDay(tz());
    const employees = await scopedEmployees(req);
    if (!employees.length) return res.json({ date: today, now: nowSec, counts: {}, people: [] });
    const scheduleFor = await loadScheduleIndex(employees, pool);
    const holidayFor = await loadHolidays(today, today, pool);
    const leaveFor = await loadLeave(employees, today, today, pool);
    const [rows] = await pool.query(
      `SELECT employee_id, status, late_minutes, TIME_FORMAT(check_in, '%H:%i') AS check_in,
              TIME_FORMAT(check_out, '%H:%i') AS check_out
         FROM attendance WHERE work_date = ? AND employee_id IN (?)`, [today, employees.map((e) => e.id)]);
    const rowOf = new Map(rows.map((r) => [r.employee_id, r]));
    const counts = Object.fromEntries(LIVE_STATES.map((s) => [s, 0]));
    const people = employees.map((e) => {
      const resolved = scheduleFor(e, today);
      const schedule = resolved?.schedule || null;
      const dayRule = schedule ? resolveDayRule(schedule, today) : null;
      const holiday = holidayFor(e.company_id, today);
      const leave = leaveFor(e.id, today);
      const row = rowOf.get(e.id) || null;
      const state = liveState({
        row, dayRule, schedule, nowSec,
        holiday: !!holiday && !holiday.is_half_day, onLeave: !!leave?.is_full_day,
      });
      counts[state] += 1;
      return {
        id: e.id, name: `${e.first_name || ''} ${e.last_name || ''}`.trim(), department: e.department, state,
        check_in: row?.check_in || null, last_seen: row?.check_out || row?.check_in || null,
        late_minutes: row?.late_minutes || null,
        expected_in: dayRule?.is_working ? hm(dayRule.start_time) : null,
        expected_out: dayRule?.is_working ? hm(dayRule.end_time) : null,
        shift_source: resolved?.source || null, leave_type: leave?.leave_type_name || null,
        holiday: holiday?.name_en || null,
      };
    });
    res.json({ date: today, now: nowSec, counts, people });
  } catch (err) { fail(res, 'GET /attendance/live', err); }
});

// GET /api/attendance/roster?month=YYYY-MM — per person and day: shift, attendance, leave, holiday.
router.get('/roster', authorize(...VIEW), async (req, res) => {
  try {
    const month = MONTH_RE.test(req.query.month || '') ? req.query.month : localDate(tz()).slice(0, 7);
    const dates = datesOfMonth(month);
    const from = dates[0]; const to = dates[dates.length - 1];
    const employees = await scopedEmployees(req);
    const companyIds = [...new Set(employees.map((e) => e.company_id))];
    const schedules = companyIds.length ? await listSchedules(companyIds, pool) : [];
    if (!employees.length) return res.json({ month, dates, today: localDate(tz()), schedules: [], employees: [] });

    const ids = employees.map((e) => e.id);
    const scheduleFor = await loadScheduleIndex(employees, pool);
    const holidayFor = await loadHolidays(from, to, pool);
    const [att] = await pool.query(
      `SELECT employee_id, DATE_FORMAT(work_date, '%Y-%m-%d') AS d, status, late_minutes,
              TIME_FORMAT(check_in, '%H:%i') AS check_in, TIME_FORMAT(check_out, '%H:%i') AS check_out
         FROM attendance WHERE work_date BETWEEN ? AND ? AND employee_id IN (?)`, [from, to, ids]);
    const attOf = new Map(att.map((r) => [`${r.employee_id}|${r.d}`, r]));
    const [leaves] = await pool.query(
      `SELECT lr.employee_id, lr.status, lt.name AS leave_type_name, lt.color,
              DATE_FORMAT(lr.start_date, '%Y-%m-%d') AS s, DATE_FORMAT(lr.end_date, '%Y-%m-%d') AS e
         FROM leave_requests lr JOIN leave_types lt ON lt.id = lr.leave_type_id
        WHERE lr.status IN ('Approved','Pending') AND lr.employee_id IN (?) AND lr.start_date <= ? AND lr.end_date >= ?`,
      [ids, to, from]);

    const out = employees.map((e) => {
      const days = {};
      for (const d of dates) {
        const resolved = scheduleFor(e, d);
        const rule = resolved?.schedule ? resolveDayRule(resolved.schedule, d) : null;
        const h = holidayFor(e.company_id, d);
        const lv = leaves.find((l) => l.employee_id === e.id && l.s <= d && l.e >= d);
        const a = attOf.get(`${e.id}|${d}`);
        days[d] = {
          shift: resolved ? {
            schedule_id: resolved.source === 'day_off' ? null : resolved.schedule?.id ?? null,
            name: resolved.schedule?.name_en || null, source: resolved.source,
            working: !!rule?.is_working, start: hm(rule?.start_time), end: hm(rule?.end_time), night: crossesMidnight(rule),
          } : null,
          att: a ? { status: a.status, check_in: a.check_in, check_out: a.check_out, late: a.late_minutes || null } : null,
          leave: lv ? { type: lv.leave_type_name, color: lv.color, status: lv.status } : null,
          holiday: h ? h.name_en : null,
        };
      }
      return { id: e.id, company_id: e.company_id, name: `${e.first_name || ''} ${e.last_name || ''}`.trim(), department: e.department, days };
    });
    res.json({
      month, dates, today: localDate(tz()),
      schedules: schedules.filter((s) => s.active).map((s) => ({ id: s.id, company_id: s.company_id, name: s.name_en, name_ar: s.name_ar, is_default: !!s.is_default })),
      employees: out,
    });
  } catch (err) { fail(res, 'GET /attendance/roster', err); }
});

// PUT /api/attendance/shifts { employee_ids, dates, value: <schedule id> | 'off' | null (back to the weekly schedule), note }
router.put('/shifts', authorize(...EDIT), async (req, res) => {
  try {
    const b = req.body || {};
    const empIds = [...new Set((b.employee_ids || []).map(Number).filter(Number.isInteger))];
    const dates = [...new Set((b.dates || []).filter((d) => DATE_RE.test(d)))].sort();
    if (!empIds.length || !dates.length) return res.status(422).json({ error: 'Choose people and days' });
    if (empIds.length * dates.length > 5000) return res.status(422).json({ error: 'Too many cells at once' });
    const value = b.value === 'off' ? 'off' : b.value == null || b.value === '' ? null : Number(b.value);
    const co = companyClause(req, 'company_id');
    const [emps] = await pool.query(`SELECT id, company_id FROM employees WHERE id IN (?)${co.clause}`, [empIds, ...co.params]);
    if (emps.length !== empIds.length) return res.status(404).json({ error: 'Employee not found' });
    let schedule = null;
    if (typeof value === 'number') {
      const [[s]] = await pool.query('SELECT id, company_id, name_en FROM work_schedules WHERE id = ? AND active = TRUE', [value]);
      if (!s) return res.status(422).json({ error: 'Choose a shift' });
      if (emps.some((e) => e.company_id !== s.company_id)) return res.status(422).json({ error: 'That shift belongs to another company' });
      schedule = s;
    }
    const note = b.note ? String(b.note).slice(0, 300) : null;
    for (const e of emps) {
      if (value === null) {
        await pool.query('DELETE FROM shift_assignments WHERE employee_id = ? AND work_date IN (?)', [e.id, dates]);
        continue;
      }
      for (const d of dates) {
        await pool.query(
          `INSERT INTO shift_assignments (company_id, employee_id, work_date, schedule_id, is_off, note, assigned_by)
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE schedule_id = VALUES(schedule_id), is_off = VALUES(is_off), note = VALUES(note), assigned_by = VALUES(assigned_by)`,
          [e.company_id, e.id, d, schedule ? schedule.id : null, value === 'off' ? 1 : 0, note, req.user.id]);
      }
    }
    await addAudit(pool, req.user, 'Attendance', 'Shifts Set',
      `${value === null ? 'Weekly schedule restored' : value === 'off' ? 'Day off' : `Shift "${schedule.name_en}"`} for ${emps.length} person(s), ${dates[0]} → ${dates[dates.length - 1]} (${dates.length} day(s))`);

    // Days already over are judged again against the new shift; a fault here
    // does not undo the change.
    const today = localDate(tz());
    const past = dates.filter((d) => d < today);
    let reevaluated = false;
    if (past.length) {
      try {
        const { runEvaluation } = await import('../services/attendanceEvaluationRunner.js');
        for (const companyId of new Set(emps.map((e) => e.company_id))) {
          await runEvaluation({ from: past[0], to: past[past.length - 1], companyId, userId: req.user.id, trigger: 'Manual' });
        }
        reevaluated = true;
      } catch (e) { console.error('shift change: re-evaluation failed (the change stands):', e.message); }
    }
    res.json({ success: true, cells: emps.length * dates.length, reevaluated });
  } catch (err) { fail(res, 'PUT /attendance/shifts', err); }
});

export default router;
