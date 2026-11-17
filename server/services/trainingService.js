/**
 * Training: a course catalogue, each employee's completed trainings with the
 * certificate and when it runs out, and the skills they hold.
 *
 * A course with a validity (first aid: 24 months) gives every completion an
 * expiry date, and certificates are warned about before they lapse on the same
 * thresholds as passports and visas. A mandatory course is one every current
 * employee should hold a valid certificate for; who does not shows on the
 * training page.
 *
 * Pure functions here; the routes do the storing.
 */

export const SKILL_LEVELS = [1, 2, 3, 4, 5];
const isDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) && !Number.isNaN(Date.parse(v));
const text = (v, max) => String(v ?? '').trim().slice(0, max);

export function validateCourse(b = {}) {
  const name = text(b.name, 200);
  if (!name) return { error: 'Name the course' };
  const months = b.validity_months === '' || b.validity_months == null ? null : Math.round(Number(b.validity_months));
  if (months != null && !(months >= 1 && months <= 120)) return { error: 'Validity is 1 to 120 months, or empty for no expiry' };
  return { data: { name, provider: text(b.provider, 200) || null, validity_months: months, mandatory: b.mandatory ? 1 : 0 } };
}

/** The date `months` after `date`, the day before the same day-of-month (a 12-month cert from 2026-03-15 runs to 2027-03-14). */
export function expiresFrom(date, months) {
  if (!isDate(date) || !months) return null;
  const [y, m, d] = date.split('-').map(Number);
  const target = new Date(Date.UTC(y, m - 1 + Number(months), 1));
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  const day = Math.min(d, last);
  const end = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), day) - 86_400_000);
  return end.toISOString().slice(0, 10);
}

/** Validate a completed training; the expiry defaults from the course's validity. */
export function validateTraining(b = {}, course, today = new Date().toISOString().slice(0, 10)) {
  if (!course) return { error: 'Choose the course' };
  if (!isDate(b.completed_on)) return { error: 'Enter the completion date' };
  if (b.completed_on > today) return { error: 'The completion date cannot be in the future' };
  let expires = b.expires_on === undefined || b.expires_on === '' ? expiresFrom(b.completed_on, course.validity_months) : b.expires_on;
  if (expires != null && !isDate(expires)) return { error: 'Invalid expiry date' };
  if (expires && expires < b.completed_on) return { error: 'The expiry is before the completion date' };
  if (expires === undefined) expires = null;
  return { data: { completed_on: b.completed_on, expires_on: expires, result: text(b.result, 100) || null, notes: text(b.notes, 500) || null } };
}

/** 'valid' | 'expiring' (within 60 days) | 'expired' | 'no_expiry' */
export function trainingState(expiresOn, today) {
  if (!expiresOn) return 'no_expiry';
  if (expiresOn < today) return 'expired';
  const days = Math.round((Date.parse(expiresOn) - Date.parse(today)) / 86_400_000);
  return days <= 60 ? 'expiring' : 'valid';
}

/**
 * Mandatory courses a person has no valid certificate for.
 * @param {{id:number, name:string}[]} mandatory
 * @param {{course_id:number, expires_on:string|null}[]} records that person's trainings
 * @returns {{course_id:number, name:string, reason:'missing'|'expired'}[]}
 */
export function mandatoryGaps(mandatory, records, today) {
  const out = [];
  for (const c of mandatory) {
    const mine = records.filter((r) => r.course_id === c.id);
    if (!mine.length) { out.push({ course_id: c.id, name: c.name, reason: 'missing' }); continue; }
    const valid = mine.some((r) => !r.expires_on || r.expires_on >= today);
    if (!valid) out.push({ course_id: c.id, name: c.name, reason: 'expired' });
  }
  return out;
}

/** Clean a skills list from the profile form: [{ skill_id, level }]. */
export function validateSkills(list) {
  if (!Array.isArray(list)) return { error: 'Skills must be a list' };
  if (list.length > 100) return { error: 'Too many skills' };
  const seen = new Set();
  const out = [];
  for (const s of list) {
    const id = Number(s?.skill_id);
    const level = Math.round(Number(s?.level));
    if (!Number.isInteger(id) || id <= 0) return { error: 'Unknown skill' };
    if (!SKILL_LEVELS.includes(level)) return { error: 'Level is 1 to 5' };
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({ skill_id: id, level });
  }
  return { data: out };
}
