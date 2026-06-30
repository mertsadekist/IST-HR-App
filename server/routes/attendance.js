import { Router } from 'express';
import pool from '../config/db.js';
import { auth } from '../middleware/auth.js';
import { authorize } from '../middleware/rbac.js';
import { addAudit } from '../services/auditService.js';
import { tenantScope, companyClause, resolveWriteCompanyId } from '../middleware/tenant.js';
import { validate } from '../middleware/validate.js';
import { upload } from '../middleware/upload.js';
import * as XLSX from 'xlsx';

const router = Router();
router.use(auth, tenantScope);

// Work day is considered "late" if check-in is after this local time.
const LATE_AFTER = { h: 9, m: 15 };
const VALID_STATUS = ['Present', 'Absent', 'Late', 'Half Day', 'On Leave', 'Holiday', 'Remote'];

const isHR = (req) => ['admin', 'hr_manager', 'hr_specialist'].includes(req.user.role);

async function myEmployeeId(userId) {
  const [[u]] = await pool.query('SELECT employee_id FROM users WHERE id = ?', [userId]);
  return u?.employee_id || null;
}

// Employee must belong to the caller's company; returns company_id or null.
async function employeeCompany(req, employeeId) {
  const eco = companyClause(req, 'company_id');
  const [[e]] = await pool.query('SELECT company_id FROM employees WHERE id = ?' + eco.clause, [employeeId, ...eco.params]);
  return e?.company_id || null;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function lateFromCheckIn(dt) {
  const d = new Date(dt);
  return (d.getHours() > LATE_AFTER.h) || (d.getHours() === LATE_AFTER.h && d.getMinutes() > LATE_AFTER.m);
}

// ─── List ────────────────────────────────────────────────────────────────────
// GET /api/attendance?employee_id=&from=&to=&status=  (employees see only their own)
router.get('/', async (req, res) => {
  try {
    const co = companyClause(req, 'a.company_id');
    // Return check_in/out as wall-clock strings (DATE_FORMAT) so the stored local
    // time is shown verbatim — never shifted by the server/browser timezone.
    let sql = `SELECT a.id, a.employee_id, a.company_id, a.work_hours, a.status, a.notes,
                      DATE_FORMAT(a.work_date, '%Y-%m-%d') AS work_date,
                      DATE_FORMAT(a.check_in, '%H:%i') AS check_in,
                      DATE_FORMAT(a.check_out, '%H:%i') AS check_out,
                      e.first_name, e.last_name
               FROM attendance a JOIN employees e ON a.employee_id = e.id
               WHERE 1=1` + co.clause;
    const params = [...co.params];

    if (!isHR(req)) {
      const empId = await myEmployeeId(req.user.id);
      if (!empId) return res.json([]);
      sql += ' AND a.employee_id = ?'; params.push(empId);
    } else if (req.query.employee_id) {
      sql += ' AND a.employee_id = ?'; params.push(req.query.employee_id);
    }
    if (req.query.from) { sql += ' AND a.work_date >= ?'; params.push(req.query.from); }
    if (req.query.to) { sql += ' AND a.work_date <= ?'; params.push(req.query.to); }
    if (req.query.status) { sql += ' AND a.status = ?'; params.push(req.query.status); }
    sql += ' ORDER BY a.work_date DESC, e.first_name LIMIT 500';
    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) { console.error('GET /attendance error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

// ─── HR: mark/record attendance for a date (upsert) ──────────────────────────
router.post('/', authorize('admin', 'hr_manager', 'hr_specialist'), validate({
  employee_id: { required: true, type: 'integer' },
  work_date: { required: true, type: 'date' },
  status: { type: 'string', enum: VALID_STATUS },
}), async (req, res) => {
  try {
    const { employee_id, work_date, check_in, check_out, status, notes } = req.body;
    const companyId = await employeeCompany(req, employee_id);
    if (!companyId) return res.status(404).json({ error: 'Employee not found' });

    let workHours = null;
    if (check_in && check_out) {
      workHours = Math.round(((new Date(check_out) - new Date(check_in)) / 3600000) * 100) / 100;
      if (workHours < 0) return res.status(422).json({ error: 'Validation failed', errors: [{ field: 'check_out', message: 'check_out must be after check_in' }] });
    }

    await pool.query(
      `INSERT INTO attendance (company_id, employee_id, work_date, check_in, check_out, work_hours, status, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE check_in=VALUES(check_in), check_out=VALUES(check_out),
         work_hours=VALUES(work_hours), status=VALUES(status), notes=VALUES(notes)`,
      [companyId, employee_id, work_date, check_in || null, check_out || null, workHours, status || 'Present', notes || null, req.user.id]
    );
    await addAudit(pool, req.user, 'Attendance', 'Recorded', `Attendance for employee #${employee_id} on ${work_date} (${status || 'Present'})`);
    res.status(201).json({ success: true });
  } catch (err) { console.error('POST /attendance error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

// ─── Self-service check-in / check-out ───────────────────────────────────────
router.post('/check-in', async (req, res) => {
  try {
    const empId = await myEmployeeId(req.user.id);
    if (!empId) return res.status(400).json({ error: 'No employee profile linked to your account' });
    const companyId = await employeeCompany(req, empId);
    if (!companyId) return res.status(404).json({ error: 'Employee not found' });

    const date = todayISO();
    const now = new Date();
    const status = lateFromCheckIn(now) ? 'Late' : 'Present';

    const [[existing]] = await pool.query('SELECT id, check_in FROM attendance WHERE employee_id = ? AND work_date = ?', [empId, date]);
    if (existing?.check_in) return res.status(409).json({ error: 'Already checked in today' });

    if (existing) {
      await pool.query('UPDATE attendance SET check_in = ?, status = ? WHERE id = ?', [now, status, existing.id]);
    } else {
      await pool.query(
        'INSERT INTO attendance (company_id, employee_id, work_date, check_in, status, created_by) VALUES (?, ?, ?, ?, ?, ?)',
        [companyId, empId, date, now, status, req.user.id]
      );
    }
    await addAudit(pool, req.user, 'Attendance', 'Check In', `${req.user.name} checked in (${status})`);
    res.json({ success: true, check_in: now, status });
  } catch (err) { console.error('POST /attendance/check-in error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

router.post('/check-out', async (req, res) => {
  try {
    const empId = await myEmployeeId(req.user.id);
    if (!empId) return res.status(400).json({ error: 'No employee profile linked to your account' });

    const date = todayISO();
    const [[row]] = await pool.query('SELECT id, check_in FROM attendance WHERE employee_id = ? AND work_date = ?', [empId, date]);
    if (!row || !row.check_in) return res.status(400).json({ error: 'You have not checked in today' });

    const now = new Date();
    const workHours = Math.round(((now - new Date(row.check_in)) / 3600000) * 100) / 100;
    await pool.query('UPDATE attendance SET check_out = ?, work_hours = ? WHERE id = ?', [now, workHours, row.id]);
    await addAudit(pool, req.user, 'Attendance', 'Check Out', `${req.user.name} checked out (${workHours}h)`);
    res.json({ success: true, check_out: now, work_hours: workHours });
  } catch (err) { console.error('POST /attendance/check-out error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

// ─── Monthly summary ─────────────────────────────────────────────────────────
// GET /api/attendance/summary?employee_id=&month=YYYY-MM
router.get('/summary', async (req, res) => {
  try {
    const month = /^\d{4}-\d{2}$/.test(req.query.month || '') ? req.query.month : todayISO().slice(0, 7);
    const co = companyClause(req, 'company_id');
    let sql = `SELECT status, COUNT(*) as count, SUM(COALESCE(work_hours,0)) as hours
               FROM attendance WHERE DATE_FORMAT(work_date, '%Y-%m') = ?` + co.clause;
    const params = [month, ...co.params];

    if (!isHR(req)) {
      const empId = await myEmployeeId(req.user.id);
      if (!empId) return res.json({ month, by_status: [], total_hours: 0 });
      sql += ' AND employee_id = ?'; params.push(empId);
    } else if (req.query.employee_id) {
      sql += ' AND employee_id = ?'; params.push(req.query.employee_id);
    }
    sql += ' GROUP BY status';
    const [rows] = await pool.query(sql, params);
    const total_hours = rows.reduce((s, r) => s + Number(r.hours || 0), 0);
    res.json({ month, by_status: rows, total_hours: Math.round(total_hours * 100) / 100 });
  } catch (err) { console.error('GET /attendance/summary error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

// ─── HR: edit / delete a record ──────────────────────────────────────────────
router.put('/:id', authorize('admin', 'hr_manager', 'hr_specialist'), validate({
  status: { type: 'string', enum: VALID_STATUS },
}), async (req, res) => {
  try {
    const { check_in, check_out, status, notes } = req.body;
    const data = {};
    if (check_in !== undefined) data.check_in = check_in || null;
    if (check_out !== undefined) data.check_out = check_out || null;
    if (status !== undefined) data.status = status;
    if (notes !== undefined) data.notes = notes;
    if ((check_in || data.check_in) && (check_out || data.check_out)) {
      const ci = data.check_in ?? check_in;
      const co2 = data.check_out ?? check_out;
      data.work_hours = Math.round(((new Date(co2) - new Date(ci)) / 3600000) * 100) / 100;
    }
    if (!Object.keys(data).length) return res.status(400).json({ error: 'No updatable fields provided' });

    const co = companyClause(req, 'company_id');
    const [result] = await pool.query('UPDATE attendance SET ? WHERE id = ?' + co.clause, [data, req.params.id, ...co.params]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Attendance record not found' });
    await addAudit(pool, req.user, 'Attendance', 'Updated', `Attendance #${req.params.id} updated`);
    res.json({ success: true });
  } catch (err) { console.error('PUT /attendance/:id error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

router.delete('/:id', authorize('admin'), async (req, res) => {
  try {
    const co = companyClause(req, 'company_id');
    const [result] = await pool.query('DELETE FROM attendance WHERE id = ?' + co.clause, [req.params.id, ...co.params]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Attendance record not found' });
    await addAudit(pool, req.user, 'Attendance', 'Deleted', `Attendance #${req.params.id} deleted`);
    res.json({ success: true });
  } catch (err) { console.error('DELETE /attendance/:id error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

// ─── HR: import a time-clock CSV/XLSX export ─────────────────────────────────
// Device file: metadata rows, then header `First Name,Last Name,Name,ID,…,Check-In Record`.
// The device only records entries, so per day: check-in = earliest swipe,
// check-out = a fixed cutoff (default 19:00). Rows are upserted per (employee, date),
// matched to employees by their attendance_id. Unmatched device IDs are reported.
router.post('/import', authorize('admin', 'hr_manager', 'hr_specialist'), upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const checkoutTime = /^\d{1,2}:\d{2}$/.test(req.body.checkout_time || '') ? req.body.checkout_time : '19:00';
    const lateAfter = /^\d{1,2}:\d{2}$/.test(req.body.late_after || '') ? req.body.late_after : null;

    const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const matrix = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false, raw: false, defval: '' });

    // Locate the header row, then map the columns we need by name.
    const headerIdx = matrix.findIndex((r) => Array.isArray(r) && r.some((c) => String(c).trim() === 'ID') && r.some((c) => String(c).trim() === 'Check-In Record'));
    if (headerIdx === -1) return res.status(422).json({ error: 'Unrecognized file — could not find the Time Card header (ID / Check-In Record).' });
    const header = matrix[headerIdx].map((c) => String(c).trim());
    const col = (name) => header.indexOf(name);
    const ix = { id: col('ID'), date: col('Date'), swipes: col('Check-In Record'), name: col('Name') };
    if (ix.id < 0 || ix.date < 0 || ix.swipes < 0) return res.status(422).json({ error: 'Missing required columns (ID, Date, Check-In Record).' });

    // attendance_id -> employee, within the caller's authority (cross-company roles
    // match across every company so a multi-company file imports in one pass).
    let empSql = "SELECT id, company_id, attendance_id, first_name, last_name FROM employees WHERE attendance_id IS NOT NULL AND attendance_id <> ''";
    const empParams = [];
    if (!req.crossCompany) { empSql += ' AND company_id = ?'; empParams.push(req.companyId); }
    const [emps] = await pool.query(empSql, empParams);
    const byDevice = new Map(emps.map((e) => [String(e.attendance_id).trim(), e]));

    // xlsx may keep the date as text ("2026-06-30") or reformat it to its default
    // m/d/yy ("6/30/26"), or hand back a Date object for .xlsx — handle all three
    // without new Date(string) so there is no timezone off-by-one.
    const pad = (n) => String(n).padStart(2, '0');
    const normDate = (v) => {
      if (v instanceof Date) return `${v.getUTCFullYear()}-${pad(v.getUTCMonth() + 1)}-${pad(v.getUTCDate())}`;
      const s = String(v).trim();
      let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);            // ISO YYYY-MM-DD
      if (m) return `${m[1]}-${pad(+m[2])}-${pad(+m[3])}`;
      m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);           // m/d/yy (xlsx default)
      if (m) { const y = m[3].length === 2 ? `20${m[3]}` : m[3]; return `${y}-${pad(+m[1])}-${pad(+m[2])}`; }
      return null;
    };

    let imported = 0, updated = 0, skipped = 0;
    const unmatched = new Map();
    const errors = [];

    for (let r = headerIdx + 1; r < matrix.length; r++) {
      const row = matrix[r];
      if (!Array.isArray(row) || !row.length) continue;
      const deviceId = String(row[ix.id] ?? '').trim();
      if (!deviceId) continue;
      const date = normDate(row[ix.date]);
      const swipesRaw = String(row[ix.swipes] ?? '').trim();
      if (!date || !swipesRaw) { skipped++; continue; }

      const emp = byDevice.get(deviceId);
      if (!emp) {
        const u = unmatched.get(deviceId) || { id: deviceId, name: ix.name >= 0 ? String(row[ix.name] ?? '').trim() : '', rows: 0 };
        u.rows++; unmatched.set(deviceId, u);
        continue;
      }

      const times = swipesRaw.split(';').map((s) => s.trim()).filter((s) => /^\d{1,2}:\d{2}/.test(s)).map((s) => s.slice(0, 5));
      if (!times.length) { skipped++; continue; }
      const firstIn = times.reduce((a, b) => (a <= b ? a : b));
      const checkInDT = `${date} ${firstIn}:00`;
      let checkOutDT = `${date} ${checkoutTime}:00`;
      let workHours = Math.round(((new Date(checkOutDT) - new Date(checkInDT)) / 3600000) * 100) / 100;
      if (workHours <= 0) { checkOutDT = null; workHours = null; } // first reading at/after the cutoff
      const status = (lateAfter && firstIn > lateAfter) ? 'Late' : 'Present';
      const notes = `Swipes: ${swipesRaw}`.slice(0, 500);

      try {
        const [result] = await pool.query(
          `INSERT INTO attendance (company_id, employee_id, work_date, check_in, check_out, work_hours, status, notes, created_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE check_in=VALUES(check_in), check_out=VALUES(check_out),
             work_hours=VALUES(work_hours), status=VALUES(status), notes=VALUES(notes)`,
          [emp.company_id, emp.id, date, checkInDT, checkOutDT, workHours, status, notes, req.user.id]
        );
        if (result.affectedRows === 1) imported++; else updated++; // 2 rows affected = updated
      } catch (e) {
        errors.push({ row: r + 1, message: e.message });
      }
    }

    await addAudit(pool, req.user, 'Attendance', 'Imported',
      `Time-card import: ${imported} new, ${updated} updated, ${skipped} skipped, ${unmatched.size} unmatched device IDs`);
    res.json({ imported, updated, skipped, unmatched: [...unmatched.values()], errors });
  } catch (err) {
    console.error('POST /attendance/import error:', err);
    res.status(500).json({ error: err.message || 'Failed to import attendance file' });
  }
});

// ─── HR: export attendance as CSV/XLSX (same scope/filters as the list) ───────
router.get('/export', authorize('admin', 'hr_manager', 'hr_specialist'), async (req, res) => {
  try {
    const co = companyClause(req, 'a.company_id');
    // DATE_FORMAT keeps the stored wall-clock times (no JS timezone shift).
    let sql = `SELECT DATE_FORMAT(a.work_date, '%Y-%m-%d') AS work_date, e.attendance_id,
                      e.first_name, e.last_name,
                      DATE_FORMAT(a.check_in, '%H:%i') AS check_in,
                      DATE_FORMAT(a.check_out, '%H:%i') AS check_out,
                      a.work_hours, a.status, a.notes
               FROM attendance a JOIN employees e ON a.employee_id = e.id WHERE 1=1` + co.clause;
    const params = [...co.params];
    if (req.query.employee_id) { sql += ' AND a.employee_id = ?'; params.push(req.query.employee_id); }
    if (req.query.from) { sql += ' AND a.work_date >= ?'; params.push(req.query.from); }
    if (req.query.to) { sql += ' AND a.work_date <= ?'; params.push(req.query.to); }
    if (req.query.status) { sql += ' AND a.status = ?'; params.push(req.query.status); }
    sql += ' ORDER BY a.work_date DESC, e.first_name';
    const [rows] = await pool.query(sql, params);

    const aoa = [['Date', 'Attendance ID', 'Employee', 'Check-In', 'Check-Out', 'Work Hours', 'Status', 'Notes']];
    for (const r of rows) {
      aoa.push([r.work_date || '', r.attendance_id || '', `${r.first_name} ${r.last_name}`,
        r.check_in || '', r.check_out || '', r.work_hours ?? '', r.status, r.notes || '']);
    }
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Attendance');
    const format = req.query.format === 'xlsx' ? 'xlsx' : 'csv';
    const buf = XLSX.write(wb, { type: 'buffer', bookType: format });
    res.setHeader('Content-Type', format === 'xlsx'
      ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="attendance_export_${new Date().toISOString().slice(0, 10)}.${format}"`);
    res.send(buf);
  } catch (err) {
    console.error('GET /attendance/export error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
