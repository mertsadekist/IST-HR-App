/**
 * Reporting lines: who manages whom.
 *
 * employees.manager_employee_id points at the direct manager. Pure helpers here
 * keep the graph honest (nobody can end up managing themselves through a chain)
 * and answer "who is in my team" for the manager's portal page.
 */

/**
 * Would making `managerId` the manager of `employeeId` create a loop?
 * @param {number} employeeId
 * @param {number|null} managerId
 * @param {Map<number, number|null>} managerOf employee id → current manager id
 */
export function wouldCreateCycle(employeeId, managerId, managerOf) {
  if (managerId == null) return false;
  if (Number(managerId) === Number(employeeId)) return true;
  const seen = new Set();
  let cur = Number(managerId);
  while (cur != null && !seen.has(cur)) {
    if (cur === Number(employeeId)) return true;
    seen.add(cur);
    const next = managerOf.get(cur);
    cur = next == null ? null : Number(next);
  }
  return false;
}

/**
 * Everyone below a manager, direct reports first, with their depth.
 * @param {number} rootId
 * @param {{id:number, manager_employee_id:number|null}[]} rows
 * @param {number} [maxDepth]
 * @returns {Map<number, number>} employee id → depth (1 = direct report)
 */
export function teamOf(rootId, rows, maxDepth = 6) {
  const children = new Map();
  for (const r of rows) {
    if (r.manager_employee_id == null) continue;
    const m = Number(r.manager_employee_id);
    if (!children.has(m)) children.set(m, []);
    children.get(m).push(Number(r.id));
  }
  const depth = new Map();
  let frontier = [Number(rootId)];
  for (let d = 1; d <= maxDepth && frontier.length; d++) {
    const next = [];
    for (const id of frontier) {
      for (const c of children.get(id) || []) {
        if (c === Number(rootId) || depth.has(c)) continue;
        depth.set(c, d);
        next.push(c);
      }
    }
    frontier = next;
  }
  return depth;
}

/**
 * Nest people under their managers. Anyone whose manager is not in `rows` (no
 * manager, or a manager outside the selection) becomes a root.
 * @returns {object[]} roots, each with `reports` (recursively), sorted by name
 */
export function buildTree(rows) {
  const byId = new Map(rows.map((r) => [Number(r.id), { ...r, reports: [] }]));
  const roots = [];
  for (const node of byId.values()) {
    const m = node.manager_employee_id == null ? null : Number(node.manager_employee_id);
    if (m != null && byId.has(m) && m !== Number(node.id)) byId.get(m).reports.push(node);
    else roots.push(node);
  }
  const byName = (a, b) => String(a.name || '').localeCompare(String(b.name || ''));
  const sortDeep = (list) => { list.sort(byName); list.forEach((n) => sortDeep(n.reports)); return list; };
  // Managers first among the roots: a tree whose top is a list of loose
  // individual contributors reads upside down.
  return sortDeep(roots).sort((a, b) => b.reports.length - a.reports.length || byName(a, b));
}
