import { Router } from 'express';
import pool from '../config/db.js';
import { auth } from '../middleware/auth.js';
import { authorize } from '../middleware/rbac.js';
import { addAudit } from '../services/auditService.js';
import { generateAssetCode, getCategoryPrefix, generateQRCodeDataURL, generateLabelHTML, generateBulkLabelsHTML } from '../services/barcodeService.js';
import { tenantScope, companyClause, resolveWriteCompanyId } from '../middleware/tenant.js';
import multer from 'multer';
import path from 'path';
import { ensureUploadDir } from '../config/storage.js';

const upload = multer({
  dest: ensureUploadDir('asset_images'),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, allowed.includes(ext));
  },
});

const router = Router();
router.use(auth, tenantScope);

// Verifies an inventory item is within the caller's company; returns row or null.
async function getScopedInventory(req, id, columns = '*') {
  const co = companyClause(req, 'company_id');
  const [[item]] = await pool.query(`SELECT ${columns} FROM asset_inventory WHERE id = ?` + co.clause, [id, ...co.params]);
  return item || null;
}

// GET /api/inventory?platform_id=X&status=X&search=X&page=1&limit=25 (scoped)
router.get('/', async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const offset = (page - 1) * limit;

    const co = companyClause(req, 'i.company_id');
    const coCount = companyClause(req, 'company_id');
    let sql = `SELECT i.*, pc.name as platform_name, ac.name as category_name, ac.icon as category_icon,
               c.name as company_name, c.short_code, c.color_primary
               FROM asset_inventory i
               LEFT JOIN platform_catalog pc ON i.platform_id = pc.id
               LEFT JOIN asset_categories ac ON pc.category_id = ac.id
               LEFT JOIN companies c ON i.company_id = c.id
               WHERE 1=1` + co.clause;
    let countSql = 'SELECT COUNT(*) as total FROM asset_inventory WHERE 1=1' + coCount.clause;
    const params = [...co.params];
    const countParams = [...coCount.params];

    if (req.query.platform_id) {
      sql += ' AND i.platform_id = ?'; params.push(req.query.platform_id);
      countSql += ' AND platform_id = ?'; countParams.push(req.query.platform_id);
    }
    if (req.query.status) {
      sql += ' AND i.status = ?'; params.push(req.query.status);
      countSql += ' AND status = ?'; countParams.push(req.query.status);
    }
    if (req.query.search) {
      const s = `%${req.query.search}%`;
      sql += ' AND (i.asset_code LIKE ? OR i.serial_number LIKE ? OR i.brand LIKE ? OR i.model LIKE ?)';
      params.push(s, s, s, s);
      countSql += ' AND (asset_code LIKE ? OR serial_number LIKE ? OR brand LIKE ? OR model LIKE ?)';
      countParams.push(s, s, s, s);
    }

    sql += ' ORDER BY i.created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const [rows] = await pool.query(sql, params);
    const [[countResult]] = await pool.query(countSql, countParams);

    res.json({
      data: rows,
      total: countResult.total,
      page,
      limit,
      totalPages: Math.ceil(countResult.total / limit),
    });
  } catch (err) {
    console.error('GET /inventory error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/inventory/:id (scoped)
router.get('/:id', async (req, res) => {
  try {
    const co = companyClause(req, 'i.company_id');
    const [[item]] = await pool.query(`
      SELECT i.*, pc.name as platform_name, ac.name as category_name, ac.icon as category_icon,
             c.name as company_name, c.short_code, c.color_primary
      FROM asset_inventory i
      LEFT JOIN platform_catalog pc ON i.platform_id = pc.id
      LEFT JOIN asset_categories ac ON pc.category_id = ac.id
      LEFT JOIN companies c ON i.company_id = c.id
      WHERE i.id = ?` + co.clause, [req.params.id, ...co.params]);
    if (!item) return res.status(404).json({ error: 'Item not found' });
    res.json(item);
  } catch (err) {
    console.error('GET /inventory/:id error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/inventory — Create inventory item + auto-generate asset code & barcode
router.post('/', authorize('admin', 'hr_manager'), async (req, res) => {
  try {
    const data = { ...req.body };
    data.company_id = resolveWriteCompanyId(req, data.company_id);
    if (!data.company_id) return res.status(400).json({ error: 'Company is required' });

    // Auto-generate asset code if not provided
    if (!data.asset_code) {
      // Get company short code
      let shortCode = 'AST';
      if (data.company_id) {
        const [[comp]] = await pool.query('SELECT short_code FROM companies WHERE id = ?', [data.company_id]);
        if (comp?.short_code) shortCode = comp.short_code;
      }

      // Get category prefix from platform name
      let prefix = 'ITM';
      if (data.platform_id) {
        const [[plat]] = await pool.query('SELECT name FROM platform_catalog WHERE id = ?', [data.platform_id]);
        if (plat?.name) prefix = getCategoryPrefix(plat.name);
      }

      // Get next sequence number
      const [[{ cnt }]] = await pool.query(
        'SELECT COUNT(*) as cnt FROM asset_inventory WHERE company_id = ?',
        [data.company_id || 0]
      );

      data.asset_code = generateAssetCode(shortCode, prefix, cnt + 1);
    }

    // Generate barcode data (same as asset code)
    data.barcode_data = data.asset_code;

    // Calculate current value based on purchase cost and depreciation
    if (data.purchase_cost && data.purchase_date && data.depreciation_rate) {
      const ageYears = (Date.now() - new Date(data.purchase_date).getTime()) / (365.25 * 24 * 60 * 60 * 1000);
      data.current_value = Math.max(0, data.purchase_cost * (1 - (data.depreciation_rate / 100) * ageYears));
    }

    const [result] = await pool.query('INSERT INTO asset_inventory SET ?', data);
    await addAudit(pool, req.user, 'Inventory', 'Created', `Asset "${data.asset_code}" added to inventory`);
    res.status(201).json({ id: result.insertId, ...data });
  } catch (err) {
    console.error('POST /inventory error:', err);
    res.status(500).json({ error: err.code === 'ER_DUP_ENTRY' ? 'Asset code already exists' : 'Internal server error' });
  }
});

// PUT /api/inventory/:id (scoped; cannot re-tenant)
router.put('/:id', authorize('admin', 'hr_manager'), async (req, res) => {
  try {
    if (!(await getScopedInventory(req, req.params.id, 'id'))) {
      return res.status(404).json({ error: 'Item not found' });
    }
    const { company_id, ...data } = req.body;
    // Recalculate current value
    if (data.purchase_cost && data.purchase_date && data.depreciation_rate) {
      const ageYears = (Date.now() - new Date(data.purchase_date).getTime()) / (365.25 * 24 * 60 * 60 * 1000);
      data.current_value = Math.max(0, data.purchase_cost * (1 - (data.depreciation_rate / 100) * ageYears));
    }
    data.barcode_data = data.asset_code || data.barcode_data;
    await pool.query('UPDATE asset_inventory SET ? WHERE id = ?', [data, req.params.id]);
    await addAudit(pool, req.user, 'Inventory', 'Updated', `Inventory item #${req.params.id} updated`);
    res.json({ success: true });
  } catch (err) {
    console.error('PUT /inventory/:id error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/inventory/:id (scoped)
router.delete('/:id', authorize('admin'), async (req, res) => {
  try {
    const co = companyClause(req, 'company_id');
    const [result] = await pool.query('DELETE FROM asset_inventory WHERE id = ?' + co.clause, [req.params.id, ...co.params]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Item not found' });
    await addAudit(pool, req.user, 'Inventory', 'Deleted', `Inventory item #${req.params.id} deleted`);
    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /inventory/:id error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/inventory/:id/history — Assignment history (scoped)
router.get('/:id/history', async (req, res) => {
  try {
    if (!(await getScopedInventory(req, req.params.id, 'id'))) {
      return res.status(404).json({ error: 'Item not found' });
    }
    const [rows] = await pool.query(`
      SELECT h.*, e.first_name, e.last_name, u.name as assigned_by_name
      FROM asset_assignment_history h
      LEFT JOIN employees e ON h.employee_id = e.id
      LEFT JOIN users u ON h.assigned_by = u.id
      WHERE h.inventory_id = ?
      ORDER BY h.action_date DESC
    `, [req.params.id]);
    res.json(rows);
  } catch (err) {
    console.error('GET /inventory/:id/history error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/inventory/:id/barcode — Return barcode data for client-side rendering (scoped)
router.get('/:id/barcode', async (req, res) => {
  try {
    const item = await getScopedInventory(req, req.params.id, 'asset_code, barcode_data');
    if (!item) return res.status(404).json({ error: 'Not found' });
    res.json({ barcode_data: item.barcode_data || item.asset_code, asset_code: item.asset_code });
  } catch (err) {
    console.error('Barcode error:', err);
    res.status(500).json({ error: 'Barcode generation failed' });
  }
});

// GET /api/inventory/:id/qrcode — Generate QR code (scoped)
router.get('/:id/qrcode', async (req, res) => {
  try {
    const item = await getScopedInventory(req, req.params.id);
    if (!item) return res.status(404).json({ error: 'Not found' });
    const qrData = JSON.stringify({
      code: item.asset_code,
      sn: item.serial_number,
      brand: item.brand,
      model: item.model
    });
    const dataURL = await generateQRCodeDataURL(qrData);
    res.json({ qrcode: dataURL, asset_code: item.asset_code });
  } catch (err) {
    console.error('QR error:', err);
    res.status(500).json({ error: 'QR generation failed' });
  }
});

// GET /api/inventory/:id/label — Generate a single printable label (scoped)
router.get('/:id/label', async (req, res) => {
  try {
    const co = companyClause(req, 'i.company_id');
    const [[item]] = await pool.query(`
      SELECT i.*, c.name as company_name, c.short_code
      FROM asset_inventory i LEFT JOIN companies c ON i.company_id = c.id
      WHERE i.id = ?` + co.clause, [req.params.id, ...co.params]);
    if (!item) return res.status(404).json({ error: 'Not found' });

    const qrData = JSON.stringify({ code: item.asset_code, sn: item.serial_number });
    const qrDataURL = await generateQRCodeDataURL(qrData);
    const labelHTML = generateLabelHTML(item, item.company_name, qrDataURL);

    res.json({ html: labelHTML, asset_code: item.asset_code });
  } catch (err) {
    console.error('Label error:', err);
    res.status(500).json({ error: 'Label generation failed' });
  }
});

// POST /api/inventory/bulk-labels — Generate A4 sheet with multiple labels (scoped)
router.post('/bulk-labels', async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids?.length) return res.status(400).json({ error: 'No items selected' });

    const co = companyClause(req, 'i.company_id');
    const [items] = await pool.query(`
      SELECT i.*, c.name as company_name, c.short_code
      FROM asset_inventory i LEFT JOIN companies c ON i.company_id = c.id
      WHERE i.id IN (?)` + co.clause, [ids, ...co.params]);

    const labels = [];
    for (const item of items) {
      const qrData = JSON.stringify({ code: item.asset_code, sn: item.serial_number });
      const qrDataURL = await generateQRCodeDataURL(qrData);
      labels.push({
        html: generateLabelHTML(item, item.company_name, qrDataURL),
        asset_code: item.asset_code
      });
    }

    const pageHTML = generateBulkLabelsHTML(labels);
    res.json({ html: pageHTML, count: labels.length });
  } catch (err) {
    console.error('Bulk labels error:', err);
    res.status(500).json({ error: 'Bulk label generation failed' });
  }
});

// POST /api/inventory/:id/upload-image (scoped)
router.post('/:id/upload-image', authorize('admin', 'hr_manager'), upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    if (!(await getScopedInventory(req, req.params.id, 'id'))) {
      return res.status(404).json({ error: 'Item not found' });
    }
    const imagePath = `/uploads/asset_images/${req.file.filename}`;
    await pool.query('UPDATE asset_inventory SET image_url = ? WHERE id = ?', [imagePath, req.params.id]);
    res.json({ success: true, image_url: imagePath });
  } catch (err) {
    console.error('Image upload error:', err);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// GET /api/inventory/stats/summary — Dashboard stats (scoped)
router.get('/stats/summary', async (req, res) => {
  try {
    const co = companyClause(req, 'company_id');
    const where = '1=1' + co.clause;
    const params = [...co.params];

    const [[stats]] = await pool.query(`
      SELECT 
        COUNT(*) as total,
        SUM(status = 'Available') as available,
        SUM(status = 'Assigned') as assigned,
        SUM(status = 'In Repair') as in_repair,
        SUM(status = 'Retired') as retired,
        SUM(status = 'Lost') as lost,
        SUM(COALESCE(current_value, 0)) as total_value,
        SUM(COALESCE(purchase_cost, 0)) as total_cost
      FROM asset_inventory WHERE ${where}
    `, params);

    res.json(stats);
  } catch (err) {
    console.error('Inventory stats error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
