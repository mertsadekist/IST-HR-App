import { Router } from 'express';
import pool from '../config/db.js';
import { auth, denyImpersonated } from '../middleware/auth.js';
import { decrypt } from '../services/cryptoService.js';
import { decryptSecret } from '../services/envelopeCrypto.js';
import { addAudit } from '../services/auditService.js';
import { teamOf } from '../services/orgService.js';
import { pendingForUser } from '../services/approvalService.js';

const router = Router();

/**
 * Get employee_id from the authenticated user.
 * For admin/hr_manager without employee_id, returns null (they can still view the portal).
 */
async function getEmployeeId(userId) {
  const [[user]] = await pool.query('SELECT employee_id FROM users WHERE id = ?', [userId]);
  return user?.employee_id || null;
}

// GET /api/portal/my-assets — Employee's own assets (hardware + software)
router.get('/my-assets', auth, async (req, res) => {
  try {
    const employeeId = await getEmployeeId(req.user.id);
    
    // If no employee_id linked, return empty array (don't block access)
    if (!employeeId) {
      return res.json([]);
    }

    // Everything that was filled in on the handover form, so the person holding
    // the asset can see exactly what they were given and on what terms. Dates
    // are formatted in SQL: a MySQL DATE read as a JS Date at local midnight
    // loses a day when serialised.
    const [rows] = await pool.query(`
      SELECT a.id, a.name, a.asset_type, a.identifier, a.workspace, a.access_level,
             DATE_FORMAT(a.issued_date, '%Y-%m-%d')     AS issued_date,
             DATE_FORMAT(a.expected_return, '%Y-%m-%d') AS expected_return,
             a.status, a.account_username, a.account_url, a.notes, a.condition_note,
             CASE WHEN a.handover_receipt_file IS NOT NULL THEN TRUE ELSE FALSE END AS has_receipt,
             inv.asset_code, inv.serial_number, inv.brand, inv.model,
             pc.name as platform_name, pc.category_id,
             c.name as company_name, c.short_code,
             CASE WHEN a.encrypted_password IS NOT NULL THEN TRUE ELSE FALSE END as has_password
      FROM asset_assignments a
      LEFT JOIN platform_catalog pc ON a.platform_id = pc.id
      LEFT JOIN asset_inventory inv ON a.inventory_id = inv.id
      LEFT JOIN companies c ON a.company_id = c.id
      WHERE a.employee_id = ? AND a.status = 'Active'
      ORDER BY a.asset_type, a.name
    `, [employeeId]);

    res.json(rows);
  } catch (err) {
    console.error('GET /portal/my-assets error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/portal/my-assets/:id/reveal — Reveal a specific credential password
router.get('/my-assets/:id/reveal', auth, denyImpersonated, async (req, res) => {
  try {
    const employeeId = await getEmployeeId(req.user.id);
    if (!employeeId) return res.status(403).json({ error: 'No employee profile linked' });

    // Ensure the asset belongs to this employee
    const [[asset]] = await pool.query(
      `SELECT id, company_id, encrypted_password, password_iv, password_tag,
              dek_wrapped, dek_wrap_iv, dek_wrap_tag, key_version, aad_context, name
         FROM asset_assignments WHERE id = ? AND employee_id = ?`,
      [req.params.id, employeeId]
    );

    if (!asset) return res.status(404).json({ error: 'Asset not found or access denied' });
    if (!asset.encrypted_password) return res.status(400).json({ error: 'No password stored for this asset' });

    // Reads its own credential, whichever scheme the record is on. A legacy row
    // is left for the admin path to migrate: this route must not rewrite a
    // record on behalf of a self-service user.
    const password = asset.dek_wrapped
      ? decryptSecret({
        ciphertext: asset.encrypted_password, iv: asset.password_iv, tag: asset.password_tag,
        dek_wrapped: asset.dek_wrapped, dek_wrap_iv: asset.dek_wrap_iv, dek_wrap_tag: asset.dek_wrap_tag,
        key_version: asset.key_version, aad_context: asset.aad_context,
      }, asset.aad_context)
      : decrypt(asset.encrypted_password, asset.password_iv, asset.password_tag);

    if (password == null) return res.status(500).json({ error: 'Stored credential could not be decrypted' });

    // Audit log the reveal action
    await addAudit(pool, req.user, 'Portal', 'Password Revealed',
      `Employee viewed password for "${asset.name}"`);

    res.setHeader('Cache-Control', 'no-store, max-age=0');
    res.json({ password });
  } catch (err) {
    console.error('Reveal password error:', err);
    res.status(500).json({ error: 'Failed to reveal password' });
  }
});

// GET /api/portal/my-inventory — Employee's assigned inventory items
router.get('/my-inventory', auth, async (req, res) => {
  try {
    const employeeId = await getEmployeeId(req.user.id);
    
    // If no employee_id linked, return empty array
    if (!employeeId) {
      return res.json([]);
    }

    const [rows] = await pool.query(`
      SELECT a.id, a.name, a.identifier, a.issued_date, a.status,
             inv.asset_code, inv.serial_number, inv.brand, inv.model, inv.barcode_data,
             pc.name as platform_name
      FROM asset_assignments a
      LEFT JOIN asset_inventory inv ON a.inventory_id = inv.id
      LEFT JOIN platform_catalog pc ON a.platform_id = pc.id
      WHERE a.employee_id = ? AND a.status = 'Active' AND a.asset_type = 'Hardware'
      ORDER BY a.issued_date DESC
    `, [employeeId]);

    res.json(rows);
  } catch (err) {
    console.error('GET /portal/my-inventory error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── My team (for anyone who manages people) ─────────────────────────────────
// Whoever has reports — directly or below them — sees their team's attendance
// and leave here. Never their salaries, documents or bank details: a manager
// needs to know who is in, not what they earn.
async function myTeamIds(employeeId) {
  const [rows] = await pool.query(
    `SELECT id, manager_employee_id FROM employees
      WHERE manager_employee_id IS NOT NULL AND status IN ('Onboarding','Active','Offboarding')`);
  return teamOf(employeeId, rows);
}

router.get('/has-team', auth, async (req, res) => {
  try {
    // Approvals waiting for this user: anyone can be an approver (a named person
    // or a role step), team or not.
    const pending = (await pendingForUser(pool, req.user.id).catch(() => [])).length;
    const me = await getEmployeeId(req.user.id);
    if (!me) return res.json({ has_team: false, size: 0, pending_approvals: pending });
    const team = await myTeamIds(me);
    res.json({ has_team: team.size > 0, size: team.size, pending_approvals: pending });
  } catch (err) { console.error('GET /portal/has-team error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

router.get('/my-team', auth, async (req, res) => {
  try {
    const me = await getEmployeeId(req.user.id);
    if (!me) return res.json({ team: [] });
    const depth = await myTeamIds(me);
    if (!depth.size) return res.json({ team: [] });
    const ids = [...depth.keys()];

    const [people] = await pool.query(
      `SELECT e.id, e.manager_employee_id, e.status, e.is_owner,
              TRIM(CONCAT(COALESCE(e.first_name, ''), ' ', COALESCE(e.last_name, ''))) AS name,
              COALESCE(jt.title, e.job_title_text) AS job_title, d.name AS department_name,
              TRIM(CONCAT(COALESCE(m.first_name, ''), ' ', COALESCE(m.last_name, ''))) AS manager_name
         FROM employees e
         LEFT JOIN job_titles jt ON jt.id = e.job_title_id
         LEFT JOIN departments d ON d.id = e.department_id
         LEFT JOIN employees m ON m.id = e.manager_employee_id
        WHERE e.id IN (?)`, [ids]);
    const [today] = await pool.query(
      `SELECT employee_id, status, TIME_FORMAT(check_in, '%H:%i') AS check_in
         FROM attendance WHERE employee_id IN (?) AND work_date = CURDATE()`, [ids]);
    const [month] = await pool.query(
      `SELECT employee_id, SUM(status = 'Present') AS present, SUM(status = 'Late') AS late, SUM(status = 'Absent') AS absent
         FROM attendance
        WHERE employee_id IN (?) AND work_date >= DATE_FORMAT(CURDATE(), '%Y-%m-01') AND work_date < CURDATE()
        GROUP BY employee_id`, [ids]);
    const [leave] = await pool.query(
      `SELECT lr.employee_id, lr.status, lr.days, lt.name AS leave_type,
              DATE_FORMAT(lr.start_date, '%Y-%m-%d') AS start_date, DATE_FORMAT(lr.end_date, '%Y-%m-%d') AS end_date
         FROM leave_requests lr JOIN leave_types lt ON lt.id = lr.leave_type_id
        WHERE lr.employee_id IN (?) AND lr.end_date >= CURDATE()
          AND lr.start_date <= DATE_ADD(CURDATE(), INTERVAL 30 DAY)
          AND lr.status IN ('Pending','Approved')
        ORDER BY lr.start_date`, [ids]);

    const todayBy = new Map(today.map((r) => [r.employee_id, r]));
    const monthBy = new Map(month.map((r) => [r.employee_id, r]));
    // The database's date, not toISOString(): between midnight and 04:00 in Dubai
    // the UTC date is still yesterday.
    const [[{ d: todayIso }]] = await pool.query("SELECT DATE_FORMAT(CURDATE(), '%Y-%m-%d') AS d");
    const team = people.map((p) => {
      const myLeave = leave.filter((l) => l.employee_id === p.id).map((l) => ({ ...l, days: Number(l.days) }));
      const onLeaveToday = myLeave.find((l) => l.status === 'Approved' && l.start_date <= todayIso && l.end_date >= todayIso);
      const m = monthBy.get(p.id);
      return {
        id: p.id, name: p.name, job_title: p.job_title, department_name: p.department_name, status: p.status,
        direct: depth.get(p.id) === 1, manager_name: p.manager_name, attendance_tracked: !p.is_owner,
        today: onLeaveToday ? { state: 'leave', leave_type: onLeaveToday.leave_type }
          : todayBy.get(p.id) ? { state: String(todayBy.get(p.id).status).toLowerCase(), check_in: todayBy.get(p.id).check_in }
            : { state: 'none' },
        month: { present: Number(m?.present || 0), late: Number(m?.late || 0), absent: Number(m?.absent || 0) },
        leave: myLeave,
      };
    }).sort((a, b) => Number(b.direct) - Number(a.direct) || a.name.localeCompare(b.name));
    res.json({ team });
  } catch (err) { console.error('GET /portal/my-team error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

export default router;
