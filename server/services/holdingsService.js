/**
 * Everything one employee holds, across the four asset modules — assets PRD
 * Phase 6 (docs/assets_access_module_plan.md).
 *
 * Until now each module answered only for itself, so "what does this person
 * still have?" meant opening four screens and trusting nobody forgot one. That
 * is precisely the question offboarding has to answer before a final settlement
 * is paid, and the question the PRD's "By employee" report asks for.
 *
 * Two shapes come out of the same query set:
 *   holdings   grouped detail, for the employee profile
 *   clearance  the same records reduced to what is still OUTSTANDING, for the
 *              offboarding return-and-revoke checklist
 */

const OPEN_ASSET_STATUSES = ['Active', 'Pending Return', 'Returned Pending Inspection'];
const OPEN_ACCESS_STATUSES = ['Available', 'Pending Activation', 'Assigned', 'Active', 'Suspended'];
const OPEN_SOCIAL_STATUSES = ['Pending Entry', 'Pending Approval', 'Active', 'Suspended'];

/**
 * @param {import('mysql2/promise').Pool} pool
 * @param {number} employeeId
 * @returns {Promise<{physical: object[], digital: object[], social: object[], domains: object[]}>}
 */
export async function getEmployeeHoldings(pool, employeeId) {
  const [physical] = await pool.query(
    `SELECT a.id, a.name, a.asset_type, a.identifier, a.status, a.owner_scope,
            DATE_FORMAT(a.issued_date, '%Y-%m-%d')   AS issued_date,
            DATE_FORMAT(a.returned_date, '%Y-%m-%d') AS returned_date,
            a.inventory_id, i.asset_code, i.status AS inventory_status,
            i.brand, i.model, i.serial_number,
            pc.name AS platform_name,
            a.secret_tier, a.vault_secret_reference,
            (a.encrypted_password IS NOT NULL) AS has_password
       FROM asset_assignments a
       LEFT JOIN asset_inventory i ON a.inventory_id = i.id
       LEFT JOIN platform_catalog pc ON a.platform_id = pc.id
      WHERE a.employee_id = ?
      ORDER BY FIELD(a.status, 'Active', 'Pending Return', 'Returned Pending Inspection', 'Returned', 'Deactivated', 'Missing'), a.name`,
    [employeeId]);

  const [digital] = await pool.query(
    `SELECT d.id, d.platform_name, d.category, d.account_page_name, d.owner_scope,
            d.access_level, d.access_rank, d.has_admin_access, d.has_owner_access,
            d.seat_type, d.seat_consumes_inventory, d.status,
            DATE_FORMAT(d.assigned_on, '%Y-%m-%d')        AS assigned_on,
            DATE_FORMAT(d.revoked_on, '%Y-%m-%d')         AS revoked_on,
            DATE_FORMAT(d.last_access_review, '%Y-%m-%d') AS last_access_review,
            d.two_factor_enabled, d.vault_secret_reference
       FROM digital_access d
      WHERE d.employee_id = ?
      ORDER BY d.access_rank DESC, d.platform_name`,
    [employeeId]);

  const [social] = await pool.query(
    `SELECT s.id, s.asset_layer, s.access_level, s.access_rank, s.status,
            s.can_manage_billing, s.can_manage_users, s.two_factor_enabled,
            DATE_FORMAT(s.date_granted, '%Y-%m-%d')  AS date_granted,
            DATE_FORMAT(s.removal_date, '%Y-%m-%d')  AS removal_date,
            s.team_member_name, s.team_member_email,
            sa.platform, sa.owner_scope, sa.account_name, sa.id AS social_account_id
       FROM social_access s
       JOIN social_accounts sa ON s.social_account_id = sa.id
      WHERE s.employee_id = ?
      ORDER BY sa.owner_scope, sa.platform, s.asset_layer`,
    [employeeId]);

  // A domain naming this person as the responsible employee is not "held" in
  // the sense of being returnable, but leaving without reassigning it is how a
  // renewal ends up with nobody watching it.
  const [domains] = await pool.query(
    `SELECT id, account_or_domain_name, domain_name, registrar_provider, owner_scope,
            account_status, technical_owner, billing_owner,
            DATE_FORMAT(renewal_date, '%Y-%m-%d') AS renewal_date
       FROM domain_assets
      WHERE assigned_employee_id = ?
      ORDER BY renewal_date`,
    [employeeId]);

  return { physical, digital, social, domains };
}

/**
 * The return-and-revoke checklist: the holdings reduced to what is still open,
 * with the reason each line is outstanding.
 *
 * Deliberately not auto-actioned. Returning a laptop and revoking a Meta admin
 * seat are physical acts someone has to perform and confirm; a system that
 * marks them done on a date is a system that lies about what it has recovered.
 */
export function buildClearance({ physical, digital, social, domains }) {
  const items = [];

  for (const a of physical) {
    if (!OPEN_ASSET_STATUSES.includes(a.status)) continue;
    items.push({
      kind: 'physical',
      id: a.id,
      label: a.name,
      detail: [a.asset_code, [a.brand, a.model].filter(Boolean).join(' '), a.serial_number].filter(Boolean).join(' · ') || null,
      status: a.status,
      // A unit already handed back still blocks clearance until it is inspected,
      // which is the gate business rule 1 asks for.
      action: a.status === 'Returned Pending Inspection' ? 'Awaiting inspection' : 'Collect and inspect',
      owner_scope: a.owner_scope,
    });
  }

  for (const d of digital) {
    if (!OPEN_ACCESS_STATUSES.includes(d.status)) continue;
    items.push({
      kind: 'digital',
      id: d.id,
      label: d.platform_name,
      detail: [d.account_page_name, d.access_level, d.seat_consumes_inventory ? 'paid seat' : null].filter(Boolean).join(' · '),
      status: d.status,
      action: 'Revoke access',
      privileged: !!(d.has_admin_access || d.has_owner_access),
      releases_seat: !!d.seat_consumes_inventory,
      owner_scope: d.owner_scope,
    });
  }

  for (const s of social) {
    if (!OPEN_SOCIAL_STATUSES.includes(s.status)) continue;
    items.push({
      kind: 'social',
      id: s.id,
      label: `${s.platform} — ${s.asset_layer}`,
      detail: [s.account_name, s.access_level, s.can_manage_billing ? 'billing' : null].filter(Boolean).join(' · '),
      status: s.status,
      action: 'Remove from this layer',
      privileged: !!(s.can_manage_billing || s.can_manage_users),
      owner_scope: s.owner_scope,
      social_account_id: s.social_account_id,
    });
  }

  for (const dom of domains) {
    if (dom.account_status === 'Cancelled' || dom.account_status === 'Transferred') continue;
    items.push({
      kind: 'domain',
      id: dom.id,
      label: dom.domain_name || dom.account_or_domain_name,
      detail: [dom.registrar_provider, dom.renewal_date ? `renews ${dom.renewal_date}` : null].filter(Boolean).join(' · '),
      status: dom.account_status,
      action: 'Reassign the responsible employee',
      owner_scope: dom.owner_scope,
    });
  }

  const counts = items.reduce((acc, i) => {
    acc[i.kind] = (acc[i.kind] || 0) + 1;
    if (i.privileged) acc.privileged = (acc.privileged || 0) + 1;
    return acc;
  }, {});

  return {
    items,
    counts: {
      total: items.length,
      physical: counts.physical || 0,
      digital: counts.digital || 0,
      social: counts.social || 0,
      domains: counts.domain || 0,
      privileged: counts.privileged || 0,
      seats_to_reclaim: items.filter((i) => i.releases_seat).length,
    },
    cleared: items.length === 0,
  };
}
