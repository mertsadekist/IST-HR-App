/**
 * Company ownership of assets, per the Company Assets & Access PRD.
 *
 *   RE  — used exclusively by IST Real Estate
 *   MKT — used exclusively by IST Markets
 *   GRP — shared corporate resource used by both
 *
 * This sits alongside `company_id`, which cannot express "shared". It is a
 * LABEL for reporting and filtering, not an access restriction: the platform
 * catalogue itself is a shared library that every company can draw on, and
 * `tenantScope` + `companyClause` remain the only thing that decides which
 * records a request may see.
 */
export const OWNER_SCOPES = ['RE', 'MKT', 'GRP'];

export const isOwnerScope = (v) => OWNER_SCOPES.includes(v);
