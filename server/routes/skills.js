import { Router } from 'express';
import pool from '../config/db.js';
import { auth } from '../middleware/auth.js';
import { requireModule, MODULES } from '../config/permissions.js';
import { authorize } from '../middleware/rbac.js';
import { addAudit } from '../services/auditService.js';

const router = Router();

// Module-gated so reads are refused too, not just writes.
// See config/permissions.js and docs/roles_and_permissions.md.
router.use(auth, requireModule(MODULES.OPERATIONS));

// GET /api/skills — Returns categories with nested skills
router.get('/', auth, async (req, res) => {
  try {
    const [categories] = await pool.query('SELECT * FROM skill_categories ORDER BY sort_order, name');
    const [skills] = await pool.query('SELECT * FROM skills ORDER BY name');

    const result = categories.map(cat => ({
      ...cat,
      skills: skills.filter(s => s.category_id === cat.id),
    }));

    res.json(result);
  } catch (err) {
    console.error('GET /skills error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/skills/flat — Returns just skills (flat list for dropdowns)
router.get('/flat', auth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT s.*, sc.name as category_name FROM skills s 
       JOIN skill_categories sc ON s.category_id = sc.id 
       WHERE s.status = 'Active' ORDER BY sc.sort_order, s.name`
    );
    res.json(rows);
  } catch (err) {
    console.error('GET /skills/flat error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/skills/categories
router.post('/categories', auth, authorize('admin', 'hr_manager'), async (req, res) => {
  try {
    const [result] = await pool.query('INSERT INTO skill_categories SET ?', req.body);
    await addAudit(pool, req.user, 'Skills', 'Category Created', `Category "${req.body.name}" created`);
    res.status(201).json({ id: result.insertId, ...req.body });
  } catch (err) {
    console.error('POST /skills/categories error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/skills/categories/:id
router.put('/categories/:id', auth, authorize('admin', 'hr_manager'), async (req, res) => {
  try {
    await pool.query('UPDATE skill_categories SET ? WHERE id = ?', [req.body, req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error('PUT /skills/categories/:id error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/skills/categories/:id
router.delete('/categories/:id', auth, authorize('admin'), async (req, res) => {
  try {
    await pool.query('DELETE FROM skill_categories WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /skills/categories/:id error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/skills — Add a skill to a category
router.post('/', auth, authorize('admin', 'hr_manager'), async (req, res) => {
  try {
    const [result] = await pool.query('INSERT INTO skills SET ?', req.body);
    res.status(201).json({ id: result.insertId, ...req.body });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Skill already exists in this category' });
    console.error('POST /skills error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/skills/:id — admin only (hr_manager cannot delete)
router.delete('/:id', auth, authorize('admin'), async (req, res) => {
  try {
    await pool.query('DELETE FROM skills WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /skills/:id error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/skills/import — Bulk import
router.post('/import', auth, authorize('admin'), async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const { categories } = req.body; // [{ name, icon, color, skills: ["skill1", "skill2"] }]

    for (const cat of categories) {
      const [catResult] = await conn.query('INSERT INTO skill_categories SET ?', {
        name: cat.name, icon: cat.icon || '🎯', color: cat.color || '#6D28D9', sort_order: cat.sort_order || 0,
      });
      for (const skillName of (cat.skills || [])) {
        await conn.query('INSERT IGNORE INTO skills SET ?', {
          category_id: catResult.insertId, name: skillName,
        });
      }
    }

    await conn.commit();
    await addAudit(pool, req.user, 'Skills', 'Imported', `Imported ${categories.length} categories`);
    res.status(201).json({ success: true, imported: categories.length });
  } catch (err) {
    await conn.rollback();
    console.error('POST /skills/import error:', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    conn.release();
  }
});

export default router;
