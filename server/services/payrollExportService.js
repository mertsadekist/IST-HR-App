/**
 * Payroll exports that leave the system: the bank's WPS SIF file and the
 * accounting journal for Zoho Books.
 *
 * Both are pure functions over a run's data so they can be tested without a
 * database. The settings they need (bank routing codes, the employer's WPS
 * identity per company, the Zoho account names) are kept in one app setting,
 * `payroll_exports`, edited from Settings → Payroll exports.
 */

const money = (v) => Math.round((Number(v) || 0) * 100) / 100;
const fixed2 = (v) => money(v).toFixed(2);
const digits = (v) => String(v ?? '').replace(/\D/g, '');

export const DEFAULT_EXPORT_SETTINGS = Object.freeze({
  // IBAN bank code (3 digits, IBAN characters 5–7) → the bank's 9-digit WPS routing code.
  routing_codes: {},
  // Per company id: { employer_id (13 digits; defaults to the MOL id padded), bank_routing_code (the paying bank, e.g. Wio) }.
  companies: {},
  zoho: {
    payable_account: 'Salaries Payable',
    expense_account: 'Salaries and Employee Wages',
    deduction_account: 'Employee Advances',
    pension_payable_account: 'GPSSA Payable',
    pension_expense_account: 'Employer Pension Contributions',
    // Line code → account, overriding the defaults above (BASIC, HOUSING, OVERTIME_PAY, LOAN, ...).
    accounts: {},
    cost_centre: 'department', // 'department' | 'none'
    reference_prefix: 'PAYROLL',
  },
});

/** Settings as stored (a JSON string or object) merged over the defaults. */
export function normalizeExportSettings(raw) {
  let s = raw;
  if (typeof s === 'string') { try { s = JSON.parse(s); } catch { s = {}; } }
  s = s && typeof s === 'object' ? s : {};
  const d = DEFAULT_EXPORT_SETTINGS;
  const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
  return {
    routing_codes: { ...obj(s.routing_codes) },
    companies: { ...obj(s.companies) },
    zoho: { ...d.zoho, ...obj(s.zoho), accounts: { ...obj(s.zoho?.accounts) } },
  };
}

/** @returns {string|null} the first problem found, or null when the settings are valid. */
export function validateExportSettings(s) {
  for (const [code, routing] of Object.entries(s.routing_codes)) {
    if (!/^\d{3}$/.test(code)) return `Bank code "${code}" must be the 3 digits from the IBAN`;
    if (!/^\d{9}$/.test(String(routing))) return `Routing code for bank ${code} must be 9 digits`;
  }
  for (const [id, c] of Object.entries(s.companies)) {
    if (c.employer_id && !/^\d{1,13}$/.test(String(c.employer_id))) return `Employer ID for company ${id} must be up to 13 digits`;
    if (c.bank_routing_code && !/^\d{9}$/.test(String(c.bank_routing_code))) return `Bank routing code for company ${id} must be 9 digits`;
  }
  const z = s.zoho;
  if (!String(z.payable_account || '').trim() || !String(z.expense_account || '').trim()) return 'The payable and expense accounts are required';
  if (!['department', 'none'].includes(z.cost_centre)) return 'Cost centre must be department or none';
  return null;
}

/** "AE07 0331 2345 6789 0123 456" → "033": the bank code inside a UAE IBAN. */
export function bankCodeFromIban(iban) {
  const s = String(iban || '').replace(/\s+/g, '').toUpperCase();
  return /^AE\d{21}$/.test(s) ? s.slice(4, 7) : null;
}

/** The WPS identity of the paying company: 13-digit employer id and its bank's routing code. */
export function employerFor(company, settings) {
  const c = settings.companies[String(company?.id)] || {};
  const id = digits(c.employer_id || company?.mol_id);
  return {
    employer_id: id ? id.padStart(13, '0').slice(-13) : '',
    bank_routing_code: digits(c.bank_routing_code),
  };
}

const pad2 = (n) => String(n).padStart(2, '0');
const daysInPeriod = (period) => {
  const [y, m] = String(period).split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
};

/**
 * What stops the SIF from being produced: the employer's identity and each
 * included employee's 14-digit personal number, IBAN and a routing code for
 * their bank. `items` are the ones the WPS file includes (issued contracts).
 */
export function sifReadiness({ company, items, settings }) {
  const emp = employerFor(company, settings);
  const companyIssues = [];
  if (!emp.employer_id) companyIssues.push('EMPLOYER_ID');
  if (!emp.bank_routing_code) companyIssues.push('EMPLOYER_ROUTING');
  const employeeIssues = [];
  const unknownBanks = new Set();
  for (const it of items) {
    const missing = [];
    if (digits(it.personal_no).length !== 14) missing.push('PERSONAL_NO');
    const code = bankCodeFromIban(it.iban);
    if (!code) missing.push('IBAN');
    else if (!settings.routing_codes[code]) { missing.push('ROUTING'); unknownBanks.add(code); }
    if (missing.length) employeeIssues.push({ employee_id: it.employee_id, name: `${it.first_name || ''} ${it.last_name || ''}`.trim(), missing });
  }
  return {
    companyIssues, employeeIssues, unknown_bank_codes: [...unknownBanks].sort(),
    ready: !companyIssues.length && !employeeIssues.length && items.length > 0,
  };
}

/**
 * The Salary Information File, in the Central Bank's WPS layout: one EDR line
 * per employee and a closing SCR line.
 *
 *   EDR,<personal no 14>,<employee bank routing 9>,<IBAN>,<start>,<end>,<days>,<fixed>,<variable>,<days on leave>
 *   SCR,<employer id 13>,<employer bank routing 9>,<YYYY-MM-DD>,<HHMM>,<MMYYYY>,<EDR count>,<total>,AED,<reference>
 *
 * Fixed + variable is exactly what is transferred (the net), so the SCR total
 * equals the bank instruction. Variable is the month's additions, capped at net.
 */
export function buildSif({ company, period, items, settings, now = new Date(), reference = '' }) {
  const emp = employerFor(company, settings);
  const [y, m] = String(period).split('-');
  const start = `${y}-${m}-01`;
  const days = daysInPeriod(period);
  const end = `${y}-${m}-${pad2(days)}`;
  const lines = [];
  let total = 0;
  for (const it of items) {
    const net = money(it.net);
    const variable = Math.min(money(it.variable), net);
    const fixedPart = money(net - variable);
    total = money(total + net);
    const iban = String(it.iban || '').replace(/\s+/g, '').toUpperCase();
    const leaveDays = Math.round((Number(it.absence_days) || 0) + (Number(it.unpaid_leave_days) || 0));
    lines.push(['EDR', digits(it.personal_no).padStart(14, '0'), settings.routing_codes[bankCodeFromIban(iban)] || '',
      iban, start, end, days, fixed2(fixedPart), fixed2(variable), leaveDays].join(','));
  }
  const date = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
  const time = `${pad2(now.getHours())}${pad2(now.getMinutes())}`;
  lines.push(['SCR', emp.employer_id, emp.bank_routing_code, date, time, `${m}${y}`, items.length,
    fixed2(total), 'AED', String(reference).replace(/[,\r\n]/g, ' ').slice(0, 35)].join(','));
  const stamp = `${String(now.getFullYear()).slice(2)}${pad2(now.getMonth() + 1)}${pad2(now.getDate())}`
    + `${pad2(now.getHours())}${pad2(now.getMinutes())}${pad2(now.getSeconds())}`;
  return {
    content: lines.join('\r\n') + '\r\n',
    fileName: `${emp.employer_id}${stamp}.SIF`,
    total, count: items.length,
  };
}

const csvCell = (v) => {
  const s = String(v ?? '');
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/**
 * A Zoho Books manual journal (CSV for Journals → Import) for one payroll run.
 *
 * Earnings are debited to their expense account, deductions credited to theirs
 * (leave and absence reduce the salary expense; loans and advances go to the
 * receivable account), and the net is credited to Salaries Payable. Lines are
 * summed per account and cost centre, so the journal stays short and balanced.
 *
 * @param {{run:{id:number,period:string}, company:{name:string},
 *   lines:{employee_id:number,kind:'earning'|'deduction',code:string,amount:number,department:string|null}[],
 *   settings:object, journalDate:string}} input
 */
export function buildZohoJournal({ run, company, lines, settings, journalDate }) {
  const z = settings.zoho;
  const accountFor = (l) => {
    if (z.accounts[l.code]) return z.accounts[l.code];
    if (l.kind === 'earning') return z.expense_account;
    if (l.code === 'PENSION') return z.pension_payable_account;
    return ['LEAVE', 'ABSENCE'].includes(l.code) ? z.expense_account : z.deduction_account;
  };
  const bucket = new Map();
  const add = (account, centre, debit, credit) => {
    const key = `${account}\u0000${centre}`;
    const b = bucket.get(key) || { account, centre, debit: 0, credit: 0 };
    b.debit = money(b.debit + debit); b.credit = money(b.credit + credit);
    bucket.set(key, b);
  };
  let payable = 0;
  for (const l of lines) {
    const amt = money(l.amount);
    if (!amt) continue;
    const centre = z.cost_centre === 'department' ? (l.department || '') : '';
    // The employer's pension share: an expense, owed to the GPSSA, not to the employee.
    if (l.kind === 'employer') { add(z.accounts[l.code] || z.pension_expense_account, centre, amt, 0); add(z.pension_payable_account, '', 0, amt); }
    else if (l.kind === 'earning') { add(accountFor(l), centre, amt, 0); payable = money(payable + amt); }
    else { add(accountFor(l), centre, 0, amt); payable = money(payable - amt); }
  }
  add(z.payable_account, '', 0, payable);

  // Netting each bucket keeps a leave deduction from appearing as both a debit
  // and a credit to the same expense account.
  const rows = [...bucket.values()].map((b) => {
    const net = money(b.debit - b.credit);
    return { ...b, debit: net > 0 ? net : 0, credit: net < 0 ? -net : 0 };
  }).filter((b) => b.debit || b.credit)
    .sort((a, b) => (b.debit - a.debit) || a.account.localeCompare(b.account) || a.centre.localeCompare(b.centre));

  const reference = `${z.reference_prefix || 'PAYROLL'}-${run.period}-${run.id}`;
  const notes = `Payroll ${run.period} — ${company?.name || ''}`.trim();
  const header = ['Journal Date', 'Reference Number', 'Notes', 'Journal Type', 'Currency', 'Account', 'Description', 'Cost Centre', 'Debit', 'Credit'];
  const out = [header.join(',')];
  for (const r of rows) {
    out.push([journalDate, reference, notes, 'both', 'AED', r.account,
      r.centre ? `Payroll ${run.period} — ${r.centre}` : `Payroll ${run.period}`,
      r.centre, r.debit ? fixed2(r.debit) : '', r.credit ? fixed2(r.credit) : ''].map(csvCell).join(','));
  }
  const totalDebit = money(rows.reduce((s, r) => s + r.debit, 0));
  const totalCredit = money(rows.reduce((s, r) => s + r.credit, 0));
  return {
    content: '﻿' + out.join('\r\n') + '\r\n',
    fileName: `Zoho-Journal-${(company?.name || 'company').replace(/[^\w-]+/g, '_')}-${run.period}.csv`,
    rows, totalDebit, totalCredit, balanced: totalDebit === totalCredit, reference,
  };
}
