/**
 * UAE Wage Protection System (WPS) salary file.
 *
 * Produces the workbook the company submits to the Ministry of Labour / the
 * processing bank. The layout mirrors the official sheet exactly — it is read
 * by people and by the bank's intake process, so the row positions, the merged
 * "Employee's Net Salary" header group and the total line are all fixed.
 *
 * Column semantics were derived from the company's own submitted July file,
 * where the printed "Total in Dirhams" (91,516.67) equals the sum of the Total
 * Payment column and not the Fixed column:
 *   Fixed Portion    = the employee's contractual monthly salary (payroll gross)
 *   Variable Portion = commissions / overtime — 0 until payroll models them
 *   Total Payment    = what is actually transferred this month (payroll net)
 *
 * Identifiers are written as TEXT, never numbers: work permit, personal number
 * and IBAN are fixed-width digit strings whose leading zeros are significant
 * (e.g. personal no 00411089670224 would become 411089670224 as a number).
 */
import XLSX from 'xlsx';

const money = (v) => Math.round((Number(v) || 0) * 100) / 100;

/** A cell holding an identifier — forced to text so leading zeros survive. */
const txt = (v) => ({ v: v == null ? '' : String(v), t: 's' });
const num = (v) => ({ v: money(v), t: 'n', z: '0.00' });

/**
 * Which employees can't be submitted yet, and exactly why. Surfaced before the
 * download so a file is never sent with blank mandatory identifiers.
 */
export function wpsReadiness({ company, items }) {
  const companyIssues = [];
  if (!company?.mol_id) companyIssues.push('Company MOL ID is not set (Settings → Companies)');

  const employeeIssues = [];
  for (const it of items) {
    const missing = [];
    if (!it.work_permit_no) missing.push('Work Permit No');
    if (!it.personal_no) missing.push('Personal No');
    if (!it.iban) missing.push('IBAN');
    if (!it.bank_name) missing.push('Bank name');
    if (missing.length) {
      employeeIssues.push({
        employee_id: it.employee_id,
        name: `${it.first_name} ${it.last_name}`.trim(),
        missing,
      });
    }
  }
  return { companyIssues, employeeIssues, ready: !companyIssues.length && !employeeIssues.length };
}

/** "2026-07" → "JULY-2026", matching the header wording on the official sheet. */
export function formatPayrollMonth(period) {
  const [y, m] = String(period || '').split('-');
  const names = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
    'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];
  const name = names[(Number(m) || 1) - 1] || '';
  return `${name}-${y || ''}`;
}

/**
 * @returns {Buffer} .xlsx ready to submit
 */
export function buildWpsWorkbook({ company, period, items }) {
  const monthLabel = formatPayrollMonth(period);
  const rows = [];

  // ── Title block (kept in column D, as on the official sheet) ──────────────
  rows.push(['', '', '', `COMPANY NAME:- ${company?.name || ''}`, '', '', '', '', '', '']);
  rows.push(['', '', '', `MOL ID No:-   ${company?.mol_id || ''}`, '', '', '', '', '', '']);
  rows.push(['', '', '', `PAYROLL FOR THE MONTH OF  ${monthLabel}`, '', '', '', '', '', '']);
  rows.push([]); rows.push([]); rows.push([]);

  // ── Header (row 7 on the sheet; "Employee's Net Salary" spans H:J) ────────
  rows.push([
    'Sl.No',
    'NAME OF THE EMPLOYEE',
    'WORK PERMIT NO (9 DIGIT NO)',
    'PERSONAL NO (14 DIGIT NO)',
    'BANK NAME',
    'FAB CARD NO(16 DIGITS) OR IBAN FOR PERSONAL ACCOUNT (23 DIGITS) OR C3-RAK (15 DIGIT)',
    'NO OF DAYS ABSENT',
    "Employee's Net Salary", '', '',
  ]);
  rows.push(['', '', '', '', '', '', '', 'Fixed Portion', 'Variable Portion', 'Total Payment']);

  const firstDataRow = rows.length; // 0-based index of the first employee row
  let grandTotal = 0;
  items.forEach((it, i) => {
    const fixed = money(it.gross);
    const variable = money(it.variable || 0);
    const total = money(it.net);
    grandTotal += total;
    rows.push([
      i + 1,
      `${it.first_name || ''} ${it.last_name || ''}`.trim().toUpperCase(),
      txt(it.work_permit_no),
      txt(it.personal_no),
      it.bank_name || '',
      txt(it.iban),
      Number(it.absence_days || 0) + Number(it.unpaid_leave_days || 0),
      num(fixed), num(variable), num(total),
    ]);
  });

  const totalRow = rows.length;
  rows.push(['Total in Dirhams', '', '', '', '', '', '', '', '', num(grandTotal)]);

  // ── Contact block ─────────────────────────────────────────────────────────
  rows.push([]);
  rows.push(['', `CONTACT PERSON -  ${company?.wps_contact_person || ''}`]);
  rows.push(['', `MOBILE - ${company?.wps_contact_mobile || ''}`]);
  rows.push(['', `TELEPHONE - ${company?.wps_contact_phone || company?.phone || ''}`]);
  rows.push(['', `FAX - ${company?.wps_contact_fax || ''}`]);
  rows.push(['', `EMAIL - ${company?.wps_contact_email || company?.email || ''}`]);

  const ws = XLSX.utils.aoa_to_sheet(rows);

  // Merge ranges copied from the company's submitted file, cell for cell.
  ws['!merges'] = [
    { s: { r: 0, c: 3 }, e: { r: 0, c: 5 } },  // title lines → D:F
    { s: { r: 1, c: 3 }, e: { r: 1, c: 5 } },
    { s: { r: 2, c: 3 }, e: { r: 2, c: 5 } },
    { s: { r: 6, c: 7 }, e: { r: 6, c: 9 } },  // Employee's Net Salary → H:J
    // Single-column headers span both header rows.
    ...[0, 1, 2, 3, 4, 5, 6].map((c) => ({ s: { r: 6, c }, e: { r: 7, c } })),
    { s: { r: totalRow, c: 0 }, e: { r: totalRow, c: 6 } }, // "Total in Dirhams" → A:G
  ];

  ws['!cols'] = [
    { wch: 10 }, { wch: 30 }, { wch: 22 }, { wch: 20 },
    { wch: 30 }, { wch: 40 }, { wch: 14 }, { wch: 14 }, { wch: 15 }, { wch: 15 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  return {
    buffer: XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }),
    grandTotal: money(grandTotal),
    count: items.length,
    firstDataRow,
  };
}
