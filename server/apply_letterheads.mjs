import pool from './config/db.js';

// Adds per-company letterhead support: a stored A4 letterhead file (PDF/image)
// used as the background of generated documents, plus configurable content
// margins (mm). Idempotent — safe to re-run.
const cols = [
  { name: 'letterhead_path', ddl: "ADD COLUMN letterhead_path VARCHAR(512) NULL" },
  { name: 'letterhead_type', ddl: "ADD COLUMN letterhead_type VARCHAR(20) NULL" },
  { name: 'letterhead_margins', ddl: "ADD COLUMN letterhead_margins TEXT NULL" },
];

try {
  for (const c of cols) {
    const [[{ n }]] = await pool.query(
      "SELECT COUNT(*) n FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='companies' AND column_name=?",
      [c.name]
    );
    if (n === 0) {
      await pool.query(`ALTER TABLE companies ${c.ddl}`);
      console.log(`added companies.${c.name}`);
    } else {
      console.log(`companies.${c.name} already present`);
    }
  }
  console.log('LETTERHEADS MIGRATION OK');
} catch (e) {
  console.error('MIGRATION ERROR:', e.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
