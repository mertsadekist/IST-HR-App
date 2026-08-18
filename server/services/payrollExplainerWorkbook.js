/**
 * The payroll explanation as a workbook somebody can actually hand over.
 *
 * Three sheets, in the order a question gets asked:
 *
 *   Summary        — one row per employee: what they earned, what was withheld, why.
 *   Deduction detail — for anyone with a deduction, the day-by-day working.
 *   Policy         — the rules those numbers came from.
 *
 * Written with exceljs rather than the `xlsx` package already in the tree, for one
 * reason: `xlsx` in its community build cannot write cell styling at all, and a
 * sheet of unformatted numbers is not a document you put in front of an employee
 * who is asking why they were paid less. The WPS export keeps using `xlsx`, which
 * is right — that file is read by a bank, not a person.
 *
 * Headers are bilingual because the workforce is. Column widths are set explicitly
 * so nothing arrives as ####, and the money columns carry a real number format so
 * the file stays arithmetic rather than text.
 */
import ExcelJS from 'exceljs';

const BRAND = 'FF5B21B6';
const INK = 'FF1A1A1A';
const MUTED = 'FF6B7280';
const RED = 'FFB91C1C';
const GREEN = 'FF047857';
const BAND = 'FFF5F3FF';
const RULE = 'FFE5E7EB';
const WARN_BG = 'FFFEF3C7';
const WARN_INK = 'FF92400E';

const MONEY = '#,##0.00';
const DAYS = '0.00';

const thin = { style: 'thin', color: { argb: RULE } };
const boxed = { top: thin, left: thin, bottom: thin, right: thin };

function titleBlock(ws, data, subtitle, span) {
  const { run } = data;
  ws.mergeCells(1, 1, 1, span);
  const t = ws.getCell(1, 1);
  t.value = `${run.company_name || 'Company'} — Payroll ${run.period}`;
  t.font = { bold: true, size: 16, color: { argb: BRAND } };
  t.alignment = { vertical: 'middle' };
  ws.getRow(1).height = 24;

  ws.mergeCells(2, 1, 2, span);
  const s = ws.getCell(2, 1);
  s.value = subtitle;
  s.font = { size: 10, color: { argb: MUTED } };

  ws.mergeCells(3, 1, 3, span);
  const m = ws.getCell(3, 1);
  m.value = `Run #${run.id} · status ${run.status} · period ${data.periodStart} to ${data.periodEnd}`
    + ` · generated ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC`;
  m.font = { size: 9, color: { argb: MUTED } };
  ws.getRow(4).height = 6;
}

function headerRow(ws, rowIx, labels, widths) {
  const row = ws.getRow(rowIx);
  labels.forEach((label, i) => {
    const c = row.getCell(i + 1);
    c.value = label;
    c.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND } };
    c.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    c.border = boxed;
  });
  row.height = 30;
  if (widths) widths.forEach((w, i) => { ws.getColumn(i + 1).width = w; });
  ws.views = [{ state: 'frozen', ySplit: rowIx }];
  return row;
}

// ─────────────────────────── sheet 1 ───────────────────────────

function summarySheet(wb, data) {
  const ws = wb.addWorksheet('Summary', { views: [{ state: 'frozen', ySplit: 6 }] });
  const cols = [
    'Employee\nالموظف', 'Device ID\nرقم البصمة', 'Department\nالقسم',
    'Basic\nالأساسي', 'Allowances\nالبدلات', 'Gross\nالإجمالي', 'Daily rate\nأجر اليوم',
    'Leave\nخصم الإجازات', 'Absence\nخصم الغياب', 'Total deducted\nإجمالي الخصم',
    'Net pay\nالصافي', 'Why\nالسبب',
  ];
  titleBlock(ws, data, 'Salary summary — what each employee was paid and what was withheld'
    + ' / ملخص الرواتب — ما قُبض وما خُصم', cols.length);
  headerRow(ws, 6, cols, [26, 12, 22, 12, 12, 13, 12, 14, 13, 15, 14, 58]);

  let r = 7;
  for (const e of data.employees) {
    const row = ws.getRow(r);
    row.values = [
      e.name, e.attendance_id || '—', e.department || '—',
      e.basic, e.allowances, e.gross, e.daily_rate,
      e.leave_deduction, e.absence_deduction, e.recomputed_deduction, e.net,
      e.summary
        + (e.disputed_days ? `  ⚠ ${e.disputed_days} of these day(s) the schedule engine reads as a non-working day.` : '')
        + (e.overlaps.length ? `  ⚠ ${e.overlaps.length} duplicate leave approval(s) ignored.` : '')
        + (e.matches ? '' : `  ⚠ Stored figure is ${e.stored_deduction.toFixed(2)} — see note below.`),
    ];
    [4, 5, 6, 7, 8, 9, 10, 11].forEach((c) => { row.getCell(c).numFmt = MONEY; });
    row.getCell(10).font = { bold: true, color: { argb: e.recomputed_deduction > 0 ? RED : INK } };
    row.getCell(11).font = { bold: true, color: { argb: GREEN } };
    row.getCell(12).alignment = { wrapText: true, vertical: 'top' };
    if (!e.matches) row.getCell(12).font = { color: { argb: RED }, bold: true };
    else if (e.disputed_days || e.overlaps.length) row.getCell(12).font = { color: { argb: WARN_INK } };
    row.eachCell((c) => { c.border = boxed; });
    if (r % 2 === 0) {
      row.eachCell((c) => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BAND } }; });
    }
    row.height = 28;
    r++;
  }

  // Totals
  const tot = ws.getRow(r);
  tot.getCell(1).value = 'TOTAL / الإجمالي';
  [6, 8, 9, 10, 11].forEach((c) => {
    const letter = ws.getColumn(c).letter;
    tot.getCell(c).value = { formula: `SUM(${letter}7:${letter}${r - 1})` };
    tot.getCell(c).numFmt = MONEY;
  });
  tot.eachCell((c) => {
    c.font = { bold: true };
    c.border = { ...boxed, top: { style: 'double', color: { argb: BRAND } } };
  });

  const mismatched = data.employees.filter((e) => !e.matches);
  if (mismatched.length) {
    const n = ws.getRow(r + 2);
    ws.mergeCells(r + 2, 1, r + 2, cols.length);
    n.getCell(1).value = `⚠ ${mismatched.length} employee(s) have a stored deduction that does not match the`
      + ' day-by-day working below. That happens when a leave or attendance record changed after the run was'
      + ' generated, or when the run predates a policy change. Regenerate the run before issuing these payslips.';
    n.getCell(1).font = { color: { argb: RED }, bold: true, size: 10 };
    n.getCell(1).alignment = { wrapText: true };
    n.height = 34;
  }
  return ws;
}

// ─────────────────────────── sheet 2 ───────────────────────────

function detailSheet(wb, data) {
  const ws = wb.addWorksheet('Deduction detail');
  const cols = [
    'Date\nالتاريخ', 'Day\nاليوم', 'Type\nالنوع', 'Reason\nالسبب',
    'Day share\nحصة اليوم', 'Withheld\nنسبة الخصم', 'Days charged\nأيام محتسبة',
    'How it was calculated\nطريقة الحساب', 'Amount\nالمبلغ',
  ];
  titleBlock(ws, data, 'Every day that reduced pay, and the arithmetic behind it'
    + ' / كل يوم خفّض الراتب، وحسابه', cols.length);
  [16, 13, 11, 30, 11, 11, 13, 52, 13].forEach((w, i) => { ws.getColumn(i + 1).width = w; });

  let r = 6;
  const withDeductions = data.employees.filter((e) => e.lines.length > 0);

  if (!withDeductions.length) {
    ws.mergeCells(r, 1, r, cols.length);
    const c = ws.getCell(r, 1);
    c.value = 'No deductions in this run — every employee was paid in full.'
      + ' / لا خصومات في هذه الدورة — قُبض الجميع كاملاً.';
    c.font = { size: 11, color: { argb: GREEN }, bold: true };
    return ws;
  }

  for (const e of withDeductions) {
    // Employee banner
    ws.mergeCells(r, 1, r, cols.length);
    const b = ws.getCell(r, 1);
    b.value = `${e.name}`
      + `${e.attendance_id ? `  ·  device ${e.attendance_id}` : ''}`
      + `${e.department ? `  ·  ${e.department}` : ''}`
      + `  ·  gross ${e.gross.toFixed(2)}  ·  daily rate ${e.gross.toFixed(2)} / 30 = ${e.daily_rate.toFixed(2)}`;
    b.font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
    b.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND } };
    b.alignment = { vertical: 'middle', indent: 1 };
    ws.getRow(r).height = 22;
    r++;

    const h = ws.getRow(r);
    cols.forEach((label, i) => {
      const c = h.getCell(i + 1);
      c.value = label;
      c.font = { bold: true, size: 9, color: { argb: INK } };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BAND } };
      c.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      c.border = boxed;
    });
    h.height = 28;
    r++;

    const first = r;
    for (const l of e.lines) {
      const row = ws.getRow(r);
      row.values = [
        l.date, l.day, l.category,
        l.note ? `${l.reason} — ${l.note}` : l.reason,
        l.share, `${Math.round((1 - l.pay_factor) * 100)}%`, l.deduction_days,
        l.calculation, l.amount,
      ];
      row.getCell(5).numFmt = DAYS;
      row.getCell(7).numFmt = DAYS;
      row.getCell(9).numFmt = MONEY;
      row.getCell(9).font = { bold: true, color: { argb: RED } };
      row.getCell(4).alignment = { wrapText: true, vertical: 'top' };
      row.getCell(8).alignment = { wrapText: true, vertical: 'top' };
      row.getCell(8).font = { size: 9, color: { argb: MUTED }, name: 'Consolas' };
      row.eachCell((c) => { c.border = boxed; });
      // A day the schedule engine says was never a working day. The charge stands
      // because payroll reads the stored status, but nobody should have to notice
      // this for themselves.
      if (l.disputed) {
        row.eachCell((c) => {
          c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: WARN_BG } };
        });
        row.getCell(4).font = { color: { argb: WARN_INK }, bold: true };
      }
      row.height = l.disputed ? 40 : 26;
      r++;
    }

    const sub = ws.getRow(r);
    sub.getCell(8).value = 'Total withheld / إجمالي الخصم';
    sub.getCell(8).alignment = { horizontal: 'right' };
    sub.getCell(9).value = { formula: `SUM(I${first}:I${r - 1})` };
    sub.getCell(9).numFmt = MONEY;
    [8, 9].forEach((c) => {
      sub.getCell(c).font = { bold: true, color: { argb: RED } };
      sub.getCell(c).border = { ...boxed, top: { style: 'double', color: { argb: BRAND } } };
    });
    r++;

    const net = ws.getRow(r);
    net.getCell(8).value = `Net pay / صافي الراتب  (${e.gross.toFixed(2)} − ${e.recomputed_deduction.toFixed(2)})`;
    net.getCell(8).alignment = { horizontal: 'right' };
    net.getCell(9).value = e.net;
    net.getCell(9).numFmt = MONEY;
    [8, 9].forEach((c) => { net.getCell(c).font = { bold: true, color: { argb: GREEN } }; });
    r++;

    if (!e.matches) {
      ws.mergeCells(r, 1, r, cols.length);
      const w = ws.getCell(r, 1);
      w.value = `⚠ The payslip stored ${e.stored_deduction.toFixed(2)} for this employee, but the days above`
        + ` add up to ${e.recomputed_deduction.toFixed(2)}. Regenerate the run before issuing it.`;
      w.font = { color: { argb: RED }, bold: true, size: 10 };
      w.alignment = { wrapText: true };
      r++;
    }
    if (e.overlaps.length) {
      ws.mergeCells(r, 1, r, cols.length);
      const o = ws.getCell(r, 1);
      o.value = `⚠ ${e.overlaps.length} approved leave request(s) claim a date another request had already`
        + ` taken (${[...new Set(e.overlaps.map((x) => x.date))].join(', ')}). Each date is charged once, so the`
        + ' figures above are right — but the duplicate approvals are still in Leave Management and should be'
        + ' cancelled.';
      o.font = { color: { argb: WARN_INK }, bold: true, size: 10 };
      o.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: WARN_BG } };
      o.alignment = { wrapText: true };
      ws.getRow(r).height = 32;
      r++;
    }
    r += 1;   // breathing room between people
  }
  return ws;
}

// ─────────────────────────── sheet 3 ───────────────────────────

function policySheet(wb, data) {
  const ws = wb.addWorksheet('Policy');
  const cols = ['Leave type\nنوع الإجازة', 'Accrual\nالتراكم', 'Allowance\nالرصيد',
    'Band\nالمرتبة', 'Pay\nالأجر', 'Condition\nالشرط'];
  titleBlock(ws, data, 'The rules these figures come from / القواعد التي بُنيت عليها الأرقام', cols.length);
  headerRow(ws, 6, cols, [26, 16, 12, 18, 10, 82]);

  let r = 7;
  let lastName = null;
  for (const t of data.tiers) {
    const row = ws.getRow(r);
    const isNew = t.name !== lastName;
    row.values = [
      isNew ? t.name : '',
      isNew ? t.accrual : '',
      isNew ? (Number(t.default_days) > 0 ? `${Number(t.default_days)} days` : '—') : '',
      t.from_day == null ? '—' : `Days ${Number(t.from_day)}–${t.to_day == null ? '∞' : Number(t.to_day)}`,
      t.pay_factor == null ? '—' : `${Math.round(Number(t.pay_factor) * 100)}%`,
      isNew ? (t.description || '') : (t.label || ''),
    ];
    if (isNew) row.getCell(1).font = { bold: true };
    row.getCell(5).font = {
      bold: true,
      color: { argb: Number(t.pay_factor) >= 1 ? GREEN : Number(t.pay_factor) > 0 ? 'FFB45309' : RED },
    };
    row.getCell(6).alignment = { wrapText: true, vertical: 'top' };
    row.getCell(6).font = { size: 9, color: { argb: MUTED } };
    row.eachCell((c) => { c.border = boxed; });
    row.height = isNew ? 46 : 18;
    lastName = t.name;
    r++;
  }

  r += 1;
  ws.mergeCells(r, 1, r, cols.length);
  const note = ws.getCell(r, 1);
  note.value = 'How a deduction is worked out: the daily rate is the gross salary divided by 30. Each affected day'
    + ' is charged at the daily rate multiplied by the share of the day taken and by the portion of it that is'
    + ' unpaid. A day of fully paid leave costs nothing; a half-pay day costs half the daily rate; an unpaid day'
    + ' or an unauthorised absence costs the whole of it.'
    + '\nطريقة حساب الخصم: أجر اليوم = الراتب الإجمالي ÷ 30. ويُحتسب كل يوم متأثر بأجر اليوم مضروباً في حصة'
    + ' اليوم المأخوذة وفي نسبة ما هو غير مدفوع منها. فيوم الإجازة المدفوعة بالكامل لا يكلّف شيئاً، ويوم نصف'
    + ' الأجر يكلّف نصف أجر اليوم، ويوم الإجازة غير المدفوعة أو الغياب غير المصرّح يكلّف أجر اليوم كاملاً.';
  note.alignment = { wrapText: true, vertical: 'top' };
  note.font = { size: 10, color: { argb: INK } };
  ws.getRow(r).height = 76;
  return ws;
}

/**
 * @param {object} data output of buildPayrollExplanation
 * @returns {Promise<Buffer>}
 */
export async function renderPayrollExplanationWorkbook(data) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'IST HR System';
  wb.created = new Date();

  summarySheet(wb, data);
  detailSheet(wb, data);
  policySheet(wb, data);

  for (const ws of wb.worksheets) {
    ws.pageSetup = {
      orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0,
      margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
    };
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}
