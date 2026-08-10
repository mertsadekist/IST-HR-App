import { forwardRef } from 'react';
import dayjs from 'dayjs';
import { ReportShell, SectionTitle } from './reportKit';
import { cell, headCell, money } from './reportStyles';

/**
 * Printable salary history — every approved and paid period, oldest first.
 *
 * This is the document an employee is asked for when renting a flat or opening
 * an account, so it states the period range it covers and totals the net at the
 * bottom: a reader needs to see both what was paid and over what span.
 */
const SalaryReport = forwardRef(({ employeeName, company, payslips = [], onLetterhead = false }, ref) => {
  // Oldest first, the way a statement reads.
  const rows = [...payslips].sort((a, b) => String(a.period).localeCompare(String(b.period)));
  const totalNet = rows.reduce((s, p) => s + Number(p.net || 0), 0);
  const totalGross = rows.reduce((s, p) => s + Number(p.gross || 0), 0);
  const totalDeductions = rows.reduce((s, p) => s + Number(p.deductions || 0), 0);
  const span = rows.length
    ? `${dayjs(`${rows[0].period}-01`).format('MMM YYYY')} — ${dayjs(`${rows[rows.length - 1].period}-01`).format('MMM YYYY')}`
    : '—';

  return (
    <div ref={ref}>
      <ReportShell
        titleEn="Salary Statement" titleAr="كشف الرواتب"
        company={company} onLetterhead={onLetterhead}
        meta={[
          { label: 'Employee / الموظف', value: employeeName },
          { label: 'Period / الفترة', value: span },
          { label: 'Company / الشركة', value: company?.name },
          { label: 'Payments / عدد الدفعات', value: rows.length },
        ]}
      >
        <SectionTitle en="Payments" ar="الدفعات" />
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={headCell}>Period / الفترة</th>
              <th style={{ ...headCell, textAlign: 'right' }}>Basic / الأساسي</th>
              <th style={{ ...headCell, textAlign: 'right' }}>Allowances / البدلات</th>
              <th style={{ ...headCell, textAlign: 'right' }}>Gross / الإجمالي</th>
              <th style={{ ...headCell, textAlign: 'right' }}>Deductions / الخصومات</th>
              <th style={{ ...headCell, textAlign: 'right' }}>Net / الصافي</th>
              <th style={headCell}>Status / الحالة</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td style={{ ...cell, textAlign: 'center', color: '#999' }} colSpan={7}>No payments recorded / لا توجد دفعات</td></tr>
            ) : rows.map((p) => (
              <tr key={p.id}>
                <td style={{ ...cell, fontWeight: 600 }}>{p.period}</td>
                <td style={{ ...cell, textAlign: 'right' }}>{money(p.basic_salary)}</td>
                <td style={{ ...cell, textAlign: 'right' }}>{money(p.allowances)}</td>
                <td style={{ ...cell, textAlign: 'right' }}>{money(p.gross)}</td>
                <td style={{ ...cell, textAlign: 'right', color: Number(p.deductions) > 0 ? '#b91c1c' : '#666' }}>
                  {Number(p.deductions) > 0 ? `-${money(p.deductions)}` : money(0)}
                </td>
                <td style={{ ...cell, textAlign: 'right', fontWeight: 'bold' }}>{money(p.net)}</td>
                <td style={cell}>{p.run_status === 'Paid' ? 'Paid / مدفوع' : 'Approved / معتمد'}</td>
              </tr>
            ))}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr>
                <td style={{ ...cell, background: '#f4f2fb', fontWeight: 'bold' }}>Total / الإجمالي</td>
                <td style={{ ...cell, background: '#f4f2fb' }} />
                <td style={{ ...cell, background: '#f4f2fb' }} />
                <td style={{ ...cell, background: '#f4f2fb', textAlign: 'right', fontWeight: 'bold' }}>{money(totalGross)}</td>
                <td style={{ ...cell, background: '#f4f2fb', textAlign: 'right', fontWeight: 'bold', color: '#b91c1c' }}>
                  {totalDeductions > 0 ? `-${money(totalDeductions)}` : money(0)}
                </td>
                <td style={{ ...cell, background: '#f4f2fb', textAlign: 'right', fontWeight: 'bold', fontSize: '13px' }}>{money(totalNet)}</td>
                <td style={{ ...cell, background: '#f4f2fb' }} />
              </tr>
            </tfoot>
          )}
        </table>
      </ReportShell>
    </div>
  );
});

SalaryReport.displayName = 'SalaryReport';
export default SalaryReport;
