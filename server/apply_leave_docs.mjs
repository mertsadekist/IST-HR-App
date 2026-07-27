// Idempotent migration: supporting documents + decision accountability for leave.
//
//  - leave_files            : scanned proof attached to a request. Two kinds —
//                             'request_proof'  (the original written request, e.g. the email)
//                             'approval_proof' (the manager's approval/rejection: chat, reply, note)
//  - leave_requests.approver_name : the manager who actually made the call. Distinct from
//                             decided_by, which is the FK to the system user who clicked —
//                             approvals are often given verbally or over chat by someone
//                             who never logs in.
//  - leave_types.paid_mode  : Full / Half / None. Kept alongside the existing is_paid
//                             boolean (which still drives the entitlement cap) and
//                             backfilled from it, so current behaviour is unchanged.
//  - Seeds Emergency Leave + Immediate Leave as global types.
//
// Safe to re-run.
import pool from './config/db.js';

async function columnExists(table, col) {
  const [r] = await pool.query(
    `SELECT COUNT(*) c FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`,
    [table, col]);
  return r[0].c > 0;
}

const LEAVE_FILES = `CREATE TABLE IF NOT EXISTS leave_files (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  leave_request_id INT NOT NULL,
  company_id       INT NOT NULL,
  kind             ENUM('request_proof','approval_proof') NOT NULL DEFAULT 'request_proof',
  file_name        VARCHAR(255) NULL,
  file_type        VARCHAR(100) NULL,
  file_size        INT NULL,
  storage_key      VARCHAR(500) NOT NULL,
  uploaded_by      INT NULL,
  uploaded_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_leave_file_req (leave_request_id, kind),
  FOREIGN KEY (leave_request_id) REFERENCES leave_requests(id) ON DELETE CASCADE,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`;

// Guarded per-name: the original seed block in leave_module.sql only runs when
// NO global type exists at all, so appending to it would silently no-op here.
const NEW_TYPES = [
  ['Emergency Leave', 5, 1, '#ea580c'],
  ['Immediate Leave', 0, 0, '#7c3aed'],
];

try {
  await pool.query(LEAVE_FILES);
  console.log('leave_files ready');

  if (!(await columnExists('leave_requests', 'approver_name'))) {
    await pool.query('ALTER TABLE leave_requests ADD COLUMN approver_name VARCHAR(200) NULL AFTER decision_note');
    console.log('leave_requests.approver_name added');
  } else {
    console.log('leave_requests.approver_name already present');
  }

  if (!(await columnExists('leave_types', 'paid_mode'))) {
    await pool.query("ALTER TABLE leave_types ADD COLUMN paid_mode ENUM('Full','Half','None') NOT NULL DEFAULT 'Full' AFTER is_paid");
    // Preserve existing semantics exactly: paid types become Full, unpaid become None.
    await pool.query("UPDATE leave_types SET paid_mode = CASE WHEN is_paid THEN 'Full' ELSE 'None' END");
    console.log('leave_types.paid_mode added and backfilled from is_paid');
  } else {
    console.log('leave_types.paid_mode already present');
  }

  for (const [name, days, isPaid, color] of NEW_TYPES) {
    const [[exists]] = await pool.query('SELECT id FROM leave_types WHERE company_id IS NULL AND name = ? LIMIT 1', [name]);
    if (exists) { console.log(`leave type "${name}" already present`); continue; }
    await pool.query('INSERT INTO leave_types SET ?', {
      company_id: null, name, default_days: days, is_paid: isPaid,
      paid_mode: isPaid ? 'Full' : 'None', color, status: 'Active',
    });
    console.log(`leave type "${name}" seeded`);
  }

  console.log('LEAVE_DOCS MIGRATION OK');
} catch (e) {
  console.error('MIGRATION ERROR:', e.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
