/**
 * In-app notification service. Like auditService, failures never break the
 * calling operation (best-effort). All writes are per-user.
 */

/** Create one notification for a specific user. */
export async function notify(pool, { userId, companyId = null, type = 'info', title, body = null, link = null }) {
  if (!userId || !title) return;
  try {
    await pool.query('INSERT INTO notifications SET ?', {
      user_id: userId, company_id: companyId, type, title,
      body: body ? String(body).slice(0, 800) : null, link,
    });
  } catch (err) {
    console.error('Notification error:', err.message);
  }
}

/** Notify a list of user ids (deduped). */
export async function notifyUsers(pool, userIds, payload) {
  const unique = [...new Set((userIds || []).filter(Boolean))];
  for (const id of unique) await notify(pool, { ...payload, userId: id });
}

/**
 * Notify everyone in a company holding one of the given roles.
 * `excludeUserId` skips the actor so they aren't notified of their own action.
 */
export async function notifyRole(pool, companyId, roles, payload, excludeUserId = null) {
  if (!companyId || !roles?.length) return;
  try {
    const [rows] = await pool.query(
      `SELECT id FROM users WHERE company_id = ? AND is_active = TRUE AND role IN (?)`,
      [companyId, roles]);
    const ids = rows.map((r) => r.id).filter((id) => id !== excludeUserId);
    await notifyUsers(pool, ids, { ...payload, companyId });
  } catch (err) {
    console.error('notifyRole error:', err.message);
  }
}

/** Resolve the user account linked to an employee (for self-service notifications). */
export async function userIdForEmployee(pool, employeeId) {
  if (!employeeId) return null;
  try {
    const [[u]] = await pool.query('SELECT id FROM users WHERE employee_id = ? AND is_active = TRUE LIMIT 1', [employeeId]);
    return u?.id || null;
  } catch { return null; }
}
