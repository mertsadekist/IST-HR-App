import dayjs from 'dayjs';

const esc = (s) => String(s == null ? '' : s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const fmt = (d) => (d ? dayjs(d).format('MMMM D, YYYY') : '');

// `\n\n` starts a new paragraph, a lone `\n` becomes a line break — lets
// multi-section preset text (numbered clauses, bullet lists) render properly
// instead of being squashed onto a single line.
function textToHtml(text) {
  return String(text)
    .split(/\n{2,}/)
    .map((block) => `<p style="margin:0 0 12px;">${esc(block).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

/**
 * Renders an offer (from `onboarding_offers` or an ad-hoc Quick Offer form)
 * as a printable HTML letter for letterhead PDF composition.
 * @param {object} o - offer fields (job_title, department, ..., additional_terms)
 * @param {{companyName: string, candidateName: string}} party
 */
export function buildOfferLetterHtml(o, party) {
  const company = party?.companyName || '';
  const candidateName = party?.candidateName || '';
  const rows = [
    ['Position', o.job_title], ['Department', o.department], ['Work location', o.work_location],
    ['Employment type', o.employment_type], ['Reporting manager', o.reporting_manager],
    ['Joining date', fmt(o.joining_date)], ['Basic salary', o.basic_salary],
    ['Commission structure', o.commission_structure], ['Probation period', o.probation_period],
    ['Working hours', o.working_hours], ['Leave policy', o.leave_policy], ['Benefits', o.benefits],
    ['Visa responsibility', o.visa_responsibility], ['Medical insurance', o.medical_insurance],
    ['Notice period', o.notice_period],
  ].filter(([, v]) => v != null && v !== '');
  return `
    <div style="font-size:14px;line-height:1.9;color:#111;">
      <p style="text-align:right;margin:0 0 18px;">${fmt(new Date().toISOString())}</p>
      <p>Dear <strong>${esc(candidateName)}</strong>,</p>
      <h2 style="font-size:18px;margin:14px 0 10px;">Employment Offer${o.offer_number ? ` — ${esc(o.offer_number)}` : ''}</h2>
      <p>We are pleased to offer you the position of <strong>${esc(o.job_title || '')}</strong>${o.department ? ` in the ${esc(o.department)} department` : ''} at <strong>${esc(company)}</strong>. The principal terms of your employment are set out below:</p>
      <table style="width:100%;border-collapse:collapse;margin:14px 0;">
        ${rows.map(([k, v]) => `<tr><td style="padding:6px 10px;border-bottom:1px solid #eee;font-weight:600;width:38%;color:#555;">${k}</td><td style="padding:6px 10px;border-bottom:1px solid #eee;white-space:pre-line;">${esc(v)}</td></tr>`).join('')}
      </table>
      ${o.additional_terms ? textToHtml(o.additional_terms) : ''}
      <p>Please confirm your acceptance by signing and returning this letter${o.offer_expiry_date ? ` by <strong>${fmt(o.offer_expiry_date)}</strong>` : ''}.</p>
      <p style="margin-top:30px;">Sincerely,<br>[Authorized Signatory]<br><strong>${esc(company)}</strong></p>
    </div>`;
}
