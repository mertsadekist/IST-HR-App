import { Router } from 'express';
import bcrypt from 'bcryptjs';
import pool from '../config/db.js';
import { auth } from '../middleware/auth.js';
import { authorize } from '../middleware/rbac.js';
import { addAudit } from '../services/auditService.js';
import { tenantScope, companyClause } from '../middleware/tenant.js';
import { validate } from '../middleware/validate.js';

const router = Router();
router.use(auth, tenantScope);

const BCRYPT_ROUNDS = 12;
const ALLOWED_ROLES = ['admin', 'hr_manager', 'recruiter', 'hr_specialist', 'employee'];
// Only a platform admin may grant the platform-admin role (admin with no company).
const isPlatformGrant = (req, role, companyId) =>
  role === 'admin' && (companyId === null || companyId === undefined);

// GET /api/users — company-bound admins only see their own company's users
router.get('/', authorize('admin'), async (req, res) => {
  try {
    const co = companyClause(req, 'u.company_id');
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

// POST /api/users
router.post('/', authorize('admin'), validate({
  username: { required: true, type: 'string', minLen: 3, maxLen: 100 },
  password: { required: true, type: 'string', minLen: 8, maxLen: 200 },
  name: { required: true, type: 'string', minLen: 1, maxLen: 255 },
  email: { type: 'email' },
  role: { type: 'string', enum: ['admin', 'hr_manager', 'recruiter', 'hr_specialist', 'employee'] },
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
      targetCompany = req.companyId;
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
    const co = companyClause(req, 'company_id');
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

// PATCH /api/users/:id/toggle — Enable/disable (company-scoped)
router.patch('/:id/toggle', authorize('admin'), async (req, res) => {
  try {
    // Self-protection
    if (parseInt(req.params.id) === req.user.id) {
      return res.status(400).json({ error: 'Cannot disable your own account' });
    }
    const co = companyClause(req, 'company_id');
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
    const co = companyClause(req, 'company_id');
    const [result] = await pool.query('DELETE FROM users WHERE id = ?' + co.clause, [req.params.id, ...co.params]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'User not found' });
    await addAudit(pool, req.user, 'Users', 'Deleted', `User #${req.params.id} deleted`);
    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /users/:id error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
