/**
 * Social-media account ownership and per-layer team access — assets PRD Phase 4.
 *
 * Two resources under one router:
 *   /social/accounts        the asset: page, business manager, ad account,
 *                           creators, billing owner, recovery controls
 *   /social/access          one row per person PER LAYER (governance rule 6),
 *                           with the seven rights tracked separately
 *
 * The governance reports are the point of the module: an inventory nobody
 * reviews is a list, not a control. /social/governance implements the checks the
 * PRD names — missing backup admins, 2FA gaps, personal-email ownership,
 * overdue reviews, cross-entity access, and missing creator provenance.
 */
import { Router } from 'express';
import pool from '../config/db.js';
import { auth } from '../middleware/auth.js';
import { authorize } from '../middleware/rbac.js';
import { addAudit } from '../services/auditService.js';
import { tenantScope, companyClause, resolveWriteCompanyId } from '../middleware/tenant.js';
import { ACCESS_LEVELS, accessRank, PRIVILEGED_RANK } from '../config/accessLevels.js';
import {
  ASSET_LAYERS, SOCIAL_ACCOUNT_STATUSES, SOCIAL_ACCESS_STATUSES, SOCIAL_RIGHTS,
  SOCIAL_ACCESS_CLOSED, isPersonalEmail,
} from '../config/socialLayers.js';

const router = Router();
router.use(auth, tenantScope);

// Only RE or MKT: rule 14 requires every social account to belong to exactly one
// entity. "Shared" is not an option here, unlike the platform catalogue.
const ACCOUNT_SCOPES = ['RE', 'MKT'];

const ACCOUNT_FIELDS = [
  'owner_scope', 'platform', 'account_type',
  'account_name', 'account_url', 'account_id', 'username_handle',
  'business_manager_name', 'business_manager_url', 'business_manager_id',
  'ads_manager_platform', 'ads_account_name', 'ads_account_url', 'ads_account_id',
  'page_creator_name', 'page_creator_profile_url', 'page_creator_email',
  'ads_creator_name', 'ads_creator_profile_url', 'ads_creator_email',
  'creation_date', 'primary_business_owner', 'backup_admin', 'billing_owner', 'payment_method_owner',
  'pixel_dataset_id', 'catalogue_commerce_id',
  'recovery_email', 'recovery_phone', 'two_factor_enabled',
  'status', 'last_ownership_review', 'vault_secret_reference', 'notes',
];
const ACCOUNT_BOOLS = ['two_factor_enabled'];
const ACCOUNT_DATES = ['creation_date', 'last_ownership_review'];

const ACCESS_FIELDS = [
  'social_account_id', 'employee_id', 'asset_layer', 'asset_name', 'asset_id', 'asset_url',
  'team_member_name', 'team_member_profile_url', 'team_member_email', 'department', 'job_title',
  'access_level', ...SOCIAL_RIGHTS,
  'granted_by_name', 'granted_by_profile_url', 'date_granted', 'status',
  'two_factor_enabled', 'last_access_review', 'removal_date', 'vault_secret_reference', 'notes',
];
const ACCESS_BOOLS = [...SOCIAL_RIGHTS, 'two_factor_enabled'];
const ACCESS_DATES = ['date_granted', 'last_access_review', 'removal_date'];

const pick = (body, fields, bools) => {
  const out = {};
  for (const f of fields) {
    if (body[f] === undefined) continue;
    let v = body[f];
    if (v === '') v = null;
    if (bools.includes(f)) v = v === true || v === 'true' || v === 1 || v === '1';
    out[f] = v;
  }
  return out;
};

const badDate = (data, dates) => dates.find(
  (f) => data[f] != null && !/^\d{4}-\d{2}-\d{2}$/.test(String(data[f]).slice(0, 10)));

// Formatted in SQL: a MySQL DATE arrives as a JS Date at local midnight, and
// serialising that shifts the day back.
const D = (t, f) => `DATE_FORMAT(${t}.${f}, '%Y-%m-%d') AS ${f}`;
const ACCOUNT_DATE_SEL = ACCOUNT_DATES.map((f) => D('sa', f)).join(', ');
const ACCESS_DATE_SEL = ACCESS_DATES.map((f) => D('sc', f)).join(', ');

// ─── Vocabularies ────────────────────────────────────────────────────────────
router.get('/options', (req, res) => {
  res.json({
    asset_layers: ASSET_LAYERS,
    account_statuses: SOCIAL_ACCOUNT_STATUSES,
    access_statuses: SOCIAL_ACCESS_STATUSES,
    access_levels: ACCESS_LEVELS,
    rights: SOCIAL_RIGHTS,
    account_scopes: ACCOUNT_SCOPES,
  });
});

// ─── Governance reports ──────────────────────────────────────────────────────
// Declared before the /:id routes so the names are not read as ids.
router.get('/governance', authorize('admin', 'hr_manager', 'accountant'), async (req, res) => {
  try {
    const co = companyClause(req, 'sa.company_id');
    const coAcc = companyClause(req, 'sc.company_id');
    const reviewDays = Math.max(1, Math.min(365, parseInt(req.query.review_days) || 90));
    const acc = `SELECT sa.id, sa.platform, sa.owner_scope, sa.account_name, sa.status,
                        sa.primary_business_owner, sa.backup_admin, sa.billing_owner,
                        sa.two_factor_enabled, ${ACCOUNT_DATE_SEL}
                   FROM social_accounts sa WHERE 1=1${co.clause}`;

    // Rule 3: a critical asset must not depend on a single administrator.
    const [missingBackupAdmin] = await pool.query(
      `${acc} AND (sa.backup_admin IS NULL OR TRIM(sa.backup_admin) = '')
         AND sa.status <> 'Archived' ORDER BY sa.owner_scope, sa.platform`, co.params);

    // Rule 5: 2FA is mandatory wherever ownership or admin rights sit.
    const [twoFactorGaps] = await pool.query(
      `${acc} AND sa.two_factor_enabled = FALSE AND sa.status <> 'Archived'
       ORDER BY sa.owner_scope, sa.platform`, co.params);

    // Rule 7: reviewed at least quarterly.
    const [overdueOwnershipReview] = await pool.query(
      `${acc} AND sa.status <> 'Archived'
         AND (sa.last_ownership_review IS NULL OR sa.last_ownership_review < DATE_SUB(CURDATE(), INTERVAL ? DAY))
       ORDER BY sa.last_ownership_review IS NOT NULL, sa.last_ownership_review`, [...co.params, reviewDays]);

    // Rule 2 / 12: creator recorded by full name AND direct profile URL.
    const [missingCreatorProvenance] = await pool.query(
      `SELECT sa.id, sa.platform, sa.owner_scope, sa.account_name, sa.status,
              sa.page_creator_name, sa.page_creator_profile_url,
              sa.ads_creator_name, sa.ads_creator_profile_url
         FROM social_accounts sa WHERE 1=1${co.clause} AND sa.status <> 'Archived'
           AND (sa.page_creator_name IS NULL OR TRIM(sa.page_creator_name) = ''
             OR sa.page_creator_profile_url IS NULL OR TRIM(sa.page_creator_profile_url) = '')
         ORDER BY sa.owner_scope, sa.platform`, co.params);

    // Rule 4: a personal address must not be the owner or the recovery route.
    const [candidates] = await pool.query(
      `SELECT sa.id, sa.platform, sa.owner_scope, sa.account_name,
              sa.page_creator_email, sa.ads_creator_email, sa.recovery_email
         FROM social_accounts sa WHERE 1=1${co.clause} AND sa.status <> 'Archived'`, co.params);
    const personalEmailRisk = candidates.flatMap((r) => {
      const hits = [
        ['page_creator_email', r.page_creator_email],
        ['ads_creator_email', r.ads_creator_email],
        ['recovery_email', r.recovery_email],
      ].filter(([, v]) => isPersonalEmail(v));
      return hits.length ? [{ ...r, personal_fields: hits.map(([k, v]) => `${k}: ${v}`) }] : [];
    });

    // Rule 9: billing access held apart from publishing, and visible.
    const [billingHolders] = await pool.query(
      `SELECT sc.id, sc.team_member_name, sc.team_member_email, sc.asset_layer, sc.access_level,
              sa.platform, sa.owner_scope
         FROM social_access sc JOIN social_accounts sa ON sc.social_account_id = sa.id
        WHERE sc.can_manage_billing = TRUE AND sc.status NOT IN ('Removed')${coAcc.clause}
        ORDER BY sa.owner_scope, sa.platform`, coAcc.params);

    // Rule 15: the same person may hold access in both entities, but it must be
    // visible that they do.
    const [crossEntityAccess] = await pool.query(
      `SELECT sc.team_member_email, sc.team_member_name,
              COUNT(DISTINCT sa.owner_scope) scopes, GROUP_CONCAT(DISTINCT sa.owner_scope) owner_scopes,
              COUNT(*) grants
         FROM social_access sc JOIN social_accounts sa ON sc.social_account_id = sa.id
        WHERE sc.status NOT IN ('Removed') AND sc.team_member_email IS NOT NULL${coAcc.clause}
        GROUP BY sc.team_member_email, sc.team_member_name
        HAVING scopes > 1 ORDER BY grants DESC`, coAcc.params);

    // Access rows missing the identity the PRD insists on (rules 12 and 14).
    const [incompleteAccessIdentity] = await pool.query(
      `SELECT sc.id, sc.team_member_name, sc.team_member_email, sc.team_member_profile_url,
              sc.asset_layer, sa.platform, sa.owner_scope
         FROM social_access sc JOIN social_accounts sa ON sc.social_account_id = sa.id
        WHERE sc.status NOT IN ('Removed')${coAcc.clause}
          AND ((sc.team_member_email IS NULL OR TRIM(sc.team_member_email) = '')
            OR (sc.team_member_profile_url IS NULL OR TRIM(sc.team_member_profile_url) = ''))
        ORDER BY sa.owner_scope, sa.platform`, coAcc.params);

    // Privileged access with no confirmed 2FA (rule 5 at the person level).
    const [privilegedNoTwoFactor] = await pool.query(
      `SELECT sc.id, sc.team_member_name, sc.team_member_email, sc.asset_layer, sc.access_level,
              sa.platform, sa.owner_scope
         FROM social_access sc JOIN social_accounts sa ON sc.social_account_id = sa.id
        WHERE sc.access_rank >= ? AND sc.two_factor_enabled = FALSE
          AND sc.status NOT IN ('Removed')${coAcc.clause}
        ORDER BY sc.access_rank DESC`, [PRIVILEGED_RANK, ...coAcc.params]);

    // Accounts still shells — the count the PRD calls "pending completion".
    const [[pending]] = await pool.query(
      `SELECT COUNT(*) n FROM social_accounts sa WHERE sa.status = 'To Be Completed'${co.clause}`, co.params);

    res.json({
      review_days: reviewDays,
      pending_completion: pending.n,
      missing_backup_admin: missingBackupAdmin,
      two_factor_gaps: twoFactorGaps,
      overdue_ownership_review: overdueOwnershipReview,
      missing_creator_provenance: missingCreatorProvenance,
      personal_email_risk: personalEmailRisk,
      billing_holders: billingHolders,
      cross_entity_access: crossEntityAccess,
      incomplete_access_identity: incompleteAccessIdentity,
      privileged_no_two_factor: privilegedNoTwoFactor,
    });
  } catch (err) { console.error('GET /social/governance error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

// ─── Accounts ────────────────────────────────────────────────────────────────
router.get('/accounts', async (req, res) => {
  try {
    const co = companyClause(req, 'sa.company_id');
    let sql = `SELECT sa.*, ${ACCOUNT_DATE_SEL},
                      (SELECT COUNT(*) FROM social_access sc
                        WHERE sc.social_account_id = sa.id AND sc.status NOT IN ('Removed')) AS access_count
                 FROM social_accounts sa WHERE 1=1${co.clause}`;
    const params = [...co.params];
    if (ACCOUNT_SCOPES.includes(req.query.owner_scope)) { sql += ' AND sa.owner_scope = ?'; params.push(req.query.owner_scope); }
    if (SOCIAL_ACCOUNT_STATUSES.includes(req.query.status)) { sql += ' AND sa.status = ?'; params.push(req.query.status); }
    if (req.query.platform) { sql += ' AND sa.platform = ?'; params.push(req.query.platform); }
    if (req.query.search) {
      const s = `%${req.query.search}%`;
      sql += ' AND (sa.platform LIKE ? OR sa.account_name LIKE ? OR sa.username_handle LIKE ?)';
      params.push(s, s, s);
    }
    sql += ' ORDER BY sa.owner_scope, sa.platform';
    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) { console.error('GET /social/accounts error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

async function getAccount(req, id) {
  const co = companyClause(req, 'company_id');
  const [[row]] = await pool.query(
    `SELECT *, ${ACCOUNT_DATES.map((f) => `DATE_FORMAT(${f}, '%Y-%m-%d') AS ${f}`).join(', ')}
       FROM social_accounts WHERE id = ?` + co.clause, [id, ...co.params]);
  return row || null;
}

router.get('/accounts/:id', async (req, res) => {
  try {
    const account = await getAccount(req, req.params.id);
    if (!account) return res.status(404).json({ error: 'Social account not found' });
    const [access] = await pool.query(
      `SELECT sc.*, ${ACCESS_DATE_SEL}, CONCAT_WS(' ', e.first_name, e.last_name) AS employee_name
         FROM social_access sc LEFT JOIN employees e ON sc.employee_id = e.id
        WHERE sc.social_account_id = ? ORDER BY sc.asset_layer, sc.access_rank DESC`, [account.id]);
    res.json({ ...account, access });
  } catch (err) { console.error('GET /social/accounts/:id error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

router.post('/accounts', authorize('admin', 'hr_manager', 'accountant'), async (req, res) => {
  try {
    const data = pick(req.body, ACCOUNT_FIELDS, ACCOUNT_BOOLS);
    data.company_id = resolveWriteCompanyId(req, req.body.company_id);
    if (!data.company_id) return res.status(400).json({ error: 'Company is required' });
    if (!data.platform) return res.status(422).json({ error: 'platform is required' });
    if (!ACCOUNT_SCOPES.includes(data.owner_scope)) {
      return res.status(422).json({ error: 'A social account must belong to exactly one entity: RE or MKT' });
    }
    if (data.status != null && !SOCIAL_ACCOUNT_STATUSES.includes(data.status)) {
      return res.status(422).json({ error: `status must be one of: ${SOCIAL_ACCOUNT_STATUSES.join(', ')}` });
    }
    const bad = badDate(data, ACCOUNT_DATES);
    if (bad) return res.status(422).json({ error: `${bad} must be a date (YYYY-MM-DD)` });

    data.created_by = req.user.id;
    const [result] = await pool.query('INSERT INTO social_accounts SET ?', data);
    await addAudit(pool, req.user, 'Social', 'Account Created', `${data.owner_scope} ${data.platform} account record created`);
    res.status(201).json({ id: result.insertId, ...data });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'This entity already has a record for that platform' });
    console.error('POST /social/accounts error:', err); res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/accounts/:id', authorize('admin', 'hr_manager', 'accountant'), async (req, res) => {
  try {
    const existing = await getAccount(req, req.params.id);
    if (!existing) return res.status(404).json({ error: 'Social account not found' });
    const data = pick(req.body, ACCOUNT_FIELDS, ACCOUNT_BOOLS);
    if (!Object.keys(data).length) return res.status(400).json({ error: 'Nothing to update' });
    if (data.owner_scope != null && !ACCOUNT_SCOPES.includes(data.owner_scope)) {
      return res.status(422).json({ error: 'A social account must belong to exactly one entity: RE or MKT' });
    }
    if (data.status != null && !SOCIAL_ACCOUNT_STATUSES.includes(data.status)) {
      return res.status(422).json({ error: `status must be one of: ${SOCIAL_ACCOUNT_STATUSES.join(', ')}` });
    }
    const bad = badDate(data, ACCOUNT_DATES);
    if (bad) return res.status(422).json({ error: `${bad} must be a date (YYYY-MM-DD)` });

    // Moving off "To Be Completed" is a claim that the record is real, so hold it
    // to the ownership details the PRD requires before accepting the claim.
    const merged = { ...existing, ...data };
    if (merged.status === 'Active') {
      const missing = [];
      if (!merged.account_name) missing.push('account_name');
      if (!merged.account_url) missing.push('account_url');
      if (!merged.page_creator_name) missing.push('page_creator_name');
      if (!merged.page_creator_profile_url) missing.push('page_creator_profile_url');
      if (!merged.primary_business_owner) missing.push('primary_business_owner');
      if (missing.length) {
        return res.status(422).json({
          error: `An account cannot be marked Active until its ownership is recorded. Missing: ${missing.join(', ')}`,
          missing,
        });
      }
    }

    await pool.query('UPDATE social_accounts SET ? WHERE id = ?', [data, existing.id]);
    await addAudit(pool, req.user, 'Social', 'Account Updated',
      `${existing.owner_scope} ${existing.platform} account updated`
      + (data.status && data.status !== existing.status ? ` — status ${existing.status} → ${data.status}` : ''));
    res.json({ success: true });
  } catch (err) { console.error('PUT /social/accounts/:id error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

router.put('/accounts/:id/review', authorize('admin', 'hr_manager', 'accountant'), async (req, res) => {
  try {
    const existing = await getAccount(req, req.params.id);
    if (!existing) return res.status(404).json({ error: 'Social account not found' });
    await pool.query('UPDATE social_accounts SET last_ownership_review = CURDATE() WHERE id = ?', [existing.id]);
    await addAudit(pool, req.user, 'Social', 'Ownership Reviewed', `${existing.owner_scope} ${existing.platform} ownership reviewed`);
    res.json({ success: true });
  } catch (err) { console.error('PUT /social/accounts/:id/review error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

// Archive rather than delete (PRD business rule 7); a hard delete stays admin-only.
router.delete('/accounts/:id', authorize('admin'), async (req, res) => {
  try {
    const existing = await getAccount(req, req.params.id);
    if (!existing) return res.status(404).json({ error: 'Social account not found' });
    await pool.query('DELETE FROM social_accounts WHERE id = ?', [existing.id]);
    await addAudit(pool, req.user, 'Social', 'Account Deleted',
      `${existing.owner_scope} ${existing.platform} account record deleted along with its access rows`);
    res.json({ success: true });
  } catch (err) { console.error('DELETE /social/accounts/:id error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

// ─── Per-layer team access ───────────────────────────────────────────────────
router.get('/access', async (req, res) => {
  try {
    const co = companyClause(req, 'sc.company_id');
    let sql = `SELECT sc.*, ${ACCESS_DATE_SEL}, sa.platform, sa.owner_scope, sa.account_name,
                      CONCAT_WS(' ', e.first_name, e.last_name) AS employee_name
                 FROM social_access sc
                 JOIN social_accounts sa ON sc.social_account_id = sa.id
                 LEFT JOIN employees e ON sc.employee_id = e.id
                WHERE 1=1${co.clause}`;
    const params = [...co.params];
    if (req.query.social_account_id) { sql += ' AND sc.social_account_id = ?'; params.push(req.query.social_account_id); }
    if (ASSET_LAYERS.includes(req.query.asset_layer)) { sql += ' AND sc.asset_layer = ?'; params.push(req.query.asset_layer); }
    if (SOCIAL_ACCESS_STATUSES.includes(req.query.status)) { sql += ' AND sc.status = ?'; params.push(req.query.status); }
    if (ACCOUNT_SCOPES.includes(req.query.owner_scope)) { sql += ' AND sa.owner_scope = ?'; params.push(req.query.owner_scope); }
    if (req.query.employee_id) { sql += ' AND sc.employee_id = ?'; params.push(req.query.employee_id); }
    if (req.query.search) {
      const s = `%${req.query.search}%`;
      sql += ' AND (sc.team_member_name LIKE ? OR sc.team_member_email LIKE ? OR sa.platform LIKE ?)';
      params.push(s, s, s);
    }
    sql += ' ORDER BY sa.owner_scope, sa.platform, sc.asset_layer, sc.access_rank DESC';
    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) { console.error('GET /social/access error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

function validateAccess(data) {
  if (data.asset_layer != null && !ASSET_LAYERS.includes(data.asset_layer)) {
    return `asset_layer must be one of: ${ASSET_LAYERS.join(' | ')}`;
  }
  if (data.access_level != null && !ACCESS_LEVELS.includes(data.access_level)) {
    return `access_level must be one of: ${ACCESS_LEVELS.join(', ')}`;
  }
  if (data.status != null && !SOCIAL_ACCESS_STATUSES.includes(data.status)) {
    return `status must be one of: ${SOCIAL_ACCESS_STATUSES.join(', ')}`;
  }
  const bad = badDate(data, ACCESS_DATES);
  if (bad) return `${bad} must be a date (YYYY-MM-DD)`;
  // Rule 12: a complete profile name. A single word is a first name or a label.
  if (data.team_member_name != null) {
    const name = String(data.team_member_name).trim();
    if (name.split(/\s+/).length < 2) {
      return 'team_member_name must be the complete profile name, not a first name, nickname or team label';
    }
    if (/\b(team|department|dept|group|marketing|everyone|all staff)\b/i.test(name) && name.split(/\s+/).length < 3) {
      return 'A group entry is not evidence of access — name the individual person';
    }
  }
  return null;
}

router.post('/access', authorize('admin', 'hr_manager', 'accountant'), async (req, res) => {
  try {
    const data = pick(req.body, ACCESS_FIELDS, ACCESS_BOOLS);
    if (!data.social_account_id) return res.status(422).json({ error: 'social_account_id is required' });
    if (!data.asset_layer) return res.status(422).json({ error: 'asset_layer is required' });
    if (!data.team_member_name) return res.status(422).json({ error: 'team_member_name is required' });

    const account = await getAccount(req, data.social_account_id);
    if (!account) return res.status(404).json({ error: 'Social account not found' });

    const err = validateAccess(data);
    if (err) return res.status(422).json({ error: err });

    // The grant belongs to the account's company — never a client-supplied one.
    data.company_id = account.company_id;
    data.access_rank = accessRank(data.access_level || 'No Access');
    data.created_by = req.user.id;
    if (!data.asset_name) {
      data.asset_name = data.asset_layer === 'Page / Profile / Channel' ? account.account_name
        : data.asset_layer === 'Business / Portfolio Manager' ? account.business_manager_name
          : account.ads_account_name || account.ads_manager_platform;
    }

    const [result] = await pool.query('INSERT INTO social_access SET ?', data);
    await addAudit(pool, req.user, 'Social', 'Access Granted',
      `${data.access_level || 'No Access'} on ${account.owner_scope} ${account.platform} (${data.asset_layer}) for ${data.team_member_name}`);
    res.status(201).json({ id: result.insertId, ...data });
  } catch (err) { console.error('POST /social/access error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

async function getAccess(req, id) {
  const co = companyClause(req, 'sc.company_id');
  const [[row]] = await pool.query(
    `SELECT sc.*, sa.platform, sa.owner_scope FROM social_access sc
       JOIN social_accounts sa ON sc.social_account_id = sa.id
      WHERE sc.id = ?` + co.clause, [id, ...co.params]);
  return row || null;
}

router.put('/access/:id', authorize('admin', 'hr_manager', 'accountant'), async (req, res) => {
  try {
    const existing = await getAccess(req, req.params.id);
    if (!existing) return res.status(404).json({ error: 'Access record not found' });
    const data = pick(req.body, ACCESS_FIELDS, ACCESS_BOOLS);
    if (!Object.keys(data).length) return res.status(400).json({ error: 'Nothing to update' });
    // Re-tenanting through the account link is not allowed.
    delete data.social_account_id;

    const err = validateAccess({ ...existing, ...data });
    if (err) return res.status(422).json({ error: err });
    if (data.access_level !== undefined) data.access_rank = accessRank(data.access_level);
    if (data.status && SOCIAL_ACCESS_CLOSED.includes(data.status) && !data.removal_date && !existing.removal_date) {
      data.removal_date = new Date().toISOString().slice(0, 10);
    }

    await pool.query('UPDATE social_access SET ? WHERE id = ?', [data, existing.id]);
    await addAudit(pool, req.user, 'Social', 'Access Updated',
      `Access #${existing.id} on ${existing.owner_scope} ${existing.platform} updated`
      + (data.status && data.status !== existing.status ? ` — status ${existing.status} → ${data.status}` : ''));
    res.json({ success: true });
  } catch (err) { console.error('PUT /social/access/:id error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

// Offboarding action: rule 1 of Social Offboarding — revoke every layer at once.
router.put('/access/:id/remove', authorize('admin', 'hr_manager', 'accountant'), async (req, res) => {
  try {
    const existing = await getAccess(req, req.params.id);
    if (!existing) return res.status(404).json({ error: 'Access record not found' });
    if (SOCIAL_ACCESS_CLOSED.includes(existing.status)) {
      return res.status(409).json({ error: 'This access has already been removed' });
    }
    await pool.query(
      "UPDATE social_access SET status = 'Removed', removal_date = CURDATE(), notes = COALESCE(?, notes) WHERE id = ?",
      [req.body?.notes || null, existing.id]);
    await addAudit(pool, req.user, 'Social', 'Access Removed',
      `${existing.team_member_name} removed from ${existing.owner_scope} ${existing.platform} (${existing.asset_layer})`);
    res.json({ success: true });
  } catch (err) { console.error('PUT /social/access/:id/remove error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

// Remove one person from EVERY layer of one account — what offboarding actually
// needs, since doing it row by row is how a layer gets missed.
router.post('/access/remove-person', authorize('admin', 'hr_manager', 'accountant'), async (req, res) => {
  try {
    const { social_account_id, team_member_email, employee_id } = req.body || {};
    if (!social_account_id) return res.status(422).json({ error: 'social_account_id is required' });
    if (!team_member_email && !employee_id) {
      return res.status(422).json({ error: 'Identify the person by team_member_email or employee_id' });
    }
    const account = await getAccount(req, social_account_id);
    if (!account) return res.status(404).json({ error: 'Social account not found' });

    const conds = ['social_account_id = ?', "status NOT IN ('Removed')"];
    const params = [account.id];
    if (team_member_email) { conds.push('team_member_email = ?'); params.push(team_member_email); }
    if (employee_id) { conds.push('employee_id = ?'); params.push(employee_id); }
    const [result] = await pool.query(
      `UPDATE social_access SET status = 'Removed', removal_date = CURDATE() WHERE ${conds.join(' AND ')}`, params);

    await addAudit(pool, req.user, 'Social', 'Access Removed',
      `${team_member_email || `employee #${employee_id}`} removed from all ${result.affectedRows} layer(s) of ${account.owner_scope} ${account.platform}`);
    res.json({ success: true, removed: result.affectedRows });
  } catch (err) { console.error('POST /social/access/remove-person error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

router.put('/access/:id/review', authorize('admin', 'hr_manager', 'accountant'), async (req, res) => {
  try {
    const existing = await getAccess(req, req.params.id);
    if (!existing) return res.status(404).json({ error: 'Access record not found' });
    await pool.query('UPDATE social_access SET last_access_review = CURDATE() WHERE id = ?', [existing.id]);
    await addAudit(pool, req.user, 'Social', 'Access Reviewed', `Access #${existing.id} reviewed`);
    res.json({ success: true });
  } catch (err) { console.error('PUT /social/access/:id/review error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

router.delete('/access/:id', authorize('admin'), async (req, res) => {
  try {
    const existing = await getAccess(req, req.params.id);
    if (!existing) return res.status(404).json({ error: 'Access record not found' });
    await pool.query('DELETE FROM social_access WHERE id = ?', [existing.id]);
    await addAudit(pool, req.user, 'Social', 'Access Deleted', `Access #${existing.id} deleted`);
    res.json({ success: true });
  } catch (err) { console.error('DELETE /social/access/:id error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

export default router;
