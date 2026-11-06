// Idempotent migration: expiry tracking for employee documents.
//
// A lapsed passport, residence visa, Emirates ID or labour card is a legal
// problem for the company, not just the employee: MOHRE fines, a blocked WPS
// line, or someone who cannot travel back. Until now an employee document was
// a file and a category, with no date on it, so nothing could warn.
//
// This puts the identity of the document on the row:
//
//   doc_type          which official document it is. NULL for the files that are
//                     not one (a CV, a handover sheet), which the radar ignores.
//   doc_number        the passport / visa / ID number, as printed.
//   issue_date        optional, for the record.
//   expiry_date       watched by services/employeeDocumentExpiryService.js.
//   expiry_alert_sent the tightest threshold already warned, so the scheduler
//                     notifies once per threshold (see services/expiryAlerts.js).
//
// Existing rows keep doc_type NULL: guessing a type from the free-text category
// would put wrong documents on the radar. HR sets the type when they add the
// expiry date, and the radar lists who is still missing what.
// Safe to re-run.
import pool from './config/db.js';

async function columnExists(table, col) {
  const [r] = await pool.query(
    `SELECT COUNT(*) c FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`,
    [table, col]);
  return r[0].c > 0;
}

const COLS = [
  ['doc_type', "ALTER TABLE employee_documents ADD COLUMN doc_type ENUM('Passport','Residence Visa','Emirates ID','Labour Card','Health Insurance','Other ID') NULL AFTER category"],
  ['doc_number', 'ALTER TABLE employee_documents ADD COLUMN doc_number VARCHAR(64) NULL AFTER doc_type'],
  ['issue_date', 'ALTER TABLE employee_documents ADD COLUMN issue_date DATE NULL AFTER doc_number'],
  ['expiry_date', 'ALTER TABLE employee_documents ADD COLUMN expiry_date DATE NULL AFTER issue_date'],
  ['expiry_alert_sent', 'ALTER TABLE employee_documents ADD COLUMN expiry_alert_sent VARCHAR(20) NULL AFTER expiry_date'],
];

try {
  for (const [col, ddl] of COLS) {
    if (!(await columnExists('employee_documents', col))) {
      await pool.query(ddl);
      console.log(`employee_documents.${col} added`);
    } else {
      console.log(`employee_documents.${col} already present`);
    }
  }

  const [idx] = await pool.query(
    `SELECT COUNT(*) c FROM information_schema.statistics
      WHERE table_schema = DATABASE() AND table_name = 'employee_documents' AND index_name = 'idx_emp_doc_expiry'`);
  if (!idx[0].c) {
    await pool.query('ALTER TABLE employee_documents ADD INDEX idx_emp_doc_expiry (expiry_date)');
    console.log('employee_documents.idx_emp_doc_expiry added');
  }

  const [[n]] = await pool.query(
    'SELECT COUNT(*) total, SUM(doc_type IS NOT NULL) typed, SUM(expiry_date IS NOT NULL) dated FROM employee_documents');
  console.log(`employee documents: ${n.total} total, ${n.typed || 0} typed, ${n.dated || 0} with an expiry date`);
  console.log('EMPLOYEE_DOCUMENT_EXPIRY MIGRATION OK');
} catch (e) {
  console.error('MIGRATION ERROR:', e.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
