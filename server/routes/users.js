import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../config/db.js';
import { auth, denyImpersonated } from '../middleware/auth.js';
import { notifyRole } from '../services/notificationService.js';
import { authorize } from '../middleware/rbac.js';
import { addAudit } from '../services/auditService.js';
import { tenantScope } from '../middleware/tenant.js';
import { validate } from '../middleware/validate.js';
import { ROLE_MODULES } from '../config/permissions.js';

const router = Router();
router.use(auth, tenantScope);

const BCRYPT_ROUNDS = 12;
// The roles the system knows are exactly those with a permission profile —
// one list, so a role can never be offered here without an access definition.
// This previously also listed 'hr_specialist', which is not in the users.role
// enum, so creating that user always failed at the INSERT.
const ALLOWED_ROLES = Object.keys(ROLE_MODULES);

// User management is scoped by the admin's AUTHORITY, not the UI entity selector:
// a platform admin manages every user; a company-bound admin only their own
// company's users. (Decoupled from the request's selected company_id.)
const userMgmtScope = (req, col = 'company_id') =>
  req.isPlatformAdmin ? { clause: '', params: [] } : { clause: ` AND ${col} = ?`, params: [req.user.company_id] };
// Only a platform admin may grant the platform-admin role (admin with no company).
const isPlatformGrant = (req, role, companyId) =>
  role === 'admin' && (companyId === null || companyId === undefined);

// GET /api/users — company-bound admins only see their own company's users
router.get('/', authorize('admin'), async (req, res) => {
  try {
    const co = userMgmtScope(req, 'u.company_id');
    const [rows] = await pool.query(`
      SELECT u.id, u.username, u.name, u.email, u.role, u.company_id, u.department_id, u.is_active, u.last_login_at, u.created_at, c.name as company_name, d.name as department_name
      FROM users u
      LEFT JOIN companies c ON u.company_id = c.id
      LEFT JOIN departments d ON u.department_id = d.id
      WHERE 1=1` + co.clause + `
      ORDER BY u.name
    `, co.params);
    res.json(rows);
  } catch (err) {
    console.error('GET /users error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/users/:id — single user (scoped by admin authority)
router.get('/:id', authorize('admin'), async (req, res) => {
  try {
    const co = userMgmtScope(req, 'u.company_id');
    const [[row]] = await pool.query(`
      SELECT u.id, u.username, u.name, u.email, u.role, u.company_id, u.department_id, u.is_active, u.last_login_at, u.created_at,
             c.name as company_name, d.name as department_name
      FROM users u
      LEFT JOIN companies c ON u.company_id = c.id
      LEFT JOIN departments d ON u.department_id = d.id
      WHERE u.id = ?` + co.clause, [req.params.id, ...co.params]);
    if (!row) return res.status(404).json({ error: 'User not found' });
    res.json(row);
  } catch (err) {
    console.error('GET /users/:id error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/users
router.post('/', authorize('admin'), validate({
  username: { required: true, type: 'string', minLen: 3, maxLen: 100 },
  password: { required: true, type: 'string', minLen: 8, maxLen: 200 },
  name: { required: true, type: 'string', minLen: 1, maxLen: 255 },
  email: { type: 'email' },
  role: { type: 'string', enum: ALLOWED_ROLES },
}), async (req, res) => {
  try {
    const { username, password, name, email, role, company_id, department_id } = req.body;
    const newRole = role || 'employee';
    if (!ALLOWED_ROLES.includes(newRole)) {
      return res.status(400).json({ error: 'Invalid role' });
    }
    // A company-bound admin can only create users inside their own company and
    // cannot mint platform admins.
    let targetCompany = company_id || null;
    if (!req.isPlatformAdmin) {
      targetCompany = req.user.company_id;
      if (isPlatformGrant(req, newRole, targetCompany)) {
        return res.status(403).json({ error: 'Cannot grant platform admin role' });
      }
    }
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const [result] = await pool.query('INSERT INTO users SET ?', {
      username, password_hash: passwordHash, name, email, role: newRole,
      company_id: targetCompany, department_id: department_id || null
    });
    await addAudit(pool, req.user, 'Users', 'Created', `User "${username}" created with role "${newRole}"`);
    res.status(201).json({ id: result.insertId, username, name, role: newRole });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Username already exists' });
    console.error('POST /users error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/users/:id — whitelist fields; prevent privilege escalation & re-tenanting
router.put('/:id', authorize('admin'), async (req, res) => {
  try {
    const targetId = parseInt(req.params.id);

    // Resolve target user within the caller's scope (company-bound admins only their company)
    const co = userMgmtScope(req, 'company_id');
    const [[target]] = await pool.query('SELECT id, role, company_id FROM users WHERE id = ?' + co.clause, [targetId, ...co.params]);
    if (!target) return res.status(404).json({ error: 'User not found' });

    // Only allow specific fields to be updated (no direct password_hash / arbitrary columns)
    const { password, name, email, role, department_id } = req.body;
    const data = {};
    if (name !== undefined) data.name = name;
    if (email !== undefined) data.email = email;
    if (department_id !== undefined) data.department_id = department_id || null;

    if (role !== undefined) {
      if (!ALLOWED_ROLES.includes(role)) return res.status(400).json({ error: 'Invalid role' });
      // Prevent users from changing their own role (anti lock-out / escalation)
      if (targetId === req.user.id && role !== target.role) {
        return res.status(403).json({ error: 'Cannot change your own role' });
      }
      // Company-bound admins cannot escalate anyone to platform admin
      if (!req.isPlatformAdmin && isPlatformGrant(req, role, target.company_id)) {
        return res.status(403).json({ error: 'Cannot grant platform admin role' });
      }
      data.role = role;
    }

    if (password) {
      data.password_hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    }

    if (!Object.keys(data).length) return res.status(400).json({ error: 'No updatable fields provided' });

    await pool.query('UPDATE users SET ? WHERE id = ?', [data, targetId]);
    const changed = Object.keys(data).filter((k) => k !== 'password_hash').join(', ');
    await addAudit(pool, req.user, 'Users', 'Updated', `User #${targetId} updated (${changed || 'password'})`);
    res.json({ success: true });
  } catch (err) {
    console.error('PUT /users/:id error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/users/:id/password — reset a user's password (scoped by admin authority)
router.put('/:id/password', authorize('admin'), async (req, res) => {
  try {
    const { password } = req.body || {};
    if (!password || String(password).length < 8) {
      return res.status(422).json({ error: 'Password must be at least 8 characters' });
    }
    const co = userMgmtScope(req, 'company_id');
    const [[target]] = await pool.query('SELECT id FROM users WHERE id = ?' + co.clause, [req.params.id, ...co.params]);
    if (!target) return res.status(404).json({ error: 'User not found' });
    const password_hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [password_hash, req.params.id]);
    await addAudit(pool, req.user, 'Users', 'Password Reset', `Password reset for user #${req.params.id}`);
    res.json({ success: true });
  } catch (err) {
    console.error('PUT /users/:id/password error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/users/:id/toggle — Enable/disable (company-scoped)
router.patch('/:id/toggle', authorize('admin'), async (req, res) => {
  try {
    // Self-protection
    if (parseInt(req.params.id) === req.user.id) {
      return res.status(400).json({ error: 'Cannot disable your own account' });
    }
    const co = userMgmtScope(req, 'company_id');
    const [users] = await pool.query('SELECT is_active FROM users WHERE id = ?' + co.clause, [req.params.id, ...co.params]);
    if (!users.length) return res.status(404).json({ error: 'User not found' });

    const newStatus = !users[0].is_active;
    await pool.query('UPDATE users SET is_active = ? WHERE id = ?', [newStatus, req.params.id]);
    await addAudit(pool, req.user, 'Users', newStatus ? 'Enabled' : 'Disabled', `User #${req.params.id}`);
    res.json({ success: true, is_active: newStatus });
  } catch (err) {
    console.error('PATCH /users/:id/toggle error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/users/:id (company-scoped)
router.delete('/:id', authorize('admin'), async (req, res) => {
  try {
    if (parseInt(req.params.id) === req.user.id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }
    const co = userMgmtScope(req, 'company_id');
    const [result] = await pool.query('DELETE FROM users WHERE id = ?' + co.clause, [req.params.id, ...co.params]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'User not found' });
    await addAudit(pool, req.user, 'Users', 'Deleted', `User #${req.params.id} deleted`);
    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /users/:id error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/users/:id/impersonate — "Login as" this user.
 *
 * An admin gets a short-lived token that carries the target's identity plus an
 * `imp` claim naming the admin who borrowed it. The claim is what makes this
 * safe to have at all: `addAudit` reads it and files every action under the
 * admin's user id with both names, and `denyImpersonated` refuses the handful
 * of actions that must never happen under a borrowed identity.
 *
 * The guards below exist to stop this becoming a privilege-escalation path:
 *
 *  - Admins cannot be impersonated, by anyone. A company-bound admin borrowing
 *    a platform admin's account would escalate itself out of its own company,
 *    and one admin borrowing another gains nothing they did not already have
 *    while making the trail harder to read.
 *  - The target must be inside the caller's own user-management scope, so a
 *    company-bound admin cannot reach into another company.
 *  - Sessions cannot be chained: you cannot start a new impersonation from
 *    inside one, which would otherwise launder the original identity away.
 *  - 30 minutes, not the usual 24 hours. This is for looking at something
 *    specific, not for working as somebody else all day.
 */
router.post('/:id/impersonate', authorize('admin'), denyImpersonated, async (req, res) => {
  try {
    const targetId = parseInt(req.params.id, 10);
    if (!Number.isInteger(targetId)) return res.status(400).json({ error: 'Invalid user id' });
    if (targetId === req.user.id) return res.status(400).json({ error: 'You are already signed in as yourself' });

    const co = userMgmtScope(req, 'company_id');
    const [[target]] = await pool.query(
      'SELECT id, username, name, email, role, company_id, is_active FROM users WHERE id = ?' + co.clause,
      [targetId, ...co.params]
    );
    if (!target) return res.status(404).json({ error: 'User not found' });
    if (!target.is_active) return res.status(409).json({ error: 'This account is disabled' });
    if (target.role === 'admin') {
      return res.status(403).json({ error: 'Admin accounts cannot be impersonated' });
    }

    const [[me]] = await pool.query('SELECT id, name, username FROM users WHERE id = ?', [req.user.id]);
    const impersonatorName = me?.name || req.user.name || 'admin';

    const token = jwt.sign(
      {
        id: target.id, name: target.name, role: target.role, company_id: target.company_id,
        imp: { by: req.user.id, by_name: impersonatorName },
      },
      process.env.JWT_SECRET,
      { expiresIn: '30m' }
    );

    // Filed under the admin, and deliberately loud: this is the entry someone
    // reviewing the trail later needs to find first.
    await addAudit(pool, { id: req.user.id, name: impersonatorName, company_id: req.user.company_id },
      'Auth', 'Impersonation Started',
      `${impersonatorName} started a "login as" session for "${target.username}" (${target.role})`);

    // Out-of-band notice to the other admins, same reasoning as revealing a
    // stored password: the operator cannot quietly be the only one who knows.
    try {
      await notifyRole(pool, target.company_id, ['admin'], {
        type: 'warning',
        title: 'Someone signed in as another user',
        body: `${impersonatorName} started a "login as" session for ${target.name} (${target.username}).`,
        link: '/audit',
      }, req.user.id);
    } catch { /* notification failure must not block the session */ }

    res.json({
      token,
      user: {
        id: target.id, name: target.name, username: target.username,
        email: target.email, role: target.role, company_id: target.company_id,
      },
      impersonated_by: { id: req.user.id, name: impersonatorName },
      expires_in_minutes: 30,
    });
  } catch (err) {
    console.error('POST /users/:id/impersonate error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
