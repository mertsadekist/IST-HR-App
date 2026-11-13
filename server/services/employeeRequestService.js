/**
 * Requests an employee raises from the portal: a letter, an expense to be
 * reimbursed, a salary advance, or a case for HR. Pure validation lives here;
 * the routes do the storing.
 *
 * Where each one ends:
 *   letter   HR uploads the issued letter; the employee downloads it.
 *   expense  approved → a one-time Reimbursement item in a payroll month.
 *   advance  approved → a salary advance repaid in monthly instalments.
 *   case     worked by an owner, with comments, until Resolved and Closed.
 * Expenses and advances go through an approval chain first where one is
 * configured (services/approvalService.js).
 */

export const REQUEST_TYPES = ['letter', 'expense', 'advance', 'case'];
export const LETTER_TYPES = ['Salary Certificate', 'NOC', 'Employment Confirmation', 'Experience Certificate'];
export const EXPENSE_CATEGORIES = ['Travel', 'Transport', 'Meals', 'Supplies', 'Phone', 'Training', 'Other'];
export const CASE_CATEGORIES = ['Payroll', 'Leave', 'Attendance', 'Documents', 'Workplace', 'IT', 'Other'];
export const CASE_STATUSES = ['Pending', 'In Progress', 'Resolved', 'Closed'];
export const MAX_EXPENSE = 100000;
export const MAX_ADVANCE_MONTHS = 24;

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const text = (v, max) => String(v ?? '').trim().slice(0, max);
const isDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) && !Number.isNaN(Date.parse(v));

/**
 * @param {string} type
 * @param {object} body
 * @param {string} today 'YYYY-MM-DD'
 * @returns {{data:{title:string, amount:number|null, details:object}}|{error:string}}
 */
export function validateNewRequest(type, body = {}, today = new Date().toISOString().slice(0, 10)) {
  if (!REQUEST_TYPES.includes(type)) return { error: 'Unknown request type' };

  if (type === 'letter') {
    if (!LETTER_TYPES.includes(body.letter_type)) return { error: 'Choose the letter' };
    const purpose = text(body.purpose, 300);
    if (!purpose) return { error: 'Say what the letter is for' };
    const language = ['en', 'ar', 'both'].includes(body.language) ? body.language : 'en';
    return { data: { title: body.letter_type, amount: null,
      details: { letter_type: body.letter_type, addressed_to: text(body.addressed_to, 200) || null, purpose, language } } };
  }

  if (type === 'expense') {
    if (!EXPENSE_CATEGORIES.includes(body.category)) return { error: 'Choose a category' };
    const amount = round2(body.amount);
    if (!(amount > 0) || amount > MAX_EXPENSE) return { error: `The amount must be between 0 and ${MAX_EXPENSE}` };
    if (!isDate(body.expense_date)) return { error: 'Enter the date of the expense' };
    if (body.expense_date > today) return { error: 'The expense date cannot be in the future' };
    const description = text(body.description, 500);
    if (!description) return { error: 'Describe the expense' };
    return { data: { title: `${body.category}: ${description.slice(0, 80)}`, amount,
      details: { category: body.category, expense_date: body.expense_date, description } } };
  }

  if (type === 'advance') {
    const amount = round2(body.amount);
    if (!(amount > 0)) return { error: 'Enter the amount' };
    const months = Math.round(Number(body.months));
    if (!(months >= 1 && months <= MAX_ADVANCE_MONTHS)) return { error: `Repay over 1 to ${MAX_ADVANCE_MONTHS} months` };
    const reason = text(body.reason, 500);
    if (!reason) return { error: 'Give a reason' };
    return { data: { title: 'Salary advance', amount,
      details: { months, instalment: round2(amount / months), reason } } };
  }

  // case
  if (!CASE_CATEGORIES.includes(body.category)) return { error: 'Choose a category' };
  const subject = text(body.subject, 150);
  const description = text(body.description, 2000);
  if (!subject || !description) return { error: 'Enter a subject and a description' };
  return { data: { title: subject, amount: null, details: { category: body.category, description } } };
}

/** The payroll month to reimburse an approved expense in: the next one, by default. */
export function defaultReimbursementPeriod(today = new Date().toISOString().slice(0, 10)) {
  const [y, m] = today.slice(0, 7).split('-').map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
}
