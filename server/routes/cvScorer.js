import { Router } from 'express';
import pool from '../config/db.js';
import { auth } from '../middleware/auth.js';
import { authorize } from '../middleware/rbac.js';
import { requireModule, MODULES } from '../config/permissions.js';
import { addAudit } from '../services/auditService.js';
import { analyzeCV, generateQuestions, generateJD } from '../services/deepseekService.js';
import { tenantScope, companyClause, resolveWriteCompanyId } from '../middleware/tenant.js';

const router = Router();
// Recruitment is a module the accountant role has no access to at all, reads
// included — see config/permissions.js. Mounted here rather than per-route so a
// new endpoint in this file cannot forget it.
router.use(auth, tenantScope, requireModule(MODULES.RECRUITMENT));

// GET /api/cv-scorer/profiles — own company profiles + global (NULL company) templates
router.get('/profiles', async (req, res) => {
  try {
    let sql = 'SELECT csp.*, c.name as company_name, c.short_code FROM cv_scorer_profiles csp LEFT JOIN companies c ON csp.company_id = c.id WHERE 1=1';
    const params = [];
    if (req.companyId != null) { sql += ' AND (csp.company_id = ? OR csp.company_id IS NULL)'; params.push(req.companyId); }
    sql += ' ORDER BY csp.created_at DESC';
    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
});

// POST /api/cv-scorer/profiles
router.post('/profiles', authorize('admin', 'hr_manager'), async (req, res) => {
  try {
    const data = { ...req.body, created_by: req.user.id };
    data.company_id = resolveWriteCompanyId(req, req.body.company_id);
    // Convert arrays to JSON
    ['must_have_skills', 'nice_have_skills', 'required_tools', 'required_languages', 'required_industries', 'keywords', 'weights'].forEach(field => {
      if (data[field] && typeof data[field] !== 'string') data[field] = JSON.stringify(data[field]);
    });
    const [result] = await pool.query('INSERT INTO cv_scorer_profiles SET ?', data);
    await addAudit(pool, req.user, 'CV Scorer', 'Created', `Vacancy profile "${req.body.title}" created`);
    res.status(201).json({ id: result.insertId });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
});

// Resolve a profile within the caller's scope (own company or global template).
async function getScopedProfile(req, profileId) {
  let sql = 'SELECT * FROM cv_scorer_profiles WHERE id = ?';
  const params = [profileId];
  if (req.companyId != null) { sql += ' AND (company_id = ? OR company_id IS NULL)'; params.push(req.companyId); }
  const [[profile]] = await pool.query(sql, params);
  return profile || null;
}

// DELETE /api/cv-scorer/profiles/:id (scoped)
router.delete('/profiles/:id', authorize('admin'), async (req, res) => {
  try {
    const co = companyClause(req, 'company_id');
    const [result] = await pool.query('DELETE FROM cv_scorer_profiles WHERE id = ?' + co.clause, [req.params.id, ...co.params]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Profile not found' });
    res.json({ success: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
});

// POST /api/cv-scorer/score — Score candidates against a profile (scoped)
router.post('/score', async (req, res) => {
  try {
    const { profile_id, candidate_ids } = req.body;
    const profile = await getScopedProfile(req, profile_id);
    if (!profile) return res.status(404).json({ error: 'Profile not found' });

    // Get candidates — always restricted to the caller's company
    const cco = companyClause(req, 'company_id');
    const [candidates] = candidate_ids?.length
      ? await pool.query('SELECT * FROM candidates WHERE id IN (?)' + cco.clause, [candidate_ids, ...cco.params])
      : await pool.query('SELECT * FROM candidates WHERE status = ?' + cco.clause + ' LIMIT 50', ['Active', ...cco.params]);

    const results = [];
    for (const candidate of candidates) {
      try {
        const score = await analyzeCV(
          `Name: ${candidate.first_name} ${candidate.last_name}\nEmail: ${candidate.email}\nPhone: ${candidate.phone}\nExperience: ${candidate.years_experience || 0} years\nSkills: ${candidate.skills || 'Not specified'}`,
          { title: profile.title, must_have_skills: profile.must_have_skills, nice_have_skills: profile.nice_have_skills, min_years_exp: profile.min_years_exp }
        );
        results.push({ candidate_id: candidate.id, name: `${candidate.first_name} ${candidate.last_name}`, score: typeof score === 'object' ? score : { overall: 0, summary: String(score) } });
      } catch (aiErr) {
        results.push({ candidate_id: candidate.id, name: `${candidate.first_name} ${candidate.last_name}`, score: { overall: Math.floor(Math.random() * 40) + 30, summary: 'AI scoring unavailable — mock score' } });
      }
    }

    await addAudit(pool, req.user, 'CV Scorer', 'Scored', `Scored ${results.length} candidates for "${profile.title}"`);
    res.json({ profile: profile.title, results: results.sort((a, b) => (b.score?.overall || 0) - (a.score?.overall || 0)) });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
});

// POST /api/cv-scorer/generate-questions
router.post('/generate-questions', auth, async (req, res) => {
  try {
    const { profile_title, skills, seniority } = req.body;
    const questions = await generateQuestions({ title: profile_title, skills, seniority });
    res.json({ questions });
  } catch (err) {
    console.error('Generate questions error:', err.message);
    res.json({ questions: [
      `Tell me about your experience relevant to ${req.body.profile_title}`,
      'Describe a challenging project you led and its outcome',
      'How do you handle tight deadlines and competing priorities?',
      'What is your approach to collaborating with cross-functional teams?',
      'Where do you see yourself professionally in 3-5 years?',
    ]});
  }
});

// POST /api/cv-scorer/generate-jd
router.post('/generate-jd', auth, async (req, res) => {
  try {
    const jd = await generateJD(req.body);
    res.json({ jd });
  } catch (err) {
    console.error('Generate JD error:', err.message);
    res.json({ jd: `# ${req.body.title || 'Position'}\n\n## About the Role\n[AI-generated content unavailable]\n\n## Requirements\n- ${(req.body.must_have_skills || []).join('\n- ') || 'To be defined'}\n\n## Nice to Have\n- ${(req.body.nice_have_skills || []).join('\n- ') || 'To be defined'}` });
  }
});

export default router;
