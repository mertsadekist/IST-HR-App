// Idempotent runner for the Leave Management module migration.
import pool from './config/db.js';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sql = fs.readFileSync(join(__dirname, 'migrations', 'leave_module.sql'), 'utf8');

// Split on semicolons that terminate statements (naive but fine for this DDL file).
const statements = sql
  .split(/;\s*$/m)
  .map((s) => s.replace(/--.*$/gm, '').trim())
  .filter((s) => s.length);

try {
  for (const stmt of statements) {
    await pool.query(stmt);
  }
  const [[{ c }]] = await pool.query('SELECT COUNT(*) c FROM leave_types');
  console.log(`Leave module applied. leave_types rows: ${c}`);
  console.log('LEAVE MIGRATION OK');
} catch (e) {
  console.error('MIGRATION ERROR:', e.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
