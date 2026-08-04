// Idempotent migration: the lifecycle states the assets PRD requires and the
// system lacked — see docs/assets_access_module_plan.md Phase 2.
//
// Business rule 1: "A returned asset must not become Available immediately; it
// must pass inspection first." That state had nowhere to live, so a return went
// straight back into available stock and a damaged laptop was indistinguishable
// from a working one.
//
// asset_inventory.status gains:
//   Reserved                     held for a planned onboarding, not assignable
//   Returned Pending Inspection  back from an employee, not yet verified
//   Damaged                      unusable until repaired or disposed
//
// asset_assignments.status gains:
//   Pending Return               offboarding has asked for it back
//   Returned Pending Inspection  handed back, awaiting the check
//
// Existing enum members are preserved exactly, so no current row changes value.
// Safe to re-run.
import pool from './config/db.js';

async function columnType(table, col) {
  const [r] = await pool.query(
    `SELECT COLUMN_TYPE t FROM information_schema.columns
      WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`, [table, col]);
  return r[0]?.t || null;
}

const CHANGES = [
  {
    table: 'asset_inventory', column: 'status',
    needs: ['Reserved', 'Returned Pending Inspection', 'Damaged'],
    ddl: "ALTER TABLE asset_inventory MODIFY COLUMN status ENUM("
      + "'Available','Reserved','Assigned','Returned Pending Inspection','In Repair',"
      + "'Damaged','Retired','Lost','Disposed') DEFAULT 'Available'",
  },
  {
    table: 'asset_assignments', column: 'status',
    needs: ['Pending Return', 'Returned Pending Inspection'],
    ddl: "ALTER TABLE asset_assignments MODIFY COLUMN status ENUM("
      + "'Active','Pending Return','Returned Pending Inspection','Returned',"
      + "'Deactivated','Missing') DEFAULT 'Active'",
  },
  // Who verified a return, and when — an inspection nobody signed for is not an
  // inspection.
  {
    table: 'asset_inventory', column: 'inspected_by', add: true,
    ddl: 'ALTER TABLE asset_inventory ADD COLUMN inspected_by INT NULL',
  },
  {
    table: 'asset_inventory', column: 'inspected_at', add: true,
    ddl: 'ALTER TABLE asset_inventory ADD COLUMN inspected_at TIMESTAMP NULL',
  },
  {
    table: 'asset_inventory', column: 'inspection_note', add: true,
    ddl: 'ALTER TABLE asset_inventory ADD COLUMN inspection_note VARCHAR(500) NULL',
  },
];

try {
  for (const ch of CHANGES) {
    const type = await columnType(ch.table, ch.column);
    if (ch.add) {
      if (type) { console.log(`${ch.table}.${ch.column} already present`); continue; }
      await pool.query(ch.ddl);
      console.log(`${ch.table}.${ch.column} added`);
      continue;
    }
    if (!type) { console.log(`${ch.table}.${ch.column} not found — skipped`); continue; }
    const missing = ch.needs.filter((v) => !type.includes(`'${v}'`));
    if (!missing.length) { console.log(`${ch.table}.${ch.column} already has ${ch.needs.join(', ')}`); continue; }
    await pool.query(ch.ddl);
    console.log(`${ch.table}.${ch.column} extended with: ${missing.join(', ')}`);
  }

  for (const [t, c] of [['asset_inventory', 'status'], ['asset_assignments', 'status']]) {
    console.log(`  ${t}.${c} = ${await columnType(t, c)}`);
  }
  console.log('INVENTORY_LIFECYCLE MIGRATION OK');
} catch (e) {
  console.error('MIGRATION ERROR:', e.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
