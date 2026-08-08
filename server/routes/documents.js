import { Router } from 'express';
import pool from '../config/db.js';
import { auth } from '../middleware/auth.js';
import { requireModule, MODULES } from '../config/permissions.js';
import { authorize } from '../middleware/rbac.js';
import { addAudit } from '../services/auditService.js';
import { upload } from '../middleware/upload.js';
import { tenantScope, companyClause, resolveWriteCompanyId } from '../middleware/tenant.js';
import { checkDocumentExpiry, DOC_EXPIRY_THRESHOLDS } from '../services/documentExpiryService.js';

const router = Router();
// Module-gated so reads are refused too, not just writes.
// See config/permissions.js and docs/roles_and_permissions.md.
router.use(auth, tenantScope, requireModule(MODULES.COMPLIANCE));

// GET /api/documents/categories

// Expiry is a MODE, not just a date. Not every document has an end date — a
// memorandum of association does not — and forcing one would mean either a
// wrong date or a field that is permanently "missing". Saying "No Expiry" is a
// positive statement that stops the document being asked about again.
const EXPIRY_MODES = ['Not Set', 'No Expiry', 'Has Expiry'];

/**
 * Reads and validates the expiry fields off a request body.
 * @returns {{data: object, error?: string}}
 */
function readExpiryFields(body) {
  const mode = body.expiry_mode || 'Not Set';
  if (!EXPIRY_MODES.includes(mode)) {
    return { data: {}, error: `expiry_mode must be one of: ${EXPIRY_MODES.join(', ')}` };
  }

  const isDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || '').slice(0, 10));
  const issue = (body.issue_date || '').trim() || null;
  if (issue && !isDate(issue)) return { data: {}, error: 'issue_date must be a date (YYYY-MM-DD)' };

  if (mode !== 'Has Expiry') {
    // Leaving a stale date behind would keep the record in the expiry reports
    // after someone has said it does not expire.
    return { data: { expiry_mode: mode, expiry_date: null, reminder_days: null, expiry_alert_sent: null, issue_date: issue } };
  }

  const expiry = (body.expiry_date || '').trim();
  if (!isDate(expiry)) return { data: {}, error: 'An expiry date is required when the document has an expiry' };
  if (issue && expiry < issue) return { data: {}, error: 'The expiry date cannot be before the issue date' };

  let reminder = null;
  if (body.reminder_days != null && String(body.reminder_days).trim() !== '') {
    reminder = parseInt(body.reminder_days, 10);
    if (!Number.isFinite(reminder) || reminder < 1 || reminder > 365) {
      return { data: {}, error: 'reminder_days must be between 1 and 365' };
    }
  }
  return { data: { expiry_mode: mode, expiry_date: expiry, issue_date: issue, reminder_days: reminder } };
}

router.get('/categories', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM doc_categories ORDER BY sort_order, name');
    res.json(rows);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
});

// POST /api/documents/categories
router.post('/categories', authorize('admin', 'hr_manager', 'accountant'), async (req, res) => {
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
    // Dates are formatted in SQL: a MySQL DATE read as a JS Date at local
    // midnight loses a day when serialised.
    let sql = `SELECT cd.*, c.name as company_name, c.short_code, c.color_primary,
               u.name as uploaded_by_name,
               DATE_FORMAT(cd.expiry_date, '%Y-%m-%d') AS expiry_date,
               DATE_FORMAT(cd.issue_date, '%Y-%m-%d')  AS issue_date,
               DATEDIFF(cd.expiry_date, CURDATE())     AS days_to_expiry
               FROM company_documents cd
               LEFT JOIN companies c ON cd.company_id = c.id
               LEFT JOIN users u ON cd.uploaded_by = u.id WHERE 1=1` + co.clause;
    const params = [...co.params];
    if (req.query.category) { sql += ' AND cd.category = ?'; params.push(req.query.category); }
    if (EXPIRY_MODES.includes(req.query.expiry_mode)) { sql += ' AND cd.expiry_mode = ?'; params.push(req.query.expiry_mode); }
    // The two views that matter operationally: what has lapsed, and what is about to.
    if (req.query.expiring === '1') {
      const within = Math.max(1, Math.min(365, parseInt(req.query.within_days) || 90));
      sql += " AND cd.expiry_mode = 'Has Expiry' AND cd.expiry_date IS NOT NULL AND DATEDIFF(cd.expiry_date, CURDATE()) <= ?";
      params.push(within);
    }
    if (req.query.expired === '1') {
      sql += " AND cd.expiry_mode = 'Has Expiry' AND cd.expiry_date < CURDATE()";
    }
    if (req.query.search) {
      const s = `%${req.query.search}%`;
      sql += ' AND (cd.file_name LIKE ? OR cd.document_name LIKE ?)';
      params.push(s, s);
    }
    // Anything with an expiry sorts first, soonest at the top — the list is read
    // to answer "what needs renewing", not "what was uploaded last".
    sql += ' ORDER BY cd.expiry_date IS NULL, cd.expiry_date, cd.uploaded_at DESC';
    const [rows] = await pool.query(sql, params);
    // Don't send file_data in list, it's too large
    const sanitized = rows.map(({ file_data, ...rest }) => rest);
    res.json(sanitized);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
});

// POST /api/documents — Upload document (forced into caller's company)
router.post('/', authorize('admin', 'hr_manager', 'accountant'), upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const { category } = req.body;
    const company_id = resolveWriteCompanyId(req, req.body.company_id);
    if (!company_id) return res.status(400).json({ error: 'Company is required' });

    const expiry = readExpiryFields(req.body);
    if (expiry.error) return res.status(422).json({ error: expiry.error });

    const [result] = await pool.query('INSERT INTO company_documents SET ?', {
      company_id, category: category || 'General',
      // The upload form posts this as `name`; accept both spellings so the
      // typed title is kept instead of being silently dropped for the filename.
      document_name: (req.body.document_name || req.body.name || '').trim() || null,
      description: (req.body.description || '').trim() || null,
      file_name: req.file.originalname, file_type: req.file.mimetype,
      file_size: req.file.size, file_data: req.file.buffer, uploaded_by: req.user.id,
      ...expiry.data,
    });
    await addAudit(pool, req.user, 'Documents', 'Uploaded',
      `Document "${req.file.originalname}" uploaded`
      + (expiry.data.expiry_mode === 'Has Expiry' ? ` — expires ${expiry.data.expiry_date}` : '')
      + (expiry.data.expiry_mode === 'No Expiry' ? ' — marked as never expiring' : ''));
    res.status(201).json({ id: result.insertId, file_name: req.file.originalname, file_size: req.file.size });
  } catch (err) { console.error('POST /documents error:', err); res.status(500).json({ error: 'Internal server error' }); }
});


// GET /api/documents/expiry-summary — the headline the page is read for
router.get('/expiry-summary', async (req, res) => {
  try {
    const co = companyClause(req, 'company_id');
    const [[counts]] = await pool.query(
      `SELECT
         COUNT(*) AS total,
         SUM(expiry_mode = 'Not Set')                                                        AS not_set,
         SUM(expiry_mode = 'No Expiry')                                                      AS no_expiry,
         SUM(expiry_mode = 'Has Expiry')                                                     AS tracked,
         SUM(expiry_mode = 'Has Expiry' AND expiry_date < CURDATE())                         AS expired,
         SUM(expiry_mode = 'Has Expiry' AND DATEDIFF(expiry_date, CURDATE()) BETWEEN 0 AND 30)  AS within_30,
         SUM(expiry_mode = 'Has Expiry' AND DATEDIFF(expiry_date, CURDATE()) BETWEEN 0 AND 90)  AS within_90
       FROM company_documents WHERE 1=1` + co.clause, co.params);

    const [soonest] = await pool.query(
      `SELECT id, category, COALESCE(document_name, file_name) AS label,
              DATE_FORMAT(expiry_date, '%Y-%m-%d') AS expiry_date,
              DATEDIFF(expiry_date, CURDATE()) AS days_to_expiry
         FROM company_documents
        WHERE expiry_mode = 'Has Expiry' AND expiry_date IS NOT NULL${co.clause}
        ORDER BY expiry_date LIMIT 5`, co.params);

    res.json({ counts, soonest, thresholds: DOC_EXPIRY_THRESHOLDS });
  } catch (err) { console.error('GET /documents/expiry-summary error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

// POST /api/documents/run-expiry-check — force the scheduler pass now
router.post('/run-expiry-check', authorize('admin'), async (req, res) => {
  try {
    const sent = await checkDocumentExpiry(pool);
    await addAudit(pool, req.user, 'Documents', 'Expiry Check', `Expiry check run manually: ${sent} alert(s) sent`);
    res.json({ success: true, alerts_sent: sent });
  } catch (err) { console.error('POST /documents/run-expiry-check error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

// PUT /api/documents/:id — edit the metadata without re-uploading the file.
// Needed because expiry is the field most likely to change on a document that
// is otherwise unchanged: a renewed licence keeps its name and category.
router.put('/:id', authorize('admin', 'hr_manager', 'accountant'), async (req, res) => {
  try {
    const co = companyClause(req, 'company_id');
    const [[doc]] = await pool.query(
      `SELECT id, category, expiry_mode, DATE_FORMAT(expiry_date, '%Y-%m-%d') AS expiry_date,
              COALESCE(document_name, file_name) AS label
         FROM company_documents WHERE id = ?` + co.clause, [req.params.id, ...co.params]);
    if (!doc) return res.status(404).json({ error: 'Document not found' });

    const expiry = readExpiryFields({ ...doc, ...req.body });
    if (expiry.error) return res.status(422).json({ error: expiry.error });

    const data = { ...expiry.data };
    if (req.body.category !== undefined) data.category = req.body.category || 'General';
    const newName = req.body.document_name !== undefined ? req.body.document_name : req.body.name;
    if (newName !== undefined) data.document_name = (newName || '').trim() || null;
    if (req.body.description !== undefined) data.description = (req.body.description || '').trim() || null;

    // A new expiry date is a new cycle, so the warning history clears — otherwise
    // a renewed document would never warn again.
    if (data.expiry_date !== doc.expiry_date) data.expiry_alert_sent = null;

    await pool.query('UPDATE company_documents SET ? WHERE id = ?', [data, doc.id]);
    await addAudit(pool, req.user, 'Documents', 'Updated',
      `Document "${doc.label}" updated`
      + (data.expiry_date !== doc.expiry_date ? ` — expiry ${doc.expiry_date || 'unset'} → ${data.expiry_date || 'unset'}` : ''));
    res.json({ success: true });
  } catch (err) { console.error('PUT /documents/:id error:', err); res.status(500).json({ error: 'Internal server error' }); }
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
