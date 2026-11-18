import { Router } from 'express';
import pool from '../config/db.js';
import { auth } from '../middleware/auth.js';
import { authorize } from '../middleware/rbac.js';
import { addAudit } from '../services/auditService.js';
import { getAppSetting, setAppSetting } from '../services/appSettings.js';
import {
  ROLE_MODULES, ALL_MODULES, modulesFor, defaultModulesFor, roleOverrides, setRoleOverrides,
} from '../config/permissions.js';

/**
 * Which modules each role may open, editable by an admin (Settings → Roles).
 *
 * This decides what a role can reach at all; what it may change inside a
 * module is still the authorize() list on each write route. The admin role is
 * fixed at everything, so the system can never be locked out of this page.
 */
const router = Router();
router.use(auth);

// GET /api/roles/me — the signed-in user's own modules, for the menu.
router.get('/me', (req, res) => {
  res.json({ role: req.user.role, modules: modulesFor(req.user.role) });
});

// GET /api/roles — every role with its default and current modules.
router.get('/', authorize('admin'), async (req, res) => {
  try {
    const [counts] = await pool.query('SELECT role, COUNT(*) n FROM users GROUP BY role');
    const o = roleOverrides();
    res.json({
      modules: ALL_MODULES,
      roles: Object.keys(ROLE_MODULES).map((role) => ({
        role,
        editable: role !== 'admin',
        defaults: defaultModulesFor(role),
        modules: modulesFor(role),
        customised: !!o[role],
        users: Number(counts.find((c) => c.role === role)?.n || 0),
      })),
    });
  } catch (err) { console.error('GET /roles error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

// PUT /api/roles/:role { modules: string[] | null } — null restores the default.
router.put('/:role', authorize('admin'), async (req, res) => {
  try {
    const { role } = req.params;
    if (!ROLE_MODULES[role]) return res.status(404).json({ error: 'Unknown role' });
    if (role === 'admin') return res.status(422).json({ error: 'The admin role always has every module' });
    const mods = req.body?.modules;
    if (mods !== null && (!Array.isArray(mods) || mods.some((m) => !ALL_MODULES.includes(m)))) {
      return res.status(422).json({ error: 'Choose modules from the list' });
    }
    const before = modulesFor(role);
    const stored = setRoleOverrides(await getAppSetting('role_modules', null));
    if (mods === null) delete stored[role];
    else stored[role] = [...new Set(mods)];
    await setAppSetting('role_modules', JSON.stringify(stored));
    setRoleOverrides(stored);
    const after = modulesFor(role);
    await addAudit(pool, req.user, 'Users', 'Role Permissions',
      `${role}: ${before.join(', ') || '(none)'} → ${after.join(', ') || '(none)'}${mods === null ? ' (default restored)' : ''}`);
    res.json({ role, modules: after, customised: mods !== null });
  } catch (err) { console.error('PUT /roles/:role error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

export default router;
