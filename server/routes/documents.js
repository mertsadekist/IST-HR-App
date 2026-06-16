import { Router } from 'express';
import pool from '../config/db.js';
import { auth } from '../middleware/auth.js';
import { authorize } from '../middleware/rbac.js';
import { addAudit } from '../services/auditService.js';
import { upload } from '../middleware/upload.js';
import { tenantScope, companyClause, resolveWriteCompanyId } from '../middleware/tenant.js';

const router = Router();
router.use(auth, tenantScope);

// GET /api/documents/categories
router.get('/categories', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM doc_categories ORDER BY sort_order, name');
    res.json(rows);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
});

// POST /api/documents/categories
router.post('/categories', authorize('admin', 'hr_manager'), async (req, res) => {
  try {
    const { name, icon, color } = req.body;
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const [result] = await pool.query('INSERT INTO doc_categories SET ?', { name, slug, icon: icon || '📁', color: color || '#374151' });
    res.status(201).json({ id: result.insertId, name, slug });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
});

// DELETE /api/documents/categories/:id
router.delete('/categories/:id', authorize('admin'), async (req, res) => {
  try {
    await pool.query('DELETE FROM doc_categories WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
});

// GET /api/documents?category=X (scoped to caller's company)
router.get('/', async (req, res) => {
  try {
    const co = companyClause(req, 'cd.company_id');
    let sql = `SELECT cd.*, c.name as company_name, c.short_code, c.color_primary,
               u.name as uploaded_by_name
               FROM company_documents cd
               LEFT JOIN companies c ON cd.company_id = c.id
               LEFT JOIN users u ON cd.uploaded_by = u.id WHERE 1=1` + co.clause;
    const params = [...co.params];
    if (req.query.category) { sql += ' AND cd.category = ?'; params.push(req.query.category); }
    if (req.query.search) { const s = `%${req.query.search}%`; sql += ' AND cd.file_name LIKE ?'; params.push(s); }
    sql += ' ORDER BY cd.uploaded_at DESC';
    const [rows] = await pool.query(sql, params);
    // Don't send file_data in list, it's too large
    const sanitized = rows.map(({ file_data, ...rest }) => rest);
    res.json(sanitized);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
});

// POST /api/documents — Upload document (forced into caller's company)
router.post('/', authorize('admin', 'hr_manager'), upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const { category } = req.body;
    const company_id = resolveWriteCompanyId(req, req.body.company_id);
    if (!company_id) return res.status(400).json({ error: 'Company is required' });
    const [result] = await pool.query('INSERT INTO company_documents SET ?', {
      company_id, category: category || 'General',
      file_name: req.file.originalname, file_type: req.file.mimetype,
      file_size: req.file.size, file_data: req.file.buffer, uploaded_by: req.user.id,
    });
    await addAudit(pool, req.user, 'Documents', 'Uploaded', `Document "${req.file.originalname}" uploaded`);
    res.status(201).json({ id: result.insertId, file_name: req.file.originalname, file_size: req.file.size });
  } catch (err) { console.error('POST /documents error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

// GET /api/documents/:id/download (company-scoped, forced as attachment)
router.get('/:id/download', async (req, res) => {
  try {
    const co = companyClause(req, 'company_id');
    const [[doc]] = await pool.query('SELECT file_data, file_name, file_type FROM company_documents WHERE id = ?' + co.clause, [req.params.id, ...co.params]);
    if (!doc) return res.status(404).json({ error: 'Document not found' });
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(doc.file_name)}"`);
    res.send(doc.file_data);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
});

// DELETE /api/documents/:id (company-scoped)
router.delete('/:id', authorize('admin'), async (req, res) => {
  try {
    const co = companyClause(req, 'company_id');
    const [[doc]] = await pool.query('SELECT file_name FROM company_documents WHERE id = ?' + co.clause, [req.params.id, ...co.params]);
    if (!doc) return res.status(404).json({ error: 'Document not found' });
    await pool.query('DELETE FROM company_documents WHERE id = ?' + co.clause, [req.params.id, ...co.params]);
    await addAudit(pool, req.user, 'Documents', 'Deleted', `Document "${doc?.file_name}" deleted`);
    res.json({ success: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
});

export default router;
