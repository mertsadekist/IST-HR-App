// Idempotent migration: domains, hosting and infrastructure ownership —
// assets PRD Phase 5 (see docs/assets_access_module_plan.md).
//
// The workbook's Domain_Infrastructure sheet asks twelve questions, and the ones
// that matter most are about accountability being SPLIT: who owns the account in
// business terms, who administers the technical controls, who controls DNS, who
// controls the hosting panel, and who pays the renewal. Those are frequently
// four different people, and a domain lapses when everyone assumes it was
// somebody else's renewal.
//
// So `renewal_date` is the field this table exists for, and it is what the
// renewal scheduler watches (services/domainRenewalService.js).
//
// Added beyond the sheet, because the alerting needs them:
//   auto_renew          a domain on auto-renew is a different risk profile
//   renewal_alert_sent  which threshold has already been alerted on, so the
//                       scheduler does not notify the same domain every 6 hours
//   vault_secret_reference / notes  consistent with the rest of the module
//
// Passwords have no column here: the secrets policy allows only a vault
// reference. Safe to re-run.
import pool from './config/db.js';

async function tableExists(table) {
  const [r] = await pool.query(
    'SELECT COUNT(*) c FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?', [table]);
  return r[0].c > 0;
}
async function columnExists(table, col) {
  const [r] = await pool.query(
    `SELECT COUNT(*) c FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`,
    [table, col]);
  return r[0].c > 0;
}

const DDL = `CREATE TABLE IF NOT EXISTS domain_assets (
    id                     INT AUTO_INCREMENT PRIMARY KEY,
    company_id             INT NOT NULL,
    -- GRP is allowed here, unlike social accounts: a shared registrar account
    -- genuinely serves both companies.
    owner_scope            ENUM('RE','MKT','GRP') NOT NULL DEFAULT 'GRP',
    platform_id            INT NULL,          -- the registrar in platform_catalog

    account_or_domain_name VARCHAR(255) NOT NULL,
    domain_name            VARCHAR(255) NULL,
    registrar_provider     VARCHAR(160) NULL,
    asset_kind             ENUM('Domain','Hosting','DNS','CDN','Infrastructure','Other') NOT NULL DEFAULT 'Domain',

    -- Accountability, split the way the PRD splits it.
    account_owner          VARCHAR(200) NULL,  -- business owner of the account
    technical_owner        VARCHAR(200) NULL,  -- administers the technical controls
    billing_owner          VARCHAR(200) NULL,  -- owns renewal and payment
    dns_control_owner      VARCHAR(200) NULL,
    hosting_control_owner  VARCHAR(200) NULL,
    assigned_employee_id   INT NULL,           -- when it is one named person, not a function

    renewal_date           DATE NULL,
    auto_renew             BOOLEAN NOT NULL DEFAULT FALSE,
    renewal_alert_sent     VARCHAR(20) NULL,   -- highest threshold already alerted, e.g. '30'
    account_status         ENUM('Active','Pending','Expired','Transferred','Cancelled') NOT NULL DEFAULT 'Active',

    vault_secret_reference VARCHAR(200) NULL,
    notes                  VARCHAR(1000) NULL,

    created_by             INT NULL,
    created_at             TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at             TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_da_company (company_id),
    INDEX idx_da_owner (owner_scope),
    INDEX idx_da_renewal (renewal_date),
    INDEX idx_da_status (account_status),
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    FOREIGN KEY (platform_id) REFERENCES platform_catalog(id) ON DELETE SET NULL,
    FOREIGN KEY (assigned_employee_id) REFERENCES employees(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`;

try {
  const existed = await tableExists('domain_assets');
  await pool.query(DDL);
  console.log(existed ? 'domain_assets already present' : 'domain_assets created');

  // Columns added after the table first shipped.
  const LATER = [
    ['renewal_alert_sent', 'ALTER TABLE domain_assets ADD COLUMN renewal_alert_sent VARCHAR(20) NULL'],
  ];
  for (const [col, ddl] of LATER) {
    if (!(await columnExists('domain_assets', col))) { await pool.query(ddl); console.log(`domain_assets.${col} added`); }
  }

  const [[c]] = await pool.query('SELECT COUNT(*) n FROM domain_assets');
  console.log(`domain_assets rows: ${c.n}`);
  console.log('DOMAIN_ASSETS MIGRATION OK');
} catch (e) {
  console.error('MIGRATION ERROR:', e.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
