/**
 * Audit logging service — creates immutable audit trail in MySQL.
 *
 * `company_id` is taken from the acting user so the trail can be segregated
 * per tenant. An optional explicit `companyId` overrides it (e.g. when a
 * platform admin acts on a specific company).
 */
export async function addAudit(pool, user, module, action, detail, companyId) {
  try {
    await pool.query('INSERT INTO audit_logs SET ?', {
      user_id: user?.id || null,
      user_name: user?.name || 'System',
      company_id: companyId ?? user?.company_id ?? null,
      module,
      action,
      detail,
    });
  } catch (err) {
    console.error('Audit log error:', err.message);
    // Don't throw — audit failures shouldn't break the main operation
  }
}
