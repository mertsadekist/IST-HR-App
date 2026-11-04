// Idempotent migration: attendance sync from Hik Central replaces the Google
// Drive sync.
//
// What changes in the database:
//
//  - attendance.source gains 'Hik Central'. 'Drive Sync' STAYS in the enum: every
//    day imported from Drive is history, and dropping the value would orphan
//    those rows (and fail outright on a table that still holds them).
//  - attendance.punch_count: how many door punches a day was built from. It is
//    the evidence behind "first in / last out" — a day built from one punch and
//    a day built from nine are different claims.
//  - hik_sync_runs: one row per sync pass worth remembering. Live passes that
//    change nothing are not recorded (see hikSyncService).
//
// What does NOT change: attendance_sync_files / attendance_sync_runs, the Drive
// sync's ledger, are left exactly as they are. They hold the record of what was
// imported and nothing writes to them any more. Drop them by hand when that
// history is no longer wanted:
//
//     DROP TABLE attendance_sync_files, attendance_sync_runs;
//
// attendance_ignored_devices is kept and still used: it lists person ids in the
// access-control system that are deliberately not employees here.
//
// Safe to re-run.
import pool from './config/db.js';

async function columnExists(table, col) {
  const [r] = await pool.query(
    `SELECT COUNT(*) c FROM information_schema.columns
      WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`, [table, col]);
  return r[0].c > 0;
}

try {
  // 1. attendance.source: add 'Hik Central', keep every value already there.
  const [[src]] = await pool.query(
    `SELECT COLUMN_TYPE FROM information_schema.columns
      WHERE table_schema = DATABASE() AND table_name = 'attendance' AND column_name = 'source'`);
  if (!src) {
    throw new Error('attendance.source is missing — run apply_attendance_drive_sync.mjs first');
  }
  // 'Self Service' marks a day an employee checked in for through the app. It is not
  // door evidence, so the sync may replace it with the punches — unlike 'Manual'.
  const wanted = ['Hik Central', 'Self Service'];
  if (wanted.some((v) => !src.COLUMN_TYPE.includes(`'${v}'`))) {
    const existing = (src.COLUMN_TYPE.match(/'([^']+)'/g) || []).map((s) => s.slice(1, -1));
    const list = [...new Set([...existing, ...wanted])].map((v) => `'${v}'`).join(',');
    await pool.query(`ALTER TABLE attendance MODIFY COLUMN source ENUM(${list}) NOT NULL DEFAULT 'Manual'`);
    console.log("attendance.source widened with 'Hik Central' and 'Self Service'");
  } else {
    console.log("attendance.source already allows 'Hik Central' and 'Self Service'");
  }

  // 2. attendance.punch_count
  if (!(await columnExists('attendance', 'punch_count'))) {
    await pool.query('ALTER TABLE attendance ADD COLUMN punch_count SMALLINT NULL');
    console.log('attendance.punch_count added');
  } else {
    console.log('attendance.punch_count already present');
  }

  // 3. hik_sync_runs
  await pool.query(`CREATE TABLE IF NOT EXISTS hik_sync_runs (
     id             INT AUTO_INCREMENT PRIMARY KEY,
     trigger_type   ENUM('Live','Scheduled','Manual','Backfill') NOT NULL DEFAULT 'Live',
     status         ENUM('Running','Completed','Failed') NOT NULL DEFAULT 'Running',
     date_from      DATE NULL,
     date_to        DATE NULL,
     events_read    INT NOT NULL DEFAULT 0,
     rows_inserted  SMALLINT NOT NULL DEFAULT 0,
     rows_updated   SMALLINT NOT NULL DEFAULT 0,
     rows_unchanged SMALLINT NOT NULL DEFAULT 0,
     absences       SMALLINT NOT NULL DEFAULT 0,
     summary        JSON NULL,
     error          VARCHAR(1000) NULL,
     started_by     INT NULL,
     started_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
     finished_at    TIMESTAMP NULL,
     -- Only the SCHEDULED daily close is claimed: claim_key holds the date for
     -- it and NULL for everything else, so a redeploy at 05:30 cannot repeat the
     -- morning while people can still run as many manual passes as they like.
     claim_key      VARCHAR(32) NULL,
     UNIQUE KEY uq_hik_run_claim (claim_key),
     INDEX idx_hik_run_started (started_at)
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  console.log('table hik_sync_runs ready');

  const [[counts]] = await pool.query(
    `SELECT COUNT(*) AS total, SUM(source = 'Drive Sync') AS drive_rows,
            SUM(source = 'Hik Central') AS hik_rows FROM attendance`);
  console.log(`attendance rows: ${counts.total} (${counts.drive_rows || 0} from Drive, ${counts.hik_rows || 0} from Hik Central)`);

  console.log('ATTENDANCE_HIK_SYNC MIGRATION OK');
} catch (e) {
  console.error('MIGRATION ERROR:', e.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
