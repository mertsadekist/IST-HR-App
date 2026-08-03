import { Router } from 'express';
import pool from '../config/db.js';
import { auth } from '../middleware/auth.js';
import { authorize } from '../middleware/rbac.js';
import { addAudit } from '../services/auditService.js';
import { tenantScope, companyClause } from '../middleware/tenant.js';
import { validate } from '../middleware/validate.js';
import { computePayrollItem } from '../services/payrollService.js';
import { buildWpsWorkbook, wpsReadiness } from '../services/wpsService.js';
import { notifyRole } from '../services/notificationService.js';

const router = Router();
router.use(auth, tenantScope);

const isHR = (req) => ['admin', 'hr_manager'].includes(req.user.role);
async function myEmployeeId(userId) {
  const [[u]] = await pool.query('SELECT employee_id FROM users WHERE id = ?', [userId]);
  return u?.employee_id || null;
}

// ─── Runs ────────────────────────────────────────────────────────────────────
router.get('/runs', authorize('admin', 'hr_manager'), async (req, res) => {
  try {
    const co = companyClause(req, 'company_id');
    const [rows] = await pool.query(
      'SELECT * FROM payroll_runs WHERE 1=1' + co.clause + ' ORDER BY period DESC', co.params);
    res.json(rows);
  } catch (err) { console.error('GET /payroll/runs error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

router.get('/runs/:id', authorize('admin', 'hr_manager'), async (req, res) => {
  try {
    const co = companyClause(req, 'company_id');
    const [[run]] = await pool.query('SELECT * FROM payroll_runs WHERE id = ?' + co.clause, [req.params.id, ...co.params]);
    if (!run) return res.status(404).json({ error: 'Payroll run not found' });
    const [items] = await pool.query(
      `SELECT pi.*, e.first_name, e.last_name FROM payroll_items pi
       JOIN employees e ON pi.employee_id = e.id WHERE pi.run_id = ? ORDER BY e.first_name`, [run.id]);
    res.json({ ...run, items });
  } catch (err) { console.error('GET /payroll/runs/:id error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

// Generate a payroll run for a period, pulling unpaid-leave and absence deductions.
router.post('/runs/generate', authorize('admin', 'hr_manager'), validate({
  period: { required: true, type: 'string', pattern: /^\d{4}-\d{2}$/ },
}), async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { period } = req.body;
    const companyId = req.companyId;
    if (companyId == null) return res.status(400).json({ error: 'A specific company is required to generate payroll' });

    // One run per company+period; regenerate only allowed while Draft.
    const [[existing]] = await conn.query('SELECT id, status FROM payroll_runs WHERE company_id = ? AND period = ?', [companyId, period]);
    if (existing && existing.status !== 'Draft') {
      conn.release();
      return res.status(409).json({ error: `A ${existing.status} payroll run already exists for ${period}` });
    }

    await conn.beginTransaction();

    let runId;
    if (existing) {
      runId = existing.id;
      await conn.query('DELETE FROM payroll_items WHERE run_id = ?', [runId]);
    } else {
      const [r] = await conn.query('INSERT INTO payroll_runs SET ?', { company_id: companyId, period, status: 'Draft', created_by: req.user.id });
      runId = r.insertId;
    }

    // Active employees in this company
    const [employees] = await conn.query(
      "SELECT id, first_name, last_name, basic_salary, full_salary FROM employees WHERE company_id = ? AND status IN ('Active','Onboarding','Offboarding')",
      [companyId]
    );

    let totalGross = 0, totalDeductions = 0, totalNet = 0;
    for (const emp of employees) {
      // Approved unpaid-leave days whose start falls in the period
      const [[ul]] = await conn.query(
        `SELECT COALESCE(SUM(lr.days),0) days FROM leave_requests lr
         JOIN leave_types lt ON lr.leave_type_id = lt.id
         WHERE lr.employee_id = ? AND lr.status = 'Approved' AND lt.is_paid = 0
           AND DATE_FORMAT(lr.start_date, '%Y-%m') = ?`, [emp.id, period]);
      // Unauthorized absence days from attendance
      const [[ab]] = await conn.query(
        `SELECT COUNT(*) days FROM attendance
         WHERE employee_id = ? AND status = 'Absent' AND DATE_FORMAT(work_date, '%Y-%m') = ?`, [emp.id, period]);

      const calc = computePayrollItem({
        basicSalary: emp.basic_salary,
        fullSalary: emp.full_salary,
        unpaidLeaveDays: Number(ul.days) || 0,
        absenceDays: Number(ab.days) || 0,
      });

      await conn.query('INSERT INTO payroll_items SET ?', {
        run_id: runId, company_id: companyId, employee_id: emp.id,
        basic_salary: calc.basic_salary, allowances: calc.allowances, gross: calc.gross,
        unpaid_leave_days: calc.unpaid_leave_days, absence_days: calc.absence_days,
        deductions: calc.deductions, net: calc.net,
      });
      totalGross += calc.gross; totalDeductions += calc.deductions; totalNet += calc.net;
    }

    await conn.query(
      'UPDATE payroll_runs SET employee_count = ?, total_gross = ?, total_deductions = ?, total_net = ?, status = ? WHERE id = ?',
      [employees.length, totalGross, totalDeductions, totalNet, 'Draft', runId]
    );
    await conn.commit();
    await addAudit(pool, req.user, 'Payroll', 'Generated', `Payroll run ${period}: ${employees.length} employee(s), net ${totalNet.toFixed(2)}`);
    res.status(201).json({ id: runId, period, employee_count: employees.length, total_gross: totalGross, total_deductions: totalDeductions, total_net: totalNet });
  } catch (err) {
    await conn.rollback();
    console.error('POST /payroll/runs/generate error:', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally { conn.release(); }
});

router.put('/runs/:id/approve', authorize('admin', 'hr_manager'), async (req, res) => {
  try {
    const co = companyClause(req, 'company_id');
    const [[run]] = await pool.query('SELECT status FROM payroll_runs WHERE id = ?' + co.clause, [req.params.id, ...co.params]);
    if (!run) return res.status(404).json({ error: 'Payroll run not found' });
    if (run.status !== 'Draft') return res.status(409).json({ error: `Run is already ${run.status}` });
    await pool.query('UPDATE payroll_runs SET status = ?, approved_by = ?, approved_at = NOW() WHERE id = ?', ['Approved', req.user.id, req.params.id]);
    await addAudit(pool, req.user, 'Payroll', 'Approved', `Payroll run #${req.params.id} approved`);
    if (req.companyId != null) {
      await notifyRole(pool, req.companyId, ['admin'], { type: 'payroll', title: 'Payroll approved', body: `Payroll run #${req.params.id} approved and ready to mark paid`, link: '/payroll' }, req.user.id);
    }
    res.json({ success: true });
  } catch (err) { console.error('PUT /payroll/runs/:id/approve error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

router.put('/runs/:id/mark-paid', authorize('admin'), async (req, res) => {
  try {
    const co = companyClause(req, 'company_id');
    const [[run]] = await pool.query('SELECT status FROM payroll_runs WHERE id = ?' + co.clause, [req.params.id, ...co.params]);
    if (!run) return res.status(404).json({ error: 'Payroll run not found' });
    if (run.status !== 'Approved') return res.status(409).json({ error: 'Only an approved run can be marked paid' });
    await pool.query("UPDATE payroll_runs SET status = 'Paid', paid_at = NOW() WHERE id = ?", [req.params.id]);
    await addAudit(pool, req.user, 'Payroll', 'Paid', `Payroll run #${req.params.id} marked paid`);
    res.json({ success: true });
  } catch (err) { console.error('PUT /payroll/runs/:id/mark-paid error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

router.delete('/runs/:id', authorize('admin'), async (req, res) => {
  try {
    const co = companyClause(req, 'company_id');
    const [[run]] = await pool.query('SELECT status FROM payroll_runs WHERE id = ?' + co.clause, [req.params.id, ...co.params]);
    if (!run) return res.status(404).json({ error: 'Payroll run not found' });
    if (run.status !== 'Draft') return res.status(409).json({ error: 'Only a draft run can be deleted' });
    await pool.query('DELETE FROM payroll_runs WHERE id = ?', [req.params.id]);
    await addAudit(pool, req.user, 'Payroll', 'Deleted', `Draft payroll run #${req.params.id} deleted`);
    res.json({ success: true });
  } catch (err) { console.error('DELETE /payroll/runs/:id error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

// ─── WPS (UAE Wage Protection System) ────────────────────────────────────────
// Loads everything the MOL salary file needs for one run: the paying company's
// establishment details and, per employee, the identifiers + bank destination.
async function loadWpsData(req, runId) {
  const co = companyClause(req, 'company_id');
  const [[run]] = await pool.query(
    'SELECT * FROM payroll_runs WHERE id = ?' + co.clause, [runId, ...co.params]);
  if (!run) return null;

  const [[company]] = await pool.query(
    `SELECT id, name, email, phone, mol_id, wps_contact_person, wps_contact_mobile,
            wps_contact_phone, wps_contact_fax, wps_contact_email
       FROM companies WHERE id = ?`, [run.company_id]);

  const [items] = await pool.query(
    `SELECT pi.employee_id, pi.gross, pi.net, pi.absence_days, pi.unpaid_leave_days,
            e.first_name, e.last_name, e.work_permit_no, e.personal_no,
            e.labour_contract_status,
            b.bank_name, b.iban, b.verified AS bank_verified
       FROM payroll_items pi
       JOIN employees e ON pi.employee_id = e.id
       LEFT JOIN employee_bank_details b ON b.employee_id = e.id
      WHERE pi.run_id = ?
      ORDER BY e.first_name, e.last_name`, [run.id]);

  return { run, company, items };
}

// What is still missing before the file can legitimately be submitted.
router.get('/runs/:id/wps-readiness', authorize('admin', 'hr_manager'), async (req, res) => {
  try {
    const data = await loadWpsData(req, req.params.id);
    if (!data) return res.status(404).json({ error: 'Payroll run not found' });
    const report = wpsReadiness(data);
    res.json({
      ...report,
      period: data.run.period,
      company_name: data.company?.name || '',
      mol_id: data.company?.mol_id || '',
      // Run figures, so the difference against the file's own total is visible
      // when someone is held back for a missing labour contract.
      employee_count: data.items.length,
      total_net: data.items.reduce((s, i) => s + Number(i.net || 0), 0),
      unverified_bank: data.items
        .filter((i) => i.labour_contract_status === 'Issued' && i.iban && !i.bank_verified)
        .map((i) => `${i.first_name} ${i.last_name}`.trim()),
    });
  } catch (err) { console.error('GET /payroll/runs/:id/wps-readiness error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

// The submittable .xlsx. Blocked while mandatory identifiers are missing unless
// the caller explicitly asks for a draft (?force=1) to review the layout.
router.get('/runs/:id/wps-export', authorize('admin', 'hr_manager'), async (req, res) => {
  try {
    const data = await loadWpsData(req, req.params.id);
    if (!data) return res.status(404).json({ error: 'Payroll run not found' });
    if (!data.items.length) return res.status(409).json({ error: 'This payroll run has no employees' });

    const report = wpsReadiness(data);
    const force = req.query.force === '1' || req.query.force === 'true';
    if (!report.included_count) {
      return res.status(409).json({
        error: 'No employee in this run has an issued labour contract, so the WPS file would be empty',
        ...report,
      });
    }
    if (!report.ready && !force) {
      return res.status(422).json({ error: 'WPS data is incomplete', ...report });
    }

    const { buffer, grandTotal, count, excluded } = buildWpsWorkbook({
      company: data.company, period: data.run.period, items: data.items,
    });
    const fileName = `WPS-${(data.company?.name || 'company').replace(/[^\w-]+/g, '_')}-${data.run.period}${force && !report.ready ? '-DRAFT' : ''}.xlsx`;
    // The excluded count goes in the audit trail: the file total will not match
    // the payroll run total, and that difference must be explainable later.
    await addAudit(pool, req.user, 'Payroll', 'WPS Export',
      `WPS file generated for run #${data.run.id} (${data.run.period}): ${count} employee(s), total AED ${grandTotal.toFixed(2)}`
      + (excluded.length ? `; ${excluded.length} excluded — labour contract not issued: ${excluded.map((e) => e.name).join(', ')}` : '')
      + (report.ready ? '' : ' — INCOMPLETE DRAFT'));

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(buffer);
  } catch (err) { console.error('GET /payroll/runs/:id/wps-export error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

// ─── Payslips ────────────────────────────────────────────────────────────────
// Employee's own payslips (only from approved/paid runs)
router.get('/payslips/my', async (req, res) => {
  try {
    const empId = await myEmployeeId(req.user.id);
    if (!empId) return res.json([]);
    const co = companyClause(req, 'pi.company_id');
    let sql = `SELECT pi.*, pr.period, pr.status as run_status
               FROM payroll_items pi JOIN payroll_runs pr ON pi.run_id = pr.id
               WHERE pi.employee_id = ? AND pr.status IN ('Approved','Paid')` + co.clause;
    const params = [empId, ...co.params];
    if (req.query.period) { sql += ' AND pr.period = ?'; params.push(req.query.period); }
    sql += ' ORDER BY pr.period DESC';
    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) { console.error('GET /payroll/payslips/my error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

// HR: an employee's payslips
router.get('/payslips/:employeeId', authorize('admin', 'hr_manager'), async (req, res) => {
  try {
    const co = companyClause(req, 'pi.company_id');
    const [rows] = await pool.query(
      `SELECT pi.*, pr.period, pr.status as run_status
       FROM payroll_items pi JOIN payroll_runs pr ON pi.run_id = pr.id
       WHERE pi.employee_id = ?` + co.clause + ' ORDER BY pr.period DESC',
      [req.params.employeeId, ...co.params]);
    res.json(rows);
  } catch (err) { console.error('GET /payroll/payslips/:employeeId error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

export default router;
