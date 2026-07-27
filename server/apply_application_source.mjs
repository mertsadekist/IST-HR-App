// Idempotent migration: add job_applications.heard_about_us + referrer_name —
// the "How did you hear about us?" answer captured on the public careers form,
// plus the referrer's name when the answer is "Referral". Safe to re-run.
import pool from './config/db.js';

async function columnExists(table, col) {
  const [r] = await pool.query(
    `SELECT COUNT(*) c FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`,
    [table, col]);
  return r[0].c > 0;
}

const cols = [
  { name: 'heard_about_us', ddl: 'ALTER TABLE job_applications ADD COLUMN heard_about_us VARCHAR(60) NULL AFTER source' },
  { name: 'referrer_name', ddl: 'ALTER TABLE job_applications ADD COLUMN referrer_name VARCHAR(200) NULL AFTER heard_about_us' },
];

try {
  for (const c of cols) {
    if (!(await columnExists('job_applications', c.name))) {
      await pool.query(c.ddl);
      console.log(`job_applications.${c.name} added`);
    } else {
      console.log(`job_applications.${c.name} already present`);
    }
  }
  console.log('APPLICATION_SOURCE MIGRATION OK');
} catch (e) {
  console.error('MIGRATION ERROR:', e.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
