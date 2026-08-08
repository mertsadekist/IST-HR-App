// Idempotent migration: add the `accountant` user role.
//
// The accountant runs payroll and the WPS submission, and owns the company's
// assets, subscriptions, domains and official paperwork. They are the first
// role defined as much by what they must NOT reach — the recruitment pipeline —
// as by what they must, which is why server/config/permissions.js exists.
//
// The enum is rewritten rather than replaced: every existing value is listed
// so no user's role is invalidated, and the DEFAULT stays 'employee'.
// Safe to re-run.
import pool from './config/db.js';

const ROLES = ['admin', 'hr_manager', 'recruiter', 'accountant', 'employee'];

try {
  const [[col]] = await pool.query(
    `SELECT COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT FROM information_schema.columns
      WHERE table_schema = DATABASE() AND table_name = 'users' AND column_name = 'role'`);
  if (!col) throw new Error('users.role not found');

  console.log('current:', col.COLUMN_TYPE);

  if (col.COLUMN_TYPE.includes("'accountant'")) {
    console.log("users.role already offers 'accountant'");
  } else {
    // Any value already in the column must survive the rewrite, even one this
    // build does not know about (an older deploy may have added its own).
    const existing = col.COLUMN_TYPE.match(/'([^']+)'/g).map((s) => s.slice(1, -1));
    const merged = [...new Set([...existing, 'accountant'])];
    // Keep the canonical order where possible so the enum reads sensibly.
    merged.sort((a, b) => {
      const ia = ROLES.indexOf(a), ib = ROLES.indexOf(b);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });
    const list = merged.map((r) => `'${r}'`).join(',');
    await pool.query(`ALTER TABLE users MODIFY COLUMN role ENUM(${list}) DEFAULT 'employee'`);
    console.log(`users.role rewritten as ENUM(${list})`);
  }

  const [counts] = await pool.query('SELECT role, COUNT(*) n FROM users GROUP BY role ORDER BY n DESC');
  console.log('users by role:', counts.map((r) => `${r.role}: ${r.n}`).join(', '));
  console.log('ACCOUNTANT_ROLE MIGRATION OK');
} catch (e) {
  console.error('MIGRATION ERROR:', e.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
