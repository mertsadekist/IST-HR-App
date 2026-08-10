import { Fragment } from 'react';
import dayjs from 'dayjs';
import { cell, labelCell } from './reportStyles';

/**
 * Shared furniture for the printable portal reports.
 *
 * All three (attendance, salary, leave) are captured by html2canvas from an
 * off-screen node, which constrains them the same way: inline styles only —
 * Tailwind classes are not resolved during capture — a fixed 800px width, and
 * no external images beyond whatever the letterhead itself supplies.
 *
 * They are bilingual because these documents get handed to a manager, a bank or
 * a government office, and a single-language sheet gets sent back.
 */


/** Section heading in the house purple, with its Arabic twin. */
export const SectionTitle = ({ en, ar }) => (
  <h3 style={{ fontSize: '13px', fontWeight: 'bold', color: '#5B21B6', borderBottom: '1px solid #e5e0ff', paddingBottom: '5px', marginBottom: '10px', marginTop: '18px' }}>
    {en} / {ar}
  </h3>
);

/**
 * The page frame: title block, the who/what/when table, and the provenance
 * footer. The company header is dropped when composed onto a letterhead, which
 * already carries it.
 *
 * @param {{label: string, value: any}[]} meta rows for the identifying table,
 *        laid out two pairs per row.
 */
export function ReportShell({ titleEn, titleAr, company, onLetterhead = false, meta = [], children }) {
  const generated = dayjs().format('DD / MM / YYYY');
  const rows = [];
  for (let i = 0; i < meta.length; i += 2) rows.push(meta.slice(i, i + 2));

  return (
    <div style={{ fontFamily: 'Arial, sans-serif', width: '800px', margin: '0 auto', padding: '40px', color: '#1a1a1a', fontSize: '12px', lineHeight: 1.5 }}>
      <div style={{ display: 'flex', justifyContent: onLetterhead ? 'center' : 'space-between', alignItems: 'center', borderBottom: onLetterhead ? 'none' : '3px solid #5B21B6', paddingBottom: '16px', marginBottom: '20px' }}>
        {!onLetterhead && (
          <div>
            <h1 style={{ fontSize: '20px', fontWeight: 'bold', color: '#5B21B6', margin: 0 }}>{company?.name || ''}</h1>
            <p style={{ color: '#666', fontSize: '11px', margin: '4px 0 0' }}>{company?.short_code || ''}</p>
          </div>
        )}
        <div style={{ textAlign: onLetterhead ? 'center' : 'right' }}>
          <h2 style={{ fontSize: '17px', fontWeight: 'bold', margin: 0, color: '#333' }}>{titleEn}</h2>
          <p style={{ color: '#666', fontSize: '11px', margin: '3px 0 0' }}>{titleAr}</p>
        </div>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <tbody>
          {rows.map((pair, i) => (
            <tr key={i}>
              {pair.map((m) => (
                <Fragment key={m.label}>
                  <td style={{ ...labelCell, width: '20%' }}>{m.label}</td>
                  <td style={{ ...cell, width: '30%' }}>{m.value ?? '—'}</td>
                </Fragment>
              ))}
              {pair.length === 1 && <><td style={labelCell} /><td style={cell} /></>}
            </tr>
          ))}
        </tbody>
      </table>

      {children}

      <p style={{ marginTop: '18px', fontSize: '10px', color: '#999', textAlign: 'center' }}>
        This report was generated from the HR system on {generated} and reflects the records held at that time.
        <br />
        صدر هذا التقرير من نظام الموارد البشرية بتاريخ {generated} ويعكس السجلات المحفوظة في حينه.
      </p>
    </div>
  );
}
