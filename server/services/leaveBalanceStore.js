/**
 * Database side of leave balances (the arithmetic is in leaveBalanceService.js).
 *
 * The figure every screen agrees on, per employee, leave pool and year:
 *   entitled  the balance-row override, else service-based annual, else the type's default days
 *   adjusted  the sum of the ledger
 *   used      approved days of every type drawing on the pool, by start year
 *   remaining entitled + adjusted − used (null when the type has no yearly limit)
 */
import { annualEntitlement, completedMonths, loadLeavePolicy } from './leavePolicyService.js';
import { resolveEffectiveSchedule, holidaysBetween } from './workScheduleService.js';
import { datesBetween, countLeaveDays } from './leaveBalanceService.js';

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

/** Ledger totals: Map `${employeeId}:${poolTypeId}` → days, for one year. */
export async function ledgerTotals(db, employeeIds, year) {
  const out = new Map();
  if (!employeeIds.length) return out;
  const [rows] = await db.query(
    `SELECT employee_id, leave_type_id, SUM(days) AS days FROM leave_adjustments
      WHERE year = ? AND employee_id IN (?) GROUP BY employee_id, leave_type_id`, [year, employeeIds]);
  for (const r of rows) out.set(`${r.employee_id}:${r.leave_type_id}`, Number(r.days) || 0);
  return out;
}

/**
 * Raise each limited pool's yearly cap by the employee's ledger, for payroll.
 * A pool with no limit stays unlimited.
 */
export function capsWithLedger(capByType, ledger, employeeId) {
  const caps = new Map(capByType);
  for (const [pool, cap] of caps) {
    if (cap == null) continue;
    const adj = ledger.get(`${employeeId}:${pool}`) || 0;
    if (adj) caps.set(pool, Math.max(0, round2(cap + adj)));
  }
  return caps;
}

/** The types drawing on a pool, the pool included. */
export function typesOfPool(policy, poolId) {
  return [...policy.poolByType].filter(([, p]) => p === poolId).map(([t]) => t).concat(poolId)
    .filter((v, i, a) => a.indexOf(v) === i);
}

/**
 * Balances for many employees at once, for one year and the given pools.
 * @returns {Promise<Map<string, {entitled:number|null, adjusted:number, used:number, remaining:number|null}>>}
 *          keyed `${employeeId}:${poolTypeId}`
 */
export async function balancesFor(db, { employees, poolIds, year, policy }) {
  const out = new Map();
  if (!employees.length || !poolIds.length) return out;
  policy = policy || await loadLeavePolicy(db);
  const empIds = employees.map((e) => e.id);
  const typeOfPool = new Map(poolIds.map((p) => [p, typesOfPool(policy, p)]));
  const allTypes = [...new Set([...typeOfPool.values()].flat())];

  const [usedRows] = await db.query(
    `SELECT employee_id, leave_type_id, SUM(days) AS days FROM leave_requests
      WHERE status = 'Approved' AND YEAR(start_date) = ? AND employee_id IN (?) AND leave_type_id IN (?)
      GROUP BY employee_id, leave_type_id`, [year, empIds, allTypes]);
  const usedBy = new Map();
  for (const r of usedRows) {
    const pool = policy.poolByType.get(r.leave_type_id) ?? r.leave_type_id;
    const k = `${r.employee_id}:${pool}`;
    usedBy.set(k, (usedBy.get(k) || 0) + Number(r.days || 0));
  }
  const [lbRows] = await db.query(
    'SELECT employee_id, leave_type_id, entitled FROM leave_balances WHERE year = ? AND employee_id IN (?) AND leave_type_id IN (?)',
    [year, empIds, poolIds]);
  const override = new Map(lbRows.map((r) => [`${r.employee_id}:${r.leave_type_id}`, Number(r.entitled)]));
  const ledger = await ledgerTotals(db, empIds, year);
  const typeById = new Map(policy.types.map((t) => [t.id, t]));

  for (const e of employees) {
    for (const pool of poolIds) {
      const k = `${e.id}:${pool}`;
      const t = typeById.get(pool);
      let entitled;
      if (override.has(k)) entitled = override.get(k);
      else if (t?.accrual === 'Service Based') entitled = e.start_date ? annualEntitlement(e.start_date, `${year}-12-31`) : Number(t.default_days) || 0;
      else entitled = Number(t?.default_days) > 0 ? Number(t.default_days) : null;
      const adjusted = round2(ledger.get(k) || 0);
      const used = round2(usedBy.get(k) || 0);
      out.set(k, {
        entitled, adjusted, used,
        remaining: entitled == null ? null : round2(entitled + adjusted - used),
      });
    }
  }
  return out;
}

/** Employees with their start date as a string. */
export async function employeesById(db, ids) {
  if (!ids.length) return [];
  const [rows] = await db.query(
    `SELECT id, company_id, first_name, last_name, manager_employee_id, department_id, basic_salary,
            DATE_FORMAT(start_date, '%Y-%m-%d') AS start_date
       FROM employees WHERE id IN (?)`, [ids]);
  return rows;
}

/**
 * Days a request costs, by the type's basis. Working-day types use the
 * employee's schedule for each date and the company's holidays.
 * @returns {Promise<{days:number, excluded:object[], basis:string}>}
 */
export async function countRequestDays(db, { employeeId, companyId, type, start, end }) {
  const dates = datesBetween(start, end);
  const basis = type?.day_basis === 'working' ? 'working' : 'calendar';
  if (basis === 'calendar') return { ...countLeaveDays(dates), basis };
  const working = new Map();
  for (const d of dates) {
    const r = await resolveEffectiveSchedule(employeeId, d, db).catch(() => null);
    // No schedule on record: count the day rather than give it away.
    working.set(d, r ? !!r.dayRule?.is_working : true);
  }
  const holidays = new Map();
  for (const h of await holidaysBetween(companyId, start, end, db).catch(() => [])) {
    holidays.set(h.holiday_date, { half: !!h.is_half_day, name: h.name_en });
  }
  return { ...countLeaveDays(dates, { basis, isWorking: (d) => working.get(d), holidays }), basis };
}

/** Completed months of service on a date, or null without a start date. */
export const serviceMonthsOn = (startDate, date) => (startDate ? completedMonths(startDate, date) : null);
