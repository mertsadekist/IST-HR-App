import { useSelector } from 'react-redux';

/**
 * The company the signed-in person belongs to.
 *
 * An employee is pinned to exactly one by tenantScope, so the loaded list holds
 * theirs; for the other roles this is the company on their account, falling back
 * to the first available. Used to pick the letterhead a portal report is
 * composed onto.
 */
export function useMyCompany() {
  const { user } = useSelector((s) => s.auth);
  const { items: companies } = useSelector((s) => s.companies);
  return companies.find((c) => c.id === user?.company_id) || companies[0] || null;
}
