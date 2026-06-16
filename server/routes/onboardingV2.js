import { Router } from 'express';
import pool from '../config/db.js';
import { auth } from '../middleware/auth.js';
import { authorize } from '../middleware/rbac.js';
import { addAudit } from '../services/auditService.js';
import { tenantScope, companyClause, resolveWriteCompanyId } from '../middleware/tenant.js';
import { validate } from '../middleware/validate.js';
import { extractTextFromFile } from '../services/cvParserService.js';
import { parseEmployeeDocument } from '../services/deepseekService.js';
import { sendEmail } from '../services/emailService.js';
import { notify, notifyRole } from '../services/notificationService.js';
import {
  STAGES, nextStage, stageIndex, validateStage, profileCompleteness, isValidIBAN, STAGE_LABELS,
} from '../services/onboardingStageService.js';
import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import { ensureUploadDir } from '../config/storage.js';

const UP_DIR = ensureUploadDir('onboarding_files');
const storage = multer.diskStorage({
  destination: (req, file, cb) => { cb(null, ensureUploadDir('onboarding_files')); },
  filename: (req, file, cb) => cb(null, `${crypto.randomBytes(12).toString('hex')}${path.extname(file.originalname)}`),
});
const ALLOWED_EXT = ['.pdf', '.doc', '.docx', '.txt', '.png', '.jpg', '.jpeg', '.webp', '.xls', '.xlsx'];
const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(ALLOWED_EXT.includes(ext) ? null : new Error(`Unsupported file type: ${ext}`), ALLOWED_EXT.includes(ext));
  },
});

const router = Router();
router.use(auth, tenantScope);

// ── Helpers ──────────────────────────────────────────────────────────────────
async function getRecord(req, id) {
  const co = companyClause(req, 'company_id');
  const [[r]] = await pool.query('SELECT * FROM onboarding_records WHERE id = ?' + co.clause, [id, ...co.params]);
  return r || null;
}
async function logEvent(record, user, eventType, detail, fromStage = null, toStage = null) {
  try {
    await pool.query('INSERT INTO onboarding_events SET ?', {
      onboarding_id: record.id, company_id: record.company_id,
      user_id: user?.id || null, user_name: user?.name || 'System',
      event_type: eventType, from_stage: fromStage, to_stage: toStage, detail,
    });
  } catch (e) { console.error('onboarding event log error:', e.message); }
}
async function recordFile(record, kind, refId, file, userId) {
  const [r] = await pool.query('INSERT INTO onboarding_files SET ?', {
    onboarding_id: record.id, company_id: record.company_id, kind, ref_id: refId,
    file_name: file.originalname, file_type: file.mimetype, file_size: file.size,
    storage_key: file.filename, uploaded_by: userId,
  });
  return r.insertId;
}
// Load everything needed to validate / render a record.
async function loadAggregate(record) {
  const id = record.id;
  const [[profile]] = await pool.query('SELECT * FROM onboarding_profiles WHERE onboarding_id = ?', [id]);
  const [[approval]] = await pool.query('SELECT * FROM onboarding_approvals WHERE onboarding_id = ? ORDER BY id DESC LIMIT 1', [id]);
  const [offers] = await pool.query('SELECT * FROM onboarding_offers WHERE onboarding_id = ? ORDER BY id', [id]);
  const [[signedOffer]] = await pool.query('SELECT * FROM onboarding_signed_offer WHERE onboarding_id = ?', [id]);
  const [documents] = await pool.query('SELECT * FROM onboarding_documents WHERE onboarding_id = ? ORDER BY id', [id]);
  const [visaSteps] = await pool.query('SELECT * FROM onboarding_visa_steps WHERE onboarding_id = ? ORDER BY sort_order, id', [id]);
  const [[bank]] = await pool.query('SELECT * FROM onboarding_bank_details WHERE onboarding_id = ?', [id]);
  return { record, profile, approval, offers, signedOffer, documents, visaSteps, bank };
}
const DEFAULT_DOCS = [
  ['photo', 'Personal Photo', 1], ['passport', 'Passport Copy', 1], ['emirates_id', 'Emirates ID', 0],
  ['national_id', 'National ID', 0], ['visa_copy', 'Visa Copy', 0], ['education_cert', 'Educational Certificates', 1],
  ['experience_cert', 'Experience Certificates', 0], ['employment_form', 'Signed Employment Forms', 1],
  ['emergency_contact', 'Emergency Contact Form', 1], ['personal_info', 'Personal Information Form', 1],
];
const DEFAULT_VISA = [
  ['visa_docs', 'Required Visa Documents', 1], ['application', 'Application Submission', 1],
  ['medical', 'Medical Test', 1], ['emirates_id', 'Emirates ID Application', 1],
  ['stamping', 'Residency Stamping', 1], ['labour_contract', 'Labour Contract (MoHRE)', 1],
  ['gov_approval', 'Government Approval', 1],
];
async function seedDocuments(record) {
  const [existing] = await pool.query('SELECT id FROM onboarding_documents WHERE onboarding_id = ?', [record.id]);
  if (existing.length) return;
  for (const [doc_key, label, required] of DEFAULT_DOCS) {
    await pool.query('INSERT INTO onboarding_documents SET ?', { onboarding_id: record.id, company_id: record.company_id, doc_key, label, required, status: 'Missing' });
  }
}
async function seedVisa(record) {
  const [existing] = await pool.query('SELECT id FROM onboarding_visa_steps WHERE onboarding_id = ?', [record.id]);
  if (existing.length) return;
  let i = 0;
  for (const [step_key, label, required] of DEFAULT_VISA) {
    await pool.query('INSERT INTO onboarding_visa_steps SET ?', { onboarding_id: record.id, company_id: record.company_id, step_key, label, required, sort_order: i++, status: 'Not Started' });
  }
}
async function setStage(record, toStage, user, detail) {
  const from = record.stage;
  await pool.query('UPDATE onboarding_records SET stage = ? WHERE id = ?', [toStage, record.id]);
  await logEvent(record, user, 'stage_change', detail || `${STAGE_LABELS[from]} → ${STAGE_LABELS[toStage]}`, from, toStage);
  record.stage = toStage;
}

// ── List ─────────────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const co = companyClause(req, 'o.company_id');
    let sql = `SELECT o.id, o.stage, o.status, o.offer_state, o.started_at, o.completed_at, o.company_id,
                 p.first_name, p.last_name, p.email, p.phone, p.profile_completeness,
                 c.short_code, c.name AS company_name
               FROM onboarding_records o
               LEFT JOIN onboarding_profiles p ON p.onboarding_id = o.id
               LEFT JOIN companies c ON o.company_id = c.id
               WHERE 1=1` + co.clause;
    const params = [...co.params];
    if (req.query.stage) { sql += ' AND o.stage = ?'; params.push(req.query.stage); }
    if (req.query.search) { const s = `%${req.query.search}%`; sql += ' AND (p.first_name LIKE ? OR p.last_name LIKE ? OR p.email LIKE ?)'; params.push(s, s, s); }
    sql += ' ORDER BY o.started_at DESC LIMIT 500';
    const [rows] = await pool.query(sql, params);
    res.json(rows.map((r) => ({ ...r, stage_label: STAGE_LABELS[r.stage], stage_index: stageIndex(r.stage), total_stages: STAGES.length })));
  } catch (err) { console.error('GET /onboarding/v2 error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

// ── Create draft ───────────────────────────────────────────────────────────────
router.post('/', authorize('admin', 'hr_manager', 'hr_specialist', 'recruiter'), async (req, res) => {
  try {
    const company_id = resolveWriteCompanyId(req, req.body.company_id);
    if (!company_id) return res.status(400).json({ error: 'Company is required' });
    const [r] = await pool.query('INSERT INTO onboarding_records SET ?', {
      company_id, stage: 'DRAFT', status: 'In Progress',
      candidate_id: req.body.candidate_id || null, vacancy_id: req.body.vacancy_id || null,
      assigned_to: req.user.id, created_by: req.user.id,
    });
    const record = { id: r.insertId, company_id, stage: 'DRAFT' };
    // create an empty profile shell, optionally seeded from a linked candidate
    let seed = {};
    if (req.body.candidate_id) {
      const [[cand]] = await pool.query('SELECT first_name,last_name,email,phone,nationality FROM candidates WHERE id = ? AND company_id = ?', [req.body.candidate_id, company_id]);
      if (cand) seed = cand;
    }
    await pool.query('INSERT INTO onboarding_profiles SET ?', { onboarding_id: r.insertId, company_id, ...seed });
    await logEvent(record, req.user, 'created', 'Onboarding draft created');
    await addAudit(pool, req.user, 'Onboarding', 'Created', `Onboarding #${r.insertId} created`);
    res.status(201).json({ id: r.insertId, stage: 'DRAFT' });
  } catch (err) { console.error('POST /onboarding/v2 error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

// ── CV upload + auto extraction ─────────────────────────────────────────────────
router.post('/:id/cv', authorize('admin', 'hr_manager', 'hr_specialist', 'recruiter'), upload.single('cv'), async (req, res) => {
  try {
    const record = await getRecord(req, req.params.id);
    if (!record) return res.status(404).json({ error: 'Onboarding not found' });
    if (!req.file) return res.status(400).json({ error: 'No CV file uploaded' });

    const ext = path.extname(req.file.originalname).toLowerCase();
    let cvText = '';
    try { cvText = await extractTextFromFile(req.file.path, ext); } catch { cvText = ''; }
    let extracted = {};
    try { extracted = await parseEmployeeDocument(cvText, 'CV'); } catch { extracted = {}; }

    const fileId = await recordFile(record, 'cv', null, req.file, req.user.id);

    // Merge extracted data into the profile, tracking provenance
    const extractedFields = {};
    const setIf = (k, v) => { if (v !== undefined && v !== null && String(v) !== '') { extractedFields[k] = true; return v; } return null; };
    const profilePatch = {
      first_name: setIf('first_name', extracted.first_name),
      last_name: setIf('last_name', extracted.last_name),
      email: setIf('email', extracted.email),
      phone: setIf('phone', extracted.phone),
      nationality: setIf('nationality', extracted.nationality),
      current_job_title: setIf('current_job_title', extracted.current_job_title || extracted.job_title),
      education: extracted.education ? JSON.stringify(extracted.education) : null,
      work_experience: extracted.work_history ? JSON.stringify(extracted.work_history) : (extracted.work_experience ? JSON.stringify(extracted.work_experience) : null),
      skills: extracted.skills ? JSON.stringify(extracted.skills) : null,
      languages: extracted.languages ? JSON.stringify(extracted.languages) : null,
      certifications: extracted.certifications ? JSON.stringify(extracted.certifications) : null,
      extracted_data: JSON.stringify(extracted || {}),
      extracted_fields: JSON.stringify(extractedFields),
      cv_file_id: fileId,
    };
    if (extracted.education) extractedFields.education = true;
    if (profilePatch.work_experience) extractedFields.work_experience = true;

    // Only overwrite empty profile fields (don't clobber HR edits)
    const [[cur]] = await pool.query('SELECT * FROM onboarding_profiles WHERE onboarding_id = ?', [record.id]);
    const merged = { ...profilePatch };
    if (cur) {
      for (const k of ['first_name', 'last_name', 'email', 'phone', 'nationality', 'current_job_title']) {
        if (cur[k]) merged[k] = cur[k]; // keep existing value
      }
    }
    const completeness = profileCompleteness({ ...cur, ...merged,
      education: merged.education, work_experience: merged.work_experience, skills: merged.skills, languages: merged.languages });
    merged.profile_completeness = completeness;

    if (cur) await pool.query('UPDATE onboarding_profiles SET ? WHERE onboarding_id = ?', [merged, record.id]);
    else await pool.query('INSERT INTO onboarding_profiles SET ?', { onboarding_id: record.id, company_id: record.company_id, ...merged });

    if (record.stage === 'DRAFT') await setStage(record, 'CV_UPLOADED', req.user, 'CV uploaded and parsed');
    await logEvent(record, req.user, 'cv_uploaded', `CV "${req.file.originalname}" uploaded & parsed`);
    await addAudit(pool, req.user, 'Onboarding', 'CV Uploaded', `CV uploaded for onboarding #${record.id}`);
    res.json({ success: true, extracted, extracted_fields: extractedFields, profile_completeness: completeness, stage: record.stage });
  } catch (err) { console.error('POST /onboarding/v2/:id/cv error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

// ── Aggregate GET ────────────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const record = await getRecord(req, req.params.id);
    if (!record) return res.status(404).json({ error: 'Onboarding not found' });
    const agg = await loadAggregate(record);
    const [events] = await pool.query('SELECT * FROM onboarding_events WHERE onboarding_id = ? ORDER BY created_at DESC LIMIT 200', [record.id]);
    const [comments] = await pool.query(
      `SELECT cm.*, u.name AS user_name FROM onboarding_comments cm LEFT JOIN users u ON cm.user_id = u.id
       WHERE cm.onboarding_id = ? ORDER BY cm.created_at DESC`, [record.id]);
    const missing = validateStage(record.stage, agg);
    const [[company]] = await pool.query('SELECT name, short_code FROM companies WHERE id = ?', [record.company_id]);
    res.json({
      ...agg.record,
      company_name: company?.name || null, company_short_code: company?.short_code || null,
      stage_label: STAGE_LABELS[record.stage], stage_index: stageIndex(record.stage),
      total_stages: STAGES.length, stages: STAGES,
      profile: agg.profile, approval: agg.approval, offers: agg.offers, total_offers: agg.offers.length,
      signed_offer: agg.signedOffer, documents: agg.documents, visa_steps: agg.visaSteps, bank: agg.bank,
      events, comments, missing_requirements: missing, can_advance: missing.length === 0,
    });
  } catch (err) { console.error('GET /onboarding/v2/:id error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

// ── Profile edit + verify ─────────────────────────────────────────────────────
const PROFILE_FIELDS = ['first_name', 'last_name', 'full_name', 'email', 'phone', 'address', 'nationality',
  'date_of_birth', 'gender', 'marital_status', 'current_job_title', 'total_experience_years'];
const PROFILE_JSON = ['education', 'skills', 'languages', 'work_experience', 'certifications'];

router.put('/:id/profile', authorize('admin', 'hr_manager', 'hr_specialist', 'recruiter'), async (req, res) => {
  try {
    const record = await getRecord(req, req.params.id);
    if (!record) return res.status(404).json({ error: 'Onboarding not found' });
    const patch = {};
    for (const f of PROFILE_FIELDS) if (req.body[f] !== undefined) patch[f] = req.body[f] === '' ? null : req.body[f];
    for (const f of PROFILE_JSON) if (req.body[f] !== undefined) patch[f] = req.body[f] == null ? null : JSON.stringify(req.body[f]);
    if (patch.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(patch.email)) return res.status(422).json({ error: 'Validation failed', errors: [{ field: 'email', message: 'Invalid email' }] });
    if (!Object.keys(patch).length) return res.status(400).json({ error: 'No fields to update' });

    const [[cur]] = await pool.query('SELECT * FROM onboarding_profiles WHERE onboarding_id = ?', [record.id]);
    const after = { ...cur, ...patch };
    patch.profile_completeness = profileCompleteness(after);
    await pool.query('UPDATE onboarding_profiles SET ? WHERE onboarding_id = ?', [patch, record.id]);
    await logEvent(record, req.user, 'profile_edited', `Profile edited: ${Object.keys(patch).filter((k) => k !== 'profile_completeness').join(', ')}`);
    res.json({ success: true, profile_completeness: patch.profile_completeness });
  } catch (err) { console.error('PUT /onboarding/v2/:id/profile error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

router.post('/:id/verify-profile', authorize('admin', 'hr_manager', 'hr_specialist'), async (req, res) => {
  try {
    const record = await getRecord(req, req.params.id);
    if (!record) return res.status(404).json({ error: 'Onboarding not found' });
    await pool.query('UPDATE onboarding_profiles SET profile_verified = 1 WHERE onboarding_id = ?', [record.id]);
    await logEvent(record, req.user, 'profile_verified', 'Candidate profile verified');
    res.json({ success: true });
  } catch (err) { console.error('verify-profile error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

// ── HR Manager review (approve / reject / more info) ─────────────────────────────
router.post('/:id/review', authorize('admin', 'hr_manager'), validate({
  decision: { required: true, type: 'string', enum: ['Approved', 'Rejected', 'More Info'] },
}), async (req, res) => {
  try {
    const record = await getRecord(req, req.params.id);
    if (!record) return res.status(404).json({ error: 'Onboarding not found' });
    const { decision, note } = req.body;
    if (decision === 'Rejected' && !req.body.rejection_reason) {
      return res.status(422).json({ error: 'Validation failed', errors: [{ field: 'rejection_reason', message: 'A rejection reason is required' }] });
    }
    await pool.query('INSERT INTO onboarding_approvals SET ?', {
      onboarding_id: record.id, company_id: record.company_id, decision,
      decided_by: req.user.id, decided_at: new Date(), decision_note: note || null,
      rejection_reason: decision === 'Rejected' ? req.body.rejection_reason : null,
    });
    if (decision === 'Approved') {
      await setStage(record, 'HR_APPROVED', req.user, 'Candidate approved by HR Manager');
    } else if (decision === 'Rejected') {
      await pool.query('UPDATE onboarding_records SET stage = ?, status = ?, rejection_reason = ? WHERE id = ?',
        ['REJECTED', 'Cancelled', req.body.rejection_reason, record.id]);
      await logEvent(record, req.user, 'rejected', `Candidate rejected: ${req.body.rejection_reason}`, record.stage, 'REJECTED');
    } else {
      await logEvent(record, req.user, 'more_info', note || 'More information requested');
    }
    await addAudit(pool, req.user, 'Onboarding', `Review ${decision}`, `Onboarding #${record.id} ${decision}`);
    res.json({ success: true, decision });
  } catch (err) { console.error('POST /onboarding/v2/:id/review error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

// ── Offers ────────────────────────────────────────────────────────────────────
const OFFER_FIELDS = ['candidate_name', 'job_title', 'department', 'reporting_manager', 'work_location',
  'employment_type', 'joining_date', 'basic_salary', 'commission_structure', 'probation_period', 'working_hours',
  'leave_policy', 'benefits', 'visa_responsibility', 'medical_insurance', 'notice_period', 'offer_expiry_date',
  'additional_terms', 'internal_notes'];

router.post('/:id/offers', authorize('admin', 'hr_manager'), validate({
  job_title: { required: true, type: 'string', minLen: 1, maxLen: 200 },
  work_location: { required: true, type: 'string' },
  joining_date: { required: true, type: 'date' },
  basic_salary: { required: true, type: 'number', min: 0 },
  offer_expiry_date: { required: true, type: 'date' },
}), async (req, res) => {
  try {
    const record = await getRecord(req, req.params.id);
    if (!record) return res.status(404).json({ error: 'Onboarding not found' });
    if (stageIndex(record.stage) < stageIndex('HR_APPROVED')) {
      return res.status(409).json({ error: 'Candidate must be approved by HR before creating an offer' });
    }
    // Multi-offer guard: a previous offer must be closed AND documented.
    const [offers] = await pool.query('SELECT * FROM onboarding_offers WHERE onboarding_id = ? ORDER BY id', [record.id]);
    if (offers.length) {
      const last = offers[offers.length - 1];
      const closed = ['Rejected', 'Withdrawn', 'Expired'].includes(last.status);
      const documented = (last.rejection_reason && last.rejection_reason.trim()) || (last.internal_notes && last.internal_notes.trim());
      if (!closed || !documented) {
        return res.status(409).json({ error: 'Cannot create a new offer until the previous offer is closed with a documented rejection reason or HR note', blocking_offer_id: last.id, blocking_offer_status: last.status });
      }
    }
    const [[comp]] = await pool.query('SELECT short_code FROM companies WHERE id = ?', [record.company_id]);
    const [[seqRow]] = await pool.query('SELECT COUNT(*) c FROM onboarding_offers WHERE company_id = ?', [record.company_id]);
    const offerNumber = `OFR-${comp?.short_code || 'CO'}-${String((seqRow.c || 0) + 1).padStart(5, '0')}`;

    const data = { onboarding_id: record.id, company_id: record.company_id, offer_number: offerNumber, version: offers.length + 1, status: 'Draft', created_by: req.user.id };
    for (const f of OFFER_FIELDS) if (req.body[f] !== undefined) data[f] = req.body[f] === '' ? null : req.body[f];
    if (req.body.allowances !== undefined) data.allowances = JSON.stringify(req.body.allowances);
    const [r] = await pool.query('INSERT INTO onboarding_offers SET ?', data);
    await logEvent(record, req.user, 'offer_created', `Offer ${offerNumber} (v${data.version}) created`);
    await addAudit(pool, req.user, 'Onboarding', 'Offer Created', `${offerNumber} for onboarding #${record.id}`);
    res.status(201).json({ id: r.insertId, offer_number: offerNumber, version: data.version, status: 'Draft' });
  } catch (err) { console.error('POST /onboarding/v2/:id/offers error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

async function getOfferScoped(req, offerId) {
  const co = companyClause(req, 'company_id');
  const [[o]] = await pool.query('SELECT * FROM onboarding_offers WHERE id = ?' + co.clause, [offerId, ...co.params]);
  return o || null;
}

router.put('/offers/:offerId', authorize('admin', 'hr_manager'), async (req, res) => {
  try {
    const offer = await getOfferScoped(req, req.params.offerId);
    if (!offer) return res.status(404).json({ error: 'Offer not found' });
    if (offer.status !== 'Draft') return res.status(409).json({ error: 'Only a Draft offer can be edited' });
    const data = {};
    for (const f of OFFER_FIELDS) if (req.body[f] !== undefined) data[f] = req.body[f] === '' ? null : req.body[f];
    if (req.body.allowances !== undefined) data.allowances = JSON.stringify(req.body.allowances);
    if (Object.keys(data).length) await pool.query('UPDATE onboarding_offers SET ? WHERE id = ?', [data, offer.id]);
    res.json({ success: true });
  } catch (err) { console.error('PUT /onboarding/v2/offers/:offerId error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

router.post('/offers/:offerId/send', authorize('admin', 'hr_manager'), async (req, res) => {
  try {
    const offer = await getOfferScoped(req, req.params.offerId);
    if (!offer) return res.status(404).json({ error: 'Offer not found' });
    if (offer.status !== 'Draft') return res.status(409).json({ error: `Offer is already ${offer.status}` });
    const record = await getRecord(req, offer.onboarding_id);
    const [[profile]] = await pool.query('SELECT * FROM onboarding_profiles WHERE onboarding_id = ?', [offer.onboarding_id]);
    const to = profile?.email;
    if (!to) return res.status(422).json({ error: 'Candidate email is missing on the profile' });
    const [[comp]] = await pool.query('SELECT name FROM companies WHERE id = ?', [offer.company_id]);
    const [[handler]] = await pool.query('SELECT email, name FROM users WHERE id = ?', [req.user.id]);

    const data = {
      candidate_name: offer.candidate_name || `${profile.first_name || ''} ${profile.last_name || ''}`.trim(),
      company: comp?.name, offer_number: offer.offer_number, job_title: offer.job_title, department: offer.department,
      reporting_manager: offer.reporting_manager, work_location: offer.work_location, employment_type: offer.employment_type,
      joining_date: offer.joining_date, basic_salary: offer.basic_salary, allowances: offer.allowances,
      commission_structure: offer.commission_structure, probation_period: offer.probation_period, working_hours: offer.working_hours,
      leave_policy: offer.leave_policy, benefits: offer.benefits, visa_responsibility: offer.visa_responsibility,
      medical_insurance: offer.medical_insurance, notice_period: offer.notice_period, offer_expiry_date: offer.offer_expiry_date,
      additional_terms: offer.additional_terms,
    };
    const { getTemplate } = await import('../services/emailTemplates.js');
    const { subject, html } = getTemplate('employment_offer', data);

    const result = await sendEmail({ to, toName: data.candidate_name, subject, html, companyId: offer.company_id, templateType: 'employment_offer', relatedModule: 'Onboarding', relatedId: offer.id, sentBy: req.user.id });
    // CC copy to the handling HR user
    if (handler?.email) {
      await sendEmail({ to: handler.email, toName: handler.name, subject: `[Copy] ${subject}`, html, companyId: offer.company_id, templateType: 'employment_offer', relatedModule: 'Onboarding', relatedId: offer.id, sentBy: req.user.id });
    }

    await pool.query('UPDATE onboarding_offers SET status = ?, sent_by = ?, sent_at = NOW() WHERE id = ?', ['Sent', req.user.id, offer.id]);
    await pool.query("UPDATE onboarding_records SET offer_state = 'sent' WHERE id = ?", [offer.onboarding_id]);
    if (record && stageIndex(record.stage) < stageIndex('OFFER_SENT')) await setStage(record, 'OFFER_SENT', req.user, `Offer ${offer.offer_number} sent`);
    await logEvent({ id: offer.onboarding_id, company_id: offer.company_id }, req.user, 'offer_sent', `Offer ${offer.offer_number} sent to ${to}${handler?.email ? ` (copy to ${handler.email})` : ''}`);
    await addAudit(pool, req.user, 'Onboarding', 'Offer Sent', `${offer.offer_number} → ${to}`);
    res.json({ success: true, email: result, offer_number: offer.offer_number });
  } catch (err) { console.error('POST /onboarding/v2/offers/:offerId/send error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

router.post('/offers/:offerId/respond', authorize('admin', 'hr_manager', 'hr_specialist'), validate({
  response: { required: true, type: 'string', enum: ['Accepted', 'Rejected'] },
}), async (req, res) => {
  try {
    const offer = await getOfferScoped(req, req.params.offerId);
    if (!offer) return res.status(404).json({ error: 'Offer not found' });
    if (offer.status !== 'Sent') return res.status(409).json({ error: `Offer must be Sent to record a response (currently ${offer.status})` });
    const { response } = req.body;
    if (response === 'Rejected' && !req.body.rejection_reason) {
      return res.status(422).json({ error: 'Validation failed', errors: [{ field: 'rejection_reason', message: 'A rejection reason is required' }] });
    }
    const record = await getRecord(req, offer.onboarding_id);
    await pool.query('UPDATE onboarding_offers SET status = ?, response = ?, responded_at = NOW(), rejection_reason = ? WHERE id = ?',
      [response, response, response === 'Rejected' ? req.body.rejection_reason : null, offer.id]);
    if (response === 'Accepted') {
      await pool.query("UPDATE onboarding_records SET offer_state = 'accepted' WHERE id = ?", [offer.onboarding_id]);
      await setStage(record, 'OFFER_ACCEPTED', req.user, `Offer ${offer.offer_number} accepted`);
      await pool.query('INSERT IGNORE INTO onboarding_signed_offer SET ?', { onboarding_id: record.id, company_id: record.company_id, verification_status: 'Pending' });
    } else {
      await pool.query("UPDATE onboarding_records SET offer_state = 'rejected' WHERE id = ?", [offer.onboarding_id]);
      await logEvent(record, req.user, 'offer_rejected', `Offer ${offer.offer_number} rejected: ${req.body.rejection_reason}`);
    }
    await addAudit(pool, req.user, 'Onboarding', `Offer ${response}`, `${offer.offer_number}`);
    if (record?.assigned_to) {
      await notify(pool, { userId: record.assigned_to, companyId: offer.company_id, type: 'onboarding',
        title: `Offer ${response.toLowerCase()}`, body: `Offer ${offer.offer_number} was ${response.toLowerCase()}`, link: '/onboarding' });
    }
    res.json({ success: true, response });
  } catch (err) { console.error('POST /onboarding/v2/offers/:offerId/respond error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

// ── Signed offer ─────────────────────────────────────────────────────────────
router.post('/:id/signed-offer', authorize('admin', 'hr_manager', 'hr_specialist'), upload.single('file'), async (req, res) => {
  try {
    const record = await getRecord(req, req.params.id);
    if (!record) return res.status(404).json({ error: 'Onboarding not found' });
    if (record.stage !== 'OFFER_ACCEPTED' && record.stage !== 'SIGNED_OFFER_UPLOADED') {
      return res.status(409).json({ error: 'Signed offer can only be uploaded after the offer is accepted' });
    }
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const fileId = await recordFile(record, 'signed_offer', null, req.file, req.user.id);
    const signatories = req.body.signatories ? (typeof req.body.signatories === 'string' ? req.body.signatories : JSON.stringify(req.body.signatories)) : null;
    await pool.query(
      `INSERT INTO onboarding_signed_offer (onboarding_id, company_id, file_id, signatories, verification_status)
       VALUES (?, ?, ?, ?, 'Pending')
       ON DUPLICATE KEY UPDATE file_id = VALUES(file_id), signatories = VALUES(signatories), verification_status = 'Pending', verified_by = NULL, verified_at = NULL`,
      [record.id, record.company_id, fileId, signatories]);
    await logEvent(record, req.user, 'signed_offer_uploaded', `Signed offer "${req.file.originalname}" uploaded`);
    res.json({ success: true, file_id: fileId, verification_status: 'Pending' });
  } catch (err) { console.error('POST /onboarding/v2/:id/signed-offer error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

router.post('/:id/signed-offer/verify', authorize('admin', 'hr_manager'), validate({
  status: { required: true, type: 'string', enum: ['Verified', 'Rejected'] },
}), async (req, res) => {
  try {
    const record = await getRecord(req, req.params.id);
    if (!record) return res.status(404).json({ error: 'Onboarding not found' });
    const [[so]] = await pool.query('SELECT * FROM onboarding_signed_offer WHERE onboarding_id = ?', [record.id]);
    if (!so || !so.file_id) return res.status(400).json({ error: 'No signed offer uploaded yet' });
    await pool.query('UPDATE onboarding_signed_offer SET verification_status = ?, verified_by = ?, verified_at = NOW(), notes = ? WHERE onboarding_id = ?',
      [req.body.status, req.user.id, req.body.notes || null, record.id]);
    if (req.body.status === 'Verified') {
      await setStage(record, 'SIGNED_OFFER_UPLOADED', req.user, 'Signed offer verified');
      await seedDocuments(record);
      await setStage(record, 'DOCUMENTS_COLLECTION', req.user, 'Document collection started');
    }
    await addAudit(pool, req.user, 'Onboarding', `Signed offer ${req.body.status}`, `Onboarding #${record.id}`);
    res.json({ success: true, status: req.body.status, stage: record.stage });
  } catch (err) { console.error('signed-offer/verify error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

// ── Documents ────────────────────────────────────────────────────────────────
router.post('/:id/documents/seed', authorize('admin', 'hr_manager', 'hr_specialist'), async (req, res) => {
  try {
    const record = await getRecord(req, req.params.id);
    if (!record) return res.status(404).json({ error: 'Onboarding not found' });
    await seedDocuments(record);
    const [docs] = await pool.query('SELECT * FROM onboarding_documents WHERE onboarding_id = ?', [record.id]);
    res.json(docs);
  } catch (err) { console.error('documents/seed error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

async function getDocScoped(req, docId) {
  const co = companyClause(req, 'company_id');
  const [[d]] = await pool.query('SELECT * FROM onboarding_documents WHERE id = ?' + co.clause, [docId, ...co.params]);
  return d || null;
}
router.post('/documents/:docId/upload', authorize('admin', 'hr_manager', 'hr_specialist'), upload.single('file'), async (req, res) => {
  try {
    const doc = await getDocScoped(req, req.params.docId);
    if (!doc) return res.status(404).json({ error: 'Document requirement not found' });
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const record = { id: doc.onboarding_id, company_id: doc.company_id };
    const fileId = await recordFile(record, 'document', doc.id, req.file, req.user.id);
    await pool.query('UPDATE onboarding_documents SET file_id = ?, status = ?, expiry_date = ?, notes = ? WHERE id = ?',
      [fileId, 'Pending', req.body.expiry_date || null, req.body.notes || doc.notes, doc.id]);
    await logEvent(record, req.user, 'document_uploaded', `Document "${doc.label}" uploaded`);
    res.json({ success: true, status: 'Pending', file_id: fileId });
  } catch (err) { console.error('documents/:docId/upload error:', err); res.status(500).json({ error: 'Internal server error' }); }
});
router.post('/documents/:docId/verify', authorize('admin', 'hr_manager', 'hr_specialist'), validate({
  status: { required: true, type: 'string', enum: ['Verified', 'Rejected', 'Expired'] },
}), async (req, res) => {
  try {
    const doc = await getDocScoped(req, req.params.docId);
    if (!doc) return res.status(404).json({ error: 'Document requirement not found' });
    await pool.query('UPDATE onboarding_documents SET status = ?, verified_by = ?, verified_at = NOW(), notes = ? WHERE id = ?',
      [req.body.status, req.user.id, req.body.notes || doc.notes, doc.id]);
    await logEvent({ id: doc.onboarding_id, company_id: doc.company_id }, req.user, 'document_verified', `Document "${doc.label}" ${req.body.status}`);
    res.json({ success: true, status: req.body.status });
  } catch (err) { console.error('documents/:docId/verify error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

// ── Visa steps ───────────────────────────────────────────────────────────────
router.post('/:id/visa/seed', authorize('admin', 'hr_manager', 'hr_specialist'), async (req, res) => {
  try {
    const record = await getRecord(req, req.params.id);
    if (!record) return res.status(404).json({ error: 'Onboarding not found' });
    await seedVisa(record);
    const [steps] = await pool.query('SELECT * FROM onboarding_visa_steps WHERE onboarding_id = ? ORDER BY sort_order', [record.id]);
    res.json(steps);
  } catch (err) { console.error('visa/seed error:', err); res.status(500).json({ error: 'Internal server error' }); }
});
router.put('/visa/:stepId', authorize('admin', 'hr_manager', 'hr_specialist'), async (req, res) => {
  try {
    const co = companyClause(req, 'company_id');
    const [[step]] = await pool.query('SELECT * FROM onboarding_visa_steps WHERE id = ?' + co.clause, [req.params.stepId, ...co.params]);
    if (!step) return res.status(404).json({ error: 'Visa step not found' });
    const data = {};
    for (const f of ['status', 'reference_number', 'responsible_user', 'due_date', 'notes']) if (req.body[f] !== undefined) data[f] = req.body[f] === '' ? null : req.body[f];
    if (data.status && ['Completed', 'Approved'].includes(data.status)) data.completed_at = new Date();
    if (Object.keys(data).length) await pool.query('UPDATE onboarding_visa_steps SET ? WHERE id = ?', [data, step.id]);
    await logEvent({ id: step.onboarding_id, company_id: step.company_id }, req.user, 'visa_updated', `Visa step "${step.label}" → ${data.status || 'updated'}`);
    res.json({ success: true });
  } catch (err) { console.error('visa/:stepId error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

// ── Bank details ─────────────────────────────────────────────────────────────
router.put('/:id/bank', authorize('admin', 'hr_manager', 'hr_specialist'), validate({
  bank_name: { required: true, type: 'string', minLen: 1 },
  account_holder_name: { required: true, type: 'string', minLen: 1 },
  account_number: { required: true, type: 'string', minLen: 1 },
  iban: { required: true, type: 'string', minLen: 1 },
}), async (req, res) => {
  try {
    const record = await getRecord(req, req.params.id);
    if (!record) return res.status(404).json({ error: 'Onboarding not found' });
    if (!isValidIBAN(req.body.iban)) return res.status(422).json({ error: 'Validation failed', errors: [{ field: 'iban', message: 'Invalid IBAN format' }] });
    const { bank_name, account_holder_name, account_number, iban, swift_code, branch_name, transfer_method } = req.body;
    await pool.query(
      `INSERT INTO onboarding_bank_details (onboarding_id, company_id, bank_name, account_holder_name, account_number, iban, swift_code, branch_name, transfer_method)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE bank_name=VALUES(bank_name), account_holder_name=VALUES(account_holder_name), account_number=VALUES(account_number),
         iban=VALUES(iban), swift_code=VALUES(swift_code), branch_name=VALUES(branch_name), transfer_method=VALUES(transfer_method),
         verified=0, verified_by=NULL, verified_at=NULL`,
      [record.id, record.company_id, bank_name, account_holder_name, account_number, iban.replace(/\s/g, '').toUpperCase(), swift_code || null, branch_name || null, transfer_method || 'Bank Transfer']);
    await logEvent(record, req.user, 'bank_saved', 'Bank details saved (pending verification)');
    res.json({ success: true });
  } catch (err) { console.error('PUT /onboarding/v2/:id/bank error:', err); res.status(500).json({ error: 'Internal server error' }); }
});
router.post('/:id/bank/verify', authorize('admin', 'hr_manager'), async (req, res) => {
  try {
    const record = await getRecord(req, req.params.id);
    if (!record) return res.status(404).json({ error: 'Onboarding not found' });
    const [[bank]] = await pool.query('SELECT * FROM onboarding_bank_details WHERE onboarding_id = ?', [record.id]);
    if (!bank) return res.status(400).json({ error: 'No bank details to verify' });
    await pool.query('UPDATE onboarding_bank_details SET verified = 1, verified_by = ?, verified_at = NOW() WHERE onboarding_id = ?', [req.user.id, record.id]);
    await logEvent(record, req.user, 'bank_verified', 'Bank details verified');
    res.json({ success: true });
  } catch (err) { console.error('bank/verify error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

// ── Comments ─────────────────────────────────────────────────────────────────
router.post('/:id/comments', validate({ body: { required: true, type: 'string', minLen: 1, maxLen: 2000 } }), async (req, res) => {
  try {
    const record = await getRecord(req, req.params.id);
    if (!record) return res.status(404).json({ error: 'Onboarding not found' });
    await pool.query('INSERT INTO onboarding_comments SET ?', { onboarding_id: record.id, company_id: record.company_id, user_id: req.user.id, body: req.body.body });
    res.status(201).json({ success: true });
  } catch (err) { console.error('comments error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

// ── Advance (gated) ──────────────────────────────────────────────────────────
router.post('/:id/advance', authorize('admin', 'hr_manager', 'hr_specialist'), async (req, res) => {
  try {
    const record = await getRecord(req, req.params.id);
    if (!record) return res.status(404).json({ error: 'Onboarding not found' });
    if (['REJECTED', 'CANCELLED', 'COMPLETED'].includes(record.stage)) return res.status(409).json({ error: `Onboarding is ${record.stage}` });

    const agg = await loadAggregate(record);
    if (record.stage === 'VISA_RESIDENCY' && req.body.visa_not_applicable) agg.visaNotApplicable = true;
    const missing = validateStage(record.stage, agg);
    if (missing.length) return res.status(422).json({ error: 'Stage requirements not met', missing });

    const to = nextStage(record.stage);
    if (!to) return res.status(409).json({ error: 'Already at the final stage' });

    // Side effects on entry to certain stages
    if (to === 'DOCUMENTS_COLLECTION') await seedDocuments(record);
    if (to === 'VISA_RESIDENCY') await seedVisa(record);

    let employeeId = null;
    if (to === 'COMPLETED') {
      // Activate / create the employee in the Employees section from the accepted offer + profile
      employeeId = await finalizeEmployee(record, agg, req.user);
      await pool.query('UPDATE onboarding_records SET stage = ?, status = ?, completed_at = NOW() WHERE id = ?', ['COMPLETED', 'Completed', record.id]);
      await logEvent(record, req.user, 'completed', `Onboarding completed; employee #${employeeId} added to the Employees section`, record.stage, 'COMPLETED');
      if (record.assigned_to) {
        await notify(pool, { userId: record.assigned_to, companyId: record.company_id, type: 'onboarding', title: 'Onboarding completed', body: `Employee added to the Employees section`, link: '/employees' });
      }
    } else {
      await setStage(record, to, req.user, `Advanced to ${STAGE_LABELS[to]}`);
    }
    await addAudit(pool, req.user, 'Onboarding', 'Advanced', `Onboarding #${record.id} → ${STAGE_LABELS[to]}`);
    res.json({ success: true, stage: to, stage_label: STAGE_LABELS[to], employee_id: employeeId });
  } catch (err) { console.error('POST /onboarding/v2/:id/advance error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

// Sum numeric values from an allowances JSON (object or array of {amount}).
function sumAllowances(raw) {
  if (!raw) return 0;
  let a = raw;
  try { if (typeof raw === 'string') a = JSON.parse(raw); } catch { return 0; }
  if (Array.isArray(a)) return a.reduce((s, x) => s + (Number(x?.amount ?? x) || 0), 0);
  if (typeof a === 'object') return Object.values(a).reduce((s, v) => s + (Number(v) || 0), 0);
  return 0;
}

// Creates (or re-activates) the Employees-section record for a completed onboarding.
// Idempotent: if already linked, just re-activates; if an employee with the same
// company+email exists, links to it instead of creating a duplicate.
async function finalizeEmployee(record, agg, user) {
  const profile = agg.profile || {};
  const accepted = (agg.offers || []).find((o) => o.status === 'Accepted');

  if (record.employee_id) {
    await pool.query("UPDATE employees SET status = 'Active' WHERE id = ?", [record.employee_id]);
    return record.employee_id;
  }

  // Reuse an existing employee with the same email in this company, if any.
  if (profile.email) {
    const [[existing]] = await pool.query('SELECT id FROM employees WHERE company_id = ? AND email = ? LIMIT 1', [record.company_id, profile.email]);
    if (existing) {
      await pool.query("UPDATE employees SET status = 'Active' WHERE id = ?", [existing.id]);
      await pool.query('UPDATE onboarding_records SET employee_id = ? WHERE id = ?', [existing.id, record.id]);
      record.employee_id = existing.id;
      await logEvent(record, user, 'employee_linked', `Linked to existing employee #${existing.id} and activated`);
      return existing.id;
    }
  }

  const basic = accepted?.basic_salary != null ? Number(accepted.basic_salary) : null;
  const allowances = accepted ? sumAllowances(accepted.allowances) : 0;
  const fullSalary = basic != null ? basic + allowances : null;

  const [r] = await pool.query('INSERT INTO employees SET ?', {
    company_id: record.company_id, candidate_id: record.candidate_id || null,
    first_name: profile.first_name || 'New', last_name: profile.last_name || 'Employee',
    email: profile.email || null, phone: profile.phone || null, nationality: profile.nationality || null,
    job_title_text: accepted?.job_title || profile.current_job_title || null,
    start_date: accepted?.joining_date || new Date(),
    basic_salary: basic, full_salary: fullSalary,
    status: 'Active',
  });
  await pool.query('UPDATE onboarding_records SET employee_id = ? WHERE id = ?', [r.insertId, record.id]);
  record.employee_id = r.insertId;
  await logEvent(record, user, 'employee_created', `Employee #${r.insertId} created in the Employees section`);
  return r.insertId;
}

// ── Cancel ───────────────────────────────────────────────────────────────────
router.post('/:id/cancel', authorize('admin'), validate({ reason: { required: true, type: 'string', minLen: 1 } }), async (req, res) => {
  try {
    const record = await getRecord(req, req.params.id);
    if (!record) return res.status(404).json({ error: 'Onboarding not found' });
    await pool.query('UPDATE onboarding_records SET stage = ?, status = ?, rejection_reason = ? WHERE id = ?', ['CANCELLED', 'Cancelled', req.body.reason, record.id]);
    await logEvent(record, req.user, 'cancelled', `Onboarding cancelled: ${req.body.reason}`, record.stage, 'CANCELLED');
    await addAudit(pool, req.user, 'Onboarding', 'Cancelled', `Onboarding #${record.id} cancelled`);
    res.json({ success: true });
  } catch (err) { console.error('cancel error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

export default router;
