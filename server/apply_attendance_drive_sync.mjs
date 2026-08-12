// Idempotent migration: the daily attendance sync from Google Drive.
//
// See docs/attendance_drive_sync_plan.md. Two new tables and a handful of
// columns on `attendance`.
//
// The columns exist so the facts behind a status are not thrown away. The source
// file reports lateness and early departure in seconds, and "Present" for
// somebody who left two hours early is misleading — the decision was to keep the
// status and record the minutes, so both have to be stored.
//
// `source` is the one that earns its place operationally: once HR corrects a day
// by hand, the next morning's sync must not silently undo it. The importer skips
// rows whose existing source is 'Manual' unless it is explicitly told to
// overwrite.
//
// Safe to re-run.
import pool from './config/db.js';

async function columnExists(table, col) {
  const [r] = await pool.query(
    `SELECT COUNT(*) c FROM information_schema.columns
      WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`, [table, col]);
  return r[0].c > 0;
}

const COLS = [
  // Minutes, not seconds: the file gives seconds, but nobody reads an attendance
  // report in seconds and the rounding loss is irrelevant at this precision.
  ['late_minutes', 'ALTER TABLE attendance ADD COLUMN late_minutes SMALLINT NULL'],
  ['early_leave_minutes', 'ALTER TABLE attendance ADD COLUMN early_leave_minutes SMALLINT NULL'],
  // The shift the day was judged against, which can change over time. Without
  // it, a past day cannot be re-explained once the schedule moves.
  ['scheduled_in', 'ALTER TABLE attendance ADD COLUMN scheduled_in TIME NULL'],
  ['scheduled_out', 'ALTER TABLE attendance ADD COLUMN scheduled_out TIME NULL'],
  // Where the row came from. 'Manual' is what the sync refuses to overwrite.
  ['source', "ALTER TABLE attendance ADD COLUMN source ENUM('Manual','CSV Import','Drive Sync') NOT NULL DEFAULT 'Manual'"],
  // The raw code, kept verbatim: if the source system grows a code 6, it shows up
  // here instead of being silently folded into an existing status.
  ['source_status_code', 'ALTER TABLE attendance ADD COLUMN source_status_code TINYINT NULL'],
  ['sync_file_id', 'ALTER TABLE attendance ADD COLUMN sync_file_id INT NULL'],
];

const TABLES = [
  // One row per Drive file ever seen. The ledger is what makes "only the new
  // ones" cheap: the folder can grow to a year of files and the daily run still
  // does one listing call and downloads only what is not already here.
  `CREATE TABLE IF NOT EXISTS attendance_sync_files (
     id             INT AUTO_INCREMENT PRIMARY KEY,
     drive_file_id  VARCHAR(128) NOT NULL,
     file_name      VARCHAR(255) NOT NULL,
     business_date  DATE NULL,
     md5_checksum   VARCHAR(64) NULL,
     size_bytes     INT NULL,
     drive_modified_at TIMESTAMP NULL,
     status         ENUM('Pending','Imported','Failed','Skipped') NOT NULL DEFAULT 'Pending',
     skip_reason    VARCHAR(200) NULL,
     rows_total     SMALLINT NULL,
     rows_matched   SMALLINT NULL,
     rows_unmatched SMALLINT NULL,
     inserted       SMALLINT NULL,
     updated        SMALLINT NULL,
     skipped        SMALLINT NULL,
     report         JSON NULL,
     error          VARCHAR(1000) NULL,
     attempts       TINYINT NOT NULL DEFAULT 0,
     imported_at    TIMESTAMP NULL,
     created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
     UNIQUE KEY uq_sync_drive_file (drive_file_id),
     INDEX idx_sync_business_date (business_date),
     INDEX idx_sync_status (status)
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  // One row per scheduled run. The unique key on run_date is the run claim:
  // whoever inserts it owns the run, so a redeploy at 05:30 neither repeats the
  // morning's work nor skips the day.
  `CREATE TABLE IF NOT EXISTS attendance_sync_runs (
     id            INT AUTO_INCREMENT PRIMARY KEY,
     run_date      DATE NOT NULL,
     trigger_type  ENUM('Scheduled','Manual','Retry') NOT NULL DEFAULT 'Scheduled',
     status        ENUM('Running','Completed','Failed','No File') NOT NULL DEFAULT 'Running',
     files_seen    SMALLINT NOT NULL DEFAULT 0,
     files_imported SMALLINT NOT NULL DEFAULT 0,
     files_failed  SMALLINT NOT NULL DEFAULT 0,
     rows_written  SMALLINT NOT NULL DEFAULT 0,
     summary       JSON NULL,
     error         VARCHAR(1000) NULL,
     started_by    INT NULL,
     started_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
     finished_at   TIMESTAMP NULL,
     -- Only a SCHEDULED run is claimed: claim_key holds the date for those and
     -- NULL for manual runs and retries. MySQL allows many NULLs in a unique
     -- index, so the morning job is still exactly-once while a human can retry
     -- a file as often as they need.
     claim_key     VARCHAR(32) NULL,
     UNIQUE KEY uq_sync_run_claim (claim_key),
     INDEX idx_sync_run_started (started_at)
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  // Device IDs deliberately not imported: people in the fingerprint system who
  // are not employees here. Without this they reappear in the report every
  // single morning forever.
  `CREATE TABLE IF NOT EXISTS attendance_ignored_devices (
     id           INT AUTO_INCREMENT PRIMARY KEY,
     device_id    VARCHAR(64) NOT NULL,
     device_name  VARCHAR(200) NULL,
     reason       VARCHAR(300) NULL,
     created_by   INT NULL,
     created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
     UNIQUE KEY uq_ignored_device (device_id)
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
];

try {
  for (const ddl of TABLES) {
    await pool.query(ddl);
    const name = ddl.match(/CREATE TABLE IF NOT EXISTS (\w+)/)[1];
    console.log(`table ${name} ready`);
  }

  // The first version of this table keyed the claim on (run_date, trigger_type),
  // which meant a second retry in one day was refused. Bring an existing table
  // forward to the claim_key design.
  if (!(await columnExists('attendance_sync_runs', 'claim_key'))) {
    await pool.query('ALTER TABLE attendance_sync_runs ADD COLUMN claim_key VARCHAR(32) NULL');
    console.log('attendance_sync_runs.claim_key added');
  }
  const [[oldKey]] = await pool.query(
    `SELECT COUNT(*) c FROM information_schema.statistics
      WHERE table_schema = DATABASE() AND table_name = 'attendance_sync_runs'
        AND index_name = 'uq_sync_run_date'`);
  if (oldKey.c) {
    await pool.query('ALTER TABLE attendance_sync_runs DROP INDEX uq_sync_run_date');
    console.log('dropped the old (run_date, trigger_type) claim key');
  }
  const [[newKey]] = await pool.query(
    `SELECT COUNT(*) c FROM information_schema.statistics
      WHERE table_schema = DATABASE() AND table_name = 'attendance_sync_runs'
        AND index_name = 'uq_sync_run_claim'`);
  if (!newKey.c) {
    await pool.query('ALTER TABLE attendance_sync_runs ADD UNIQUE KEY uq_sync_run_claim (claim_key)');
    console.log('claim key uq_sync_run_claim added');
  }

  for (const [col, ddl] of COLS) {
    if (!(await columnExists('attendance', col))) {
      await pool.query(ddl);
      console.log(`attendance.${col} added`);
    } else {
      console.log(`attendance.${col} already present`);
    }
  }

  // Existing rows predate the sync. They were entered by hand or by the old
  // importer, and either way they are not the sync's to overwrite — 'Manual' is
  // the correct and protective default for all of them.
  // `manual` alone is a reserved word in MySQL 8 — alias it explicitly.
  const [[counts]] = await pool.query(
    "SELECT COUNT(*) AS total, SUM(source = 'Manual') AS manual_rows FROM attendance");
  console.log(`attendance rows: ${counts.total} (${counts.manual_rows} marked Manual)`);

  console.log('ATTENDANCE_DRIVE_SYNC MIGRATION OK');
} catch (e) {
  console.error('MIGRATION ERROR:', e.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
