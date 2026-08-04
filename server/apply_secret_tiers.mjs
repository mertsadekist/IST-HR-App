// Idempotent migration: make "we do not hold this password" the recorded,
// default state for a credential — see docs/secrets_protection_design.md §1.
//
// The assets PRD (business rule 10, social governance rule 8) says passwords
// must not be stored at all; only a reference to the approved vault. This adds
// the columns that make that position expressible and auditable:
//
//   secret_tier            Reference (default) | Delegated | Stored
//   vault_secret_reference the vault record id, e.g. VAULT-SOCIAL-014
//   secret_justification   why a Stored secret was necessary
//   secret_approved_by     who signed for it
//
// Existing rows that already hold ciphertext are moved to 'Stored' so the data
// describes reality; everything else becomes 'Reference'. Nothing is decrypted
// and no ciphertext is touched. Safe to re-run.
import pool from './config/db.js';

async function columnExists(table, col) {
  const [r] = await pool.query(
    `SELECT COUNT(*) c FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`,
    [table, col]);
  return r[0].c > 0;
}

const COLS = [
  ['asset_assignments', 'secret_tier',
    "ALTER TABLE asset_assignments ADD COLUMN secret_tier ENUM('Reference','Delegated','Stored') NOT NULL DEFAULT 'Reference'"],
  ['asset_assignments', 'vault_secret_reference',
    'ALTER TABLE asset_assignments ADD COLUMN vault_secret_reference VARCHAR(200) NULL'],
  ['asset_assignments', 'secret_justification',
    'ALTER TABLE asset_assignments ADD COLUMN secret_justification VARCHAR(500) NULL'],
  ['asset_assignments', 'secret_approved_by', 'ALTER TABLE asset_assignments ADD COLUMN secret_approved_by INT NULL'],
];

try {
  let added = 0;
  for (const [table, col, ddl] of COLS) {
    if (!(await columnExists(table, col))) {
      await pool.query(ddl);
      console.log(`${table}.${col} added`);
      added++;
    } else {
      console.log(`${table}.${col} already present`);
    }
  }

  // Describe what is actually there: a row holding ciphertext IS a stored secret.
  const [r] = await pool.query(
    "UPDATE asset_assignments SET secret_tier = 'Stored' WHERE encrypted_password IS NOT NULL AND secret_tier = 'Reference'");
  if (r.affectedRows) console.log(`${r.affectedRows} row(s) with stored ciphertext marked secret_tier='Stored'`);

  // `stored` and `reference` are reserved words in MySQL 8 — alias around them.
  const [tiers] = await pool.query('SELECT secret_tier, COUNT(*) n FROM asset_assignments GROUP BY secret_tier');
  console.log('tiers now —', tiers.map((t) => `${t.secret_tier}: ${t.n}`).join(', ') || 'no rows');
  console.log('SECRET_TIERS MIGRATION OK');
} catch (e) {
  console.error('MIGRATION ERROR:', e.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
