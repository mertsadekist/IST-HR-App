// Idempotent migration: admin-configurable Onboarding v2 document/visa checklists —
// onboarding_document_templates / onboarding_visa_templates. Safe to re-run.
//
// Backfills every existing company with the current hardcoded defaults (mirroring
// DEFAULT_DOCS/DEFAULT_VISA in server/routes/onboardingV2.js) so behavior is
// provably unchanged until an admin edits something in Settings. Never touches
// onboarding_documents/onboarding_visa_steps (the per-record instance tables) —
// those are seeded once, independently, per onboarding record.
import pool from './config/db.js';

const TABLES = [
  `CREATE TABLE IF NOT EXISTS onboarding_document_templates (
     id          INT AUTO_INCREMENT PRIMARY KEY,
     company_id  INT NOT NULL,
     doc_key     VARCHAR(60) NOT NULL,
     label       VARCHAR(200) NOT NULL,
     required    BOOLEAN NOT NULL DEFAULT TRUE,
     sort_order  INT NOT NULL DEFAULT 0,
     created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
     FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
     INDEX idx_doc_tpl_company (company_id)
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS onboarding_visa_templates (
     id          INT AUTO_INCREMENT PRIMARY KEY,
     company_id  INT NOT NULL,
     step_key    VARCHAR(60) NOT NULL,
     label       VARCHAR(200) NOT NULL,
     required    BOOLEAN NOT NULL DEFAULT TRUE,
     sort_order  INT NOT NULL DEFAULT 0,
     created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
     FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
     INDEX idx_visa_tpl_company (company_id)
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
];

// Must match DEFAULT_DOCS / DEFAULT_VISA in server/routes/onboardingV2.js exactly.
const DEFAULT_DOCS = [
  ['photo', 'Personal Photo', 1], ['passport', 'Passport Copy', 1], ['emirates_id', 'Emirates ID', 0],
  ['national_id', 'National ID', 0], ['visa_copy', 'Visa Copy', 0], ['education_cert', 'Educational Certificates', 1],
  ['experience_cert', 'Experience Certificates', 0], ['employment_form', 'Signed Employment Forms', 1],
  ['emergency_contact', 'Emergency Contact Form', 1], ['personal_info', 'Personal Information Form', 1],
];
const DEFAULT_VISA = [
  ['visa_docs', 'Required Visa Documents', 1], ['application', 'Application Submission', 1],
  ['medical', 'Medical Test', 1], ['emirates_id', 'Emirates ID Application', 1],
  ['stamping', 'Residency Stamping', 1], ['labour_contract', 'Labour Contract (MoHRE)', 1],
  ['gov_approval', 'Government Approval', 1],
];

async function backfillCompany(companyId) {
  const [[docCount]] = await pool.query('SELECT COUNT(*) c FROM onboarding_document_templates WHERE company_id = ?', [companyId]);
  if (docCount.c === 0) {
    for (let i = 0; i < DEFAULT_DOCS.length; i++) {
      const [doc_key, label, required] = DEFAULT_DOCS[i];
      await pool.query('INSERT INTO onboarding_document_templates SET ?', { company_id: companyId, doc_key, label, required, sort_order: i });
    }
  }
  const [[visaCount]] = await pool.query('SELECT COUNT(*) c FROM onboarding_visa_templates WHERE company_id = ?', [companyId]);
  if (visaCount.c === 0) {
    for (let i = 0; i < DEFAULT_VISA.length; i++) {
      const [step_key, label, required] = DEFAULT_VISA[i];
      await pool.query('INSERT INTO onboarding_visa_templates SET ?', { company_id: companyId, step_key, label, required, sort_order: i });
    }
  }
}

try {
  for (const ddl of TABLES) await pool.query(ddl);
  console.log('onboarding_document_templates / onboarding_visa_templates ready');

  const [companies] = await pool.query('SELECT id FROM companies WHERE deleted_at IS NULL');
  for (const c of companies) await backfillCompany(c.id);
  console.log(`Backfilled default document/visa checklist for ${companies.length} company(ies)`);
  console.log('ONBOARDING_CHECKLIST_TEMPLATES MIGRATION OK');
} catch (e) {
  console.error('MIGRATION ERROR:', e.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
