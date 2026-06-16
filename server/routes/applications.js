import { Router } from 'express';
import pool from '../config/db.js';
import { auth } from '../middleware/auth.js';
import { authorize } from '../middleware/rbac.js';
import { addAudit } from '../services/auditService.js';
import { tenantScope, companyClause } from '../middleware/tenant.js';
import { validate } from '../middleware/validate.js';
import { sendEmail } from '../services/emailService.js';
import { getTemplate } from '../services/emailTemplates.js';
import { notify } from '../services/notificationService.js';
import fs from 'fs';
import { uploadPath } from '../config/storage.js';

const router = Router();
router.use(auth, tenantScope);

export const PIPELINE_STAGES = [
  'New Application', 'CV Screening', 'Shortlisted', 'HR Review', 'Phone Screening',
  'First Interview', 'Technical Interview', 'Final Interview', 'Offer Preparation',
  'Offer Sent', 'Offer Accepted', 'Offer Rejected', 'Hired', 'Rejected', 'Archived',
];
const HR = ['admin', 'hr_manager', 'recruiter'];

async function getApp(req, id) {
  const co = companyClause(req, 'company_id');
  const [[a]] = await pool.query('SELECT * FROM job_applications WHERE id = ?' + co.clause, [id, ...co.params]);
  return a || null;
}
async function logEvent(app, user, type, detail, from = null, to = null) {
  try {
    await pool.query('INSERT INTO application_events SET ?', {
      company_id: app.company_id, application_id: app.id, user_id: user?.id || null,
      user_name: user?.name || 'System', event_type: type, from_stage: from, to_stage: to, detail,
    });
  } catch (e) { console.error('application event error:', e.message); }
}

// ── List ─────────────────────────────────────────────────────────────────────
router.get('/', authorize(...HR), async (req, res) => {
  try {
    const co = companyClause(req, 'a.company_id');
    let sql = `SELECT a.*, c.first_name, c.last_name, c.email, c.phone, c.cv_file_name,
                 v.title AS vacancy_title, u.name AS assigned_to_name
               FROM job_applications a
               JOIN candidates c ON a.candidate_id = c.id
               JOIN vacancies v ON a.vacancy_id = v.id
               LEFT JOIN users u ON a.assigned_to = u.id
               WHERE 1=1` + co.clause;
    const params = [...co.params];
    if (req.query.vacancy_id) { sql += ' AND a.vacancy_id = ?'; params.push(req.query.vacancy_id); }
    if (req.query.stage) { sql += ' AND a.stage = ?'; params.push(req.query.stage); }
    if (req.query.source) { sql += ' AND a.source = ?'; params.push(req.query.source); }
    if (req.query.assignee) { sql += ' AND a.assigned_to = ?'; params.push(req.query.assignee); }
    if (req.query.from) { sql += ' AND a.created_at >= ?'; params.push(req.query.from); }
    if (req.query.to) { sql += ' AND a.created_at <= ?'; params.push(req.query.to + ' 23:59:59'); }
    if (req.query.search) { const s = `%${req.query.search}%`; sql += ' AND (c.first_name LIKE ? OR c.last_name LIKE ? OR c.email LIKE ? OR c.phone LIKE ?)'; params.push(s, s, s, s); }
    sql += ' ORDER BY a.created_at DESC LIMIT 1000';
    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) { console.error('GET /applications error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

// ── Source analytics ─────────────────────────────────────────────────────────
router.get('/stats/sources', authorize(...HR), async (req, res) => {
  try {
    const co = companyClause(req, 'company_id');
    const [rows] = await pool.query(
      `SELECT COALESCE(source,'Direct') AS source, COUNT(*) AS applications,
              SUM(status='Hired') AS hired
       FROM job_applications WHERE 1=1${co.clause} GROUP BY source ORDER BY applications DESC`, co.params);
    res.json(rows);
  } catch (err) { console.error('source stats error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

// ── Detail ───────────────────────────────────────────────────────────────────
router.get('/:id', authorize(...HR), async (req, res) => {
  try {
    const app = await getApp(req, req.params.id);
    if (!app) return res.status(404).json({ error: 'Application not found' });
    const [[candidate]] = await pool.query('SELECT * FROM candidates WHERE id = ?', [app.candidate_id]);
    const [[vacancy]] = await pool.query('SELECT id, title, work_location, employment_type, department_id FROM vacancies WHERE id = ?', [app.vacancy_id]);
    const [events] = await pool.query('SELECT * FROM application_events WHERE application_id = ? ORDER BY created_at DESC LIMIT 200', [app.id]);
    const [interviews] = await pool.query('SELECT * FROM interviews WHERE application_id = ? ORDER BY scheduled_at DESC', [app.id]);
    const [evaluations] = await pool.query(
      `SELECT e.*, u.name AS evaluator_name FROM candidate_evaluations e LEFT JOIN users u ON e.evaluator_id = u.id
       WHERE e.application_id = ? ORDER BY e.created_at DESC`, [app.id]);
    res.json({ ...app, candidate, vacancy, events, interviews, evaluations, pipeline_stages: PIPELINE_STAGES });
  } catch (err) { console.error('GET /applications/:id error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

// ── Stage move ───────────────────────────────────────────────────────────────
router.put('/:id/stage', authorize(...HR), validate({ stage: { required: true, type: 'string', enum: PIPELINE_STAGES } }), async (req, res) => {
  try {
    const app = await getApp(req, req.params.id);
    if (!app) return res.status(404).json({ error: 'Application not found' });
    const { stage, note } = req.body;
    let status = app.status;
    if (stage === 'Hired') status = 'Hired';
    else if (stage === 'Rejected' || stage === 'Offer Rejected') status = 'Rejected';
    else if (stage === 'Archived') status = 'Archived';
    else status = 'Open';
    await pool.query('UPDATE job_applications SET stage = ?, status = ? WHERE id = ?', [stage, status, app.id]);
    await logEvent(app, req.user, 'stage_change', note || `Moved to ${stage}`, app.stage, stage);
    await addAudit(pool, req.user, 'Recruitment', 'Stage Move', `Application #${app.id} → ${stage}`);

    // Offer-stage email
    if (['Offer Preparation', 'Offer Sent'].includes(stage)) {
      const [[c]] = await pool.query('SELECT first_name, last_name, email FROM candidates WHERE id = ?', [app.candidate_id]);
      const [[v]] = await pool.query('SELECT title FROM vacancies WHERE id = ?', [app.vacancy_id]);
      const [[comp]] = await pool.query('SELECT name FROM companies WHERE id = ?', [app.company_id]);
      if (c?.email) {
        const t = getTemplate('offer_stage', { name: `${c.first_name} ${c.last_name}`, position: v?.title, company: comp?.name });
        await sendEmail({ to: c.email, toName: `${c.first_name} ${c.last_name}`, subject: t.subject, html: t.html, companyId: app.company_id, templateType: 'offer_stage', relatedModule: 'Recruitment', relatedId: app.id });
      }
    }
    res.json({ success: true, stage, status });
  } catch (err) { console.error('stage move error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

router.put('/:id/rate', authorize(...HR), validate({ rating: { required: true, type: 'integer', min: 0, max: 5 } }), async (req, res) => {
  try {
    const app = await getApp(req, req.params.id);
    if (!app) return res.status(404).json({ error: 'Application not found' });
    await pool.query('UPDATE job_applications SET rating = ? WHERE id = ?', [req.body.rating, app.id]);
    await logEvent(app, req.user, 'rated', `Rated ${req.body.rating}/5`);
    res.json({ success: true });
  } catch (err) { console.error('rate error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

router.put('/:id/assign', authorize(...HR), async (req, res) => {
  try {
    const app = await getApp(req, req.params.id);
    if (!app) return res.status(404).json({ error: 'Application not found' });
    const assignee = req.body.assigned_to ? Number(req.body.assigned_to) : null;
    await pool.query('UPDATE job_applications SET assigned_to = ? WHERE id = ?', [assignee, app.id]);
    await logEvent(app, req.user, 'assigned', `Assigned to user #${assignee}`);
    if (assignee) await notify(pool, { userId: assignee, companyId: app.company_id, type: 'recruitment', title: 'Application assigned to you', link: '/applicants' });
    res.json({ success: true });
  } catch (err) { console.error('assign error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

router.post('/:id/shortlist', authorize(...HR), async (req, res) => {
  try {
    const app = await getApp(req, req.params.id);
    if (!app) return res.status(404).json({ error: 'Application not found' });
    await pool.query("UPDATE job_applications SET stage = 'Shortlisted', status = 'Open' WHERE id = ?", [app.id]);
    await logEvent(app, req.user, 'shortlisted', 'Candidate shortlisted', app.stage, 'Shortlisted');
    res.json({ success: true });
  } catch (err) { console.error('shortlist error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

router.post('/:id/reject', authorize(...HR), validate({ reason: { required: true, type: 'string', minLen: 1 } }), async (req, res) => {
  try {
    const app = await getApp(req, req.params.id);
    if (!app) return res.status(404).json({ error: 'Application not found' });
    await pool.query("UPDATE job_applications SET stage = 'Rejected', status = 'Rejected', rejection_reason = ? WHERE id = ?", [req.body.reason, app.id]);
    await logEvent(app, req.user, 'rejected', `Rejected: ${req.body.reason}`, app.stage, 'Rejected');
    await addAudit(pool, req.user, 'Recruitment', 'Rejected', `Application #${app.id} rejected`);
    if (req.body.send_email !== false) {
      const [[c]] = await pool.query('SELECT first_name, last_name, email FROM candidates WHERE id = ?', [app.candidate_id]);
      const [[v]] = await pool.query('SELECT title FROM vacancies WHERE id = ?', [app.vacancy_id]);
      const [[comp]] = await pool.query('SELECT name FROM companies WHERE id = ?', [app.company_id]);
      if (c?.email) {
        const t = getTemplate('candidate_rejected', { name: `${c.first_name} ${c.last_name}`, position: v?.title, company: comp?.name });
        await sendEmail({ to: c.email, toName: `${c.first_name} ${c.last_name}`, subject: t.subject, html: t.html, companyId: app.company_id, templateType: 'candidate_rejected', relatedModule: 'Recruitment', relatedId: app.id });
      }
    }
    res.json({ success: true });
  } catch (err) { console.error('reject error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

// ── Secure CV download ───────────────────────────────────────────────────────
router.get('/:id/cv', authorize(...HR), async (req, res) => {
  try {
    const app = await getApp(req, req.params.id);
    if (!app) return res.status(404).json({ error: 'Application not found' });
    const [[file]] = await pool.query('SELECT * FROM application_files WHERE id = ? AND company_id = ?', [app.cv_file_id || 0, app.company_id]);
    if (!file) return res.status(404).json({ error: 'No CV on file' });
    const fp = uploadPath('cv_applications', file.storage_key);
    if (!fs.existsSync(fp)) return res.status(404).json({ error: 'File missing on disk' });
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.download(fp, file.file_name);
  } catch (err) { console.error('cv download error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

// ── Interviews ───────────────────────────────────────────────────────────────
router.post('/:id/interviews', authorize(...HR), validate({ type: { type: 'string', enum: ['Phone', 'Online', 'In-person', 'Technical', 'Final'] } }), async (req, res) => {
  try {
    const app = await getApp(req, req.params.id);
    if (!app) return res.status(404).json({ error: 'Application not found' });
    const b = req.body;
    const [r] = await pool.query('INSERT INTO interviews SET ?', {
      company_id: app.company_id, application_id: app.id, type: b.type || 'Online',
      interviewers: b.interviewers || null, scheduled_at: b.scheduled_at || null,
      location: b.location || null, meeting_link: b.meeting_link || null, notes: b.notes || null, created_by: req.user.id,
    });
    await logEvent(app, req.user, 'interview_scheduled', `${b.type || 'Online'} interview scheduled${b.scheduled_at ? ` for ${b.scheduled_at}` : ''}`);
    await addAudit(pool, req.user, 'Recruitment', 'Interview Scheduled', `Application #${app.id}`);
    // Invitation email
    if (b.send_email !== false) {
      const [[c]] = await pool.query('SELECT first_name, last_name, email FROM candidates WHERE id = ?', [app.candidate_id]);
      const [[v]] = await pool.query('SELECT title FROM vacancies WHERE id = ?', [app.vacancy_id]);
      const [[comp]] = await pool.query('SELECT name FROM companies WHERE id = ?', [app.company_id]);
      if (c?.email) {
        const t = getTemplate('candidate_interview', { name: `${c.first_name} ${c.last_name}`, position: v?.title, company: comp?.name, date: b.scheduled_at || '', location: b.location || b.meeting_link || '', type: b.type || '', interviewer: b.interviewers || '' });
        await sendEmail({ to: c.email, toName: `${c.first_name} ${c.last_name}`, subject: t.subject, html: t.html, companyId: app.company_id, templateType: 'candidate_interview', relatedModule: 'Recruitment', relatedId: app.id });
      }
    }
    res.status(201).json({ id: r.insertId, success: true });
  } catch (err) { console.error('schedule interview error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

router.put('/interviews/:id', authorize(...HR), async (req, res) => {
  try {
    const co = companyClause(req, 'company_id');
    const [[iv]] = await pool.query('SELECT * FROM interviews WHERE id = ?' + co.clause, [req.params.id, ...co.params]);
    if (!iv) return res.status(404).json({ error: 'Interview not found' });
    const data = {};
    for (const f of ['status', 'notes', 'score', 'recommendation', 'scheduled_at', 'location', 'meeting_link', 'interviewers']) if (req.body[f] !== undefined) data[f] = req.body[f] === '' ? null : req.body[f];
    if (Object.keys(data).length) await pool.query('UPDATE interviews SET ? WHERE id = ?', [data, iv.id]);
    const [[app]] = await pool.query('SELECT id, company_id, stage FROM job_applications WHERE id = ?', [iv.application_id]);
    if (app) await logEvent(app, req.user, 'interview_updated', `Interview ${data.status || 'updated'}${data.recommendation ? ` — ${data.recommendation}` : ''}`);
    res.json({ success: true });
  } catch (err) { console.error('update interview error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

// ── Evaluation scorecard ─────────────────────────────────────────────────────
router.post('/:id/evaluations', authorize(...HR), async (req, res) => {
  try {
    const app = await getApp(req, req.params.id);
    if (!app) return res.status(404).json({ error: 'Application not found' });
    const b = req.body;
    const num = (v) => (v === '' || v == null ? null : Number(v));
    await pool.query('INSERT INTO candidate_evaluations SET ?', {
      company_id: app.company_id, application_id: app.id, evaluator_id: req.user.id,
      overall: num(b.overall), skills_match: num(b.skills_match), experience_match: num(b.experience_match),
      communication: num(b.communication), cultural_fit: num(b.cultural_fit), salary_fit: num(b.salary_fit),
      availability: num(b.availability), feedback: b.feedback || null, recommendation: b.recommendation || null,
    });
    await logEvent(app, req.user, 'evaluated', `Evaluation submitted${b.recommendation ? ` — ${b.recommendation}` : ''}`);
    res.status(201).json({ success: true });
  } catch (err) { console.error('evaluation error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

// ── Convert to onboarding (offer/onboarding handoff) ─────────────────────────
router.post('/:id/convert', authorize('admin', 'hr_manager'), async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const app = await getApp(req, req.params.id);
    if (!app) { conn.release(); return res.status(404).json({ error: 'Application not found' }); }
    if (app.onboarding_id) { conn.release(); return res.status(409).json({ error: 'Already linked to onboarding', onboarding_id: app.onboarding_id }); }

    const [[c]] = await pool.query('SELECT * FROM candidates WHERE id = ?', [app.candidate_id]);
    await conn.beginTransaction();
    // Create the onboarding record (candidate already vetted → start at HR_APPROVED)
    const [obr] = await conn.query('INSERT INTO onboarding_records SET ?', {
      company_id: app.company_id, candidate_id: app.candidate_id, vacancy_id: app.vacancy_id,
      stage: 'HR_APPROVED', status: 'In Progress', assigned_to: req.user.id, created_by: req.user.id,
    });
    const onboardingId = obr.insertId;

    // Seed the onboarding profile from the candidate + parsed CV
    let extracted = {};
    try { extracted = c?.ai_analysis ? (typeof c.ai_analysis === 'string' ? JSON.parse(c.ai_analysis) : c.ai_analysis) : {}; } catch { extracted = {}; }
    await conn.query('INSERT INTO onboarding_profiles SET ?', {
      onboarding_id: onboardingId, company_id: app.company_id,
      first_name: c?.first_name || null, last_name: c?.last_name || null, email: c?.email || null,
      phone: c?.phone || null, nationality: c?.nationality || null,
      current_job_title: app.current_job_title || extracted.current_job_title || null,
      education: extracted.education ? JSON.stringify(extracted.education) : null,
      work_experience: extracted.work_history ? JSON.stringify(extracted.work_history) : null,
      skills: extracted.skills ? JSON.stringify(extracted.skills) : null,
      languages: extracted.languages ? JSON.stringify(extracted.languages) : null,
      extracted_data: c?.ai_analysis ? (typeof c.ai_analysis === 'string' ? c.ai_analysis : JSON.stringify(c.ai_analysis)) : null,
      profile_verified: 1, profile_completeness: 70,
    });

    // Link the CV file into onboarding_files (same stored file)
    if (app.cv_file_id) {
      const [[f]] = await conn.query('SELECT * FROM application_files WHERE id = ?', [app.cv_file_id]);
      if (f) {
        const [of] = await conn.query('INSERT INTO onboarding_files SET ?', {
          onboarding_id: onboardingId, company_id: app.company_id, kind: 'cv',
          file_name: f.file_name, file_type: f.file_type, file_size: f.file_size, storage_key: f.storage_key, uploaded_by: req.user.id,
        });
        await conn.query('UPDATE onboarding_profiles SET cv_file_id = ? WHERE onboarding_id = ?', [of.insertId, onboardingId]);
      }
    }

    await conn.query("UPDATE job_applications SET onboarding_id = ?, stage = 'Hired', status = 'Hired' WHERE id = ?", [onboardingId, app.id]);
    await conn.commit();

    await logEvent(app, req.user, 'converted', `Moved to onboarding (#${onboardingId})`, app.stage, 'Hired');
    await addAudit(pool, req.user, 'Recruitment', 'Converted to Onboarding', `Application #${app.id} → onboarding #${onboardingId}`);
    res.status(201).json({ success: true, onboarding_id: onboardingId });
  } catch (err) {
    await conn.rollback();
    console.error('convert error:', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally { conn.release(); }
});

export default router;
