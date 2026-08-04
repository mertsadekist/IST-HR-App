// Idempotent migration: company ownership and catalogue metadata for the
// Company Assets & Access module (see docs/assets_access_module_plan.md).
//
// owner_scope answers "which company owns this?" with a value the existing
// company_id cannot express: GRP means shared by IST Real Estate and IST Markets.
// It sits ALONGSIDE company_id rather than replacing it — a fake "IST Groups"
// company row would leak into employees, payroll and the WPS file, where it
// would be wrong and dangerous. GRP records read as visible from every entity.
//
// The catalogue also needs the workbook's own columns: the original spelling an
// entry was normalized from (alias_of), the deployment URL of internally built
// applications, and whether an application is internally developed.
// Safe to re-run.
import pool from './config/db.js';

async function columnExists(table, col) {
  const [r] = await pool.query(
    `SELECT COUNT(*) c FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`,
    [table, col]);
  return r[0].c > 0;
}
async function tableExists(table) {
  const [r] = await pool.query(
    'SELECT COUNT(*) c FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?', [table]);
  return r[0].c > 0;
}

// Default GRP: an unclassified asset is treated as shared, which is visible to
// everyone rather than silently hidden from one entity.
const OWNER_DDL = "ENUM('RE','MKT','GRP') NOT NULL DEFAULT 'GRP'";

const COLS = [
  ['platform_catalog', 'owner_scope', `ALTER TABLE platform_catalog ADD COLUMN owner_scope ${OWNER_DDL}`],
  ['platform_catalog', 'alias_of', 'ALTER TABLE platform_catalog ADD COLUMN alias_of VARCHAR(255) NULL'],
  ['platform_catalog', 'application_url', 'ALTER TABLE platform_catalog ADD COLUMN application_url VARCHAR(500) NULL'],
  ['platform_catalog', 'development_type', 'ALTER TABLE platform_catalog ADD COLUMN development_type VARCHAR(50) NULL'],
  ['asset_categories', 'examples', 'ALTER TABLE asset_categories ADD COLUMN examples VARCHAR(1000) NULL'],
  ['asset_categories', 'purpose', 'ALTER TABLE asset_categories ADD COLUMN purpose VARCHAR(1000) NULL'],
  ['asset_categories', 'recommended_owner', 'ALTER TABLE asset_categories ADD COLUMN recommended_owner VARCHAR(200) NULL'],
  ['asset_assignments', 'owner_scope', `ALTER TABLE asset_assignments ADD COLUMN owner_scope ${OWNER_DDL}`],
  ['asset_inventory', 'owner_scope', `ALTER TABLE asset_inventory ADD COLUMN owner_scope ${OWNER_DDL}`],
];

try {
  for (const [table, col, ddl] of COLS) {
    if (!(await tableExists(table))) { console.log(`${table} does not exist yet — skipped`); continue; }
    if (!(await columnExists(table, col))) {
      await pool.query(ddl);
      console.log(`${table}.${col} added`);
    } else {
      console.log(`${table}.${col} already present`);
    }
  }
  // Reporting by owner is the PRD's headline filter, so index it.
  for (const table of ['platform_catalog', 'asset_assignments', 'asset_inventory']) {
    if (!(await tableExists(table))) continue;
    const [idx] = await pool.query(
      `SELECT COUNT(*) c FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = ? AND index_name = 'idx_owner_scope'`, [table]);
    if (!idx[0].c) {
      await pool.query(`ALTER TABLE ${table} ADD INDEX idx_owner_scope (owner_scope)`);
      console.log(`${table}.idx_owner_scope added`);
    }
  }
  console.log('ASSET_OWNERSHIP MIGRATION OK');
} catch (e) {
  console.error('MIGRATION ERROR:', e.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
