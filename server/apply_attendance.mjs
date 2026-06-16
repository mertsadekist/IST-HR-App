// Idempotent runner for the Attendance module migration.
import pool from './config/db.js';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sql = fs.readFileSync(join(__dirname, 'migrations', 'attendance_module.sql'), 'utf8');
const statements = sql.split(/;\s*$/m).map((s) => s.replace(/--.*$/gm, '').trim()).filter(Boolean);

try {
  for (const stmt of statements) await pool.query(stmt);
  const [[{ c }]] = await pool.query("SELECT COUNT(*) c FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'attendance'");
  console.log(`attendance table present: ${c === 1}`);
  console.log('ATTENDANCE MIGRATION OK');
} catch (e) {
  console.error('MIGRATION ERROR:', e.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
