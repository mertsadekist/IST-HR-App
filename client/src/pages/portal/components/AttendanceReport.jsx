import { forwardRef } from 'react';
import dayjs from 'dayjs';

/**
 * Printable monthly attendance report.
 *
 * Rendered off-screen and captured by html2canvas, so: inline styles only (no
 * Tailwind classes, which are not resolved during capture), a fixed 800px
 * width, and no images beyond what the letterhead itself supplies. When
 * `onLetterhead` is set the company header is dropped — the letterhead already
 * carries it. Bilingual labels because the report may be handed to a manager,
 * a bank or the Ministry.
 */
const cell = { padding: '6px 10px', border: '1px solid #eee', fontSize: '11px' };
const headCell = { ...cell, background: '#f4f2fb', fontWeight: 'bold', color: '#4c1d95', textAlign: 'left' };

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
  const generated = dayjs().format('DD / MM / YYYY');
  const byStatus = summary?.by_status || [];
  const totalHours = summary?.total_hours ?? rows.reduce((s, r) => s + Number(r.work_hours || 0), 0);

  return (
    <div ref={ref} style={{ fontFamily: 'Arial, sans-serif', width: '800px', margin: '0 auto', padding: '40px', color: '#1a1a1a', fontSize: '12px', lineHeight: 1.5 }}>
      <div style={{ display: 'flex', justifyContent: onLetterhead ? 'center' : 'space-between', alignItems: 'center', borderBottom: onLetterhead ? 'none' : '3px solid #5B21B6', paddingBottom: '16px', marginBottom: '20px' }}>
        {!onLetterhead && (
          <div>
            <h1 style={{ fontSize: '20px', fontWeight: 'bold', color: '#5B21B6', margin: 0 }}>{company?.name || ''}</h1>
            <p style={{ color: '#666', fontSize: '11px', margin: '4px 0 0' }}>{company?.short_code || ''}</p>
          </div>
        )}
        <div style={{ textAlign: onLetterhead ? 'center' : 'right' }}>
          <h2 style={{ fontSize: '17px', fontWeight: 'bold', margin: 0, color: '#333' }}>Attendance Report</h2>
          <p style={{ color: '#666', fontSize: '11px', margin: '3px 0 0' }}>تقرير الحضور والانصراف</p>
        </div>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '18px' }}>
        <tbody>
          <tr>
            <td style={{ ...cell, background: '#fafafa', fontWeight: 600, width: '20%' }}>Employee / الموظف</td>
            <td style={{ ...cell, width: '30%' }}>{employeeName || '—'}</td>
            <td style={{ ...cell, background: '#fafafa', fontWeight: 600, width: '20%' }}>Month / الشهر</td>
            <td style={{ ...cell, width: '30%' }}>{monthLabel}</td>
          </tr>
          <tr>
            <td style={{ ...cell, background: '#fafafa', fontWeight: 600 }}>Company / الشركة</td>
            <td style={cell}>{company?.name || '—'}</td>
            <td style={{ ...cell, background: '#fafafa', fontWeight: 600 }}>Generated / تاريخ الإصدار</td>
            <td style={cell}>{generated}</td>
          </tr>
        </tbody>
      </table>

      {/* Summary */}
      <h3 style={{ fontSize: '13px', fontWeight: 'bold', color: '#5B21B6', borderBottom: '1px solid #e5e0ff', paddingBottom: '5px', marginBottom: '10px' }}>
        Summary / الملخص
      </h3>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '18px' }}>
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

      {/* Daily detail */}
      <h3 style={{ fontSize: '13px', fontWeight: 'bold', color: '#5B21B6', borderBottom: '1px solid #e5e0ff', paddingBottom: '5px', marginBottom: '10px' }}>
        Daily Record / السجل اليومي
      </h3>
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
          {rows.length === 0 ? (
            <tr><td style={{ ...cell, textAlign: 'center', color: '#999' }} colSpan={7}>No attendance recorded / لا يوجد تسجيل</td></tr>
          ) : (
            // Oldest first: a report is read down the month, unlike the screen
            // list which answers "what happened most recently".
            [...rows].sort((a, b) => String(a.work_date).localeCompare(String(b.work_date))).map((r) => (
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
            ))
          )}
        </tbody>
      </table>

      <p style={{ marginTop: '18px', fontSize: '10px', color: '#999', textAlign: 'center' }}>
        This report was generated from the HR system on {generated} and reflects the records held at that time.
        <br />
        صدر هذا التقرير من نظام الموارد البشرية بتاريخ {generated} ويعكس السجلات المحفوظة في حينه.
      </p>
    </div>
  );
});

AttendanceReport.displayName = 'AttendanceReport';
export default AttendanceReport;
