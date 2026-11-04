/**
 * The morning email, and the in-app notification behind it.
 *
 * Written to be read in ten seconds by somebody who mostly wants to know
 * "did it work, and is there anything for me to do". So the counts lead, and
 * then only the things needing a human: unknown device ids, missing punches,
 * days that were reclassified as leave, corrections that were left alone, and
 * company disagreements.
 *
 * A run that found nothing is still sent. Silence is indistinguishable from a
 * broken feed, and a feed that quietly stops is the failure mode that costs a
 * month of attendance before anyone notices.
 */
import { sendEmail } from './emailService.js';
import { notifyRole } from './notificationService.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const li = (items, render) => items.map((i) => `<li>${render(i)}</li>`).join('');

function section(title, items, render, tone = '#5B21B6') {
  if (!items?.length) return '';
  return `
    <h3 style="font-size:13px;color:${tone};margin:18px 0 6px">${esc(title)} (${items.length})</h3>
    <ul style="margin:0;padding-inline-start:18px;font-size:12px;color:#444;line-height:1.6">
      ${li(items, render)}
    </ul>`;
}

/**
 * What the schedule engine made of the days that just landed.
 *
 * Deliberately set apart from everything above it, and deliberately says twice
 * that nothing was applied. The section is full of the words "absent" and "late"
 * against real colleagues' names, and somebody skimming it at six in the morning
 * must not come away thinking a decision has been taken about anyone.
 *
 * Blocking cases are listed by name because they are the only part that can be
 * acted on. The review-level ones are counted, not listed — a daily email that
 * names every twelve-minute overrun stops being read.
 */
function evaluationSection(evaluation) {
  const e = evaluation;
  if (!e) return '';

  const blocking = (e.opened_cases || []).filter((c) => c.severity === 'Blocking');
  const other = (e.opened_cases || []).filter((c) => c.severity !== 'Blocking');
  const shadow = e.shadow || {};
  const progress = shadow.day
    ? `Day ${shadow.day} of ${shadow.total_days}${shadow.complete ? ' — the observation period is complete' : ''}`
    : '';

  const nothing = !e.exceptions_opened && !e.disagreements;

  return `
    <div style="margin-top:22px;border:1px solid #ddd6fe;border-radius:8px;padding:12px;background:#faf5ff">
      <h3 style="font-size:13px;color:#5B21B6;margin:0 0 2px">Schedule checks — shadow mode</h3>
      <p style="font-size:11px;color:#7c3aed;margin:0 0 10px">
        Nothing below has been applied. No attendance record, status or payroll figure was changed.
        ${esc(progress)}
      </p>
      ${nothing
    ? '<p style="font-size:12px;color:#555;margin:0">The engine agreed with every day it looked at.</p>'
    : `<p style="font-size:12px;color:#444;margin:0 0 8px">
             ${e.days_evaluated || 0} day(s) checked · <b>${e.exceptions_opened || 0}</b> new case(s)
             · ${e.exceptions_closed || 0} closed · <b>${e.disagreements || 0}</b> disagreement(s) with the stored record
           </p>`}
      ${section('Needs a person', blocking,
    (c) => `<b>${esc(c.employee)}</b> on ${esc(c.date)} — ${esc(String(c.type).replace(/_/g, ' ').toLowerCase())}`, '#b45309')}
      ${other.length
    ? `<p style="font-size:12px;color:#666;margin:10px 0 0">
             and ${other.length} for review: ${esc([...new Set(other.map((c) => String(c.type).replace(/_/g, ' ').toLowerCase()))].join(', '))}
           </p>`
    : ''}
      ${(e.days_not_observed || []).length
    ? `<p style="font-size:11px;color:#b45309;margin:8px 0 0">
             The Hik feed had no punches at all for ${esc(e.days_not_observed.join(', '))} — nobody was marked absent for those days.
           </p>` : ''}
      <p style="font-size:11px;color:#999;margin:10px 0 0">
        Attendance → Attendance Checks shows the full comparison.
      </p>
    </div>`;
}

/** @returns {{subject: string, html: string, text: string}} */
export function buildSyncReport({ status, summary, runDate, error }) {
  const s = summary || {};
  const span = s.from && s.to ? (s.from === s.to ? s.from : `${s.from} → ${s.to}`) : '—';
  const absent = (s.absences || []).length;
  const onLeave = (s.on_leave || []).length;
  const unmatched = (s.unmatched || []).length;
  const noPunchDays = (s.not_observed_days || []).length;

  const headline = status === 'Failed'
    ? 'Attendance sync failed'
    : `Attendance closed for ${span}`;

  const stat = (label, value, tone = '#111') =>
    `<td style="padding:8px 14px;border:1px solid #eee;text-align:center">
       <div style="font-size:20px;font-weight:bold;color:${tone}">${value}</div>
       <div style="font-size:10px;color:#888;text-transform:uppercase">${esc(label)}</div>
     </td>`;

  const body = status === 'Failed'
    ? `<p style="font-size:13px;color:#b91c1c;background:#fef2f2;border:1px solid #fecaca;padding:10px;border-radius:8px">
         ${esc(error || 'The run did not complete.')} The live sync keeps retrying; you can also run it from Attendance → Hik Central Sync.
       </p>`
    : (noPunchDays
      ? `<p style="font-size:13px;color:#b45309;background:#fffbeb;border:1px solid #fde68a;padding:10px;border-radius:8px">
           Hik Central had no door punches at all for ${esc(s.not_observed_days.join(', '))}.
           Nobody was marked absent for ${noPunchDays > 1 ? 'those days' : 'that day'}. If the office was open, check that the
           access-control system and its database sync were running.
         </p>`
      : '');

  const counts = status === 'Completed' ? `
    <table style="border-collapse:collapse;margin:12px 0"><tr>
      ${stat('punches read', s.events_read || 0)}
      ${stat('people', s.people_seen || 0)}
      ${stat('new rows', s.inserted || 0, '#047857')}
      ${stat('updated', s.updated || 0)}
      ${stat('absent', absent, absent ? '#b91c1c' : '#111')}
      ${stat('unmatched', unmatched, unmatched ? '#b45309' : '#111')}
    </tr></table>` : '';

  const html = `
  <div style="font-family:Arial,sans-serif;max-width:680px;color:#1a1a1a">
    <h2 style="color:#5B21B6;font-size:18px;margin:0 0 4px">${esc(headline)}</h2>
    <p style="color:#666;font-size:12px;margin:0 0 12px">Run of ${esc(runDate)} · first punch of the day = check-in, last punch = check-out</p>
    ${body}
    ${counts}
    ${section('Marked absent — a working day with no door punches and no approved leave', s.absences,
    (a) => `${esc(a.employee)} on ${esc(a.date)}`, '#b91c1c')}
    ${section('Recorded as leave', s.on_leave,
    (r) => `${esc(r.employee)} on ${esc(r.date)} — approved ${esc(r.leave_type)}`)}
    ${section('Unknown person IDs — not employees in the system', s.unmatched,
    (u) => `<b>${esc(u.person_id)}</b> — ${esc(u.name || 'no name in Hik Central')} (${esc(u.punches)} punch(es) on ${esc(u.days)} day(s))`, '#b45309')}
    ${section('Same person ID on more than one employee — their punches were not recorded', s.ambiguous_ids,
    (id) => esc(id), '#b91c1c')}
    ${section('One punch only — no check-out', s.missing_checkout,
    (m) => `${esc(m.employee)} on ${esc(m.date)} — in at ${esc(m.check_in)}`, '#b45309')}
    ${section('Left alone — corrected by hand', s.skipped_manual,
    (m) => `${esc(m.employee)} on ${esc(m.date)}`)}
    ${section('No work schedule — absence could not be judged', s.no_schedule, (n) => esc(n), '#b45309')}
    ${section('Errors', s.errors, (e) => `${esc(e.employee || '')}${e.date ? ` on ${esc(e.date)}` : ''}: ${esc(e.message)}`, '#b91c1c')}
    ${evaluationSection(s.evaluation)}
    ${s.evaluation_error
    ? `<p style="font-size:11px;color:#b45309;margin-top:10px">The schedule checks did not run: ${esc(s.evaluation_error)}. The sync itself is unaffected.</p>`
    : ''}
    <p style="margin-top:20px;font-size:11px;color:#999">
      Attendance → Hik Central Sync in the HR system shows the full history and lets you run a pass by hand.
    </p>
  </div>`;

  const textLines = [
    headline,
    `Run of ${runDate} · ${span}`,
    status === 'Completed'
      ? `punches ${s.events_read || 0}, new ${s.inserted || 0}, updated ${s.updated || 0}, absent ${absent}, unmatched ${unmatched}`
      : (error || ''),
    noPunchDays ? `No punches at all for: ${s.not_observed_days.join(', ')} — nobody marked absent` : '',
    unmatched ? `Unknown person IDs: ${s.unmatched.map((u) => `${u.person_id} ${u.name || ''}`.trim()).join('; ')}` : '',
    s.evaluation
      ? `Schedule checks (shadow mode, nothing applied): ${s.evaluation.exceptions_opened || 0} new case(s), `
        + `${s.evaluation.disagreements || 0} disagreement(s)`
      : '',
  ].filter(Boolean);

  return { subject: `${headline} — ${runDate}`, html, text: textLines.join('\n') };
}

/**
 * Sends the report to admins and HR managers of each company that has one, and
 * raises the in-app notification.
 *
 * Recipients come from roles rather than a stored address list, so the list
 * cannot go stale when somebody joins or leaves.
 */
export async function sendSyncReport(pool, { status, summary, runDate, error }) {
  const { subject, html, text } = buildSyncReport({ status, summary, runDate, error });

  const [recipients] = await pool.query(
    `SELECT DISTINCT u.email, u.name, u.company_id
       FROM users u
      WHERE u.is_active = TRUE AND u.role IN ('admin','hr_manager')
        AND u.email IS NOT NULL AND u.email <> ''`);

  const results = [];
  for (const r of recipients) {
    const res = await sendEmail({
      to: r.email, toName: r.name, subject, html, text,
      companyId: r.company_id, templateType: 'attendance_sync',
      relatedModule: 'Attendance',
    }).catch((e) => ({ success: false, error: e.message }));
    results.push({ to: r.email, ok: !!res?.success });
  }

  // The in-app notice goes to the same audience, per company, and only says
  // something when there is something to act on or something went wrong.
  const needsAttention = (summary?.unmatched || []).length || (summary?.not_observed_days || []).length
    || (summary?.errors || []).length || status !== 'Completed';
  if (needsAttention) {
    const [companies] = await pool.query("SELECT id FROM companies WHERE status = 'Active'");
    for (const c of companies) {
      await notifyRole(pool, c.id, ['admin', 'hr_manager'], {
        type: status === 'Completed' ? 'warning' : 'error',
        title: subject,
        body: status === 'Completed'
          ? `${(summary.unmatched || []).length} unknown person id(s) need attention`
          : (error || 'The attendance sync did not complete'),
        link: '/attendance',
      }).catch(() => {});
    }
  }

  return { sent: results.filter((r) => r.ok).length, attempted: results.length };
}
