/**
 * Turning a model's draft into a letter you can put on letterhead.
 *
 * Two things the AI gets wrong on every run, and neither is the model's fault —
 * it was never told the answer:
 *
 * **The date.** Nothing in the prompt said what day it is, so the draft comes back
 * with "Date: [Insert Date]". A salary certificate that reaches a bank with a
 * placeholder where the date belongs is not a document, it is an embarrassment.
 * The issue date is now supplied, and anything the model still leaves in square
 * brackets that looks like a date is replaced with it.
 *
 * **Gender.** The model has only a name to go on, so it guesses — and half the
 * time it guesses wrong. On a letter addressed to a bank, calling an employee
 * "she" when he is not is a factual error in an official record, and there is no
 * version of this where guessing is acceptable. The `employees.gender` column
 * exists but is largely empty, so it cannot be relied on either.
 *
 * The answer is to write letters that never raise the question. Formal English
 * has a perfectly good register for this: name the person, or say "the employee".
 * "The current monthly basic salary is AED 25,000" says everything
 * "Her current monthly basic salary is AED 25,000" does, and cannot be wrong.
 *
 * The prompt asks for that. `neutralizeGender` is the net underneath — the model
 * slips, and a slip here is a document with a mistake in it going out under the
 * company's letterhead.
 */

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

const escapeRe = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * `2026-09-09` → `9 September 2026`.
 *
 * Parsed by hand rather than through `new Date(str)`, which reads a bare date as
 * UTC midnight and then reports the day before in any timezone west of Greenwich.
 * A letter dated one day early is a letter with the wrong date on it.
 *
 * @param {string|Date|null} value ISO date, or anything falsy for today
 * @returns {string} the date as it should be read, or '' if unparseable
 */
export function formatLetterDate(value) {
  let iso;
  if (!value) {
    const now = new Date();
    iso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  } else if (value instanceof Date) {
    iso = `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
  } else {
    iso = String(value);
  }
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return '';
  const month = MONTHS[Number(m[2]) - 1];
  if (!month) return '';
  return `${Number(m[3])} ${month} ${Number(m[1])}`;
}

/** Today, as the form's date input wants it. */
export function todayIso() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
}

/** Keeps the replacement's capitalisation in step with what it replaced. */
const cased = (matched, replacement) => (
  /^[A-Z]/.test(matched)
    ? replacement.charAt(0).toUpperCase() + replacement.slice(1)
    : replacement
);

// Order matters: the combined forms ("he/she", "his or her") must go before the
// single words, or the single-word rules would chew them up halfway.
const PRONOUN_RULES = [
  [/\b(?:he|she)\s*\/\s*(?:he|she)\b/gi, 'the employee'],
  [/\(\s*s\s*\)\s*he\b/gi, 'the employee'],
  [/\bs\s*\/\s*he\b/gi, 'the employee'],
  [/\b(?:he|she)\s+or\s+(?:he|she)\b/gi, 'the employee'],
  [/\b(?:his|her)\s*\/\s*(?:his|her)\b/gi, "the employee's"],
  [/\b(?:his|her)\s+or\s+(?:his|her)\b/gi, "the employee's"],
  [/\b(?:him|her)\s*\/\s*(?:him|her)\b/gi, 'the employee'],
  [/\b(?:himself|herself)\s*\/\s*(?:himself|herself)\b/gi, 'themselves'],
  [/\b(?:himself|herself)\b/gi, 'themselves'],
  [/\b(?:he|she)\b/gi, 'the employee'],
  [/\bhis\b/gi, "the employee's"],
  [/\bhim\b/gi, 'the employee'],
];

/**
 * `her` is the one that cannot be decided by the word alone: possessive in
 * "her salary", object in "issued to her." Followed by another word it is
 * almost always the possessive; followed by punctuation or the end of a line
 * it is the object.
 */
function resolveHer(text) {
  return text.replace(/\bher\b(\s*)/gi, (match, trail, offset, whole) => {
    const rest = whole.slice(offset + match.length);
    const possessive = /^[A-Za-z]/.test(rest) && /\s/.test(trail);
    const word = match.trimEnd();
    return cased(word, possessive ? "the employee's" : 'the employee') + trail;
  });
}

/**
 * Drops an honorific only where it sits directly in front of the employee's own
 * name. "Dear Sir/Madam" and a title in front of the *recipient's* name are
 * correct formality and are left exactly as written.
 */
function stripHonorifics(text, name) {
  const trimmed = String(name || '').trim();
  if (!trimmed) return text;
  const parts = trimmed.split(/\s+/).filter(Boolean);
  const targets = [escapeRe(trimmed), escapeRe(parts[0])];
  const re = new RegExp(`\\b(?:Mr|Mrs|Ms|Miss|Mstr)\\.?\\s+(?=(?:${targets.join('|')})\\b)`, 'gi');
  return text.replace(re, '');
}

/**
 * Removes every gendered reference to the employee from a drafted letter.
 *
 * @param {string} text the drafted body
 * @param {{name?: string}} [opts] the employee's name, so an honorific in front
 *   of it can be told apart from one in front of the recipient's
 */
export function neutralizeGender(text, { name } = {}) {
  if (!text) return text;
  let out = String(text);
  out = stripHonorifics(out, name);
  for (const [re, replacement] of PRONOUN_RULES) {
    out = out.replace(re, (m) => cased(m, replacement));
  }
  out = resolveHer(out);
  return out;
}

/**
 * Fills the placeholders the model leaves behind, and guarantees the letter
 * carries a date.
 *
 * Only placeholders we actually hold a value for are filled. One we cannot fill
 * is left visible in its brackets rather than quietly deleted — a gap somebody
 * can see is a gap somebody can fix, and an official letter missing a sentence
 * without saying so is worse than one that shows its seam.
 *
 * @param {string} text drafted body
 * @param {object} values `{ date, employee_name, company_name, job_title, department }`
 */
export function fillPlaceholders(text, values = {}) {
  if (!text) return text;
  const { date } = values;
  let out = String(text);

  // Anything bracketed that mentions a date: [Insert Date], [DATE], [Today's Date].
  if (date) out = out.replace(/\[[^\]\n]{0,40}date[^\]\n]{0,20}\]/gi, date);

  const named = [
    [/\[[^\]\n]{0,10}employee\s*name[^\]\n]{0,10}\]/gi, values.employee_name],
    [/\[[^\]\n]{0,10}company\s*name[^\]\n]{0,10}\]/gi, values.company_name],
    [/\[[^\]\n]{0,10}job\s*title[^\]\n]{0,10}\]/gi, values.job_title],
    [/\[[^\]\n]{0,10}(?:position|designation)[^\]\n]{0,10}\]/gi, values.job_title],
    [/\[[^\]\n]{0,10}department[^\]\n]{0,10}\]/gi, values.department],
  ];
  for (const [re, value] of named) {
    if (value) out = out.replace(re, String(value));
  }
  return out;
}

/**
 * Puts a date at the head of the letter when the draft came back without one.
 *
 * What counts is a date *line* in the opening block — "Date: 9 September 2026",
 * or the date standing alone. A date inside a sentence does not count, however
 * near the top it appears: "has been with us since 1 January 2012" is the start
 * date, and treating it as the letter's own would leave the letter undated while
 * looking like it wasn't. A certificate with no date on it cannot be relied on
 * by whoever receives it.
 */
export function ensureDated(text, date) {
  if (!date) return text;
  const body = String(text || '');
  const head = body.split('\n').slice(0, 6);
  const dated = head.some((line) => (
    /^\s*date\s*[:\-–]/i.test(line)
    || new RegExp(`^\\s*${escapeRe(date)}\\s*$`).test(line)
  ));
  if (dated) return body;
  return `Date: ${date}\n\n${body.replace(/^\n+/, '')}`;
}

/**
 * The whole pass, in the order it has to happen: fill what the model left blank,
 * strip what it should not have guessed, then make sure the thing is dated.
 */
export function finalizeLetter(text, values = {}) {
  let out = fillPlaceholders(text, values);
  out = neutralizeGender(out, { name: values.employee_name });
  out = ensureDated(out, values.date);
  return out.trim();
}
