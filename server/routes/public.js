/**
 * PUBLIC recruitment endpoints — NO authentication. Rate-limited in app.js.
 * Exposes only published vacancies + whitelisted company branding, and accepts
 * candidate applications (consent-gated, deduped, CV-parsed, source-tracked).
 */
import { Router } from 'express';
import pool from '../config/db.js';
import { addAudit } from '../services/auditService.js';
import { notify, notifyRole } from '../services/notificationService.js';
import { sendEmail } from '../services/emailService.js';
import { getTemplate } from '../services/emailTemplates.js';
import { extractTextFromFile } from '../services/cvParserService.js';
import { parseEmployeeDocument } from '../services/deepseekService.js';
import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import { ensureUploadDir } from '../config/storage.js';

const storage = multer.diskStorage({
  destination: (req, file, cb) => { cb(null, ensureUploadDir('cv_applications')); },
  filename: (req, file, cb) => cb(null, `${crypto.randomBytes(12).toString('hex')}${path.extname(file.originalname)}`),
});
const ALLOWED = ['.pdf', '.doc', '.docx'];
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(ALLOWED.includes(ext) ? null : new Error('Only PDF and DOC/DOCX CVs are allowed'), ALLOWED.includes(ext));
  },
});

const router = Router();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const POLICY_VERSION = 'v1';

// Allowed answers to "How did you hear about us?" — kept in sync with the
// options rendered by client/src/pages/public/CareersJob.jsx. Stored as stable
// English keys; the client translates them for display.
export const HEARD_ABOUT_US_OPTIONS = ['Social Media', 'LinkedIn', 'Referral', 'Job Board', 'Company Website', 'Other'];

function parseJSON(v, fallback) { try { return typeof v === 'string' ? JSON.parse(v) : (v || fallback); } catch { return fallback; } }

// Public, whitelisted view of a published vacancy + company branding.
router.get('/:slug', async (req, res) => {
  try {
    const [[v]] = await pool.query(
      `SELECT v.id, v.company_id, v.title, v.work_location, v.employment_type, v.workplace_type,
              v.description, v.responsibilities, v.qualifications, v.experience_required,
              v.required_skills, v.preferred_skills, v.languages, v.benefits, v.working_hours,
              v.salary_min, v.salary_max, v.show_salary, v.additional_questions, v.status,
              -- DATE_FORMAT, not the raw column. A DATE read through the driver
              -- becomes a JS Date and serialises to UTC, so a deadline of the
              -- 31st reached the candidate as "2026-08-30T20:00:00.000Z" — a day
              -- early, and in a format nobody can read.
              DATE_FORMAT(v.application_deadline, '%Y-%m-%d') AS application_deadline,
              d.name AS department_name,
              c.name AS company_name, c.logo AS company_logo, c.industry AS company_industry,
              c.website AS company_website, c.color_primary, c.color_secondary, c.address AS company_address
       FROM vacancies v
       LEFT JOIN departments d ON v.department_id = d.id
       LEFT JOIN companies c ON v.company_id = c.id
       WHERE v.public_slug = ? AND v.status = 'Published'`, [req.params.slug]);
    if (!v) return res.status(404).json({ error: 'This job posting is not available' });

    // Both sides are 'YYYY-MM-DD' strings, so this is a plain lexical comparison
    // with no timezone in it. The deadline is inclusive: applications close at the
    // end of the day named, not at the start of it.
    const today = new Date().toISOString().slice(0, 10);
    const closed = !!(v.application_deadline && v.application_deadline < today);
    res.json({
      ...v,
      additional_questions: parseJSON(v.additional_questions, []),
      salary_min: v.show_salary ? v.salary_min : null,
      salary_max: v.show_salary ? v.salary_max : null,
      is_closed: !!closed,
      privacy_version: POLICY_VERSION,
    });
  } catch (err) { console.error('GET /public/jobs/:slug error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

// Submit an application.
router.post('/:slug/apply', upload.single('cv'), async (req, res) => {
  try {
    // Honeypot: hidden field that real users never fill
    if (req.body.company_url) return res.status(400).json({ error: 'Rejected' });

    const [[v]] = await pool.query(
      "SELECT id, company_id, title, recruitment_owner, "
      + "DATE_FORMAT(application_deadline, '%Y-%m-%d') AS application_deadline "
      + "FROM vacancies WHERE public_slug = ? AND status = 'Published'",
      [req.params.slug]);
    if (!v) return res.status(404).json({ error: 'This job posting is not available' });
    // Read and compared exactly as the job page does, so the gate and the page can
    // never disagree about whether a vacancy is still open. Through the driver
    // these dates shift into UTC and a deadline closes a day early.
    if (v.application_deadline && v.application_deadline < new Date().toISOString().slice(0, 10)) {
      return res.status(410).json({ error: 'The application deadline for this job has passed' });
    }

    const b = req.body;
    const errors = [];
    if (!b.first_name) errors.push('First name is required');
    if (!b.last_name) errors.push('Last name is required');
    if (!b.email || !EMAIL_RE.test(b.email)) errors.push('A valid email is required');
    if (!b.phone) errors.push('Phone number is required');
    if (!(b.consent === 'true' || b.consent === true || b.consent === '1')) errors.push('You must accept the privacy & data-protection consent');
    if (errors.length) return res.status(422).json({ error: 'Validation failed', missing: errors });

    const companyId = v.company_id;

    // Dedupe the candidate (person) by company + email
    let [[candidate]] = await pool.query('SELECT * FROM candidates WHERE company_id = ? AND email = ? LIMIT 1', [companyId, b.email]);
    let candidateId;
    if (candidate) {
      candidateId = candidate.id;
    } else {
      const [[defStage]] = await pool.query('SELECT id FROM ats_stages WHERE is_default = TRUE LIMIT 1');
      const [r] = await pool.query('INSERT INTO candidates SET ?', {
        first_name: b.first_name, last_name: b.last_name, email: b.email, phone: b.phone,
        nationality: b.nationality || null, company_id: companyId, vacancy_id: v.id,
        current_stage_id: defStage?.id || null, status: 'Active', applied_date: new Date(),
        // Nobody on staff added this one — the applicant did, through the public
        // form. Recorded so the list distinguishes it from an unattributed row.
        created_source: 'Careers Portal',
      });
      candidateId = r.insertId;
    }

    // Block a duplicate application to the same vacancy
    const [[dupApp]] = await pool.query('SELECT id FROM job_applications WHERE vacancy_id = ? AND candidate_id = ?', [v.id, candidateId]);
    if (dupApp) return res.status(409).json({ error: 'You have already applied for this position' });

    // CV: store + parse
    let cvFileId = null;
    if (req.file) {
      const ext = path.extname(req.file.originalname).toLowerCase();
      let cvText = ''; let extracted = {};
      try { cvText = await extractTextFromFile(req.file.path, ext); } catch { cvText = ''; }
      try { extracted = await parseEmployeeDocument(cvText, 'CV'); } catch { extracted = {}; }
      const [fr] = await pool.query('INSERT INTO application_files SET ?', {
        company_id: companyId, candidate_id: candidateId, kind: 'cv',
        file_name: req.file.originalname, file_type: req.file.mimetype, file_size: req.file.size, storage_key: req.file.filename,
      });
      cvFileId = fr.insertId;
      await pool.query('UPDATE candidates SET cv_file_name = ?, cv_text = ?, ai_analysis = ? WHERE id = ?',
        [req.file.originalname, cvText || null, JSON.stringify(extracted || {}), candidateId]);
    }

    // Create the application. `heard_about_us` is constrained to the known
    // option set — this endpoint is public/unauthenticated, so never persist a
    // free-form value the UI didn't offer.
    const heardAboutUs = HEARD_ABOUT_US_OPTIONS.includes(b.heard_about_us) ? b.heard_about_us : null;
    const [appRes] = await pool.query('INSERT INTO job_applications SET ?', {
      company_id: companyId, vacancy_id: v.id, candidate_id: candidateId,
      stage: 'New Application', status: 'Open', assigned_to: v.recruitment_owner || null,
      source: b.source || b.utm_source || 'Direct',
      heard_about_us: heardAboutUs,
      referrer_name: heardAboutUs === 'Referral' && b.referrer_name ? String(b.referrer_name).slice(0, 200) : null,
      utm_source: b.utm_source || null, utm_medium: b.utm_medium || null, utm_campaign: b.utm_campaign || null,
      utm_content: b.utm_content || null, utm_term: b.utm_term || null,
      current_location: b.current_location || null, current_job_title: b.current_job_title || null,
      years_experience: b.years_experience || null, expected_salary: b.expected_salary || null,
      notice_period: b.notice_period || null, available_date: b.available_date || null,
      linkedin_url: b.linkedin_url || null, portfolio_url: b.portfolio_url || null,
      cover_letter: b.cover_letter || null, answers: b.answers ? JSON.stringify(parseJSON(b.answers, {})) : null,
      cv_file_id: cvFileId,
    });
    const applicationId = appRes.insertId;
    if (cvFileId) await pool.query('UPDATE application_files SET application_id = ? WHERE id = ?', [applicationId, cvFileId]);

    // Consent record
    await pool.query('INSERT INTO application_consents SET ?', {
      company_id: companyId, vacancy_id: v.id, application_id: applicationId, candidate_email: b.email,
      accepted: 1, policy_version: b.privacy_version || POLICY_VERSION,
      ip_address: (req.headers['x-forwarded-for'] || req.ip || '').toString().slice(0, 64),
    });

    // Timeline + audit
    await pool.query('INSERT INTO application_events SET ?', {
      company_id: companyId, application_id: applicationId, user_id: null, user_name: 'Applicant',
      event_type: 'submitted', to_stage: 'New Application',
      detail: `Application submitted${b.utm_source ? ` via ${b.utm_source}` : ''}`,
    });
    await addAudit(pool, { id: null, name: 'Public' }, 'Recruitment', 'Application Submitted',
      `New application for "${v.title}" from ${b.first_name} ${b.last_name}`, companyId);

    // Notify recruitment owner (or HR), in-app + email
    const [[company]] = await pool.query('SELECT name FROM companies WHERE id = ?', [companyId]);
    if (v.recruitment_owner) {
      await notify(pool, { userId: v.recruitment_owner, companyId, type: 'recruitment', title: 'New application', body: `${b.first_name} ${b.last_name} applied for ${v.title}`, link: '/applicants' });
      const [[owner]] = await pool.query('SELECT email, name FROM users WHERE id = ?', [v.recruitment_owner]);
      if (owner?.email) {
        const tpl = getTemplate('hr_new_application', { name: owner.name, candidate: `${b.first_name} ${b.last_name}`, position: v.title, company: company?.name });
        await sendEmail({ to: owner.email, toName: owner.name, subject: tpl.subject, html: tpl.html, companyId, templateType: 'hr_new_application', relatedModule: 'Recruitment', relatedId: applicationId });
      }
    } else {
      await notifyRole(pool, companyId, ['admin', 'hr_manager'], { type: 'recruitment', title: 'New application', body: `${b.first_name} ${b.last_name} applied for ${v.title}`, link: '/applicants' });
    }

    // Candidate confirmation email (best-effort)
    const cTpl = getTemplate('application_confirmation', { name: `${b.first_name} ${b.last_name}`, position: v.title, company: company?.name });
    await sendEmail({ to: b.email, toName: `${b.first_name} ${b.last_name}`, subject: cTpl.subject, html: cTpl.html, companyId, templateType: 'application_confirmation', relatedModule: 'Recruitment', relatedId: applicationId });

    res.status(201).json({ success: true, message: 'Your application has been submitted successfully.' });
  } catch (err) {
    console.error('POST /public/jobs/:slug/apply error:', err);
    res.status(500).json({ error: 'Could not submit your application. Please try again.' });
  }
});

export default router;
