import { forwardRef } from 'react';
import dayjs from 'dayjs';
import { ReportShell, SectionTitle } from './reportKit';
import { cell, headCell } from './reportStyles';

/** Printable monthly attendance report. See reportKit for the shared frame. */
const STATUS_AR = {
  Present: 'حاضر',
  Absent: 'غائب',
  Late: 'متأخر',
  'Half Day': 'نصف يوم',
  'On Leave': 'في إجازة',
  Holiday: 'عطلة',
  Remote: 'عن بُعد',
};

const statusColor = (s) => (
  s === 'Absent' ? '#b91c1c'
    : s === 'Late' || s === 'Half Day' ? '#b45309'
      : s === 'On Leave' ? '#6d28d9'
        : s === 'Holiday' ? '#6b7280' : '#047857'
);

const AttendanceReport = forwardRef(({ employeeName, company, month, rows = [], summary, onLetterhead = false }, ref) => {
  const monthLabel = dayjs(`${month}-01`).format('MMMM YYYY');
  const byStatus = summary?.by_status || [];
  const totalHours = summary?.total_hours ?? rows.reduce((s, r) => s + Number(r.work_hours || 0), 0);
  // Oldest first: a report is read down the month, unlike the screen list which
  // answers "what happened most recently".
  const days = [...rows].sort((a, b) => String(a.work_date).localeCompare(String(b.work_date)));

  return (
    <div ref={ref}>
      <ReportShell
        titleEn="Attendance Report" titleAr="تقرير الحضور والانصراف"
        company={company} onLetterhead={onLetterhead}
        meta={[
          { label: 'Employee / الموظف', value: employeeName },
          { label: 'Month / الشهر', value: monthLabel },
          { label: 'Company / الشركة', value: company?.name },
          { label: 'Days recorded / الأيام المسجّلة', value: days.length },
        ]}
      >
        <SectionTitle en="Summary" ar="الملخص" />
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {byStatus.map((s) => (
                <th key={s.status} style={headCell}>{s.status} / {STATUS_AR[s.status] || s.status}</th>
              ))}
              <th style={headCell}>Total hours / الساعات</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              {byStatus.map((s) => (
                <td key={s.status} style={{ ...cell, textAlign: 'center', fontWeight: 'bold', fontSize: '14px', color: statusColor(s.status) }}>
                  {s.count}
                </td>
              ))}
              <td style={{ ...cell, textAlign: 'center', fontWeight: 'bold', fontSize: '14px' }}>{Number(totalHours).toFixed(2)}</td>
            </tr>
          </tbody>
        </table>

        <SectionTitle en="Daily Record" ar="السجل اليومي" />
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={headCell}>Date / التاريخ</th>
              <th style={headCell}>Day / اليوم</th>
              <th style={headCell}>In / الحضور</th>
              <th style={headCell}>Out / الانصراف</th>
              <th style={{ ...headCell, textAlign: 'right' }}>Hours / الساعات</th>
              <th style={headCell}>Status / الحالة</th>
              <th style={headCell}>Notes / ملاحظات</th>
            </tr>
          </thead>
          <tbody>
            {days.length === 0 ? (
              <tr><td style={{ ...cell, textAlign: 'center', color: '#999' }} colSpan={7}>No attendance recorded / لا يوجد تسجيل</td></tr>
            ) : days.map((r) => (
              <tr key={r.id}>
                <td style={cell}>{r.work_date}</td>
                <td style={cell}>{dayjs(r.work_date).format('ddd')}</td>
                <td style={cell}>{r.check_in || '—'}</td>
                <td style={cell}>{r.check_out || '—'}</td>
                <td style={{ ...cell, textAlign: 'right' }}>{r.work_hours != null ? Number(r.work_hours).toFixed(2) : '—'}</td>
                <td style={{ ...cell, color: statusColor(r.status), fontWeight: 600 }}>
                  {r.status} / {STATUS_AR[r.status] || ''}
                </td>
                <td style={cell}>{r.notes || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </ReportShell>
    </div>
  );
});

AttendanceReport.displayName = 'AttendanceReport';
export default AttendanceReport;
