// Idempotent runner for the Onboarding v2 rebuild migration.
import pool from './config/db.js';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function colExists(table, col) {
  const [r] = await pool.query(
    'SELECT COUNT(*) c FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?',
    [table, col]);
  return r[0].c > 0;
}
async function idxExists(table, idx) {
  const [r] = await pool.query(
    'SELECT COUNT(*) c FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ?',
    [table, idx]);
  return r[0].c > 0;
}

try {
  // 1) Extend the spine (only add what's missing)
  const spine = [
    ['stage', "ADD COLUMN stage ENUM('DRAFT','CV_UPLOADED','UNDER_HR_REVIEW','HR_APPROVED','OFFER_SENT','OFFER_ACCEPTED','SIGNED_OFFER_UPLOADED','DOCUMENTS_COLLECTION','VISA_RESIDENCY','BANK_DETAILS','READY_FOR_EMPLOYMENT','COMPLETED','REJECTED','CANCELLED') NOT NULL DEFAULT 'DRAFT' AFTER status"],
    ['candidate_id', 'ADD COLUMN candidate_id INT NULL'],
    ['vacancy_id', 'ADD COLUMN vacancy_id INT NULL'],
    ['offer_state', "ADD COLUMN offer_state ENUM('none','sent','accepted','rejected') NOT NULL DEFAULT 'none'"],
    ['rejection_reason', 'ADD COLUMN rejection_reason TEXT NULL'],
    ['assigned_to', 'ADD COLUMN assigned_to INT NULL'],
    ['created_by', 'ADD COLUMN created_by INT NULL'],
  ];
  for (const [col, clause] of spine) {
    if (!(await colExists('onboarding_records', col))) {
      await pool.query(`ALTER TABLE onboarding_records ${clause}`);
      console.log(`onboarding_records.${col} added`);
    } else console.log(`onboarding_records.${col} present`);
  }
  if (!(await idxExists('onboarding_records', 'idx_onb_stage'))) {
    await pool.query('CREATE INDEX idx_onb_stage ON onboarding_records (company_id, stage)');
    console.log('idx_onb_stage created');
  }
  // employee_id must be nullable (onboarding precedes employee creation)
  const [[empCol]] = await pool.query(
    "SELECT IS_NULLABLE FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'onboarding_records' AND column_name = 'employee_id'");
  if (empCol && empCol.IS_NULLABLE === 'NO') {
    await pool.query('ALTER TABLE onboarding_records MODIFY employee_id INT NULL');
    console.log('onboarding_records.employee_id made nullable');
  } else console.log('onboarding_records.employee_id already nullable');

  // 2) Create the new tables (skip the ALTER block which we handled above)
  const sql = fs.readFileSync(join(__dirname, 'migrations', 'onboarding_v2.sql'), 'utf8');
  const createStatements = sql
    .split(/;\s*$/m)
    .map((s) => s.replace(/--.*$/gm, '').trim())
    .filter((s) => /^CREATE TABLE/i.test(s));
  for (const stmt of createStatements) {
    await pool.query(stmt);
  }
  const [[{ c }]] = await pool.query(
    "SELECT COUNT(*) c FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name LIKE 'onboarding_%'");
  console.log(`onboarding_* tables present: ${c}`);
  console.log('ONBOARDING V2 MIGRATION OK');
} catch (e) {
  console.error('MIGRATION ERROR:', e.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
