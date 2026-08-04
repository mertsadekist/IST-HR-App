// Idempotent migration: social-media account ownership and per-layer team access
// — assets PRD Phase 4 (see docs/assets_access_module_plan.md).
//
// Two tables, because they answer different questions:
//
//   social_accounts  one row per platform per company entity. Describes the
//                    ASSET: its official name and URL, the business manager that
//                    owns it, the ad account that spends money, who created each
//                    of those and with which corporate email, the billing and
//                    payment owners, recovery controls, 2FA, and when ownership
//                    was last reviewed.
//
//   social_access    one row per person PER ASSET LAYER. Governance rule 6:
//                    permissions differ across the page, the business manager
//                    and the ads manager, so one row cannot describe all three.
//                    Rule 13 goes further — a group entry such as "Marketing
//                    Team" is not evidence of access, so every row names one
//                    person.
//
// The creator-provenance fields live here rather than in digital_access because
// they describe the account, not a person's access to it (governance rule 2).
//
// Passwords are deliberately absent: rule 8 allows only a vault reference.
// Safe to re-run.
import pool from './config/db.js';

async function tableExists(table) {
  const [r] = await pool.query(
    'SELECT COUNT(*) c FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?', [table]);
  return r[0].c > 0;
}

const ACCESS_LEVELS = "ENUM('No Access','Viewer','User','Editor','Moderator','Analyst','Advertiser','Admin','Super Admin','Owner')";

const ACCOUNTS_DDL = `CREATE TABLE IF NOT EXISTS social_accounts (
    id                      INT AUTO_INCREMENT PRIMARY KEY,
    company_id              INT NOT NULL,
    -- Rule 14: every account belongs to exactly one entity, and rule 10 keeps
    -- them separate even when the same person or manager account runs both.
    owner_scope             ENUM('RE','MKT') NOT NULL,
    platform                VARCHAR(120) NOT NULL,
    account_type            VARCHAR(160) NULL,

    -- The public asset
    account_name            VARCHAR(255) NULL,
    account_url             VARCHAR(500) NULL,
    account_id              VARCHAR(120) NULL,
    username_handle         VARCHAR(160) NULL,

    -- The business / portfolio manager that owns it
    business_manager_name   VARCHAR(255) NULL,
    business_manager_url    VARCHAR(500) NULL,
    business_manager_id     VARCHAR(120) NULL,

    -- The advertising account that spends money
    ads_manager_platform    VARCHAR(160) NULL,
    ads_account_name        VARCHAR(255) NULL,
    ads_account_url         VARCHAR(500) NULL,
    ads_account_id          VARCHAR(120) NULL,

    -- Creator provenance. Rule 2: full name exactly as shown on the profile, the
    -- direct personal profile URL, and the corporate email used at creation —
    -- recorded separately for the page and for the ads manager.
    page_creator_name       VARCHAR(200) NULL,
    page_creator_profile_url VARCHAR(500) NULL,
    page_creator_email      VARCHAR(200) NULL,
    ads_creator_name        VARCHAR(200) NULL,
    ads_creator_profile_url VARCHAR(500) NULL,
    ads_creator_email       VARCHAR(200) NULL,

    -- Ownership and money. Rule 3 wants two company-controlled admins; rule 9
    -- keeps billing identified apart from publishing.
    creation_date           DATE NULL,
    primary_business_owner  VARCHAR(200) NULL,
    backup_admin            VARCHAR(200) NULL,
    billing_owner           VARCHAR(200) NULL,
    payment_method_owner    VARCHAR(200) NULL,

    pixel_dataset_id        VARCHAR(120) NULL,
    catalogue_commerce_id   VARCHAR(120) NULL,

    -- Recovery controls. Rule 4 forbids a personal email as the sole owner or
    -- recovery method; rule 5 makes 2FA mandatory for owners and admins.
    recovery_email          VARCHAR(200) NULL,
    recovery_phone          VARCHAR(60) NULL,
    two_factor_enabled      BOOLEAN NOT NULL DEFAULT FALSE,

    status                  ENUM('To Be Completed','Active','Inactive','Suspended','Archived') NOT NULL DEFAULT 'To Be Completed',
    last_ownership_review   DATE NULL,
    vault_secret_reference  VARCHAR(200) NULL,
    notes                   VARCHAR(1000) NULL,

    created_by              INT NULL,
    created_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY uniq_entity_platform (company_id, owner_scope, platform),
    INDEX idx_sa_company (company_id),
    INDEX idx_sa_status (status),
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`;

const ACCESS_DDL = `CREATE TABLE IF NOT EXISTS social_access (
    id                      INT AUTO_INCREMENT PRIMARY KEY,
    social_account_id       INT NOT NULL,
    company_id              INT NOT NULL,
    employee_id             INT NULL,
    -- Rule 6: the layer is part of the identity of the grant.
    asset_layer             ENUM('Page / Profile / Channel','Business / Portfolio Manager','Ads Manager / Advertising Account') NOT NULL,
    asset_name              VARCHAR(255) NULL,
    asset_id                VARCHAR(120) NULL,
    asset_url               VARCHAR(500) NULL,

    -- Rule 12: a complete profile name, never a first name, nickname or team label.
    team_member_name        VARCHAR(200) NOT NULL,
    team_member_profile_url VARCHAR(500) NULL,
    team_member_email       VARCHAR(200) NULL,
    department              VARCHAR(150) NULL,
    job_title               VARCHAR(150) NULL,

    access_level            ${ACCESS_LEVELS} NOT NULL DEFAULT 'No Access',
    access_rank             TINYINT NOT NULL DEFAULT 0,

    can_publish             BOOLEAN NOT NULL DEFAULT FALSE,
    can_reply_moderate      BOOLEAN NOT NULL DEFAULT FALSE,
    can_view_analytics      BOOLEAN NOT NULL DEFAULT FALSE,
    can_create_ads          BOOLEAN NOT NULL DEFAULT FALSE,
    can_edit_campaigns      BOOLEAN NOT NULL DEFAULT FALSE,
    can_manage_billing      BOOLEAN NOT NULL DEFAULT FALSE,
    can_manage_users        BOOLEAN NOT NULL DEFAULT FALSE,

    granted_by_name         VARCHAR(200) NULL,
    granted_by_profile_url  VARCHAR(500) NULL,
    date_granted            DATE NULL,
    status                  ENUM('Pending Entry','Pending Approval','Active','Suspended','Removed') NOT NULL DEFAULT 'Pending Entry',
    two_factor_enabled      BOOLEAN NOT NULL DEFAULT FALSE,
    last_access_review      DATE NULL,
    removal_date            DATE NULL,
    vault_secret_reference  VARCHAR(200) NULL,
    notes                   VARCHAR(1000) NULL,

    created_by              INT NULL,
    created_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_sac_account (social_account_id),
    INDEX idx_sac_company (company_id),
    INDEX idx_sac_layer (asset_layer),
    INDEX idx_sac_status (status),
    INDEX idx_sac_email (team_member_email),
    FOREIGN KEY (social_account_id) REFERENCES social_accounts(id) ON DELETE CASCADE,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`;

try {
  const hadAccounts = await tableExists('social_accounts');
  await pool.query(ACCOUNTS_DDL);
  console.log(hadAccounts ? 'social_accounts already present' : 'social_accounts created');

  const hadAccess = await tableExists('social_access');
  await pool.query(ACCESS_DDL);
  console.log(hadAccess ? 'social_access already present' : 'social_access created');

  const [[a]] = await pool.query('SELECT COUNT(*) n FROM social_accounts');
  const [[b]] = await pool.query('SELECT COUNT(*) n FROM social_access');
  console.log(`social_accounts rows: ${a.n} | social_access rows: ${b.n}`);
  console.log('SOCIAL_GOVERNANCE MIGRATION OK');
} catch (e) {
  console.error('MIGRATION ERROR:', e.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
