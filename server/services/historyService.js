/**
 * Record history: what changed on a record, field by field.
 *
 * Audit rows carry the record they are about (entity_type, entity_id) and, for
 * edits, the changed fields with the value before and after. Sensitive values
 * (bank account numbers, IBANs) are stored masked — the history says that it
 * changed and its last digits, never the full number.
 */

export const MASKED_FIELDS = ['iban', 'account_number'];

const norm = (v) => {
  if (v === undefined || v === null || v === '') return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (typeof v === 'number') return v;
  const s = String(v);
  // Dates read back as 'YYYY-MM-DDT…' compare by their day.
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return s.slice(0, 10);
  // Numbers read back as strings from DECIMAL columns.
  if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
  return s;
};

/** Mask all but the last 4 characters. */
export function mask(v) {
  if (v == null || v === '') return null;
  const s = String(v).replace(/\s+/g, '');
  return s.length <= 4 ? '••••' : `••••${s.slice(-4)}`;
}

/**
 * The fields of `after` that differ from `before`.
 * @param {object} before the row as it was (null for a new record)
 * @param {object} after  the values written
 * @param {string[]} [fields] limit to these; default every key of `after`
 * @returns {{field:string, from:any, to:any}[]}
 */
export function diffFields(before, after, fields) {
  const out = [];
  for (const f of fields || Object.keys(after || {})) {
    if (!(f in (after || {}))) continue;
    const a = norm(before ? before[f] : null);
    const b = norm(after[f]);
    if (a === b) continue;
    const sensitive = MASKED_FIELDS.includes(f);
    out.push({ field: f, from: sensitive ? mask(a) : a, to: sensitive ? mask(b) : b });
  }
  return out;
}
