import { Router } from 'express';
import pool from '../config/db.js';
import { auth } from '../middleware/auth.js';
import { authorize } from '../middleware/rbac.js';
import { addAudit } from '../services/auditService.js';
import { encrypt, decrypt } from '../services/cryptoService.js';
import { tenantScope, companyClause, resolveWriteCompanyId } from '../middleware/tenant.js';
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

    // Encrypt password if provided for Account type
    if (data.account_password) {
      const { encrypted, iv, tag } = encrypt(data.account_password);
      data.encrypted_password = encrypted;
      data.password_iv = iv;
      data.password_tag = tag;
      delete data.account_password;
    }

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

    if (data.account_password) {
      const { encrypted, iv, tag } = encrypt(data.account_password);
      data.encrypted_password = encrypted;
      data.password_iv = iv;
      data.password_tag = tag;
      delete data.account_password;
    }

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

// GET /api/assets/:id/reveal-password — Reveal encrypted credential (company-scoped + audited)
router.get('/:id/reveal-password', authorize('admin', 'hr_manager'), async (req, res) => {
  try {
    const co = companyClause(req, 'company_id');
    const [[asset]] = await pool.query(
      'SELECT encrypted_password, password_iv, password_tag, name, account_username FROM asset_assignments WHERE id = ?' + co.clause,
      [req.params.id, ...co.params]
    );
    if (!asset) return res.status(404).json({ error: 'Asset not found' });
    if (!asset.encrypted_password) return res.status(400).json({ error: 'No password stored' });

    const password = decrypt(asset.encrypted_password, asset.password_iv, asset.password_tag);
    await addAudit(pool, req.user, 'Assets', 'Password Revealed', `${req.user.name} revealed password for "${asset.name}" (${asset.account_username})`);

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
