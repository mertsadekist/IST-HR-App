/**
 * Minimal dependency-free request validator.
 *
 * Usage:
 *   router.post('/', validate({
 *     username: { required: true, type: 'string', minLen: 3, maxLen: 100 },
 *     email:    { type: 'email' },
 *     role:     { type: 'string', enum: ['admin','employee'] },
 *     salary:   { type: 'number', min: 0 },
 *   }), handler)
 *
 * On failure responds 422 { error, errors: [{ field, message }] }.
 * Rule keys: required, type ('string'|'number'|'integer'|'email'|'phone'|'date'|'boolean'|'array'),
 *            enum, min, max (numbers), minLen, maxLen (strings/arrays), pattern (RegExp).
 *
 * This is intentionally small. It can be replaced by zod/joi later without
 * changing the call sites (audit API-001).
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[+]?[\d\s().-]{6,20}$/;

// Numeric helpers — HTML form inputs always submit strings, so a "number"
// field arrives as e.g. "7000". Accept numeric strings (and coerce on read).
const isNumeric = (v) =>
  typeof v === 'number' ? !Number.isNaN(v)
    : (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v)));
const isIntegerLike = (v) => isNumeric(v) && Number.isInteger(Number(v));

function checkType(value, type) {
  switch (type) {
    case 'string': return typeof value === 'string';
    case 'number': return isNumeric(value);
    case 'integer': return isIntegerLike(value);
    case 'boolean': return typeof value === 'boolean' || value === 'true' || value === 'false';
    case 'array': return Array.isArray(value);
    case 'email': return typeof value === 'string' && EMAIL_RE.test(value);
    case 'phone': return typeof value === 'string' && PHONE_RE.test(value);
    case 'date': return !Number.isNaN(new Date(value).getTime());
    default: return true;
  }
}

export function validate(schema, source = 'body') {
  return (req, res, next) => {
    const data = req[source] || {};
    const errors = [];

    for (const [field, rule] of Object.entries(schema)) {
      const value = data[field];
      const present = value !== undefined && value !== null && value !== '';

      if (rule.required && !present) {
        errors.push({ field, message: `${field} is required` });
        continue;
      }
      if (!present) continue; // optional & absent → skip remaining checks

      if (rule.type && !checkType(value, rule.type)) {
        errors.push({ field, message: `${field} must be a valid ${rule.type}` });
        continue;
      }
      if (rule.enum && !rule.enum.includes(value)) {
        errors.push({ field, message: `${field} must be one of: ${rule.enum.join(', ')}` });
      }
      if (typeof rule.min === 'number' && Number(value) < rule.min) {
        errors.push({ field, message: `${field} must be >= ${rule.min}` });
      }
      if (typeof rule.max === 'number' && Number(value) > rule.max) {
        errors.push({ field, message: `${field} must be <= ${rule.max}` });
      }
      if (typeof rule.minLen === 'number' && String(value).length < rule.minLen) {
        errors.push({ field, message: `${field} must be at least ${rule.minLen} characters` });
      }
      if (typeof rule.maxLen === 'number' && String(value).length > rule.maxLen) {
        errors.push({ field, message: `${field} must be at most ${rule.maxLen} characters` });
      }
      if (rule.pattern instanceof RegExp && !rule.pattern.test(String(value))) {
        errors.push({ field, message: `${field} has an invalid format` });
      }
    }

    if (errors.length) {
      return res.status(422).json({ error: 'Validation failed', errors });
    }
    next();
  };
}
