import { Router } from 'express';
import pool from '../config/db.js';
import { auth } from '../middleware/auth.js';
import { decrypt } from '../services/cryptoService.js';
import { addAudit } from '../services/auditService.js';

const router = Router();

/**
 * Get employee_id from the authenticated user.
 * For admin/hr_manager without employee_id, returns null (they can still view the portal).
 */
async function getEmployeeId(userId) {
  const [[user]] = await pool.query('SELECT employee_id FROM users WHERE id = ?', [userId]);
  return user?.employee_id || null;
}

// GET /api/portal/my-assets — Employee's own assets (hardware + software)
router.get('/my-assets', auth, async (req, res) => {
  try {
    const employeeId = await getEmployeeId(req.user.id);
    
    // If no employee_id linked, return empty array (don't block access)
    if (!employeeId) {
      return res.json([]);
    }

    const [rows] = await pool.query(`
      SELECT a.id, a.name, a.asset_type, a.identifier, a.workspace, a.access_level,
             a.issued_date, a.status, a.account_username, a.account_url,
             pc.name as platform_name, c.name as company_name, c.short_code,
             CASE WHEN a.encrypted_password IS NOT NULL THEN TRUE ELSE FALSE END as has_password
      FROM asset_assignments a
      LEFT JOIN platform_catalog pc ON a.platform_id = pc.id
      LEFT JOIN companies c ON a.company_id = c.id
      WHERE a.employee_id = ? AND a.status = 'Active'
      ORDER BY a.asset_type, a.name
    `, [employeeId]);

    res.json(rows);
  } catch (err) {
    console.error('GET /portal/my-assets error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/portal/my-assets/:id/reveal — Reveal a specific credential password
router.get('/my-assets/:id/reveal', auth, async (req, res) => {
  try {
    const employeeId = await getEmployeeId(req.user.id);
    if (!employeeId) return res.status(403).json({ error: 'No employee profile linked' });

    // Ensure the asset belongs to this employee
    const [[asset]] = await pool.query(
      'SELECT encrypted_password, password_iv, password_tag, name FROM asset_assignments WHERE id = ? AND employee_id = ?',
      [req.params.id, employeeId]
    );

    if (!asset) return res.status(404).json({ error: 'Asset not found or access denied' });
    if (!asset.encrypted_password) return res.status(400).json({ error: 'No password stored for this asset' });

    const password = decrypt(asset.encrypted_password, asset.password_iv, asset.password_tag);

    // Audit log the reveal action
    await addAudit(pool, req.user, 'Portal', 'Password Revealed',
      `Employee viewed password for "${asset.name}"`);

    res.json({ password });
  } catch (err) {
    console.error('Reveal password error:', err);
    res.status(500).json({ error: 'Failed to reveal password' });
  }
});

// GET /api/portal/my-inventory — Employee's assigned inventory items
router.get('/my-inventory', auth, async (req, res) => {
  try {
    const employeeId = await getEmployeeId(req.user.id);
    
    // If no employee_id linked, return empty array
    if (!employeeId) {
      return res.json([]);
    }

    const [rows] = await pool.query(`
      SELECT a.id, a.name, a.identifier, a.issued_date, a.status,
             inv.asset_code, inv.serial_number, inv.brand, inv.model, inv.barcode_data,
             pc.name as platform_name
      FROM asset_assignments a
      LEFT JOIN asset_inventory inv ON a.inventory_id = inv.id
      LEFT JOIN platform_catalog pc ON a.platform_id = pc.id
      WHERE a.employee_id = ? AND a.status = 'Active' AND a.asset_type = 'Hardware'
      ORDER BY a.issued_date DESC
    `, [employeeId]);

    res.json(rows);
  } catch (err) {
    console.error('GET /portal/my-inventory error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
