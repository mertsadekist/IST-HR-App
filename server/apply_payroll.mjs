// Idempotent runner for the Payroll module migration.
import pool from './config/db.js';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sql = fs.readFileSync(join(__dirname, 'migrations', 'payroll_module.sql'), 'utf8');
const statements = sql.split(/;\s*$/m).map((s) => s.replace(/--.*$/gm, '').trim()).filter(Boolean);

try {
  for (const stmt of statements) await pool.query(stmt);
  const [[{ c }]] = await pool.query("SELECT COUNT(*) c FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name IN ('payroll_runs','payroll_items')");
  console.log(`payroll tables present: ${c}/2`);
  console.log('PAYROLL MIGRATION OK');
} catch (e) {
  console.error('MIGRATION ERROR:', e.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
