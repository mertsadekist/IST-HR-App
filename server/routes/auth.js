import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../config/db.js';
import { auth } from '../middleware/auth.js';
import { addAudit } from '../services/auditService.js';
import { validate } from '../middleware/validate.js';

const router = Router();

// POST /api/auth/login
router.post('/login', validate({
  username: { required: true, type: 'string', minLen: 1, maxLen: 100 },
  password: { required: true, type: 'string', minLen: 1, maxLen: 200 },
}), async (req, res) => {
  try {
    const { username, password } = req.body;

    const [users] = await pool.query(
      'SELECT * FROM users WHERE username = ? AND is_active = TRUE',
      [username]
    );

    if (!users.length) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = users[0];
    const isValid = await bcrypt.compare(password, user.password_hash);

    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user.id, name: user.name, role: user.role, company_id: user.company_id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    // Update last login
    await pool.query('UPDATE users SET last_login_at = NOW() WHERE id = ?', [user.id]);
    await addAudit(pool, user, 'Auth', 'Login', `User "${user.username}" logged in`);

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        email: user.email,
        role: user.role,
        company_id: user.company_id,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/me — Verify token and return user profile
router.get('/me', auth, async (req, res) => {
  try {
    const [users] = await pool.query(
      'SELECT id, name, username, email, role, company_id FROM users WHERE id = ? AND is_active = TRUE',
      [req.user.id]
    );

    if (!users.length) {
      return res.status(401).json({ error: 'User not found or disabled' });
    }

    res.json(users[0]);
  } catch (err) {
    console.error('Auth/me error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
