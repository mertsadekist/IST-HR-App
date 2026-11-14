/**
 * Employee-document expiry radar.
 *
 * A lapsed passport, residence visa, Emirates ID or labour card is the
 * company's problem as much as the employee's: MOHRE fines, a WPS line that
 * cannot be paid, a renewal that needs the old document still valid. This
 * watches the dates HR records on employee documents and warns before they
 * pass, with the same once-per-threshold rule as company documents and domains
 * (see expiryAlerts.js).
 *
 * It also answers the second half of the radar: who has no record at all of a
 * document they must hold. An expiry we were never told about is the one that
 * surprises everyone.
 */
import { notifyRole } from './notificationService.js';
import { thresholdFor, alreadyAlerted } from './expiryAlerts.js';
import { DOC_EXPIRY_THRESHOLDS } from './documentExpiryService.js';
import { expiryBeforeIssue } from './softWarnings.js';

export const EMPLOYEE_DOC_TYPES = [
  'Passport', 'Residence Visa', 'Emirates ID', 'Labour Card', 'Health Insurance', 'Other ID',
];

// Employees still on the books. An exited employee's visa lapsing is expected,
// and warning about it would bury the warnings that matter.
export const WATCHED_STATUSES = ['Onboarding', 'Active', 'Offboarding'];

/**
 * UAE nationals hold no residence visa, so it must not be reported missing for
 * them. Nationality is free text on the employee, so match the usual spellings.
 */
export function isUaeNational(nationality) {
  const n = String(nationality || '').trim().toLowerCase();
  if (!n) return false;
  return /^(uae|u\.a\.e\.?|emirati|united arab emirates)$/.test(n)
    || n.includes('إمارات') || n.includes('اماراتي') || n.includes('الامارات');
}

/** The official documents an employee must have on record. */
export function requiredDocTypes(nationality) {
  return isUaeNational(nationality)
    ? ['Passport', 'Emirates ID', 'Labour Card']
    : ['Passport', 'Residence Visa', 'Emirates ID', 'Labour Card'];
}

/**
 * Which required documents have no dated record.
 * @param {string|null} nationality
 * @param {string[]} datedTypes doc_type of every document on file that has an expiry date
 */
export function missingDocTypes(nationality, datedTypes) {
  const have = new Set(datedTypes || []);
  return requiredDocTypes(nationality).filter((t) => !have.has(t));
}

/** On-screen state of one document, the same bands as company documents. */
export function expiryState(daysLeft) {
  if (daysLeft == null) return 'not_set';
  if (daysLeft < 0) return 'expired';
  if (daysLeft <= 30) return 'critical';
  if (daysLeft <= 90) return 'soon';
  return 'valid';
}

/**
 * Check and validate the expiry fields of a create/update body.
 * Returns { data, warnings } with only the fields present in the body, or { error }.
 * `error` is for what cannot be stored; `warnings` is for what the person may overrule.
 */
export function readEmployeeDocFields(body) {
  const data = {};
  const isDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));

  if (body.doc_type !== undefined) {
    const t = body.doc_type || null;
    if (t && !EMPLOYEE_DOC_TYPES.includes(t)) return { error: 'Unknown document type' };
    data.doc_type = t;
  }
  if (body.doc_number !== undefined) {
    const num = String(body.doc_number || '').trim();
    if (num.length > 64) return { error: 'Document number is too long' };
    data.doc_number = num || null;
  }
  for (const col of ['issue_date', 'expiry_date']) {
    if (body[col] === undefined) continue;
    const v = body[col] ? String(body[col]).slice(0, 10) : null;
    if (v && !isDate(v)) return { error: `Invalid ${col.replace('_', ' ')}` };
    data[col] = v;
  }
  const issue = data.issue_date !== undefined ? data.issue_date : body.current_issue_date;
  const expiry = data.expiry_date !== undefined ? data.expiry_date : body.current_expiry_date;

  // An expiry before the issue date is unusual but real for some papers, so it is
  // a warning the person can overrule, not an error (see softWarnings.js). Only
  // raised when a date is actually being changed: re-saving an unrelated field on
  // a document the person already confirmed must not ask again.
  const datesChanged = (data.issue_date !== undefined && data.issue_date !== body.current_issue_date)
    || (data.expiry_date !== undefined && data.expiry_date !== body.current_expiry_date);
  const warnings = [];
  const order = datesChanged ? expiryBeforeIssue(issue, expiry) : null;
  if (order) warnings.push(order);
  return { data, warnings };
}

/**
 * Scheduler pass: warn HR once per threshold for every watched document.
 * @returns {Promise<number>} how many alerts were sent
 */
export async function checkEmployeeDocumentExpiry(pool) {
  const [rows] = await pool.query(
    `SELECT d.id, d.doc_type, d.category, d.doc_number, d.expiry_alert_sent,
            DATE_FORMAT(d.expiry_date, '%Y-%m-%d') AS expiry_date,
            DATEDIFF(d.expiry_date, CURDATE())     AS days_left,
            e.id AS employee_id, e.company_id,
            TRIM(CONCAT(COALESCE(e.first_name, ''), ' ', COALESCE(e.last_name, ''))) AS employee_name
       FROM employee_documents d
       JOIN employees e ON e.id = d.employee_id
      WHERE d.expiry_date IS NOT NULL AND e.status IN (?)
      ORDER BY d.expiry_date`, [WATCHED_STATUSES]);

  let sent = 0;
  for (const doc of rows) {
    const threshold = thresholdFor(doc.days_left, DOC_EXPIRY_THRESHOLDS);
    if (!threshold) continue;
    if (alreadyAlerted(doc.expiry_alert_sent, threshold)) continue;

    const expired = threshold === 'expired';
    const what = `${doc.doc_type || doc.category || 'Document'} of ${doc.employee_name}`;
    const title = expired
      ? `Expired: ${what}`
      : `${what} expires in ${doc.days_left} day${doc.days_left === 1 ? '' : 's'}`;
    const body = [
      doc.doc_number ? `No. ${doc.doc_number}` : null,
      `Expiry: ${doc.expiry_date}`,
      expired ? 'No longer valid — renew it and update the record.' : 'Start the renewal before it lapses.',
    ].filter(Boolean).join(' · ');

    await notifyRole(pool, doc.company_id, ['admin', 'hr_manager'], {
      type: expired ? 'error' : 'warning', title, body, link: '/document-radar',
    });
    await pool.query('UPDATE employee_documents SET expiry_alert_sent = ? WHERE id = ?', [threshold, doc.id]);
    sent++;
  }
  return sent;
}

/**
 * Everything the radar page and the dashboard read.
 * @param {object} pool
 * @param {{clause: string, params: any[]}} co company clause on the employees table alias `e`
 */
export async function buildRadar(pool, co) {
  const [items] = await pool.query(
    `SELECT d.id, d.employee_id, d.doc_type, d.category, d.doc_number, d.file_name,
            DATE_FORMAT(d.issue_date, '%Y-%m-%d')  AS issue_date,
            DATE_FORMAT(d.expiry_date, '%Y-%m-%d') AS expiry_date,
            DATEDIFF(d.expiry_date, CURDATE())     AS days_left,
            e.company_id, e.nationality, e.status AS employee_status,
            TRIM(CONCAT(COALESCE(e.first_name, ''), ' ', COALESCE(e.last_name, ''))) AS employee_name,
            c.name AS company_name
       FROM employee_documents d
       JOIN employees e ON e.id = d.employee_id
       LEFT JOIN companies c ON c.id = e.company_id
      WHERE d.expiry_date IS NOT NULL AND e.status IN (?)${co.clause}
      ORDER BY d.expiry_date`, [WATCHED_STATUSES, ...co.params]);

  const [people] = await pool.query(
    `SELECT e.id, e.nationality, e.company_id, c.name AS company_name,
            TRIM(CONCAT(COALESCE(e.first_name, ''), ' ', COALESCE(e.last_name, ''))) AS employee_name,
            GROUP_CONCAT(DISTINCT CASE WHEN d.expiry_date IS NOT NULL THEN d.doc_type END) AS dated_types
       FROM employees e
       LEFT JOIN employee_documents d ON d.employee_id = e.id
       LEFT JOIN companies c ON c.id = e.company_id
      WHERE e.status IN (?)${co.clause}
      GROUP BY e.id, e.nationality, e.company_id, c.name, e.first_name, e.last_name
      ORDER BY e.first_name, e.last_name`, [WATCHED_STATUSES, ...co.params]);

  const missing = people
    .map((p) => ({
      employee_id: p.id,
      employee_name: p.employee_name,
      company_id: p.company_id,
      company_name: p.company_name,
      missing: missingDocTypes(p.nationality, (p.dated_types || '').split(',').filter(Boolean)),
    }))
    .filter((p) => p.missing.length);

  const withState = items.map((d) => ({ ...d, state: expiryState(d.days_left) }));
  const counts = {
    tracked: withState.length,
    expired: withState.filter((d) => d.state === 'expired').length,
    within_30: withState.filter((d) => d.days_left >= 0 && d.days_left <= 30).length,
    within_90: withState.filter((d) => d.days_left >= 0 && d.days_left <= 90).length,
    employees_missing: missing.length,
  };
  return { counts, items: withState, missing, thresholds: DOC_EXPIRY_THRESHOLDS };
}
