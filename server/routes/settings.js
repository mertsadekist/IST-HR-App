import { Router } from 'express';
import pool from '../config/db.js';
import { auth } from '../middleware/auth.js';
import { authorize } from '../middleware/rbac.js';
import { addAudit } from '../services/auditService.js';

const router = Router();

// ==============================================
// ATS STAGES
// ==============================================

// GET /api/settings/ats-stages
router.get('/ats-stages', auth, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM ats_stages ORDER BY sort_order');
    res.json(rows);
  } catch (err) {
    console.error('GET /settings/ats-stages error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/settings/ats-stages
router.post('/ats-stages', auth, authorize('admin', 'hr_manager'), async (req, res) => {
  try {
    const { name, color, text_color, sort_order, is_success, is_fail } = req.body;
    const [result] = await pool.query('INSERT INTO ats_stages SET ?', {
      name, color: color || '#EDE9FE', text_color: text_color || '#5B21B6',
      sort_order: sort_order || 99, is_success: is_success || false, is_fail: is_fail || false,
    });
    await addAudit(pool, req.user, 'Settings', 'ATS Stage Created', `Stage "${name}" created`);
    res.status(201).json({ id: result.insertId, name });
  } catch (err) {
    console.error('POST /settings/ats-stages error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/settings/ats-stages/reorder
router.put('/ats-stages/reorder', auth, authorize('admin', 'hr_manager'), async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const { stages } = req.body; // [{ id, sort_order }]
    for (const s of stages) {
      await conn.query('UPDATE ats_stages SET sort_order = ? WHERE id = ?', [s.sort_order, s.id]);
    }
    await conn.commit();
    res.json({ success: true });
  } catch (err) {
    await conn.rollback();
    console.error('PUT /settings/ats-stages/reorder error:', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    conn.release();
  }
});

// PUT /api/settings/ats-stages/:id
router.put('/ats-stages/:id', auth, authorize('admin', 'hr_manager'), async (req, res) => {
  try {
    await pool.query('UPDATE ats_stages SET ? WHERE id = ?', [req.body, req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error('PUT /settings/ats-stages/:id error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/settings/ats-stages/:id
router.delete('/ats-stages/:id', auth, authorize('admin'), async (req, res) => {
  try {
    await pool.query('DELETE FROM ats_stages WHERE id = ?', [req.params.id]);
    await addAudit(pool, req.user, 'Settings', 'ATS Stage Deleted', `Stage #${req.params.id} deleted`);
    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /settings/ats-stages/:id error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ==============================================
// ASSET CATEGORIES
// ==============================================

// GET /api/settings/asset-categories
router.get('/asset-categories', auth, async (req, res) => {
  try {
    const [categories] = await pool.query('SELECT * FROM asset_categories ORDER BY sort_order, name');
    // Count platforms per category
    const [counts] = await pool.query(
      'SELECT category_id, COUNT(*) as count FROM platform_catalog GROUP BY category_id'
    );
    const countMap = {};
    counts.forEach(c => { countMap[c.category_id] = c.count; });
    
    const result = categories.map(cat => ({ ...cat, platform_count: countMap[cat.id] || 0 }));
    res.json(result);
  } catch (err) {
    console.error('GET /settings/asset-categories error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/settings/asset-categories
router.post('/asset-categories', auth, authorize('admin', 'hr_manager'), async (req, res) => {
  try {
    const [result] = await pool.query('INSERT INTO asset_categories SET ?', req.body);
    await addAudit(pool, req.user, 'Settings', 'Asset Category Created', `Category "${req.body.name}" created`);
    res.status(201).json({ id: result.insertId, ...req.body });
  } catch (err) {
    console.error('POST /settings/asset-categories error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/settings/asset-categories/:id
router.put('/asset-categories/:id', auth, authorize('admin', 'hr_manager'), async (req, res) => {
  try {
    await pool.query('UPDATE asset_categories SET ? WHERE id = ?', [req.body, req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error('PUT /settings/asset-categories/:id error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/settings/asset-categories/:id
router.delete('/asset-categories/:id', auth, authorize('admin'), async (req, res) => {
  try {
    await pool.query('DELETE FROM asset_categories WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /settings/asset-categories/:id error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ==============================================
// PLATFORM CATALOG
// ==============================================

// GET /api/settings/platform-catalog?category_id=X
router.get('/platform-catalog', auth, async (req, res) => {
  try {
    let sql = `SELECT pc.*, ac.name as category_name FROM platform_catalog pc 
               LEFT JOIN asset_categories ac ON pc.category_id = ac.id WHERE 1=1`;
    const params = [];
    if (req.query.category_id) { sql += ' AND pc.category_id = ?'; params.push(req.query.category_id); }
    sql += ' ORDER BY ac.sort_order, pc.name';
    const [rows] = await pool.query(sql, params);

    // Fetch assigned companies for each
    for (const item of rows) {
      const [companies] = await pool.query(
        `SELECT c.id, c.name, c.short_code FROM platform_companies pco 
         JOIN companies c ON pco.company_id = c.id WHERE pco.platform_id = ?`,
        [item.id]
      );
      item.companies = companies;
    }

    res.json(rows);
  } catch (err) {
    console.error('GET /settings/platform-catalog error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/settings/platform-catalog
router.post('/platform-catalog', auth, authorize('admin', 'hr_manager'), async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const { company_ids, ...data } = req.body;
    const [result] = await conn.query('INSERT INTO platform_catalog SET ?', data);
    const platformId = result.insertId;

    if (company_ids?.length) {
      for (const cid of company_ids) {
        await conn.query('INSERT INTO platform_companies SET ?', { platform_id: platformId, company_id: cid });
      }
    }

    await conn.commit();
    await addAudit(pool, req.user, 'Settings', 'Platform Created', `Platform "${data.name}" created`);
    res.status(201).json({ id: platformId, ...data });
  } catch (err) {
    await conn.rollback();
    console.error('POST /settings/platform-catalog error:', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    conn.release();
  }
});

// PUT /api/settings/platform-catalog/:id
router.put('/platform-catalog/:id', auth, authorize('admin', 'hr_manager'), async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const { company_ids, ...data } = req.body;
    await conn.query('UPDATE platform_catalog SET ? WHERE id = ?', [data, req.params.id]);

    if (company_ids !== undefined) {
      await conn.query('DELETE FROM platform_companies WHERE platform_id = ?', [req.params.id]);
      for (const cid of (company_ids || [])) {
        await conn.query('INSERT INTO platform_companies SET ?', { platform_id: req.params.id, company_id: cid });
      }
    }

    await conn.commit();
    res.json({ success: true });
  } catch (err) {
    await conn.rollback();
    console.error('PUT /settings/platform-catalog/:id error:', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    conn.release();
  }
});

// DELETE /api/settings/platform-catalog/:id
router.delete('/platform-catalog/:id', auth, authorize('admin'), async (req, res) => {
  try {
    await pool.query('DELETE FROM platform_catalog WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /settings/platform-catalog/:id error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ==============================================
// ONBOARDING STEP TEMPLATES
// ==============================================

// GET /api/settings/onboarding-templates?company_id=X
router.get('/onboarding-templates', auth, async (req, res) => {
  try {
    let sql = 'SELECT * FROM onboarding_step_templates WHERE 1=1';
    const params = [];
    if (req.query.company_id) { sql += ' AND company_id = ?'; params.push(req.query.company_id); }
    sql += ' ORDER BY step_number';
    const [rows] = await pool.query(sql, params);

    // Fetch checklist items for each template step
    for (const step of rows) {
      const [items] = await pool.query(
        'SELECT * FROM onboarding_step_template_items WHERE template_step_id = ? ORDER BY sort_order',
        [step.id]
      );
      step.checklist_items = items;
    }

    res.json(rows);
  } catch (err) {
    console.error('GET /settings/onboarding-templates error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/settings/onboarding-templates
router.post('/onboarding-templates', auth, authorize('admin', 'hr_manager'), async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const { checklist_items, ...data } = req.body;
    const [result] = await conn.query('INSERT INTO onboarding_step_templates SET ?', data);
    const stepId = result.insertId;

    if (checklist_items?.length) {
      for (let i = 0; i < checklist_items.length; i++) {
        await conn.query('INSERT INTO onboarding_step_template_items SET ?', {
          template_step_id: stepId, label: checklist_items[i], sort_order: i,
        });
      }
    }

    await conn.commit();
    res.status(201).json({ id: stepId, ...data });
  } catch (err) {
    await conn.rollback();
    console.error('POST /settings/onboarding-templates error:', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    conn.release();
  }
});

// PUT /api/settings/onboarding-templates/:id
router.put('/onboarding-templates/:id', auth, authorize('admin', 'hr_manager'), async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const { checklist_items, ...data } = req.body;
    await conn.query('UPDATE onboarding_step_templates SET ? WHERE id = ?', [data, req.params.id]);

    if (checklist_items !== undefined) {
      await conn.query('DELETE FROM onboarding_step_template_items WHERE template_step_id = ?', [req.params.id]);
      for (let i = 0; i < checklist_items.length; i++) {
        await conn.query('INSERT INTO onboarding_step_template_items SET ?', {
          template_step_id: req.params.id, label: checklist_items[i], sort_order: i,
        });
      }
    }

    await conn.commit();
    res.json({ success: true });
  } catch (err) {
    await conn.rollback();
    console.error('PUT /settings/onboarding-templates/:id error:', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    conn.release();
  }
});

// DELETE /api/settings/onboarding-templates/:id
router.delete('/onboarding-templates/:id', auth, authorize('admin'), async (req, res) => {
  try {
    await pool.query('DELETE FROM onboarding_step_templates WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /settings/onboarding-templates/:id error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ==============================================
// OFFBOARDING STEP TEMPLATES
// ==============================================

// GET /api/settings/offboarding-templates?company_id=X
router.get('/offboarding-templates', auth, async (req, res) => {
  try {
    let sql = 'SELECT * FROM offboarding_step_templates WHERE 1=1';
    const params = [];
    if (req.query.company_id) { sql += ' AND company_id = ?'; params.push(req.query.company_id); }
    sql += ' ORDER BY step_number';
    const [rows] = await pool.query(sql, params);

    for (const step of rows) {
      const [items] = await pool.query(
        'SELECT * FROM offboarding_step_template_items WHERE template_step_id = ? ORDER BY sort_order',
        [step.id]
      );
      step.checklist_items = items;
    }

    res.json(rows);
  } catch (err) {
    console.error('GET /settings/offboarding-templates error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/settings/offboarding-templates
router.post('/offboarding-templates', auth, authorize('admin', 'hr_manager'), async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const { checklist_items, ...data } = req.body;
    const [result] = await conn.query('INSERT INTO offboarding_step_templates SET ?', data);
    const stepId = result.insertId;

    if (checklist_items?.length) {
      for (let i = 0; i < checklist_items.length; i++) {
        await conn.query('INSERT INTO offboarding_step_template_items SET ?', {
          template_step_id: stepId, label: checklist_items[i], sort_order: i,
        });
      }
    }

    await conn.commit();
    res.status(201).json({ id: stepId, ...data });
  } catch (err) {
    await conn.rollback();
    console.error('POST /settings/offboarding-templates error:', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    conn.release();
  }
});

// PUT /api/settings/offboarding-templates/:id
router.put('/offboarding-templates/:id', auth, authorize('admin', 'hr_manager'), async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const { checklist_items, ...data } = req.body;
    await conn.query('UPDATE offboarding_step_templates SET ? WHERE id = ?', [data, req.params.id]);

    if (checklist_items !== undefined) {
      await conn.query('DELETE FROM offboarding_step_template_items WHERE template_step_id = ?', [req.params.id]);
      for (let i = 0; i < checklist_items.length; i++) {
        await conn.query('INSERT INTO offboarding_step_template_items SET ?', {
          template_step_id: req.params.id, label: checklist_items[i], sort_order: i,
        });
      }
    }

    await conn.commit();
    res.json({ success: true });
  } catch (err) {
    await conn.rollback();
    console.error('PUT /settings/offboarding-templates/:id error:', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    conn.release();
  }
});

// DELETE /api/settings/offboarding-templates/:id
router.delete('/offboarding-templates/:id', auth, authorize('admin'), async (req, res) => {
  try {
    await pool.query('DELETE FROM offboarding_step_templates WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /settings/offboarding-templates/:id error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
