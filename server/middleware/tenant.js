/**
 * Multi-tenant isolation middleware.
 *
 * The authoritative tenant identity is the JWT `company_id`, NOT a value the
 * client sends in the query string or body. This middleware computes the
 * effective company for the request and exposes helpers so that every query
 * can be scoped consistently.
 *
 *  - Platform admins (`admin`) manage all companies. They MAY narrow to a single
 *    company by passing `company_id` (query or body); otherwise the request spans
 *    all companies (req.companyId === null).
 *  - Every other role is pinned to their own `company_id` from the token. Any
 *    client-supplied `company_id` is ignored.
 *
 * Must run AFTER the `auth` middleware (it relies on req.user).
 */

/**
 * A request is "platform admin" only when the user has the `admin` role AND is
 * not bound to a single company (company_id is null). A company-bound admin is
 * treated as a company-scoped administrator and CANNOT cross tenants.
 * (Until a dedicated super_admin role exists — see audit DB-003.)
 */
export const isPlatformAdmin = (user) =>
  user?.role === 'admin' && (user.company_id === null || user.company_id === undefined);

export const tenantScope = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  if (isPlatformAdmin(req.user)) {
    const requested = req.query.company_id ?? req.body?.company_id;
    req.companyId = requested ? Number(requested) : null; // null = all companies
    req.isPlatformAdmin = true;
  } else {
    if (!req.user.company_id) {
      return res.status(403).json({ error: 'No company context for this user' });
    }
    req.companyId = Number(req.user.company_id);
    req.isPlatformAdmin = false;
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
 * Resolves the company_id to persist when creating a row.
 * Non-admins always write under their own company. Admins use whatever they
 * targeted (or the explicit body value when acting on a specific company).
 * Throws-style guard: returns null if an admin gave no company for a write that needs one.
 */
export const resolveWriteCompanyId = (req, bodyCompanyId) => {
  if (!req.isPlatformAdmin) return req.companyId;
  return bodyCompanyId != null ? Number(bodyCompanyId) : req.companyId;
};
