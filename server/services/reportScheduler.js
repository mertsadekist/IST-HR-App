/**
 * Sends the scheduled reports that are due. Started from server.js; wakes every
 * ten minutes so a schedule goes out within minutes of its hour, and at most
 * once a day (last_sent_on).
 */
import { buildReport, reportWorkbook, isDue, localYmd } from './reportScheduleService.js';
import { sendEmail } from './emailService.js';
import { getTemplate } from './emailTemplates.js';

/**
 * Build and email one schedule's report to each recipient.
 * @returns {Promise<{sent:number, failed:number, rows:number, error?:string}>}
 */
export async function sendScheduledReport(pool, s, { markSent = true, sentBy = null } = {}) {
  const report = await buildReport(pool, s.report_key, s.company_id || null);
  const buffer = reportWorkbook(report);
  const day = localYmd(new Date());
  const fileName = `${s.report_key}-${day}.xlsx`;
  let company = '';
  if (s.company_id) {
    const [[c]] = await pool.query('SELECT name FROM companies WHERE id = ?', [s.company_id]);
    company = c?.name || '';
  }
  const { subject, html } = getTemplate('document_delivery', {
    name: '', title: `${s.name} — ${day}`, company,
    message: `${report.title}.\nThe report is attached as an Excel file.`,
  });
  let sent = 0, failed = 0, lastError = null;
  for (const to of String(s.recipients).split(',').filter(Boolean)) {
    const r = await sendEmail({
      to, subject, html, companyId: s.company_id || null, templateType: 'scheduled_report',
      relatedModule: 'Reports', relatedId: s.id, sentBy,
      attachments: [{ filename: fileName, content: buffer, contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }],
    });
    if (r.success) sent++; else { failed++; lastError = r.error; }
  }
  if (markSent && sent) await pool.query('UPDATE report_schedules SET last_sent_on = ? WHERE id = ?', [day, s.id]);
  return { sent, failed, rows: report.rows.length, ...(sent ? {} : { error: lastError || 'No recipient could be emailed' }) };
}

export async function runDueReports(pool, now = new Date()) {
  const [rows] = await pool.query('SELECT * FROM report_schedules WHERE active = 1');
  let n = 0;
  for (const s of rows.filter((x) => isDue(x, now))) {
    try {
      const out = await sendScheduledReport(pool, s);
      if (out.sent) n++;
      else console.error(`Scheduled report "${s.name}" not sent: ${out.error}`);
    } catch (err) { console.error(`Scheduled report "${s.name}" failed:`, err.message); }
  }
  return n;
}
