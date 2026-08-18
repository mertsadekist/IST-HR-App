import { Router } from 'express';
import pool from '../config/db.js';
import { auth } from '../middleware/auth.js';
import { authorize } from '../middleware/rbac.js';
import { addAudit } from '../services/auditService.js';
import { tenantScope, companyClause, ownRecordsClause } from '../middleware/tenant.js';
import { validate } from '../middleware/validate.js';
import { computePayrollItem } from '../services/payrollService.js';
import {
  loadLeavePolicy, leaveDeductionForPeriod, annualEntitlement,
} from '../services/leavePolicyService.js';
import { buildPayrollExplanation } from '../services/payrollExplainerService.js';
import { renderPayrollExplanationWorkbook } from '../services/payrollExplainerWorkbook.js';
import { buildWpsWorkbook, wpsReadiness } from '../services/wpsService.js';
import { notifyRole } from '../services/notificationService.js';
import { sendEmail } from '../services/emailService.js';
import { getTemplate } from '../services/emailTemplates.js';

const router = Router();
router.use(auth, tenantScope);

async function myEmployeeId(userId) {
  const [[u]] = await pool.query('SELECT employee_id FROM users WHERE id = ?', [userId]);
  return u?.employee_id || null;
}

// ─── Runs ────────────────────────────────────────────────────────────────────
router.get('/runs', authorize('admin', 'hr_manager', 'accountant'), async (req, res) => {
  try {
    const co = companyClause(req, 'company_id');
    const [rows] = await pool.query(
      'SELECT * FROM payroll_runs WHERE 1=1' + co.clause + ' ORDER BY period DESC', co.params);
    res.json(rows);
  } catch (err) { console.error('GET /payroll/runs error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

router.get('/runs/:id', authorize('admin', 'hr_manager', 'accountant'), async (req, res) => {
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
router.post('/runs/generate', authorize('admin', 'hr_manager', 'accountant'), validate({
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

    // Employees on the monthly payroll. Offboarding and Exited staff are
    // excluded: once offboarding starts they are handled through the final
    // settlement, and leaving them here paid a full month to people who had
    // already left. Their earned final period is a settlement matter, not a
    // monthly-payroll one — see the note in offboarding.
    const [employees] = await conn.query(
      "SELECT id, first_name, last_name, basic_salary, full_salary, "
      + "DATE_FORMAT(start_date, '%Y-%m-%d') start_date "
      + "FROM employees WHERE company_id = ? AND status IN ('Active','Onboarding')",
      [companyId]
    );

    // `period` is validated as YYYY-MM by the route, so these are always real.
    const periodStart = `${period}-01`;
    const year = Number(period.slice(0, 4));
    const [[{ last_day: periodEndDate }]] = await conn.query(
      "SELECT DATE_FORMAT(LAST_DAY(?), '%Y-%m-%d') last_day", [periodStart]);

    // The pay tiers, the pools types draw on, and the yearly caps — loaded once
    // for the whole run rather than per employee.
    const policy = await loadLeavePolicy(conn);

    let totalGross = 0, totalDeductions = 0, totalNet = 0;
    for (const emp of employees) {
      // What leave costs this period, under the company policy.
      //
      // Not a count of "unpaid" days any more, because a day is no longer simply
      // paid or unpaid: sick leave is fifteen days at full pay, thirty at half
      // and forty-five at nothing, so the rate depends on how much of the year's
      // sick leave has already gone. leaveDeductionForPeriod walks the year in
      // date order and returns the days' worth actually withheld — a half-pay day
      // contributing half a day, not one and not none.
      //
      // The whole leave year is fetched, not just this month, for that reason:
      // "the first fifteen days" is a statement about sequence, and a request
      // straddling a month end has to carry its counter across.
      const [yearLeave] = await conn.query(
        `SELECT lr.leave_type_id, lr.days,
                DATE_FORMAT(lr.start_date, '%Y-%m-%d') start_date,
                DATE_FORMAT(lr.end_date,   '%Y-%m-%d') end_date
           FROM leave_requests lr
          WHERE lr.employee_id = ? AND lr.status = 'Approved'
            AND lr.end_date >= ? AND lr.start_date <= ?
          ORDER BY lr.start_date`,
        [emp.id, `${year}-01-01`, `${year}-12-31`]);

      const capByType = new Map(policy.capByType);
      // Annual leave is capped by service, so the cap differs per employee.
      //
      // With no start date on the record there is no service to measure, and the
      // policy's full allowance is used rather than nothing. Withholding pay
      // because a date is missing from an HR record is the wrong direction to
      // fail in — a long-serving employee whose start date was never entered
      // would otherwise lose their whole annual entitlement silently.
      if (policy.annualTypeId) {
        capByType.set(policy.annualTypeId, emp.start_date
          ? annualEntitlement(emp.start_date, periodEndDate)
          : policy.defaultDaysByType.get(policy.annualTypeId) ?? null);
      }
      const leaveCost = leaveDeductionForPeriod({
        requests: yearLeave,
        tiersByType: policy.tiersByType,
        poolByType: policy.poolByType,
        capByType,
        periodStart,
        periodEnd: periodEndDate,
      });
      const ul = { days: leaveCost.deduction_days };

      // Absence days that are NOT already accounted for by approved leave.
      //
      // The two figures were computed independently and neither excluded the
      // other, so a day that was both an 'Absent' attendance row and inside an
      // approved unpaid leave was deducted twice — once here and once above.
      //
      // The exclusion is on ANY approved leave, not only unpaid, which closes a
      // second hole: a day of approved PAID leave that carried an 'Absent' row
      // was being deducted, and a paid day must never be.
      //
      // And not on a day the employee's schedule says they do not work. The
      // fingerprint device emits a row for every registered ID every day and
      // reports "no punches" on people's rest days, which the importer stored as
      // an absence; six people were deducted a full day for a Saturday none of
      // them work. The importer no longer creates those rows, but the ones already
      // written must stop costing money, so the schedule is consulted here too.
      //
      // COALESCE(..., TRUE): no schedule resolved is not evidence of a rest day,
      // so the absence still counts. Failing the other way would quietly stop
      // deducting for anyone whose schedule was never set up.
      const [[ab]] = await conn.query(
        `SELECT COUNT(*) days FROM attendance a
          WHERE a.employee_id = ? AND a.status = 'Absent'
            AND DATE_FORMAT(a.work_date, '%Y-%m') = ?
            AND NOT EXISTS (
              SELECT 1 FROM leave_requests lr
               WHERE lr.employee_id = a.employee_id AND lr.status = 'Approved'
                 AND a.work_date BETWEEN lr.start_date AND lr.end_date)
            AND COALESCE((
              SELECT wsd.is_working
                FROM employee_work_schedules ews
                JOIN work_schedule_days wsd
                  ON wsd.schedule_id = ews.schedule_id
                 AND wsd.weekday = DAYOFWEEK(a.work_date) - 1
               WHERE ews.employee_id = a.employee_id
                 AND ews.effective_from <= a.work_date
                 AND (ews.effective_to IS NULL OR ews.effective_to >= a.work_date)
               ORDER BY ews.effective_from DESC LIMIT 1
            ), (
              SELECT wsd.is_working
                FROM work_schedules def
                JOIN work_schedule_days wsd
                  ON wsd.schedule_id = def.id
                 AND wsd.weekday = DAYOFWEEK(a.work_date) - 1
               WHERE def.company_id = a.company_id AND def.is_default = TRUE AND def.active = TRUE
               LIMIT 1
            ), TRUE) = TRUE`,
        [emp.id, period]);

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

router.put('/runs/:id/approve', authorize('admin', 'hr_manager', 'accountant'), async (req, res) => {
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

// The accountant is the person who actually moves the money, so they close the
// cycle too. Deleting a run stays admin-only — that is destroying the record of
// a payment, not completing one.
router.put('/runs/:id/mark-paid', authorize('admin', 'accountant'), async (req, res) => {
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

  // Offboarding and Exited staff are filtered here as well as at generation.
  // The file is a transfer instruction to the bank, and an older run generated
  // before that rule existed must not instruct a salary transfer to somebody who
  // has left. They are reported separately so the difference is explainable.
  const [rows] = await pool.query(
    `SELECT pi.employee_id, pi.gross, pi.net, pi.absence_days, pi.unpaid_leave_days,
            e.first_name, e.last_name, e.work_permit_no, e.personal_no,
            e.labour_contract_status, e.status AS employment_status,
            b.bank_name, b.iban, b.verified AS bank_verified
       FROM payroll_items pi
       JOIN employees e ON pi.employee_id = e.id
       LEFT JOIN employee_bank_details b ON b.employee_id = e.id
      WHERE pi.run_id = ?
      ORDER BY e.first_name, e.last_name`, [run.id]);

  const items = rows.filter((r) => !['Offboarding', 'Exited'].includes(r.employment_status));
  const offboarding = rows
    .filter((r) => ['Offboarding', 'Exited'].includes(r.employment_status))
    .map((r) => ({ employee_id: r.employee_id, name: `${r.first_name} ${r.last_name}`.trim(), net: Number(r.net || 0), status: r.employment_status }));

  return { run, company, items, offboarding };
}

// What is still missing before the file can legitimately be submitted.
router.get('/runs/:id/wps-readiness', authorize('admin', 'hr_manager', 'accountant'), async (req, res) => {
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
      // Present in the run but dropped from the file because they are being
      // offboarded. Reported rather than hidden: their earned final period is
      // settled separately, and the file total is lower by these amounts.
      offboarding_excluded: data.offboarding,
    });
  } catch (err) { console.error('GET /payroll/runs/:id/wps-readiness error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

// The salary explanation workbook: for every employee, which days reduced their
// pay, why, at what rate, and the arithmetic behind each one.
//
// Deliberately available on a Draft run. Its whole point is to be read BEFORE the
// run is approved — that is when a wrong deduction can still be fixed — and it is
// also the document HR hands to somebody asking why they were paid less.
router.get('/runs/:id/explanation', authorize('admin', 'hr_manager', 'accountant'), async (req, res) => {
  try {
    // Scoped like every other read of a run: the selected entity narrows it.
    const co = companyClause(req, 'company_id');
    const [[owned]] = await pool.query(
      'SELECT id FROM payroll_runs WHERE id = ?' + co.clause, [req.params.id, ...co.params]);
    if (!owned) return res.status(404).json({ error: 'Payroll run not found' });

    const data = await buildPayrollExplanation(pool, Number(req.params.id));
    if (!data) return res.status(404).json({ error: 'Payroll run not found' });
    if (!data.employees.length) return res.status(409).json({ error: 'This payroll run has no employees' });

    const buffer = await renderPayrollExplanationWorkbook(data);
    const mismatched = data.employees.filter((e) => !e.matches);
    const withDeductions = data.employees.filter((e) => e.lines.length);

    await addAudit(pool, req.user, 'Payroll', 'Explanation Export',
      `Salary explanation generated for run #${data.run.id} (${data.run.period}): `
      + `${data.employees.length} employee(s), ${withDeductions.length} with deductions`
      + (mismatched.length ? `; ${mismatched.length} do not reconcile with the stored figure` : ''));

    const fileName = `Salary-Explanation-${(data.run.company_name || 'company').replace(/[^\w-]+/g, '_')}`
      + `-${data.run.period}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    // Read by the client so it can warn before the file is even opened.
    res.setHeader('X-Reconcile-Mismatches', String(mismatched.length));
    res.setHeader('Access-Control-Expose-Headers', 'X-Reconcile-Mismatches, Content-Disposition');
    res.send(buffer);
  } catch (err) {
    console.error('GET /payroll/runs/:id/explanation error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// The submittable .xlsx. Blocked while mandatory identifiers are missing unless
// the caller explicitly asks for a draft (?force=1) to review the layout.
router.get('/runs/:id/wps-export', authorize('admin', 'hr_manager', 'accountant'), async (req, res) => {
  try {
    const data = await loadWpsData(req, req.params.id);
    if (!data) return res.status(404).json({ error: 'Payroll run not found' });
    if (!data.items.length) {
      return res.status(409).json({
        error: data.offboarding?.length
          ? 'Every employee in this run is being offboarded, so there is nobody to instruct a transfer for. Their final pay goes through the settlement.'
          : 'This payroll run has no employees',
      });
    }

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
      + (data.offboarding?.length ? `; ${data.offboarding.length} excluded — offboarding, settled separately: ${data.offboarding.map((e) => e.name).join(', ')}` : '')
      + (report.ready ? '' : ' — INCOMPLETE DRAFT'));

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(buffer);
  } catch (err) { console.error('GET /payroll/runs/:id/wps-export error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

// POST /api/payroll/runs/:id/wps-send — email the submittable file to the bank
// or the PRO who files it.
//
// The workbook is rebuilt here rather than uploaded from the browser: the
// server already knows how to make it, and a file that made a round trip
// through the client is a file that could have been edited on the way. What is
// sent is exactly what /wps-export would produce.
router.post('/runs/:id/wps-send', authorize('admin', 'hr_manager', 'accountant'), async (req, res) => {
  try {
    const { to, cc, message } = req.body;
    if (!to || !/^\S+@\S+\.\S+$/.test(String(to).trim())) {
      return res.status(422).json({ error: 'A valid recipient email is required' });
    }

    const data = await loadWpsData(req, req.params.id);
    if (!data) return res.status(404).json({ error: 'Payroll run not found' });
    if (!data.items.length) return res.status(409).json({ error: 'This payroll run has no employees' });

    const report = wpsReadiness(data);
    if (!report.included_count) {
      return res.status(409).json({ error: 'No employee in this run has an issued labour contract, so the WPS file would be empty', ...report });
    }
    // An incomplete file must never leave the building by accident. Downloading
    // a draft to inspect the layout is one thing; emailing it to the bank is
    // another, so this needs the same explicit force flag.
    const force = req.body.force === true || req.body.force === '1';
    if (!report.ready && !force) {
      return res.status(422).json({ error: 'WPS data is incomplete', ...report });
    }

    const { buffer, grandTotal, count, excluded } = buildWpsWorkbook({
      company: data.company, period: data.run.period, items: data.items,
    });
    const draft = !report.ready;
    const companyName = data.company?.name || '';
    const fileName = `WPS-${(companyName || 'company').replace(/[^\w-]+/g, '_')}-${data.run.period}${draft ? '-DRAFT' : ''}.xlsx`;
    const title = `WPS salary file — ${companyName} — ${data.run.period}`;

    const summary = [
      `Period: ${data.run.period}`,
      `Employees in the file: ${count}`,
      `Total: AED ${grandTotal.toFixed(2)}`,
      data.company?.mol_id ? `MOL ID: ${data.company.mol_id}` : null,
      excluded.length ? `Excluded (labour contract not issued): ${excluded.map((e) => e.name).join(', ')}` : null,
      data.offboarding?.length ? `Excluded (offboarding, settled separately): ${data.offboarding.map((e) => e.name).join(', ')}` : null,
      draft ? 'WARNING: this file is an INCOMPLETE DRAFT and is not ready for submission.' : null,
    ].filter(Boolean).join('\n');

    const { subject, html } = getTemplate('document_delivery', {
      name: req.body.toName || '',
      title,
      message: [message, summary].filter(Boolean).join('\n\n'),
      company: companyName,
    });

    const result = await sendEmail({
      to: String(to).trim(),
      toName: req.body.toName || '',
      subject, html,
      companyId: data.run.company_id,
      templateType: 'document_delivery',
      relatedModule: 'Payroll',
      relatedId: data.run.id,
      sentBy: req.user.id,
      cc: cc ? (Array.isArray(cc) ? cc : String(cc).split(',').map((s) => s.trim()).filter(Boolean)) : undefined,
      attachments: [{
        filename: fileName,
        content: buffer,
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }],
    });

    if (!result.success) return res.status(502).json({ success: false, error: result.error || 'Send failed' });

    await addAudit(pool, req.user, 'Payroll', 'WPS Sent',
      `WPS file for run #${data.run.id} (${data.run.period}) emailed to ${to}`
      + (cc ? ` (cc ${Array.isArray(cc) ? cc.join(', ') : cc})` : '')
      + `: ${count} employee(s), total AED ${grandTotal.toFixed(2)}`
      + (draft ? ' — INCOMPLETE DRAFT' : ''));

    res.json({ success: true, messageId: result.messageId, file_name: fileName, count, total: grandTotal, draft });
  } catch (err) { console.error('POST /payroll/runs/:id/wps-send error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

// ─── Payslips ────────────────────────────────────────────────────────────────
// Employee's own payslips (only from approved/paid runs)
router.get('/payslips/my', async (req, res) => {
  try {
    const empId = await myEmployeeId(req.user.id);
    if (!empId) return res.json([]);
    // No company filter: this is always the caller's own payslips, and a run
    // processed under another entity is still their pay. See ownRecordsClause().
    const co = ownRecordsClause();
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
router.get('/payslips/:employeeId', authorize('admin', 'hr_manager', 'accountant'), async (req, res) => {
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
