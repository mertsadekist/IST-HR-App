// One-off repair: restore the 2026-08-10 attendance rows lost during testing.
//
// What happened: a test of the new importer ran against the live database. Device
// IDs are global, so its fixture rows matched real employees, and one case
// exercised the explicit overwrite-manual path. That converted 16 pre-existing
// rows to source='Drive Sync', and the cleanup that removed the test's rows by
// that source removed those 16 with them.
//
// This restores them from attendance_2026-08-10.csv, the authoritative export
// for that day. Only employees who currently have NO row for the date are
// written, so the two rows that survived are not touched.
//
// The restore is not byte-identical to what was lost. The originals came from
// the old time-card importer, which had no real check-out and used a fixed
// 19:00 with a "Swipes: ..." note. This file has the actual check-out, so the
// restored rows are more accurate than the ones they replace — but they are
// different, and that is stated in the note on each row.
//
// Safe to re-run: it only fills gaps.
import fs from 'fs';
import path from 'path';
import pool from './config/db.js';
import { parseAttendanceCsv } from './services/attendanceFileParser.js';
import { addAudit } from './services/auditService.js';

const DATE = '2026-08-10';
const CSV = path.join(import.meta.dirname, 'tests', 'fixtures', `attendance_${DATE}.csv`);

try {
  const parsed = parseAttendanceCsv(fs.readFileSync(CSV, 'utf8'), path.basename(CSV));
  if (parsed.errors.length) throw new Error(parsed.errors.join('; '));
  console.log(`source file parsed: ${parsed.rows.length} rows for ${parsed.businessDate}`);
  if (parsed.businessDate !== DATE) throw new Error(`file is for ${parsed.businessDate}, expected ${DATE}`);

  const [emps] = await pool.query(
    `SELECT id, attendance_id, company_id, CONCAT(first_name, ' ', last_name) AS name
       FROM employees WHERE attendance_id IS NOT NULL AND attendance_id <> ''`);
  const byDevice = new Map(emps.map((e) => [String(e.attendance_id).trim(), e]));

  const [have] = await pool.query(
    'SELECT employee_id FROM attendance WHERE work_date = ?', [DATE]);
  const already = new Set(have.map((h) => h.employee_id));
  console.log(`${already.size} employee(s) already have a row for ${DATE} — those are left alone`);

  let restored = 0;
  const names = [];
  for (const r of parsed.rows) {
    const emp = byDevice.get(r.device_id);
    if (!emp) continue;
    if (already.has(emp.id)) continue;

    const notes = [
      r.status_label,
      r.late_minutes ? `late ${r.late_minutes}m` : null,
      r.early_leave_minutes ? `left early ${r.early_leave_minutes}m` : null,
      `restored from ${path.basename(CSV)}`,
    ].filter(Boolean).join(' · ').slice(0, 500);

    await pool.query(
      `INSERT INTO attendance
         (company_id, employee_id, work_date, check_in, check_out, work_hours, status, notes,
          late_minutes, early_leave_minutes, scheduled_in, scheduled_out, source, source_status_code)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'CSV Import', ?)`,
      [emp.company_id, emp.id, DATE,
        r.check_in ? `${DATE} ${r.check_in}` : null,
        r.check_out ? `${DATE} ${r.check_out}` : null,
        r.work_hours, r.status, notes,
        r.late_minutes || null, r.early_leave_minutes || null,
        r.scheduled_in, r.scheduled_out, r.status_code]);
    restored++;
    names.push(emp.name);
  }

  await addAudit(pool, { id: null, name: 'System (repair)' }, 'Attendance', 'Restored',
    `${restored} attendance row(s) for ${DATE} restored from the source export after test data loss: ${names.join(', ')}`);

  const [[total]] = await pool.query('SELECT COUNT(*) n FROM attendance WHERE work_date = ?', [DATE]);
  console.log(`\nrestored ${restored} row(s): ${names.join(', ')}`);
  console.log(`rows for ${DATE} now: ${total.n}`);
  console.log('RESTORE OK');
} catch (e) {
  console.error('RESTORE FAILED:', e.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
