/**
 * Module-level access control.
 *
 * The existing `authorize()` guards each write route by role, which answers
 * "may this role change this record". It does not answer "may this role see
 * this part of the system at all" — read routes carry no role guard, so any
 * authenticated user could read any module their company scope allowed.
 *
 * That gap matters the moment a role is defined by what it must NOT see. The
 * accountant is the first such role: they run payroll and manage assets,
 * domains and company paperwork, and they have no business in the recruitment
 * pipeline. Hiding the sidebar entry is not a permission — the API has to say
 * no.
 *
 * Roles mapped to '*' keep exactly the access they have today. This module is
 * deliberately additive: it exists to constrain roles that declare a module
 * list, not to retro-fit restrictions onto roles that were never scoped.
 * See docs/roles_and_permissions.md for the full matrix and the known gap.
 */

export const MODULES = Object.freeze({
  RECRUITMENT: 'recruitment', // candidates, vacancies, applicants, CV scorer
  HR: 'hr',                   // employees, onboarding, leave, attendance, offboarding
  PAYROLL: 'payroll',         // payroll runs, WPS, payslips, salary reviews
  ASSETS: 'assets',           // inventory, assignments, digital access, social, domains
  COMPLIANCE: 'compliance',   // company documents, legal letters
  ANALYTICS: 'analytics',     // reports, KPI, audit log, email log
  OPERATIONS: 'operations',   // users, settings, companies
  PORTAL: 'portal',           // the signed-in user's own assets and payslips
});

const ALL = Object.values(MODULES);

/**
 * Which modules each role may reach. '*' means unrestricted.
 */
export const ROLE_MODULES = Object.freeze({
  admin: '*',
  hr_manager: '*',

  // Hiring, and nothing else. The pipeline needs two things outside its own
  // module — the department list a vacancy is filed under, and the ATS stage
  // configuration — so `departments` and `settings` accept RECRUITMENT as well.
  // Leave and attendance stay reachable because those routers are self-service:
  // a recruiter is a member of staff too and books their own leave.
  recruiter: [MODULES.RECRUITMENT, MODULES.PORTAL],

  // Self-service only. An employee's own assets, accounts and payslips come
  // from routes/portal.js and the `/payslips/my` endpoint, both of which
  // resolve the employee from the token — nothing here needs the operational
  // modules. Before this list existed the role was '*', which meant an employee
  // account could read every colleague's salary straight from GET /api/employees
  // even though the menu never offered it.
  employee: [MODULES.PORTAL],

  // The accountant runs payroll and owns the company's assets, subscriptions,
  // domains and paperwork. Recruitment and analytics are absent on purpose:
  // candidate records and the reporting suite are not part of that job, and
  // the reports module reaches into the hiring pipeline.
  accountant: [MODULES.PAYROLL, MODULES.ASSETS, MODULES.COMPLIANCE, MODULES.HR, MODULES.PORTAL],
});

/** @returns {boolean} */
export function canAccessModule(role, module) {
  const allowed = ROLE_MODULES[role];
  if (!allowed) return false;        // an unknown role gets nothing
  if (allowed === '*') return true;
  return allowed.includes(module);
}

/** Every module a role can reach — used to describe the role, not to gate. */
export function modulesFor(role) {
  const allowed = ROLE_MODULES[role];
  if (!allowed) return [];
  return allowed === '*' ? [...ALL] : [...allowed];
}

/**
 * Express guard. Mount alongside `auth` so req.user exists:
 *   router.use(auth, tenantScope, requireModule(MODULES.RECRUITMENT));
 *
 * Several modules may be passed, and any one of them grants access. A few
 * routers genuinely serve more than one audience — `/settings` carries both the
 * ATS stage editor and the asset catalogue — and splitting them apart is a
 * bigger change than this guard is worth.
 */
export const requireModule = (...modules) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'Authentication required' });
  if (!modules.some((m) => canAccessModule(req.user.role, m))) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }
  next();
};
