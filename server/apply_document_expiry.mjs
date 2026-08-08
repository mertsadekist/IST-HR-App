// Idempotent migration: expiry tracking for company documents.
//
// A trade licence, a lease, an insurance policy and an establishment card all
// expire, and the only warning is a date on a PDF nobody opens until it is
// needed. This puts the date on the record and warns before it passes.
//
// Not every document expires, though — a memorandum of association or a signed
// constitution has no end date, and forcing one would mean either a wrong date
// or a permanently "missing" field. So expiry is a MODE, not just a date:
//
//   expiry_mode = 'Not Set'    nobody has said yet. The honest default for
//                              documents already uploaded, and what the
//                              "needs attention" count is built on.
//               = 'No Expiry'  deliberately permanent. A positive statement,
//                              not an empty field, so it stops being asked about.
//               = 'Has Expiry'  expiry_date is required and is watched.
//
// expiry_alert_sent records the tightest threshold already warned, so the
// scheduler notifies once per threshold instead of on every pass.
// Safe to re-run.
import pool from './config/db.js';

async function columnExists(table, col) {
  const [r] = await pool.query(
    `SELECT COUNT(*) c FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`,
    [table, col]);
  return r[0].c > 0;
}

const COLS = [
  ['expiry_mode', "ALTER TABLE company_documents ADD COLUMN expiry_mode ENUM('Not Set','No Expiry','Has Expiry') NOT NULL DEFAULT 'Not Set'"],
  ['expiry_date', 'ALTER TABLE company_documents ADD COLUMN expiry_date DATE NULL'],
  ['issue_date', 'ALTER TABLE company_documents ADD COLUMN issue_date DATE NULL'],
  ['reminder_days', 'ALTER TABLE company_documents ADD COLUMN reminder_days SMALLINT NULL'],
  ['expiry_alert_sent', 'ALTER TABLE company_documents ADD COLUMN expiry_alert_sent VARCHAR(20) NULL'],
  ['document_name', 'ALTER TABLE company_documents ADD COLUMN document_name VARCHAR(255) NULL'],
  ['description', 'ALTER TABLE company_documents ADD COLUMN description VARCHAR(1000) NULL'],
];

try {
  for (const [col, ddl] of COLS) {
    if (!(await columnExists('company_documents', col))) {
      await pool.query(ddl);
      console.log(`company_documents.${col} added`);
    } else {
      console.log(`company_documents.${col} already present`);
    }
  }

  const [idx] = await pool.query(
    `SELECT COUNT(*) c FROM information_schema.statistics
      WHERE table_schema = DATABASE() AND table_name = 'company_documents' AND index_name = 'idx_doc_expiry'`);
  if (!idx[0].c) {
    await pool.query('ALTER TABLE company_documents ADD INDEX idx_doc_expiry (expiry_date)');
    console.log('company_documents.idx_doc_expiry added');
  }

  const [modes] = await pool.query('SELECT expiry_mode, COUNT(*) n FROM company_documents GROUP BY expiry_mode');
  console.log('documents by expiry mode:', modes.map((m) => `${m.expiry_mode}: ${m.n}`).join(', ') || 'none yet');
  console.log('DOCUMENT_EXPIRY MIGRATION OK');
} catch (e) {
  console.error('MIGRATION ERROR:', e.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
