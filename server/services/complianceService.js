/**
 * Compliance: what needs attention now, the dated deadlines of a month, and
 * Emiratisation against the target.
 *
 * Statutory figures (Emiratisation targets and fines) live in `law_values`,
 * one value per key and year, editable by an admin once checked with MOHRE —
 * the law moves every year and a figure written into code would quietly go
 * stale. The seeded values are a starting point, not legal advice.
 *
 * Pure functions here; routes/compliance.js does the reading.
 */

export const SEVERITIES = ['critical', 'high', 'medium', 'low'];
export const LAW_KEYS = ['emiratisation_target_percent', 'emiratisation_fine_per_year', 'emiratisation_min_headcount',
  // GPSSA pension (services/pensionService.js).
  'gpssa_new_employee_percent', 'gpssa_new_employer_percent', 'gpssa_new_government_percent',
  'gpssa_new_government_below', 'gpssa_new_min_salary', 'gpssa_new_max_salary',
  'gpssa_old_employee_percent', 'gpssa_old_employer_percent', 'gpssa_old_min_salary', 'gpssa_old_max_salary'];
/** Days after the end of the month in which salaries count as late under WPS. */
export const WPS_LATE_AFTER_DAYS = 15;

/** Most urgent first; within a severity, the larger count first. */
export function sortAttention(items) {
  return [...items]
    .filter((i) => Number(i.count) > 0)
    .sort((a, b) => SEVERITIES.indexOf(a.severity) - SEVERITIES.indexOf(b.severity) || b.count - a.count);
}

/**
 * The value of a law key for a year: the latest row at or before that year.
 * @param {{key:string, year:number, value:number}[]} rows
 */
export function lawValueFor(rows, key, year) {
  const hits = rows.filter((r) => r.key === key && Number(r.year) <= Number(year)).sort((a, b) => b.year - a.year);
  return hits.length ? Number(hits[0].value) : null;
}

/**
 * Emiratisation for one company and year.
 *
 * The rule counts skilled workers; with no skill level on file every current
 * employee is counted, so the figure is an upper bound to check against MOHRE.
 * Required nationals are rounded down, so the shortfall is never overstated.
 */
export function emiratisationStatus({ headcount, nationals, targetPercent, finePerYear, minHeadcount = 50 }) {
  const applies = minHeadcount == null || headcount >= minHeadcount;
  const pct = Number(targetPercent) || 0;
  const required = applies ? Math.floor((headcount * pct) / 100) : 0;
  const gap = Math.max(0, required - nationals);
  return {
    applies, headcount, nationals, target_percent: pct,
    actual_percent: headcount ? Math.round((nationals / headcount) * 1000) / 10 : 0,
    required, gap, fine: gap * (Number(finePerYear) || 0),
  };
}

const iso = (y, m, d) => new Date(Date.UTC(y, m - 1, d)).toISOString().slice(0, 10);

/** WPS dates for a payroll month: end of month and the day pay counts as late. */
export function wpsDates(period) {
  const [y, m] = period.split('-').map(Number);
  const end = new Date(Date.UTC(y, m, 0));
  const late = new Date(end.getTime() + WPS_LATE_AFTER_DAYS * 86_400_000);
  return { period_end: end.toISOString().slice(0, 10), late_from: late.toISOString().slice(0, 10) };
}

/**
 * The fixed dates of a month that do not come from records: WPS for the
 * previous month's salaries, and the half-year Emiratisation checkpoints.
 * @returns {{date:string, kind:string, period?:string}[]}
 */
export function fixedDeadlines(month) {
  const [y, m] = month.split('-').map(Number);
  const out = [];
  const prev = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
  const w = wpsDates(prev);
  if (w.late_from.startsWith(month)) out.push({ date: w.late_from, kind: 'wps_late', period: prev });
  const thisEnd = wpsDates(month).period_end;
  out.push({ date: thisEnd, kind: 'salary_month_end', period: month });
  if (m === 6) out.push({ date: iso(y, 6, 30), kind: 'emiratisation_midyear' });
  if (m === 12) out.push({ date: iso(y, 12, 31), kind: 'emiratisation_yearend' });
  return out;
}

/** Validate a law value an admin edits. */
export function validateLawValue(b = {}) {
  if (!LAW_KEYS.includes(b.key)) return { error: 'Unknown setting' };
  const year = Math.round(Number(b.year));
  if (!(year >= 2020 && year <= 2100)) return { error: 'Choose the year' };
  const value = Number(b.value);
  if (!Number.isFinite(value) || value < 0) return { error: 'Enter a value' };
  if (b.key.endsWith('_percent') && value > 100) return { error: 'A percentage is at most 100' };
  return { data: { key: b.key, year, value, note: String(b.note || '').trim().slice(0, 300) || null } };
}
