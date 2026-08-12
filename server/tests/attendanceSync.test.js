/**
 * The importer, against a real database but a fully isolated fixture.
 *
 * IMPORTANT — device ids are global. `importRows` matches on
 * `employees.attendance_id` across every company, so a test using the real
 * file's ids (2006, 2018, …) matches real employees and writes to their
 * attendance. An earlier version of this file did exactly that and destroyed
 * live rows.
 *
 * So the real file is parsed for its shapes — the status codes, the punch times,
 * the missing punch — and then every device id is rewritten into a `ZZT-` name
 * space that no real employee can hold. The data being exercised is real; the
 * rows being written cannot escape the throwaway company.
 *
 * Drive is not involved: `importRows` takes already-parsed rows, and `planFiles`
 * is pure.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import pool from '../config/db.js';
import { parseAttendanceCsv } from '../services/attendanceFileParser.js';
import { planFiles, importRows } from '../services/attendanceSyncService.js';

const realCsv = fs.readFileSync(
  path.join(import.meta.dirname, 'fixtures', 'attendance_2026-08-10.csv'), 'utf8');

const DATE = '2026-08-10';
/** The real rows, with every device id moved out of reach of real employees. */
const parsedReal = parseAttendanceCsv(realCsv, `attendance_${DATE}.csv`);
const rows = parsedReal.rows.map((r) => ({ ...r, device_id: `ZZT-${r.device_id}` }));

const f = (id, name, md5) => ({ id, name, md5Checksum: md5, size: '100', modifiedTime: '2026-08-11T02:00:00Z' });

describe('planFiles — which files the sync takes', () => {
  const files = [
    f('a', 'attendance_2026-08-10.csv', 'm1'),
    f('b', 'attendance_2026-08-11.csv', 'm2'),
  ];

  it('takes everything when the ledger is empty', () => {
    const { toImport } = planFiles(files, []);
    expect(toImport).toHaveLength(2);
    expect(toImport[0].reason).toBe('new file');
  });

  it('imports oldest day first, so a backlog lands in order', () => {
    const { toImport } = planFiles([files[1], files[0]], []);
    expect(toImport.map((i) => i.businessDate)).toEqual(['2026-08-10', '2026-08-11']);
  });

  it('leaves a file it already imported unchanged', () => {
    const { toImport, toSkip } = planFiles(files, [
      { drive_file_id: 'a', status: 'Imported', md5_checksum: 'm1' }]);
    expect(toImport.map((i) => i.file.id)).toEqual(['b']);
    expect(toSkip[0].reason).toMatch(/already imported/);
  });

  it('takes it again when the checksum changed — a corrected re-upload', () => {
    const { toImport } = planFiles(files, [
      { drive_file_id: 'a', status: 'Imported', md5_checksum: 'DIFFERENT' }]);
    expect(toImport.find((i) => i.file.id === 'a').reason).toMatch(/checksum changed/);
  });

  it('retries one that failed last time', () => {
    const { toImport } = planFiles([files[0]], [
      { drive_file_id: 'a', status: 'Failed', md5_checksum: 'm1' }]);
    expect(toImport).toHaveLength(1);
  });

  it('honours the start-date floor so the first run does not swallow history', () => {
    const { toImport, toSkip } = planFiles(files, [], { startDate: '2026-08-11' });
    expect(toImport.map((i) => i.businessDate)).toEqual(['2026-08-11']);
    expect(toSkip[0].reason).toMatch(/before the sync start date/);
  });

  it('ignores anything that is not a dated csv', () => {
    const odd = [f('c', 'notes.txt', 'x'), f('d', 'attendance_summary.csv', 'y')];
    const { toImport, toSkip } = planFiles(odd, []);
    expect(toImport).toHaveLength(0);
    expect(toSkip.map((s) => s.reason)).toEqual(['not a .csv', 'no date in the filename']);
  });
});

describe('importRows', () => {
  const fx = { companyId: null, emps: {}, ignored: 'ZZT-4001' };
  let rowsBefore = 0;

  beforeAll(async () => {
    const [[n]] = await pool.query('SELECT COUNT(*) c FROM attendance');
    rowsBefore = n.c;

    const [c] = await pool.query(
      "INSERT INTO companies (name, short_code, status) VALUES ('ZZ Sync Co','ZZSY','Active')");
    fx.companyId = c.insertId;

    // Three shapes from the real file: left early, late+early, and no punches.
    for (const [device, last] of [['ZZT-2006', 'Early'], ['ZZT-2018', 'LateEarly'], ['ZZT-2020', 'Absent']]) {
      const [e] = await pool.query('INSERT INTO employees SET ?', {
        company_id: fx.companyId, first_name: 'Sync', last_name: last,
        email: `zz.sync.${device}@check.test`, status: 'Active', attendance_id: device,
      });
      fx.emps[device] = e.insertId;
    }
    await pool.query('INSERT INTO attendance_ignored_devices SET ?', {
      device_id: fx.ignored, device_name: 'Majd Barshiny', reason: 'not an employee',
    });
  });

  afterAll(async () => {
    await pool.query('DELETE FROM attendance WHERE company_id = ?', [fx.companyId]).catch(() => {});
    await pool.query('DELETE FROM leave_requests WHERE company_id = ?', [fx.companyId]).catch(() => {});
    await pool.query('DELETE FROM employees WHERE company_id = ?', [fx.companyId]);
    await pool.query('DELETE FROM attendance_ignored_devices WHERE device_id = ?', [fx.ignored]);
    await pool.query('DELETE FROM companies WHERE id = ?', [fx.companyId]);

    // The guard that matters: the suite must leave the table exactly as it found
    // it. If this ever fails, something escaped the fixture.
    const [[n]] = await pool.query('SELECT COUNT(*) c FROM attendance');
    if (n.c !== rowsBefore) {
      throw new Error(`attendance rows leaked: ${rowsBefore} before, ${n.c} after`);
    }
  });

  it('writes only the employees it can match, and reports the rest', async () => {
    const r = await importRows(pool, { rows, businessDate: DATE });
    expect(r.inserted).toBe(3);
    expect(r.errors).toEqual([]);
    // Everything else in the file is unknown here — reported, never invented.
    expect(r.unmatched.length).toBe(rows.length - 3 - 1); // minus the ignored one
  });

  it('touches nothing outside the fixture company', async () => {
    const [[n]] = await pool.query(
      'SELECT COUNT(*) c FROM attendance WHERE company_id <> ?', [fx.companyId]);
    expect(n.c).toBe(rowsBefore);
  });

  it('keeps an ignored device out of the unmatched list', async () => {
    const r = await importRows(pool, { rows, businessDate: DATE });
    expect(r.ignored.map((i) => i.device_id)).toContain(fx.ignored);
    expect(r.unmatched.map((u) => u.device_id)).not.toContain(fx.ignored);
  });

  it('stores the punch times, hours and the early-leave minutes', async () => {
    const [[row]] = await pool.query(
      `SELECT DATE_FORMAT(check_in, '%H:%i:%s') ci, DATE_FORMAT(check_out, '%H:%i:%s') co,
              work_hours, status, late_minutes, early_leave_minutes, source, source_status_code,
              DATE_FORMAT(work_date, '%Y-%m-%d') wd
         FROM attendance WHERE employee_id = ?`, [fx.emps['ZZT-2006']]);
    expect(row.wd).toBe(DATE);
    expect(row.ci).toBe('10:01:05');
    expect(row.co).toBe('16:51:24');
    expect(Number(row.work_hours)).toBeCloseTo(6.84, 2);
    expect(row.status).toBe('Present');          // code 3 keeps the arrival verdict
    expect(row.early_leave_minutes).toBe(129);   // and carries the departure
    expect(row.source).toBe('Drive Sync');
    expect(row.source_status_code).toBe(3);
  });

  it('marks a late-and-early day Late, with both figures', async () => {
    const [[row]] = await pool.query(
      'SELECT status, late_minutes, early_leave_minutes FROM attendance WHERE employee_id = ?',
      [fx.emps['ZZT-2018']]);
    expect(row.status).toBe('Late');
    expect(row.late_minutes).toBeGreaterThan(0);
    expect(row.early_leave_minutes).toBeGreaterThan(0);
  });

  it('records a no-punch day as Absent with no times', async () => {
    const [[row]] = await pool.query(
      'SELECT status, check_in, check_out FROM attendance WHERE employee_id = ?',
      [fx.emps['ZZT-2020']]);
    expect(row.status).toBe('Absent');
    expect(row.check_in).toBeNull();
    expect(row.check_out).toBeNull();
  });

  it('re-running the same day updates instead of duplicating', async () => {
    const r = await importRows(pool, { rows, businessDate: DATE });
    expect(r.inserted).toBe(0);
    expect(r.updated).toBe(3);
    const [[n]] = await pool.query(
      'SELECT COUNT(*) c FROM attendance WHERE company_id = ?', [fx.companyId]);
    expect(n.c).toBe(3);
  });

  it('writes On Leave instead of Absent when the day was granted', async () => {
    const [[lt]] = await pool.query("SELECT id FROM leave_types WHERE status = 'Active' LIMIT 1");
    await pool.query('INSERT INTO leave_requests SET ?', {
      employee_id: fx.emps['ZZT-2020'], company_id: fx.companyId, leave_type_id: lt.id,
      start_date: '2026-08-09', end_date: '2026-08-11', days: 3, status: 'Approved',
    });

    const r = await importRows(pool, { rows, businessDate: DATE });
    expect(r.reclassified_leave.map((x) => x.employee)).toContain('Sync Absent');

    const [[row]] = await pool.query(
      'SELECT status, notes FROM attendance WHERE employee_id = ?', [fx.emps['ZZT-2020']]);
    // Absent and On Leave are deducted differently; recording a granted day as
    // an absence would have payroll take it twice.
    expect(row.status).toBe('On Leave');
    expect(row.notes).toMatch(/approved leave/);
  });

  it('leaves a hand-corrected day alone, and says so', async () => {
    await pool.query(
      "UPDATE attendance SET source = 'Manual', status = 'Remote', notes = 'HR fixed this' WHERE employee_id = ?",
      [fx.emps['ZZT-2006']]);

    const r = await importRows(pool, { rows, businessDate: DATE });
    expect(r.skipped_manual.map((s) => s.employee)).toContain('Sync Early');

    const [[row]] = await pool.query(
      'SELECT status, notes, source FROM attendance WHERE employee_id = ?', [fx.emps['ZZT-2006']]);
    expect(row.status).toBe('Remote');
    expect(row.notes).toBe('HR fixed this');
    expect(row.source).toBe('Manual');
  });

  it('overwrites the correction only when explicitly told to', async () => {
    const r = await importRows(pool, { rows, businessDate: DATE, overwriteManual: true });
    expect(r.skipped_manual).toEqual([]);
    const [[row]] = await pool.query(
      'SELECT status, source FROM attendance WHERE employee_id = ?', [fx.emps['ZZT-2006']]);
    expect(row.status).toBe('Present');
    expect(row.source).toBe('Drive Sync');
  });

  it('reports a company the file claims that the record disagrees with', async () => {
    const r = await importRows(pool, { rows, businessDate: DATE });
    expect(r.company_mismatch.length).toBeGreaterThan(0);
    expect(r.company_mismatch[0]).toHaveProperty('file_says');
    // Reported only — the row still carries the employee record's company.
    const [[row]] = await pool.query(
      'SELECT company_id FROM attendance WHERE employee_id = ?', [fx.emps['ZZT-2018']]);
    expect(row.company_id).toBe(fx.companyId);
  });
});
