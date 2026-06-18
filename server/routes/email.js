import { Router } from 'express';
import multer from 'multer';
import pool from '../config/db.js';
import { auth } from '../middleware/auth.js';
import { authorize } from '../middleware/rbac.js';
import { sendEmail, sendTemplateEmail, sendBulkEmail, testSMTPConnection, saveEmailConfig, getEmailConfig, testSMTPWithConfig, clearTransporterCache } from '../services/emailService.js';
import { getTemplateTypes, getTemplate } from '../services/emailTemplates.js';
import { addAudit } from '../services/auditService.js';
import { tenantScope, companyClause, resolveWriteCompanyId } from '../middleware/tenant.js';

const router = Router();
router.use(auth, tenantScope);

// In-memory upload for document-delivery: the PDF is attached to the email and
// never persisted (the source document already lives in its own module).
const docUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') return cb(null, true);
    cb(new Error('Only PDF attachments are allowed'));
  },
});

// GET /api/email/templates — List all available template types
router.get('/templates', (req, res) => {
  res.json(getTemplateTypes());
});

// POST /api/email/preview — Preview a template with data
router.post('/preview', (req, res) => {
  try {
    const { templateType, data } = req.body;
    const result = getTemplate(templateType, data || {});
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/email/send — Send a single email
router.post('/send', authorize('admin', 'hr_manager'), async (req, res) => {
  try {
    const { to, toName, subject, html, templateType, relatedModule, relatedId } = req.body;
    if (!to || !subject) return res.status(400).json({ error: 'Recipient email and subject are required' });

    const result = await sendEmail({
      to, toName, subject, html,
      companyId: resolveWriteCompanyId(req, req.body.companyId),
      templateType: templateType || 'custom',
      relatedModule, relatedId,
      sentBy: req.user.id,
    });

    if (result.success) {
      await addAudit(pool, req.user, 'Email', 'Sent', `Email sent to ${to}: "${subject}"`);
    }

    res.json(result);
  } catch (err) {
    console.error('POST /email/send error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/email/send-template — Send using a predefined template
router.post('/send-template', authorize('admin', 'hr_manager'), async (req, res) => {
  try {
    const { templateType, data, to, toName, relatedModule, relatedId } = req.body;
    if (!to || !templateType) return res.status(400).json({ error: 'Recipient and template type are required' });

    const result = await sendTemplateEmail({
      templateType, data: data || {},
      to, toName, companyId: resolveWriteCompanyId(req, req.body.companyId),
      relatedModule, relatedId,
      sentBy: req.user.id,
    });

    if (result.success) {
      await addAudit(pool, req.user, 'Email', 'Template Sent', `Template "${templateType}" sent to ${to}`);
    }

    res.json(result);
  } catch (err) {
    console.error('POST /email/send-template error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/email/send-bulk — Send to multiple recipients
router.post('/send-bulk', authorize('admin', 'hr_manager'), async (req, res) => {
  try {
    const { templateType, data, recipients, relatedModule } = req.body;
    if (!recipients?.length || !templateType) return res.status(400).json({ error: 'Recipients and template type required' });

    const results = await sendBulkEmail({
      templateType, data: data || {},
      recipients, companyId: resolveWriteCompanyId(req, req.body.companyId),
      relatedModule, sentBy: req.user.id,
    });

    const sent = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    await addAudit(pool, req.user, 'Email', 'Bulk Sent', `Bulk "${templateType}": ${sent} sent, ${failed} failed`);

    res.json({ total: recipients.length, sent, failed, results });
  } catch (err) {
    console.error('POST /email/send-bulk error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/email/log — Email history with filters (scoped)
router.get('/log', authorize('admin', 'hr_manager'), async (req, res) => {
  try {
    const { page = 1, limit = 25, status, module: relatedModule, search } = req.query;
    const safeLimit = Math.min(parseInt(limit) || 25, 100);
    const safePage = Math.max(parseInt(page) || 1, 1);
    const offset = (safePage - 1) * safeLimit;

    const co = companyClause(req, 'el.company_id');
    const coCount = companyClause(req, 'company_id');
    let sql = `SELECT el.*, u.name as sent_by_name FROM email_log el
               LEFT JOIN users u ON el.sent_by = u.id WHERE 1=1` + co.clause;
    let countSql = 'SELECT COUNT(*) as total FROM email_log WHERE 1=1' + coCount.clause;
    const params = [...co.params];
    const countParams = [...coCount.params];

    if (status) {
      sql += ' AND el.status = ?'; params.push(status);
      countSql += ' AND status = ?'; countParams.push(status);
    }
    if (relatedModule) {
      sql += ' AND el.related_module = ?'; params.push(relatedModule);
      countSql += ' AND related_module = ?'; countParams.push(relatedModule);
    }
    if (search) {
      sql += ' AND (el.to_email LIKE ? OR el.subject LIKE ? OR el.to_name LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
      countSql += ' AND (to_email LIKE ? OR subject LIKE ? OR to_name LIKE ?)';
      countParams.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    sql += ' ORDER BY el.sent_at DESC LIMIT ? OFFSET ?';
    params.push(safeLimit, offset);

    const [rows] = await pool.query(sql, params);
    const [[{ total }]] = await pool.query(countSql, countParams);

    res.json({ data: rows, total, page: safePage, limit: safeLimit });
  } catch (err) {
    console.error('GET /email/log error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/email/log/stats — Email stats summary (scoped)
router.get('/log/stats', authorize('admin', 'hr_manager'), async (req, res) => {
  try {
    const co = companyClause(req, 'company_id');
    const [rows] = await pool.query(`
      SELECT
        COUNT(*) as total,
        SUM(status = 'Sent') as sent,
        SUM(status = 'Failed') as failed,
        SUM(status = 'Queued') as queued
      FROM email_log WHERE 1=1` + co.clause, co.params);
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/email/log/:id — Single email details (scoped)
router.get('/log/:id', authorize('admin', 'hr_manager'), async (req, res) => {
  try {
    const co = companyClause(req, 'el.company_id');
    const [[row]] = await pool.query(
      'SELECT el.*, u.name as sent_by_name FROM email_log el LEFT JOIN users u ON el.sent_by = u.id WHERE el.id = ?' + co.clause,
      [req.params.id, ...co.params]
    );
    if (!row) return res.status(404).json({ error: 'Email log not found' });
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/email/send-document — Email a generated/uploaded PDF with a
// bilingual cover message. The client renders the on-screen document to PDF
// (perfect AR/EN + branding) and uploads it here; we attach it and send.
// Used by Legal Letters, Offers, Handover receipts, Reports & payslips.
router.post('/send-document', authorize('admin', 'hr_manager'), docUpload.single('file'), async (req, res) => {
  try {
    const { to, toName, title, message, cc, relatedModule, relatedId } = req.body;
    if (!req.file) return res.status(400).json({ error: 'A PDF file is required' });
    if (!to || !title) return res.status(400).json({ error: 'Recipient and document title are required' });

    const companyId = resolveWriteCompanyId(req, req.body.companyId);
    let companyName;
    if (companyId) {
      const [[c]] = await pool.query('SELECT name FROM companies WHERE id = ?', [companyId]);
      companyName = c?.name;
    }

    const { subject, html } = getTemplate('document_delivery', {
      name: toName, title, message, company: companyName,
    });

    // Safe ASCII-ish filename for the attachment.
    const safeFile = `${String(title).replace(/[^\w؀-ۿ\- ]+/g, '').trim().slice(0, 80) || 'document'}.pdf`;

    const result = await sendEmail({
      to, toName, subject, html,
      companyId,
      templateType: 'document_delivery',
      relatedModule: relatedModule || 'Documents',
      relatedId: relatedId || null,
      sentBy: req.user.id,
      cc: cc ? (Array.isArray(cc) ? cc : String(cc).split(',').map(s => s.trim())) : undefined,
      attachments: [{ filename: safeFile, content: req.file.buffer, contentType: 'application/pdf' }],
    });

    if (result.success) {
      await addAudit(pool, req.user, 'Email', 'Document Sent', `"${title}" sent to ${to}`);
      return res.json({ success: true, messageId: result.messageId });
    }
    return res.status(502).json({ success: false, error: result.error || 'Send failed' });
  } catch (err) {
    console.error('POST /email/send-document error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/email/test — Test SMTP connection
router.post('/test', authorize('admin'), async (req, res) => {
  try {
    const { companyId } = req.body;
    const result = await testSMTPConnection(companyId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==================== Email Config (SMTP Settings) ====================

// GET /api/email/config — Get email config
router.get('/config', auth, authorize('admin'), async (req, res) => {
  try {
    const config = await getEmailConfig(req.query.company_id || null);
    res.json(config || {});
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/email/config — Save email config
router.put('/config', auth, authorize('admin'), async (req, res) => {
  try {
    const result = await saveEmailConfig(req.body, req.body.company_id || null);
    await addAudit(pool, req.user, 'Settings', 'Email Config Updated', 'SMTP configuration updated');
    res.json(result);
  } catch (err) {
    console.error('PUT /email/config error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/email/config/test — Test with raw config
router.post('/config/test', auth, authorize('admin'), async (req, res) => {
  try {
    const result = await testSMTPWithConfig(req.body);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
