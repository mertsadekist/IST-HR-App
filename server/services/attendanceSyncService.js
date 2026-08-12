/**
 * The attendance Drive sync: deciding which files to take, importing their rows,
 * and keeping the ledger that makes "only the new ones" true.
 *
 * Split so the awkward parts are testable without Drive: `planFiles` is pure
 * given a file list, and `importRows` takes already-parsed rows. Only `runSync`
 * touches the network.
 *
 * See docs/attendance_drive_sync_plan.md.
 */
import { parseAttendanceCsv, summarise, businessDateFromName } from './attendanceFileParser.js';
import { listFolderFiles, downloadFileText, isConfigured } from './googleDriveClient.js';
import { addAudit } from './auditService.js';
import { getAppSetting, setAppSetting } from './appSettings.js';

/** Company path in the file -> our company id. Reporting only; never acted on. */
const COMPANY_HINTS = Object.freeze({ 'IST Markets': 2, 'IST Real Estate': 1 });

/**
 * Which files the sync would take, and why it would leave the rest.
 *
 * Pure: hand it the Drive listing and the ledger rows and it decides. A file is
 * taken when it is new, or when its checksum has changed since it was imported —
 * that second case is what makes a corrected re-upload of the same day import
 * again instead of being skipped as "already done".
 */
export function planFiles(driveFiles, ledgerRows, { startDate = null } = {}) {
  const known = new Map(ledgerRows.map((r) => [r.drive_file_id, r]));
  const toImport = [];
  const toSkip = [];

  for (const f of driveFiles) {
    const businessDate = businessDateFromName(f.name);
    const prev = known.get(f.id);
    const add = (list, reason) => list.push({ file: f, businessDate, previous: prev || null, reason });

    if (!/\.csv$/i.test(f.name)) { add(toSkip, 'not a .csv'); continue; }
    if (!businessDate) { add(toSkip, 'no date in the filename'); continue; }
    // The floor exists so the first run does not swallow a year of history and
    // write over months of hand-entered days.
    if (startDate && businessDate < startDate) { add(toSkip, `dated before the sync start date (${startDate})`); continue; }

    if (prev && prev.status === 'Imported' && prev.md5_checksum && prev.md5_checksum === f.md5Checksum) {
      add(toSkip, 'already imported, unchanged'); continue;
    }
    if (prev && prev.md5_checksum && f.md5Checksum && prev.md5_checksum !== f.md5Checksum) {
      add(toImport, 're-uploaded — checksum changed since the last import'); continue;
    }
    add(toImport, prev ? `previously ${prev.status}` : 'new file');
  }

  // Oldest first, so a backlog imports in the order the days happened.
  toImport.sort((a, b) => String(a.businessDate).localeCompare(String(b.businessDate)));
  return { toImport, toSkip };
}

/** Records what Drive reported about a file, and returns its ledger row id. */
export async function upsertLedgerFile(pool, file, businessDate) {
  const [r] = await pool.query(
    `INSERT INTO attendance_sync_files
       (drive_file_id, file_name, business_date, md5_checksum, size_bytes, drive_modified_at, status)
     VALUES (?, ?, ?, ?, ?, ?, 'Pending')
     ON DUPLICATE KEY UPDATE
       file_name = VALUES(file_name), business_date = VALUES(business_date),
       md5_checksum = VALUES(md5_checksum), size_bytes = VALUES(size_bytes),
       drive_modified_at = VALUES(drive_modified_at)`,
    [file.id, file.name, businessDate, file.md5Checksum || null,
      file.size ? Number(file.size) : null, file.modifiedTime ? new Date(file.modifiedTime) : null]);
  if (r.insertId) return r.insertId;
  const [[row]] = await pool.query('SELECT id FROM attendance_sync_files WHERE drive_file_id = ?', [file.id]);
  return row.id;
}

/**
 * Writes one day's parsed rows.
 *
 * Everything that needs a decision happens here:
 *  - a device id with no employee is reported, never invented;
 *  - a day the person had approved leave becomes 'On Leave' rather than
 *    'Absent', because payroll deducts on both and would otherwise take the
 *    same day twice;
 *  - a row a human already corrected is left alone unless explicitly overridden.
 *
 * @returns {Promise<object>} the report the email and the ledger are built from
 */
export async function importRows(pool, {
  rows, businessDate, syncFileId = null, actorId = null, overwriteManual = false,
}) {
  const report = {
    business_date: businessDate,
    inserted: 0, updated: 0,
    skipped_manual: [], unmatched: [], ignored: [],
    reclassified_leave: [], missing_punch: [], company_mismatch: [],
    errors: [],
  };
  if (!rows.length) return report;

  const [emps] = await pool.query(
    `SELECT id, attendance_id, company_id, CONCAT(first_name, ' ', last_name) AS name, status
       FROM employees WHERE attendance_id IS NOT NULL AND attendance_id <> ''`);
  const byDevice = new Map(emps.map((e) => [String(e.attendance_id).trim(), e]));

  const [ignoredRows] = await pool.query('SELECT device_id FROM attendance_ignored_devices');
  const ignored = new Set(ignoredRows.map((i) => String(i.device_id).trim()));

  // Which of these employees already have a row for the day, and who put it
  // there. One query rather than one per row.
  const empIds = rows.map((r) => byDevice.get(r.device_id)?.id).filter(Boolean);
  const existing = new Map();
  if (empIds.length) {
    const [ex] = await pool.query(
      'SELECT employee_id, source FROM attendance WHERE work_date = ? AND employee_id IN (?)',
      [businessDate, empIds]);
    for (const e of ex) existing.set(e.employee_id, e.source);
  }

  // Approved leave covering the day. Absence and leave are different facts and
  // payroll treats them differently, so the file's "no punches" must not be
  // recorded as unauthorised absence when the day was granted.
  const onLeave = new Map();
  if (empIds.length) {
    const [lv] = await pool.query(
      `SELECT lr.employee_id, lt.name AS type_name
         FROM leave_requests lr JOIN leave_types lt ON lr.leave_type_id = lt.id
        WHERE lr.status = 'Approved' AND lr.employee_id IN (?)
          AND ? BETWEEN lr.start_date AND lr.end_date`, [empIds, businessDate]);
    for (const l of lv) onLeave.set(l.employee_id, l.type_name);
  }

  for (const row of rows) {
    if (ignored.has(row.device_id)) {
      report.ignored.push({ device_id: row.device_id, name: row.name });
      continue;
    }
    const emp = byDevice.get(row.device_id);
    if (!emp) {
      report.unmatched.push({ device_id: row.device_id, name: row.name, status: row.status_label });
      continue;
    }

    const prevSource = existing.get(emp.id);
    if (prevSource === 'Manual' && !overwriteManual) {
      report.skipped_manual.push({ employee: emp.name, date: businessDate });
      continue;
    }

    let status = row.status;
    const leaveType = onLeave.get(emp.id);
    if (leaveType && status === 'Absent') {
      status = 'On Leave';
      report.reclassified_leave.push({ employee: emp.name, date: businessDate, leave_type: leaveType });
    }

    if (row.missing_punch) {
      report.missing_punch.push({ employee: emp.name, date: businessDate, check_in: row.check_in });
    }

    // The company path the fingerprint system believes, checked against the
    // record. Reported so a genuine mismatch surfaces; the record still wins.
    const tail = String(row.department_path || '').split('>').pop().trim();
    const claimed = COMPANY_HINTS[tail];
    if (claimed && claimed !== emp.company_id) {
      report.company_mismatch.push({
        employee: emp.name, file_says: tail, record_company_id: emp.company_id,
      });
    }

    const notes = [
      row.status_label,
      row.late_minutes ? `late ${row.late_minutes}m` : null,
      row.early_leave_minutes ? `left early ${row.early_leave_minutes}m` : null,
      row.missing_punch ? 'no check-out recorded' : null,
      leaveType && row.status === 'Absent' ? `approved leave: ${leaveType}` : null,
    ].filter(Boolean).join(' · ').slice(0, 500);

    // Whether this is a new day or a correction of one already recorded is
    // decided from the snapshot taken before the loop, not from affectedRows:
    // with this connection an unchanged upsert also reports 1, so affectedRows
    // cannot tell an insert from a no-op update.
    const wasPresent = existing.has(emp.id);

    try {
      await pool.query(
        `INSERT INTO attendance
           (company_id, employee_id, work_date, check_in, check_out, work_hours, status, notes,
            late_minutes, early_leave_minutes, scheduled_in, scheduled_out,
            source, source_status_code, sync_file_id, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Drive Sync', ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           check_in = VALUES(check_in), check_out = VALUES(check_out),
           work_hours = VALUES(work_hours), status = VALUES(status), notes = VALUES(notes),
           late_minutes = VALUES(late_minutes), early_leave_minutes = VALUES(early_leave_minutes),
           scheduled_in = VALUES(scheduled_in), scheduled_out = VALUES(scheduled_out),
           source = VALUES(source), source_status_code = VALUES(source_status_code),
           sync_file_id = VALUES(sync_file_id)`,
        [emp.company_id, emp.id, businessDate,
          row.check_in ? `${businessDate} ${row.check_in}` : null,
          row.check_out ? `${businessDate} ${row.check_out}` : null,
          row.work_hours, status, notes,
          row.late_minutes || null, row.early_leave_minutes || null,
          row.scheduled_in, row.scheduled_out,
          row.status_code, syncFileId, actorId]);
      if (wasPresent) report.updated++; else report.inserted++;
      // So a second pass in the same run counts as an update, not another insert.
      existing.set(emp.id, 'Drive Sync');
    } catch (e) {
      report.errors.push({ employee: emp.name, device_id: row.device_id, message: e.message });
    }
  }

  return report;
}

/** Merges per-file reports into the one summary the email is written from. */
function mergeReports(reports) {
  const out = {
    inserted: 0, updated: 0, files: [],
    unmatched: [], skipped_manual: [], reclassified_leave: [],
    missing_punch: [], company_mismatch: [], errors: [],
  };
  const seenUnmatched = new Set();
  for (const r of reports) {
    out.inserted += r.inserted;
    out.updated += r.updated;
    out.files.push(r.business_date);
    for (const u of r.unmatched) {
      // The same unknown device appears in every day's file; list it once.
      if (seenUnmatched.has(u.device_id)) continue;
      seenUnmatched.add(u.device_id);
      out.unmatched.push(u);
    }
    out.skipped_manual.push(...r.skipped_manual);
    out.reclassified_leave.push(...r.reclassified_leave);
    out.missing_punch.push(...r.missing_punch);
    out.company_mismatch.push(...r.company_mismatch);
    out.errors.push(...r.errors);
  }
  return out;
}

/**
 * Claims today's run.
 *
 * The unique key on (run_date, trigger_type) is what makes this atomic: whoever
 * inserts the row owns the run. A redeploy at 05:30 therefore neither repeats
 * the morning's work nor skips the day, without any lock to leak.
 *
 * @returns {Promise<number|null>} the run id, or null if it is already claimed
 */
export async function claimRun(pool, { trigger = 'Scheduled', runDate, actorId = null }) {
  // Only the scheduled run is exactly-once. A manual run or a retry passes NULL,
  // and MySQL permits any number of NULLs in a unique index, so a human can
  // retry a file as often as they need without fighting the claim.
  const claimKey = trigger === 'Scheduled' ? `sched:${runDate}` : null;
  try {
    const [r] = await pool.query(
      'INSERT INTO attendance_sync_runs (run_date, trigger_type, status, started_by, claim_key) VALUES (?, ?, ?, ?, ?)',
      [runDate, trigger, 'Running', actorId, claimKey]);
    return r.insertId;
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') return null;
    throw e;
  }
}

/**
 * The start-date floor: files dated before it are never imported.
 *
 * It is **persisted the first time it is resolved**, and that is the whole
 * point. The first version recomputed "today" on every run while nothing had
 * imported yet — so the floor advanced with the calendar, each morning's file
 * was always dated the day before it, and nothing would ever have imported.
 * A floor that moves is not a floor.
 *
 * An explicit ATTENDANCE_SYNC_START_DATE always wins, so it can be widened or
 * narrowed later without touching the stored value.
 *
 * @returns {Promise<string|null>} YYYY-MM-DD, or null for no floor
 */
export async function resolveStartDate(pool, { today = new Date().toISOString().slice(0, 10) } = {}) {
  const configured = (process.env.ATTENDANCE_SYNC_START_DATE || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(configured)) return configured;

  const stored = await getAppSetting('attendance_sync_start_date', null);
  if (stored && /^\d{4}-\d{2}-\d{2}$/.test(stored)) return stored;

  // First time only: pin it and remember it.
  await setAppSetting('attendance_sync_start_date', today);
  return today;
}

/**
 * One full pass: list, plan, import, record.
 *
 * @param {object} opts
 * @param {'Scheduled'|'Manual'|'Retry'} opts.trigger
 * @param {boolean} opts.overwriteManual  force over hand-corrected rows
 * @param {string[]} opts.onlyFileIds     restrict to specific Drive files (retry)
 */
export async function runSync(pool, {
  trigger = 'Scheduled', actorId = null, overwriteManual = false, onlyFileIds = null, runDate = null,
} = {}) {
  const today = runDate || new Date().toISOString().slice(0, 10);

  if (!isConfigured()) {
    return { ok: false, skipped: true, reason: 'Google Drive is not configured', run_id: null };
  }

  const runId = await claimRun(pool, { trigger, runDate: today, actorId });
  if (!runId) {
    return { ok: true, skipped: true, reason: `The scheduled run for ${today} has already happened`, run_id: null };
  }

  const finish = async (fields) => {
    await pool.query(
      'UPDATE attendance_sync_runs SET status = ?, files_seen = ?, files_imported = ?, files_failed = ?, rows_written = ?, summary = ?, error = ?, finished_at = NOW() WHERE id = ?',
      [fields.status, fields.filesSeen || 0, fields.filesImported || 0, fields.filesFailed || 0,
        fields.rowsWritten || 0, JSON.stringify(fields.summary || {}), fields.error || null, runId]);
  };

  try {
    const driveFiles = await listFolderFiles();
    const [ledger] = await pool.query('SELECT drive_file_id, status, md5_checksum FROM attendance_sync_files');
    const startDate = await resolveStartDate(pool);
    let { toImport, toSkip } = planFiles(driveFiles, ledger, { startDate });
    if (onlyFileIds?.length) {
      const wanted = new Set(onlyFileIds);
      toImport = driveFiles.filter((f) => wanted.has(f.id))
        .map((f) => ({ file: f, businessDate: businessDateFromName(f.name), reason: 'retry' }));
    }

    // Files that will never be taken are recorded once so they stop being
    // reconsidered every morning for the rest of the folder's life.
    for (const s of toSkip) {
      if (s.previous) continue;
      const id = await upsertLedgerFile(pool, s.file, s.businessDate);
      await pool.query(
        "UPDATE attendance_sync_files SET status = 'Skipped', skip_reason = ? WHERE id = ?",
        [s.reason.slice(0, 200), id]);
    }

    const reports = [];
    let filesImported = 0, filesFailed = 0;

    for (const item of toImport) {
      const fileId = await upsertLedgerFile(pool, item.file, item.businessDate);
      await pool.query('UPDATE attendance_sync_files SET attempts = attempts + 1 WHERE id = ?', [fileId]);
      try {
        const text = await downloadFileText(item.file.id);
        const parsed = parseAttendanceCsv(text, item.file.name);
        if (parsed.errors.length) throw new Error(parsed.errors.join('; '));

        const report = await importRows(pool, {
          rows: parsed.rows, businessDate: parsed.businessDate,
          syncFileId: fileId, actorId, overwriteManual,
        });
        report.warnings = parsed.warnings;
        reports.push(report);
        filesImported++;

        const s = summarise(parsed.rows);
        await pool.query(
          `UPDATE attendance_sync_files SET status = 'Imported', business_date = ?, rows_total = ?,
             rows_matched = ?, rows_unmatched = ?, inserted = ?, updated = ?, skipped = ?,
             report = ?, error = NULL, imported_at = NOW() WHERE id = ?`,
          [parsed.businessDate, s.total,
            parsed.rows.length - report.unmatched.length - report.ignored.length,
            report.unmatched.length, report.inserted, report.updated,
            report.skipped_manual.length, JSON.stringify({ ...report, counts: s }), fileId]);
      } catch (err) {
        filesFailed++;
        await pool.query(
          "UPDATE attendance_sync_files SET status = 'Failed', error = ? WHERE id = ?",
          [String(err.message).slice(0, 1000), fileId]);
        reports.push({
          business_date: item.businessDate, inserted: 0, updated: 0,
          unmatched: [], skipped_manual: [], reclassified_leave: [], missing_punch: [],
          company_mismatch: [], ignored: [], errors: [{ file: item.file.name, message: err.message }],
        });
      }
    }

    const summary = mergeReports(reports);
    summary.files_seen = driveFiles.length;
    summary.files_imported = filesImported;
    summary.files_failed = filesFailed;
    summary.files_skipped = toSkip.length;
    // Nothing new is a signal in itself: the source system may have stopped
    // producing files, and silence would hide that for weeks.
    const status = filesFailed ? 'Failed' : (filesImported ? 'Completed' : 'No File');

    await finish({
      status, filesSeen: driveFiles.length, filesImported, filesFailed,
      rowsWritten: summary.inserted + summary.updated, summary,
      error: filesFailed ? `${filesFailed} file(s) failed` : null,
    });

    await addAudit(pool, { id: actorId, name: actorId ? undefined : 'System (attendance sync)' },
      'Attendance', 'Drive Sync',
      `${trigger} sync: ${filesImported} file(s) imported, ${summary.inserted} new / ${summary.updated} updated row(s)`
      + (summary.unmatched.length ? `, ${summary.unmatched.length} unmatched device id(s)` : '')
      + (filesFailed ? `, ${filesFailed} failed` : ''));

    return { ok: !filesFailed, run_id: runId, status, summary };
  } catch (err) {
    await finish({ status: 'Failed', error: String(err.message).slice(0, 1000) });
    return { ok: false, run_id: runId, status: 'Failed', error: err.message };
  }
}
