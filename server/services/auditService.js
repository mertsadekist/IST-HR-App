/**
 * Audit logging service — creates immutable audit trail in MySQL.
 *
 * `company_id` is taken from the acting user so the trail can be segregated
 * per tenant. An optional explicit `companyId` overrides it (e.g. when a
 * platform admin acts on a specific company).
 *
 * An optional `entity` ties the row to the record it is about —
 * { type: 'employee', id, changes: [{ field, from, to }] } — which is what a
 * record's History tab reads (services/historyService.js builds `changes`).
 */
export async function addAudit(pool, user, module, action, detail, companyId, entity) {
  try {
    // Inside a "login as" session the accountable human is the admin who
    // started it, not the account being borrowed. Record the admin's id so the
    // trail leads to a real person, and name both so the entry cannot be read
    // as something the account owner did themselves.
    const imp = user?.imp;
    const row = {
      user_id: (imp ? imp.by : user?.id) || null,
      user_name: imp ? `${imp.by_name} (as ${user?.name || 'unknown'})` : (user?.name || 'System'),
      company_id: companyId ?? user?.company_id ?? null,
      module,
      action,
      detail,
    };
    if (entity?.type && entity.id != null) {
      row.entity_type = entity.type;
      row.entity_id = Number(entity.id);
      if (entity.changes?.length) row.changes = JSON.stringify(entity.changes);
    }
    await pool.query('INSERT INTO audit_logs SET ?', row);
  } catch (err) {
    console.error('Audit log error:', err.message);
    // Don't throw — audit failures shouldn't break the main operation
  }
}
