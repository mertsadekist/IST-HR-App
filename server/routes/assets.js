import { Router } from 'express';
import pool from '../config/db.js';
import { auth } from '../middleware/auth.js';
import { authorize } from '../middleware/rbac.js';
import { addAudit } from '../services/auditService.js';
import { encrypt, decrypt } from '../services/cryptoService.js';
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
router.use(auth, tenantScope);

// The stored credential must never reach the browser: revealing one goes through
// GET /:id/reveal-password, which is role-gated and audited. The list endpoints
// expose only whether a password exists.
const stripSecrets = (rows) => rows.map(({ encrypted_password, password_iv, password_tag, ...r }) => ({
  ...r, has_password: !!encrypted_password,
}));

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
    const { encrypted, iv, tag } = encrypt(data.account_password);
    data.encrypted_password = encrypted;
    data.password_iv = iv;
    data.password_tag = tag;
  }
  delete data.account_password;

  // Moving off the Stored tier must actually drop the ciphertext, or the promise
  // that nothing is stored would be untrue.
  if (tier && tier !== 'Stored') {
    data.encrypted_password = null;
    data.password_iv = null;
    data.password_tag = null;
    data.secret_justification = null;
  }
  return null;
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

// POST /api/assets — with inventory linking
router.post('/', authorize('admin', 'hr_manager'), async (req, res) => {
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

    const [result] = await pool.query('INSERT INTO asset_assignments SET ?', data);
    
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
router.put('/:id', authorize('admin', 'hr_manager'), async (req, res) => {
  try {
    const { company_id, ...data } = req.body;
    if (!(await getScopedAsset(req, req.params.id, 'id'))) {
      return res.status(404).json({ error: 'Asset not found' });
    }

    const policyError = applySecretPolicy(data);
    if (policyError) return res.status(422).json({ error: policyError });
    if (data.secret_tier === 'Stored') data.secret_approved_by = req.user.id;

    await pool.query('UPDATE asset_assignments SET ? WHERE id = ?', [data, req.params.id]);
    await addAudit(pool, req.user, 'Assets', 'Updated', `Asset #${req.params.id} updated`);
    res.json({ success: true });
  } catch (err) { console.error('PUT /assets/:id error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

// PUT /api/assets/:id/return (company-scoped)
router.put('/:id/return', authorize('admin', 'hr_manager'), async (req, res) => {
  try {
    const { condition_note } = req.body;
    const asset = await getScopedAsset(req, req.params.id, 'platform_id, inventory_id, employee_id');
    if (!asset) return res.status(404).json({ error: 'Asset not found' });
    await pool.query('UPDATE asset_assignments SET status = ?, returned_date = ?, condition_note = ? WHERE id = ?',
      ['Returned', new Date(), condition_note || null, req.params.id]);
    if (asset?.platform_id) {
      await pool.query('UPDATE platform_catalog SET inventory_total = inventory_total + 1 WHERE id = ?', [asset.platform_id]);
    }
    // Release inventory item back to Available
    if (asset?.inventory_id) {
      await pool.query("UPDATE asset_inventory SET status = 'Available' WHERE id = ?", [asset.inventory_id]);
      await pool.query('INSERT INTO asset_assignment_history SET ?', {
        inventory_id: asset.inventory_id,
        assignment_id: parseInt(req.params.id),
        employee_id: asset.employee_id,
        assigned_by: req.user.id,
        action: 'Returned',
        action_date: new Date(),
        condition_at_action: condition_note || null,
        notes: 'Asset returned by employee',
      });
    }
    await addAudit(pool, req.user, 'Assets', 'Returned', `Asset #${req.params.id} returned`);
    res.json({ success: true });
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

router.post('/:id/reveal-password', authorize('admin'), revealLimiter, async (req, res) => {
  try {
    const reason = String(req.body?.reason || '').trim();
    if (reason.length < 10) {
      return res.status(422).json({ error: 'A reason of at least 10 characters is required and will be recorded in the audit log' });
    }

    const co = companyClause(req, 'company_id');
    const [[asset]] = await pool.query(
      'SELECT encrypted_password, password_iv, password_tag, name, account_username, secret_tier, vault_secret_reference FROM asset_assignments WHERE id = ?' + co.clause,
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

    const password = decrypt(asset.encrypted_password, asset.password_iv, asset.password_tag);
    if (password == null) return res.status(500).json({ error: 'Stored credential could not be decrypted' });

    res.setHeader('Cache-Control', 'no-store, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.json({ password, username: asset.account_username });
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
