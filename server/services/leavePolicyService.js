/**
 * The company's leave policy, as arithmetic.
 *
 * Two things in the policy the old model could not express, and both are here:
 *
 * **Tiered pay.** Sick leave is ninety days a year at three different rates —
 * the first fifteen at full pay, the next thirty at half, the last forty-five
 * unpaid. Maternity is sixty days at two rates plus forty-five unpaid. A single
 * `is_paid` flag on the type cannot say that, so the rate depends on how much of
 * that type the employee has already taken this year.
 *
 * **Service-based accrual.** Annual leave is thirty days only once a year of
 * service is complete. Between six and twelve months it accrues at two days per
 * completed month, and below six months there is no statutory entitlement at all.
 *
 * Pure functions, no database. This is what decides how much of somebody's
 * salary is withheld, so it has to be testable exhaustively and readable by
 * whoever has to defend a payslip.
 */

/** Completed months of service between two 'YYYY-MM-DD' dates. */
export function completedMonths(startDate, asOf) {
  const s = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(startDate || ''));
  const a = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(asOf || ''));
  if (!s || !a) return 0;
  let months = (+a[1] - +s[1]) * 12 + (+a[2] - +s[2]);
  // The month only counts once the day-of-month has come round again.
  if (+a[3] < +s[3]) months -= 1;
  return Math.max(0, months);
}

/**
 * Statutory annual-leave entitlement in calendar days.
 *
 * Policy: a completed year earns thirty days. Six to twelve months earns two
 * days per completed month. Below six months there is no statutory entitlement,
 * and anything granted there is Management's discretion — which the system
 * expresses as an explicit `leave_balances.entitled` override rather than a rule.
 */
export function annualEntitlement(startDate, asOf) {
  const months = completedMonths(startDate, asOf);
  if (months >= 12) return 30;
  if (months >= 6) return months * 2;
  return 0;
}

/**
 * Splits a leave request across its type's pay tiers.
 *
 * `usedBefore` is how many days of this type the employee has already taken in
 * the same leave year, because that is what decides which tier the new days fall
 * into. A twenty-day sick leave taken from scratch is fifteen days at full pay
 * and five at half; the same twenty days taken after twelve are three at full
 * and seventeen at half.
 *
 * Tiers are treated as intervals over cumulative days so fractional requests
 * work: a day recorded as 0.11 consumes 0.11 of whatever tier it lands in. That
 * matters because an hour's lateness explained as leave is 0.13 of a day, and
 * rounding it up to a whole one is how somebody loses a day's pay for a blood
 * test.
 *
 * Anything beyond the final tier is unpaid. A policy that stops at ninety days
 * is not granting the ninety-first at full pay by omission.
 *
 * @param {{from_day:number, to_day:number|null, pay_factor:number}[]} tiers
 * @param {number} usedBefore days of this type already taken this year
 * @param {number} days length of the request
 * @returns {{full_days:number, half_days:number, unpaid_days:number, deduction_days:number}}
 */
export function splitAcrossTiers(tiers, usedBefore, days, capDays = null) {
  const out = { full_days: 0, half_days: 0, unpaid_days: 0, deduction_days: 0 };
  const n = Math.max(0, Number(days) || 0);
  if (!n) return out;
  const start = Math.max(0, Number(usedBefore) || 0);
  const end = start + n;

  // A yearly cap the tiers cannot know, because it varies per employee: annual
  // leave is thirty days for one person and fourteen for another. Days past it
  // are unpaid however generous the tier says the type is — taking thirty-five
  // days of a thirty-day entitlement does not make the last five free.
  if (capDays != null && end > capDays) {
    const withinCap = Math.max(0, capDays - start);
    const overCap = round2(n - withinCap);
    const inner = withinCap > 0 ? splitAcrossTiers(tiers, start, withinCap) : { ...out };
    return {
      full_days: inner.full_days,
      half_days: inner.half_days,
      unpaid_days: round2(inner.unpaid_days + overCap),
      deduction_days: round2(inner.deduction_days + overCap),
    };
  }

  const ordered = [...(tiers || [])]
    .map((t) => ({
      from: Math.max(1, Number(t.from_day) || 1),
      to: t.to_day == null ? Infinity : Number(t.to_day),
      factor: Math.min(1, Math.max(0, Number(t.pay_factor))),
    }))
    .sort((a, b) => a.from - b.from);

  let covered = 0;
  for (const tier of ordered) {
    // A tier "days 1 to 15" covers the cumulative interval (0, 15].
    const overlap = Math.max(0, Math.min(end, tier.to) - Math.max(start, tier.from - 1));
    if (!overlap) continue;
    covered += overlap;
    out.deduction_days += overlap * (1 - tier.factor);
    if (tier.factor >= 1) out.full_days += overlap;
    else if (tier.factor > 0) out.half_days += overlap;
    else out.unpaid_days += overlap;
  }

  // Past the end of the schedule of tiers — or a type with none at all.
  const beyond = round2(n - covered);
  if (beyond > 0) {
    out.unpaid_days += beyond;
    out.deduction_days += beyond;
  }

  out.full_days = round2(out.full_days);
  out.half_days = round2(out.half_days);
  out.unpaid_days = round2(out.unpaid_days);
  out.deduction_days = round2(out.deduction_days);
  return out;
}

/**
 * The tiers a type behaves as when none are configured, derived from the old
 * `is_paid` flag. Every existing type keeps working unchanged: paid means one
 * open-ended tier at full pay, unpaid means one at nothing.
 */
export function tiersFromIsPaid(isPaid) {
  return [{ from_day: 1, to_day: null, pay_factor: isPaid ? 1 : 0 }];
}

/** Every 'YYYY-MM-DD' from `from` to `to` inclusive. */
function datesBetween(from, to) {
  const p = (s) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ''));
    return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : null;
  };
  const out = [];
  let cur = p(from);
  const end = p(to);
  if (cur == null || end == null || cur > end) return out;
  for (let guard = 0; cur <= end && guard < 400; guard++, cur += 86_400_000) {
    out.push(new Date(cur).toISOString().slice(0, 10));
  }
  return out;
}

/**
 * What a payroll period should withhold for leave, walked day by day.
 *
 * Day by day rather than request by request, because the tier a day falls into
 * depends on everything taken before it, and a request can straddle a month end.
 * A sick leave running from late July into August is not fifteen full-pay days in
 * July and fifteen more in August — the year's counter carries across, and each
 * month is charged only for the days that actually fall in it.
 *
 * Requests are consumed in date order for the same reason: "the first fifteen
 * days" is a statement about sequence.
 *
 * A request whose day count is smaller than the dates it spans is spread evenly
 * across them, which is how a 0.13-day excuse for an hour's lateness stays worth
 * 0.13 of a day.
 *
 * Types that draw on another type share its pool and its cap: emergency leave
 * comes out of the annual balance, and once that is exhausted the policy says it
 * becomes unpaid — which falls out of the shared counter rather than needing its
 * own rule.
 *
 * @param {object} input
 * @param {{leave_type_id:number, start_date:string, end_date:string, days:number}[]} input.requests
 *        every APPROVED request of the leave year, any order
 * @param {Map<number, object[]>} input.tiersByType
 * @param {Map<number, number>} input.poolByType      type id → the pool it counts against
 * @param {Map<number, number|null>} input.capByType  pool id → yearly cap, or null for none
 * @param {string} input.periodStart 'YYYY-MM-01'
 * @param {string} input.periodEnd   'YYYY-MM-DD' (last day of the month)
 * @returns {{deduction_days:number, unpaid_days:number, half_days:number, full_days:number}}
 */
export function leaveDeductionForPeriod({
  requests, tiersByType, poolByType, capByType, periodStart, periodEnd,
}) {
  const totals = { deduction_days: 0, unpaid_days: 0, half_days: 0, full_days: 0 };
  const used = new Map();   // pool id → days consumed so far this year

  const ordered = [...(requests || [])].sort((a, b) => String(a.start_date).localeCompare(String(b.start_date)));

  for (const r of ordered) {
    const dates = datesBetween(r.start_date, r.end_date);
    if (!dates.length) continue;
    const total = Math.max(0, Number(r.days) || 0);
    if (!total) continue;
    const perDay = total / dates.length;

    const pool = poolByType.get(r.leave_type_id) ?? r.leave_type_id;
    const tiers = tiersByType.get(r.leave_type_id) || [];
    const cap = capByType.get(pool) ?? null;

    for (const date of dates) {
      const before = used.get(pool) || 0;
      const slice = splitAcrossTiers(tiers, before, perDay, cap);
      used.set(pool, before + perDay);
      // Only the days inside this payroll period are charged to it.
      if (date >= periodStart && date <= periodEnd) {
        totals.deduction_days += slice.deduction_days;
        totals.unpaid_days += slice.unpaid_days;
        totals.half_days += slice.half_days;
        totals.full_days += slice.full_days;
      }
    }
  }

  for (const k of Object.keys(totals)) totals[k] = round2(totals[k]);
  return totals;
}

/**
 * Loads the configured policy into the shapes leaveDeductionForPeriod wants.
 *
 * A type with no tiers configured falls back to its `is_paid` flag, so a type
 * somebody adds in Settings without touching tiers behaves the way it reads.
 *
 * @param {object} db a pool or connection
 */
export async function loadLeavePolicy(db) {
  const [types] = await db.query(
    'SELECT id, name, is_paid, default_days, accrual, deducts_from_leave_type_id FROM leave_types');
  const [tiers] = await db.query(
    'SELECT leave_type_id, from_day, to_day, pay_factor FROM leave_type_tiers ORDER BY leave_type_id, from_day');

  const tiersByType = new Map();
  for (const t of tiers) {
    if (!tiersByType.has(t.leave_type_id)) tiersByType.set(t.leave_type_id, []);
    tiersByType.get(t.leave_type_id).push({
      from_day: Number(t.from_day), to_day: t.to_day == null ? null : Number(t.to_day),
      pay_factor: Number(t.pay_factor),
    });
  }

  const poolByType = new Map();
  const capByType = new Map();
  const defaultDaysByType = new Map();
  let annualTypeId = null;
  for (const t of types) {
    defaultDaysByType.set(t.id, Number(t.default_days) || null);
    if (!tiersByType.has(t.id)) tiersByType.set(t.id, tiersFromIsPaid(!!t.is_paid));
    // Emergency leave draws on the annual pool, so its days count against the
    // same counter and the same cap.
    poolByType.set(t.id, t.deducts_from_leave_type_id || t.id);
    if (t.accrual === 'Service Based') {
      annualTypeId = t.id;                 // the cap is per employee; filled in later
    } else if (Number(t.default_days) > 0) {
      // A fixed yearly allowance. Sick leave's tiers already run out at ninety,
      // so this only bites for types whose tiers are open-ended.
      capByType.set(t.id, Number(t.default_days));
    } else {
      capByType.set(t.id, null);
    }
  }

  return { tiersByType, poolByType, capByType, defaultDaysByType, annualTypeId, types };
}

const round2 = (n) => Math.round(n * 100) / 100;
