import { forwardRef } from 'react';
import { ReportShell, SectionTitle } from './reportKit';
import { cell, headCell } from './reportStyles';

/**
 * Printable leave statement: the entitlement position first, then the history
 * behind it.
 *
 * The balance table is what the document is usually requested for — how many
 * days are left — so it leads, and the requests below it are the evidence for
 * the "used" column rather than the other way round.
 */
const statusLabel = {
  Approved: 'Approved / معتمدة',
  Pending: 'Pending / قيد الانتظار',
  Rejected: 'Rejected / مرفوضة',
  Cancelled: 'Cancelled / ملغاة',
};

const statusColor = (s) => (
  s === 'Approved' ? '#047857' : s === 'Rejected' ? '#b91c1c' : s === 'Cancelled' ? '#6b7280' : '#b45309'
);

const LeaveReport = forwardRef(({ employeeName, company, balances = [], requests = [], year, onLetterhead = false }, ref) => {
  const totalEntitled = balances.reduce((s, b) => s + Number(b.entitled || 0), 0);
  const totalUsed = balances.reduce((s, b) => s + Number(b.used || 0), 0);
  const totalRemaining = balances.reduce((s, b) => s + Number(b.remaining || 0), 0);
  // Oldest first, so the history reads forward through the year.
  const rows = [...requests].sort((a, b) => String(a.start_date).localeCompare(String(b.start_date)));

  return (
    <div ref={ref}>
      <ReportShell
        titleEn="Leave Statement" titleAr="كشف الإجازات"
        company={company} onLetterhead={onLetterhead}
        meta={[
          { label: 'Employee / الموظف', value: employeeName },
          { label: 'Year / السنة', value: year },
          { label: 'Company / الشركة', value: company?.name },
          { label: 'Days remaining / المتبقي', value: `${totalRemaining} day(s)` },
        ]}
      >
        <SectionTitle en="Entitlement" ar="الرصيد" />
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={headCell}>Leave type / نوع الإجازة</th>
              <th style={{ ...headCell, textAlign: 'right' }}>Entitled / المستحق</th>
              <th style={{ ...headCell, textAlign: 'right' }}>Used / المستخدم</th>
              <th style={{ ...headCell, textAlign: 'right' }}>Remaining / المتبقي</th>
            </tr>
          </thead>
          <tbody>
            {balances.length === 0 ? (
              <tr><td style={{ ...cell, textAlign: 'center', color: '#999' }} colSpan={4}>No entitlement on record / لا يوجد رصيد مسجّل</td></tr>
            ) : balances.map((b) => (
              <tr key={b.id}>
                <td style={{ ...cell, fontWeight: 600 }}>{b.leave_type_name}</td>
                <td style={{ ...cell, textAlign: 'right' }}>{Number(b.entitled || 0)}</td>
                <td style={{ ...cell, textAlign: 'right' }}>{Number(b.used || 0)}</td>
                <td style={{ ...cell, textAlign: 'right', fontWeight: 'bold', color: '#047857' }}>{Number(b.remaining || 0)}</td>
              </tr>
            ))}
          </tbody>
          {balances.length > 0 && (
            <tfoot>
              <tr>
                <td style={{ ...cell, background: '#f4f2fb', fontWeight: 'bold' }}>Total / الإجمالي</td>
                <td style={{ ...cell, background: '#f4f2fb', textAlign: 'right', fontWeight: 'bold' }}>{totalEntitled}</td>
                <td style={{ ...cell, background: '#f4f2fb', textAlign: 'right', fontWeight: 'bold' }}>{totalUsed}</td>
                <td style={{ ...cell, background: '#f4f2fb', textAlign: 'right', fontWeight: 'bold', fontSize: '13px', color: '#047857' }}>{totalRemaining}</td>
              </tr>
            </tfoot>
          )}
        </table>

        <SectionTitle en="Leave History" ar="سجل الإجازات" />
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={headCell}>Type / النوع</th>
              <th style={headCell}>From / من</th>
              <th style={headCell}>To / إلى</th>
              <th style={{ ...headCell, textAlign: 'right' }}>Days / الأيام</th>
              <th style={headCell}>Status / الحالة</th>
              <th style={headCell}>Approved by / اعتمدها</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td style={{ ...cell, textAlign: 'center', color: '#999' }} colSpan={6}>No leave taken / لم تُؤخذ إجازات</td></tr>
            ) : rows.map((r) => (
              <tr key={r.id}>
                <td style={cell}>{r.leave_type_name}</td>
                <td style={cell}>{r.start_date}</td>
                <td style={cell}>{r.end_date}</td>
                <td style={{ ...cell, textAlign: 'right' }}>{r.days}</td>
                <td style={{ ...cell, color: statusColor(r.status), fontWeight: 600 }}>{statusLabel[r.status] || r.status}</td>
                <td style={cell}>{r.approver_name || r.decided_by_name || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </ReportShell>
    </div>
  );
});

LeaveReport.displayName = 'LeaveReport';
export default LeaveReport;
