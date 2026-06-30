import pool from './db.js';

// Idempotent, self-healing column guards applied at boot, so a redeploy never
// needs a manual migration step for these additive columns. Fails soft: a guard
// error is logged but never crashes the server.
const COLUMN_GUARDS = [
  { table: 'employees', column: 'attendance_id', ddl: 'ALTER TABLE employees ADD COLUMN attendance_id VARCHAR(100) NULL' },
];

// Tiny key/value store for global app settings (e.g. timezone).
const TABLE_GUARDS = [
  `CREATE TABLE IF NOT EXISTS app_settings (
     k VARCHAR(100) PRIMARY KEY,
     v TEXT NULL,
     updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
];

export async function ensureSchema() {
  for (const ddl of TABLE_GUARDS) {
    try { await pool.query(ddl); } catch (e) { console.error('ensureSchema(table) failed:', e.message); }
  }
  for (const g of COLUMN_GUARDS) {
    try {
      const [r] = await pool.query(
        'SELECT COUNT(*) c FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?',
        [g.table, g.column]
      );
      if (r[0].c === 0) {
        await pool.query(g.ddl);
        console.log(`🔧 ensureSchema: added ${g.table}.${g.column}`);
      }
    } catch (e) {
      console.error(`ensureSchema(${g.table}.${g.column}) failed:`, e.message);
    }
  }
}
