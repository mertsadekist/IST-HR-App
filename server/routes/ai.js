import { Router } from 'express';
import pool from '../config/db.js';
import { auth } from '../middleware/auth.js';
import { authorize } from '../middleware/rbac.js';
import { addAudit } from '../services/auditService.js';
import * as ai from '../services/deepseekService.js';
import { tenantScope, companyClause } from '../middleware/tenant.js';

const router = Router();
router.use(auth, tenantScope);

// POST /api/ai/score-cv
router.post('/score-cv', authorize('admin', 'hr_manager', 'recruiter'), async (req, res) => {
  try {
    const { cv_text, vacancy_profile, candidate_id } = req.body;
    if (!cv_text || !vacancy_profile) {
      return res.status(400).json({ error: 'cv_text and vacancy_profile are required' });
    }

    const result = await ai.analyzeCV(cv_text, vacancy_profile);

    // Save to candidate if ID provided (scoped to caller's company)
    if (candidate_id) {
      const co = companyClause(req, 'company_id');
      await pool.query(
        'UPDATE candidates SET ai_score = ?, ai_analysis = ? WHERE id = ?' + co.clause,
        [result.score, JSON.stringify(result), candidate_id, ...co.params]
      );
    }

    await addAudit(pool, req.user, 'AI', 'CV Scored', `Scored candidate ${candidate_id || 'manual'}: ${result.score}/100`);
    res.json(result);
  } catch (err) {
    console.error('AI score-cv error:', err.response?.data || err.message);
    res.status(500).json({ error: 'AI analysis failed. Please try again.' });
  }
});

// POST /api/ai/generate-letter
router.post('/generate-letter', auth, authorize('admin', 'hr_manager'), async (req, res) => {
  try {
    const { type, fields, company_info } = req.body;
    const content = await ai.generateLetterContent(type, fields, company_info);
    res.json({ content });
  } catch (err) {
    console.error('AI generate-letter error:', err.response?.data || err.message);
    res.status(500).json({ error: 'Letter generation failed' });
  }
});

// POST /api/ai/generate-questions
router.post('/generate-questions', auth, authorize('admin', 'hr_manager', 'recruiter'), async (req, res) => {
  try {
    const { role, skills, experience_years } = req.body;
    const result = await ai.generateInterviewQuestions(role, skills, experience_years);
    res.json(result);
  } catch (err) {
    console.error('AI generate-questions error:', err.response?.data || err.message);
    res.status(500).json({ error: 'Question generation failed' });
  }
});

// POST /api/ai/generate-jd
router.post('/generate-jd', auth, authorize('admin', 'hr_manager', 'recruiter'), async (req, res) => {
  try {
    const { title, department, requirements } = req.body;
    const content = await ai.generateJobDescription(title, department, requirements);
    res.json({ content });
  } catch (err) {
    console.error('AI generate-jd error:', err.response?.data || err.message);
    res.status(500).json({ error: 'JD generation failed' });
  }
});

// POST /api/ai/summarize
router.post('/summarize', auth, async (req, res) => {
  try {
    const { candidate_data } = req.body;
    const summary = await ai.summarizeCandidate(candidate_data);
    res.json({ summary });
  } catch (err) {
    console.error('AI summarize error:', err.response?.data || err.message);
    res.status(500).json({ error: 'Summary generation failed' });
  }
});

export default router;
