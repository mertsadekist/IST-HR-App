// Idempotent migration: link an attendance case to the leave that explains it.
//
// HR resolves a case by recording why it happened — a late arrival becomes an
// hour of Emergency Leave, an absence becomes a day of Unpaid Leave — and the
// leave type decides whether it costs the employee anything. The link is stored
// so the case can show what explained it and the leave can be found from it.
//
// Partial days are the reason this works at all: leave_requests.days is
// DECIMAL(6,2), so a 74-minute late arrival is 0.15 of a day rather than a whole
// one. Recording it as a full day would deduct 100 dirhams for 74 minutes.
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
  if (!(await columnExists('attendance_exceptions', 'leave_request_id'))) {
    await pool.query(
      'ALTER TABLE attendance_exceptions ADD COLUMN leave_request_id INT NULL, '
      + 'ADD FOREIGN KEY (leave_request_id) REFERENCES leave_requests(id) ON DELETE SET NULL');
    console.log('attendance_exceptions.leave_request_id added');
  } else {
    console.log('attendance_exceptions.leave_request_id already present');
  }

  // How many minutes the excuse covers. Kept beside the link because the leave
  // itself only records a fraction of a day, and "0.15" is not something anyone
  // can read back as "he was 74 minutes late".
  if (!(await columnExists('attendance_exceptions', 'excused_minutes'))) {
    await pool.query('ALTER TABLE attendance_exceptions ADD COLUMN excused_minutes SMALLINT NULL');
    console.log('attendance_exceptions.excused_minutes added');
  } else {
    console.log('attendance_exceptions.excused_minutes already present');
  }

  const [[c]] = await pool.query(
    'SELECT COUNT(*) n, SUM(leave_request_id IS NOT NULL) linked FROM attendance_exceptions');
  console.log(`exceptions: ${c.n} (${c.linked || 0} explained by a leave record)`);
  console.log('EXCEPTION_LEAVE_LINK MIGRATION OK');
} catch (e) {
  console.error('MIGRATION ERROR:', e.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
