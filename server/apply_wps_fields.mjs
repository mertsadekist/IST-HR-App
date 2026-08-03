// Idempotent migration: the identifiers the UAE Wage Protection System (WPS)
// salary file requires, which the system did not previously hold.
//
// Per employee, the MOL salary file needs:
//   work_permit_no  — 9-digit labour card / work permit number
//   personal_no     — 14-digit MOL personal number
// (bank name and IBAN come from employee_bank_details.)
//
// Per company:
//   mol_id          — the establishment's Ministry of Labour ID printed on the file
//   wps_contact_*   — the contact block at the foot of the file
//
// Stored as VARCHAR, never numbers: these identifiers are fixed-width digit
// strings and leading zeros are significant (e.g. personal no 00411089670224).
// Safe to re-run.
import pool from './config/db.js';

async function columnExists(table, col) {
  const [r] = await pool.query(
    `SELECT COUNT(*) c FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`,
    [table, col]);
  return r[0].c > 0;
}

const COLS = [
  ['employees', 'work_permit_no', 'ALTER TABLE employees ADD COLUMN work_permit_no VARCHAR(20) NULL'],
  ['employees', 'personal_no', 'ALTER TABLE employees ADD COLUMN personal_no VARCHAR(20) NULL'],
  ['companies', 'mol_id', 'ALTER TABLE companies ADD COLUMN mol_id VARCHAR(30) NULL'],
  ['companies', 'wps_contact_person', 'ALTER TABLE companies ADD COLUMN wps_contact_person VARCHAR(150) NULL'],
  ['companies', 'wps_contact_mobile', 'ALTER TABLE companies ADD COLUMN wps_contact_mobile VARCHAR(40) NULL'],
  ['companies', 'wps_contact_phone', 'ALTER TABLE companies ADD COLUMN wps_contact_phone VARCHAR(40) NULL'],
  ['companies', 'wps_contact_fax', 'ALTER TABLE companies ADD COLUMN wps_contact_fax VARCHAR(40) NULL'],
  ['companies', 'wps_contact_email', 'ALTER TABLE companies ADD COLUMN wps_contact_email VARCHAR(150) NULL'],
];

try {
  for (const [table, col, ddl] of COLS) {
    if (!(await columnExists(table, col))) {
      await pool.query(ddl);
      console.log(`${table}.${col} added`);
    } else {
      console.log(`${table}.${col} already present`);
    }
  }
  console.log('WPS_FIELDS MIGRATION OK');
} catch (e) {
  console.error('MIGRATION ERROR:', e.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
