import { Router } from 'express';
import pool from '../config/db.js';
import { auth } from '../middleware/auth.js';
import { authorize } from '../middleware/rbac.js';
import { addAudit } from '../services/auditService.js';

const router = Router();

// GET /api/job-titles?department_id=X&company_id=X
router.get('/', auth, async (req, res) => {
  try {
    let sql = 'SELECT * FROM job_titles WHERE 1=1';
    const params = [];
    if (req.query.department_id) { sql += ' AND department_id = ?'; params.push(req.query.department_id); }
    if (req.query.company_id) { sql += ' AND company_id = ?'; params.push(req.query.company_id); }
    sql += ' ORDER BY title';
    const [titles] = await pool.query(sql, params);

    // Fetch seniority levels for each title
    for (const title of titles) {
      const [seniorities] = await pool.query(
        'SELECT * FROM job_title_seniorities WHERE job_title_id = ? ORDER BY salary_min',
        [title.id]
      );
      title.seniorities = seniorities;
    }

    res.json(titles);
  } catch (err) {
    console.error('GET /job-titles error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/job-titles (with nested seniorities)
router.post('/', auth, authorize('admin', 'hr_manager'), async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const { seniorities, required_skills, ...titleData } = req.body;

    const [result] = await conn.query('INSERT INTO job_titles SET ?', titleData);
    const titleId = result.insertId;

    // Insert seniority levels
    if (seniorities?.length) {
      for (const s of seniorities) {
        await conn.query('INSERT INTO job_title_seniorities SET ?', {
          job_title_id: titleId, level: s.level, salary_min: s.salary_min, salary_max: s.salary_max,
        });
      }
    }

    // Insert required skills
    if (required_skills?.length) {
      for (const skillId of required_skills) {
        await conn.query('INSERT INTO job_title_skills SET ?', { job_title_id: titleId, skill_id: skillId });
      }
    }

    await conn.commit();
    await addAudit(pool, req.user, 'Job Titles', 'Created', `Job title "${titleData.title}" created`);
    res.status(201).json({ id: titleId, ...titleData });
  } catch (err) {
    await conn.rollback();
    console.error('POST /job-titles error:', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    conn.release();
  }
});

// PUT /api/job-titles/:id
router.put('/:id', auth, authorize('admin', 'hr_manager'), async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const { seniorities, required_skills, ...titleData } = req.body;

    await conn.query('UPDATE job_titles SET ? WHERE id = ?', [titleData, req.params.id]);

    // Replace seniorities
    if (seniorities) {
      await conn.query('DELETE FROM job_title_seniorities WHERE job_title_id = ?', [req.params.id]);
      for (const s of seniorities) {
        await conn.query('INSERT INTO job_title_seniorities SET ?', {
          job_title_id: req.params.id, level: s.level, salary_min: s.salary_min, salary_max: s.salary_max,
        });
      }
    }

    // Replace required skills
    if (required_skills) {
      await conn.query('DELETE FROM job_title_skills WHERE job_title_id = ?', [req.params.id]);
      for (const skillId of required_skills) {
        await conn.query('INSERT INTO job_title_skills SET ?', { job_title_id: req.params.id, skill_id: skillId });
      }
    }

    await conn.commit();
    await addAudit(pool, req.user, 'Job Titles', 'Updated', `Job title #${req.params.id} updated`);
    res.json({ success: true });
  } catch (err) {
    await conn.rollback();
    console.error('PUT /job-titles/:id error:', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    conn.release();
  }
});

// DELETE /api/job-titles/:id
router.delete('/:id', auth, authorize('admin'), async (req, res) => {
  try {
    await pool.query('DELETE FROM job_titles WHERE id = ?', [req.params.id]);
    await addAudit(pool, req.user, 'Job Titles', 'Deleted', `Job title #${req.params.id} deleted`);
    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /job-titles/:id error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
