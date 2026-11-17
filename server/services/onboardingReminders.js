/**
 * Daily chase of onboarding visa and document steps that are past their due
 * date and not done. The person responsible is reminded once a day; steps with
 * nobody responsible are summed up for HR, one message per company.
 */
import { notify, notifyRole } from './notificationService.js';

export async function runOnboardingReminders(pool) {
  const [rows] = await pool.query(
    `SELECT s.id, s.company_id, s.label, s.responsible_user, DATE_FORMAT(s.due_date, '%Y-%m-%d') AS due_date,
            o.id AS onboarding_id,
            COALESCE(NULLIF(p.full_name, ''), TRIM(CONCAT(COALESCE(p.first_name, ''), ' ', COALESCE(p.last_name, '')))) AS person
       FROM onboarding_visa_steps s JOIN onboarding_records o ON o.id = s.onboarding_id
       LEFT JOIN onboarding_profiles p ON p.onboarding_id = o.id
      WHERE s.due_date < CURDATE() AND s.status NOT IN ('Approved','Completed','Rejected')
        AND o.status = 'In Progress'
        AND (s.overdue_notified_on IS NULL OR s.overdue_notified_on < CURDATE())`);
  const unowned = new Map();
  for (const r of rows) {
    const who = r.person || `#${r.onboarding_id}`;
    if (r.responsible_user) {
      await notify(pool, {
        userId: r.responsible_user, companyId: r.company_id, type: 'warning',
        title: `Overdue onboarding step: ${r.label || 'step'} (${who})`, body: `Due ${r.due_date}`, link: '/onboarding',
      });
    } else {
      unowned.set(r.company_id, (unowned.get(r.company_id) || 0) + 1);
    }
    await pool.query('UPDATE onboarding_visa_steps SET overdue_notified_on = CURDATE() WHERE id = ?', [r.id]);
  }
  for (const [companyId, n] of unowned) {
    await notifyRole(pool, companyId, ['admin', 'hr_manager'], {
      type: 'warning', title: `${n} overdue onboarding step(s) with nobody responsible`, body: null, link: '/onboarding',
    });
  }
  return rows.length;
}
