import { Router } from 'express';
import crypto from 'crypto';
import pool from '../config/db.js';
import { auth } from '../middleware/auth.js';
import { authorize } from '../middleware/rbac.js';
import { requireModule, MODULES } from '../config/permissions.js';
import { addAudit } from '../services/auditService.js';
import { tenantScope, companyClause, resolveWriteCompanyId } from '../middleware/tenant.js';
import { validate } from '../middleware/validate.js';
import { evaluateAnswer } from '../services/deepseekService.js';
import { scoreStage, stagePassed, anyFlaggedForReview, finalStatus } from '../services/assessmentService.js';

const router = Router();
// Template lock state, session status, and scores change from other tabs/users
// constantly — a browser (or intermediate proxy) serving a stale cached GET
// here means editing against a lock check that's already wrong. Never cache.
router.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
router.use(auth, tenantScope, requireModule(MODULES.RECRUITMENT));

const HR = ['admin', 'hr_manager', 'recruiter'];
const QUESTION_TYPES = ['multiple_choice', 'short_answer', 'open_ended', 'scenario'];
const DEFAULT_STAGE_NAMES = ['Stage 1', 'Stage 2', 'Stage 3'];

function parseJSON(v, fallback) { try { return typeof v === 'string' ? JSON.parse(v) : (v ?? fallback); } catch { return fallback; } }

async function getTemplate(req, id) {
  const co = companyClause(req, 'company_id');
  const [[t]] = await pool.query('SELECT * FROM assessment_templates WHERE id = ?' + co.clause, [id, ...co.params]);
  return t || null;
}

async function getCurrentVersion(templateId) {
  const [[v]] = await pool.query(
    'SELECT * FROM assessment_template_versions WHERE template_id = ? AND is_current = TRUE LIMIT 1', [templateId]);
  return v || null;
}

// A version becomes immutable the moment any applicant has started an
// assessment against it — editing it after that would silently change what a
// completed/in-progress session is being scored against. Callers must publish
// a new version instead (POST /templates/:id/versions).
async function assertVersionMutable(res, versionId) {
  const [[{ c }]] = await pool.query('SELECT COUNT(*) c FROM assessment_sessions WHERE template_version_id = ?', [versionId]);
  if (c > 0) {
    res.status(409).json({ error: 'This template version already has assessment sessions and can no longer be edited. Publish a new version to make changes.' });
    return false;
  }
  return true;
}

async function loadVersionTree(versionId) {
  const [stages] = await pool.query('SELECT * FROM assessment_stages WHERE template_version_id = ? ORDER BY stage_order', [versionId]);
  const stageIds = stages.map((s) => s.id);
  let questions = [];
  if (stageIds.length) {
    [questions] = await pool.query(
      `SELECT * FROM assessment_questions WHERE stage_id IN (${stageIds.map(() => '?').join(',')}) ORDER BY stage_id, question_order`, stageIds);
  }
  return stages.map((s) => ({
    ...s,
    questions: questions.filter((q) => q.stage_id === s.id).map((q) => ({ ...q, options: parseJSON(q.options, null) })),
  }));
}

// ── Templates ────────────────────────────────────────────────────────────────
router.get('/templates', authorize(...HR), async (req, res) => {
  try {
    const co = companyClause(req, 't.company_id');
    let sql = `SELECT t.*, v.id AS current_version_id, v.version_no AS current_version_no,
                 vc.title AS vacancy_title
               FROM assessment_templates t
               LEFT JOIN assessment_template_versions v ON v.template_id = t.id AND v.is_current = TRUE
               LEFT JOIN vacancies vc ON vc.id = t.vacancy_id
               WHERE 1=1` + co.clause;
    const params = [...co.params];
    if (req.query.vacancy_id) { sql += ' AND t.vacancy_id = ?'; params.push(req.query.vacancy_id); }
    if (req.query.status) { sql += ' AND t.status = ?'; params.push(req.query.status); }
    sql += ' ORDER BY t.created_at DESC';
    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) { console.error('GET /assessments/templates error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

router.post('/templates', authorize(...HR), validate({ name: { required: true, type: 'string', minLen: 1, maxLen: 200 } }), async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const b = req.body;
    const companyId = resolveWriteCompanyId(req, b.company_id);
    await conn.beginTransaction();
    const [tplRes] = await conn.query('INSERT INTO assessment_templates SET ?', {
      company_id: companyId, name: b.name, position_title: b.position_title || null,
      vacancy_id: b.vacancy_id || null, status: 'Draft', created_by: req.user.id,
    });
    const templateId = tplRes.insertId;
    const [verRes] = await conn.query('INSERT INTO assessment_template_versions SET ?', {
      template_id: templateId, version_no: 1, is_current: true, created_by: req.user.id,
    });
    const versionId = verRes.insertId;
    for (let i = 0; i < DEFAULT_STAGE_NAMES.length; i++) {
      await conn.query('INSERT INTO assessment_stages SET ?', {
        template_version_id: versionId, stage_order: i + 1, name: DEFAULT_STAGE_NAMES[i],
        duration_minutes: 20, max_score: 100, passing_score: 60,
      });
    }
    await conn.commit();
    await addAudit(pool, req.user, 'Recruitment', 'Assessment Template Created', `Template "${b.name}" (#${templateId})`, companyId);
    res.status(201).json({ id: templateId, version_id: versionId, success: true });
  } catch (err) { await conn.rollback(); console.error('POST /assessments/templates error:', err); res.status(500).json({ error: 'Internal server error' }); }
  finally { conn.release(); }
});

router.get('/templates/:id', authorize(...HR), async (req, res) => {
  try {
    const t = await getTemplate(req, req.params.id);
    if (!t) return res.status(404).json({ error: 'Template not found' });
    const [versions] = await pool.query('SELECT * FROM assessment_template_versions WHERE template_id = ? ORDER BY version_no DESC', [t.id]);
    const versionId = req.query.version_id ? Number(req.query.version_id) : (versions.find((v) => v.is_current)?.id);
    const version = versions.find((v) => v.id === versionId) || null;
    const stages = version ? await loadVersionTree(version.id) : [];
    let locked = false;
    if (version) {
      const [[{ c }]] = await pool.query('SELECT COUNT(*) c FROM assessment_sessions WHERE template_version_id = ?', [version.id]);
      locked = c > 0;
    }
    res.json({ ...t, versions, version, stages, locked });
  } catch (err) { console.error('GET /assessments/templates/:id error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

router.put('/templates/:id', authorize(...HR), validate({ status: { type: 'string', enum: ['Draft', 'Active', 'Archived'] } }), async (req, res) => {
  try {
    const t = await getTemplate(req, req.params.id);
    if (!t) return res.status(404).json({ error: 'Template not found' });
    const data = {};
    for (const f of ['name', 'position_title', 'vacancy_id', 'status']) if (req.body[f] !== undefined) data[f] = req.body[f] === '' ? null : req.body[f];
    if (Object.keys(data).length) await pool.query('UPDATE assessment_templates SET ? WHERE id = ?', [data, t.id]);
    res.json({ success: true });
  } catch (err) { console.error('PUT /assessments/templates/:id error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

router.delete('/templates/:id', authorize('admin'), async (req, res) => {
  try {
    const t = await getTemplate(req, req.params.id);
    if (!t) return res.status(404).json({ error: 'Template not found' });
    const [[{ c }]] = await pool.query(
      `SELECT COUNT(*) c FROM assessment_sessions s
       JOIN assessment_template_versions v ON v.id = s.template_version_id
       WHERE v.template_id = ?`, [t.id]);
    if (c > 0) return res.status(409).json({ error: 'This template has assessment sessions on record and cannot be deleted. Archive it instead.' });
    await pool.query('DELETE FROM assessment_templates WHERE id = ?', [t.id]);
    await addAudit(pool, req.user, 'Recruitment', 'Assessment Template Deleted', `Template #${t.id}`, t.company_id);
    res.json({ success: true });
  } catch (err) { console.error('DELETE /assessments/templates/:id error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

// ── Versions ─────────────────────────────────────────────────────────────────
// Publishes a new version by cloning the current version's stages/questions,
// so an in-flight or completed session stays pinned to what the applicant
// actually saw (assessment_sessions.template_version_id never changes).
router.post('/templates/:id/versions', authorize(...HR), async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const t = await getTemplate(req, req.params.id);
    if (!t) { conn.release(); return res.status(404).json({ error: 'Template not found' }); }
    const current = await getCurrentVersion(t.id);
    if (!current) { conn.release(); return res.status(409).json({ error: 'Template has no current version to clone' }); }
    const stages = await loadVersionTree(current.id);

    await conn.beginTransaction();
    const [[{ maxNo }]] = await conn.query('SELECT MAX(version_no) AS maxNo FROM assessment_template_versions WHERE template_id = ?', [t.id]);
    const nextNo = (maxNo || 0) + 1;
    await conn.query('UPDATE assessment_template_versions SET is_current = FALSE WHERE template_id = ?', [t.id]);
    const [verRes] = await conn.query('INSERT INTO assessment_template_versions SET ?', {
      template_id: t.id, version_no: nextNo, is_current: true,
      change_note: req.body.change_note || null, created_by: req.user.id,
    });
    const newVersionId = verRes.insertId;

    for (const stage of stages) {
      const [stageRes] = await conn.query('INSERT INTO assessment_stages SET ?', {
        template_version_id: newVersionId, stage_order: stage.stage_order, name: stage.name,
        duration_minutes: stage.duration_minutes, max_score: stage.max_score, passing_score: stage.passing_score,
      });
      const newStageId = stageRes.insertId;
      const idMap = new Map(); // old question id -> new question id, for the consistency-pair FK
      for (const q of stage.questions) {
        const [qRes] = await conn.query('INSERT INTO assessment_questions SET ?', {
          stage_id: newStageId, question_order: q.question_order, type: q.type, question_text: q.question_text,
          options: q.options ? JSON.stringify(q.options) : null, correct_option_key: q.correct_option_key,
          expected_answer: q.expected_answer, ai_eval_instructions: q.ai_eval_instructions, weight: q.weight,
        });
        idMap.set(q.id, qRes.insertId);
      }
      // Re-point consistency pairs once every question in this stage has a new id.
      for (const q of stage.questions) {
        if (q.consistency_pair_question_id && idMap.has(q.consistency_pair_question_id)) {
          await conn.query('UPDATE assessment_questions SET consistency_pair_question_id = ? WHERE id = ?',
            [idMap.get(q.consistency_pair_question_id), idMap.get(q.id)]);
        }
      }
    }
    await conn.commit();
    await addAudit(pool, req.user, 'Recruitment', 'Assessment Template Version Published', `Template #${t.id} → v${nextNo}`, t.company_id);
    res.status(201).json({ version_id: newVersionId, version_no: nextNo, success: true });
  } catch (err) { await conn.rollback(); console.error('POST /assessments/templates/:id/versions error:', err); res.status(500).json({ error: 'Internal server error' }); }
  finally { conn.release(); }
});

// Which applicants are attached to this exact version, and how far they got —
// what a locked (has-live-sessions) version actually means in practice, so HR
// can tell "everyone finished, safe to ignore" from "someone is still mid-stage."
router.get('/versions/:id/sessions', authorize(...HR), async (req, res) => {
  try {
    const [[version]] = await pool.query('SELECT * FROM assessment_template_versions WHERE id = ?', [req.params.id]);
    if (!version) return res.status(404).json({ error: 'Version not found' });
    const t = await getTemplate(req, version.template_id);
    if (!t) return res.status(404).json({ error: 'Version not found' });
    const [rows] = await pool.query(
      `SELECT s.id, s.application_id, s.status, s.final_status, s.current_stage, s.overall_score, s.created_at,
              c.first_name, c.last_name
       FROM assessment_sessions s
       JOIN job_applications a ON a.id = s.application_id
       JOIN candidates c ON c.id = a.candidate_id
       WHERE s.template_version_id = ? ORDER BY s.created_at DESC`, [version.id]);
    res.json(rows);
  } catch (err) { console.error('GET /assessments/versions/:id/sessions error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

// ── Stages ───────────────────────────────────────────────────────────────────
router.put('/stages/:stageId', authorize(...HR), async (req, res) => {
  try {
    const [[stage]] = await pool.query(
      `SELECT s.*, v.template_id FROM assessment_stages s
       JOIN assessment_template_versions v ON v.id = s.template_version_id WHERE s.id = ?`, [req.params.stageId]);
    if (!stage) return res.status(404).json({ error: 'Stage not found' });
    const t = await getTemplate(req, stage.template_id);
    if (!t) return res.status(404).json({ error: 'Stage not found' });
    if (!(await assertVersionMutable(res, stage.template_version_id))) return;
    const data = {};
    for (const f of ['name', 'duration_minutes', 'max_score', 'passing_score']) if (req.body[f] !== undefined) data[f] = req.body[f];
    if (Object.keys(data).length) await pool.query('UPDATE assessment_stages SET ? WHERE id = ?', [data, stage.id]);
    res.json({ success: true });
  } catch (err) { console.error('PUT /assessments/stages/:id error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

// ── Questions ────────────────────────────────────────────────────────────────
router.post('/stages/:stageId/questions',
  authorize(...HR),
  validate({ type: { required: true, type: 'string', enum: QUESTION_TYPES }, question_text: { required: true, type: 'string', minLen: 1 }, weight: { required: true, type: 'integer', min: 1, max: 100 } }),
  async (req, res) => {
    try {
      const [[stage]] = await pool.query(
        `SELECT s.*, v.template_id FROM assessment_stages s
         JOIN assessment_template_versions v ON v.id = s.template_version_id WHERE s.id = ?`, [req.params.stageId]);
      if (!stage) return res.status(404).json({ error: 'Stage not found' });
      const t = await getTemplate(req, stage.template_id);
      if (!t) return res.status(404).json({ error: 'Stage not found' });
      if (!(await assertVersionMutable(res, stage.template_version_id))) return;

      const b = req.body;
      const [[{ maxOrder }]] = await pool.query('SELECT MAX(question_order) AS maxOrder FROM assessment_questions WHERE stage_id = ?', [stage.id]);
      const [qRes] = await pool.query('INSERT INTO assessment_questions SET ?', {
        stage_id: stage.id, question_order: (maxOrder || 0) + 1, type: b.type, question_text: b.question_text,
        options: b.options ? JSON.stringify(b.options) : null, correct_option_key: b.correct_option_key || null,
        expected_answer: b.expected_answer || null, ai_eval_instructions: b.ai_eval_instructions || null,
        weight: b.weight, consistency_pair_question_id: b.consistency_pair_question_id || null,
      });
      res.status(201).json({ id: qRes.insertId, success: true });
    } catch (err) { console.error('POST /assessments/stages/:id/questions error:', err); res.status(500).json({ error: 'Internal server error' }); }
  });

router.put('/questions/:id', authorize(...HR), async (req, res) => {
  try {
    const [[q]] = await pool.query(
      `SELECT q.*, s.template_version_id, v.template_id FROM assessment_questions q
       JOIN assessment_stages s ON s.id = q.stage_id
       JOIN assessment_template_versions v ON v.id = s.template_version_id WHERE q.id = ?`, [req.params.id]);
    if (!q) return res.status(404).json({ error: 'Question not found' });
    const t = await getTemplate(req, q.template_id);
    if (!t) return res.status(404).json({ error: 'Question not found' });
    if (!(await assertVersionMutable(res, q.template_version_id))) return;

    const data = {};
    for (const f of ['type', 'question_text', 'correct_option_key', 'expected_answer', 'ai_eval_instructions', 'weight', 'consistency_pair_question_id']) {
      if (req.body[f] !== undefined) data[f] = req.body[f] === '' ? null : req.body[f];
    }
    if (req.body.options !== undefined) data.options = req.body.options ? JSON.stringify(req.body.options) : null;
    if (Object.keys(data).length) await pool.query('UPDATE assessment_questions SET ? WHERE id = ?', [data, q.id]);
    res.json({ success: true });
  } catch (err) { console.error('PUT /assessments/questions/:id error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

router.delete('/questions/:id', authorize('admin'), async (req, res) => {
  try {
    const [[q]] = await pool.query(
      `SELECT q.*, s.template_version_id, v.template_id FROM assessment_questions q
       JOIN assessment_stages s ON s.id = q.stage_id
       JOIN assessment_template_versions v ON v.id = s.template_version_id WHERE q.id = ?`, [req.params.id]);
    if (!q) return res.status(404).json({ error: 'Question not found' });
    const t = await getTemplate(req, q.template_id);
    if (!t) return res.status(404).json({ error: 'Question not found' });
    if (!(await assertVersionMutable(res, q.template_version_id))) return;
    await pool.query('DELETE FROM assessment_questions WHERE id = ?', [q.id]);
    res.json({ success: true });
  } catch (err) { console.error('DELETE /assessments/questions/:id error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

// ── Sessions ─────────────────────────────────────────────────────────────────
async function logSessionEvent(sessionId, companyId, user, eventType, detail) {
  try {
    await pool.query('INSERT INTO assessment_session_events SET ?', {
      company_id: companyId, session_id: sessionId, user_id: user?.id || null,
      user_name: user?.name || 'System', event_type: eventType, detail,
    });
  } catch (e) { console.error('assessment session event error:', e.message); }
}

// For the applicant-timeline entries HR reads on the Applicant Detail page, and
// the global audit log — distinct from assessment_session_events, which is
// too fine-grained (autosaves, per-question AI calls) for either of those.
async function logToApplicantTimeline(session, user, eventType, action, detail) {
  await pool.query('INSERT INTO application_events SET ?', {
    company_id: session.company_id, application_id: session.application_id,
    user_id: user?.id || null, user_name: user?.name || 'System', event_type: eventType, detail,
  });
  await addAudit(pool, user, 'Recruitment', action, detail, session.company_id);
}

async function getApplication(req, appId) {
  const co = companyClause(req, 'company_id');
  const [[a]] = await pool.query('SELECT * FROM job_applications WHERE id = ?' + co.clause, [appId, ...co.params]);
  return a || null;
}

router.post('/applications/:appId/sessions', authorize(...HR), async (req, res) => {
  try {
    const app = await getApplication(req, req.params.appId);
    if (!app) return res.status(404).json({ error: 'Application not found' });

    const [[{ c: interviewCount }]] = await pool.query('SELECT COUNT(*) c FROM interviews WHERE application_id = ?', [app.id]);
    if (interviewCount === 0) {
      return res.status(409).json({ error: 'Schedule an interview for this applicant before sending an assessment.' });
    }
    const [[{ c: activeCount }]] = await pool.query(
      "SELECT COUNT(*) c FROM assessment_sessions WHERE application_id = ? AND status IN ('Pending','InProgress','Paused')", [app.id]);
    if (activeCount > 0) {
      return res.status(409).json({ error: 'This applicant already has an active assessment session. Stop it before sending a new one.' });
    }

    const [[tpl]] = await pool.query(
      "SELECT * FROM assessment_templates WHERE vacancy_id = ? AND company_id = ? AND status = 'Active' LIMIT 1",
      [app.vacancy_id, app.company_id]);
    if (!tpl) return res.status(404).json({ error: 'No active assessment template for this vacancy. Create one from the Vacancy page first.' });
    const version = await getCurrentVersion(tpl.id);
    if (!version) return res.status(409).json({ error: 'This template has no current version' });

    const token = crypto.randomBytes(32).toString('hex');
    const [sessRes] = await pool.query('INSERT INTO assessment_sessions SET ?', {
      company_id: app.company_id, application_id: app.id, template_version_id: version.id,
      token, status: 'Pending', current_stage: 1, created_by: req.user.id,
    });
    const sessionId = sessRes.insertId;
    await logSessionEvent(sessionId, app.company_id, req.user, 'created', `Assessment session created from template "${tpl.name}" v${version.version_no}`);
    await pool.query('INSERT INTO application_events SET ?', {
      company_id: app.company_id, application_id: app.id, user_id: req.user.id, user_name: req.user.name,
      event_type: 'assessment_sent', detail: `Assessment "${tpl.name}" sent to candidate`,
    });
    await addAudit(pool, req.user, 'Recruitment', 'Assessment Sent', `Application #${app.id} — template "${tpl.name}"`, app.company_id);

    res.status(201).json({ session_id: sessionId, token, path: `/assessment/${token}`, success: true });
  } catch (err) { console.error('POST /assessments/applications/:id/sessions error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

router.get('/applications/:appId/sessions', authorize(...HR), async (req, res) => {
  try {
    const app = await getApplication(req, req.params.appId);
    if (!app) return res.status(404).json({ error: 'Application not found' });
    const [rows] = await pool.query(
      `SELECT s.*, t.name AS template_name, tv.version_no
       FROM assessment_sessions s
       JOIN assessment_template_versions tv ON tv.id = s.template_version_id
       JOIN assessment_templates t ON t.id = tv.template_id
       WHERE s.application_id = ? ORDER BY s.created_at DESC`, [app.id]);
    res.json(rows);
  } catch (err) { console.error('GET /assessments/applications/:id/sessions error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

router.get('/sessions/:id', authorize(...HR), async (req, res) => {
  try {
    const co = companyClause(req, 's.company_id');
    const [[session]] = await pool.query(
      `SELECT s.*, t.name AS template_name, tv.version_no
       FROM assessment_sessions s
       JOIN assessment_template_versions tv ON tv.id = s.template_version_id
       JOIN assessment_templates t ON t.id = tv.template_id
       WHERE s.id = ?` + co.clause, [req.params.id, ...co.params]);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    const stages = await loadVersionTree(session.template_version_id);
    const [answers] = await pool.query('SELECT * FROM assessment_answers WHERE session_id = ?', [session.id]);
    const [events] = await pool.query('SELECT * FROM assessment_session_events WHERE session_id = ? ORDER BY created_at DESC', [session.id]);
    res.json({ ...session, stages, answers, events });
  } catch (err) { console.error('GET /assessments/sessions/:id error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

// ── Final applicant report ───────────────────────────────────────────────────
router.get('/sessions/:id/report', authorize(...HR), async (req, res) => {
  try {
    const co = companyClause(req, 's.company_id');
    const [[session]] = await pool.query(
      `SELECT s.*, t.name AS template_name, t.position_title, tv.version_no,
              c.first_name, c.last_name, v.title AS vacancy_title
       FROM assessment_sessions s
       JOIN assessment_template_versions tv ON tv.id = s.template_version_id
       JOIN assessment_templates t ON t.id = tv.template_id
       JOIN job_applications a ON a.id = s.application_id
       JOIN candidates c ON c.id = a.candidate_id
       JOIN vacancies v ON v.id = a.vacancy_id
       WHERE s.id = ?` + co.clause, [req.params.id, ...co.params]);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    const stages = await loadVersionTree(session.template_version_id);
    const [answers] = await pool.query('SELECT * FROM assessment_answers WHERE session_id = ?', [session.id]);
    const answerByQuestion = new Map(answers.map((a) => [a.question_id, a]));

    const stageColumns = { 1: session.stage1_score, 2: session.stage2_score, 3: session.stage3_score };
    const report = {
      applicant_name: `${session.first_name} ${session.last_name}`,
      position_title: session.position_title || session.vacancy_title,
      template_name: session.template_name,
      template_version: session.version_no,
      status: session.status,
      final_status: session.final_status,
      started_at: session.started_at,
      completed_at: session.completed_at,
      overall_score: session.overall_score,
      consistency_flag: !!session.consistency_flag,
      consistency_note: session.consistency_note,
      stages: stages.map((s) => ({
        name: s.name,
        score: stageColumns[s.stage_order],
        max_score: s.max_score,
        passing_score: s.passing_score,
        questions: s.questions.map((q) => {
          const a = answerByQuestion.get(q.id);
          const answerDisplay = q.type === 'multiple_choice'
            ? (q.options || []).find((o) => o.key === a?.selected_option_key)?.text || a?.selected_option_key || null
            : a?.answer_text || null;
          return {
            question_text: q.question_text, type: q.type, answer: answerDisplay,
            score: a?.hr_override_score ?? a?.ai_score ?? null, weight: q.weight,
            ai_evaluation: a?.ai_evaluation || null, hr_note: a?.hr_note || null,
            manually_adjusted: a?.hr_override_score != null,
          };
        }),
      })),
    };
    res.json(report);
  } catch (err) { console.error('GET /assessments/sessions/:id/report error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

async function getSessionForHR(req, id) {
  const co = companyClause(req, 'company_id');
  const [[session]] = await pool.query('SELECT * FROM assessment_sessions WHERE id = ?' + co.clause, [id, ...co.params]);
  return session || null;
}

// ── Pause / resume / stop ────────────────────────────────────────────────────
router.put('/sessions/:id/pause', authorize(...HR), async (req, res) => {
  try {
    const session = await getSessionForHR(req, req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    if (session.status !== 'InProgress') return res.status(409).json({ error: 'Only an in-progress assessment can be paused.' });
    await pool.query("UPDATE assessment_sessions SET status = 'Paused', paused_at = NOW() WHERE id = ?", [session.id]);
    await logSessionEvent(session.id, session.company_id, req.user, 'paused', 'Paused by HR');
    await addAudit(pool, req.user, 'Recruitment', 'Assessment Paused', `Session #${session.id}`, session.company_id);
    res.json({ success: true });
  } catch (err) { console.error('PUT /assessments/sessions/:id/pause error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

router.put('/sessions/:id/resume', authorize(...HR), async (req, res) => {
  try {
    const session = await getSessionForHR(req, req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    if (session.status !== 'Paused') return res.status(409).json({ error: 'Only a paused assessment can be resumed.' });
    // Restore the stage timer with whatever time remained when it was paused.
    const remainingMs = Math.max(0, new Date(session.stage_deadline_at).getTime() - new Date(session.paused_at).getTime());
    const deadline = new Date(Date.now() + remainingMs);
    await pool.query("UPDATE assessment_sessions SET status = 'InProgress', stage_deadline_at = ?, paused_at = NULL WHERE id = ?", [deadline, session.id]);
    await logSessionEvent(session.id, session.company_id, req.user, 'resumed', 'Resumed by HR');
    await addAudit(pool, req.user, 'Recruitment', 'Assessment Resumed', `Session #${session.id}`, session.company_id);
    res.json({ success: true });
  } catch (err) { console.error('PUT /assessments/sessions/:id/resume error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

router.put('/sessions/:id/stop', authorize(...HR), async (req, res) => {
  try {
    const session = await getSessionForHR(req, req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    if (['Completed', 'Stopped'].includes(session.status)) return res.status(409).json({ error: 'This assessment has already ended.' });
    await pool.query(
      "UPDATE assessment_sessions SET status = 'Stopped', completed_at = NOW(), stopped_reason = ?, final_status = COALESCE(final_status, 'HR Review Required') WHERE id = ?",
      [req.body.reason || null, session.id]);
    await logSessionEvent(session.id, session.company_id, req.user, 'stopped', req.body.reason || 'Stopped by HR');
    await logToApplicantTimeline(session, req.user, 'assessment_stopped', 'Assessment Stopped', req.body.reason || `Assessment session #${session.id} stopped by HR`);
    res.json({ success: true });
  } catch (err) { console.error('PUT /assessments/sessions/:id/stop error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

// ── Manual review: re-evaluate / override an individual answer ─────────────
router.post('/answers/:id/reevaluate', authorize(...HR), async (req, res) => {
  try {
    const co = companyClause(req, 'a.company_id');
    const [[answer]] = await pool.query(
      `SELECT a.*, q.question_text, q.expected_answer, q.ai_eval_instructions, q.weight, q.type, q.correct_option_key
       FROM assessment_answers a JOIN assessment_questions q ON q.id = a.question_id WHERE a.id = ?` + co.clause,
      [req.params.id, ...co.params]);
    if (!answer) return res.status(404).json({ error: 'Answer not found' });
    if (answer.type === 'multiple_choice') return res.status(400).json({ error: 'Multiple-choice answers are scored automatically and cannot be re-evaluated by AI.' });

    const result = await evaluateAnswer(answer.question_text, answer.expected_answer, answer.ai_eval_instructions, answer.answer_text, answer.weight);
    await pool.query(
      'UPDATE assessment_answers SET ai_score = ?, ai_confidence = ?, ai_evaluation = ?, ai_flagged_review = ? WHERE id = ?',
      [result.score, result.confidence, result.evaluation, result.flagged_review ? 1 : 0, answer.id]);
    res.json({ success: true, ...result });
  } catch (err) { console.error('POST /assessments/answers/:id/reevaluate error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

router.put('/answers/:id/override', authorize(...HR), validate({ hr_override_score: { type: 'number', min: 0 } }), async (req, res) => {
  try {
    const co = companyClause(req, 'a.company_id');
    const [[answer]] = await pool.query(
      `SELECT a.*, q.weight, q.stage_id FROM assessment_answers a JOIN assessment_questions q ON q.id = a.question_id WHERE a.id = ?` + co.clause,
      [req.params.id, ...co.params]);
    if (!answer) return res.status(404).json({ error: 'Answer not found' });
    const score = req.body.hr_override_score === '' || req.body.hr_override_score == null ? null : Math.max(0, Math.min(answer.weight, Number(req.body.hr_override_score)));
    await pool.query('UPDATE assessment_answers SET hr_override_score = ?, hr_note = ?, reviewed_by = ?, reviewed_at = NOW() WHERE id = ?',
      [score, req.body.hr_note || null, req.user.id, answer.id]);

    // An override must show up in the stage/overall totals immediately — HR
    // reviews a Completed/Failed session too, not only ones held for advance.
    const [[stageRow]] = await pool.query('SELECT * FROM assessment_stages WHERE id = ?', [answer.stage_id]);
    const [stageQuestions] = await pool.query('SELECT * FROM assessment_questions WHERE stage_id = ?', [answer.stage_id]);
    const [stageAnswers] = await pool.query('SELECT * FROM assessment_answers WHERE session_id = ? AND question_id IN (?)',
      [answer.session_id, stageQuestions.map((q) => q.id)]);
    const newStageScore = scoreStage(stageQuestions, new Map(stageAnswers.map((a) => [a.question_id, a])));
    const scoreColumn = { 1: 'stage1_score', 2: 'stage2_score', 3: 'stage3_score' }[stageRow.stage_order];
    await pool.query(`UPDATE assessment_sessions SET ${scoreColumn} = ? WHERE id = ?`, [newStageScore, answer.session_id]);
    const [[{ total }]] = await pool.query(
      `SELECT COALESCE(stage1_score,0) + COALESCE(stage2_score,0) + COALESCE(stage3_score,0) AS total FROM assessment_sessions WHERE id = ?`,
      [answer.session_id]);
    await pool.query('UPDATE assessment_sessions SET overall_score = ? WHERE id = ?', [total, answer.session_id]);

    await logSessionEvent(answer.session_id, answer.company_id, req.user, 'hr_reviewed', `Answer #${answer.id} score set to ${score ?? '(cleared)'}`);
    await addAudit(pool, req.user, 'Recruitment', 'Assessment Answer Reviewed', `Answer #${answer.id} score set to ${score ?? '(cleared)'}`, answer.company_id);
    res.json({ success: true, stage_score: newStageScore, overall_score: total });
  } catch (err) { console.error('PUT /assessments/answers/:id/override error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

// ── Move the applicant forward after manual review ──────────────────────────
// Re-runs the same score/pass/finalize logic the public flow uses, now that HR
// has filled in overrides for whatever the AI could not confidently score.
router.post('/sessions/:id/advance', authorize(...HR), async (req, res) => {
  try {
    const session = await getSessionForHR(req, req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    // A Failed outcome is not necessarily final: the AI can score confidently
    // and still be wrong, and once HR overrides an answer's score the stage
    // may now clear the passing threshold. Re-run the same pass check either
    // way — Failed or HR Review Required — so the applicant can be moved on.
    const reviewable = ['Completed', 'Stopped'].includes(session.status) && ['Failed', 'HR Review Required'].includes(session.final_status);
    if (!reviewable) {
      return res.status(409).json({ error: 'Only a Failed or HR Review Required session can be reopened.' });
    }
    const stages = await loadVersionTree(session.template_version_id);
    const stage = stages.find((s) => s.stage_order === session.current_stage);
    const [answers] = await pool.query('SELECT * FROM assessment_answers WHERE session_id = ? AND question_id IN (?)',
      [session.id, stage.questions.map((q) => q.id)]);
    const stageScore = scoreStage(stage.questions, new Map(answers.map((a) => [a.question_id, a])));
    const passed = stagePassed(stageScore, stage.passing_score);
    const nextStage = stages.find((s) => s.stage_order === stage.stage_order + 1);
    const isLastStage = !nextStage;
    const scoreColumn = { 1: 'stage1_score', 2: 'stage2_score', 3: 'stage3_score' }[stage.stage_order];

    if (passed && !isLastStage) {
      const deadline = new Date(Date.now() + nextStage.duration_minutes * 60_000);
      await pool.query(
        `UPDATE assessment_sessions SET ${scoreColumn} = ?, current_stage = ?, status = 'InProgress', stage_started_at = NOW(),
         stage_deadline_at = ?, completed_at = NULL, final_status = NULL WHERE id = ?`,
        [stageScore, nextStage.stage_order, deadline, session.id]);
      await logSessionEvent(session.id, session.company_id, req.user, 'advanced', `HR advanced applicant to stage ${nextStage.stage_order}`);
      await logToApplicantTimeline(session, req.user, 'assessment_advanced', 'Assessment Advanced', `HR advanced applicant to assessment stage ${nextStage.stage_order} after review`);
      return res.json({ success: true, resumed: true, next_stage: nextStage.stage_order });
    }

    let flaggedOverall = anyFlaggedForReview(answers);
    if (passed && isLastStage) {
      const [allAnswers] = await pool.query(
        `SELECT a.* FROM assessment_answers a JOIN assessment_questions q ON q.id = a.question_id
         JOIN assessment_stages s ON s.id = q.stage_id WHERE s.template_version_id = ? AND a.session_id = ?`,
        [session.template_version_id, session.id]);
      flaggedOverall = anyFlaggedForReview(allAnswers);
    }
    const terminal = finalStatus({ passed, isLastStage, flagged: flaggedOverall });
    const [[{ priorTotal }]] = await pool.query(
      `SELECT COALESCE(stage1_score,0) + COALESCE(stage2_score,0) + COALESCE(stage3_score,0) - COALESCE(${scoreColumn},0) AS priorTotal FROM assessment_sessions WHERE id = ?`,
      [session.id]);
    await pool.query(
      `UPDATE assessment_sessions SET ${scoreColumn} = ?, overall_score = ?, final_status = ? WHERE id = ?`,
      [stageScore, Number(priorTotal) + stageScore, terminal, session.id]);
    await logSessionEvent(session.id, session.company_id, req.user, 'advanced', `HR finalized assessment as ${terminal}`);
    await logToApplicantTimeline(session, req.user, 'assessment_finalized', 'Assessment Finalized', `HR finalized the assessment as ${terminal}`);
    res.json({ success: true, resumed: false, final_status: terminal });
  } catch (err) { console.error('POST /assessments/sessions/:id/advance error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

export default router;
