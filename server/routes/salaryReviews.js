import { Router } from 'express';
import pool from '../config/db.js';
import { auth } from '../middleware/auth.js';
import { requireModule, MODULES } from '../config/permissions.js';
import { authorize } from '../middleware/rbac.js';
import { validate } from '../middleware/validate.js';
import { upload } from '../middleware/upload.js';
import { addAudit } from '../services/auditService.js';
import { notify, notifyRole } from '../services/notificationService.js';
import { sendTemplateEmail } from '../services/emailService.js';
import { generateLetterContent } from '../services/deepseekService.js';
import { tenantScope, companyClause, resolveWriteCompanyId } from '../middleware/tenant.js';
import { seedDefaultActions, matchSalaryBand, notifyCompanyAdmins } from '../services/salaryReviewService.js';

const router = Router();
router.use(auth, tenantScope);

const DOC_CATEGORIES = ['revision_letter', 'signed_contract', 'mohre_proof', 'wps_proof', 'other'];

// ─── List / create cycles ─────────────────────────────────────────────────────
// GET /api/salary-reviews — list review cycles (scoped)
// Proposed salaries for the whole company. Reads are module-gated;
// see the note on PUT /:id/decision for why the router is not.
router.get('/', requireModule(MODULES.PAYROLL), async (req, res) => {
  try {
    const co = companyClause(req, 'sr.company_id');
    const [rows] = await pool.query(`
      SELECT sr.*, c.name AS company_name, c.short_code,
             pu.name AS prepared_by_name, du.name AS decided_by_name,
             (SELECT COUNT(*) FROM salary_review_items WHERE salary_review_id = sr.id) AS item_count,
             (SELECT COUNT(*) FROM salary_review_items WHERE salary_review_id = sr.id AND status = 'Applied') AS applied_count
      FROM salary_reviews sr
      LEFT JOIN companies c ON sr.company_id = c.id
      LEFT JOIN users pu ON sr.prepared_by = pu.id
      LEFT JOIN users du ON sr.decided_by = du.id
      WHERE 1=1` + co.clause + `
      ORDER BY sr.review_year DESC, sr.created_at DESC`, co.params);
    res.json(rows);
  } catch (err) { console.error('GET /salary-reviews error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

// POST /api/salary-reviews — create a Draft cycle, auto-populated with every Active employee
router.post('/', authorize('admin', 'hr_manager'), validate({
  review_year: { required: true, type: 'integer', min: 2000, max: 2100 },
}), async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const company_id = resolveWriteCompanyId(req, req.body.company_id);
    if (!company_id) return res.status(400).json({ error: 'Company is required' });
    const review_year = parseInt(req.body.review_year);

    const [[existing]] = await conn.query('SELECT id FROM salary_reviews WHERE company_id = ? AND review_year = ?', [company_id, review_year]);
    if (existing) return res.status(409).json({ error: `A salary review for ${review_year} already exists for this company` });

    await conn.beginTransaction();
    const [result] = await conn.query('INSERT INTO salary_reviews SET ?', {
      company_id, review_year, prepared_by: req.user.id, status: 'Draft', notes: req.body.notes || null,
    });
    const reviewId = result.insertId;

    const [employees] = await conn.query(
      "SELECT id, basic_salary, full_salary, job_title_id FROM employees WHERE company_id = ? AND status = 'Active'",
      [company_id]
    );
    for (const emp of employees) {
      const { band_min, band_max } = await matchSalaryBand(conn, emp.job_title_id);
      const [itemResult] = await conn.query('INSERT INTO salary_review_items SET ?', {
        salary_review_id: reviewId, employee_id: emp.id, company_id,
        current_basic_salary: emp.basic_salary, current_full_salary: emp.full_salary,
        job_title_id: emp.job_title_id, band_min, band_max, status: 'Pending',
      });
      await seedDefaultActions(conn, itemResult.insertId);
    }

    await conn.commit();
    await addAudit(pool, req.user, 'Salary Review', 'Created', `Salary review ${review_year} created for ${employees.length} employee(s)`, company_id);
    res.status(201).json({ id: reviewId, review_year, item_count: employees.length });
  } catch (err) {
    await conn.rollback();
    console.error('POST /salary-reviews error:', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally { conn.release(); }
});

// GET /api/salary-reviews/:id — full detail: cycle + items + each item's actions + documents
router.get('/:id', requireModule(MODULES.PAYROLL), async (req, res) => {
  try {
    const co = companyClause(req, 'sr.company_id');
    const [[review]] = await pool.query(`
      SELECT sr.*, c.name AS company_name, c.short_code, c.salary_review_approver_id,
             au.name AS approver_name, pu.name AS prepared_by_name, du.name AS decided_by_name
      FROM salary_reviews sr
      LEFT JOIN companies c ON sr.company_id = c.id
      LEFT JOIN users au ON c.salary_review_approver_id = au.id
      LEFT JOIN users pu ON sr.prepared_by = pu.id
      LEFT JOIN users du ON sr.decided_by = du.id
      WHERE sr.id = ?` + co.clause, [req.params.id, ...co.params]);
    if (!review) return res.status(404).json({ error: 'Salary review not found' });

    const [items] = await pool.query(`
      SELECT sri.*, e.first_name, e.last_name, e.email, jt.title AS job_title_name
      FROM salary_review_items sri
      JOIN employees e ON sri.employee_id = e.id
      LEFT JOIN job_titles jt ON sri.job_title_id = jt.id
      WHERE sri.salary_review_id = ? ORDER BY e.first_name`, [review.id]);

    const itemIds = items.map((i) => i.id);
    let actionsByItem = {}, docsByItem = {};
    if (itemIds.length) {
      const [actions] = await pool.query('SELECT * FROM salary_review_actions WHERE salary_review_item_id IN (?) ORDER BY sort_order', [itemIds]);
      for (const a of actions) (actionsByItem[a.salary_review_item_id] ??= []).push(a);
      const [docs] = await pool.query(
        'SELECT id, salary_review_item_id, category, file_name, file_type, file_size, uploaded_at FROM salary_review_documents WHERE salary_review_item_id IN (?) ORDER BY uploaded_at DESC',
        [itemIds]
      );
      for (const d of docs) (docsByItem[d.salary_review_item_id] ??= []).push(d);
    }
    const fullItems = items.map((i) => ({ ...i, actions: actionsByItem[i.id] || [], documents: docsByItem[i.id] || [] }));
    res.json({ ...review, items: fullItems });
  } catch (err) { console.error('GET /salary-reviews/:id error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

// ─── Item edits (HR, Draft only) ──────────────────────────────────────────────
// PUT /api/salary-reviews/items/:itemId
router.put('/items/:itemId', authorize('admin', 'hr_manager'), async (req, res) => {
  try {
    const co = companyClause(req, 'sri.company_id');
    const [[item]] = await pool.query(
      'SELECT sri.*, sr.status AS review_status FROM salary_review_items sri JOIN salary_reviews sr ON sri.salary_review_id = sr.id WHERE sri.id = ?' + co.clause,
      [req.params.itemId, ...co.params]
    );
    if (!item) return res.status(404).json({ error: 'Item not found' });
    if (item.review_status !== 'Draft') return res.status(409).json({ error: 'This review is no longer editable' });

    const { new_basic_salary, new_full_salary, effective_date, notes, status } = req.body;
    const data = {};
    if (new_basic_salary !== undefined) data.new_basic_salary = new_basic_salary === '' ? null : Number(new_basic_salary);
    if (new_full_salary !== undefined) data.new_full_salary = new_full_salary === '' ? null : Number(new_full_salary);
    if (effective_date !== undefined) data.effective_date = effective_date || null;
    if (notes !== undefined) data.notes = notes;
    if (status !== undefined) {
      if (!['Pending', 'Skipped'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
      data.status = status;
    }
    if (!Object.keys(data).length) return res.status(400).json({ error: 'No updatable fields provided' });

    await pool.query('UPDATE salary_review_items SET ? WHERE id = ?', [data, item.id]);
    res.json({ success: true });
  } catch (err) { console.error('PUT /salary-reviews/items/:itemId error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

// ─── Per-employee UAE compliance checklist ────────────────────────────────────
// POST /api/salary-reviews/items/:itemId/actions — add a custom action
router.post('/items/:itemId/actions', authorize('admin', 'hr_manager', 'hr_specialist'), async (req, res) => {
  try {
    const co = companyClause(req, 'company_id');
    const [[item]] = await pool.query('SELECT id FROM salary_review_items WHERE id = ?' + co.clause, [req.params.itemId, ...co.params]);
    if (!item) return res.status(404).json({ error: 'Item not found' });
    const label = String(req.body.label || '').trim();
    if (!label) return res.status(422).json({ error: 'A label is required' });
    const [[maxRow]] = await pool.query('SELECT COALESCE(MAX(sort_order),0) m FROM salary_review_actions WHERE salary_review_item_id = ?', [item.id]);
    const [result] = await pool.query('INSERT INTO salary_review_actions SET ?', {
      salary_review_item_id: item.id, action_key: 'custom', custom_label: label, is_required: false, sort_order: maxRow.m + 1,
    });
    res.status(201).json({ id: result.insertId, action_key: 'custom', custom_label: label, status: 'Pending' });
  } catch (err) { console.error('POST /salary-reviews/items/:itemId/actions error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

// PUT /api/salary-reviews/actions/:actionId — mark Completed/Skipped (+notes)
router.put('/actions/:actionId', authorize('admin', 'hr_manager', 'hr_specialist'), async (req, res) => {
  try {
    const co = companyClause(req, 'sri.company_id');
    const [[action]] = await pool.query(
      'SELECT sra.* FROM salary_review_actions sra JOIN salary_review_items sri ON sra.salary_review_item_id = sri.id WHERE sra.id = ?' + co.clause,
      [req.params.actionId, ...co.params]
    );
    if (!action) return res.status(404).json({ error: 'Action not found' });

    const { status, notes } = req.body;
    const data = {};
    if (status !== undefined) {
      if (!['Pending', 'Completed', 'Skipped'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
      data.status = status;
      data.completed_by = status === 'Completed' ? req.user.id : null;
      data.completed_at = status === 'Completed' ? new Date() : null;
    }
    if (notes !== undefined) data.notes = notes;
    if (!Object.keys(data).length) return res.status(400).json({ error: 'No updatable fields provided' });
    await pool.query('UPDATE salary_review_actions SET ? WHERE id = ?', [data, action.id]);
    res.json({ success: true });
  } catch (err) { console.error('PUT /salary-reviews/actions/:actionId error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

// ─── Proof documents ──────────────────────────────────────────────────────────
// POST /api/salary-reviews/items/:itemId/documents
router.post('/items/:itemId/documents', authorize('admin', 'hr_manager'), upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const co = companyClause(req, 'company_id');
    const [[item]] = await pool.query('SELECT id FROM salary_review_items WHERE id = ?' + co.clause, [req.params.itemId, ...co.params]);
    if (!item) return res.status(404).json({ error: 'Item not found' });
    const category = DOC_CATEGORIES.includes(req.body.category) ? req.body.category : 'other';
    const [result] = await pool.query('INSERT INTO salary_review_documents SET ?', {
      salary_review_item_id: item.id, category,
      file_name: req.file.originalname, file_type: req.file.mimetype, file_size: req.file.size,
      file_data: req.file.buffer, uploaded_by: req.user.id,
    });
    await addAudit(pool, req.user, 'Salary Review', 'Document Uploaded', `"${req.file.originalname}" uploaded for item #${item.id}`);
    res.status(201).json({ id: result.insertId, file_name: req.file.originalname, file_size: req.file.size, category });
  } catch (err) { console.error('POST /salary-reviews/items/:itemId/documents error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

// GET /api/salary-reviews/items/:itemId/documents/:docId/download
router.get('/items/:itemId/documents/:docId/download', requireModule(MODULES.PAYROLL), async (req, res) => {
  try {
    const co = companyClause(req, 'sri.company_id');
    const [[doc]] = await pool.query(
      `SELECT srd.file_data, srd.file_name FROM salary_review_documents srd
       JOIN salary_review_items sri ON srd.salary_review_item_id = sri.id
       WHERE srd.id = ? AND srd.salary_review_item_id = ?` + co.clause,
      [req.params.docId, req.params.itemId, ...co.params]
    );
    if (!doc) return res.status(404).json({ error: 'Document not found' });
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(doc.file_name)}"`);
    res.send(doc.file_data);
  } catch (err) { console.error('GET .../documents/:docId/download error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

// ─── AI-drafted Salary Revision Letter (client composes onto letterhead) ──────
// POST /api/salary-reviews/items/:itemId/letter
router.post('/items/:itemId/letter', authorize('admin', 'hr_manager'), async (req, res) => {
  try {
    const co = companyClause(req, 'sri.company_id');
    const [[item]] = await pool.query(`
      SELECT sri.*, e.first_name, e.last_name, e.job_title_text, jt.title AS job_title_name, c.name AS company_name
      FROM salary_review_items sri
      JOIN employees e ON sri.employee_id = e.id
      LEFT JOIN job_titles jt ON sri.job_title_id = jt.id
      LEFT JOIN companies c ON sri.company_id = c.id
      WHERE sri.id = ?` + co.clause, [req.params.itemId, ...co.params]);
    if (!item) return res.status(404).json({ error: 'Item not found' });
    if (!item.new_basic_salary) return res.status(422).json({ error: 'Set the new salary before generating the letter' });

    const employeeName = `${item.first_name} ${item.last_name}`;
    let content;
    try {
      content = await generateLetterContent('Salary Revision', {
        employee_name: employeeName,
        job_title: item.job_title_name || item.job_title_text,
        previous_basic_salary: item.current_basic_salary,
        previous_full_salary: item.current_full_salary,
        new_basic_salary: item.new_basic_salary,
        new_full_salary: item.new_full_salary,
        effective_date: item.effective_date,
      }, { name: item.company_name || 'Company' });
    } catch (aiErr) {
      console.error('AI generation failed, using fallback:', aiErr.message);
      content = `Dear ${employeeName},\n\nWe are pleased to confirm a revision to your salary, effective ${item.effective_date}.\n\nNew Basic Salary: ${item.new_basic_salary}\nNew Full Salary: ${item.new_full_salary}\n\nPlease sign and return a copy of this letter to acknowledge the change.\n\n[Auto-generated — AI service unavailable]`;
    }
    res.json({ content, employee_name: employeeName, company_name: item.company_name, employee_email: null });
  } catch (err) { console.error('POST .../items/:itemId/letter error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

// ─── Submit → Approve/Reject → Reopen ─────────────────────────────────────────
// POST /api/salary-reviews/:id/submit
router.post('/:id/submit', authorize('admin', 'hr_manager'), async (req, res) => {
  try {
    const co = companyClause(req, 'sr.company_id');
    const [[review]] = await pool.query(
      'SELECT sr.*, c.name AS company_name, c.salary_review_approver_id FROM salary_reviews sr LEFT JOIN companies c ON sr.company_id = c.id WHERE sr.id = ?' + co.clause,
      [req.params.id, ...co.params]
    );
    if (!review) return res.status(404).json({ error: 'Salary review not found' });
    if (review.status !== 'Draft') return res.status(409).json({ error: 'Only a draft review can be submitted' });

    const [items] = await pool.query("SELECT id, new_basic_salary, effective_date FROM salary_review_items WHERE salary_review_id = ? AND status <> 'Skipped'", [review.id]);
    if (!items.length) return res.status(422).json({ error: 'Add at least one employee before submitting' });
    const missing = items.filter((i) => !i.new_basic_salary || !i.effective_date);
    if (missing.length) {
      return res.status(422).json({ error: 'Some employees are missing a new salary or effective date', missing_item_ids: missing.map((m) => m.id) });
    }

    await pool.query("UPDATE salary_reviews SET status = 'Submitted', submitted_at = NOW() WHERE id = ?", [review.id]);
    await addAudit(pool, req.user, 'Salary Review', 'Submitted', `Salary review ${review.review_year} submitted for approval`, review.company_id);

    if (review.salary_review_approver_id) {
      await notify(pool, {
        userId: review.salary_review_approver_id, companyId: review.company_id, type: 'salary_review',
        title: `Salary review ${review.review_year} needs your approval`,
        body: `${items.length} employee(s) — ${review.company_name}`, link: '/salary-reviews',
      });
      const [[approver]] = await pool.query('SELECT name, email FROM users WHERE id = ?', [review.salary_review_approver_id]);
      if (approver?.email) {
        await sendTemplateEmail({
          templateType: 'salary_review_submitted',
          data: { name: approver.name, company: review.company_name, review_year: review.review_year, employee_count: items.length },
          to: approver.email, toName: approver.name, companyId: review.company_id,
          relatedModule: 'SalaryReview', relatedId: review.id,
        });
      }
    } else {
      // No approver configured for this company — fall back to every admin
      // (company-bound + platform) so the review is never stuck unactionable.
      await notifyCompanyAdmins(pool, review.company_id, {
        type: 'salary_review', title: `Salary review ${review.review_year} needs approval`,
        body: `No approver configured for ${review.company_name} — any admin may approve.`, link: '/salary-reviews',
      }, req.user.id);
    }

    res.json({ success: true });
  } catch (err) { console.error('POST /salary-reviews/:id/submit error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

// PUT /api/salary-reviews/:id/decision — the approver's Approve/Reject action.
// No role-based authorize(): the identity check below (designated approver, or
// any admin when none is configured) IS the authorization, and is stricter than
// a role gate. Segregation of duties: the preparer can never approve their own review.
router.put('/:id/decision', async (req, res) => {
  try {
    const co = companyClause(req, 'sr.company_id');
    const [[review]] = await pool.query(
      'SELECT sr.*, c.name AS company_name, c.salary_review_approver_id FROM salary_reviews sr LEFT JOIN companies c ON sr.company_id = c.id WHERE sr.id = ?' + co.clause,
      [req.params.id, ...co.params]
    );
    if (!review) return res.status(404).json({ error: 'Salary review not found' });
    if (review.status !== 'Submitted') return res.status(409).json({ error: 'Only a submitted review can be decided' });

    const isDesignated = review.salary_review_approver_id
      ? req.user.id === review.salary_review_approver_id
      : req.user.role === 'admin';
    if (!isDesignated) return res.status(403).json({ error: 'You are not authorized to approve this review' });
    if (req.user.id === review.prepared_by) return res.status(403).json({ error: 'You cannot approve a review you prepared yourself' });

    const { decision, note } = req.body;
    if (!['Approved', 'Rejected'].includes(decision)) return res.status(400).json({ error: 'decision must be Approved or Rejected' });
    if (decision === 'Rejected' && !String(note || '').trim()) return res.status(422).json({ error: 'A note is required when rejecting' });

    await pool.query('UPDATE salary_reviews SET status = ?, decided_by = ?, decided_at = NOW(), decision_note = ? WHERE id = ?', [decision, req.user.id, note || null, review.id]);
    const itemStatus = decision === 'Approved' ? 'Approved' : 'Rejected';
    await pool.query("UPDATE salary_review_items SET status = ? WHERE salary_review_id = ? AND status <> 'Skipped'", [itemStatus, review.id]);

    await addAudit(pool, req.user, 'Salary Review', decision, `Salary review ${review.review_year} ${decision.toLowerCase()} by ${req.user.name}${note ? `: ${note}` : ''}`, review.company_id);

    await notify(pool, {
      userId: review.prepared_by, companyId: review.company_id, type: 'salary_review',
      title: `Salary review ${review.review_year} ${decision.toLowerCase()}`,
      body: note || undefined, link: '/salary-reviews',
    });
    const [[preparer]] = await pool.query('SELECT name, email FROM users WHERE id = ?', [review.prepared_by]);
    if (preparer?.email) {
      await sendTemplateEmail({
        templateType: 'salary_review_decision',
        data: { name: preparer.name, company: review.company_name, review_year: review.review_year, decision, note },
        to: preparer.email, toName: preparer.name, companyId: review.company_id,
        relatedModule: 'SalaryReview', relatedId: review.id,
      });
    }
    res.json({ success: true });
  } catch (err) { console.error('PUT /salary-reviews/:id/decision error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

// POST /api/salary-reviews/:id/reopen — Rejected → Draft, for revision + resubmission
router.post('/:id/reopen', authorize('admin', 'hr_manager'), async (req, res) => {
  try {
    const co = companyClause(req, 'company_id');
    const [[review]] = await pool.query('SELECT id, status FROM salary_reviews WHERE id = ?' + co.clause, [req.params.id, ...co.params]);
    if (!review) return res.status(404).json({ error: 'Salary review not found' });
    if (review.status !== 'Rejected') return res.status(409).json({ error: 'Only a rejected review can be reopened' });
    await pool.query("UPDATE salary_reviews SET status = 'Draft', decided_by = NULL, decided_at = NULL WHERE id = ?", [review.id]);
    await pool.query("UPDATE salary_review_items SET status = 'Pending' WHERE salary_review_id = ? AND status = 'Rejected'", [review.id]);
    await addAudit(pool, req.user, 'Salary Review', 'Reopened', `Salary review #${review.id} reopened for revision`);
    res.json({ success: true });
  } catch (err) { console.error('POST /salary-reviews/:id/reopen error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

// DELETE /api/salary-reviews/:id — admin only, Draft only
router.delete('/:id', authorize('admin'), async (req, res) => {
  try {
    const co = companyClause(req, 'company_id');
    const [[review]] = await pool.query('SELECT id, status FROM salary_reviews WHERE id = ?' + co.clause, [req.params.id, ...co.params]);
    if (!review) return res.status(404).json({ error: 'Salary review not found' });
    if (review.status !== 'Draft') return res.status(409).json({ error: 'Only a draft review can be deleted' });
    await pool.query('DELETE FROM salary_reviews WHERE id = ?', [review.id]);
    await addAudit(pool, req.user, 'Salary Review', 'Deleted', `Salary review #${review.id} deleted`);
    res.json({ success: true });
  } catch (err) { console.error('DELETE /salary-reviews/:id error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

export default router;
