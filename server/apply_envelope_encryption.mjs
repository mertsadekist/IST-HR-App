// Idempotent migration: envelope-encryption columns for stored credentials —
// docs/secrets_protection_design.md §2 (security step 4).
//
// The existing scheme kept encrypted_password / password_iv / password_tag,
// encrypted directly under one process-wide key. Those columns stay: a record
// written before this change still decrypts, and migrates to the envelope scheme
// the next time it is written or read. Nothing is re-encrypted in bulk here,
// because doing so would need every secret decrypted at once — the exact
// exposure this design exists to avoid.
//
// New columns:
//   dek_wrapped / dek_wrap_iv / dek_wrap_tag  the per-record data key, wrapped
//                                             by the master key
//   key_version                               which master key wrapped it, so
//                                             rotation can proceed while old
//                                             records still open
//   aad_context                               the row identity bound into the
//                                             ciphertext, so a ciphertext moved
//                                             to another row fails to decrypt
//
// Safe to re-run.
import pool from './config/db.js';

async function columnExists(table, col) {
  const [r] = await pool.query(
    `SELECT COUNT(*) c FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`,
    [table, col]);
  return r[0].c > 0;
}

const COLS = [
  ['dek_wrapped', 'ALTER TABLE asset_assignments ADD COLUMN dek_wrapped TEXT NULL'],
  ['dek_wrap_iv', 'ALTER TABLE asset_assignments ADD COLUMN dek_wrap_iv VARCHAR(64) NULL'],
  ['dek_wrap_tag', 'ALTER TABLE asset_assignments ADD COLUMN dek_wrap_tag VARCHAR(64) NULL'],
  ['key_version', 'ALTER TABLE asset_assignments ADD COLUMN key_version SMALLINT NULL'],
  ['aad_context', 'ALTER TABLE asset_assignments ADD COLUMN aad_context VARCHAR(200) NULL'],
];

try {
  for (const [col, ddl] of COLS) {
    if (!(await columnExists('asset_assignments', col))) {
      await pool.query(ddl);
      console.log(`asset_assignments.${col} added`);
    } else {
      console.log(`asset_assignments.${col} already present`);
    }
  }

  const [[stats]] = await pool.query(
    `SELECT COUNT(*) AS with_secret,
            SUM(dek_wrapped IS NOT NULL) AS envelope,
            SUM(dek_wrapped IS NULL)     AS legacy
       FROM asset_assignments WHERE encrypted_password IS NOT NULL`);
  console.log(`stored secrets: ${stats.with_secret || 0} total — ${stats.envelope || 0} on envelope, ${stats.legacy || 0} still on the direct key`);
  if (Number(stats.legacy) > 0) {
    console.log('  legacy rows migrate on their next read or write; nothing is bulk-decrypted here.');
  }
  console.log('ENVELOPE_ENCRYPTION MIGRATION OK');
} catch (e) {
  console.error('MIGRATION ERROR:', e.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
