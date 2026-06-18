import { Router } from 'express';
import pool from '../config/db.js';
import { auth } from '../middleware/auth.js';
import { authorize } from '../middleware/rbac.js';
import { addAudit } from '../services/auditService.js';
import { generateLetterContent } from '../services/deepseekService.js';
import { tenantScope, companyClause, resolveWriteCompanyId } from '../middleware/tenant.js';

const router = Router();
router.use(auth, tenantScope);

// GET /api/legal/templates — List letter templates (global config; see audit TEN-010)
router.get('/templates', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM letter_templates ORDER BY sort_order, name');
    res.json(rows);
  } catch (err) { console.error('GET /legal/templates error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

// POST /api/legal/templates
router.post('/templates', authorize('admin', 'hr_manager'), async (req, res) => {
  try {
    const { name, type, icon, fields_config, body_template } = req.body;
    const [result] = await pool.query('INSERT INTO letter_templates SET ?', {
      name, type: type || name, icon: icon || '📄',
      fields_config: fields_config || '[]',
      body_template: body_template || '',
    });
    await addAudit(pool, req.user, 'Legal', 'Created', `Letter template "${name}" created`);
    res.status(201).json({ id: result.insertId, name });
  } catch (err) { console.error('POST /legal/templates error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

// PUT /api/legal/templates/:id
router.put('/templates/:id', authorize('admin', 'hr_manager'), async (req, res) => {
  try {
    const { name, type, icon, fields_config, body_template, status } = req.body;
    const updates = {};
    if (name !== undefined) updates.name = name;
    if (type !== undefined) updates.type = type;
    if (icon !== undefined) updates.icon = icon;
    if (fields_config !== undefined) updates.fields_config = fields_config;
    if (body_template !== undefined) updates.body_template = body_template;
    if (status !== undefined) updates.status = status;
    await pool.query('UPDATE letter_templates SET ? WHERE id = ?', [updates, req.params.id]);
    res.json({ success: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
});

// DELETE /api/legal/templates/:id
router.delete('/templates/:id', authorize('admin'), async (req, res) => {
  try {
    await pool.query('DELETE FROM letter_templates WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
});

// GET /api/legal/letters — List generated letters (scoped)
router.get('/letters', async (req, res) => {
  try {
    const co = companyClause(req, 'gl.company_id');
    let sql = `SELECT gl.*, lt.name as template_name,
               c.name as company_name, c.short_code, c.color_primary
               FROM generated_letters gl
               LEFT JOIN letter_templates lt ON gl.template_id = lt.id
               LEFT JOIN companies c ON gl.company_id = c.id WHERE 1=1` + co.clause;
    const params = [...co.params];
    if (req.query.template_id) { sql += ' AND gl.template_id = ?'; params.push(req.query.template_id); }
    sql += ' ORDER BY gl.generated_at DESC';
    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
});

// POST /api/legal/letters — Generate a letter
router.post('/letters', authorize('admin', 'hr_manager'), async (req, res) => {
  try {
    const { template_id, employee_id, fields_data } = req.body;

    // Get template
    const [[template]] = await pool.query('SELECT * FROM letter_templates WHERE id = ?', [template_id]);
    if (!template) return res.status(404).json({ error: 'Template not found' });

    // Resolve the employee by id. Internal staff (admin/hr_manager) operate across
    // the organization, so a letter may be issued for any employee; the letter's
    // company is taken from the employee. Self-service users stay company-scoped.
    let employee = null;
    if (employee_id) {
      const eco = req.crossCompany ? { clause: '', params: [] } : companyClause(req, 'e.company_id');
      const [[emp]] = await pool.query(`SELECT e.*, c.name as company_name, c.short_code, d.name as department_name, jt.title as job_title_name
        FROM employees e LEFT JOIN companies c ON e.company_id = c.id LEFT JOIN departments d ON e.department_id = d.id
        LEFT JOIN job_titles jt ON e.job_title_id = jt.id WHERE e.id = ?` + eco.clause, [employee_id, ...eco.params]);
      if (!emp) return res.status(404).json({ error: 'Employee not found' });
      employee = emp;
    }

    const recipientName = employee ? `${employee.first_name} ${employee.last_name}` : (fields_data?.employee_name || 'Employee');
    const companyId = employee?.company_id || resolveWriteCompanyId(req, req.body.company_id);

    // Generate content via DeepSeek AI
    let content = '';
    try {
      const aiResult = await generateLetterContent(template.name, {
        ...fields_data,
        employee_name: recipientName,
        job_title: employee?.job_title_name || fields_data?.job_title,
        department: employee?.department_name || fields_data?.department,
        company_name: employee?.company_name || fields_data?.company_name,
        start_date: employee?.start_date,
        salary: employee?.full_salary,
      }, { name: employee?.company_name || 'Company' });
      content = aiResult;
    } catch (aiErr) {
      console.error('AI generation failed, using fallback:', aiErr.message);
      content = `[Letter: ${template.name}]\n\nTo Whom It May Concern,\n\nThis letter is generated for ${recipientName}.\n\nFields: ${JSON.stringify(fields_data, null, 2)}\n\n[Auto-generated — AI service unavailable]`;
    }

    const [result] = await pool.query('INSERT INTO generated_letters SET ?', {
      template_id, company_id: companyId,
      letter_type: template.type || template.name,
      recipient_name: recipientName,
      field_values: JSON.stringify({ ...fields_data, employee_id }),
      rendered_html: content,
      generated_by: req.user.id,
    });

    await addAudit(pool, req.user, 'Legal', 'Generated', `Letter "${template.name}" for ${recipientName}`);
    res.status(201).json({ id: result.insertId, content, recipient_name: recipientName, template_name: template.name, generated_at: new Date() });
  } catch (err) { console.error('POST /legal/letters error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

// GET /api/legal/letters/:id (company-scoped)
router.get('/letters/:id', async (req, res) => {
  try {
    const co = companyClause(req, 'gl.company_id');
    const [rows] = await pool.query(`SELECT gl.*, lt.name as template_name,
      c.name as company_name, c.short_code FROM generated_letters gl
      LEFT JOIN letter_templates lt ON gl.template_id = lt.id
      LEFT JOIN companies c ON gl.company_id = c.id WHERE gl.id = ?` + co.clause, [req.params.id, ...co.params]);
    if (!rows.length) return res.status(404).json({ error: 'Letter not found' });
    res.json(rows[0]);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
});

// DELETE /api/legal/letters/:id (company-scoped)
router.delete('/letters/:id', authorize('admin'), async (req, res) => {
  try {
    const co = companyClause(req, 'company_id');
    const [result] = await pool.query('DELETE FROM generated_letters WHERE id = ?' + co.clause, [req.params.id, ...co.params]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Letter not found' });
    await addAudit(pool, req.user, 'Legal', 'Deleted', `Letter #${req.params.id} deleted`);
    res.json({ success: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
});

export default router;
