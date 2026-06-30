import pool from './db.js';

// Idempotent, self-healing column guards applied at boot, so a redeploy never
// needs a manual migration step for these additive columns. Fails soft: a guard
// error is logged but never crashes the server.
const COLUMN_GUARDS = [
  { table: 'employees', column: 'attendance_id', ddl: 'ALTER TABLE employees ADD COLUMN attendance_id VARCHAR(100) NULL' },
];

export async function ensureSchema() {
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
