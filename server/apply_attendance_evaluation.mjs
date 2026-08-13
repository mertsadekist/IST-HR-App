// Idempotent migration: the attendance evaluator's output.
//
// Phase 2 of docs/attendance_schedules_and_exceptions_plan.md — SHADOW MODE.
// Everything here is write-only-by-the-engine and read-only-by-humans. The
// evaluator's verdict lands in the `eval_*` columns beside the stored values,
// never on top of them, so the two can be compared for a few weeks before
// anything is trusted.
//
// That separation is not caution for its own sake. Verified in payrollService:
// the deduction is (unpaid leave days + COUNT(status = 'Absent')) × gross / 30.
// Any day the engine marks Absent would cost somebody a full day's pay, so the
// engine gets to say what it thinks long before it gets to say what is true.
//
// Phase 3 will copy the device's figures into device_* columns and let the
// engine own `status` / `late_minutes` / `early_leave_minutes`. Nothing in this
// migration does that.
//
// Safe to re-run.
import pool from './config/db.js';
import { EXCEPTION_TYPE_KEYS, EXCEPTION_STATUSES, EVAL_STATUSES, SEVERITIES }
  from './config/attendanceExceptions.js';

const quote = (values) => values.map((v) => `'${v}'`).join(',');

async function columnExists(table, col) {
  const [r] = await pool.query(
    `SELECT COUNT(*) c FROM information_schema.columns
      WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`, [table, col]);
  return r[0].c > 0;
}

// The engine's opinion, parked beside the stored values rather than over them.
const COLS = [
  ['eval_status', `ALTER TABLE attendance ADD COLUMN eval_status ENUM(${quote(EVAL_STATUSES)}) NULL`],
  ['eval_late_minutes', 'ALTER TABLE attendance ADD COLUMN eval_late_minutes SMALLINT NULL'],
  ['eval_early_leave_minutes', 'ALTER TABLE attendance ADD COLUMN eval_early_leave_minutes SMALLINT NULL'],
  // Net of the scheduled break — the break can never be measured from a feed
  // that reports only the first and last punch of the day.
  ['eval_worked_minutes', 'ALTER TABLE attendance ADD COLUMN eval_worked_minutes SMALLINT NULL'],
  ['expected_in', 'ALTER TABLE attendance ADD COLUMN expected_in TIME NULL'],
  ['expected_out', 'ALTER TABLE attendance ADD COLUMN expected_out TIME NULL'],
  ['expected_minutes', 'ALTER TABLE attendance ADD COLUMN expected_minutes SMALLINT NULL'],
  ['schedule_id', 'ALTER TABLE attendance ADD COLUMN schedule_id INT NULL'],
  // The resolved rule, frozen on the day it was applied. This is what makes a
  // past decision re-explainable without walking a graph of versioned policy
  // tables to reconstruct what the rule used to be.
  ['schedule_snapshot', 'ALTER TABLE attendance ADD COLUMN schedule_snapshot JSON NULL'],
  ['evaluated_at', 'ALTER TABLE attendance ADD COLUMN evaluated_at TIMESTAMP NULL'],
  ['evaluation_version', 'ALTER TABLE attendance ADD COLUMN evaluation_version SMALLINT NULL'],
];

const TABLES = [
  // One case per (employee, date, type).
  //
  // Keyed on employee_id + work_date rather than attendance_id, because the most
  // consequential exception of all — ABSENT_NO_RECORD — is about a day that has
  // no attendance row to point at. Shadow mode must not invent rows to hang
  // cases off, so the case carries the date itself.
  `CREATE TABLE IF NOT EXISTS attendance_exceptions (
     id             INT AUTO_INCREMENT PRIMARY KEY,
     employee_id    INT NOT NULL,
     company_id     INT NOT NULL,
     work_date      DATE NOT NULL,
     attendance_id  INT NULL,
     type           ENUM(${quote(EXCEPTION_TYPE_KEYS)}) NOT NULL,
     severity       ENUM(${quote(SEVERITIES)}) NOT NULL DEFAULT 'Review',
     detail         VARCHAR(600) NULL,
     late_minutes   SMALLINT NULL,
     early_leave_minutes SMALLINT NULL,
     worked_minutes SMALLINT NULL,
     expected_minutes SMALLINT NULL,
     status         ENUM(${quote(EXCEPTION_STATUSES)}) NOT NULL DEFAULT 'Open',
     resolution     VARCHAR(600) NULL,
     resolved_by    INT NULL,
     resolved_at    TIMESTAMP NULL,
     -- TRUE while the engine is only observing. Phase 3 writes FALSE, and the
     -- distinction is what stops a month of shadow findings being mistaken for
     -- live cases anyone acted on.
     shadow         BOOLEAN NOT NULL DEFAULT TRUE,
     evaluation_version SMALLINT NULL,
     first_seen_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
     updated_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
     -- Re-running the evaluator must update a case, never duplicate it.
     UNIQUE KEY uq_exc_emp_date_type (employee_id, work_date, type),
     INDEX idx_exc_open (status, work_date),
     INDEX idx_exc_company (company_id, work_date),
     INDEX idx_exc_employee (employee_id, work_date),
     FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
     FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
     FOREIGN KEY (resolved_by) REFERENCES users(id) ON DELETE SET NULL
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  // One row per evaluator run, so a sweep can be explained and undone.
  `CREATE TABLE IF NOT EXISTS attendance_evaluation_runs (
     id             INT AUTO_INCREMENT PRIMARY KEY,
     company_id     INT NULL,
     date_from      DATE NOT NULL,
     date_to        DATE NOT NULL,
     trigger_type   ENUM('Scheduled','Manual','Post-Sync') NOT NULL DEFAULT 'Manual',
     shadow         BOOLEAN NOT NULL DEFAULT TRUE,
     days_evaluated INT NOT NULL DEFAULT 0,
     rows_updated   INT NOT NULL DEFAULT 0,
     exceptions_opened  INT NOT NULL DEFAULT 0,
     exceptions_updated INT NOT NULL DEFAULT 0,
     exceptions_closed  INT NOT NULL DEFAULT 0,
     disagreements  INT NOT NULL DEFAULT 0,
     summary        JSON NULL,
     error          VARCHAR(1000) NULL,
     started_by     INT NULL,
     started_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
     finished_at    TIMESTAMP NULL,
     evaluation_version SMALLINT NULL,
     INDEX idx_eval_run_started (started_at),
     FOREIGN KEY (started_by) REFERENCES users(id) ON DELETE SET NULL
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
];

try {
  for (const ddl of TABLES) {
    await pool.query(ddl);
    console.log(`table ${ddl.match(/CREATE TABLE IF NOT EXISTS (\w+)/)[1]} ready`);
  }
  for (const [col, ddl] of COLS) {
    if (!(await columnExists('attendance', col))) {
      await pool.query(ddl);
      console.log(`attendance.${col} added`);
    } else {
      console.log(`attendance.${col} already present`);
    }
  }

  const [[c]] = await pool.query(`
    SELECT (SELECT COUNT(*) FROM attendance_exceptions) exceptions,
           (SELECT COUNT(*) FROM attendance_evaluation_runs) runs,
           (SELECT COUNT(*) FROM attendance WHERE evaluated_at IS NOT NULL) evaluated,
           (SELECT COUNT(*) FROM attendance) total`);
  console.log(`exceptions: ${c.exceptions}, runs: ${c.runs}, attendance rows evaluated: ${c.evaluated}/${c.total}`);
  console.log('ATTENDANCE_EVALUATION MIGRATION OK');
} catch (e) {
  console.error('MIGRATION ERROR:', e.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
