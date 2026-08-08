/**
 * Company-document expiry warnings.
 *
 * A trade licence, a lease, an insurance policy or an establishment card lapsing
 * is an operational stop, and the only warning is a date on a PDF nobody opens
 * until it is needed. This watches those dates and warns the people who renew
 * them.
 *
 * Wider thresholds than domains on purpose: a domain renews with a card in
 * minutes, a trade licence needs paperwork, approvals and queueing, so 90 days
 * of notice is the useful starting point rather than 30.
 *
 * Notifies once per threshold, never once per pass — see expiryAlerts.js.
 */
import { notifyRole } from './notificationService.js';
import { thresholdFor as bucketFor, alreadyAlerted } from './expiryAlerts.js';

export const DOC_EXPIRY_THRESHOLDS = [90, 60, 30, 14, 7, 1];

export const thresholdFor = (daysLeft) => bucketFor(daysLeft, DOC_EXPIRY_THRESHOLDS);
export { alreadyAlerted };

/**
 * A document's own reminder window overrides the defaults when set — a licence
 * that takes four months to renew is not served by a 90-day warning.
 */
export function thresholdsFor(reminderDays) {
  if (!reminderDays) return DOC_EXPIRY_THRESHOLDS;
  const extra = Number(reminderDays);
  if (!Number.isFinite(extra) || extra <= 0) return DOC_EXPIRY_THRESHOLDS;
  return [...new Set([extra, ...DOC_EXPIRY_THRESHOLDS])].sort((a, b) => b - a);
}

/**
 * @returns {Promise<number>} how many alerts were sent
 */
export async function checkDocumentExpiry(pool) {
  const [rows] = await pool.query(
    `SELECT d.id, d.company_id, d.category, d.reminder_days, d.expiry_alert_sent,
            COALESCE(d.document_name, d.file_name) AS label,
            DATE_FORMAT(d.expiry_date, '%Y-%m-%d') AS expiry_date,
            DATEDIFF(d.expiry_date, CURDATE())     AS days_left,
            c.name AS company_name
       FROM company_documents d
       LEFT JOIN companies c ON d.company_id = c.id
      WHERE d.expiry_mode = 'Has Expiry' AND d.expiry_date IS NOT NULL
      ORDER BY d.expiry_date`);

  let sent = 0;
  for (const doc of rows) {
    const threshold = bucketFor(doc.days_left, thresholdsFor(doc.reminder_days));
    if (!threshold) continue;
    if (alreadyAlerted(doc.expiry_alert_sent, threshold)) continue;

    const expired = threshold === 'expired';
    const title = expired
      ? `Document expired: ${doc.label}`
      : `Document expires in ${doc.days_left} day${doc.days_left === 1 ? '' : 's'}: ${doc.label}`;
    const body = [
      doc.category ? `Category: ${doc.category}` : null,
      doc.company_name ? `Company: ${doc.company_name}` : null,
      `Expiry: ${doc.expiry_date}`,
      expired ? 'This document is no longer valid — renew it and upload the replacement.' : 'Start the renewal before it lapses.',
    ].filter(Boolean).join(' · ');

    await notifyRole(pool, doc.company_id, ['admin', 'hr_manager', 'accountant'], {
      type: expired ? 'error' : 'warning', title, body, link: '/company-docs',
    });
    await pool.query('UPDATE company_documents SET expiry_alert_sent = ? WHERE id = ?', [threshold, doc.id]);
    sent++;
  }
  return sent;
}

/** How a document reads on screen: the state, and how urgent it is. */
export function expiryStatus(doc) {
  if (doc.expiry_mode === 'No Expiry') return { state: 'no_expiry', days: null };
  if (doc.expiry_mode !== 'Has Expiry' || !doc.expiry_date) return { state: 'not_set', days: null };
  const days = doc.days_to_expiry;
  if (days == null) return { state: 'not_set', days: null };
  if (days < 0) return { state: 'expired', days };
  if (days <= 30) return { state: 'critical', days };
  if (days <= 90) return { state: 'soon', days };
  return { state: 'valid', days };
}
