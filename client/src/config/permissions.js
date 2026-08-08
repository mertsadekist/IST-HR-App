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
  PORTAL: 'portal',
};

export const ROLE_MODULES = {
  admin: '*',
  hr_manager: '*',
  recruiter: '*',
  employee: '*',
  accountant: [MODULES.PAYROLL, MODULES.ASSETS, MODULES.COMPLIANCE, MODULES.HR, MODULES.PORTAL],
};

/** Route prefixes that belong to a restricted module. Longest match wins. */
const ROUTE_MODULES = [
  ['/ats', MODULES.RECRUITMENT],
  ['/candidates', MODULES.RECRUITMENT],
  ['/vacancies', MODULES.RECRUITMENT],
  ['/applicants', MODULES.RECRUITMENT],
  ['/cv-scorer', MODULES.RECRUITMENT],
  ['/reports', MODULES.ANALYTICS],
  ['/audit', MODULES.ANALYTICS],
  ['/kpi', MODULES.ANALYTICS],
  ['/email-log', MODULES.ANALYTICS],
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
