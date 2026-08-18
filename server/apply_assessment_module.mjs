// Idempotent runner for the Job Applicant Assessment System module.
import pool from './config/db.js';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
const __dirname = dirname(fileURLToPath(import.meta.url));

try {
  const sql = fs.readFileSync(join(__dirname, 'migrations', 'assessment_module.sql'), 'utf8');
  const creates = sql.split(/;\s*$/m).map((s) => s.replace(/--.*$/gm, '').trim()).filter((s) => /^CREATE TABLE/i.test(s));
  for (const stmt of creates) await pool.query(stmt);

  const [[{ c }]] = await pool.query(
    `SELECT COUNT(*) c FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name IN
     ('assessment_templates','assessment_template_versions','assessment_stages','assessment_questions',
      'assessment_sessions','assessment_answers','assessment_session_events')`);
  console.log(`assessment tables present: ${c}/7`);
  console.log('ASSESSMENT MODULE MIGRATION OK');
} catch (e) {
  console.error('MIGRATION ERROR:', e.message);
  process.exitCode = 1;
} finally { await pool.end(); }
