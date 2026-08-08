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
 * Which modules each role may reach. '*' means unrestricted, and is what the
 * roles that predate this module carry — tightening them is a separate change
 * with its own blast radius.
 */
export const ROLE_MODULES = Object.freeze({
  admin: '*',
  hr_manager: '*',
  recruiter: '*',
  employee: '*',

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
 */
export const requireModule = (module) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'Authentication required' });
  if (!canAccessModule(req.user.role, module)) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }
  next();
};
