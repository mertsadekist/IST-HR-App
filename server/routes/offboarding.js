import { Router } from 'express';
import pool from '../config/db.js';
import { auth } from '../middleware/auth.js';
import { authorize } from '../middleware/rbac.js';
import { addAudit } from '../services/auditService.js';
import { tenantScope, companyClause } from '../middleware/tenant.js';
import { calculateEOSB } from '../services/eosbService.js';

const router = Router();
router.use(auth, tenantScope);

async function offboardingStepCompany(stepId) {
  const [[row]] = await pool.query(
    `SELECT obr.company_id FROM offboarding_steps s
     JOIN offboarding_records obr ON s.offboarding_id = obr.id WHERE s.id = ?`, [stepId]);
  return row?.company_id;
}
async function offboardingChecklistCompany(itemId) {
  const [[row]] = await pool.query(
    `SELECT obr.company_id FROM offboarding_checklist_items ci
     JOIN offboarding_steps s ON ci.step_id = s.id
     JOIN offboarding_records obr ON s.offboarding_id = obr.id WHERE ci.id = ?`, [itemId]);
  return row?.company_id;
}
const canActOnCompany = (req, companyId) =>
  companyId !== undefined && (req.companyId == null || Number(companyId) === req.companyId);

// GET /api/offboarding?status=X (scoped)
router.get('/', async (req, res) => {
  try {
    const co = companyClause(req, 'ob.company_id');
    let sql = `SELECT ob.*, e.first_name, e.last_name, e.email,
               c.name as company_name, c.short_code, c.color_primary,
               d.name as department_name
               FROM offboarding_records ob
               JOIN employees e ON ob.employee_id = e.id
               LEFT JOIN companies c ON ob.company_id = c.id
               LEFT JOIN departments d ON e.department_id = d.id WHERE 1=1` + co.clause;
    const params = [...co.params];
    if (req.query.status) { sql += ' AND ob.status = ?'; params.push(req.query.status); }
    sql += ' ORDER BY ob.started_at DESC';
    const [rows] = await pool.query(sql, params);

    for (const ob of rows) {
      const [[stepCount]] = await pool.query('SELECT COUNT(*) as total, SUM(status = "Complete") as done FROM offboarding_steps WHERE offboarding_id = ?', [ob.id]);
      ob.total_steps = stepCount.total;
      ob.completed_steps = stepCount.done || 0;
      ob.progress = stepCount.total > 0 ? Math.round((stepCount.done / stepCount.total) * 100) : 0;
    }
    res.json(rows);
  } catch (err) { console.error('GET /offboarding error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

// GET /api/offboarding/:id (scoped)
router.get('/:id', async (req, res) => {
  try {
    const co = companyClause(req, 'ob.company_id');
    const [records] = await pool.query(`SELECT ob.*, e.first_name, e.last_name, e.email, e.phone, e.start_date, e.basic_salary, e.full_salary,
      c.name as company_name, c.short_code FROM offboarding_records ob
      JOIN employees e ON ob.employee_id = e.id LEFT JOIN companies c ON ob.company_id = c.id WHERE ob.id = ?` + co.clause, [req.params.id, ...co.params]);
    if (!records.length) return res.status(404).json({ error: 'Not found' });

    const [steps] = await pool.query('SELECT * FROM offboarding_steps WHERE offboarding_id = ? ORDER BY step_number', [req.params.id]);
    for (const step of steps) {
      const [items] = await pool.query('SELECT * FROM offboarding_checklist_items WHERE step_id = ? ORDER BY sort_order', [step.id]);
      step.checklist_items = items;
    }
    res.json({ ...records[0], steps });
  } catch (err) { console.error('GET /offboarding/:id error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

// POST /api/offboarding — Initiate offboarding (employee must be in caller's company)
router.post('/', authorize('admin', 'hr_manager'), async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const { employee_id, departure_type, last_working_day, reason, unpaid_leave_days } = req.body;
    const eco = companyClause(req, 'company_id');
    const [[emp]] = await conn.query('SELECT * FROM employees WHERE id = ?' + eco.clause, [employee_id, ...eco.params]);
    if (!emp) { await conn.rollback(); return res.status(404).json({ error: 'Employee not found' }); }

    // Calculate EOSB via the tested engine (UAE labour-law rules + breakdown)
    const eosb = calculateEOSB({
      startDate: emp.start_date,
      lastWorkingDay: last_working_day,
      basicSalary: emp.basic_salary,
      departureType: departure_type,
      unpaidLeaveDays: Number(unpaid_leave_days) || 0,
    });
    const eosbAmount = eosb.eosb_amount;

    const [result] = await conn.query('INSERT INTO offboarding_records SET ?', {
      employee_id, company_id: emp.company_id, departure_type, last_working_day, reason,
      basic_salary: emp.basic_salary, full_salary: emp.full_salary,
      employment_start: emp.start_date, eosb_amount: eosbAmount,
      total_settlement: eosbAmount,
    });

    await conn.query('UPDATE employees SET status = ? WHERE id = ?', ['Offboarding', employee_id]);

    // Load templates and create steps
    const [templates] = await conn.query('SELECT * FROM offboarding_step_templates WHERE company_id = ? ORDER BY step_number', [emp.company_id]);
    for (const tpl of templates) {
      const [stepRes] = await conn.query('INSERT INTO offboarding_steps SET ?', {
        offboarding_id: result.insertId, step_number: tpl.step_number, name: tpl.name,
        owner: tpl.owner, sla: tpl.sla, status: tpl.step_number === 1 ? 'Open' : 'Locked',
        opened_at: tpl.step_number === 1 ? new Date() : null,
      });
      const [tplItems] = await conn.query('SELECT * FROM offboarding_step_template_items WHERE template_step_id = ? ORDER BY sort_order', [tpl.id]);
      for (const item of tplItems) {
        await conn.query('INSERT INTO offboarding_checklist_items SET ?', { step_id: stepRes.insertId, label: item.label, sort_order: item.sort_order });
      }
    }

    await conn.commit();
    await addAudit(pool, req.user, 'Offboarding', 'Initiated', `Offboarding for ${emp.first_name} ${emp.last_name}`);
    res.status(201).json({ id: result.insertId, eosb_amount: eosbAmount, eosb_breakdown: eosb });
  } catch (err) { await conn.rollback(); console.error('POST /offboarding error:', err); res.status(500).json({ error: 'Internal server error' }); }
  finally { conn.release(); }
});

// PUT /api/offboarding/steps/:stepId/complete (scoped)
router.put('/steps/:stepId/complete', authorize('admin', 'hr_manager'), async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const owner = await offboardingStepCompany(req.params.stepId);
    if (!canActOnCompany(req, owner)) return res.status(404).json({ error: 'Step not found' });
    await conn.beginTransaction();
    const [[step]] = await conn.query('SELECT * FROM offboarding_steps WHERE id = ?', [req.params.stepId]);
    if (!step) { await conn.rollback(); return res.status(404).json({ error: 'Step not found' }); }

    await conn.query('UPDATE offboarding_steps SET status = ?, completed_at = ? WHERE id = ?', ['Complete', new Date(), step.id]);

    const [[nextStep]] = await conn.query('SELECT * FROM offboarding_steps WHERE offboarding_id = ? AND step_number = ? AND status = ?',
      [step.offboarding_id, step.step_number + 1, 'Locked']);
    if (nextStep) await conn.query('UPDATE offboarding_steps SET status = ?, opened_at = ? WHERE id = ?', ['Open', new Date(), nextStep.id]);

    const [[remaining]] = await conn.query('SELECT COUNT(*) as cnt FROM offboarding_steps WHERE offboarding_id = ? AND status != ?', [step.offboarding_id, 'Complete']);
    if (remaining.cnt === 0) {
      await conn.query('UPDATE offboarding_records SET status = ?, completed_at = ? WHERE id = ?', ['Completed', new Date(), step.offboarding_id]);
      const [[ob]] = await conn.query('SELECT employee_id FROM offboarding_records WHERE id = ?', [step.offboarding_id]);
      if (ob) await conn.query('UPDATE employees SET status = ?, end_date = ? WHERE id = ?', ['Exited', new Date(), ob.employee_id]);
    }

    await conn.commit();
    res.json({ success: true });
  } catch (err) { await conn.rollback(); console.error(err); res.status(500).json({ error: 'Internal server error' }); }
  finally { conn.release(); }
});

// PUT /api/offboarding/checklist/:itemId (authz + scoped)
router.put('/checklist/:itemId', authorize('admin', 'hr_manager', 'hr_specialist'), async (req, res) => {
  try {
    const owner = await offboardingChecklistCompany(req.params.itemId);
    if (!canActOnCompany(req, owner)) return res.status(404).json({ error: 'Checklist item not found' });
    await pool.query('UPDATE offboarding_checklist_items SET is_checked = ?, checked_at = ? WHERE id = ?',
      [req.body.is_checked, req.body.is_checked ? new Date() : null, req.params.itemId]);
    res.json({ success: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
});

// POST /api/offboarding/:id/generate-email — AI email template generation (authz + scoped)
router.post('/:id/generate-email', authorize('admin', 'hr_manager'), async (req, res) => {
  try {
    const { template_type } = req.body; // exit_confirmation, clearance, reference, farewell
    const co = companyClause(req, 'ob.company_id');
    const [[ob]] = await pool.query(
      `SELECT ob.*, e.first_name, e.last_name, e.email, c.name as company_name
       FROM offboarding_records ob JOIN employees e ON ob.employee_id = e.id
       LEFT JOIN companies c ON ob.company_id = c.id WHERE ob.id = ?` + co.clause, [req.params.id, ...co.params]
    );
    if (!ob) return res.status(404).json({ error: 'Not found' });

    // Try AI generation
    try {
      const { default: axios } = await import('axios');
      const client = axios.create({
        baseURL: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com',
        headers: { 'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`, 'Content-Type': 'application/json' },
        timeout: 30000,
      });
      const templates = {
        exit_confirmation: `Write an exit confirmation email for ${ob.first_name} ${ob.last_name} leaving ${ob.company_name}. Last working day: ${ob.last_working_day}. Departure type: ${ob.departure_type}. Professional and warm tone.`,
        clearance: `Write a clearance completion email for ${ob.first_name} ${ob.last_name} from ${ob.company_name}. Include congratulations on clearance completion and final settlement details.`,
        reference: `Write a brief reference confirmation email for ${ob.first_name} ${ob.last_name} who worked at ${ob.company_name}. Professional tone.`,
        farewell: `Write a farewell email from HR on behalf of ${ob.company_name} for ${ob.first_name} ${ob.last_name}. Last working day: ${ob.last_working_day}. Warm and professional.`,
      };
      const { data } = await client.post('/chat/completions', {
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: 'You are a professional HR email writer. Write concise, well-formatted emails.' },
          { role: 'user', content: templates[template_type] || templates.exit_confirmation },
        ],
        temperature: 0.4, max_tokens: 1000,
      });
      res.json({ email: data.choices[0].message.content, template_type });
    } catch {
      // Fallback templates
      const fallbacks = {
        exit_confirmation: `Dear ${ob.first_name},\n\nThis email confirms your departure from ${ob.company_name}. Your last working day is ${ob.last_working_day}.\n\nPlease ensure all handover tasks are completed before your departure date. HR will process your final settlement within the legally mandated timeframe.\n\nWe wish you all the best in your future endeavors.\n\nBest regards,\nHR Department\n${ob.company_name}`,
        clearance: `Dear ${ob.first_name},\n\nWe are pleased to confirm that your clearance process at ${ob.company_name} has been completed successfully.\n\nYour final settlement will be processed shortly. Please contact HR if you have any questions.\n\nBest regards,\nHR Department`,
        reference: `To Whom It May Concern,\n\nThis is to confirm that ${ob.first_name} ${ob.last_name} was employed at ${ob.company_name}.\n\nFor any further inquiries, please contact our HR department.\n\nBest regards,\nHR Department\n${ob.company_name}`,
        farewell: `Dear Team,\n\nWe would like to inform you that ${ob.first_name} ${ob.last_name} will be leaving ${ob.company_name}. Their last working day is ${ob.last_working_day}.\n\nPlease join us in wishing them all the best.\n\nBest regards,\nHR Department`,
      };
      res.json({ email: fallbacks[template_type] || fallbacks.exit_confirmation, template_type, fallback: true });
    }
  } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
});

export default router;
