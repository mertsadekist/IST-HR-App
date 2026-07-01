import pool from '../config/db.js';
import { addAudit } from './auditService.js';
import { notify, notifyRole, userIdForEmployee } from './notificationService.js';
import { sendTemplateEmail } from './emailService.js';

// The default UAE labor-law actions seeded on every salary review item. HR can
// also add ad-hoc 'custom' rows per employee via POST /items/:itemId/actions.
export const DEFAULT_ACTIONS = [
  { action_key: 'contract_amendment', label: 'Sign supplementary employment-contract addendum' },
  { action_key: 'mohre_update', label: 'Update the MOHRE unified labor contract salary' },
  { action_key: 'wps_update', label: 'Update the WPS salary registration' },
];

/** Seed the 3 default compliance actions for a newly-created salary_review_item. */
export async function seedDefaultActions(conn, itemId) {
  let sort = 1;
  for (const a of DEFAULT_ACTIONS) {
    await conn.query('INSERT INTO salary_review_actions SET ?', {
      salary_review_item_id: itemId, action_key: a.action_key, is_required: true, sort_order: sort++,
    });
  }
}

/**
 * Notify every admin who can act on a company — both company-bound admins and
 * platform admins (company_id IS NULL) — used as the fallback approver audience
 * when a company has no designated salary_review_approver_id. (notifyRole()
 * filters strictly by company_id and would miss platform admins.)
 */
export async function notifyCompanyAdmins(pool, companyId, payload, excludeUserId = null) {
  try {
    const [rows] = await pool.query(
      "SELECT id FROM users WHERE is_active = TRUE AND role = 'admin' AND (company_id = ? OR company_id IS NULL)",
      [companyId]
    );
    const ids = rows.map((r) => r.id).filter((id) => id !== excludeUserId);
    for (const id of ids) await notify(pool, { ...payload, userId: id, companyId });
  } catch (err) {
    console.error('notifyCompanyAdmins error:', err.message);
  }
}

/**
 * The salary-band "envelope" for a job title — the min/max across all of its
 * seniority levels — used to flag a proposed salary that falls outside it.
 * Returns { band_min, band_max } (both null if the job title has no bands defined).
 */
export async function matchSalaryBand(pool, jobTitleId) {
  if (!jobTitleId) return { band_min: null, band_max: null };
  const [[row]] = await pool.query(
    'SELECT MIN(salary_min) AS band_min, MAX(salary_max) AS band_max FROM job_title_seniorities WHERE job_title_id = ?',
    [jobTitleId]
  );
  return { band_min: row?.band_min ?? null, band_max: row?.band_max ?? null };
}

/**
 * Finds salary_review_items that are Approved, past their effective_date, and not
 * yet applied — pushes the new salary into the employee record, marks the item
 * Applied, completes the parent cycle once every item is done, and notifies the
 * employee (+ CC HR). Called once at boot and on an interval from server.js.
 *
 * Assumes a single server instance (current Coolify deployment). A second replica
 * running this concurrently is a low-risk, self-correcting race: the
 * `applied_at IS NULL` gate makes a duplicate application a no-op.
 */
export async function applyDueSalaryChanges(pool) {
  const [due] = await pool.query(
    `SELECT sri.*, e.first_name, e.last_name, e.email, c.name AS company_name
     FROM salary_review_items sri
     JOIN employees e ON sri.employee_id = e.id
     JOIN companies c ON sri.company_id = c.id
     WHERE sri.status = 'Approved' AND sri.effective_date <= CURDATE() AND sri.applied_at IS NULL`
  );

  for (const item of due) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query('UPDATE employees SET basic_salary = ?, full_salary = ? WHERE id = ?', [
        item.new_basic_salary, item.new_full_salary, item.employee_id,
      ]);
      await conn.query('UPDATE salary_review_items SET status = ?, applied_at = NOW() WHERE id = ?', ['Applied', item.id]);

      // Complete the parent cycle once every non-skipped item has been applied.
      const [[remaining]] = await conn.query(
        "SELECT COUNT(*) c FROM salary_review_items WHERE salary_review_id = ? AND status = 'Approved'",
        [item.salary_review_id]
      );
      if (remaining.c === 0) {
        await conn.query("UPDATE salary_reviews SET status = 'Completed' WHERE id = ? AND status = 'Approved'", [item.salary_review_id]);
      }
      await conn.commit();
    } catch (err) {
      await conn.rollback();
      console.error(`applyDueSalaryChanges: failed to apply item #${item.id}:`, err.message);
      continue;
    } finally {
      conn.release();
    }

    await addAudit(pool, { id: null, name: 'System' }, 'Salary Review',
      'Applied', `Salary for ${item.first_name} ${item.last_name} updated: ${item.current_full_salary ?? '—'} → ${item.new_full_salary} (effective ${item.effective_date})`,
      item.company_id);

    const employeeUserId = await userIdForEmployee(pool, item.employee_id);
    if (employeeUserId) {
      await notify(pool, {
        userId: employeeUserId, companyId: item.company_id, type: 'salary_review',
        title: 'Your salary has been updated',
        body: `Your new salary is effective ${item.effective_date}.`,
        link: '/portal/my-assets',
      });
    }
    await notifyRole(pool, item.company_id, ['admin', 'hr_manager'], {
      type: 'salary_review', title: `Salary raise applied — ${item.first_name} ${item.last_name}`,
      body: `Effective ${item.effective_date}.`, link: '/salary-reviews',
    });
    if (item.email) {
      await sendTemplateEmail({
        templateType: 'salary_increase_effective',
        data: {
          name: `${item.first_name} ${item.last_name}`, company: item.company_name,
          new_basic_salary: item.new_basic_salary, new_full_salary: item.new_full_salary,
          effective_date: item.effective_date,
        },
        to: item.email, toName: `${item.first_name} ${item.last_name}`,
        companyId: item.company_id, relatedModule: 'SalaryReview', relatedId: item.salary_review_id,
      });
    }
  }
  return due.length;
}
