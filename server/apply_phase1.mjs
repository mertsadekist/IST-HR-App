// One-off idempotent runner for migrations/phase1_security.sql changes.
// Safe to re-run. Reads DB creds from .env via the shared pool.
import pool from './config/db.js';

async function columnExists(table, col) {
  const [r] = await pool.query(
    `SELECT COUNT(*) c FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`,
    [table, col]);
  return r[0].c > 0;
}
async function indexExists(table, idx) {
  const [r] = await pool.query(
    `SELECT COUNT(*) c FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ?`,
    [table, idx]);
  return r[0].c > 0;
}

try {
  if (!(await columnExists('audit_logs', 'company_id'))) {
    await pool.query('ALTER TABLE audit_logs ADD COLUMN company_id INT NULL AFTER user_id');
    console.log('audit_logs.company_id added');
    await pool.query('UPDATE audit_logs a JOIN users u ON a.user_id = u.id SET a.company_id = u.company_id WHERE a.company_id IS NULL');
    console.log('audit_logs backfilled from users');
  } else { console.log('audit_logs.company_id already present'); }
  if (!(await indexExists('audit_logs', 'idx_audit_company'))) {
    await pool.query('CREATE INDEX idx_audit_company ON audit_logs (company_id, created_at)');
    console.log('idx_audit_company created');
  } else { console.log('idx_audit_company already present'); }

  if (!(await columnExists('companies', 'deleted_at'))) {
    await pool.query('ALTER TABLE companies ADD COLUMN deleted_at TIMESTAMP NULL DEFAULT NULL');
    console.log('companies.deleted_at added');
  } else { console.log('companies.deleted_at already present'); }

  const composites = [
    ['candidates', 'idx_cand_co_status', '(company_id, status)'],
    ['employees', 'idx_emp_co_status', '(company_id, status)'],
    ['onboarding_records', 'idx_onb_co_status', '(company_id, status)'],
    ['offboarding_records', 'idx_off_co_status', '(company_id, status)'],
    ['asset_assignments', 'idx_asg_co_status', '(company_id, status)'],
  ];
  for (const [t, idx, cols] of composites) {
    if (!(await indexExists(t, idx))) {
      await pool.query(`CREATE INDEX ${idx} ON ${t} ${cols}`);
      console.log(`${idx} created`);
    } else { console.log(`${idx} already present`); }
  }
  console.log('PHASE1 MIGRATION OK');
} catch (e) {
  console.error('MIGRATION ERROR:', e.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
