/**
 * Approval chains: the steps a request goes through before HR's final decision.
 *
 * A chain is configured per process ('leave', 'overtime') and per company, with
 * a group-wide chain (company_id 0) as the fallback. Each step names who
 * approves it: the requester's direct manager, that manager's manager, everyone
 * with a role, or one specific user.
 *
 * When a request starts, the chain is frozen onto it with the approvers resolved
 * at that moment, so editing the chain later — or someone changing manager —
 * does not change a request already under way. A step with nobody to approve it
 * (no manager on record, say) is skipped and says so. The requester never
 * approves their own request: they are removed from every step.
 *
 * The chain comes BEFORE the existing HR approval, which stays exactly as it
 * was (balance, documents, attendance re-check). HR cannot give the final
 * approval while the chain is still running; a rejection anywhere rejects the
 * request. No chain configured means no change at all.
 */
import { notifyUsers } from './notificationService.js';

export const PROCESSES = ['leave', 'overtime', 'expense', 'advance', 'requisition'];
export const STEP_TYPES = ['direct_manager', 'second_manager', 'role', 'user'];
export const STEP_ROLES = ['admin', 'hr_manager', 'accountant'];

/** Validate a steps array from the settings screen. */
export function validateSteps(steps) {
  if (!Array.isArray(steps)) return 'Steps must be a list';
  if (steps.length > 6) return 'A chain can have at most 6 steps';
  for (const s of steps) {
    if (!STEP_TYPES.includes(s?.type)) return 'Unknown step type';
    if (s.type === 'role' && !STEP_ROLES.includes(s.role)) return 'Choose a role for the step';
    if (s.type === 'user' && !Number.isInteger(Number(s.user_id))) return 'Choose a person for the step';
  }
  return null;
}

/**
 * The first step at or after `from` that still has someone to approve it.
 * @param {{approvers:number[], skipped?:boolean}[]} steps
 * @returns {number|null}
 */
export function nextOpenStep(steps, from = 0) {
  for (let i = from; i < steps.length; i++) {
    if (!steps[i].skipped && (steps[i].approvers || []).length) return i;
  }
  return null;
}

/**
 * Freeze a chain for one requester: resolve each step to user ids, drop the
 * requester, and mark steps nobody can approve as skipped.
 * @param {{type:string, role?:string, user_id?:number}[]} chainSteps
 * @param {{direct_manager:number[], second_manager:number[], byRole:Map<string,number[]>, activeUsers:Set<number>}} people
 * @param {number|null} requesterUserId
 */
export function freezeSteps(chainSteps, people, requesterUserId) {
  return chainSteps.map((s) => {
    let ids = [];
    if (s.type === 'direct_manager') ids = people.direct_manager || [];
    else if (s.type === 'second_manager') ids = people.second_manager || [];
    else if (s.type === 'role') ids = people.byRole?.get(s.role) || [];
    else if (s.type === 'user') ids = people.activeUsers?.has(Number(s.user_id)) ? [Number(s.user_id)] : [];
    ids = [...new Set(ids.map(Number))].filter((id) => id !== Number(requesterUserId));
    return {
      type: s.type, role: s.role || null, user_id: s.user_id ? Number(s.user_id) : null,
      approvers: ids, skipped: ids.length === 0,
      skip_reason: ids.length ? null
        : s.type === 'direct_manager' || s.type === 'second_manager' ? 'no_manager' : 'no_approver',
    };
  });
}

// ─── Database side ───────────────────────────────────────────────────────────

const parseSteps = (v) => {
  if (!v) return [];
  if (Array.isArray(v)) return v;
  try { return JSON.parse(v); } catch { return []; }
};

/** The chain for a company and process: its own, else the group-wide one. */
export async function getChain(db, companyId, process) {
  const [rows] = await db.query(
    `SELECT * FROM approval_chains WHERE process = ? AND company_id IN (?, 0) AND active = TRUE
      ORDER BY company_id DESC LIMIT 1`, [process, Number(companyId) || 0]);
  const chain = rows[0];
  if (!chain) return null;
  const steps = parseSteps(chain.steps);
  return steps.length ? { ...chain, steps } : null;
}

async function resolvePeople(db, employeeId, companyId) {
  const [[emp]] = await db.query('SELECT manager_employee_id FROM employees WHERE id = ?', [employeeId]);
  const userOfEmployee = async (eid) => {
    if (!eid) return [];
    const [u] = await db.query('SELECT id FROM users WHERE employee_id = ? AND is_active = TRUE', [eid]);
    return u.map((r) => r.id);
  };
  const direct = await userOfEmployee(emp?.manager_employee_id);
  let second = [];
  if (emp?.manager_employee_id) {
    const [[m]] = await db.query('SELECT manager_employee_id FROM employees WHERE id = ?', [emp.manager_employee_id]);
    second = await userOfEmployee(m?.manager_employee_id);
  }
  // A role step: users with that role in this company, or cross-company users
  // (no company bound), who see every company.
  const [roleRows] = await db.query(
    `SELECT id, role FROM users WHERE is_active = TRUE AND role IN (?) AND (company_id = ? OR company_id IS NULL)`,
    [STEP_ROLES, companyId]);
  const byRole = new Map();
  for (const r of roleRows) {
    if (!byRole.has(r.role)) byRole.set(r.role, []);
    byRole.get(r.role).push(r.id);
  }
  const [active] = await db.query('SELECT id FROM users WHERE is_active = TRUE');
  return { direct_manager: direct, second_manager: second, byRole, activeUsers: new Set(active.map((r) => r.id)) };
}

/**
 * Start the chain for a new request. Returns the approval request id, or null
 * when no chain applies (or every step was skipped) — then HR decides as before.
 */
export async function startApproval(db, { process, entityId, companyId, employeeId, requesterUserId, title, link, notify = true }) {
  const chain = await getChain(db, companyId, process);
  if (!chain) return null;
  const people = await resolvePeople(db, employeeId, companyId);
  const steps = freezeSteps(chain.steps, people, requesterUserId);
  const first = nextOpenStep(steps);
  if (first == null) return null;
  const [r] = await db.query('INSERT INTO approval_requests SET ?', {
    process, entity_id: entityId, company_id: companyId, employee_id: employeeId, status: 'Pending',
    current_step: first, steps: JSON.stringify(steps), chain_id: chain.id, created_by: requesterUserId || null,
  });
  for (let i = 0; i < first; i++) {
    await db.query('INSERT INTO approval_actions SET ?', { request_id: r.insertId, step_index: i, decision: 'Skipped', note: steps[i].skip_reason });
  }
  // Bulk callers (a month of detected overtime) pass notify: false and send one
  // summary per approver instead of one message per record.
  if (notify) {
    await notifyUsers(db, steps[first].approvers, { companyId, type: 'approval', title: title || 'Approval needed', body: null, link: link || '/portal/approvals' });
  }
  return { id: r.insertId, approvers: steps[first].approvers };
}

/**
 * Record one decision on the current step.
 * @returns {Promise<{error?:string, status?:string, final?:boolean, request?:object}>}
 */
export async function actOnApproval(db, { requestId, userId, role, decision, note, title, link }) {
  const [[req]] = await db.query('SELECT * FROM approval_requests WHERE id = ?', [requestId]);
  if (!req) return { error: 'not_found' };
  if (req.status !== 'Pending') return { error: 'closed' };
  const steps = parseSteps(req.steps);
  const step = steps[req.current_step];
  const isApprover = (step?.approvers || []).includes(Number(userId));
  // An admin may decide any step (someone is away, a manager left), but only
  // with a written reason, which is recorded on the action.
  if (!isApprover && !(role === 'admin' && String(note || '').trim().length >= 10)) return { error: 'not_approver' };
  if (decision === 'Rejected' && !String(note || '').trim()) return { error: 'reason_required' };

  await db.query('INSERT INTO approval_actions SET ?', {
    request_id: req.id, step_index: req.current_step, actor_user_id: userId, decision,
    note: note ? String(note).slice(0, 500) : null, on_behalf: isApprover ? 0 : 1,
  });
  if (decision === 'Rejected') {
    await db.query("UPDATE approval_requests SET status = 'Rejected', decided_at = NOW() WHERE id = ?", [req.id]);
    return { status: 'Rejected', final: true, request: req };
  }
  const next = nextOpenStep(steps, req.current_step + 1);
  for (let i = req.current_step + 1; i < (next ?? steps.length); i++) {
    await db.query('INSERT INTO approval_actions SET ?', { request_id: req.id, step_index: i, decision: 'Skipped', note: steps[i].skip_reason });
  }
  if (next == null) {
    await db.query("UPDATE approval_requests SET status = 'Approved', current_step = ?, decided_at = NOW() WHERE id = ?", [steps.length, req.id]);
    return { status: 'Approved', final: true, request: req };
  }
  await db.query('UPDATE approval_requests SET current_step = ? WHERE id = ?', [next, req.id]);
  await notifyUsers(db, steps[next].approvers, { companyId: req.company_id, type: 'approval', title: title || 'Approval needed', body: null, link: link || '/portal/approvals' });
  return { status: 'Pending', final: false, request: req };
}

/** Close a chain when the request itself goes away (cancelled by the employee). */
export async function cancelApproval(db, process, entityId) {
  await db.query("UPDATE approval_requests SET status = 'Cancelled', decided_at = NOW() WHERE process = ? AND entity_id = ? AND status = 'Pending'",
    [process, entityId]);
}

/**
 * For display: each entity's chain, step by step, with names.
 * @returns {Promise<Map<number, object>>} entity id → { id, status, steps:[{label parts, state, approver_names, by_name, at, note}] }
 */
export async function approvalSummaries(db, process, entityIds) {
  const out = new Map();
  if (!entityIds.length) return out;
  const [reqs] = await db.query('SELECT * FROM approval_requests WHERE process = ? AND entity_id IN (?)', [process, entityIds]);
  if (!reqs.length) return out;
  const [acts] = await db.query(
    `SELECT a.*, u.name AS actor_name FROM approval_actions a LEFT JOIN users u ON u.id = a.actor_user_id
      WHERE a.request_id IN (?) ORDER BY a.id`, [reqs.map((r) => r.id)]);
  const userIds = new Set();
  for (const r of reqs) for (const s of parseSteps(r.steps)) for (const id of s.approvers || []) userIds.add(id);
  const names = new Map();
  if (userIds.size) {
    const [us] = await db.query('SELECT id, name FROM users WHERE id IN (?)', [[...userIds]]);
    for (const u of us) names.set(u.id, u.name);
  }
  for (const r of reqs) {
    const steps = parseSteps(r.steps).map((s, i) => {
      const act = [...acts].reverse().find((a) => a.request_id === r.id && a.step_index === i);
      const state = act ? act.decision.toLowerCase()
        : r.status === 'Pending' && i === r.current_step ? 'current'
          : r.status === 'Pending' && i > r.current_step ? 'waiting' : 'not_reached';
      return {
        type: s.type, role: s.role, state,
        approver_names: (s.approvers || []).map((id) => names.get(id)).filter(Boolean),
        by_name: act?.actor_name || null, at: act?.acted_at || null, note: act?.note || null,
        on_behalf: !!act?.on_behalf, skip_reason: s.skip_reason || null,
      };
    });
    out.set(r.entity_id, { id: r.id, status: r.status, current_step: r.current_step, steps });
  }
  return out;
}

/** Requests whose current step this user can decide. */
export async function pendingForUser(db, userId) {
  const [rows] = await db.query("SELECT * FROM approval_requests WHERE status = 'Pending' ORDER BY created_at");
  return rows.filter((r) => (parseSteps(r.steps)[r.current_step]?.approvers || []).includes(Number(userId)));
}
