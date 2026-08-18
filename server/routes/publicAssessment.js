/**
 * PUBLIC applicant-facing assessment endpoints — NO authentication.
 * Rate-limited in app.js alongside routes/public.js. Never exposes
 * correct_option_key / expected_answer / ai_eval_instructions to the client.
 */
import { Router } from 'express';
import pool from '../config/db.js';
import { scoreStage, stagePassed, anyFlaggedForReview, finalStatus } from '../services/assessmentService.js';
import { evaluateAnswer, evaluateConsistencyPair } from '../services/deepseekService.js';

const router = Router();

function parseJSON(v, fallback) { try { return typeof v === 'string' ? JSON.parse(v) : (v ?? fallback); } catch { return fallback; } }

async function loadSession(token) {
  const [[session]] = await pool.query('SELECT * FROM assessment_sessions WHERE token = ?', [token]);
  if (!session) return null;
  const [[version]] = await pool.query('SELECT * FROM assessment_template_versions WHERE id = ?', [session.template_version_id]);
  const [[template]] = await pool.query('SELECT * FROM assessment_templates WHERE id = ?', [version.template_id]);
  const [[application]] = await pool.query('SELECT * FROM job_applications WHERE id = ?', [session.application_id]);
  const [[candidate]] = await pool.query('SELECT first_name, last_name FROM candidates WHERE id = ?', [application.candidate_id]);
  const [stages] = await pool.query('SELECT * FROM assessment_stages WHERE template_version_id = ? ORDER BY stage_order', [version.id]);
  return { session, version, template, application, candidate, stages };
}

// Only the fields an applicant may see — no correct answers or grading hints.
function sanitizeQuestion(q) {
  return {
    id: q.id, question_order: q.question_order, type: q.type,
    question_text: q.question_text, options: parseJSON(q.options, null),
  };
}

router.get('/assessment/:token', async (req, res) => {
  try {
    const ctx = await loadSession(req.params.token);
    if (!ctx) return res.status(404).json({ error: 'This assessment link is invalid or has expired.' });
    const { session, template, candidate, stages } = ctx;

    const base = {
      status: session.status,
      current_stage: session.current_stage,
      applicant_name: `${candidate.first_name} ${candidate.last_name}`,
      position_title: template.position_title || template.name,
      stage_overview: stages.map((s) => ({ stage_order: s.stage_order, name: s.name, duration_minutes: s.duration_minutes })),
    };

    if (session.status === 'InProgress') {
      const stage = stages.find((s) => s.stage_order === session.current_stage);
      const [questions] = await pool.query('SELECT * FROM assessment_questions WHERE stage_id = ? ORDER BY question_order', [stage.id]);
      const [answers] = await pool.query(
        'SELECT question_id, answer_text, selected_option_key FROM assessment_answers WHERE session_id = ? AND question_id IN (?)',
        [session.id, questions.map((q) => q.id)]);
      base.stage = {
        id: stage.id, stage_order: stage.stage_order, name: stage.name, duration_minutes: stage.duration_minutes,
        questions: questions.map(sanitizeQuestion),
      };
      base.stage_deadline_at = session.stage_deadline_at;
      base.answers = Object.fromEntries(answers.map((a) => [a.question_id, { answer_text: a.answer_text, selected_option_key: a.selected_option_key }]));
    }

    res.json(base);
  } catch (err) { console.error('GET /public/assessment/:token error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

router.post('/assessment/:token/start', async (req, res) => {
  try {
    const ctx = await loadSession(req.params.token);
    if (!ctx) return res.status(404).json({ error: 'This assessment link is invalid or has expired.' });
    const { session, stages } = ctx;
    if (session.status !== 'Pending') return res.status(409).json({ error: 'This assessment has already been started.' });

    const stage1 = stages.find((s) => s.stage_order === 1);
    const deadline = new Date(Date.now() + stage1.duration_minutes * 60_000);
    await pool.query('UPDATE assessment_sessions SET status = ?, started_at = NOW(), stage_started_at = NOW(), stage_deadline_at = ? WHERE id = ?',
      ['InProgress', deadline, session.id]);
    await pool.query('INSERT INTO assessment_session_events SET ?', {
      company_id: session.company_id, session_id: session.id, user_name: 'Applicant', event_type: 'started', detail: 'Assessment started',
    });
    res.json({ success: true, stage_deadline_at: deadline });
  } catch (err) { console.error('POST /public/assessment/:token/start error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

router.put('/assessment/:token/answers/:questionId', async (req, res) => {
  try {
    const ctx = await loadSession(req.params.token);
    if (!ctx) return res.status(404).json({ error: 'This assessment link is invalid or has expired.' });
    const { session, stages } = ctx;
    if (session.status !== 'InProgress') return res.status(409).json({ error: 'This assessment is not currently in progress.' });

    const stage = stages.find((s) => s.stage_order === session.current_stage);
    const [[question]] = await pool.query('SELECT * FROM assessment_questions WHERE id = ? AND stage_id = ?', [req.params.questionId, stage.id]);
    if (!question) return res.status(404).json({ error: 'Question not found in the current stage.' });

    const { answer_text, selected_option_key } = req.body;
    await pool.query(
      `INSERT INTO assessment_answers (company_id, session_id, question_id, answer_text, selected_option_key, autosaved_at)
       VALUES (?, ?, ?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE answer_text = VALUES(answer_text), selected_option_key = VALUES(selected_option_key), autosaved_at = NOW()`,
      [session.company_id, session.id, question.id, answer_text || null, selected_option_key || null]);
    res.json({ success: true });
  } catch (err) { console.error('PUT /public/assessment/:token/answers error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

const STAGE_SCORE_COLUMN = { 1: 'stage1_score', 2: 'stage2_score', 3: 'stage3_score' };

router.post('/assessment/:token/stages/:stageOrder/submit', async (req, res) => {
  try {
    const ctx = await loadSession(req.params.token);
    if (!ctx) return res.status(404).json({ error: 'This assessment link is invalid or has expired.' });
    const { session, stages } = ctx;
    const stageOrder = Number(req.params.stageOrder);
    if (session.status !== 'InProgress') return res.status(409).json({ error: 'This assessment is not currently in progress.' });
    if (stageOrder !== session.current_stage) return res.status(409).json({ error: 'This is not the current stage.' });
    const scoreColumn = STAGE_SCORE_COLUMN[stageOrder];
    if (!scoreColumn) return res.status(400).json({ error: 'Invalid stage.' });

    const stage = stages.find((s) => s.stage_order === stageOrder);
    const [questions] = await pool.query('SELECT * FROM assessment_questions WHERE stage_id = ? ORDER BY question_order', [stage.id]);
    const [existingAnswers] = await pool.query(
      'SELECT * FROM assessment_answers WHERE session_id = ? AND question_id IN (?)',
      [session.id, questions.map((q) => q.id)]);
    const answerByQuestion = new Map(existingAnswers.map((a) => [a.question_id, a]));

    // Ensure every question has an answer row (blank if the applicant skipped it), then score each one.
    for (const q of questions) {
      if (!answerByQuestion.has(q.id)) {
        await pool.query('INSERT INTO assessment_answers SET ?', { company_id: session.company_id, session_id: session.id, question_id: q.id });
      }
    }

    await Promise.all(questions.map(async (q) => {
      const existing = answerByQuestion.get(q.id);
      let result;
      if (q.type === 'multiple_choice') {
        const correct = existing?.selected_option_key && existing.selected_option_key === q.correct_option_key;
        result = { score: correct ? q.weight : 0, confidence: 1, evaluation: null, flagged_review: false };
      } else {
        result = await evaluateAnswer(q.question_text, q.expected_answer, q.ai_eval_instructions, existing?.answer_text, q.weight);
      }
      await pool.query(
        `UPDATE assessment_answers SET submitted_at = NOW(), ai_score = ?, ai_confidence = ?, ai_evaluation = ?, ai_flagged_review = ?
         WHERE session_id = ? AND question_id = ?`,
        [result.score, result.confidence, result.evaluation, result.flagged_review ? 1 : 0, session.id, q.id]);
    }));

    // Consistency check: for a question that names an earlier-stage pair, compare the two answers.
    let consistencyFlag = !!session.consistency_flag;
    let consistencyNote = session.consistency_note || '';
    for (const q of questions.filter((x) => x.consistency_pair_question_id)) {
      const [[pairQuestion]] = await pool.query('SELECT * FROM assessment_questions WHERE id = ?', [q.consistency_pair_question_id]);
      const [[pairAnswer]] = await pool.query('SELECT * FROM assessment_answers WHERE session_id = ? AND question_id = ?', [session.id, q.consistency_pair_question_id]);
      const thisAnswer = answerByQuestion.get(q.id);
      const thisAnswerText = thisAnswer?.answer_text || (thisAnswer?.selected_option_key ? `Selected option: ${q.options ? (parseJSON(q.options, []).find((o) => o.key === thisAnswer.selected_option_key)?.text || thisAnswer.selected_option_key) : thisAnswer.selected_option_key}` : '');
      const pairAnswerText = pairAnswer?.answer_text || pairAnswer?.selected_option_key || '';
      if (pairQuestion && pairAnswerText && thisAnswerText) {
        const verdict = await evaluateConsistencyPair(pairQuestion.question_text, pairAnswerText, q.question_text, thisAnswerText);
        if (!verdict.consistent) {
          consistencyFlag = true;
          consistencyNote = [consistencyNote, verdict.note].filter(Boolean).join(' ');
        }
      }
    }

    await pool.query('INSERT INTO assessment_session_events SET ?', {
      company_id: session.company_id, session_id: session.id, user_name: 'Applicant', event_type: 'stage_submitted', detail: `Stage ${stageOrder} submitted`,
    });

    const [scoredAnswers] = await pool.query('SELECT * FROM assessment_answers WHERE session_id = ? AND question_id IN (?)', [session.id, questions.map((q) => q.id)]);
    const stageScore = scoreStage(questions, new Map(scoredAnswers.map((a) => [a.question_id, a])));
    const passed = stagePassed(stageScore, stage.passing_score);
    const flaggedThisStage = anyFlaggedForReview(scoredAnswers);
    const nextStage = stages.find((s) => s.stage_order === stageOrder + 1);
    const isLastStage = !nextStage;

    if (!passed || isLastStage) {
      let flaggedOverall = flaggedThisStage;
      if (passed && isLastStage) {
        // Need the full session's answers, not just this stage, before deciding if HR review is required.
        const [allAnswers] = await pool.query(
          `SELECT a.* FROM assessment_answers a JOIN assessment_questions q ON q.id = a.question_id
           JOIN assessment_stages s ON s.id = q.stage_id WHERE s.template_version_id = ? AND a.session_id = ?`,
          [session.template_version_id, session.id]);
        flaggedOverall = anyFlaggedForReview(allAnswers);
      }
      const terminal = finalStatus({ passed, isLastStage, flagged: flaggedOverall });
      const [[{ priorTotal }]] = await pool.query(
        `SELECT COALESCE(stage1_score,0) + COALESCE(stage2_score,0) + COALESCE(stage3_score,0) AS priorTotal FROM assessment_sessions WHERE id = ?`,
        [session.id]);
      await pool.query(
        `UPDATE assessment_sessions SET ${scoreColumn} = ?, overall_score = ?, status = 'Completed', completed_at = NOW(),
         final_status = ?, consistency_flag = ?, consistency_note = ? WHERE id = ?`,
        [stageScore, Number(priorTotal) + stageScore, terminal, consistencyFlag ? 1 : 0, consistencyNote || null, session.id]);
      await pool.query('INSERT INTO assessment_session_events SET ?', {
        company_id: session.company_id, session_id: session.id, user_name: 'System', event_type: 'completed', detail: `Assessment completed — ${terminal}`,
      });
      res.json({ success: true, completed: true, passed });
    } else {
      const deadline = new Date(Date.now() + nextStage.duration_minutes * 60_000);
      await pool.query(
        `UPDATE assessment_sessions SET ${scoreColumn} = ?, current_stage = ?, stage_started_at = NOW(), stage_deadline_at = ?,
         consistency_flag = ?, consistency_note = ? WHERE id = ?`,
        [stageScore, nextStage.stage_order, deadline, consistencyFlag ? 1 : 0, consistencyNote || null, session.id]);
      res.json({ success: true, completed: false, next_stage: nextStage.stage_order });
    }
  } catch (err) { console.error('POST /public/assessment/:token/stages/:order/submit error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

router.get('/assessment/:token/result', async (req, res) => {
  try {
    const ctx = await loadSession(req.params.token);
    if (!ctx) return res.status(404).json({ error: 'This assessment link is invalid or has expired.' });
    const { session } = ctx;
    if (!['Completed', 'Stopped'].includes(session.status)) {
      return res.status(409).json({ error: 'This assessment has not been completed yet.' });
    }
    res.json({ status: session.status, final_status: session.final_status });
  } catch (err) { console.error('GET /public/assessment/:token/result error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

export default router;
