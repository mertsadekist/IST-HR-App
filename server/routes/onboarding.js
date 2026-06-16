import { Router } from 'express';
import pool from '../config/db.js';
import { auth } from '../middleware/auth.js';
import { authorize } from '../middleware/rbac.js';
import { addAudit } from '../services/auditService.js';
import { tenantScope, companyClause } from '../middleware/tenant.js';

const router = Router();
router.use(auth, tenantScope);

// Returns the company_id owning a checklist item, or undefined if not found.
async function checklistItemCompany(itemId) {
  const [[row]] = await pool.query(
    `SELECT obr.company_id FROM onboarding_checklist_items ci
     JOIN onboarding_steps s ON ci.step_id = s.id
     JOIN onboarding_records obr ON s.onboarding_id = obr.id
     WHERE ci.id = ?`, [itemId]);
  return row?.company_id;
}
// Returns the company_id owning an onboarding step, or undefined if not found.
async function stepCompany(stepId) {
  const [[row]] = await pool.query(
    `SELECT obr.company_id FROM onboarding_steps s
     JOIN onboarding_records obr ON s.onboarding_id = obr.id
     WHERE s.id = ?`, [stepId]);
  return row?.company_id;
}
// True if the caller may act on a row belonging to `companyId`.
const canActOnCompany = (req, companyId) =>
  companyId !== undefined && (req.companyId == null || Number(companyId) === req.companyId);

// GET /api/onboarding?status=X (scoped)
router.get('/', async (req, res) => {
  try {
    const co = companyClause(req, 'ob.company_id');
    let sql = `SELECT ob.*, e.first_name, e.last_name, e.email, e.phone,
               c.name as company_name, c.short_code, c.color_primary,
               d.name as department_name, jt.title as job_title_name
               FROM onboarding_records ob
               JOIN employees e ON ob.employee_id = e.id
               LEFT JOIN companies c ON ob.company_id = c.id
               LEFT JOIN departments d ON e.department_id = d.id
               LEFT JOIN job_titles jt ON e.job_title_id = jt.id WHERE 1=1` + co.clause;
    const params = [...co.params];
    if (req.query.status) { sql += ' AND ob.status = ?'; params.push(req.query.status); }
    sql += ' ORDER BY ob.started_at DESC';
    const [rows] = await pool.query(sql, params);

    // Get step counts for progress
    for (const ob of rows) {
      const [[stepCount]] = await pool.query('SELECT COUNT(*) as total, SUM(status = "Complete") as done FROM onboarding_steps WHERE onboarding_id = ?', [ob.id]);
      ob.total_steps = stepCount.total;
      ob.completed_steps = stepCount.done || 0;
      ob.progress = stepCount.total > 0 ? Math.round((stepCount.done / stepCount.total) * 100) : 0;
    }
    res.json(rows);
  } catch (err) { console.error('GET /onboarding error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

// GET /api/onboarding/:id — detail with steps + checklists (scoped)
router.get('/:id', async (req, res) => {
  try {
    const co = companyClause(req, 'ob.company_id');
    const [records] = await pool.query(`SELECT ob.*, e.first_name, e.last_name, e.email, e.phone, e.start_date,
      c.name as company_name, c.short_code FROM onboarding_records ob
      JOIN employees e ON ob.employee_id = e.id LEFT JOIN companies c ON ob.company_id = c.id WHERE ob.id = ?` + co.clause, [req.params.id, ...co.params]);
    if (!records.length) return res.status(404).json({ error: 'Onboarding record not found' });

    const [steps] = await pool.query('SELECT * FROM onboarding_steps WHERE onboarding_id = ? ORDER BY step_number', [req.params.id]);
    for (const step of steps) {
      const [items] = await pool.query('SELECT * FROM onboarding_checklist_items WHERE step_id = ? ORDER BY sort_order', [step.id]);
      step.checklist_items = items;
    }

    res.json({ ...records[0], steps });
  } catch (err) { console.error('GET /onboarding/:id error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

// POST /api/onboarding/:id/init — Initialize steps from templates (scoped)
router.post('/:id/init', authorize('admin', 'hr_manager'), async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const co = companyClause(req, 'company_id');
    const [[record]] = await conn.query('SELECT * FROM onboarding_records WHERE id = ?' + co.clause, [req.params.id, ...co.params]);
    if (!record) { await conn.rollback(); return res.status(404).json({ error: 'Not found' }); }

    // Load templates
    const [templates] = await conn.query('SELECT * FROM onboarding_step_templates WHERE company_id = ? ORDER BY step_number', [record.company_id]);
    for (const tpl of templates) {
      const [stepResult] = await conn.query('INSERT INTO onboarding_steps SET ?', {
        onboarding_id: record.id, step_number: tpl.step_number, name: tpl.name,
        owner: tpl.owner, sla: tpl.sla, status: tpl.step_number === 1 ? 'Open' : 'Locked',
        opened_at: tpl.step_number === 1 ? new Date() : null,
      });
      const [tplItems] = await conn.query('SELECT * FROM onboarding_step_template_items WHERE template_step_id = ? ORDER BY sort_order', [tpl.id]);
      for (const item of tplItems) {
        await conn.query('INSERT INTO onboarding_checklist_items SET ?', {
          step_id: stepResult.insertId, label: item.label, sort_order: item.sort_order,
        });
      }
    }
    await conn.commit();
    await addAudit(pool, req.user, 'Onboarding', 'Initialized', `Onboarding #${req.params.id} steps initialized from templates`);
    res.json({ success: true, steps_created: templates.length });
  } catch (err) { await conn.rollback(); console.error('POST /onboarding/:id/init error:', err); res.status(500).json({ error: 'Internal server error' }); }
  finally { conn.release(); }
});

// PUT /api/onboarding/checklist/:itemId — toggle checklist item (authz + scoped)
router.put('/checklist/:itemId', authorize('admin', 'hr_manager', 'hr_specialist'), async (req, res) => {
  try {
    const owner = await checklistItemCompany(req.params.itemId);
    if (!canActOnCompany(req, owner)) return res.status(404).json({ error: 'Checklist item not found' });
    const { is_checked } = req.body;
    await pool.query('UPDATE onboarding_checklist_items SET is_checked = ?, checked_at = ? WHERE id = ?',
      [is_checked, is_checked ? new Date() : null, req.params.itemId]);
    res.json({ success: true });
  } catch (err) { console.error('PUT /onboarding/checklist/:itemId error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

// PUT /api/onboarding/steps/:stepId/complete — complete a step and unlock next (scoped)
router.put('/steps/:stepId/complete', authorize('admin', 'hr_manager'), async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const owner = await stepCompany(req.params.stepId);
    if (!canActOnCompany(req, owner)) return res.status(404).json({ error: 'Step not found' });
    await conn.beginTransaction();
    const [[step]] = await conn.query('SELECT * FROM onboarding_steps WHERE id = ?', [req.params.stepId]);
    if (!step) { await conn.rollback(); return res.status(404).json({ error: 'Step not found' }); }

    await conn.query('UPDATE onboarding_steps SET status = ?, completed_at = ? WHERE id = ?', ['Complete', new Date(), step.id]);

    // Unlock next step
    const [[nextStep]] = await conn.query('SELECT * FROM onboarding_steps WHERE onboarding_id = ? AND step_number = ? AND status = ?',
      [step.onboarding_id, step.step_number + 1, 'Locked']);
    if (nextStep) {
      await conn.query('UPDATE onboarding_steps SET status = ?, opened_at = ? WHERE id = ?', ['Open', new Date(), nextStep.id]);
    }

    // Check if all steps complete → mark onboarding as completed
    const [[remaining]] = await conn.query('SELECT COUNT(*) as cnt FROM onboarding_steps WHERE onboarding_id = ? AND status != ?', [step.onboarding_id, 'Complete']);
    if (remaining.cnt === 0) {
      await conn.query('UPDATE onboarding_records SET status = ?, completed_at = ? WHERE id = ?', ['Completed', new Date(), step.onboarding_id]);
      const [[ob]] = await conn.query('SELECT employee_id FROM onboarding_records WHERE id = ?', [step.onboarding_id]);
      if (ob) await conn.query('UPDATE employees SET status = ? WHERE id = ?', ['Active', ob.employee_id]);
    }

    await conn.commit();
    res.json({ success: true });
  } catch (err) { await conn.rollback(); console.error('PUT /onboarding/steps/:stepId/complete error:', err); res.status(500).json({ error: 'Internal server error' }); }
  finally { conn.release(); }
});

export default router;
