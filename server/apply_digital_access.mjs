// Idempotent migration: the digital / portal / social access registry from the
// assets PRD — see docs/assets_access_module_plan.md Phase 3.
//
// asset_assignments answers "what was issued to this employee". It cannot answer
// the questions the PRD's Digital_Access sheet asks: what access level on a
// ranked ladder, is that admin or owner rights, which business manager and ad
// account, is 2FA on, when was it last reviewed, and does this grant consume a
// paid seat. Those need their own table.
//
// FIELD COVERAGE — 34 of the sheet's 40 fields live here. The six deliberately
// excluded are the creator-provenance fields (profile/page creator full name,
// profile URL and email; ads-manager creator full name, profile URL and email).
// Those describe the ACCOUNT, not a person's access to it, so one value serves
// every grant on that account — storing them per grant would let two rows
// disagree about who created the same page. They belong to `social_accounts` in
// Phase 4. Everything that identifies the target of a grant (account/page name
// and URL, business portfolio, business and ad-account ids) is kept here,
// because non-social platforms have no account table to hold it.
//
// Safe to re-run.
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

// The PRD's ranked permission ladder. Stored as a string for readability, with
// the rank kept alongside so "at least Admin" is a numeric comparison rather
// than a list of magic strings scattered through the code.
const ACCESS_LEVELS = "ENUM('No Access','Viewer','User','Editor','Moderator','Analyst','Advertiser','Admin','Super Admin','Owner')";
const DIGITAL_STATUSES = "ENUM('Available','Pending Activation','Assigned','Active','Suspended','Revoked','Archived')";

const DDL = `CREATE TABLE IF NOT EXISTS digital_access (
    id                     INT AUTO_INCREMENT PRIMARY KEY,
    company_id             INT NOT NULL,
    owner_scope            ENUM('RE','MKT','GRP') NOT NULL DEFAULT 'GRP',
    platform_id            INT NULL,
    employee_id            INT NULL,

    -- What was granted
    platform_name          VARCHAR(255) NOT NULL,
    category               VARCHAR(150) NULL,
    workspace_business_name VARCHAR(255) NULL,
    account_page_name      VARCHAR(255) NULL,
    account_page_url       VARCHAR(500) NULL,
    business_portfolio_url VARCHAR(500) NULL,
    business_portfolio_id  VARCHAR(120) NULL,
    business_id            VARCHAR(120) NULL,
    ad_account_id          VARCHAR(120) NULL,
    page_channel_workspace_id VARCHAR(120) NULL,

    -- Who holds it
    team_member_full_name  VARCHAR(200) NULL,
    team_member_profile_url VARCHAR(500) NULL,
    team_member_email      VARCHAR(200) NULL,
    username               VARCHAR(200) NULL,
    login_email            VARCHAR(200) NULL,
    registered_phone       VARCHAR(60) NULL,

    -- What they can do. page_access_level and ads_access_level are separate
    -- because the PRD requires them to differ per asset layer.
    access_level           ${ACCESS_LEVELS} NOT NULL DEFAULT 'No Access',
    access_rank            TINYINT NOT NULL DEFAULT 0,
    page_access_level      ${ACCESS_LEVELS} NULL,
    ads_access_level       ${ACCESS_LEVELS} NULL,
    has_admin_access       BOOLEAN NOT NULL DEFAULT FALSE,
    has_owner_access       BOOLEAN NOT NULL DEFAULT FALSE,
    can_manage_users       BOOLEAN NOT NULL DEFAULT FALSE,

    -- Seat accounting: a named seat on a paid platform reduces available stock
    -- when granted and returns it when revoked (PRD acceptance criteria 2, 3, 7).
    seat_type              ENUM('Named seat','Pooled seat','Not a seat') NOT NULL DEFAULT 'Not a seat',
    seat_consumes_inventory BOOLEAN NOT NULL DEFAULT FALSE,
    seat_reclaimed         BOOLEAN NOT NULL DEFAULT FALSE,

    -- Lifecycle and controls
    status                 ${DIGITAL_STATUSES} NOT NULL DEFAULT 'Pending Activation',
    assigned_on            DATE NULL,
    revoked_on             DATE NULL,
    two_factor_enabled     BOOLEAN NOT NULL DEFAULT FALSE,
    last_access_review     DATE NULL,
    vault_secret_reference VARCHAR(200) NULL,
    managed_by             VARCHAR(150) NULL,
    notes                  VARCHAR(1000) NULL,

    created_by             INT NULL,
    created_at             TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at             TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_da_company (company_id),
    INDEX idx_da_owner (owner_scope),
    INDEX idx_da_platform (platform_id),
    INDEX idx_da_employee (employee_id),
    INDEX idx_da_status (status),
    INDEX idx_da_privileged (has_admin_access, has_owner_access),
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    FOREIGN KEY (platform_id) REFERENCES platform_catalog(id) ON DELETE SET NULL,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`;

try {
  const existed = await tableExists('digital_access');
  await pool.query(DDL);
  console.log(existed ? 'digital_access already present' : 'digital_access created');

  // Columns added after the table first shipped go here, so an existing
  // deployment picks them up without a destructive rebuild.
  const LATER = [
    // (none yet)
  ];
  for (const [col, ddl] of LATER) {
    if (!(await columnExists('digital_access', col))) { await pool.query(ddl); console.log(`digital_access.${col} added`); }
  }

  const [[c]] = await pool.query('SELECT COUNT(*) n FROM digital_access');
  console.log(`digital_access rows: ${c.n}`);
  console.log('DIGITAL_ACCESS MIGRATION OK');
} catch (e) {
  console.error('MIGRATION ERROR:', e.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
