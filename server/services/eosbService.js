/**
 * UAE End-of-Service Benefit (gratuity) calculator.
 *
 * Pure, deterministic, and unit-tested. Returns a full breakdown so the result
 * can be shown to HR and audited, instead of a single opaque number.
 *
 * Rules (UAE Labour Law — unlimited/standard contract baseline):
 *  - Service < 1 year  → no gratuity.
 *  - First 5 years     → 21 days of basic wage per year.
 *  - Beyond 5 years    → 30 days of basic wage per year.
 *  - Daily wage        → basic monthly salary / 30.
 *  - Total gratuity capped at 2 years' total (basic) wage.
 *  - Unpaid leave days are excluded from the service period.
 *  - Resignation reductions: under the post-2022 law resignation no longer
 *    reduces gratuity for standard contracts (default). A legacy tiered model
 *    is available via opts.applyLegacyResignationReduction for older contracts:
 *      < 1y: none, 1–3y: 1/3, 3–5y: 2/3, > 5y: full.
 *
 * All monetary values are returned rounded to 2 decimals.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * @param {Object} input
 * @param {string|Date} input.startDate         employment start date
 * @param {string|Date} input.lastWorkingDay    last working day
 * @param {number}      input.basicSalary        monthly BASIC salary (gratuity base)
 * @param {string}      [input.departureType]    'Resignation' | 'Termination' | 'End of Contract' | 'Mutual Agreement'
 * @param {number}      [input.unpaidLeaveDays]  unpaid leave days to exclude from service
 * @param {Object}      [opts]
 * @param {boolean}     [opts.applyLegacyResignationReduction=false]
 * @returns {Object} breakdown
 */
export function calculateEOSB(input, opts = {}) {
  const {
    startDate,
    lastWorkingDay,
    basicSalary,
    departureType = 'Termination',
    unpaidLeaveDays = 0,
  } = input;

  const start = new Date(startDate);
  const end = new Date(lastWorkingDay);
  const basic = Number(basicSalary) || 0;
  const applyLegacy = !!opts.applyLegacyResignationReduction;

  const breakdown = {
    eligible: false,
    reason: null,
    departure_type: departureType,
    basic_salary: round2(basic),
    daily_wage: round2(basic / 30),
    service_days: 0,
    service_years: 0,
    unpaid_leave_days: Number(unpaidLeaveDays) || 0,
    gratuity_days: 0,
    gross_gratuity: 0,
    reduction_factor: 1,
    eosb_amount: 0,
    cap_applied: false,
  };

  // Validate inputs
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    breakdown.reason = 'Invalid start date or last working day';
    return breakdown;
  }
  if (end <= start) {
    breakdown.reason = 'Last working day must be after the start date';
    return breakdown;
  }
  if (basic <= 0) {
    breakdown.reason = 'Basic salary must be greater than zero';
    return breakdown;
  }

  const rawServiceDays = Math.floor((end - start) / MS_PER_DAY);
  const serviceDays = Math.max(0, rawServiceDays - (Number(unpaidLeaveDays) || 0));
  const serviceYears = serviceDays / 365.25;

  breakdown.service_days = serviceDays;
  breakdown.service_years = round2(serviceYears);

  // Less than one year of service → no gratuity
  if (serviceYears < 1) {
    breakdown.reason = 'Less than one year of service — not eligible for gratuity';
    return breakdown;
  }

  const dailyWage = basic / 30;

  // 21 days/year for the first 5 years, 30 days/year thereafter
  const firstPeriodYears = Math.min(serviceYears, 5);
  const beyondYears = Math.max(0, serviceYears - 5);
  const gratuityDays = firstPeriodYears * 21 + beyondYears * 30;

  let grossGratuity = gratuityDays * dailyWage;

  // Legacy resignation reduction (only for older contracts when explicitly requested)
  let reductionFactor = 1;
  if (applyLegacy && departureType === 'Resignation') {
    if (serviceYears < 3) reductionFactor = 1 / 3;
    else if (serviceYears < 5) reductionFactor = 2 / 3;
    else reductionFactor = 1;
  }

  let eosb = grossGratuity * reductionFactor;

  // Cap at 2 years' total basic wage
  const cap = basic * 24;
  let capApplied = false;
  if (eosb > cap) {
    eosb = cap;
    capApplied = true;
  }

  breakdown.eligible = true;
  breakdown.gratuity_days = round2(gratuityDays);
  breakdown.gross_gratuity = round2(grossGratuity);
  breakdown.reduction_factor = round2(reductionFactor);
  breakdown.eosb_amount = round2(eosb);
  breakdown.cap_applied = capApplied;
  return breakdown;
}
