/**
 * Domain and hosting renewal alerts — assets PRD Phase 5.
 *
 * A lapsed domain takes the website, the company email and every social login
 * that depends on it down at once, and it lapses silently: the only warning is a
 * date nobody is looking at. So the system watches `renewal_date` and notifies
 * the people who can act.
 *
 * Notifies once per threshold rather than once per run. `renewal_alert_sent`
 * stores the highest threshold already alerted, so a domain 20 days out gets the
 * 30-day notice and then the 14-day notice — not the same notice every six hours
 * until everyone learns to ignore it.
 *
 * Runs in-process on an interval, matching the salary-review scheduler; see
 * server.js. Assumes a single instance, as that deployment does.
 */
import { notifyRole } from './notificationService.js';
import { thresholdFor as bucketFor, alreadyAlerted } from './expiryAlerts.js';

export const RENEWAL_THRESHOLDS = [30, 14, 7, 1];

/** Which threshold bucket a domain falls into, or null when it is not due yet. */
export const thresholdFor = (daysLeft) => bucketFor(daysLeft, RENEWAL_THRESHOLDS);

export { alreadyAlerted };

/**
 * @returns {Promise<number>} how many alerts were sent
 */
export async function checkDomainRenewals(pool) {
  const maxDays = Math.max(...RENEWAL_THRESHOLDS);
  // A shared domain concerns both companies, so its alert goes to the admins of
  // each — notifying only the entity it happens to be filed under would leave
  // the other side unaware of a renewal they also depend on.
  const [activeCompanies] = await pool.query("SELECT id FROM companies WHERE status = 'Active'");
  const allCompanyIds = activeCompanies.map((c) => c.id);

  const [rows] = await pool.query(
    `SELECT id, company_id, owner_scope, account_or_domain_name, domain_name, registrar_provider,
            billing_owner, auto_renew, renewal_alert_sent,
            DATE_FORMAT(renewal_date, '%Y-%m-%d') AS renewal_date,
            DATEDIFF(renewal_date, CURDATE()) AS days_left
       FROM domain_assets
      WHERE renewal_date IS NOT NULL
        AND account_status IN ('Active', 'Pending')
        AND DATEDIFF(renewal_date, CURDATE()) <= ?
      ORDER BY renewal_date`, [maxDays]);

  let sent = 0;
  for (const d of rows) {
    const threshold = thresholdFor(d.days_left);
    if (!threshold) continue;
    if (alreadyAlerted(d.renewal_alert_sent, threshold)) continue;

    const label = d.domain_name || d.account_or_domain_name;
    const expired = threshold === 'expired';
    const title = expired
      ? `Domain expired: ${label}`
      : `Domain renewal in ${d.days_left} day${d.days_left === 1 ? '' : 's'}: ${label}`;
    const body = [
      d.registrar_provider ? `Registrar: ${d.registrar_provider}` : null,
      `Renewal date: ${d.renewal_date}`,
      d.billing_owner ? `Billing owner: ${d.billing_owner}` : 'No billing owner recorded',
      d.auto_renew ? 'Auto-renew is on — confirm the payment method is still valid.' : 'Auto-renew is OFF.',
    ].filter(Boolean).join(' · ');

    const targets = d.owner_scope === 'GRP' ? allCompanyIds : [d.company_id];
    for (const companyId of targets) {
      await notifyRole(pool, companyId, ['admin', 'hr_manager', 'accountant'], {
        type: expired ? 'error' : 'warning', title, body, link: '/domains',
      });
    }
    await pool.query('UPDATE domain_assets SET renewal_alert_sent = ? WHERE id = ?', [threshold, d.id]);
    sent++;
  }
  return sent;
}
