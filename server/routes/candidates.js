import { Router } from 'express';
import pool from '../config/db.js';
import { auth } from '../middleware/auth.js';
import { authorize } from '../middleware/rbac.js';
import { addAudit } from '../services/auditService.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { extractTextFromFile } from '../services/cvParserService.js';
import { parseEmployeeDocument } from '../services/deepseekService.js';
import { tenantScope, companyClause, resolveWriteCompanyId } from '../middleware/tenant.js';
import { validate } from '../middleware/validate.js';
import { ensureUploadDir } from '../config/storage.js';

const upload = multer({
  dest: ensureUploadDir('cvs'),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.doc', '.docx', '.txt'];
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, allowed.includes(ext));
  },
});

const router = Router();
router.use(auth, tenantScope);

// Verifies a candidate exists within the caller's company; returns row or null.
async function getScopedCandidate(req, candidateId) {
  const co = companyClause(req, 'company_id');
  const [[c]] = await pool.query('SELECT * FROM candidates WHERE id = ?' + co.clause, [candidateId, ...co.params]);
  return c || null;
}

// GET /api/candidates?vacancy_id=X&stage_id=X&status=X&search=X&page=1&limit=25 (scoped)
router.get('/', async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 25, 100);
    const offset = (page - 1) * limit;

    const co = companyClause(req, 'ca.company_id');
    const coCount = companyClause(req, 'company_id');
    let sql = `SELECT ca.*, co.name as company_name, co.short_code, co.color_primary,
               v.title as vacancy_title, s.name as stage_name, s.color as stage_color, s.text_color as stage_text_color
               FROM candidates ca
               LEFT JOIN companies co ON ca.company_id = co.id
               LEFT JOIN vacancies v ON ca.vacancy_id = v.id
               LEFT JOIN ats_stages s ON ca.current_stage_id = s.id
               WHERE 1=1` + co.clause;
    let countSql = 'SELECT COUNT(*) as total FROM candidates WHERE 1=1' + coCount.clause;
    const params = [...co.params];
    const countParams = [...coCount.params];

    if (req.query.vacancy_id) {
      sql += ' AND ca.vacancy_id = ?'; params.push(req.query.vacancy_id);
      countSql += ' AND vacancy_id = ?'; countParams.push(req.query.vacancy_id);
    }
    if (req.query.stage_id) {
      sql += ' AND ca.current_stage_id = ?'; params.push(req.query.stage_id);
      countSql += ' AND current_stage_id = ?'; countParams.push(req.query.stage_id);
    }
    if (req.query.status) {
      sql += ' AND ca.status = ?'; params.push(req.query.status);
      countSql += ' AND status = ?'; countParams.push(req.query.status);
    }
    if (req.query.search) {
      const search = `%${req.query.search}%`;
      sql += ' AND (ca.first_name LIKE ? OR ca.last_name LIKE ? OR ca.email LIKE ? OR ca.phone LIKE ?)';
      params.push(search, search, search, search);
      countSql += ' AND (first_name LIKE ? OR last_name LIKE ? OR email LIKE ? OR phone LIKE ?)';
      countParams.push(search, search, search, search);
    }

    sql += ' ORDER BY ca.created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const [rows] = await pool.query(sql, params);
    const [[countResult]] = await pool.query(countSql, countParams);

    res.json({
      data: rows,
      total: countResult.total,
      page,
      limit,
      totalPages: Math.ceil(countResult.total / limit),
    });
  } catch (err) {
    console.error('GET /candidates error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/candidates/:id (company-scoped)
router.get('/:id', async (req, res) => {
  try {
    const co = companyClause(req, 'ca.company_id');
    const [rows] = await pool.query(`
      SELECT ca.*, co.name as company_name, co.short_code,
             v.title as vacancy_title, s.name as stage_name, s.color as stage_color, s.text_color as stage_text_color
      FROM candidates ca
      LEFT JOIN companies co ON ca.company_id = co.id
      LEFT JOIN vacancies v ON ca.vacancy_id = v.id
      LEFT JOIN ats_stages s ON ca.current_stage_id = s.id
      WHERE ca.id = ?` + co.clause, [req.params.id, ...co.params]);
    if (!rows.length) return res.status(404).json({ error: 'Candidate not found' });

    // Get stage history
    const [history] = await pool.query(`
      SELECT csh.*, s.name as stage_name, s.color, u.name as moved_by_name
      FROM candidate_stage_history csh
      LEFT JOIN ats_stages s ON csh.stage_id = s.id
      LEFT JOIN users u ON csh.moved_by = u.id
      WHERE csh.candidate_id = ?
      ORDER BY csh.moved_at DESC
    `, [req.params.id]);

    // Get skills
    const [skills] = await pool.query(`
      SELECT cs.*, sk.name as skill_name, sc.name as category_name
      FROM candidate_skills cs
      JOIN skills sk ON cs.skill_id = sk.id
      LEFT JOIN skill_categories sc ON sk.category_id = sc.id
      WHERE cs.candidate_id = ?
    `, [req.params.id]);

    res.json({ ...rows[0], stage_history: history, skills });
  } catch (err) {
    console.error('GET /candidates/:id error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/candidates
router.post('/', authorize('admin', 'hr_manager', 'recruiter'), validate({
  first_name: { required: true, type: 'string', minLen: 1, maxLen: 255 },
  last_name: { type: 'string', maxLen: 255 },
  email: { type: 'email' },
  phone: { type: 'phone' },
}), async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const { skills: candidateSkills, ...data } = req.body;

    // Force the candidate into the caller's company scope
    data.company_id = resolveWriteCompanyId(req, data.company_id);
    if (!data.company_id) { await conn.rollback(); return res.status(400).json({ error: 'Company is required' }); }

    // Per-company duplicate-email guard (DB-004)
    if (data.email) {
      const [[dup]] = await conn.query('SELECT id FROM candidates WHERE company_id = ? AND email = ?', [data.company_id, data.email]);
      if (dup) { await conn.rollback(); return res.status(409).json({ error: 'A candidate with this email already exists in this company' }); }
    }

    // If no stage, get default stage
    if (!data.current_stage_id) {
      const [[defaultStage]] = await conn.query('SELECT id FROM ats_stages WHERE is_default = TRUE LIMIT 1');
      if (defaultStage) data.current_stage_id = defaultStage.id;
    }

    const [result] = await conn.query('INSERT INTO candidates SET ?', data);
    const candidateId = result.insertId;

    // Insert skills
    if (candidateSkills?.length) {
      for (const s of candidateSkills) {
        await conn.query('INSERT INTO candidate_skills SET ?', {
          candidate_id: candidateId, skill_id: s.skill_id, proficiency: s.proficiency || 'Intermediate',
        });
      }
    }

    // Add stage history
    if (data.current_stage_id) {
      await conn.query('INSERT INTO candidate_stage_history SET ?', {
        candidate_id: candidateId, stage_id: data.current_stage_id, moved_by: req.user.id, notes: 'Initial stage',
      });
    }

    await conn.commit();
    await addAudit(pool, req.user, 'Candidates', 'Created', `Candidate "${data.first_name} ${data.last_name}" created`);
    res.status(201).json({ id: candidateId, ...data });
  } catch (err) {
    await conn.rollback();
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'A candidate with this email already exists in this company' });
    console.error('POST /candidates error:', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    conn.release();
  }
});

// PUT /api/candidates/:id (company-scoped; cannot re-tenant)
router.put('/:id', authorize('admin', 'hr_manager', 'recruiter'), async (req, res) => {
  try {
    const { skills: candidateSkills, company_id, ...data } = req.body;
    if (!(await getScopedCandidate(req, req.params.id))) {
      return res.status(404).json({ error: 'Candidate not found' });
    }
    await pool.query('UPDATE candidates SET ? WHERE id = ?', [data, req.params.id]);

    if (candidateSkills !== undefined) {
      await pool.query('DELETE FROM candidate_skills WHERE candidate_id = ?', [req.params.id]);
      for (const s of (candidateSkills || [])) {
        await pool.query('INSERT INTO candidate_skills SET ?', {
          candidate_id: req.params.id, skill_id: s.skill_id, proficiency: s.proficiency || 'Intermediate',
        });
      }
    }

    await addAudit(pool, req.user, 'Candidates', 'Updated', `Candidate #${req.params.id} updated`);
    res.json({ success: true });
  } catch (err) {
    console.error('PUT /candidates/:id error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/candidates/:id/move — Move to a different ATS stage
router.put('/:id/move', authorize('admin', 'hr_manager', 'recruiter'), async (req, res) => {
  const conn = await pool.getConnection();
  try {
    // The candidate must belong to the caller's company
    if (!(await getScopedCandidate(req, req.params.id))) {
      return res.status(404).json({ error: 'Candidate not found' });
    }
    await conn.beginTransaction();
    const { stage_id, notes } = req.body;

    // Get stage info
    const [[stage]] = await conn.query('SELECT * FROM ats_stages WHERE id = ?', [stage_id]);
    if (!stage) { await conn.rollback(); return res.status(404).json({ error: 'Stage not found' }); }

    // Update candidate
    await conn.query('UPDATE candidates SET current_stage_id = ? WHERE id = ?', [stage_id, req.params.id]);

    // Log history
    await conn.query('INSERT INTO candidate_stage_history SET ?', {
      candidate_id: req.params.id, stage_id, moved_by: req.user.id, notes,
    });

    // If success stage → create employee + onboarding
    if (stage.is_success) {
      const [[candidate]] = await conn.query('SELECT * FROM candidates WHERE id = ?', [req.params.id]);
      if (candidate) {
        await conn.query('UPDATE candidates SET status = ? WHERE id = ?', ['Hired', req.params.id]);

        const [empResult] = await conn.query('INSERT INTO employees SET ?', {
          candidate_id: candidate.id,
          first_name: candidate.first_name,
          last_name: candidate.last_name,
          email: candidate.email,
          phone: candidate.phone,
          nationality: candidate.nationality,
          company_id: candidate.company_id,
          start_date: new Date(),
          status: 'Onboarding',
        });

        // Create onboarding record
        await conn.query('INSERT INTO onboarding_records SET ?', {
          employee_id: empResult.insertId,
          company_id: candidate.company_id,
          status: 'In Progress',
        });
      }
    }

    // If fail stage → update candidate status
    if (stage.is_fail) {
      const failStatus = stage.name === 'Blacklisted' ? 'Blacklisted' : 'Failed';
      await conn.query('UPDATE candidates SET status = ? WHERE id = ?', [failStatus, req.params.id]);
    }

    await conn.commit();
    await addAudit(pool, req.user, 'ATS', 'Stage Move', `Candidate #${req.params.id} → ${stage.name}`);
    res.json({ success: true, stage: stage.name, is_success: stage.is_success, is_fail: stage.is_fail });
  } catch (err) {
    await conn.rollback();
    console.error('PUT /candidates/:id/move error:', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    conn.release();
  }
});

// DELETE /api/candidates/:id (company-scoped) — admin only (hr_manager cannot delete)
router.delete('/:id', authorize('admin'), async (req, res) => {
  try {
    const co = companyClause(req, 'company_id');
    const [result] = await pool.query('DELETE FROM candidates WHERE id = ?' + co.clause, [req.params.id, ...co.params]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Candidate not found' });
    await addAudit(pool, req.user, 'Candidates', 'Deleted', `Candidate #${req.params.id} deleted`);
    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /candidates/:id error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/candidates/parse-cv — Parse CV for pre-filling (auth + role enforced)
router.post('/parse-cv', authorize('admin', 'hr_manager', 'recruiter'), upload.single('cv'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const ext = path.extname(req.file.originalname).toLowerCase();
    let cvText = await extractTextFromFile(req.file.path, ext);

    const parsedData = await parseEmployeeDocument(cvText, 'CV');

    res.json({ 
      success: true, 
      extracted: parsedData, 
      cv_text: cvText, 
      file_name: req.file.originalname 
    });
  } catch (err) {
    console.error('Parse CV error:', err);
    res.status(500).json({ error: 'Parse failed' });
  }
});

// POST /api/candidates/:id/parse — (re)read the stored CV text and refresh ai_analysis
router.post('/:id/parse', authorize('admin', 'hr_manager', 'recruiter'), async (req, res) => {
  try {
    const candidate = await getScopedCandidate(req, req.params.id);
    if (!candidate) return res.status(404).json({ error: 'Candidate not found' });
    const text = candidate.cv_text;
    if (!text || text.trim().length < 20) {
      return res.status(400).json({ error: 'No CV text on file to read. Upload the candidate CV first.' });
    }
    const extracted = await parseEmployeeDocument(text, 'CV');
    const patch = { ai_analysis: JSON.stringify(extracted || {}) };
    // Backfill core identity fields only where the candidate record is still empty
    if (!candidate.first_name && extracted.first_name) patch.first_name = extracted.first_name;
    if (!candidate.last_name && extracted.last_name) patch.last_name = extracted.last_name;
    if (!candidate.email && extracted.email) patch.email = extracted.email;
    if (!candidate.phone && extracted.phone) patch.phone = extracted.phone;
    if (!candidate.nationality && extracted.nationality) patch.nationality = extracted.nationality;
    await pool.query('UPDATE candidates SET ? WHERE id = ?', [patch, candidate.id]);
    await addAudit(pool, req.user, 'Candidates', 'CV Parsed', `CV re-read for candidate #${candidate.id}`);
    res.json({ success: true, extracted });
  } catch (err) {
    console.error('POST /candidates/:id/parse error:', err);
    res.status(500).json({ error: 'Failed to read CV' });
  }
});

// POST /api/candidates/:id/upload-cv — Upload CV file
router.post('/:id/upload-cv', authorize('admin', 'hr_manager', 'recruiter'), upload.single('cv'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    if (!(await getScopedCandidate(req, req.params.id))) {
      return res.status(404).json({ error: 'Candidate not found' });
    }

    const ext = path.extname(req.file.originalname).toLowerCase();
    
    // Extract text using the new cvParserService
    let cvText = await extractTextFromFile(req.file.path, ext);

    // Auto-extract info from text
    const extracted = await parseEmployeeDocument(cvText, 'CV');

    // Create the dataset to update in DB
    const updateData = {
      cv_file_name: req.file.originalname,
      cv_text: cvText,
      ai_analysis: JSON.stringify(extracted)
    };

    // Pre-populate core details if extracted and not already provided
    if (extracted.first_name) updateData.first_name = extracted.first_name;
    if (extracted.last_name) updateData.last_name = extracted.last_name;
    if (extracted.email) updateData.email = extracted.email;
    if (extracted.phone) updateData.phone = extracted.phone;
    if (extracted.nationality) updateData.nationality = extracted.nationality;

    await pool.query('UPDATE candidates SET ? WHERE id = ?', [updateData, req.params.id]);

    await addAudit(pool, req.user, 'Candidates', 'CV Uploaded', `CV "${req.file.originalname}" uploaded for candidate #${req.params.id}`);
    res.json({ success: true, file_name: req.file.originalname, extracted });
  } catch (err) {
    console.error('CV upload error:', err);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// GET /api/candidates/:id/wati-tags — Generate WATI messaging tags (company-scoped)
router.get('/:id/wati-tags', async (req, res) => {
  try {
    const co = companyClause(req, 'ca.company_id');
    const [[c]] = await pool.query(
      `SELECT ca.*, co.short_code, v.title as vacancy_title, s.name as stage_name
       FROM candidates ca LEFT JOIN companies co ON ca.company_id = co.id
       LEFT JOIN vacancies v ON ca.vacancy_id = v.id LEFT JOIN ats_stages s ON ca.current_stage_id = s.id
       WHERE ca.id = ?` + co.clause, [req.params.id, ...co.params]
    );
    if (!c) return res.status(404).json({ error: 'Not found' });

    const tags = [
      `company:${c.short_code || 'NONE'}`,
      `stage:${(c.stage_name || 'unknown').toLowerCase().replace(/\s+/g, '_')}`,
      `status:${c.status.toLowerCase()}`,
    ];
    if (c.vacancy_title) tags.push(`vacancy:${c.vacancy_title.toLowerCase().replace(/\s+/g, '_')}`);
    if (c.nationality) tags.push(`nationality:${c.nationality.toLowerCase()}`);
    if (c.ai_score) tags.push(`ai_score:${c.ai_score >= 70 ? 'high' : c.ai_score >= 50 ? 'medium' : 'low'}`);

    res.json({
      candidate: `${c.first_name} ${c.last_name}`,
      phone: c.phone,
      tags,
      wati_name: `${c.first_name} ${c.last_name} [${c.short_code}]`,
    });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
});

export default router;
