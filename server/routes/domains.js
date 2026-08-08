/**
 * Domains, hosting and infrastructure ownership — assets PRD Phase 5.
 *
 * The point of the module is `renewal_date` plus a split of accountability:
 * business owner, technical owner, DNS controller, hosting controller and the
 * person who pays are often four different people, and a domain lapses when each
 * of them assumes it was somebody else's renewal.
 */
import { Router } from 'express';
import pool from '../config/db.js';
import { auth } from '../middleware/auth.js';
import { authorize } from '../middleware/rbac.js';
import { addAudit } from '../services/auditService.js';
import { tenantScope, companyClause, resolveWriteCompanyId } from '../middleware/tenant.js';
import { OWNER_SCOPES } from '../config/ownerScopes.js';
import { checkDomainRenewals, RENEWAL_THRESHOLDS } from '../services/domainRenewalService.js';

const router = Router();
router.use(auth, tenantScope);

const ASSET_KINDS = ['Domain', 'Hosting', 'DNS', 'CDN', 'Infrastructure', 'Other'];
const STATUSES = ['Active', 'Pending', 'Expired', 'Transferred', 'Cancelled'];

const FIELDS = [
  'owner_scope', 'platform_id', 'account_or_domain_name', 'domain_name', 'registrar_provider', 'asset_kind',
  'account_owner', 'technical_owner', 'billing_owner', 'dns_control_owner', 'hosting_control_owner',
  'assigned_employee_id', 'renewal_date', 'auto_renew', 'account_status',
  'vault_secret_reference', 'notes',
];
const BOOLS = ['auto_renew'];

const pick = (body) => {
  const out = {};
  for (const f of FIELDS) {
    if (body[f] === undefined) continue;
    let v = body[f];
    if (v === '') v = null;
    if (BOOLS.includes(f)) v = v === true || v === 'true' || v === 1 || v === '1';
    out[f] = v;
  }
  return out;
};

function validate(data) {
  if (data.owner_scope != null && !OWNER_SCOPES.includes(data.owner_scope)) {
    return `owner_scope must be one of: ${OWNER_SCOPES.join(', ')}`;
  }
  if (data.asset_kind != null && !ASSET_KINDS.includes(data.asset_kind)) {
    return `asset_kind must be one of: ${ASSET_KINDS.join(', ')}`;
  }
  if (data.account_status != null && !STATUSES.includes(data.account_status)) {
    return `account_status must be one of: ${STATUSES.join(', ')}`;
  }
  if (data.renewal_date != null && !/^\d{4}-\d{2}-\d{2}$/.test(String(data.renewal_date).slice(0, 10))) {
    return 'renewal_date must be a date (YYYY-MM-DD)';
  }
  return null;
}

// Formatted in SQL: a MySQL DATE read as a JS Date at local midnight loses a day
// when serialised.
const SELECT_BASE = `SELECT d.*, DATE_FORMAT(d.renewal_date, '%Y-%m-%d') AS renewal_date,
        DATEDIFF(d.renewal_date, CURDATE()) AS days_to_renewal,
        pc.name AS registrar_platform_name,
        CONCAT_WS(' ', e.first_name, e.last_name) AS assigned_employee_name
   FROM domain_assets d
   LEFT JOIN platform_catalog pc ON d.platform_id = pc.id
   LEFT JOIN employees e ON d.assigned_employee_id = e.id`;


/**
 * Which company a record belongs in, given its owner scope.
 *
 * RE and MKT name a specific entity, so the record must live under it — setting
 * "Company owner: IST Markets" and leaving the row filed under IST Real Estate
 * means it stays invisible from the IST Markets entity, which is exactly the
 * confusion this resolves. GRP is shared and has no single home, so it stays
 * wherever it was filed.
 *
 * @returns {Promise<number|null>} the company id to use, or null to leave as-is
 */
async function companyForOwnerScope(scope) {
  if (scope !== 'RE' && scope !== 'MKT') return null;
  const needle = scope === 'RE' ? 'real estate' : 'markets';
  const [companies] = await pool.query("SELECT id, name FROM companies WHERE status = 'Active'");
  return companies.find((c) => c.name.toLowerCase().includes(needle))?.id || null;
}

router.get('/options', (req, res) => {
  res.json({ asset_kinds: ASSET_KINDS, statuses: STATUSES, owner_scopes: OWNER_SCOPES, renewal_thresholds: RENEWAL_THRESHOLDS });
});

// GET /api/domains/expiring?days=60 — the watch-list, and the reason for the module
router.get('/expiring', async (req, res) => {
  try {
    const days = Math.max(1, Math.min(365, parseInt(req.query.days) || 60));
    const co = companyClause(req, 'd.company_id');
    const [rows] = await pool.query(
      `${SELECT_BASE} WHERE d.renewal_date IS NOT NULL
         AND d.account_status IN ('Active','Pending')
         AND DATEDIFF(d.renewal_date, CURDATE()) <= ?${co.clause}
       ORDER BY d.renewal_date`, [days, ...co.params]);

    // Accountability gaps: a renewal nobody is named for, and an expiry already past.
    const noBillingOwner = rows.filter((r) => !r.billing_owner);
    const expired = rows.filter((r) => r.days_to_renewal < 0);
    res.json({
      days, rows,
      counts: {
        total: rows.length,
        expired: expired.length,
        within_7: rows.filter((r) => r.days_to_renewal >= 0 && r.days_to_renewal <= 7).length,
        within_30: rows.filter((r) => r.days_to_renewal >= 0 && r.days_to_renewal <= 30).length,
        no_billing_owner: noBillingOwner.length,
        no_auto_renew: rows.filter((r) => !r.auto_renew).length,
      },
    });
  } catch (err) { console.error('GET /domains/expiring error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

// POST /api/domains/run-renewal-check — force the scheduler's pass now
router.post('/run-renewal-check', authorize('admin'), async (req, res) => {
  try {
    const sent = await checkDomainRenewals(pool);
    await addAudit(pool, req.user, 'Domains', 'Renewal Check', `Renewal check run manually: ${sent} alert(s) sent`);
    res.json({ success: true, alerts_sent: sent });
  } catch (err) { console.error('POST /domains/run-renewal-check error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

router.get('/', async (req, res) => {
  try {
    const co = companyClause(req, 'd.company_id');
    let sql = `${SELECT_BASE} WHERE 1=1${co.clause}`;
    const params = [...co.params];
    if (OWNER_SCOPES.includes(req.query.owner_scope)) { sql += ' AND d.owner_scope = ?'; params.push(req.query.owner_scope); }
    if (ASSET_KINDS.includes(req.query.asset_kind)) { sql += ' AND d.asset_kind = ?'; params.push(req.query.asset_kind); }
    if (STATUSES.includes(req.query.account_status)) { sql += ' AND d.account_status = ?'; params.push(req.query.account_status); }
    if (req.query.search) {
      const s = `%${req.query.search}%`;
      sql += ' AND (d.account_or_domain_name LIKE ? OR d.domain_name LIKE ? OR d.registrar_provider LIKE ?)';
      params.push(s, s, s);
    }
    sql += ' ORDER BY d.renewal_date IS NULL, d.renewal_date, d.account_or_domain_name';
    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) { console.error('GET /domains error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

async function getScoped(req, id) {
  const co = companyClause(req, 'company_id');
  const [[row]] = await pool.query(
    `SELECT *, DATE_FORMAT(renewal_date, '%Y-%m-%d') AS renewal_date FROM domain_assets WHERE id = ?` + co.clause,
    [id, ...co.params]);
  return row || null;
}

router.post('/', authorize('admin', 'hr_manager'), async (req, res) => {
  try {
    const data = pick(req.body);
    data.company_id = resolveWriteCompanyId(req, req.body.company_id);
    if (!data.company_id) return res.status(400).json({ error: 'Company is required' });
    if (!data.account_or_domain_name) return res.status(422).json({ error: 'account_or_domain_name is required' });
    const err = validate(data);
    if (err) return res.status(422).json({ error: err });

    // A record owned by a named entity is filed under that entity.
    const scopedCompany = await companyForOwnerScope(data.owner_scope);
    if (scopedCompany) data.company_id = scopedCompany;

    // Take the registrar name from the catalogue rather than asking for it twice.
    if (data.platform_id && !data.registrar_provider) {
      const [[plat]] = await pool.query('SELECT name FROM platform_catalog WHERE id = ?', [data.platform_id]);
      if (plat) data.registrar_provider = plat.name;
    }
    data.created_by = req.user.id;

    const [result] = await pool.query('INSERT INTO domain_assets SET ?', data);
    await addAudit(pool, req.user, 'Domains', 'Created',
      `${data.asset_kind || 'Domain'} "${data.account_or_domain_name}" recorded`
      + (data.renewal_date ? ` — renews ${data.renewal_date}` : ' — no renewal date set'));
    res.status(201).json({ id: result.insertId, ...data });
  } catch (err) { console.error('POST /domains error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

router.put('/:id', authorize('admin', 'hr_manager'), async (req, res) => {
  try {
    const existing = await getScoped(req, req.params.id);
    if (!existing) return res.status(404).json({ error: 'Record not found' });
    const data = pick(req.body);
    if (!Object.keys(data).length) return res.status(400).json({ error: 'Nothing to update' });
    const err = validate(data);
    if (err) return res.status(422).json({ error: err });

    // A new renewal date is a new renewal cycle, so the alert history for the old
    // one must clear or the next expiry passes in silence.
    if (data.renewal_date !== undefined && String(data.renewal_date) !== String(existing.renewal_date)) {
      data.renewal_alert_sent = null;
    }

    // Changing the owner to a named entity moves the record there. Without this
    // the label said IST Markets while the row stayed filed under IST Real
    // Estate, so it never appeared when browsing IST Markets.
    let moved = null;
    if (data.owner_scope && data.owner_scope !== existing.owner_scope) {
      const target = await companyForOwnerScope(data.owner_scope);
      if (target && target !== existing.company_id) { data.company_id = target; moved = target; }
    }

    await pool.query('UPDATE domain_assets SET ? WHERE id = ?', [data, existing.id]);
    await addAudit(pool, req.user, 'Domains', 'Updated',
      `"${existing.account_or_domain_name}" updated`
      + (data.renewal_date !== undefined ? ` — renewal ${existing.renewal_date || 'unset'} → ${data.renewal_date || 'unset'}` : '')
      + (moved ? ` — moved to company #${moved} to match owner ${data.owner_scope}` : ''));
    res.json({ success: true, ...(moved ? { moved_to_company: moved } : {}) });
  } catch (err) { console.error('PUT /domains/:id error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

// Record that the renewal was paid: roll the date forward and clear the alerts.
router.put('/:id/renew', authorize('admin', 'hr_manager'), async (req, res) => {
  try {
    const existing = await getScoped(req, req.params.id);
    if (!existing) return res.status(404).json({ error: 'Record not found' });
    const next = req.body?.renewal_date;
    if (!next || !/^\d{4}-\d{2}-\d{2}$/.test(String(next))) {
      return res.status(422).json({ error: 'Provide the new renewal_date (YYYY-MM-DD)' });
    }
    if (next <= new Date().toISOString().slice(0, 10)) {
      return res.status(422).json({ error: 'The new renewal date must be in the future' });
    }
    await pool.query(
      "UPDATE domain_assets SET renewal_date = ?, renewal_alert_sent = NULL, account_status = 'Active' WHERE id = ?",
      [next, existing.id]);
    await addAudit(pool, req.user, 'Domains', 'Renewed',
      `"${existing.account_or_domain_name}" renewed — next renewal ${next}`);
    res.json({ success: true });
  } catch (err) { console.error('PUT /domains/:id/renew error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

router.delete('/:id', authorize('admin'), async (req, res) => {
  try {
    const existing = await getScoped(req, req.params.id);
    if (!existing) return res.status(404).json({ error: 'Record not found' });
    await pool.query('DELETE FROM domain_assets WHERE id = ?', [existing.id]);
    await addAudit(pool, req.user, 'Domains', 'Deleted', `"${existing.account_or_domain_name}" deleted`);
    res.json({ success: true });
  } catch (err) { console.error('DELETE /domains/:id error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

export default router;
