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

    // A reload must not quietly drop the fact that this is a borrowed session —
    // the banner is the only thing telling the operator whose account they are
    // acting in, and it is rebuilt from here.
    res.json({
      ...users[0],
      impersonated_by: req.user.imp ? { id: req.user.imp.by, name: req.user.imp.by_name } : null,
    });
  } catch (err) {
    console.error('Auth/me error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/auth/stop-impersonation — hand the admin their own account back.
 *
 * The identity to return to comes from the token's `imp` claim, never from the
 * request body, and is re-checked against the database: still present, still
 * active, still an admin. So this can only ever give back the exact account
 * that started the session, which is what stops it being a way to mint a token
 * for somebody else.
 */
router.post('/stop-impersonation', auth, async (req, res) => {
  try {
    const imp = req.user?.imp;
    if (!imp) return res.status(400).json({ error: 'This is not an impersonation session' });

    const [[admin]] = await pool.query(
      'SELECT id, name, username, email, role, company_id FROM users WHERE id = ? AND is_active = TRUE',
      [imp.by]
    );
    if (!admin || admin.role !== 'admin') {
      return res.status(403).json({ error: 'The original account is no longer an active admin. Sign in again.' });
    }

    const token = jwt.sign(
      { id: admin.id, name: admin.name, role: admin.role, company_id: admin.company_id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    await addAudit(pool, admin, 'Auth', 'Impersonation Ended',
      `${admin.name} ended the "login as" session for "${req.user.name}"`);

    res.json({
      token,
      user: {
        id: admin.id, name: admin.name, username: admin.username,
        email: admin.email, role: admin.role, company_id: admin.company_id,
      },
    });
  } catch (err) {
    console.error('POST /auth/stop-impersonation error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
