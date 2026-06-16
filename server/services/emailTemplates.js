/**
 * Email Templates for IST HR System
 * Each template returns { subject, html } for use with emailService.sendEmail()
 */

const brandColor = '#6D28D9';
const brandGradient = 'linear-gradient(135deg, #6D28D9 0%, #4F46E5 100%)';

function baseLayout(content, companyName = 'IST HR System') {
  return `<!DOCTYPE html>
<html dir="ltr" lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body { margin:0; padding:0; font-family:'Segoe UI',Arial,sans-serif; background:#f4f5f7; color:#333; }
  .container { max-width:600px; margin:0 auto; background:#fff; border-radius:12px; overflow:hidden; box-shadow:0 2px 12px rgba(0,0,0,0.08); }
  .header { background:${brandGradient}; padding:28px 32px; text-align:center; }
  .header h1 { color:#fff; font-size:20px; margin:0; font-weight:700; letter-spacing:0.5px; }
  .header p { color:rgba(255,255,255,0.8); font-size:12px; margin:6px 0 0; }
  .body { padding:32px; line-height:1.7; font-size:14px; color:#444; }
  .body h2 { color:#1a1a2e; font-size:18px; margin:0 0 16px; }
  .body p { margin:0 0 14px; }
  .highlight { background:#f8f5ff; border-left:4px solid ${brandColor}; padding:14px 18px; border-radius:0 8px 8px 0; margin:16px 0; }
  .highlight strong { color:${brandColor}; }
  .btn { display:inline-block; background:${brandColor}; color:#fff !important; padding:12px 28px; border-radius:8px; text-decoration:none; font-weight:600; font-size:14px; margin:8px 0; }
  .info-table { width:100%; border-collapse:collapse; margin:16px 0; }
  .info-table td { padding:8px 12px; border-bottom:1px solid #f0f0f0; font-size:13px; }
  .info-table td:first-child { font-weight:600; color:#666; width:35%; }
  .footer { background:#f8f9fa; padding:20px 32px; text-align:center; border-top:1px solid #eee; }
  .footer p { color:#999; font-size:11px; margin:4px 0; }
  .badge { display:inline-block; padding:4px 12px; border-radius:20px; font-size:11px; font-weight:600; }
  .badge-purple { background:#f3e8ff; color:${brandColor}; }
  .badge-green { background:#ecfdf5; color:#059669; }
  .badge-blue { background:#eff6ff; color:#2563eb; }
  .badge-red { background:#fef2f2; color:#dc2626; }
  .badge-amber { background:#fffbeb; color:#d97706; }
  ul { padding-left:20px; }
  ul li { margin:6px 0; }
</style>
</head>
<body>
<div style="padding:20px 0;">
<div class="container">
  <div class="header">
    <h1>✨ ${companyName}</h1>
    <p>Human Resources Management System</p>
  </div>
  <div class="body">
    ${content}
  </div>
  <div class="footer">
    <p>This is an automated email from ${companyName} HR System</p>
    <p>© ${new Date().getFullYear()} ${companyName}. All rights reserved.</p>
  </div>
</div>
</div>
</body>
</html>`;
}

const templates = {
  // ==================== EMPLOYEE ====================
  welcome_employee: (data) => ({
    subject: `Welcome to ${data.company || 'the team'}, ${data.name}! 🎉`,
    html: baseLayout(`
      <h2>Welcome Aboard, ${data.name}! 🎉</h2>
      <p>We are thrilled to have you join <strong>${data.company || 'our team'}</strong>. Your journey with us starts now!</p>
      <div class="highlight">
        <table class="info-table">
          <tr><td>Position</td><td><strong>${data.position || 'N/A'}</strong></td></tr>
          <tr><td>Department</td><td>${data.department || 'N/A'}</td></tr>
          <tr><td>Start Date</td><td>${data.start_date || 'TBD'}</td></tr>
          <tr><td>Employee Code</td><td>${data.employee_code || 'N/A'}</td></tr>
        </table>
      </div>
      <p>Your manager and team are looking forward to meeting you. If you have any questions, don't hesitate to reach out to HR.</p>
      <p>Best regards,<br><strong>HR Department</strong></p>
    `, data.company),
  }),

  // ==================== ONBOARDING ====================
  onboarding_welcome: (data) => ({
    subject: `Your Onboarding Journey Begins — ${data.company || 'Company'}`,
    html: baseLayout(`
      <h2>Welcome to Your Onboarding! 📋</h2>
      <p>Dear <strong>${data.name}</strong>,</p>
      <p>Your onboarding process has been initiated. Here's what you need to complete:</p>
      ${data.tasks ? `<div class="highlight"><strong>Tasks to Complete:</strong><ul>${data.tasks.map(t => `<li>${t}</li>`).join('')}</ul></div>` : ''}
      <p>Your onboarding manager will guide you through each step. Please complete all tasks within the specified timeframe.</p>
      <p>Best regards,<br><strong>HR Department</strong></p>
    `, data.company),
  }),

  onboarding_complete: (data) => ({
    subject: `Congratulations! Onboarding Complete 🎉 — ${data.company || 'Company'}`,
    html: baseLayout(`
      <h2>Onboarding Complete! 🎉</h2>
      <p>Dear <strong>${data.name}</strong>,</p>
      <p>Congratulations! You have successfully completed your onboarding process.</p>
      <div class="highlight">
        <strong>Completion Date:</strong> ${data.completion_date || new Date().toLocaleDateString()}<br>
        <strong>All tasks:</strong> <span class="badge badge-green">✓ Completed</span>
      </div>
      <p>You are now fully onboarded. Welcome to the team!</p>
      <p>Best regards,<br><strong>HR Department</strong></p>
    `, data.company),
  }),

  // ==================== OFFBOARDING (8 stages) ====================
  offboarding_resignation: (data) => ({
    subject: `Resignation Acceptance Confirmation — ${data.company || 'Company'}`,
    html: baseLayout(`
      <h2>Resignation Acceptance</h2>
      <p>Dear <strong>${data.name}</strong>,</p>
      <p>This is to confirm that your resignation has been received and accepted.</p>
      <div class="highlight">
        <table class="info-table">
          <tr><td>Last Working Day</td><td><strong>${data.last_working_day || 'TBD'}</strong></td></tr>
          <tr><td>Notice Period</td><td>${data.notice_period || '30 days'}</td></tr>
          <tr><td>Status</td><td><span class="badge badge-amber">Processing</span></td></tr>
        </table>
      </div>
      <p>The following offboarding steps will be communicated to you shortly. Please ensure a smooth transition.</p>
      <p>Best regards,<br><strong>HR Department</strong></p>
    `, data.company),
  }),

  offboarding_knowledge_transfer: (data) => ({
    subject: `Knowledge Transfer & Handover Assignment — ${data.company || 'Company'}`,
    html: baseLayout(`
      <h2>Knowledge Transfer Assignment 📝</h2>
      <p>Dear <strong>${data.name}</strong>,</p>
      <p>As part of your offboarding process, please begin the knowledge transfer and handover process.</p>
      ${data.handover_to ? `<div class="highlight"><strong>Handover To:</strong> ${data.handover_to}</div>` : ''}
      <p>Please ensure all project documentation, credentials, and ongoing tasks are properly transferred.</p>
      <p>Best regards,<br><strong>HR Department</strong></p>
    `, data.company),
  }),

  offboarding_it_revocation: (data) => ({
    subject: `IT & System Access Revocation Notice — ${data.company || 'Company'}`,
    html: baseLayout(`
      <h2>IT Access Revocation Notice 🔒</h2>
      <p>Dear <strong>${data.name}</strong>,</p>
      <p>This is to inform you that your IT and system access will be revoked as part of the offboarding process.</p>
      <div class="highlight">
        <strong>Systems affected:</strong>
        <ul>
          <li>Company Email</li>
          <li>Internal Applications</li>
          <li>VPN Access</li>
          <li>Cloud Storage</li>
        </ul>
      </div>
      <p>Please ensure you have backed up any personal data before the revocation date.</p>
      <p>Best regards,<br><strong>IT Department</strong></p>
    `, data.company),
  }),

  offboarding_asset_return: (data) => ({
    subject: `Asset Return Reminder — ${data.company || 'Company'}`,
    html: baseLayout(`
      <h2>Asset Return Required 💻</h2>
      <p>Dear <strong>${data.name}</strong>,</p>
      <p>Please return the following company assets before your last working day:</p>
      ${data.assets_list ? `<div class="highlight"><ul>${data.assets_list.map(a => `<li>${a}</li>`).join('')}</ul></div>` : '<div class="highlight"><p>Your assigned assets will be listed by HR.</p></div>'}
      <p>Please return all items in good condition to the HR department.</p>
      <p>Best regards,<br><strong>HR Department</strong></p>
    `, data.company),
  }),

  offboarding_financial: (data) => ({
    subject: `Financial Clearance & EOSB Details — ${data.company || 'Company'}`,
    html: baseLayout(`
      <h2>Financial Clearance 💰</h2>
      <p>Dear <strong>${data.name}</strong>,</p>
      <p>Your financial clearance is being processed. Below are the preliminary details:</p>
      <div class="highlight">
        <table class="info-table">
          ${data.eosb_amount ? `<tr><td>EOSB Amount</td><td><strong>${data.eosb_amount}</strong></td></tr>` : ''}
          ${data.pending_salary ? `<tr><td>Pending Salary</td><td>${data.pending_salary}</td></tr>` : ''}
          ${data.leave_balance ? `<tr><td>Leave Balance</td><td>${data.leave_balance}</td></tr>` : ''}
          <tr><td>Status</td><td><span class="badge badge-blue">Processing</span></td></tr>
        </table>
      </div>
      <p>Final amounts will be confirmed after complete clearance.</p>
      <p>Best regards,<br><strong>Finance Department</strong></p>
    `, data.company),
  }),

  offboarding_exit_interview: (data) => ({
    subject: `Exit Interview Invitation — ${data.company || 'Company'}`,
    html: baseLayout(`
      <h2>Exit Interview Invitation 🗣️</h2>
      <p>Dear <strong>${data.name}</strong>,</p>
      <p>We would like to invite you to an exit interview. Your feedback is valuable to us.</p>
      <div class="highlight">
        <table class="info-table">
          ${data.interview_date ? `<tr><td>Date</td><td><strong>${data.interview_date}</strong></td></tr>` : ''}
          ${data.interview_time ? `<tr><td>Time</td><td>${data.interview_time}</td></tr>` : ''}
          ${data.interviewer ? `<tr><td>Interviewer</td><td>${data.interviewer}</td></tr>` : ''}
        </table>
      </div>
      <p>This is an opportunity to share your experience and suggestions. Your input helps us improve.</p>
      <p>Best regards,<br><strong>HR Department</strong></p>
    `, data.company),
  }),

  offboarding_legal: (data) => ({
    subject: `Legal & Document Processing — ${data.company || 'Company'}`,
    html: baseLayout(`
      <h2>Legal Documents Processing 📄</h2>
      <p>Dear <strong>${data.name}</strong>,</p>
      <p>The following legal documents are being prepared for your offboarding:</p>
      <div class="highlight">
        <ul>
          <li>Experience Certificate</li>
          <li>Salary Certificate</li>
          <li>NOC (No Objection Certificate)</li>
          <li>Final Settlement Letter</li>
        </ul>
      </div>
      <p>Documents will be ready for collection before your last working day.</p>
      <p>Best regards,<br><strong>HR Department</strong></p>
    `, data.company),
  }),

  offboarding_farewell: (data) => ({
    subject: `Farewell & Best Wishes — ${data.company || 'Company'}`,
    html: baseLayout(`
      <h2>Farewell & Best Wishes 🌟</h2>
      <p>Dear <strong>${data.name}</strong>,</p>
      <p>Your offboarding process is now complete. We want to thank you for your contributions to <strong>${data.company || 'our organization'}</strong>.</p>
      <div class="highlight">
        <p>All clearances have been completed and your final settlement has been processed.</p>
        <p><span class="badge badge-green">✓ All Steps Complete</span></p>
      </div>
      <p>We wish you all the best in your future endeavors. Remember, our door is always open!</p>
      <p>Warm regards,<br><strong>HR Department</strong><br>${data.company || ''}</p>
    `, data.company),
  }),

  // ==================== ASSETS ====================
  asset_assigned: (data) => ({
    subject: `New Asset Assigned: ${data.asset_name} — ${data.company || 'Company'}`,
    html: baseLayout(`
      <h2>Asset Assignment Notification 💻</h2>
      <p>Dear <strong>${data.name}</strong>,</p>
      <p>A new asset has been assigned to you:</p>
      <div class="highlight">
        <table class="info-table">
          <tr><td>Asset Name</td><td><strong>${data.asset_name}</strong></td></tr>
          <tr><td>Type</td><td><span class="badge badge-purple">${data.asset_type || 'N/A'}</span></td></tr>
          ${data.serial ? `<tr><td>Serial / ID</td><td>${data.serial}</td></tr>` : ''}
          ${data.asset_code ? `<tr><td>Asset Code</td><td>${data.asset_code}</td></tr>` : ''}
          <tr><td>Issue Date</td><td>${data.issued_date || new Date().toLocaleDateString()}</td></tr>
        </table>
      </div>
      <p>Please take good care of the assigned asset. Contact HR if you have any questions.</p>
      <p>Best regards,<br><strong>HR Department</strong></p>
    `, data.company),
  }),

  asset_return_reminder: (data) => ({
    subject: `Asset Return Confirmation: ${data.asset_name} — ${data.company || 'Company'}`,
    html: baseLayout(`
      <h2>Asset Return Confirmation ✅</h2>
      <p>Dear <strong>${data.name}</strong>,</p>
      <p>The following asset has been returned and recorded:</p>
      <div class="highlight">
        <table class="info-table">
          <tr><td>Asset</td><td><strong>${data.asset_name}</strong></td></tr>
          <tr><td>Status</td><td><span class="badge badge-green">Returned</span></td></tr>
          <tr><td>Return Date</td><td>${data.return_date || new Date().toLocaleDateString()}</td></tr>
        </table>
      </div>
      <p>Thank you for returning the asset in good condition.</p>
      <p>Best regards,<br><strong>HR Department</strong></p>
    `, data.company),
  }),

  // ==================== RECRUITMENT / ATS ====================
  candidate_received: (data) => ({
    subject: `Application Received — ${data.position} at ${data.company || 'Company'}`,
    html: baseLayout(`
      <h2>Application Received ✅</h2>
      <p>Dear <strong>${data.name}</strong>,</p>
      <p>Thank you for applying for the <strong>${data.position}</strong> position at <strong>${data.company || 'our company'}</strong>.</p>
      <div class="highlight">
        <p>Your application has been received and is being reviewed by our recruitment team.</p>
        <p><span class="badge badge-blue">Under Review</span></p>
      </div>
      <p>We will get back to you shortly. Thank you for your interest!</p>
      <p>Best regards,<br><strong>Recruitment Team</strong></p>
    `, data.company),
  }),

  candidate_interview: (data) => ({
    subject: `Interview Invitation — ${data.position} at ${data.company || 'Company'}`,
    html: baseLayout(`
      <h2>Interview Invitation 🗓️</h2>
      <p>Dear <strong>${data.name}</strong>,</p>
      <p>We are pleased to invite you for an interview for the <strong>${data.position}</strong> position.</p>
      <div class="highlight">
        <table class="info-table">
          ${data.date ? `<tr><td>Date</td><td><strong>${data.date}</strong></td></tr>` : ''}
          ${data.time ? `<tr><td>Time</td><td>${data.time}</td></tr>` : ''}
          ${data.location ? `<tr><td>Location</td><td>${data.location}</td></tr>` : ''}
          ${data.interviewer ? `<tr><td>Interviewer</td><td>${data.interviewer}</td></tr>` : ''}
          ${data.type ? `<tr><td>Type</td><td>${data.type}</td></tr>` : ''}
        </table>
      </div>
      <p>Please confirm your availability by replying to this email.</p>
      <p>Best regards,<br><strong>Recruitment Team</strong></p>
    `, data.company),
  }),

  candidate_offer: (data) => ({
    subject: `Job Offer — ${data.position} at ${data.company || 'Company'}`,
    html: baseLayout(`
      <h2>Job Offer 🎉</h2>
      <p>Dear <strong>${data.name}</strong>,</p>
      <p>We are delighted to extend an offer for the <strong>${data.position}</strong> position at <strong>${data.company || 'our company'}</strong>.</p>
      <div class="highlight">
        <table class="info-table">
          <tr><td>Position</td><td><strong>${data.position}</strong></td></tr>
          ${data.department ? `<tr><td>Department</td><td>${data.department}</td></tr>` : ''}
          ${data.salary ? `<tr><td>Package</td><td>${data.salary}</td></tr>` : ''}
          ${data.start_date ? `<tr><td>Proposed Start Date</td><td>${data.start_date}</td></tr>` : ''}
        </table>
      </div>
      <p>Please review the offer details and let us know your decision at your earliest convenience.</p>
      <p>Best regards,<br><strong>Recruitment Team</strong></p>
    `, data.company),
  }),

  candidate_rejected: (data) => ({
    subject: `Application Update — ${data.position} at ${data.company || 'Company'}`,
    html: baseLayout(`
      <h2>Application Update</h2>
      <p>Dear <strong>${data.name}</strong>,</p>
      <p>Thank you for your interest in the <strong>${data.position}</strong> position at <strong>${data.company || 'our company'}</strong>.</p>
      <p>After careful review, we have decided to move forward with other candidates whose qualifications more closely match our current needs.</p>
      <div class="highlight">
        <p>We encourage you to apply for future openings that match your skills and experience.</p>
      </div>
      <p>We wish you all the best in your career pursuits.</p>
      <p>Best regards,<br><strong>Recruitment Team</strong></p>
    `, data.company),
  }),

  candidate_hired: (data) => ({
    subject: `Welcome Aboard! 🎉 — ${data.company || 'Company'}`,
    html: baseLayout(`
      <h2>Welcome to the Team! 🎉</h2>
      <p>Dear <strong>${data.name}</strong>,</p>
      <p>We are excited to confirm that you have been hired for the <strong>${data.position}</strong> position!</p>
      <div class="highlight">
        <table class="info-table">
          <tr><td>Position</td><td><strong>${data.position}</strong></td></tr>
          ${data.start_date ? `<tr><td>Start Date</td><td>${data.start_date}</td></tr>` : ''}
          <tr><td>Status</td><td><span class="badge badge-green">✓ Hired</span></td></tr>
        </table>
      </div>
      <p>Our HR team will be in touch with onboarding details shortly. We look forward to having you on the team!</p>
      <p>Best regards,<br><strong>HR Department</strong></p>
    `, data.company),
  }),

  // ==================== PAYROLL ====================
  payslip_notification: (data) => ({
    subject: `Payslip for ${data.month || 'this month'} — ${data.company || 'Company'}`,
    html: baseLayout(`
      <h2>Payslip Notification 💰</h2>
      <p>Dear <strong>${data.name}</strong>,</p>
      <p>Your payslip for <strong>${data.month || 'this month'}</strong> has been processed.</p>
      <div class="highlight">
        <table class="info-table">
          ${data.basic_salary ? `<tr><td>Basic Salary</td><td>${data.basic_salary}</td></tr>` : ''}
          ${data.allowances ? `<tr><td>Allowances</td><td>${data.allowances}</td></tr>` : ''}
          ${data.deductions ? `<tr><td>Deductions</td><td>${data.deductions}</td></tr>` : ''}
          ${data.net_salary ? `<tr><td>Net Salary</td><td><strong>${data.net_salary}</strong></td></tr>` : ''}
        </table>
      </div>
      <p>For any queries, please contact the Finance department.</p>
      <p>Best regards,<br><strong>Finance Department</strong></p>
    `, data.company),
  }),

  // ==================== PERFORMANCE ====================
  performance_review: (data) => ({
    subject: `Performance Review Notification — ${data.company || 'Company'}`,
    html: baseLayout(`
      <h2>Performance Review 📊</h2>
      <p>Dear <strong>${data.name}</strong>,</p>
      <p>A performance review has been ${data.action || 'created'} for you.</p>
      <div class="highlight">
        <table class="info-table">
          ${data.period ? `<tr><td>Review Period</td><td>${data.period}</td></tr>` : ''}
          ${data.reviewer ? `<tr><td>Reviewer</td><td>${data.reviewer}</td></tr>` : ''}
          ${data.rating ? `<tr><td>Rating</td><td><strong>${data.rating}</strong></td></tr>` : ''}
        </table>
      </div>
      <p>Please review and acknowledge the assessment.</p>
      <p>Best regards,<br><strong>HR Department</strong></p>
    `, data.company),
  }),

  // ==================== LEGAL ====================
  legal_letter_sent: (data) => ({
    subject: `Official Letter: ${data.letter_type || 'Document'} — ${data.company || 'Company'}`,
    html: baseLayout(`
      <h2>Official Letter Notification 📄</h2>
      <p>Dear <strong>${data.name}</strong>,</p>
      <p>An official letter has been issued for you:</p>
      <div class="highlight">
        <table class="info-table">
          <tr><td>Letter Type</td><td><strong>${data.letter_type || 'N/A'}</strong></td></tr>
          <tr><td>Date Issued</td><td>${data.date || new Date().toLocaleDateString()}</td></tr>
          <tr><td>Reference</td><td>${data.reference || 'N/A'}</td></tr>
        </table>
      </div>
      <p>Please contact HR to collect the document or check your portal.</p>
      <p>Best regards,<br><strong>HR Department</strong></p>
    `, data.company),
  }),

  // ==================== ONBOARDING v2: EMPLOYMENT OFFER ====================
  employment_offer: (data) => {
    const row = (label, val) => (val !== undefined && val !== null && String(val) !== '')
      ? `<tr><td>${label}</td><td>${val}</td></tr>` : '';
    return {
      subject: `Job Offer — ${data.job_title || 'Position'} at ${data.company || 'our company'}`,
      html: baseLayout(`
        <h2>Employment Offer 🎉</h2>
        <p>Dear <strong>${data.candidate_name || 'Candidate'}</strong>,</p>
        <p>We are delighted to extend a formal offer of employment for the position of
           <strong>${data.job_title || ''}</strong> at <strong>${data.company || 'our company'}</strong>.</p>
        <div class="highlight">
          <table class="info-table">
            ${row('Offer Reference', data.offer_number)}
            ${row('Job Title', `<strong>${data.job_title || ''}</strong>`)}
            ${row('Department', data.department)}
            ${row('Reporting Manager', data.reporting_manager)}
            ${row('Work Location', data.work_location)}
            ${row('Employment Type', data.employment_type)}
            ${row('Joining Date', data.joining_date)}
            ${row('Basic Salary', data.basic_salary)}
            ${row('Allowances', data.allowances)}
            ${row('Commission', data.commission_structure)}
            ${row('Probation Period', data.probation_period)}
            ${row('Working Hours', data.working_hours)}
            ${row('Leave Policy', data.leave_policy)}
            ${row('Benefits', data.benefits)}
            ${row('Visa / Residency', data.visa_responsibility)}
            ${row('Medical Insurance', data.medical_insurance)}
            ${row('Notice Period', data.notice_period)}
          </table>
        </div>
        ${data.additional_terms ? `<p><strong>Additional Terms:</strong><br>${data.additional_terms}</p>` : ''}
        <p><strong>How to respond:</strong> Please confirm your acceptance or decline this offer by replying to this email
           ${data.offer_expiry_date ? `no later than <strong>${data.offer_expiry_date}</strong>` : 'at your earliest convenience'}.
           Upon acceptance, we will share the signed contract and next steps.</p>
        ${data.contact_block ? `<p>${data.contact_block}</p>` : ''}
        <p>We look forward to welcoming you to the team.</p>
        <p>Best regards,<br><strong>HR Department — ${data.company || ''}</strong></p>
      `, data.company),
    };
  },

  // ==================== RECRUITMENT (public application) ====================
  application_confirmation: (data) => ({
    subject: `We received your application — ${data.position || 'Open role'}${data.company ? ` at ${data.company}` : ''}`,
    html: baseLayout(`
      <h2>Application Received ✅</h2>
      <p>Dear <strong>${data.name || 'Applicant'}</strong>,</p>
      <p>Thank you for applying for the <strong>${data.position || 'open position'}</strong>${data.company ? ` at <strong>${data.company}</strong>` : ''}.</p>
      <p>Your application has been received and is now under review by our recruitment team. If your profile matches our requirements, we will contact you with the next steps.</p>
      <p>We appreciate your interest in joining us.</p>
      <p>Best regards,<br><strong>Recruitment Team${data.company ? ` — ${data.company}` : ''}</strong></p>
    `, data.company),
  }),

  hr_new_application: (data) => ({
    subject: `New application — ${data.candidate || 'Candidate'} for ${data.position || 'a role'}`,
    html: baseLayout(`
      <h2>New Candidate Application 📨</h2>
      <p>Dear <strong>${data.name || 'Recruiter'}</strong>,</p>
      <p>A new application has been submitted for <strong>${data.position || 'an open role'}</strong>${data.company ? ` at <strong>${data.company}</strong>` : ''}.</p>
      <div class="highlight"><table class="info-table">
        <tr><td>Candidate</td><td><strong>${data.candidate || ''}</strong></td></tr>
        <tr><td>Position</td><td>${data.position || ''}</td></tr>
      </table></div>
      <p>Open the Applicants section to review the candidate, CV and details.</p>
      <p>Best regards,<br><strong>IST HR System</strong></p>
    `, data.company),
  }),

  offer_stage: (data) => ({
    subject: `Update on your application — ${data.position || 'role'}${data.company ? ` at ${data.company}` : ''}`,
    html: baseLayout(`
      <h2>Great news 🎉</h2>
      <p>Dear <strong>${data.name || 'Candidate'}</strong>,</p>
      <p>We are pleased to inform you that your application for <strong>${data.position || 'the position'}</strong>${data.company ? ` at <strong>${data.company}</strong>` : ''} has progressed to the offer stage.</p>
      <p>Our HR team will be in touch shortly with your formal offer and the next steps.</p>
      <p>Best regards,<br><strong>Recruitment Team${data.company ? ` — ${data.company}` : ''}</strong></p>
    `, data.company),
  }),

  // ==================== CUSTOM ====================
  custom: (data) => ({
    subject: data.subject || 'Message from HR',
    html: baseLayout(`
      ${data.heading ? `<h2>${data.heading}</h2>` : ''}
      <p>Dear <strong>${data.name || 'Employee'}</strong>,</p>
      ${data.body || '<p>No content provided.</p>'}
      <p>Best regards,<br><strong>${data.sender || 'HR Department'}</strong></p>
    `, data.company),
  }),
};

export function getTemplate(templateType, data) {
  const templateFn = templates[templateType];
  if (!templateFn) {
    return templates.custom(data);
  }
  return templateFn(data);
}

export function getTemplateTypes() {
  return Object.keys(templates).map(key => ({
    value: key,
    label: key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    group: key.startsWith('offboarding') ? 'Offboarding'
      : key.startsWith('candidate') ? 'Recruitment'
      : key.startsWith('onboarding') ? 'Onboarding'
      : key.startsWith('asset') ? 'Assets'
      : key.startsWith('payslip') ? 'Payroll'
      : key.startsWith('performance') ? 'Performance'
      : key.startsWith('legal') ? 'Legal'
      : key.startsWith('welcome') ? 'Employee'
      : 'General',
  }));
}
