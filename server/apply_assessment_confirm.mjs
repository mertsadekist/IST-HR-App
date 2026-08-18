// Adds per-question answer confirmation to the assessment module.
// The applicant now confirms each answer explicitly (distinct from the
// autosaved draft and from the stage-level submitted_at) so HR sees
// confirmed/unconfirmed status live, before the stage is even submitted.
import pool from './config/db.js';

async function colExists(table, col) {
  const [r] = await pool.query(
    'SELECT COUNT(*) c FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=? AND column_name=?',
    [table, col]);
  return r[0].c > 0;
}

try {
  if (!(await colExists('assessment_answers', 'confirmed_at'))) {
    await pool.query('ALTER TABLE assessment_answers ADD COLUMN confirmed_at DATETIME NULL AFTER autosaved_at');
    console.log('assessment_answers.confirmed_at added');
  } else {
    console.log('assessment_answers.confirmed_at present');
  }
  console.log('ASSESSMENT CONFIRM MIGRATION OK');
} catch (e) {
  console.error('MIGRATION ERROR:', e.message);
  process.exitCode = 1;
} finally { await pool.end(); }
