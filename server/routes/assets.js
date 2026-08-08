import { Router } from 'express';
import pool from '../config/db.js';
import { auth, denyImpersonated } from '../middleware/auth.js';
import { requireModule, MODULES } from '../config/permissions.js';
import { authorize } from '../middleware/rbac.js';
import { addAudit } from '../services/auditService.js';
import { decrypt } from '../services/cryptoService.js';
import { encryptSecret, decryptSecret, aadFor, isLegacyRecord, needsRewrap } from '../services/envelopeCrypto.js';
import { notifyRole } from '../services/notificationService.js';
import bcrypt from 'bcryptjs';
import { tenantScope, companyClause, resolveWriteCompanyId } from '../middleware/tenant.js';
import { OWNER_SCOPES } from '../config/ownerScopes.js';
import { rateLimit } from '../middleware/rateLimit.js';
import multer from 'multer';
import path from 'path';
import { ensureUploadDir } from '../config/storage.js';

const upload = multer({
  dest: ensureUploadDir('handover_receipts'),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.png', '.jpg', '.jpeg'];
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, allowed.includes(ext));
  },
});

const router = Router();
// Module-gated so reads are refused too, not just writes.
// An employee's own assets come from routes/portal.js instead.
// See config/permissions.js and docs/roles_and_permissions.md.
router.use(auth, tenantScope, requireModule(MODULES.ASSETS));

// The stored credential must never reach the browser: revealing one goes through
// POST /:id/reveal-password, which is role-gated, step-up authenticated and
// audited. The list endpoints expose only whether a password exists.
//
// The wrapped data key and its AAD are stripped too. Neither is usable without
// the master key, but shipping crypto material to every browser that lists
// assets is exactly the needless exposure this design exists to remove.
const SECRET_COLUMNS = [
  'encrypted_password', 'password_iv', 'password_tag',
  'dek_wrapped', 'dek_wrap_iv', 'dek_wrap_tag', 'key_version', 'aad_context',
];
const stripSecrets = (rows) => rows.map((row) => {
  const out = { ...row, has_password: !!row.encrypted_password };
  for (const c of SECRET_COLUMNS) delete out[c];
  return out;
});

const SECRET_TIERS = ['Reference', 'Delegated', 'Stored'];

/**
 * Applies the secret-handling policy to a write (docs/secrets_protection_design.md §1).
 *
 * Reference is the default and the PRD's own position: the system records that a
 * credential exists and where to find it, never the value. A password may only
 * be encrypted into the row when the caller has explicitly declared the Stored
 * tier and justified it — otherwise a password arriving in the body is refused
 * rather than quietly kept, because quietly kept is how a credential store
 * appears without anyone deciding to build one.
 *
 * @returns {string|null} an error message, or null when the data is acceptable
 */
function applySecretPolicy(data) {
  if (data.secret_tier != null && !SECRET_TIERS.includes(data.secret_tier)) {
    return `secret_tier must be one of: ${SECRET_TIERS.join(', ')}`;
  }
  const tier = data.secret_tier;

  if (data.account_password) {
    if (tier !== 'Stored') {
      return 'Storing a password requires secret_tier "Stored" with a justification. '
        + 'By default, record a vault reference instead of the password itself.';
    }
    if (!String(data.secret_justification || '').trim()) {
      return 'secret_justification is required when storing a password';
    }
    // Deliberately NOT encrypted here. The ciphertext is bound to its row via
    // AAD, and on create the row id does not exist yet — so the caller hands the
    // plaintext to storeSecret() once the id is known.
  }

  // Moving off the Stored tier must actually drop the ciphertext, or the promise
  // that nothing is stored would be untrue.
  if (tier && tier !== 'Stored') {
    data.encrypted_password = null;
    data.password_iv = null;
    data.password_tag = null;
    data.dek_wrapped = null;
    data.dek_wrap_iv = null;
    data.dek_wrap_tag = null;
    data.key_version = null;
    data.aad_context = null;
    data.secret_justification = null;
  }
  return null;
}

/**
 * Encrypts a credential onto a row that already exists, so the AAD can bind the
 * ciphertext to that row's identity. Moving the ciphertext to another record
 * then fails authentication rather than decrypting.
 */
async function storeSecret(assignmentId, companyId, plaintext) {
  const enc = encryptSecret(plaintext, aadFor({ table: 'asset_assignments', id: assignmentId, field: 'password', companyId }));
  await pool.query(
    `UPDATE asset_assignments SET encrypted_password = ?, password_iv = ?, password_tag = ?,
            dek_wrapped = ?, dek_wrap_iv = ?, dek_wrap_tag = ?, key_version = ?, aad_context = ?
      WHERE id = ?`,
    [enc.ciphertext, enc.iv, enc.tag, enc.dek_wrapped, enc.dek_wrap_iv, enc.dek_wrap_tag, enc.key_version, enc.aad_context, assignmentId]);
}

/**
 * Reads a stored credential, migrating it to envelope encryption on the way out.
 *
 * A row written under the old single-key scheme still opens — it is decrypted
 * with the direct key and immediately re-stored under a per-record data key.
 * Migration happens one record at a time, on access, because a bulk pass would
 * mean decrypting every secret in the table at once, which is the exposure this
 * design exists to remove.
 */
async function readSecret(row, companyId) {
  const aad = aadFor({ table: 'asset_assignments', id: row.id, field: 'password', companyId });

  if (isLegacyRecord(row)) {
    const plain = decrypt(row.encrypted_password, row.password_iv, row.password_tag);
    if (plain == null) return { value: null, migrated: false };
    await storeSecret(row.id, companyId, plain);
    return { value: plain, migrated: true };
  }

  const value = decryptSecret({
    ciphertext: row.encrypted_password, iv: row.password_iv, tag: row.password_tag,
    dek_wrapped: row.dek_wrapped, dek_wrap_iv: row.dek_wrap_iv, dek_wrap_tag: row.dek_wrap_tag,
    key_version: row.key_version, aad_context: row.aad_context,
  }, row.aad_context || aad);

  // A record wrapped by a superseded master key is re-wrapped under the current
  // one, so rotation completes as records are touched instead of never.
  if (value != null && needsRewrap(row)) {
    await storeSecret(row.id, companyId, value);
    return { value, migrated: true };
  }
  return { value, migrated: false };
}


// Verifies an asset assignment is within the caller's company; returns row or null.
async function getScopedAsset(req, id, columns = '*') {
  const co = companyClause(req, 'company_id');
  const [[a]] = await pool.query(`SELECT ${columns} FROM asset_assignments WHERE id = ?` + co.clause, [id, ...co.params]);
  return a || null;
}

// GET /api/assets?employee_id=X&status=X (scoped to caller's company)
router.get('/', async (req, res) => {
  try {
    const co = companyClause(req, 'a.company_id');
    let sql = `SELECT a.*, e.first_name, e.last_name, c.name as company_name, c.short_code, c.color_primary,
               pc.name as platform_name FROM asset_assignments a
               JOIN employees e ON a.employee_id = e.id
               LEFT JOIN companies c ON a.company_id = c.id
               LEFT JOIN platform_catalog pc ON a.platform_id = pc.id WHERE 1=1` + co.clause;
    const params = [...co.params];
    if (req.query.employee_id) { sql += ' AND a.employee_id = ?'; params.push(req.query.employee_id); }
    if (req.query.status) { sql += ' AND a.status = ?'; params.push(req.query.status); }
    // Owning company per the assets PRD: RE / MKT / GRP (GRP = shared).
    if (OWNER_SCOPES.includes(req.query.owner_scope)) { sql += ' AND a.owner_scope = ?'; params.push(req.query.owner_scope); }
    sql += ' ORDER BY a.created_at DESC';
    const [rows] = await pool.query(sql, params);
    res.json(stripSecrets(rows));
  } catch (err) { console.error('GET /assets error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

// GET /api/assets/reports/allocation — the PRD's by-department / by-owner views
//
// "Analyze concentration and ownership": where the equipment and the paid seats
// actually sit. Counted across assignments, digital access and social access
// together, because a department holding three laptops and eleven admin seats is
// a different picture from one holding eleven laptops.
router.get('/reports/allocation', authorize('admin', 'hr_manager', 'accountant'), async (req, res) => {
  try {
    const co = companyClause(req, 'a.company_id');
    const coDa = companyClause(req, 'da.company_id');
    const coSc = companyClause(req, 'sc.company_id');
    const coInv = companyClause(req, 'i.company_id');

    const [byDepartment] = await pool.query(
      `SELECT COALESCE(d.name, 'Unassigned') AS department,
              COUNT(DISTINCT a.id)   AS physical_assets,
              COUNT(DISTINCT e.id)   AS employees
         FROM asset_assignments a
         JOIN employees e ON a.employee_id = e.id
         LEFT JOIN departments d ON e.department_id = d.id
        WHERE a.status = 'Active'${co.clause}
        GROUP BY department ORDER BY physical_assets DESC`, co.params);

    const [digitalByDepartment] = await pool.query(
      `SELECT COALESCE(d.name, 'Unassigned') AS department,
              COUNT(*) AS grants,
              SUM(da.access_rank >= 7)              AS privileged,
              SUM(da.seat_consumes_inventory = TRUE) AS paid_seats
         FROM digital_access da
         LEFT JOIN employees e ON da.employee_id = e.id
         LEFT JOIN departments d ON e.department_id = d.id
        WHERE da.status NOT IN ('Revoked','Archived')${coDa.clause}
        GROUP BY department ORDER BY grants DESC`, coDa.params);

    const [byOwnerScope] = await pool.query(
      `SELECT owner_scope,
              SUM(kind = 'assignment') AS assignments,
              SUM(kind = 'inventory')  AS inventory_units,
              SUM(kind = 'digital')    AS digital_grants
         FROM (
           SELECT a.owner_scope, 'assignment' AS kind FROM asset_assignments a
            WHERE a.status = 'Active'${co.clause}
           UNION ALL
           SELECT i.owner_scope, 'inventory' FROM asset_inventory i WHERE 1=1${coInv.clause}
           UNION ALL
           SELECT da.owner_scope, 'digital' FROM digital_access da
            WHERE da.status NOT IN ('Revoked','Archived')${coDa.clause}
         ) x GROUP BY owner_scope`,
      [...co.params, ...coInv.params, ...coDa.params]);

    // People holding elevated rights anywhere — the concentration that matters.
    // Grouped on the underlying expressions rather than the select aliases,
    // which only_full_group_by rejects.
    const [privilegedHolders] = await pool.query(
      `SELECT name, email, SUM(n) AS privileged_grants FROM (
          SELECT COALESCE(CONCAT_WS(' ', e.first_name, e.last_name), da.team_member_full_name) AS name,
                 da.team_member_email AS email, COUNT(*) AS n
            FROM digital_access da LEFT JOIN employees e ON da.employee_id = e.id
           WHERE da.access_rank >= 7 AND da.status NOT IN ('Revoked','Archived')${coDa.clause}
           GROUP BY COALESCE(CONCAT_WS(' ', e.first_name, e.last_name), da.team_member_full_name),
                    da.team_member_email
          UNION ALL
          SELECT sc.team_member_name, sc.team_member_email, COUNT(*)
            FROM social_access sc
           WHERE sc.access_rank >= 7 AND sc.status <> 'Removed'${coSc.clause}
           GROUP BY sc.team_member_name, sc.team_member_email
        ) u
        WHERE u.name IS NOT NULL
        GROUP BY u.name, u.email ORDER BY privileged_grants DESC LIMIT 25`,
      [...coDa.params, ...coSc.params]);

    res.json({ by_department: byDepartment, digital_by_department: digitalByDepartment, by_owner_scope: byOwnerScope, privileged_holders: privilegedHolders });
  } catch (err) {
    console.error('GET /assets/reports/allocation error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/assets — with inventory linking
router.post('/', authorize('admin', 'hr_manager', 'accountant'), async (req, res) => {
  try {
    const data = { ...req.body };
    data.company_id = resolveWriteCompanyId(req, data.company_id);
    if (!data.company_id) return res.status(400).json({ error: 'Company is required' });
    if (data.owner_scope && !OWNER_SCOPES.includes(data.owner_scope)) {
      return res.status(422).json({ error: `owner_scope must be one of: ${OWNER_SCOPES.join(', ')}` });
    }
    // Unless stated, the assignment inherits the platform's ownership — a seat
    // on a shared platform is a shared asset.
    if (!data.owner_scope && data.platform_id) {
      const [[plat]] = await pool.query('SELECT owner_scope FROM platform_catalog WHERE id = ?', [data.platform_id]);
      if (plat?.owner_scope) data.owner_scope = plat.owner_scope;
    }

    const policyError = applySecretPolicy(data);
    if (policyError) return res.status(422).json({ error: policyError });
    if (data.secret_tier === 'Stored') data.secret_approved_by = req.user.id;

    // Held aside: the row must exist before the ciphertext can be bound to its id.
    const plaintextSecret = data.account_password;
    delete data.account_password;

    const [result] = await pool.query('INSERT INTO asset_assignments SET ?', data);
    if (plaintextSecret) await storeSecret(result.insertId, data.company_id, plaintextSecret);
    
    // Decrement inventory if platform_id provided
    if (data.platform_id) {
      await pool.query('UPDATE platform_catalog SET inventory_total = GREATEST(0, inventory_total - 1) WHERE id = ?', [data.platform_id]);
    }
    
    // Mark inventory item as Assigned if linked
    if (data.inventory_id) {
      await pool.query("UPDATE asset_inventory SET status = 'Assigned' WHERE id = ?", [data.inventory_id]);
      // Record in assignment history
      await pool.query('INSERT INTO asset_assignment_history SET ?', {
        inventory_id: data.inventory_id,
        assignment_id: result.insertId,
        employee_id: data.employee_id,
        assigned_by: req.user.id,
        action: 'Assigned',
        action_date: new Date(),
        notes: data.notes || null,
      });
    }
    
    await addAudit(pool, req.user, 'Assets', 'Assigned', `Asset "${data.name}" assigned to employee #${data.employee_id}`);
    res.status(201).json({ id: result.insertId, ...data });
  } catch (err) { console.error('POST /assets error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

// PUT /api/assets/:id (company-scoped; cannot re-tenant)
router.put('/:id', authorize('admin', 'hr_manager', 'accountant'), async (req, res) => {
  try {
    const { company_id, ...data } = req.body;
    if (!(await getScopedAsset(req, req.params.id, 'id'))) {
      return res.status(404).json({ error: 'Asset not found' });
    }

    const policyError = applySecretPolicy(data);
    if (policyError) return res.status(422).json({ error: policyError });
    if (data.secret_tier === 'Stored') data.secret_approved_by = req.user.id;

    const plaintextSecret = data.account_password;
    delete data.account_password;

    if (Object.keys(data).length) await pool.query('UPDATE asset_assignments SET ? WHERE id = ?', [data, req.params.id]);
    if (plaintextSecret) {
      const [[owner]] = await pool.query('SELECT company_id FROM asset_assignments WHERE id = ?', [req.params.id]);
      await storeSecret(Number(req.params.id), owner?.company_id, plaintextSecret);
    }
    await addAudit(pool, req.user, 'Assets', 'Updated', `Asset #${req.params.id} updated`);
    res.json({ success: true });
  } catch (err) { console.error('PUT /assets/:id error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

// PUT /api/assets/:id/return (company-scoped)
//
// Business rule 1 of the assets PRD: a returned item must NOT become available
// again on the word of whoever accepted it — it goes to Returned Pending
// Inspection and only re-enters stock once someone verifies its condition
// (POST /inventory/:id/inspect). Physical goods are not the same asset after a
// year in a bag, and a damaged laptop counted as available is a promise the
// company cannot keep at the next onboarding.
//
// A digital seat has nothing to inspect, so it is reclaimed immediately.
router.put('/:id/return', authorize('admin', 'hr_manager', 'accountant'), async (req, res) => {
  try {
    const { condition_note } = req.body;
    const asset = await getScopedAsset(req, req.params.id, 'platform_id, inventory_id, employee_id, asset_type');
    if (!asset) return res.status(404).json({ error: 'Asset not found' });

    const needsInspection = !!asset.inventory_id;
    await pool.query('UPDATE asset_assignments SET status = ?, returned_date = ?, condition_note = ? WHERE id = ?',
      [needsInspection ? 'Returned Pending Inspection' : 'Returned', new Date(), condition_note || null, req.params.id]);

    // A seat returns to the pool at once; a physical unit does not, so its
    // platform's seat count is only restored after the inspection passes.
    if (asset.platform_id && !needsInspection) {
      await pool.query('UPDATE platform_catalog SET inventory_total = inventory_total + 1 WHERE id = ?', [asset.platform_id]);
    }

    if (needsInspection) {
      await pool.query("UPDATE asset_inventory SET status = 'Returned Pending Inspection', inspected_by = NULL, inspected_at = NULL, inspection_note = NULL WHERE id = ?",
        [asset.inventory_id]);
      await pool.query('INSERT INTO asset_assignment_history SET ?', {
        inventory_id: asset.inventory_id,
        assignment_id: parseInt(req.params.id),
        employee_id: asset.employee_id,
        assigned_by: req.user.id,
        action: 'Returned',
        action_date: new Date(),
        condition_at_action: condition_note || null,
        notes: 'Returned by employee — awaiting inspection',
      });
    }
    await addAudit(pool, req.user, 'Assets', 'Returned',
      `Asset #${req.params.id} returned${needsInspection ? ' — pending inspection before it re-enters stock' : ''}`);
    res.json({ success: true, pending_inspection: needsInspection });
  } catch (err) { console.error('PUT /assets/:id/return error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

// POST /api/assets/:id/upload-receipt (company-scoped)
router.post('/:id/upload-receipt', authorize('admin', 'hr_manager', 'hr_specialist'), upload.single('receipt'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    if (!(await getScopedAsset(req, req.params.id, 'id'))) {
      return res.status(404).json({ error: 'Asset not found' });
    }
    await pool.query(
      'UPDATE asset_assignments SET handover_receipt_file = ?, handover_receipt_uploaded_at = ? WHERE id = ?',
      [req.file.originalname, new Date(), req.params.id]
    );
    await addAudit(pool, req.user, 'Assets', 'Receipt Uploaded', `Signed handover receipt uploaded for asset #${req.params.id}`);
    res.json({ success: true, file_name: req.file.originalname });
  } catch (err) {
    console.error('Upload receipt error:', err);
    res.status(500).json({ error: 'Failed to upload receipt' });
  }
});

// GET /api/assets/by-employee/:employeeId (company-scoped)
router.get('/by-employee/:employeeId', async (req, res) => {
  try {
    const co = companyClause(req, 'a.company_id');
    const [rows] = await pool.query(
      `SELECT a.*, pc.name as platform_name FROM asset_assignments a
       LEFT JOIN platform_catalog pc ON a.platform_id = pc.id
       WHERE a.employee_id = ? AND a.status = 'Active'` + co.clause + ' ORDER BY a.created_at DESC',
      [req.params.employeeId, ...co.params]
    );
    res.json(stripSecrets(rows));
  } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
});

// POST /api/assets/:id/reveal-password
//
// Reading a stored credential is the most sensitive action in this module, and
// encryption does nothing against a legitimate account being misused — which is
// the likelier breach. So the reveal path carries its own controls
// (docs/secrets_protection_design.md §4):
//
//   • POST, not GET — a URL lands in access logs, proxy logs and browser history
//   • admin only — reading a platform password is not an HR function
//   • a written reason is mandatory and goes into the audit trail
//   • the audit row is written BEFORE decryption and a failure to write it
//     aborts the reveal, so an unloggable read cannot happen
//   • rate-limited per user: a credential dump needs hundreds of requests, a
//     real admin needs two or three
//   • no-store, so the plaintext is never cached by a browser or proxy
const revealLimiter = rateLimit({
  windowMs: 60 * 60_000,
  max: 5,
  keyGenerator: (req) => `user:${req.user?.id || 'anon'}`,
  message: 'Too many password reveals in the last hour. This limit exists to make bulk credential access impossible; contact an administrator if you genuinely need more.',
});

router.post('/:id/reveal-password', authorize('admin'), denyImpersonated, revealLimiter, async (req, res) => {
  try {
    const reason = String(req.body?.reason || '').trim();
    if (reason.length < 10) {
      return res.status(422).json({ error: 'A reason of at least 10 characters is required and will be recorded in the audit log' });
    }

    // Step-up authentication (docs/secrets_protection_design.md §4). A valid
    // session is not enough for this action: a stolen session is the likeliest
    // way an attacker reaches a credential, and re-entering the password is what
    // breaks that path.
    const confirmPassword = String(req.body?.password || '');
    if (!confirmPassword) {
      return res.status(422).json({ error: 'Confirm your own password to reveal a stored credential', step_up_required: true });
    }
    const [[actor]] = await pool.query('SELECT password_hash FROM users WHERE id = ? AND is_active = TRUE', [req.user.id]);
    if (!actor || !(await bcrypt.compare(confirmPassword, actor.password_hash))) {
      await addAudit(pool, req.user, 'Assets', 'Reveal Denied',
        `Failed step-up authentication on a reveal attempt for asset #${req.params.id}`).catch(() => {});
      return res.status(401).json({ error: 'That password is not correct' });
    }

    const co = companyClause(req, 'company_id');
    const [[asset]] = await pool.query(
      `SELECT id, company_id, encrypted_password, password_iv, password_tag,
              dek_wrapped, dek_wrap_iv, dek_wrap_tag, key_version, aad_context,
              name, account_username, secret_tier, vault_secret_reference
         FROM asset_assignments WHERE id = ?` + co.clause,
      [req.params.id, ...co.params]
    );
    if (!asset) return res.status(404).json({ error: 'Asset not found' });
    if (!asset.encrypted_password) {
      return res.status(400).json({
        error: asset.vault_secret_reference
          ? `No password is stored here by design — retrieve it from the vault: ${asset.vault_secret_reference}`
          : 'No password stored',
      });
    }

    // Fail closed: if the reveal cannot be recorded, it does not happen.
    try {
      await addAudit(pool, req.user, 'Assets', 'Password Revealed',
        `${req.user.name} revealed the password for "${asset.name}" (${asset.account_username || 'no username'}) — reason: ${reason}`);
    } catch (auditErr) {
      console.error('Reveal aborted — audit write failed:', auditErr.message);
      return res.status(503).json({ error: 'Cannot record this access right now, so the password was not revealed. Try again shortly.' });
    }

    const { value: password, migrated } = await readSecret(asset, asset.company_id);
    if (password == null) return res.status(500).json({ error: 'Stored credential could not be decrypted' });

    // Out-of-band alert to the OTHER administrators. An attacker holding this
    // session cannot suppress a notification that has already left the account
    // they control, which is the point of telling somebody else.
    notifyRole(pool, asset.company_id, ['admin'], {
      type: 'warning',
      title: `Credential revealed: ${asset.name}`,
      body: `${req.user.name} revealed the stored password for "${asset.name}"`
        + `${asset.account_username ? ` (${asset.account_username})` : ''} — reason: ${reason}`,
      link: '/assets',
    }, req.user.id).catch((e) => console.error('Reveal notification failed:', e.message));

    res.setHeader('Cache-Control', 'no-store, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.json({ password, username: asset.account_username, ...(migrated ? { rewrapped: true } : {}) });
  } catch (err) {
    console.error('Reveal password error:', err);
    res.status(500).json({ error: 'Failed to reveal password' });
  }
});

// DELETE /api/assets/:id (company-scoped)
router.delete('/:id', authorize('admin'), async (req, res) => {
  try {
    const co = companyClause(req, 'company_id');
    const [result] = await pool.query('DELETE FROM asset_assignments WHERE id = ?' + co.clause, [req.params.id, ...co.params]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Asset not found' });
    res.json({ success: true });
  } catch (err) { console.error('DELETE /assets/:id error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

export default router;
