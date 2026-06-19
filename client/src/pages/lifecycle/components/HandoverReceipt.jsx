import { forwardRef } from 'react';
import dayjs from 'dayjs';

const HandoverReceipt = forwardRef(({ asset, company, onLetterhead = false }, ref) => {
  const today = dayjs().format('DD / MM / YYYY');

  return (
    <div ref={ref} className="handover-receipt-print" style={{ fontFamily: 'Arial, sans-serif', maxWidth: '800px', margin: '0 auto', padding: '40px', color: '#1a1a1a', fontSize: '13px', lineHeight: '1.6' }}>
      {/* Header — the company branding is dropped on a letterhead (it already carries it) */}
      <div style={{ display: 'flex', justifyContent: onLetterhead ? 'center' : 'space-between', alignItems: 'center', borderBottom: onLetterhead ? 'none' : '3px solid #5B21B6', paddingBottom: '16px', marginBottom: '24px' }}>
        {!onLetterhead && (
          <div>
            <h1 style={{ fontSize: '22px', fontWeight: 'bold', color: '#5B21B6', margin: 0 }}>{company?.name || 'Company Name'}</h1>
            <p style={{ color: '#666', fontSize: '11px', margin: '4px 0 0' }}>{company?.short_code || ''}</p>
          </div>
        )}
        <div style={{ textAlign: onLetterhead ? 'center' : 'right' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 'bold', margin: 0, color: '#333' }}>Asset Handover Receipt</h2>
          <p style={{ color: '#666', fontSize: '11px', margin: '4px 0 0' }}>وثيقة تسليم واستلام الأصول</p>
          <p style={{ color: '#999', fontSize: '11px', margin: '2px 0 0' }}>Date / التاريخ: {today}</p>
        </div>
      </div>

      {/* Reference Number */}
      <div style={{ background: '#f8f6ff', border: '1px solid #e5e0ff', borderRadius: '8px', padding: '12px 16px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between' }}>
        <span><strong>Reference No:</strong> AHR-{asset?.id?.toString().padStart(5, '0') || '00000'}</span>
        <span><strong>Date Issued:</strong> {asset?.issued_date ? dayjs(asset.issued_date).format('DD/MM/YYYY') : today}</span>
      </div>

      {/* Employee Details */}
      <div style={{ marginBottom: '20px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: 'bold', color: '#5B21B6', borderBottom: '1px solid #e5e0ff', paddingBottom: '6px', marginBottom: '12px' }}>Employee Details / بيانات الموظف</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            <tr>
              <td style={{ padding: '6px 12px', background: '#fafafa', border: '1px solid #eee', width: '25%', fontWeight: '600' }}>Employee Name</td>
              <td style={{ padding: '6px 12px', border: '1px solid #eee', width: '25%' }}>{asset?.first_name} {asset?.last_name}</td>
              <td style={{ padding: '6px 12px', background: '#fafafa', border: '1px solid #eee', width: '25%', fontWeight: '600' }}>Company</td>
              <td style={{ padding: '6px 12px', border: '1px solid #eee', width: '25%' }}>{asset?.company_name || company?.name || '—'}</td>
            </tr>
            <tr>
              <td style={{ padding: '6px 12px', background: '#fafafa', border: '1px solid #eee', fontWeight: '600' }}>Employee ID</td>
              <td style={{ padding: '6px 12px', border: '1px solid #eee' }}>EMP-{asset?.employee_id?.toString().padStart(4, '0')}</td>
              <td style={{ padding: '6px 12px', background: '#fafafa', border: '1px solid #eee', fontWeight: '600' }}>Department</td>
              <td style={{ padding: '6px 12px', border: '1px solid #eee' }}>{asset?.department_name || '—'}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Asset Details */}
      <div style={{ marginBottom: '20px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: 'bold', color: '#5B21B6', borderBottom: '1px solid #e5e0ff', paddingBottom: '6px', marginBottom: '12px' }}>Asset Details / تفاصيل الأصل</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#5B21B6', color: 'white' }}>
              <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: '12px' }}>#</th>
              <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: '12px' }}>Asset Name</th>
              <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: '12px' }}>Type</th>
              <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: '12px' }}>Identifier / Serial</th>
              <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: '12px' }}>Condition</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ padding: '8px 12px', border: '1px solid #eee' }}>1</td>
              <td style={{ padding: '8px 12px', border: '1px solid #eee', fontWeight: '600' }}>{asset?.name}</td>
              <td style={{ padding: '8px 12px', border: '1px solid #eee' }}>{asset?.asset_type || 'Hardware'}</td>
              <td style={{ padding: '8px 12px', border: '1px solid #eee' }}>{asset?.identifier || '—'}</td>
              <td style={{ padding: '8px 12px', border: '1px solid #eee' }}>New / Good</td>
            </tr>
          </tbody>
        </table>
        {asset?.workspace && (
          <p style={{ margin: '8px 0 0', fontSize: '12px', color: '#666' }}><strong>Workspace:</strong> {asset.workspace}</p>
        )}
        {asset?.notes && (
          <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#666' }}><strong>Notes:</strong> {asset.notes}</p>
        )}
      </div>

      {/* Terms */}
      <div style={{ marginBottom: '24px', background: '#fafafa', border: '1px solid #eee', borderRadius: '6px', padding: '14px 16px' }}>
        <h3 style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '8px', color: '#333' }}>Terms & Conditions / الشروط والأحكام</h3>
        <ol style={{ margin: 0, paddingLeft: '18px', fontSize: '11px', color: '#555' }}>
          <li>The employee acknowledges receipt of the above-listed asset(s) in good working condition.</li>
          <li>The employee is responsible for the care and safekeeping of the assigned asset(s).</li>
          <li>The asset(s) must be returned in good condition upon termination, resignation, or transfer.</li>
          <li>Any damage, loss, or theft must be reported to IT/HR department immediately.</li>
          <li>Company assets are for professional use only. Unauthorized personal use is prohibited.</li>
          <li>The company reserves the right to recall the asset(s) at any time.</li>
        </ol>
      </div>

      {/* Signature Block */}
      <div style={{ display: 'flex', gap: '40px', marginTop: '32px' }}>
        {/* Delivered By */}
        <div style={{ flex: 1 }}>
          <h4 style={{ fontSize: '13px', fontWeight: 'bold', color: '#5B21B6', marginBottom: '16px', borderBottom: '1px solid #e5e0ff', paddingBottom: '6px' }}>Delivered By / المُسلِّم</h4>
          <div style={{ marginBottom: '12px' }}>
            <p style={{ fontSize: '11px', color: '#888', marginBottom: '4px' }}>Name / الاسم:</p>
            <div style={{ borderBottom: '1px solid #ccc', minHeight: '24px', marginBottom: '12px' }}></div>
          </div>
          <div style={{ marginBottom: '12px' }}>
            <p style={{ fontSize: '11px', color: '#888', marginBottom: '4px' }}>Position / المنصب:</p>
            <div style={{ borderBottom: '1px solid #ccc', minHeight: '24px', marginBottom: '12px' }}></div>
          </div>
          <div style={{ marginBottom: '12px' }}>
            <p style={{ fontSize: '11px', color: '#888', marginBottom: '4px' }}>Signature / التوقيع:</p>
            <div style={{ border: '1px dashed #ccc', minHeight: '60px', borderRadius: '6px', marginBottom: '12px' }}></div>
          </div>
          <div>
            <p style={{ fontSize: '11px', color: '#888', marginBottom: '4px' }}>Date / التاريخ:</p>
            <div style={{ borderBottom: '1px solid #ccc', minHeight: '24px' }}></div>
          </div>
        </div>

        {/* Received By */}
        <div style={{ flex: 1 }}>
          <h4 style={{ fontSize: '13px', fontWeight: 'bold', color: '#5B21B6', marginBottom: '16px', borderBottom: '1px solid #e5e0ff', paddingBottom: '6px' }}>Received By / المُستلِم</h4>
          <div style={{ marginBottom: '12px' }}>
            <p style={{ fontSize: '11px', color: '#888', marginBottom: '4px' }}>Name / الاسم:</p>
            <div style={{ borderBottom: '1px solid #ccc', minHeight: '24px', marginBottom: '12px' }}>{asset?.first_name} {asset?.last_name}</div>
          </div>
          <div style={{ marginBottom: '12px' }}>
            <p style={{ fontSize: '11px', color: '#888', marginBottom: '4px' }}>Position / المنصب:</p>
            <div style={{ borderBottom: '1px solid #ccc', minHeight: '24px', marginBottom: '12px' }}></div>
          </div>
          <div style={{ marginBottom: '12px' }}>
            <p style={{ fontSize: '11px', color: '#888', marginBottom: '4px' }}>Signature / التوقيع:</p>
            <div style={{ border: '1px dashed #ccc', minHeight: '60px', borderRadius: '6px', marginBottom: '12px' }}></div>
          </div>
          <div>
            <p style={{ fontSize: '11px', color: '#888', marginBottom: '4px' }}>Date / التاريخ:</p>
            <div style={{ borderBottom: '1px solid #ccc', minHeight: '24px' }}></div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ marginTop: '32px', borderTop: '2px solid #5B21B6', paddingTop: '12px', textAlign: 'center', color: '#999', fontSize: '10px' }}>
        <p>This document is generated by {company?.name || 'IST HR System'} — Asset Management Module</p>
        <p>Reference: AHR-{asset?.id?.toString().padStart(5, '0')} | Generated: {dayjs().format('DD/MM/YYYY HH:mm')}</p>
      </div>
    </div>
  );
});

HandoverReceipt.displayName = 'HandoverReceipt';
export default HandoverReceipt;
