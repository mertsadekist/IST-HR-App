// Idempotent migration: per-employee bank details + the bank-stamped IBAN letter.
//
// Why a new table rather than reading onboarding_bank_details: that row is keyed
// by onboarding_id and is a point-in-time snapshot of the hiring process. An
// employee's payroll account is a living record — it has to exist for staff who
// were added manually (never onboarded through the pipeline), and it has to
// survive the employee changing bank later. Onboarding data is copied across
// when the onboarding completes; from then on the employee record is the source
// of truth for payroll.
//
// employee_bank_files keeps the stamped IBAN letter itself (and its history —
// a new letter is required whenever the account changes), mirroring the
// leave_files / onboarding_files pattern.
//
// Safe to re-run.
import pool from './config/db.js';

async function columnExists(table, col) {
  const [r] = await pool.query(
    `SELECT COUNT(*) c FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`,
    [table, col]);
  return r[0].c > 0;
}

const TABLES = [
  `CREATE TABLE IF NOT EXISTS employee_bank_details (
     id                  INT AUTO_INCREMENT PRIMARY KEY,
     employee_id         INT NOT NULL UNIQUE,
     company_id          INT NOT NULL,
     bank_name           VARCHAR(150) NULL,
     account_holder_name VARCHAR(200) NULL,
     account_number      VARCHAR(60) NULL,
     iban                VARCHAR(60) NULL,
     swift_code          VARCHAR(30) NULL,
     branch_name         VARCHAR(150) NULL,
     transfer_method     ENUM('Bank Transfer','WPS','Cheque','Cash') DEFAULT 'Bank Transfer',
     salary_currency     VARCHAR(10) NULL,
     notes               VARCHAR(500) NULL,
     verified            BOOLEAN NOT NULL DEFAULT FALSE,
     verified_by         INT NULL,
     verified_at         TIMESTAMP NULL,
     created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
     updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
     FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
     FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
     FOREIGN KEY (verified_by) REFERENCES users(id) ON DELETE SET NULL,
     INDEX idx_emp_bank_company (company_id)
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS employee_bank_files (
     id           INT AUTO_INCREMENT PRIMARY KEY,
     employee_id  INT NOT NULL,
     company_id   INT NOT NULL,
     kind         ENUM('iban_letter','other') NOT NULL DEFAULT 'iban_letter',
     file_name    VARCHAR(255) NULL,
     file_type    VARCHAR(100) NULL,
     file_size    INT NULL,
     storage_key  VARCHAR(500) NOT NULL,
     uploaded_by  INT NULL,
     uploaded_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
     INDEX idx_emp_bank_file (employee_id, kind),
     FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
     FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
     FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
];

try {
  for (const ddl of TABLES) await pool.query(ddl);
  console.log('employee_bank_details / employee_bank_files ready');

  // The onboarding table already carries an (until now unused) slot for the
  // letter; give it a matching kind column so the same file can be tracked
  // during hiring and then carried over to the employee.
  if (!(await columnExists('onboarding_bank_details', 'iban_letter_file_id'))) {
    await pool.query('ALTER TABLE onboarding_bank_details ADD COLUMN iban_letter_file_id INT NULL AFTER confirmation_file_id');
    console.log('onboarding_bank_details.iban_letter_file_id added');
  } else {
    console.log('onboarding_bank_details.iban_letter_file_id already present');
  }

  // Backfill: copy bank details from any completed onboarding to its employee,
  // so records captured during hiring show up on the employee's Bank tab.
  const [rows] = await pool.query(
    `SELECT b.*, o.employee_id FROM onboarding_bank_details b
     JOIN onboarding_records o ON o.id = b.onboarding_id
     WHERE o.employee_id IS NOT NULL`);
  let copied = 0;
  for (const b of rows) {
    const [[exists]] = await pool.query('SELECT id FROM employee_bank_details WHERE employee_id = ?', [b.employee_id]);
    if (exists) continue;
    await pool.query('INSERT INTO employee_bank_details SET ?', {
      employee_id: b.employee_id, company_id: b.company_id,
      bank_name: b.bank_name, account_holder_name: b.account_holder_name,
      account_number: b.account_number, iban: b.iban, swift_code: b.swift_code,
      branch_name: b.branch_name, transfer_method: b.transfer_method || 'Bank Transfer',
      // Verification does not carry over: the new rule requires a stamped IBAN
      // letter on file, and these historical rows have none.
      verified: 0,
    });
    copied++;
  }
  console.log(`Backfilled bank details for ${copied} employee(s) from completed onboardings`);
  console.log('EMPLOYEE_BANK MIGRATION OK');
} catch (e) {
  console.error('MIGRATION ERROR:', e.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
