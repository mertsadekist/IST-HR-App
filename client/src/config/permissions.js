/**
 * Client mirror of server/config/permissions.js.
 *
 * The server is the authority — this exists so a denied page redirects instead
 * of rendering a shell that fills with 403 toasts. Never treat it as the
 * security boundary: it ships to the browser and can be edited there.
 *
 * Keep the module lists in step with the server file.
 */

export const MODULES = {
  RECRUITMENT: 'recruitment',
  HR: 'hr',
  PAYROLL: 'payroll',
  ASSETS: 'assets',
  COMPLIANCE: 'compliance',
  ANALYTICS: 'analytics',
  OPERATIONS: 'operations',
  DASHBOARD: 'dashboard',
  PORTAL: 'portal',
};

export const ROLE_MODULES = {
  admin: '*',
  hr_manager: '*',
  recruiter: [MODULES.RECRUITMENT, MODULES.DASHBOARD, MODULES.PORTAL],
  // Self-service only, and that is the whole of it: an employee opens straight
  // into their own assets and accounts. The dashboard is a company overview —
  // headcount, hiring trend, everyone's activity — which is not theirs to read,
  // and with one page left there is nothing for a help centre to navigate.
  employee: [MODULES.PORTAL],
  accountant: [MODULES.PAYROLL, MODULES.ASSETS, MODULES.COMPLIANCE, MODULES.HR, MODULES.DASHBOARD, MODULES.PORTAL],
};

/**
 * Where a role starts, and where it is sent when it lands somewhere it cannot
 * open. Must never return a path the role is denied, or the redirect loops.
 */
export function landingPathFor(role) {
  return canAccessModule(role, MODULES.DASHBOARD) ? '/dashboard' : '/portal/my-assets';
}

/**
 * Route prefixes that belong to a restricted module. First match wins, so a
 * more specific path must come before the prefix that would otherwise swallow
 * it — /settings/catalog is the asset catalogue, not a system setting.
 */
const ROUTE_MODULES = [
  ['/settings/catalog', MODULES.ASSETS],
  ['/dashboard', MODULES.DASHBOARD],
  ['/help', MODULES.DASHBOARD], // the help centre navigates pages an employee has none of
  ['/ats', MODULES.RECRUITMENT],
  ['/candidates', MODULES.RECRUITMENT],
  ['/vacancies', MODULES.RECRUITMENT],
  ['/applicants', MODULES.RECRUITMENT],
  ['/cv-scorer', MODULES.RECRUITMENT],
  ['/reports', MODULES.ANALYTICS],
  ['/audit', MODULES.ANALYTICS],
  ['/kpi', MODULES.ANALYTICS],
  ['/email-log', MODULES.ANALYTICS],
  ['/employees', MODULES.HR],
  ['/onboarding', MODULES.HR],
  ['/quick-offer', MODULES.HR],
  ['/leave', MODULES.HR],
  ['/attendance', MODULES.HR],
  ['/performance', MODULES.HR],
  ['/offboarding', MODULES.HR],
  ['/org-chart', MODULES.HR],
  ['/payroll', MODULES.PAYROLL],
  ['/payroll-runs', MODULES.PAYROLL],
  ['/salary-reviews', MODULES.PAYROLL],
  ['/assets', MODULES.ASSETS],
  ['/inventory', MODULES.ASSETS],
  ['/digital-access', MODULES.ASSETS],
  ['/social-governance', MODULES.ASSETS],
  ['/domains', MODULES.ASSETS],
  ['/legal-letters', MODULES.COMPLIANCE],
  ['/company-docs', MODULES.COMPLIANCE],
  ['/users', MODULES.OPERATIONS],
  ['/settings', MODULES.OPERATIONS],
];

export function canAccessModule(role, module) {
  const allowed = ROLE_MODULES[role];
  if (!allowed) return false;
  if (allowed === '*') return true;
  return allowed.includes(module);
}

/** @returns {boolean} whether this role may open this path at all. */
export function canAccessPath(role, pathname) {
  const hit = ROUTE_MODULES.find(([prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  return hit ? canAccessModule(role, hit[1]) : true;
}
