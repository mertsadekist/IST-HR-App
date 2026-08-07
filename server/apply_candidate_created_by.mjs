// Idempotent migration: record who added each candidate.
//
// The candidates table never stored a creator, so the recruitment list could not
// answer "who put this person in?" — which matters when two recruiters work the
// same pipeline and a duplicate or a bad entry needs chasing.
//
// Three columns rather than one:
//   created_by       the user, so the current name follows a rename
//   created_by_name  the name as it was at creation, so history survives the
//                    user being deleted (the FK would otherwise null it away)
//   created_source   Manual vs Careers Portal — a candidate who applied through
//                    the public form was added by nobody, and "—" in the column
//                    should say which of the two it is
//
// BACKFILL: the audit log has been recording `Candidate "NAME" created` all
// along, so the history is recoverable. Matched on the exact stored name against
// the earliest such entry, and the audit user_name is mapped back to a user id
// where it still resolves to exactly one account.
// Safe to re-run.
import pool from './config/db.js';

async function columnExists(table, col) {
  const [r] = await pool.query(
    `SELECT COUNT(*) c FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`,
    [table, col]);
  return r[0].c > 0;
}

const COLS = [
  ['created_by', 'ALTER TABLE candidates ADD COLUMN created_by INT NULL, ADD FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL'],
  ['created_by_name', 'ALTER TABLE candidates ADD COLUMN created_by_name VARCHAR(200) NULL'],
  ['created_source', "ALTER TABLE candidates ADD COLUMN created_source ENUM('Manual','Careers Portal','Import') NOT NULL DEFAULT 'Manual'"],
];

try {
  for (const [col, ddl] of COLS) {
    if (!(await columnExists('candidates', col))) {
      await pool.query(ddl);
      console.log(`candidates.${col} added`);
    } else {
      console.log(`candidates.${col} already present`);
    }
  }

  // ── Backfill from the audit trail ────────────────────────────────────────
  // Only rows that have not been attributed yet, so a re-run never overwrites a
  // value the system has since recorded properly.
  const [matched] = await pool.query(
    `UPDATE candidates c
        JOIN (
          SELECT SUBSTRING_INDEX(SUBSTRING_INDEX(a.detail, '"', 2), '"', -1) AS cand_name,
                 MIN(a.id) AS first_id
            FROM audit_logs a
           WHERE a.module = 'Candidates' AND a.action = 'Created' AND a.detail LIKE 'Candidate "%" created'
           GROUP BY cand_name
        ) firsts ON firsts.cand_name = CONCAT(c.first_name, ' ', c.last_name)
        JOIN audit_logs al ON al.id = firsts.first_id
         SET c.created_by_name = al.user_name,
             c.created_by = al.user_id
       WHERE c.created_by_name IS NULL`);
  console.log(`backfilled from audit log: ${matched.affectedRows} candidate(s)`);

  // Where the audit row predates user_id being stored, resolve the name to an
  // account — but only when it is unambiguous.
  const [byName] = await pool.query(
    `UPDATE candidates c
        JOIN (SELECT name, MIN(id) id, COUNT(*) n FROM users GROUP BY name HAVING n = 1) u
          ON u.name = c.created_by_name
         SET c.created_by = u.id
       WHERE c.created_by IS NULL AND c.created_by_name IS NOT NULL`);
  console.log(`linked to a user account by name: ${byName.affectedRows} candidate(s)`);

  const [[stats]] = await pool.query(
    `SELECT COUNT(*) total,
            SUM(created_by_name IS NOT NULL) attributed,
            SUM(created_by_name IS NULL) unknown
       FROM candidates`);
  console.log(`candidates: ${stats.total} total, ${stats.attributed} attributed, ${stats.unknown} with no record of who added them`);
  console.log('CANDIDATE_CREATED_BY MIGRATION OK');
} catch (e) {
  console.error('MIGRATION ERROR:', e.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
