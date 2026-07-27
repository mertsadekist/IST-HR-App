// Idempotent migration: add companies.email_domains — the comma-separated list
// of official mail domains a company owns (e.g. "istrealestate.com,istmarkets.com").
//
// Drives the employee email builder: staff holding an issued labour contract get
// an address on a company domain, while staff still outside contract must use a
// public provider (they should not hold an official company address before the
// contract and residency are in place). Safe to re-run.
import pool from './config/db.js';

async function columnExists(table, col) {
  const [r] = await pool.query(
    `SELECT COUNT(*) c FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`,
    [table, col]);
  return r[0].c > 0;
}

try {
  if (!(await columnExists('companies', 'email_domains'))) {
    await pool.query('ALTER TABLE companies ADD COLUMN email_domains VARCHAR(500) NULL AFTER website');
    console.log('companies.email_domains added');
  } else {
    console.log('companies.email_domains already present');
  }
  console.log('COMPANY_EMAIL_DOMAINS MIGRATION OK');
} catch (e) {
  console.error('MIGRATION ERROR:', e.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
