import { forwardRef } from 'react';
import dayjs from 'dayjs';

/**
 * Printable per-employee record: every onboarding milestone, document received,
 * company asset handed over, and leave taken — with dates and who performed each
 * step. Rendered off-screen and captured by html2canvas, so it uses inline
 * styles only (no Tailwind) and drops its own header when composited onto a
 * company letterhead.
 */
const SOURCE_COLORS = {
  Onboarding: '#5B21B6', Document: '#0369a1', Asset: '#b45309', Leave: '#047857',
};

const th = { padding: '6px 10px', background: '#f3f0ff', border: '1px solid #e5e0ff', fontWeight: 'bold', textAlign: 'left', fontSize: '11px' };
const td = { padding: '6px 10px', border: '1px solid #eee', fontSize: '11px', verticalAlign: 'top' };
const cell = { padding: '6px 12px', border: '1px solid #eee' };
const label = { ...cell, background: '#fafafa', fontWeight: '600', width: '22%' };

const EmployeeHistoryReport = forwardRef(({ data, company, onLetterhead = false }, ref) => {
  const emp = data?.employee || {};
  const timeline = data?.timeline || [];
  const counts = data?.counts || {};
  const today = dayjs().format('DD / MM / YYYY');
  const fullName = `${emp.first_name || ''} ${emp.last_name || ''}`.trim();
  const jobTitle = emp.job_title_text || emp.job_title_name || '—';

  return (
    <div ref={ref} style={{ fontFamily: 'Arial, sans-serif', maxWidth: '800px', margin: '0 auto', padding: '40px', color: '#1a1a1a', fontSize: '13px', lineHeight: '1.6' }}>
      {/* Header — suppressed on a letterhead, which already carries the branding */}
      <div style={{ display: 'flex', justifyContent: onLetterhead ? 'center' : 'space-between', alignItems: 'center', borderBottom: onLetterhead ? 'none' : '3px solid #5B21B6', paddingBottom: '16px', marginBottom: '24px' }}>
        {!onLetterhead && (
          <div>
            <h1 style={{ fontSize: '22px', fontWeight: 'bold', color: '#5B21B6', margin: 0 }}>{emp.company_name || company?.name || ''}</h1>
            <p style={{ color: '#666', fontSize: '11px', margin: '4px 0 0' }}>{company?.short_code || ''}</p>
          </div>
        )}
        <div style={{ textAlign: onLetterhead ? 'center' : 'right' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 'bold', margin: 0, color: '#333' }}>Employee Record Report</h2>
          <p style={{ color: '#666', fontSize: '11px', margin: '4px 0 0' }}>تقرير سجل الموظف</p>
          <p style={{ color: '#999', fontSize: '11px', margin: '2px 0 0' }}>Generated / تاريخ الإصدار: {today}</p>
        </div>
      </div>

      {/* Employee details */}
      <div style={{ marginBottom: '20px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: 'bold', color: '#5B21B6', borderBottom: '1px solid #e5e0ff', paddingBottom: '6px', marginBottom: '12px' }}>Employee Details / بيانات الموظف</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            <tr>
              <td style={label}>Name</td><td style={cell}>{fullName || '—'}</td>
              <td style={label}>Employee ID</td><td style={cell}>EMP-{String(emp.id || '').padStart(4, '0')}</td>
            </tr>
            <tr>
              <td style={label}>Job Title</td><td style={cell}>{jobTitle}</td>
              <td style={label}>Department</td><td style={cell}>{emp.department_name || '—'}</td>
            </tr>
            <tr>
              <td style={label}>Company</td><td style={cell}>{emp.company_name || '—'}</td>
              <td style={label}>Join Date</td><td style={cell}>{emp.start_date ? dayjs(emp.start_date).format('DD/MM/YYYY') : '—'}</td>
            </tr>
            <tr>
              <td style={label}>Email</td><td style={cell}>{emp.email || '—'}</td>
              <td style={label}>Phone</td><td style={cell}>{emp.phone || '—'}</td>
            </tr>
            <tr>
              <td style={label}>Status</td><td style={cell}>{emp.status || '—'}</td>
              <td style={label}>Labour Contract</td>
              <td style={cell}>
                {emp.labour_contract_status || '—'}
                {emp.labour_contract_issued_at ? ` (${dayjs(emp.labour_contract_issued_at).format('DD/MM/YYYY')})` : ''}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Probation notice — the same legal caution shown in-app */}
      {emp.labour_contract_status !== 'Issued' && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', padding: '10px 14px', marginBottom: '20px', fontSize: '11px', color: '#b91c1c' }}>
          <strong>Notice:</strong> this individual&rsquo;s labour contract and work residency have not yet been issued. They are engaged on a trial/probationary basis only and are not to be represented as a contracted employee of the company.
        </div>
      )}

      {/* Summary */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        {[['Onboarding', counts.onboarding], ['Documents', counts.documents], ['Assets', counts.assets], ['Leave', counts.leave]].map(([k, v]) => (
          <div key={k} style={{ flex: 1, background: '#f8f6ff', border: '1px solid #e5e0ff', borderRadius: '6px', padding: '8px 10px', textAlign: 'center' }}>
            <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#5B21B6' }}>{v ?? 0}</div>
            <div style={{ fontSize: '10px', color: '#666' }}>{k}</div>
          </div>
        ))}
      </div>

      {/* Full timeline */}
      <div>
        <h3 style={{ fontSize: '14px', fontWeight: 'bold', color: '#5B21B6', borderBottom: '1px solid #e5e0ff', paddingBottom: '6px', marginBottom: '12px' }}>Complete Record / السجل الكامل</h3>
        {timeline.length === 0 ? (
          <p style={{ fontSize: '11px', color: '#888' }}>No recorded activity for this employee.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ ...th, width: '13%' }}>Date</th>
                <th style={{ ...th, width: '13%' }}>Category</th>
                <th style={{ ...th, width: '18%' }}>Type</th>
                <th style={th}>Description</th>
                <th style={{ ...th, width: '17%' }}>Performed By</th>
              </tr>
            </thead>
            <tbody>
              {timeline.map((e, i) => (
                <tr key={i}>
                  <td style={td}>{dayjs(e.occurred_at).format('DD/MM/YYYY')}</td>
                  <td style={{ ...td, color: SOURCE_COLORS[e.source] || '#333', fontWeight: 'bold' }}>{e.source}</td>
                  <td style={td}>{e.type || '—'}</td>
                  <td style={td}>{e.description || '—'}</td>
                  <td style={td}>{e.actor || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p style={{ marginTop: '28px', fontSize: '10px', color: '#999', textAlign: 'center' }}>
        This report was generated from the HR system records on {today}. / تم إصدار هذا التقرير من سجلات نظام الموارد البشرية بتاريخ {today}.
      </p>
    </div>
  );
});

EmployeeHistoryReport.displayName = 'EmployeeHistoryReport';
export default EmployeeHistoryReport;
