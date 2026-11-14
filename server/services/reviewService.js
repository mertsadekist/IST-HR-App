/**
 * Appraisals: a review cycle, one review per employee, goals inside it.
 *
 *   Self Review     the employee scores their goals and themselves
 *   Manager Review  their direct manager scores them and recommends
 *   HR Review       HR sets the final rating and recommendation
 *   Completed       the employee sees the outcome
 *
 * Someone with no manager who signs in goes straight from self review to HR.
 * The final rating is shown beside the person in salary reviews.
 *
 * Pure functions here; the routes do the storing.
 */

export const CYCLE_STATUSES = ['Draft', 'Open', 'Closed'];
export const REVIEW_STATUSES = ['Self Review', 'Manager Review', 'HR Review', 'Completed'];
export const RECOMMENDATIONS = ['None', 'Increase', 'Promotion', 'Bonus', 'Training', 'Improvement Plan'];
export const RATING_SCALE = 5;
export const MAX_GOALS = 10;

const isDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) && !Number.isNaN(Date.parse(v));
const text = (v, max) => String(v ?? '').trim().slice(0, max);

/** Validate a cycle from HR's form. */
export function validateCycle(b = {}) {
  const name = text(b.name, 150);
  if (!name) return { error: 'Name the cycle' };
  if (!isDate(b.period_start) || !isDate(b.period_end) || b.period_end < b.period_start) return { error: 'Choose the period reviewed' };
  for (const k of ['self_due', 'manager_due']) {
    if (b[k] && !isDate(b[k])) return { error: 'Invalid due date' };
  }
  if (b.self_due && b.manager_due && b.manager_due < b.self_due) return { error: 'The manager due date comes after the self review' };
  return { data: { name, period_start: b.period_start, period_end: b.period_end, self_due: b.self_due || null, manager_due: b.manager_due || null } };
}

/** A rating on the scale, or null. */
export function rating(v) {
  if (v === '' || v == null) return null;
  const n = Math.round(Number(v));
  return n >= 1 && n <= RATING_SCALE ? n : undefined;
}

/**
 * Clean the goals a form sends. Weights are whole percentages; when any is
 * given they must add up to 100.
 * @returns {{data:{title:string, weight:number|null, self_score:number|null, manager_score:number|null, comment:string|null}[]}|{error:string}}
 */
export function validateGoals(goals) {
  if (!Array.isArray(goals)) return { error: 'Goals must be a list' };
  if (goals.length > MAX_GOALS) return { error: `At most ${MAX_GOALS} goals` };
  const out = [];
  for (const g of goals) {
    const title = text(g?.title, 200);
    if (!title) return { error: 'Every goal needs a title' };
    const weight = g.weight === '' || g.weight == null ? null : Math.round(Number(g.weight));
    if (weight != null && !(weight >= 0 && weight <= 100)) return { error: 'A weight is between 0 and 100' };
    const self = rating(g.self_score);
    const mgr = rating(g.manager_score);
    if (self === undefined || mgr === undefined) return { error: `Scores are 1 to ${RATING_SCALE}` };
    out.push({ title, weight, self_score: self, manager_score: mgr, comment: text(g.comment, 1000) || null });
  }
  const weighted = out.filter((g) => g.weight != null);
  if (weighted.length && weighted.reduce((s, g) => s + g.weight, 0) !== 100) return { error: 'Goal weights must add up to 100' };
  return { data: out };
}

/**
 * The goals' weighted score, on the rating scale, from the manager's scores
 * (or the employee's own where the manager has not scored). Unweighted goals
 * count equally. Null when nothing is scored.
 */
export function weightedScore(goals, which = 'manager') {
  const scored = (goals || []).map((g) => ({
    w: g.weight == null ? null : Number(g.weight),
    s: which === 'self' ? g.self_score : (g.manager_score ?? g.self_score),
  })).filter((g) => g.s != null);
  if (!scored.length) return null;
  const anyWeight = scored.some((g) => g.w != null);
  const parts = scored.map((g) => ({ w: anyWeight ? (g.w ?? 0) : 1, s: Number(g.s) }));
  const total = parts.reduce((t, g) => t + g.w, 0);
  if (!total) return null;
  return Math.round((parts.reduce((t, g) => t + g.w * g.s, 0) / total) * 100) / 100;
}

/** Where a review goes when the employee submits their part. */
export function afterSelfReview(hasManagerUser) {
  return hasManagerUser ? 'Manager Review' : 'HR Review';
}

/** Which part of a review the caller may write now, if any. */
export function editableBy({ status, isEmployee, isManager, isHR }) {
  if (status === 'Self Review' && isEmployee) return 'self';
  if (status === 'Manager Review' && isManager) return 'manager';
  if (status === 'HR Review' && isHR) return 'hr';
  return null;
}

// ─── Job requisitions ────────────────────────────────────────────────────────
export const REQUISITION_REASONS = ['New', 'Replacement'];

/** Validate a hiring request. */
export function validateRequisition(b = {}, today = new Date().toISOString().slice(0, 10)) {
  const title = text(b.title, 200);
  if (!title) return { error: 'Give the role a title' };
  const head = Math.round(Number(b.head_count || 1));
  if (!(head >= 1 && head <= 50)) return { error: 'Head count is 1 to 50' };
  if (!REQUISITION_REASONS.includes(b.reason)) return { error: 'New role or replacement?' };
  if (b.reason === 'Replacement' && !Number(b.replaces_employee_id)) return { error: 'Who is being replaced?' };
  const min = b.budget_min === '' || b.budget_min == null ? null : Number(b.budget_min);
  const max = b.budget_max === '' || b.budget_max == null ? null : Number(b.budget_max);
  if ((min != null && !(min >= 0)) || (max != null && !(max >= 0)) || (min != null && max != null && max < min)) return { error: 'Check the salary range' };
  if (b.target_start && (!isDate(b.target_start) || b.target_start < today)) return { error: 'The start date cannot be in the past' };
  const justification = text(b.justification, 2000);
  if (!justification) return { error: 'Say why the role is needed' };
  return {
    data: {
      title, head_count: head, reason: b.reason,
      replaces_employee_id: b.reason === 'Replacement' ? Number(b.replaces_employee_id) : null,
      department_id: Number(b.department_id) || null, job_title_id: Number(b.job_title_id) || null,
      budget_min: min, budget_max: max, target_start: b.target_start || null, justification,
    },
  };
}
