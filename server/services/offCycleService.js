/**
 * Off-cycle payroll runs: an extra run inside a month, next to the regular one,
 * for a bonus, a commission or a correction that should not wait for (or be
 * mixed into) the monthly run. It goes through the same submit → approve → pay
 * steps, WPS file and payslips as a regular run.
 *
 * An off-cycle run carries only the lines HR enters: no salary, no leave or
 * absence, no loans, no pension (the GPSSA contribution salary is the monthly
 * one; bonuses are not part of it).
 */

export const OFF_CYCLE_CATEGORIES = {
  earning: ['Bonus', 'Commission', 'Correction', 'Other'],
  deduction: ['Correction', 'Other'],
};

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

/** The payslip line code for a category: BONUS, COMMISSION, CORRECTION, CORRECTION_DED, ... */
export const offCycleCode = (kind, category) => `${String(category).toUpperCase()}${kind === 'deduction' ? '_DED' : ''}`;

/**
 * @returns {{error:string}|{data:{period:string,title:string,lines:object[]}}}
 */
export function validateOffCycle(b = {}) {
  const period = String(b.period || '');
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) return { error: 'Choose the month' };
  const title = String(b.title || '').trim();
  if (title.length < 3 || title.length > 150) return { error: 'Give the run a title (3 to 150 characters)' };
  const raw = Array.isArray(b.lines) ? b.lines : [];
  if (!raw.length) return { error: 'Add at least one line' };
  if (raw.length > 1000) return { error: 'Too many lines' };
  const lines = [];
  for (const [i, l] of raw.entries()) {
    const employee_id = Number(l.employee_id);
    if (!Number.isInteger(employee_id) || employee_id <= 0) return { error: `Line ${i + 1}: choose the employee` };
    const kind = l.kind === 'deduction' ? 'deduction' : 'earning';
    const category = OFF_CYCLE_CATEGORIES[kind].includes(l.category) ? l.category : null;
    if (!category) return { error: `Line ${i + 1}: choose the category` };
    const amount = round2(l.amount);
    if (!(amount > 0) || amount > 10_000_000) return { error: `Line ${i + 1}: enter an amount` };
    const label = String(l.label || '').trim().slice(0, 150) || category;
    lines.push({ employee_id, kind, category, code: offCycleCode(kind, category), label, amount });
  }
  return { data: { period, title, lines } };
}

/**
 * One payroll item per employee from the lines. A deduction larger than what
 * the same person earns in the run is refused: an off-cycle run pays people,
 * it does not collect from them.
 * @returns {{error:string}|{items:{employee_id:number,additions:number,deductions:number,net:number,lines:object[]}[]}}
 */
export function offCycleItems(lines) {
  const by = new Map();
  for (const l of lines) {
    const it = by.get(l.employee_id) || { employee_id: l.employee_id, additions: 0, deductions: 0, lines: [] };
    if (l.kind === 'earning') it.additions = round2(it.additions + l.amount);
    else it.deductions = round2(it.deductions + l.amount);
    it.lines.push(l);
    by.set(l.employee_id, it);
  }
  const items = [...by.values()].map((it) => ({ ...it, net: round2(it.additions - it.deductions) }));
  const bad = items.find((it) => it.net < 0);
  if (bad) return { error: 'Deductions for an employee exceed what they are paid in this run', employee_id: bad.employee_id };
  return { items };
}
