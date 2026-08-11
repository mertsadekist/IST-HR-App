/**
 * Parser for the daily attendance CSV the time-attendance software writes to
 * Google Drive.
 *
 * Deliberately pure: text in, normalised rows out. No database, no network, no
 * clock. That is what makes the tricky parts — the status codes, empty punches,
 * a filename that disagrees with the dates inside — testable against the real
 * file without touching anything.
 *
 * See docs/attendance_drive_sync_plan.md for the file's shape and where the
 * status codes came from.
 */

/**
 * The source system's verdict for a day. Undocumented, so it was derived from a
 * real file and checked against every row: the signature in the late and
 * early-leave columns fits each code exactly.
 *
 * `status` is what goes in `attendance.status`. Codes 3 and 5 keep the arrival
 * verdict and carry the early departure in `early_leave_minutes` instead of
 * being flattened into 'Half Day' — a ten-minute early finish and a five-hour
 * one are not the same thing, and the minutes say which is which.
 */
export const STATUS_CODES = Object.freeze({
  1: { status: 'Present', label: 'On time' },
  2: { status: 'Late', label: 'Late arrival' },
  3: { status: 'Present', label: 'Left early' },
  4: { status: 'Absent', label: 'No punches' },
  5: { status: 'Late', label: 'Late arrival and left early' },
});

export const REQUIRED_COLUMNS = Object.freeze([
  'employee_id', 'attendance_date', 'check_in', 'check_out', 'attendance_status_code',
]);

/** `attendance_2026-08-10.csv` -> `2026-08-10`. Null when the name says nothing. */
export function businessDateFromName(fileName) {
  const m = String(fileName || '').match(/(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

/** Splits one CSV line, honouring double quotes around a field. */
function splitLine(line) {
  const out = [];
  let cur = '', quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (quoted && line[i + 1] === '"') { cur += '"'; i++; }
      else quoted = !quoted;
    } else if (c === ',' && !quoted) { out.push(cur); cur = ''; }
    else cur += c;
  }
  out.push(cur);
  return out.map((v) => v.trim());
}

const isTime = (v) => /^\d{1,2}:\d{2}(:\d{2})?$/.test(String(v || '').trim());
const isDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || '').trim());

/** 'HH:MM:SS' -> 'HH:MM:SS' padded, or null. Kept as text: no Date, no shift. */
function normTime(v) {
  const s = String(v || '').trim();
  if (!isTime(s)) return null;
  const [h, m, sec = '00'] = s.split(':');
  return `${String(h).padStart(2, '0')}:${m}:${String(sec).padStart(2, '0')}`;
}

const toInt = (v) => {
  const n = parseInt(String(v ?? '').trim(), 10);
  return Number.isFinite(n) ? n : 0;
};

/**
 * @param {string} text  the CSV contents
 * @param {string} [fileName]  used to cross-check the dates inside
 * @returns {{rows: object[], errors: string[], warnings: string[], businessDate: string|null, headerMissing: string[]}}
 */
export function parseAttendanceCsv(text, fileName = '') {
  const errors = [];
  const warnings = [];
  const rows = [];

  const lines = String(text || '')
    .replace(/^﻿/, '')            // strip a BOM: Excel adds one
    .split(/\r?\n/)
    .filter((l) => l.trim() !== '');

  if (!lines.length) {
    return { rows, errors: ['The file is empty'], warnings, businessDate: null, headerMissing: [] };
  }

  const header = splitLine(lines[0]).map((h) => h.toLowerCase());
  const headerMissing = REQUIRED_COLUMNS.filter((c) => !header.includes(c));
  if (headerMissing.length) {
    return {
      rows, warnings, businessDate: businessDateFromName(fileName), headerMissing,
      errors: [`Unrecognised file — missing column(s): ${headerMissing.join(', ')}`],
    };
  }
  const at = (name) => header.indexOf(name);
  const ix = {
    device: at('employee_id'), name: at('employee_name'), dept: at('department'),
    date: at('attendance_date'), in: at('check_in'), out: at('check_out'),
    schedIn: at('scheduled_in'), schedOut: at('scheduled_out'),
    worked: at('worked_seconds'), late: at('late_seconds'), early: at('early_leave_seconds'),
    code: at('attendance_status_code'),
  };

  const nameDate = businessDateFromName(fileName);
  const seen = new Map();          // device -> first line, to catch duplicates
  const dates = new Set();

  for (let i = 1; i < lines.length; i++) {
    const lineNo = i + 1;
    const c = splitLine(lines[i]);
    const device = String(c[ix.device] ?? '').trim();
    if (!device) continue;         // trailing blank-ish line

    const date = String(c[ix.date] ?? '').trim();
    if (!isDate(date)) {
      errors.push(`Line ${lineNo}: attendance_date "${date}" is not a YYYY-MM-DD date`);
      continue;
    }
    dates.add(date);

    const code = toInt(c[ix.code]);
    const known = STATUS_CODES[code];
    if (!known) {
      // A code the source system grew after this was written. Refusing the row
      // is better than guessing a status for it.
      errors.push(`Line ${lineNo}: unknown attendance_status_code "${c[ix.code]}" for device ${device}`);
      continue;
    }

    if (seen.has(device)) {
      errors.push(`Line ${lineNo}: device ${device} appears twice (first at line ${seen.get(device)})`);
      continue;
    }
    seen.set(device, lineNo);

    const checkIn = normTime(c[ix.in]);
    const checkOut = normTime(c[ix.out]);
    const workedSeconds = toInt(c[ix.worked]);

    // Checked in and never out. The file reports zero worked seconds, which
    // would read as a zero-hour day — it is a missing punch, and the report has
    // to say so rather than record the zero as fact.
    const missingPunch = !!checkIn && !checkOut;
    if (missingPunch) {
      warnings.push(`Device ${device} (${c[ix.name] || 'unknown'}) checked in at ${checkIn} and never checked out`);
    }
    // A code claiming presence with no punch at all is the file contradicting
    // itself; flag rather than invent times.
    if (code !== 4 && !checkIn) {
      warnings.push(`Device ${device} has status code ${code} (${known.label}) but no check-in time`);
    }

    rows.push({
      line: lineNo,
      device_id: device,
      name: String(c[ix.name] ?? '').trim(),
      // The company path the fingerprint system believes. Reported, never acted
      // on: the employee record is the authority for company.
      department_path: String(c[ix.dept] ?? '').trim(),
      work_date: date,
      check_in: checkIn,
      check_out: checkOut,
      scheduled_in: normTime(c[ix.schedIn]),
      scheduled_out: normTime(c[ix.schedOut]),
      // Two decimals is what the attendance table stores; seconds would be false
      // precision on a figure the source already rounded.
      work_hours: Math.round((workedSeconds / 3600) * 100) / 100,
      late_minutes: Math.round(toInt(c[ix.late]) / 60),
      early_leave_minutes: Math.round(toInt(c[ix.early]) / 60),
      status: known.status,
      status_code: code,
      status_label: known.label,
      missing_punch: missingPunch,
    });
  }

  // One file is one day. More than one date means the export changed shape, and
  // importing it under a single business date would file rows under the wrong
  // day — worth failing over.
  const businessDate = dates.size === 1 ? [...dates][0] : nameDate;
  if (dates.size > 1) {
    errors.push(`The file covers ${dates.size} different dates (${[...dates].sort().join(', ')}) — expected one day per file`);
  }
  if (nameDate && dates.size === 1 && nameDate !== businessDate) {
    errors.push(`Filename says ${nameDate} but the rows are dated ${businessDate}`);
  }

  if (!rows.length && !errors.length) errors.push('No data rows found');

  return { rows, errors, warnings, businessDate, headerMissing: [] };
}

/** Counts for the email and the ledger. */
export function summarise(rows) {
  const byStatus = {};
  for (const r of rows) {
    const k = `${r.status_code}`;
    byStatus[k] = (byStatus[k] || 0) + 1;
  }
  return {
    total: rows.length,
    present: rows.filter((r) => r.status === 'Present').length,
    late: rows.filter((r) => r.status === 'Late').length,
    absent: rows.filter((r) => r.status === 'Absent').length,
    left_early: rows.filter((r) => r.early_leave_minutes > 0).length,
    missing_punch: rows.filter((r) => r.missing_punch).length,
    by_status_code: byStatus,
  };
}
