/**
 * Digital / portal / social access registry — assets PRD Phase 3.
 *
 * One row per grant: this person holds this level of access to this platform,
 * business manager or ad account. Separate from `asset_assignments`, which
 * records what was physically issued to an employee and cannot express access
 * levels, admin/owner flags, 2FA state, review dates or seat accounting.
 *
 * Seat accounting (PRD acceptance criteria 2, 3, 7): when a grant consumes a
 * paid seat, activating it reduces the platform's available stock and revoking
 * it returns the seat — once, tracked by `seat_reclaimed`, so a double revoke
 * cannot inflate the count.
 */
import { Router } from 'express';
import pool from '../config/db.js';
import { auth } from '../middleware/auth.js';
import { authorize } from '../middleware/rbac.js';
import { addAudit } from '../services/auditService.js';
import { tenantScope, companyClause, resolveWriteCompanyId } from '../middleware/tenant.js';
import { OWNER_SCOPES } from '../config/ownerScopes.js';
import {
  ACCESS_LEVELS, accessRank, PRIVILEGED_RANK, DIGITAL_STATUSES, RELEASED_STATUSES, SEAT_TYPES,
} from '../config/accessLevels.js';

const router = Router();
router.use(auth, tenantScope);

const EDITABLE = [
  'platform_id', 'employee_id', 'owner_scope',
  'platform_name', 'category', 'workspace_business_name',
  'account_page_name', 'account_page_url', 'business_portfolio_url', 'business_portfolio_id',
  'business_id', 'ad_account_id', 'page_channel_workspace_id',
  'team_member_full_name', 'team_member_profile_url', 'team_member_email',
  'username', 'login_email', 'registered_phone',
  'access_level', 'page_access_level', 'ads_access_level',
  'has_admin_access', 'has_owner_access', 'can_manage_users',
  'seat_type', 'seat_consumes_inventory',
  'status', 'assigned_on', 'revoked_on',
  'two_factor_enabled', 'last_access_review', 'vault_secret_reference',
  'managed_by', 'notes',
];

const BOOLS = ['has_admin_access', 'has_owner_access', 'can_manage_users', 'seat_consumes_inventory', 'two_factor_enabled'];
const DATES = ['assigned_on', 'revoked_on', 'last_access_review'];

const pick = (body) => {
  const out = {};
  for (const f of EDITABLE) {
    if (body[f] === undefined) continue;
    let v = body[f];
    if (v === '') v = null;
    if (BOOLS.includes(f)) v = v === true || v === 'true' || v === 1 || v === '1';
    out[f] = v;
  }
  return out;
};

/** @returns {string|null} error message, or null when valid */
function validate(data) {
  for (const f of ['access_level', 'page_access_level', 'ads_access_level']) {
    if (data[f] != null && !ACCESS_LEVELS.includes(data[f])) {
      return `${f} must be one of: ${ACCESS_LEVELS.join(', ')}`;
    }
  }
  if (data.status != null && !DIGITAL_STATUSES.includes(data.status)) {
    return `status must be one of: ${DIGITAL_STATUSES.join(', ')}`;
  }
  if (data.seat_type != null && !SEAT_TYPES.includes(data.seat_type)) {
    return `seat_type must be one of: ${SEAT_TYPES.join(', ')}`;
  }
  if (data.owner_scope != null && !OWNER_SCOPES.includes(data.owner_scope)) {
    return `owner_scope must be one of: ${OWNER_SCOPES.join(', ')}`;
  }
  for (const f of DATES) {
    if (data[f] != null && !/^\d{4}-\d{2}-\d{2}$/.test(String(data[f]).slice(0, 10))) {
      return `${f} must be a date (YYYY-MM-DD)`;
    }
  }
  // The PRD flags admin and owner rights explicitly, so they must agree with the
  // ladder rather than be set independently and contradict it.
  if (data.access_level != null) {
    const rank = accessRank(data.access_level);
    if (data.has_owner_access && data.access_level !== 'Owner') {
      return 'has_owner_access is only valid when access_level is "Owner"';
    }
    if (data.has_admin_access && rank < PRIVILEGED_RANK) {
      return `has_admin_access requires an access_level of Admin or higher (got "${data.access_level}")`;
    }
  }
  return null;
}

async function getScoped(req, id, columns = '*') {
  const co = companyClause(req, 'company_id');
  const [[row]] = await pool.query(`SELECT ${columns} FROM digital_access WHERE id = ?` + co.clause, [id, ...co.params]);
  return row || null;
}

const isLive = (status) => !RELEASED_STATUSES.includes(status);

/**
 * Moves a platform's seat counter when a grant starts or stops consuming one.
 * `seat_reclaimed` makes the release idempotent: revoking twice must not hand
 * back two seats.
 */
async function adjustSeats({ platformId, consumes, fromStatus, toStatus, rowId }) {
  if (!platformId || !consumes) return;
  const wasLive = fromStatus ? isLive(fromStatus) : false;
  const nowLive = isLive(toStatus);
  if (!wasLive && nowLive) {
    await pool.query('UPDATE platform_catalog SET inventory_total = GREATEST(0, inventory_total - 1) WHERE id = ?', [platformId]);
    if (rowId) await pool.query('UPDATE digital_access SET seat_reclaimed = FALSE WHERE id = ?', [rowId]);
  } else if (wasLive && !nowLive) {
    const [[row]] = rowId
      ? await pool.query('SELECT seat_reclaimed FROM digital_access WHERE id = ?', [rowId])
      : [[{ seat_reclaimed: 0 }]];
    if (!row?.seat_reclaimed) {
      await pool.query('UPDATE platform_catalog SET inventory_total = inventory_total + 1 WHERE id = ?', [platformId]);
      if (rowId) await pool.query('UPDATE digital_access SET seat_reclaimed = TRUE WHERE id = ?', [rowId]);
    }
  }
}

// ─── Reports ─────────────────────────────────────────────────────────────────
// Declared before /:id so the report names are not read as record ids.

// GET /api/digital-access/reports — the privileged-access views the PRD names
router.get('/reports', authorize('admin', 'hr_manager', 'accountant'), async (req, res) => {
  try {
    const co = companyClause(req, 'da.company_id');
    const base = `FROM digital_access da
      LEFT JOIN employees e ON da.employee_id = e.id
      LEFT JOIN platform_catalog pc ON da.platform_id = pc.id
      WHERE 1=1${co.clause}`;
    const p = co.params;
    const sel = `SELECT da.id, da.platform_name, da.account_page_name, da.owner_scope, da.access_level,
                        da.status, da.team_member_full_name, da.team_member_email, da.two_factor_enabled,
                        DATE_FORMAT(da.last_access_review, '%Y-%m-%d') AS last_access_review, da.seat_type,
                        CONCAT_WS(' ', e.first_name, e.last_name) AS employee_name`;

    // Review overdue after 90 days — the PRD asks for at least quarterly.
    const reviewDays = Math.max(1, Math.min(365, parseInt(req.query.review_days) || 90));

    const [privileged] = await pool.query(
      `${sel} ${base} AND da.access_rank >= ? AND da.status NOT IN ('Revoked','Archived')
       ORDER BY da.access_rank DESC, da.platform_name`, [...p, PRIVILEGED_RANK]);
    const [owners] = await pool.query(
      `${sel} ${base} AND da.has_owner_access = TRUE AND da.status NOT IN ('Revoked','Archived')
       ORDER BY da.platform_name`, p);
    const [noTwoFactor] = await pool.query(
      `${sel} ${base} AND da.two_factor_enabled = FALSE AND da.access_rank >= ?
         AND da.status NOT IN ('Revoked','Archived') ORDER BY da.access_rank DESC`, [...p, PRIVILEGED_RANK]);
    const [overdueReview] = await pool.query(
      `${sel} ${base} AND da.status NOT IN ('Revoked','Archived')
         AND (da.last_access_review IS NULL OR da.last_access_review < DATE_SUB(CURDATE(), INTERVAL ? DAY))
       ORDER BY da.last_access_review IS NOT NULL, da.last_access_review`, [...p, reviewDays]);
    const [pendingRevoke] = await pool.query(
      `${sel} ${base} AND da.status = 'Suspended' ORDER BY da.platform_name`, p);
    // A seat still counted against stock while the person is gone.
    const [unusedSeats] = await pool.query(
      `${sel} ${base} AND da.seat_consumes_inventory = TRUE AND da.seat_reclaimed = FALSE
         AND da.status IN ('Revoked','Archived') ORDER BY da.platform_name`, p);
    // The same person holding access in both companies — the PRD wants this visible.
    const [crossEntity] = await pool.query(
      `SELECT da.team_member_email, COUNT(DISTINCT da.owner_scope) scopes,
              GROUP_CONCAT(DISTINCT da.owner_scope) owner_scopes, COUNT(*) grants
         FROM digital_access da WHERE da.team_member_email IS NOT NULL
           AND da.status NOT IN ('Revoked','Archived')${companyClause(req, 'da.company_id').clause}
         GROUP BY da.team_member_email HAVING scopes > 1 ORDER BY grants DESC`, p);

    res.json({
      review_days: reviewDays,
      privileged, owners, no_two_factor: noTwoFactor, overdue_review: overdueReview,
      pending_revoke: pendingRevoke, unused_seats: unusedSeats, cross_entity: crossEntity,
    });
  } catch (err) { console.error('GET /digital-access/reports error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

// GET /api/digital-access/options — the vocabularies the UI needs
router.get('/options', async (req, res) => {
  res.json({ access_levels: ACCESS_LEVELS, statuses: DIGITAL_STATUSES, seat_types: SEAT_TYPES, owner_scopes: OWNER_SCOPES });
});

// ─── CRUD ────────────────────────────────────────────────────────────────────

// GET /api/digital-access?platform_id=&employee_id=&status=&owner_scope=&privileged=1&search=
router.get('/', async (req, res) => {
  try {
    const co = companyClause(req, 'da.company_id');
    // A MySQL DATE arrives as a JS Date at local midnight, so serialising it
    // shifts a day back. Re-select the three date columns formatted; being
    // listed after da.* means these values win.
    let sql = `SELECT da.*, DATE_FORMAT(da.assigned_on, '%Y-%m-%d') AS assigned_on,
                      DATE_FORMAT(da.revoked_on, '%Y-%m-%d') AS revoked_on,
                      DATE_FORMAT(da.last_access_review, '%Y-%m-%d') AS last_access_review,
                      CONCAT_WS(' ', e.first_name, e.last_name) AS employee_name,
                      pc.name AS catalog_platform_name, ac.name AS category_name, ac.icon AS category_icon,
                      c.short_code AS company_short_code
                 FROM digital_access da
                 LEFT JOIN employees e ON da.employee_id = e.id
                 LEFT JOIN platform_catalog pc ON da.platform_id = pc.id
                 LEFT JOIN asset_categories ac ON pc.category_id = ac.id
                 LEFT JOIN companies c ON da.company_id = c.id
                WHERE 1=1${co.clause}`;
    const params = [...co.params];
    if (req.query.platform_id) { sql += ' AND da.platform_id = ?'; params.push(req.query.platform_id); }
    if (req.query.employee_id) { sql += ' AND da.employee_id = ?'; params.push(req.query.employee_id); }
    if (DIGITAL_STATUSES.includes(req.query.status)) { sql += ' AND da.status = ?'; params.push(req.query.status); }
    if (OWNER_SCOPES.includes(req.query.owner_scope)) { sql += ' AND da.owner_scope = ?'; params.push(req.query.owner_scope); }
    if (req.query.privileged === '1') { sql += ' AND da.access_rank >= ?'; params.push(PRIVILEGED_RANK); }
    if (req.query.search) {
      const s = `%${req.query.search}%`;
      sql += ' AND (da.platform_name LIKE ? OR da.team_member_full_name LIKE ? OR da.team_member_email LIKE ? OR da.account_page_name LIKE ?)';
      params.push(s, s, s, s);
    }
    sql += ' ORDER BY da.access_rank DESC, da.platform_name, da.team_member_full_name';
    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) { console.error('GET /digital-access error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

// POST /api/digital-access
router.post('/', authorize('admin', 'hr_manager', 'accountant'), async (req, res) => {
  try {
    const data = pick(req.body);
    data.company_id = resolveWriteCompanyId(req, req.body.company_id);
    if (!data.company_id) return res.status(400).json({ error: 'Company is required' });
    if (!data.platform_name) return res.status(422).json({ error: 'platform_name is required' });

    const err = validate(data);
    if (err) return res.status(422).json({ error: err });

    // Fill what the catalogue already knows rather than asking twice.
    if (data.platform_id) {
      const [[plat]] = await pool.query(
        `SELECT pc.name, pc.owner_scope, ac.name AS category FROM platform_catalog pc
         LEFT JOIN asset_categories ac ON pc.category_id = ac.id WHERE pc.id = ?`, [data.platform_id]);
      if (plat) {
        if (!data.category) data.category = plat.category;
        if (!data.owner_scope) data.owner_scope = plat.owner_scope;
      }
    }
    data.access_rank = accessRank(data.access_level || 'No Access');
    data.created_by = req.user.id;

    const [result] = await pool.query('INSERT INTO digital_access SET ?', data);
    await adjustSeats({
      platformId: data.platform_id, consumes: data.seat_consumes_inventory,
      fromStatus: null, toStatus: data.status || 'Pending Activation', rowId: result.insertId,
    });
    await addAudit(pool, req.user, 'Digital Access', 'Granted',
      `${data.access_level || 'No Access'} access to "${data.platform_name}" for ${data.team_member_full_name || data.team_member_email || 'unnamed holder'}`);
    res.status(201).json({ id: result.insertId, ...data });
  } catch (err) { console.error('POST /digital-access error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

// PUT /api/digital-access/:id (company-scoped; cannot re-tenant)
router.put('/:id', authorize('admin', 'hr_manager', 'accountant'), async (req, res) => {
  try {
    // Every field a cross-field rule reads has to be in here, or a partial
    // update can slip past the rule by simply omitting the other half of it.
    const existing = await getScoped(req, req.params.id,
      `id, platform_id, status, seat_consumes_inventory, platform_name,
       access_level, has_admin_access, has_owner_access,
       DATE_FORMAT(revoked_on, '%Y-%m-%d') AS revoked_on`);
    if (!existing) return res.status(404).json({ error: 'Access record not found' });

    const data = pick(req.body);
    if (!Object.keys(data).length) return res.status(400).json({ error: 'Nothing to update' });

    // Validate against the merged result so a partial update cannot slip past a
    // cross-field rule by omitting the other half of it.
    const merged = { ...existing, ...data };
    const err = validate(merged);
    if (err) return res.status(422).json({ error: err });

    if (data.access_level !== undefined) data.access_rank = accessRank(data.access_level);
    // Revoking should date itself; nobody remembers to fill that field in.
    if (data.status && RELEASED_STATUSES.includes(data.status) && !data.revoked_on && !merged.revoked_on) {
      data.revoked_on = new Date().toISOString().slice(0, 10);
    }

    await pool.query('UPDATE digital_access SET ? WHERE id = ?', [data, req.params.id]);
    await adjustSeats({
      platformId: merged.platform_id,
      consumes: merged.seat_consumes_inventory,
      fromStatus: existing.status,
      toStatus: merged.status,
      rowId: existing.id,
    });
    await addAudit(pool, req.user, 'Digital Access', 'Updated',
      `Access #${req.params.id} on "${existing.platform_name}" updated`
      + (data.status && data.status !== existing.status ? ` — status ${existing.status} → ${data.status}` : ''));
    res.json({ success: true });
  } catch (err) { console.error('PUT /digital-access/:id error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

// PUT /api/digital-access/:id/revoke — the offboarding action, spelled out
router.put('/:id/revoke', authorize('admin', 'hr_manager', 'accountant'), async (req, res) => {
  try {
    const existing = await getScoped(req, req.params.id, 'id, platform_id, status, seat_consumes_inventory, platform_name, team_member_full_name');
    if (!existing) return res.status(404).json({ error: 'Access record not found' });
    if (RELEASED_STATUSES.includes(existing.status)) {
      return res.status(409).json({ error: `This access is already ${existing.status}` });
    }
    await pool.query(
      "UPDATE digital_access SET status = 'Revoked', revoked_on = CURDATE(), notes = COALESCE(?, notes) WHERE id = ?",
      [req.body?.notes || null, existing.id]);
    await adjustSeats({
      platformId: existing.platform_id, consumes: existing.seat_consumes_inventory,
      fromStatus: existing.status, toStatus: 'Revoked', rowId: existing.id,
    });
    await addAudit(pool, req.user, 'Digital Access', 'Revoked',
      `Access to "${existing.platform_name}" revoked for ${existing.team_member_full_name || 'unnamed holder'}`);
    res.json({ success: true });
  } catch (err) { console.error('PUT /digital-access/:id/revoke error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

// PUT /api/digital-access/:id/review — record that the grant was verified today
router.put('/:id/review', authorize('admin', 'hr_manager', 'accountant'), async (req, res) => {
  try {
    const existing = await getScoped(req, req.params.id, 'id, platform_name');
    if (!existing) return res.status(404).json({ error: 'Access record not found' });
    await pool.query('UPDATE digital_access SET last_access_review = CURDATE() WHERE id = ?', [existing.id]);
    await addAudit(pool, req.user, 'Digital Access', 'Reviewed', `Access #${existing.id} on "${existing.platform_name}" reviewed`);
    res.json({ success: true });
  } catch (err) { console.error('PUT /digital-access/:id/review error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

// GET /api/digital-access/by-employee/:employeeId — for the employee profile
router.get('/by-employee/:employeeId', async (req, res) => {
  try {
    const co = companyClause(req, 'da.company_id');
    const [rows] = await pool.query(
      `SELECT da.*, DATE_FORMAT(da.assigned_on, '%Y-%m-%d') AS assigned_on,
                      DATE_FORMAT(da.revoked_on, '%Y-%m-%d') AS revoked_on,
                      DATE_FORMAT(da.last_access_review, '%Y-%m-%d') AS last_access_review,
              pc.name AS catalog_platform_name, ac.icon AS category_icon
         FROM digital_access da
         LEFT JOIN platform_catalog pc ON da.platform_id = pc.id
         LEFT JOIN asset_categories ac ON pc.category_id = ac.id
        WHERE da.employee_id = ?${co.clause}
        ORDER BY da.access_rank DESC, da.platform_name`, [req.params.employeeId, ...co.params]);
    res.json(rows);
  } catch (err) { console.error('GET /digital-access/by-employee error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

// DELETE /api/digital-access/:id — archive is preferred (PRD business rule 7)
router.delete('/:id', authorize('admin'), async (req, res) => {
  try {
    const existing = await getScoped(req, req.params.id, 'id, platform_id, status, seat_consumes_inventory, platform_name');
    if (!existing) return res.status(404).json({ error: 'Access record not found' });
    // Return the seat first — deleting the row would otherwise lose a paid seat.
    await adjustSeats({
      platformId: existing.platform_id, consumes: existing.seat_consumes_inventory,
      fromStatus: existing.status, toStatus: 'Archived', rowId: existing.id,
    });
    await pool.query('DELETE FROM digital_access WHERE id = ?', [existing.id]);
    await addAudit(pool, req.user, 'Digital Access', 'Deleted', `Access #${req.params.id} on "${existing.platform_name}" deleted`);
    res.json({ success: true });
  } catch (err) { console.error('DELETE /digital-access/:id error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

export default router;
