import { Router } from 'express';
import pool from '../config/db.js';
import { auth } from '../middleware/auth.js';

const router = Router();
router.use(auth);

// GET /api/notifications?unread=1&limit=20 — the caller's own notifications
router.get('/', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    let sql = 'SELECT * FROM notifications WHERE user_id = ?';
    const params = [req.user.id];
    if (req.query.unread === '1') sql += ' AND is_read = FALSE';
    sql += ' ORDER BY created_at DESC LIMIT ?';
    params.push(limit);
    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) { console.error('GET /notifications error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

// GET /api/notifications/unread-count
router.get('/unread-count', async (req, res) => {
  try {
    const [[r]] = await pool.query('SELECT COUNT(*) c FROM notifications WHERE user_id = ? AND is_read = FALSE', [req.user.id]);
    res.json({ count: r.c });
  } catch (err) { console.error('unread-count error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

// PUT /api/notifications/:id/read
router.put('/:id/read', async (req, res) => {
  try {
    const [result] = await pool.query('UPDATE notifications SET is_read = TRUE WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Notification not found' });
    res.json({ success: true });
  } catch (err) { console.error('mark read error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

// PUT /api/notifications/read-all
router.put('/read-all', async (req, res) => {
  try {
    await pool.query('UPDATE notifications SET is_read = TRUE WHERE user_id = ? AND is_read = FALSE', [req.user.id]);
    res.json({ success: true });
  } catch (err) { console.error('read-all error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

// DELETE /api/notifications/:id
router.delete('/:id', async (req, res) => {
  try {
    const [result] = await pool.query('DELETE FROM notifications WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Notification not found' });
    res.json({ success: true });
  } catch (err) { console.error('delete notification error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

export default router;
