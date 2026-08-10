/**
 * Company-scoping middleware (single organization, multiple companies).
 *
 * This is ONE organization that owns several companies (entities). Internal
 * staff work across ALL of them and switch between entities in the UI, so the
 * effective company for a request is the one the client selected
 * (`company_id` in the query/body) — the role governs *permissions*, not which
 * company's data is visible.
 *
 *  - Internal staff (admin / hr_manager / recruiter): see all companies; the
 *    request is narrowed to the selected entity (`company_id`), or spans all
 *    companies when none is given (req.companyId === null).
 *  - Self-service users (employee): pinned to their own `company_id` from the
 *    token; any client-supplied company_id is ignored.
 *
 * Tenant *management* (creating/archiving companies) remains gated by
 * `isPlatformAdmin` regardless of the above.
 *
 * Must run AFTER the `auth` middleware (it relies on req.user).
 */

// Roles that operate the HR system across every company in the organization.
// The accountant is included because payroll, assets, domains and official
// paperwork are handled for the group, not for one company at a time — the
// modules they may reach are limited in config/permissions.js instead.
const CROSS_COMPANY_ROLES = ['admin', 'hr_manager', 'recruiter', 'accountant'];

/**
 * A request is "platform admin" (may create/archive companies) only when the
 * user has the `admin` role AND is not bound to a single company.
 */
export const isPlatformAdmin = (user) =>
  user?.role === 'admin' && (user.company_id === null || user.company_id === undefined);

export const tenantScope = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  req.isPlatformAdmin = isPlatformAdmin(req.user);

  if (CROSS_COMPANY_ROLES.includes(req.user.role)) {
    const requested = req.query.company_id ?? req.body?.company_id;
    req.companyId = requested ? Number(requested) : null; // null = all companies
    req.crossCompany = true;
  } else {
    if (!req.user.company_id) {
      return res.status(403).json({ error: 'No company context for this user' });
    }
    req.companyId = Number(req.user.company_id);
    req.crossCompany = false;
  }

  next();
};

/**
 * Builds a SQL fragment that scopes a query by company.
 * `column` is always a developer-supplied identifier (never user input).
 * Returns an empty clause for platform-admin-all requests.
 *
 *   const { clause, params } = companyClause(req, 'e.company_id');
 *   sql += clause; params.push(...cParams);
 */
export const companyClause = (req, column = 'company_id') => {
  if (req.companyId == null) return { clause: '', params: [] };
  return { clause: ` AND ${column} = ?`, params: [req.companyId] };
};

/**
 * The empty clause, for a read that is already narrowed to one employee's own
 * records.
 *
 * Self-service reads filter on `employee_id`, which is both necessary and
 * sufficient: the row belongs to that person. Adding the company filter on top
 * does not tighten anything — it can only *hide* the employee's own data when
 * the row's company_id differs from the company on their user account, which
 * happens whenever a record is filed under a different entity (an attendance
 * import run with another company selected, a transfer between companies, a
 * user account left pointing at the old one).
 *
 * That is exactly the bug this replaced: an employee whose user sat in company
 * 2 could see their June and July attendance but not August, because the August
 * rows had been recorded under company 1.
 *
 * Use ONLY where an `employee_id = <the caller's own>` predicate is guaranteed
 * to be applied alongside it.
 */
export const ownRecordsClause = () => ({ clause: '', params: [] });

/**
 * Resolves the company_id to persist when creating a row.
 * Internal staff write under the company they targeted (the selected entity, or
 * an explicit body value). Self-service users always write under their own company.
 */
export const resolveWriteCompanyId = (req, bodyCompanyId) => {
  if (req.crossCompany) return bodyCompanyId != null ? Number(bodyCompanyId) : req.companyId;
  return req.companyId;
};
