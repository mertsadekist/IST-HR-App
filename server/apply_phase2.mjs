// Idempotent runner for Phase 2 DB changes (per-company email uniqueness, DB-004).
// Detects duplicates first and refuses to add a constraint that would fail —
// it never deletes data. Reports duplicates for manual resolution.
import pool from './config/db.js';

async function indexExists(table, idx) {
  const [r] = await pool.query(
    `SELECT COUNT(*) c FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ?`,
    [table, idx]);
  return r[0].c > 0;
}

async function findDupes(table) {
  const [rows] = await pool.query(
    `SELECT company_id, email, COUNT(*) c FROM ${table}
     WHERE email IS NOT NULL AND email <> ''
     GROUP BY company_id, email HAVING c > 1`);
  return rows;
}

async function addUnique(table, idx) {
  if (await indexExists(table, idx)) { console.log(`${idx} already present`); return; }
  const dupes = await findDupes(table);
  if (dupes.length) {
    console.log(`⚠️  ${table}: ${dupes.length} duplicate (company_id,email) group(s) — NOT adding ${idx}. Resolve these first:`);
    for (const d of dupes.slice(0, 20)) console.log(`    company_id=${d.company_id} email=${d.email} count=${d.c}`);
    return;
  }
  await pool.query(`ALTER TABLE ${table} ADD UNIQUE INDEX ${idx} (company_id, email)`);
  console.log(`${idx} added on ${table}`);
}

try {
  await addUnique('employees', 'uq_emp_company_email');
  await addUnique('candidates', 'uq_cand_company_email');
  console.log('PHASE2 MIGRATION DONE');
} catch (e) {
  console.error('MIGRATION ERROR:', e.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
