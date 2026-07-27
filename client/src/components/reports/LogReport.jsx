import { forwardRef } from 'react';
import dayjs from 'dayjs';

/**
 * Generic printable log table (Email Log, Audit Log). Rendered off-screen and
 * captured by html2canvas, so it uses inline styles only and drops its own
 * header when composited onto a company letterhead.
 *
 * @param {string}   title       report heading
 * @param {string}   subtitle    optional bilingual sub-heading
 * @param {string[]} appliedFilters human-readable "Field: value" strings
 * @param {{key,label,width?,format?}[]} columns
 * @param {object[]} rows
 */
const th = { padding: '6px 8px', background: '#f3f0ff', border: '1px solid #e5e0ff', fontWeight: 'bold', textAlign: 'left', fontSize: '10px' };
const td = { padding: '5px 8px', border: '1px solid #eee', fontSize: '10px', verticalAlign: 'top', wordBreak: 'break-word' };

const LogReport = forwardRef(({ title, subtitle, company, appliedFilters = [], columns = [], rows = [], onLetterhead = false }, ref) => {
  const now = dayjs().format('DD / MM / YYYY HH:mm');

  return (
    <div ref={ref} style={{ fontFamily: 'Arial, sans-serif', maxWidth: '800px', margin: '0 auto', padding: '40px', color: '#1a1a1a', fontSize: '12px', lineHeight: '1.5' }}>
      <div style={{ display: 'flex', justifyContent: onLetterhead ? 'center' : 'space-between', alignItems: 'center', borderBottom: onLetterhead ? 'none' : '3px solid #5B21B6', paddingBottom: '14px', marginBottom: '18px' }}>
        {!onLetterhead && (
          <div>
            <h1 style={{ fontSize: '20px', fontWeight: 'bold', color: '#5B21B6', margin: 0 }}>{company?.name || ''}</h1>
            <p style={{ color: '#666', fontSize: '11px', margin: '4px 0 0' }}>{company?.short_code || ''}</p>
          </div>
        )}
        <div style={{ textAlign: onLetterhead ? 'center' : 'right' }}>
          <h2 style={{ fontSize: '17px', fontWeight: 'bold', margin: 0, color: '#333' }}>{title}</h2>
          {subtitle && <p style={{ color: '#666', fontSize: '11px', margin: '4px 0 0' }}>{subtitle}</p>}
          <p style={{ color: '#999', fontSize: '11px', margin: '2px 0 0' }}>Generated: {now} · {rows.length} record(s)</p>
        </div>
      </div>

      {appliedFilters.length > 0 && (
        <div style={{ background: '#f8f6ff', border: '1px solid #e5e0ff', borderRadius: '6px', padding: '8px 12px', marginBottom: '16px', fontSize: '10px', color: '#555' }}>
          <strong style={{ color: '#5B21B6' }}>Filters:</strong> {appliedFilters.join('  ·  ')}
        </div>
      )}

      {rows.length === 0 ? (
        <p style={{ fontSize: '11px', color: '#888' }}>No records match the selected filters.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>{columns.map((c) => <th key={c.key} style={c.width ? { ...th, width: c.width } : th}>{c.label}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.id ?? i}>
                {columns.map((c) => <td key={c.key} style={td}>{c.format ? c.format(r[c.key], r) : (r[c.key] ?? '—')}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
});

LogReport.displayName = 'LogReport';
export default LogReport;
