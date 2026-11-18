/**
 * Benefits: medical insurance and the air ticket.
 *
 *   insurance  a company's group policies (provider, number, period), and each
 *              employee's enrolment on one: category, card number, dates and
 *              the dependents covered
 *   air ticket an entitlement per employee (every N months, class, destination,
 *              a cap); each use is recorded — a booked ticket, or cash in lieu
 *              paid through payroll — and the next one falls due N months after
 *              the last, or after the entitlement starts
 *
 * Pure functions here; routes/benefits.js does the storing.
 */

export const TICKET_CLASSES = ['Economy', 'Premium Economy', 'Business'];
export const TICKET_MODES = ['Ticket', 'Cash'];
export const DEPENDENT_RELATIONS = ['Spouse', 'Child', 'Parent', 'Other'];

const isDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) && !Number.isNaN(Date.parse(v));
const text = (v, max) => String(v ?? '').trim().slice(0, max);
const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

export function validatePolicy(b = {}) {
  const provider = text(b.provider, 150);
  if (!provider) return { error: 'Name the insurer' };
  if (!isDate(b.start_date) || !isDate(b.end_date) || b.end_date < b.start_date) return { error: 'Enter the policy period' };
  return {
    data: {
      provider, policy_number: text(b.policy_number, 80) || null, plan_name: text(b.plan_name, 120) || null,
      start_date: b.start_date, end_date: b.end_date, notes: text(b.notes, 500) || null,
    },
  };
}

/** An employee's enrolment, with the dependents covered. */
export function validateEnrolment(b = {}) {
  if (!Number(b.policy_id)) return { error: 'Choose the policy' };
  if (b.start_date && !isDate(b.start_date)) return { error: 'Invalid start date' };
  if (b.end_date && !isDate(b.end_date)) return { error: 'Invalid end date' };
  if (b.start_date && b.end_date && b.end_date < b.start_date) return { error: 'The cover ends before it starts' };
  const deps = Array.isArray(b.dependents) ? b.dependents : [];
  if (deps.length > 10) return { error: 'At most 10 dependents' };
  const dependents = [];
  for (const d of deps) {
    const name = text(d?.name, 120);
    if (!name) return { error: 'Every dependent needs a name' };
    if (!DEPENDENT_RELATIONS.includes(d.relation)) return { error: 'Choose each dependent’s relation' };
    if (d.dob && !isDate(d.dob)) return { error: 'Invalid date of birth' };
    dependents.push({ name, relation: d.relation, dob: d.dob || null, card_number: text(d.card_number, 60) || null });
  }
  const premium = b.premium === '' || b.premium == null ? null : round2(b.premium);
  if (premium != null && !(premium >= 0)) return { error: 'Invalid premium' };
  return {
    data: {
      policy_id: Number(b.policy_id), category: text(b.category, 60) || null, card_number: text(b.card_number, 60) || null,
      start_date: b.start_date || null, end_date: b.end_date || null, premium, dependents,
    },
  };
}

export function validateEntitlement(b = {}) {
  const months = Math.round(Number(b.frequency_months));
  if (![12, 24].includes(months)) return { error: 'Every 12 or 24 months' };
  const cls = TICKET_CLASSES.includes(b.ticket_class) ? b.ticket_class : 'Economy';
  if (!isDate(b.start_from)) return { error: 'Enter when the entitlement starts' };
  const cap = b.max_amount === '' || b.max_amount == null ? null : round2(b.max_amount);
  if (cap != null && !(cap > 0)) return { error: 'Invalid amount' };
  const deps = Math.round(Number(b.dependents_count || 0));
  if (!(deps >= 0 && deps <= 10)) return { error: 'Dependents 0 to 10' };
  return {
    data: {
      frequency_months: months, ticket_class: cls, destination: text(b.destination, 120) || null,
      max_amount: cap, dependents_count: deps, start_from: b.start_from, notes: text(b.notes, 500) || null,
    },
  };
}

/** `date` plus whole months, clamped to the end of a shorter month. */
export function addMonths(date, months) {
  const [y, m, d] = date.split('-').map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  return new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), Math.min(d, last))).toISOString().slice(0, 10);
}

/**
 * When the next ticket falls due: N months after the last one used, or after
 * the entitlement starts when none has been used.
 */
export function nextTicketDue(entitlement, lastUsedOn) {
  if (!entitlement) return null;
  const base = lastUsedOn && lastUsedOn >= entitlement.start_from ? lastUsedOn : entitlement.start_from;
  return addMonths(base, entitlement.frequency_months);
}

export function validateUsage(b = {}, entitlement, today = new Date().toISOString().slice(0, 10)) {
  if (!entitlement) return { error: 'Set the entitlement first' };
  if (!isDate(b.used_on) || b.used_on > today) return { error: 'Enter the date (not in the future)' };
  if (!TICKET_MODES.includes(b.mode)) return { error: 'Ticket or cash?' };
  const amount = round2(b.amount);
  if (!(amount > 0)) return { error: 'Enter the amount' };
  if (entitlement.max_amount != null && amount > Number(entitlement.max_amount)) return { error: `More than the cap of ${entitlement.max_amount}` };
  if (b.mode === 'Cash' && !/^\d{4}-(0[1-9]|1[0-2])$/.test(b.period || '')) return { error: 'Choose the payroll month for the cash' };
  return { data: { used_on: b.used_on, mode: b.mode, amount, period: b.mode === 'Cash' ? b.period : null, notes: text(b.notes, 300) || null } };
}
