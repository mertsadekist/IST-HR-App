// Idempotent runner for the recruitment landing-page / ATS module.
import pool from './config/db.js';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
const __dirname = dirname(fileURLToPath(import.meta.url));

async function colExists(table, col) {
  const [r] = await pool.query('SELECT COUNT(*) c FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=? AND column_name=?', [table, col]);
  return r[0].c > 0;
}

const VACANCY_COLS = [
  ['public_slug', 'ADD COLUMN public_slug VARCHAR(120) NULL UNIQUE'],
  ['workplace_type', "ADD COLUMN workplace_type ENUM('Onsite','Hybrid','Remote') NULL"],
  ['employment_type', "ADD COLUMN employment_type ENUM('Full-time','Part-time','Contract','Temporary','Internship') NULL"],
  ['work_location', 'ADD COLUMN work_location VARCHAR(200) NULL'],
  ['positions', 'ADD COLUMN positions INT DEFAULT 1'],
  ['reporting_manager', 'ADD COLUMN reporting_manager VARCHAR(150) NULL'],
  ['responsibilities', 'ADD COLUMN responsibilities TEXT NULL'],
  ['qualifications', 'ADD COLUMN qualifications TEXT NULL'],
  ['experience_required', 'ADD COLUMN experience_required VARCHAR(150) NULL'],
  ['required_skills', 'ADD COLUMN required_skills TEXT NULL'],
  ['preferred_skills', 'ADD COLUMN preferred_skills TEXT NULL'],
  ['languages', 'ADD COLUMN languages VARCHAR(255) NULL'],
  ['salary_min', 'ADD COLUMN salary_min DECIMAL(12,2) NULL'],
  ['salary_max', 'ADD COLUMN salary_max DECIMAL(12,2) NULL'],
  ['show_salary', 'ADD COLUMN show_salary BOOLEAN DEFAULT FALSE'],
  ['benefits', 'ADD COLUMN benefits TEXT NULL'],
  ['working_hours', 'ADD COLUMN working_hours VARCHAR(100) NULL'],
  ['application_deadline', 'ADD COLUMN application_deadline DATE NULL'],
  ['expected_joining_date', 'ADD COLUMN expected_joining_date DATE NULL'],
  ['internal_notes', 'ADD COLUMN internal_notes TEXT NULL'],
  ['recruitment_owner', 'ADD COLUMN recruitment_owner INT NULL'],
  ['additional_questions', 'ADD COLUMN additional_questions JSON NULL'],
  ['published_at', 'ADD COLUMN published_at TIMESTAMP NULL'],
];

try {
  // 1) Vacancy columns
  for (const [col, clause] of VACANCY_COLS) {
    if (!(await colExists('vacancies', col))) { await pool.query(`ALTER TABLE vacancies ${clause}`); console.log(`vacancies.${col} added`); }
    else console.log(`vacancies.${col} present`);
  }
  // 2) Widen status ENUM to include Published/Paused/Archived (keep legacy values)
  await pool.query("ALTER TABLE vacancies MODIFY status ENUM('Draft','Open','On Hold','Closed','Published','Paused','Archived') DEFAULT 'Draft'");
  console.log('vacancies.status enum widened');

  // 3) New tables
  const sql = fs.readFileSync(join(__dirname, 'migrations', 'recruitment_module.sql'), 'utf8');
  const creates = sql.split(/;\s*$/m).map((s) => s.replace(/--.*$/gm, '').trim()).filter((s) => /^CREATE TABLE/i.test(s));
  for (const stmt of creates) await pool.query(stmt);

  const [[{ c }]] = await pool.query("SELECT COUNT(*) c FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name IN ('job_applications','application_consents','application_files','interviews','candidate_evaluations','application_events')");
  console.log(`recruitment tables present: ${c}/6`);
  console.log('RECRUITMENT MIGRATION OK');
} catch (e) {
  console.error('MIGRATION ERROR:', e.message);
  process.exitCode = 1;
} finally { await pool.end(); }
