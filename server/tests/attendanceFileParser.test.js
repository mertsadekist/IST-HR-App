/**
 * Parser tests for the daily attendance CSV.
 *
 * The real file from 2026-08-10 is the fixture, so these assert against what the
 * source system actually produces rather than an idealised version of it. The
 * status codes are undocumented and were derived from this file — if the export
 * ever changes shape, these fail before anything reaches the attendance table.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  parseAttendanceCsv, summarise, businessDateFromName, STATUS_CODES,
} from '../services/attendanceFileParser.js';

const FIXTURE = path.join(import.meta.dirname, 'fixtures', 'attendance_2026-08-10.csv');
const real = fs.readFileSync(FIXTURE, 'utf8');
const NAME = 'attendance_2026-08-10.csv';

const HEADER = 'employee_id,employee_name,department,attendance_date,check_in,check_out,'
  + 'scheduled_in,scheduled_out,worked_seconds,worked_time,late_seconds,late_time,'
  + 'early_leave_seconds,early_leave_time,attendance_status_code';
const row = (o = {}) => {
  const d = {
    id: '2006', name: 'Mert Sadek', dept: 'IST Group>IST Markets', date: '2026-08-10',
    in: '10:01:05', out: '16:51:24', si: '10:00:00', so: '19:00:00',
    worked: '24619', wt: '06:50:19', late: '0', lt: '00:00:00',
    early: '7716', et: '02:08:36', code: '3', ...o,
  };
  return `${HEADER}\n${d.id},${d.name},${d.dept},${d.date},${d.in},${d.out},${d.si},${d.so},`
    + `${d.worked},${d.wt},${d.late},${d.lt},${d.early},${d.et},${d.code}`;
};

describe('businessDateFromName', () => {
  it('takes the date out of the filename', () => {
    expect(businessDateFromName('attendance_2026-08-10.csv')).toBe('2026-08-10');
  });
  it('returns null when the name carries no date', () => {
    expect(businessDateFromName('attendance.csv')).toBeNull();
    expect(businessDateFromName('')).toBeNull();
  });
});

describe('parsing the real file', () => {
  const parsed = parseAttendanceCsv(real, NAME);

  it('reads every data row with no errors', () => {
    expect(parsed.errors).toEqual([]);
    expect(parsed.rows).toHaveLength(24);
  });

  it('agrees with the filename on which day it covers', () => {
    expect(parsed.businessDate).toBe('2026-08-10');
  });

  it('maps the device id, which is what employees.attendance_id holds', () => {
    const mert = parsed.rows.find((r) => r.device_id === '2006');
    expect(mert.name).toBe('Mert Sadek');
    expect(mert.work_date).toBe('2026-08-10');
  });

  it('keeps punch times verbatim, with no timezone shift', () => {
    const mert = parsed.rows.find((r) => r.device_id === '2006');
    expect(mert.check_in).toBe('10:01:05');
    expect(mert.check_out).toBe('16:51:24');
    expect(mert.scheduled_in).toBe('10:00:00');
    expect(mert.scheduled_out).toBe('19:00:00');
  });

  it('converts worked seconds to hours and lateness to minutes', () => {
    const mert = parsed.rows.find((r) => r.device_id === '2006');
    expect(mert.work_hours).toBeCloseTo(6.84, 2);      // 24619s
    expect(mert.late_minutes).toBe(0);
    expect(mert.early_leave_minutes).toBe(129);        // 7716s = 2h08m36s
  });

  it('decodes every status code the file uses', () => {
    const byCode = {};
    for (const r of parsed.rows) byCode[r.status_code] = (byCode[r.status_code] || 0) + 1;
    // The real file exercises all five.
    expect(Object.keys(byCode).sort()).toEqual(['1', '2', '3', '4', '5']);
    for (const r of parsed.rows) {
      expect(r.status).toBe(STATUS_CODES[r.status_code].status);
    }
  });

  it('holds the derivation the codes were based on: the signature matches the code', () => {
    for (const r of parsed.rows) {
      const late = r.late_minutes > 0;
      const early = r.early_leave_minutes > 0;
      if (r.status_code === 1) expect(late || early).toBe(false);
      if (r.status_code === 2) expect(late && !early).toBe(true);
      if (r.status_code === 3) expect(!late && early).toBe(true);
      if (r.status_code === 4) expect(r.check_in).toBeNull();
      if (r.status_code === 5) expect(late && early).toBe(true);
    }
  });

  it('records the six absent days with no punches', () => {
    const absent = parsed.rows.filter((r) => r.status === 'Absent');
    expect(absent).toHaveLength(6);
    for (const a of absent) {
      expect(a.check_in).toBeNull();
      expect(a.check_out).toBeNull();
      expect(a.work_hours).toBe(0);
    }
  });

  it('flags the missing punch rather than recording a zero-hour day as fact', () => {
    const shinaritah = parsed.rows.find((r) => r.device_id === '4039');
    expect(shinaritah.check_in).toBe('10:19:13');
    expect(shinaritah.check_out).toBeNull();
    expect(shinaritah.missing_punch).toBe(true);
    expect(parsed.warnings.some((w) => w.includes('4039'))).toBe(true);
  });

  it('carries the department path for reporting, without acting on it', () => {
    const mert = parsed.rows.find((r) => r.device_id === '2006');
    // The file says IST Markets; his employee record says IST Real Estate. The
    // parser reports what the file claims and nothing more.
    expect(mert.department_path).toBe('IST Group>IST Markets');
  });

  it('summarises the day the way the email reports it', () => {
    const s = summarise(parsed.rows);
    expect(s.total).toBe(24);
    expect(s.absent).toBe(6);
    expect(s.present + s.late + s.absent).toBe(24);
    expect(s.left_early).toBeGreaterThan(0);
    expect(s.missing_punch).toBe(1);
  });
});

describe('rejecting a file it should not import', () => {
  it('refuses a file whose header is not this export', () => {
    const r = parseAttendanceCsv('ID,Date,Check-In Record\n2006,2026-08-10,10:01', 'x.csv');
    expect(r.rows).toHaveLength(0);
    expect(r.headerMissing).toContain('attendance_status_code');
    expect(r.errors[0]).toMatch(/missing column/i);
  });

  it('refuses an empty file', () => {
    expect(parseAttendanceCsv('', NAME).errors[0]).toMatch(/empty/i);
  });

  it('refuses a header with no data rows', () => {
    expect(parseAttendanceCsv(HEADER, NAME).errors[0]).toMatch(/no data rows/i);
  });

  it('fails when the filename and the rows disagree on the date', () => {
    const r = parseAttendanceCsv(row({ date: '2026-08-09' }), 'attendance_2026-08-10.csv');
    expect(r.errors.some((e) => /Filename says 2026-08-10 but the rows are dated 2026-08-09/.test(e))).toBe(true);
  });

  it('fails when one file covers more than one day', () => {
    const two = `${row()}\n2004,Nawar Eskef,IST Group,2026-08-11,10:00:00,19:00:00,10:00:00,19:00:00,32400,09:00:00,0,00:00:00,0,00:00:00,1`;
    const r = parseAttendanceCsv(two, NAME);
    expect(r.errors.some((e) => /2 different dates/.test(e))).toBe(true);
  });

  it('refuses a status code it has never seen instead of guessing', () => {
    const r = parseAttendanceCsv(row({ code: '9' }), NAME);
    expect(r.rows).toHaveLength(0);
    expect(r.errors[0]).toMatch(/unknown attendance_status_code "9"/);
  });

  it('refuses a malformed date', () => {
    const r = parseAttendanceCsv(row({ date: '10/08/2026' }), NAME);
    expect(r.rows).toHaveLength(0);
    expect(r.errors[0]).toMatch(/not a YYYY-MM-DD date/);
  });

  it('catches the same device twice in one file', () => {
    const dup = `${row()}\n2006,Mert Sadek,IST Group,2026-08-10,10:00:00,19:00:00,10:00:00,19:00:00,32400,09:00:00,0,00:00:00,0,00:00:00,1`;
    const r = parseAttendanceCsv(dup, NAME);
    expect(r.rows).toHaveLength(1);
    expect(r.errors.some((e) => /appears twice/.test(e))).toBe(true);
  });

  it('warns when a code claims presence but there is no check-in', () => {
    const r = parseAttendanceCsv(row({ in: '', out: '', code: '1' }), NAME);
    expect(r.warnings.some((w) => /no check-in/.test(w))).toBe(true);
  });
});

describe('tolerating harmless variation', () => {
  it('strips a BOM, which Excel adds when a file is re-saved', () => {
    const r = parseAttendanceCsv(`﻿${row()}`, NAME);
    expect(r.errors).toEqual([]);
    expect(r.rows).toHaveLength(1);
  });

  it('accepts CRLF line endings', () => {
    const r = parseAttendanceCsv(row().replace(/\n/g, '\r\n'), NAME);
    expect(r.errors).toEqual([]);
    expect(r.rows[0].device_id).toBe('2006');
  });

  it('accepts a quoted field containing a comma', () => {
    const r = parseAttendanceCsv(row({ name: '"Sadek, Mert"' }), NAME);
    expect(r.rows[0].name).toBe('Sadek, Mert');
  });

  it('pads a time given without seconds', () => {
    const r = parseAttendanceCsv(row({ in: '9:05' }), NAME);
    expect(r.rows[0].check_in).toBe('09:05:00');
  });

  it('ignores a trailing blank line', () => {
    const r = parseAttendanceCsv(`${row()}\n\n`, NAME);
    expect(r.errors).toEqual([]);
    expect(r.rows).toHaveLength(1);
  });
});
