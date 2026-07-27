// Idempotent migration: add employees.labour_contract_status + labour_contract_issued_at.
//
// Models whether an employee's UAE labour contract / work residency has actually
// been issued. Employees created the moment an offer is accepted start as
// 'Not Issued' (probationary/trial), and the UI shows a legal-protection notice
// while that is the case. Flipped to 'Issued' by HR once the residency is in hand.
//
// Defaults to 'Not Issued' — deliberately the cautious value, so no pre-existing
// employee is silently asserted to hold a contract we have no record of. HR can
// bulk-correct existing staff from the Employees page. Safe to re-run.
import pool from './config/db.js';

async function columnExists(table, col) {
  const [r] = await pool.query(
    `SELECT COUNT(*) c FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`,
    [table, col]);
  return r[0].c > 0;
}

const cols = [
  {
    name: 'labour_contract_status',
    ddl: "ALTER TABLE employees ADD COLUMN labour_contract_status ENUM('Not Issued','Issued') NOT NULL DEFAULT 'Not Issued' AFTER status",
  },
  {
    name: 'labour_contract_issued_at',
    ddl: 'ALTER TABLE employees ADD COLUMN labour_contract_issued_at DATE NULL AFTER labour_contract_status',
  },
];

try {
  for (const c of cols) {
    if (!(await columnExists('employees', c.name))) {
      await pool.query(c.ddl);
      console.log(`employees.${c.name} added`);
    } else {
      console.log(`employees.${c.name} already present`);
    }
  }
  console.log('LABOUR_CONTRACT_STATUS MIGRATION OK');
} catch (e) {
  console.error('MIGRATION ERROR:', e.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
