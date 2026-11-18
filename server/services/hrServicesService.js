/**
 * HR services for everyone: announcements, policies people acknowledge, and
 * the disciplinary file.
 *
 *   announcement  a notice to one company or all, normal or important, until
 *                 an optional expiry date; who has read it is recorded
 *   policy        a text and/or a PDF with a version; publishing a new version
 *                 asks everyone to acknowledge it again
 *   disciplinary  a case on an employee: what happened, the action taken
 *                 (verbal warning … termination), linked to the letter issued
 *
 * Pure functions here; the routes do the storing.
 */

export const ANNOUNCEMENT_PRIORITIES = ['normal', 'important'];
export const POLICY_CATEGORIES = ['Code of Conduct', 'Attendance', 'Leave', 'IT & Security', 'Health & Safety', 'Compensation', 'Other'];
export const CASE_CATEGORIES = ['Attendance', 'Conduct', 'Performance', 'Policy Breach', 'Other'];
export const CASE_ACTIONS = ['Counselling', 'Verbal Warning', 'Written Warning', 'Final Warning', 'Suspension', 'Termination'];

const isDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) && !Number.isNaN(Date.parse(v));
const text = (v, max) => String(v ?? '').trim().slice(0, max);

export function validateAnnouncement(b = {}, today = new Date().toISOString().slice(0, 10)) {
  const title = text(b.title, 200);
  const body = text(b.body, 10000);
  if (!title) return { error: 'Give the announcement a title' };
  if (!body) return { error: 'Write the announcement' };
  const priority = ANNOUNCEMENT_PRIORITIES.includes(b.priority) ? b.priority : 'normal';
  if (b.expires_on && (!isDate(b.expires_on) || b.expires_on < today)) return { error: 'The expiry date cannot be in the past' };
  return { data: { title, body, priority, expires_on: b.expires_on || null } };
}

/** Shown to people now: published and not past its expiry. */
export function isLive(a, today) {
  return !!a.published_at && (!a.expires_on || a.expires_on >= today);
}

export function validatePolicy(b = {}) {
  const title = text(b.title, 200);
  if (!title) return { error: 'Give the policy a title' };
  const category = POLICY_CATEGORIES.includes(b.category) ? b.category : 'Other';
  const body = text(b.body, 50000) || null;
  if (b.ack_due && !isDate(b.ack_due)) return { error: 'Invalid acknowledgement date' };
  return { data: { title, category, body, requires_ack: b.requires_ack === false || b.requires_ack === 'false' || b.requires_ack === '0' ? 0 : 1, ack_due: b.ack_due || null } };
}

/**
 * Publishing: the first publication is version 1; publishing again after an
 * edit is the next version, which everyone acknowledges afresh.
 */
export function nextVersion(current, everPublished) {
  return everPublished ? (Number(current) || 0) + 1 : Math.max(1, Number(current) || 1);
}

/** How far acknowledgement has got: { done, total, percent }. */
export function ackProgress(acknowledged, total) {
  const t = Math.max(0, Number(total) || 0);
  const d = Math.min(t, Math.max(0, Number(acknowledged) || 0));
  return { done: d, total: t, percent: t ? Math.round((d / t) * 100) : 0 };
}

export function validateCase(b = {}, today = new Date().toISOString().slice(0, 10)) {
  if (!Number(b.employee_id)) return { error: 'Choose the employee' };
  if (!CASE_CATEGORIES.includes(b.category)) return { error: 'Choose the category' };
  if (!CASE_ACTIONS.includes(b.action)) return { error: 'Choose the action taken' };
  if (!isDate(b.incident_date) || b.incident_date > today) return { error: 'Enter the date it happened (not in the future)' };
  const description = text(b.description, 5000);
  if (!description) return { error: 'Describe what happened' };
  return {
    data: {
      employee_id: Number(b.employee_id), category: b.category, action: b.action, incident_date: b.incident_date,
      description, employee_response: text(b.employee_response, 5000) || null,
      letter_id: Number(b.letter_id) || null,
    },
  };
}

/** The more serious of two actions — for a person's record at a glance. */
export function mostSerious(actions) {
  let best = null;
  for (const a of actions || []) if (CASE_ACTIONS.indexOf(a) > CASE_ACTIONS.indexOf(best)) best = a;
  return best;
}
