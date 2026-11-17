import { Router } from 'express';
import pool from '../config/db.js';
import { auth } from '../middleware/auth.js';
import { authorize } from '../middleware/rbac.js';
import { tenantScope, companyClause } from '../middleware/tenant.js';
import { addAudit } from '../services/auditService.js';
import { isUaeNational } from '../services/employeeDocumentExpiryService.js';
import { isValidUaeIban } from '../services/payrollV2.js';
import {
  sortAttention, lawValueFor, emiratisationStatus, fixedDeadlines, validateLawValue, wpsDates,
} from '../services/complianceService.js';

// Compliance (services/complianceService.js): what needs attention, the
// month's deadlines, and Emiratisation against the target.
const router = Router();
router.use(auth, tenantScope);

const VIEW = ['admin', 'hr_manager', 'accountant'];
const ACTIVE = ['Onboarding', 'Active', 'Offboarding'];
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const fail = (res, where, err) => { console.error(`${where} error:`, err); res.status(500).json({ error: 'Internal server error' }); };
const names = (rows, n = 3) => rows.slice(0, n).map((r) => r.name).filter(Boolean);

async function todayStr() {
  const [[r]] = await pool.query("SELECT DATE_FORMAT(CURDATE(), '%Y-%m-%d') AS d");
  return r.d;
}
/** Run one attention query without letting a missing table sink the rest. */
async function safe(q) {
  try { return await q(); } catch (e) { console.error('attention item failed:', e.message); return null; }
}

// GET /api/compliance/attention — everything overdue or at risk, most urgent first.
router.get('/attention', authorize(...VIEW), async (req, res) => {
  try {
    const today = await todayStr();
    const ce = companyClause(req, 'e.company_id');
    const items = [];
    const push = (key, severity, link, rows) => { if (rows) items.push({ key, severity, link, count: rows.length, examples: names(rows) }); };

    push('docs_expired', 'critical', '/document-radar', await safe(async () => (await pool.query(
      `SELECT DISTINCT e.id, TRIM(CONCAT(COALESCE(e.first_name,''),' ',COALESCE(e.last_name,''))) AS name
         FROM employee_documents d JOIN employees e ON e.id = d.employee_id
        WHERE d.expiry_date < CURDATE() AND e.status IN (?)${ce.clause}`, [ACTIVE, ...ce.params]))[0]));
    push('docs_expiring', 'high', '/document-radar', await safe(async () => (await pool.query(
      `SELECT DISTINCT e.id, TRIM(CONCAT(COALESCE(e.first_name,''),' ',COALESCE(e.last_name,''))) AS name
         FROM employee_documents d JOIN employees e ON e.id = d.employee_id
        WHERE d.expiry_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 30 DAY) AND e.status IN (?)${ce.clause}`, [ACTIVE, ...ce.params]))[0]));
    push('settlements_overdue', 'critical', '/offboarding', await safe(async () => (await pool.query(
      `SELECT o.id, TRIM(CONCAT(COALESCE(e.first_name,''),' ',COALESCE(e.last_name,''))) AS name
         FROM offboarding_records o JOIN employees e ON e.id = o.employee_id
        WHERE o.settlement_status <> 'Paid' AND DATE_ADD(o.last_working_day, INTERVAL 14 DAY) < CURDATE()
          AND COALESCE(o.status, '') <> 'Cancelled'${ce.clause}`, ce.params))[0]));

    // Last month's payroll not yet approved.
    const prev = (() => { const [y, m] = today.slice(0, 7).split('-').map(Number); return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`; })();
    const late = today >= wpsDates(prev).late_from;
    push('payroll_previous', late ? 'critical' : 'high', '/payroll-runs', await safe(async () => {
      const cc = companyClause(req, 'c.id');
      const [rows] = await pool.query(
        `SELECT c.id, c.name, pr.status FROM companies c
           LEFT JOIN payroll_runs pr ON pr.company_id = c.id AND pr.period = ?
          WHERE (pr.id IS NULL OR pr.status NOT IN ('Approved','Paid'))
            AND EXISTS (SELECT 1 FROM employees e WHERE e.company_id = c.id AND e.status = 'Active')${cc.clause}`, [prev, ...cc.params]);
      return rows;
    }));
    push('iban_missing', 'high', '/employees', await safe(async () => {
      const [rows] = await pool.query(
        `SELECT e.id, TRIM(CONCAT(COALESCE(e.first_name,''),' ',COALESCE(e.last_name,''))) AS name, b.iban
           FROM employees e LEFT JOIN employee_bank_details b ON b.employee_id = e.id
          WHERE e.status = 'Active' AND e.is_owner = FALSE${ce.clause}`, ce.params);
      return rows.filter((r) => !r.iban || !isValidUaeIban(r.iban));
    }));
    push('onboarding_overdue', 'high', '/onboarding', await safe(async () => (await pool.query(
      `SELECT s.id, s.label AS name FROM onboarding_visa_steps s JOIN onboarding_records o ON o.id = s.onboarding_id
        WHERE s.due_date < CURDATE() AND s.status NOT IN ('Approved','Completed','Rejected') AND o.status = 'In Progress'
          ${companyClause(req, 's.company_id').clause}`, companyClause(req, 's.company_id').params))[0]));
    push('training_expired', 'high', '/training', await safe(async () => (await pool.query(
      `SELECT DISTINCT e.id, TRIM(CONCAT(COALESCE(e.first_name,''),' ',COALESCE(e.last_name,''))) AS name
         FROM employee_trainings t JOIN employees e ON e.id = t.employee_id
        WHERE t.expires_on < CURDATE() AND e.status IN (?)${ce.clause}
          AND NOT EXISTS (SELECT 1 FROM employee_trainings t2 WHERE t2.employee_id = t.employee_id AND t2.course_id = t.course_id
                            AND (t2.expires_on IS NULL OR t2.expires_on >= CURDATE()))`, [ACTIVE, ...ce.params]))[0]));
    const old = (table, col, statusSql, days, extraJoin = '') => safe(async () => {
      const cc = companyClause(req, `x.company_id`);
      const [rows] = await pool.query(
        `SELECT x.id, TRIM(CONCAT(COALESCE(e.first_name,''),' ',COALESCE(e.last_name,''))) AS name
           FROM ${table} x JOIN employees e ON e.id = x.${col} ${extraJoin}
          WHERE ${statusSql} AND x.created_at < DATE_SUB(NOW(), INTERVAL ${days} DAY)${cc.clause}`, cc.params);
      return rows;
    });
    push('leave_waiting', 'medium', '/leave', await old('leave_requests', 'employee_id', "x.status = 'Pending'", 3));
    push('overtime_waiting', 'medium', '/overtime', await old('overtime_records', 'employee_id', "x.status = 'Pending'", 7));
    push('requests_waiting', 'medium', '/requests', await old('employee_requests', 'employee_id', "x.status IN ('Pending','In Progress')", 5));
    push('approvals_stuck', 'medium', '/settings/approvals', await old('approval_requests', 'employee_id', "x.status = 'Pending'", 3));
    push('payroll_pending_approval', 'medium', '/payroll-runs', await safe(async () => {
      const cc = companyClause(req, 'pr.company_id');
      const [rows] = await pool.query(
        `SELECT pr.id, CONCAT(c.name, ' ', pr.period) AS name FROM payroll_runs pr JOIN companies c ON c.id = pr.company_id
          WHERE pr.status = 'Pending Approval'${cc.clause}`, cc.params);
      return rows;
    }));
    push('reviews_for_hr', 'low', '/reviews', await safe(async () => (await pool.query(
      `SELECT r.id, TRIM(CONCAT(COALESCE(e.first_name,''),' ',COALESCE(e.last_name,''))) AS name
         FROM reviews r JOIN employees e ON e.id = r.employee_id WHERE r.status = 'HR Review'${ce.clause}`, ce.params))[0]));
    push('requisitions_waiting', 'low', '/requisitions', await safe(async () => {
      const cc = companyClause(req, 'jr.company_id');
      return (await pool.query(`SELECT jr.id, jr.title AS name FROM job_requisitions jr WHERE jr.status = 'Pending'${cc.clause}`, cc.params))[0];
    }));
    // Emiratisation shortfall this year.
    const emi = await safe(() => emiratisation(req, Number(today.slice(0, 4))));
    if (emi) push('emiratisation_gap', 'high', '/compliance', emi.companies.filter((c) => c.gap > 0).map((c) => ({ name: c.company_name })));

    res.json({ today, items: sortAttention(items) });
  } catch (err) { fail(res, 'GET /compliance/attention', err); }
});

async function emiratisation(req, year) {
  const [law] = await pool.query('SELECT `key`, year, value, note FROM law_values');
  const cc = companyClause(req, 'c.id');
  const [companies] = await pool.query(`SELECT c.id, c.name FROM companies c WHERE 1=1${cc.clause} ORDER BY c.name`, cc.params);
  const [emps] = companies.length ? await pool.query(
    `SELECT company_id, nationality FROM employees WHERE status = 'Active' AND is_owner = FALSE AND company_id IN (?)`,
    [companies.map((c) => c.id)]) : [[]];
  const target = lawValueFor(law, 'emiratisation_target_percent', year);
  const fine = lawValueFor(law, 'emiratisation_fine_per_year', year);
  const minHeadcount = lawValueFor(law, 'emiratisation_min_headcount', year);
  return {
    year, target_percent: target, fine_per_year: fine, min_headcount: minHeadcount,
    companies: companies.map((c) => {
      const mine = emps.filter((e) => e.company_id === c.id);
      return {
        company_id: c.id, company_name: c.name,
        ...emiratisationStatus({ headcount: mine.length, nationals: mine.filter((e) => isUaeNational(e.nationality)).length, targetPercent: target, finePerYear: fine, minHeadcount }),
      };
    }),
    law: law.map((l) => ({ ...l, value: Number(l.value) })).sort((a, b) => a.key.localeCompare(b.key) || b.year - a.year),
  };
}

// GET /api/compliance/emiratisation?year=
router.get('/emiratisation', authorize(...VIEW), async (req, res) => {
  try {
    const year = Number(req.query.year) || Number((await todayStr()).slice(0, 4));
    res.json(await emiratisation(req, year));
  } catch (err) { fail(res, 'GET /compliance/emiratisation', err); }
});

// PUT /api/compliance/law-values { key, year, value, note } — admin, after checking with MOHRE.
router.put('/law-values', authorize('admin'), async (req, res) => {
  try {
    const v = validateLawValue(req.body);
    if (v.error) return res.status(422).json({ error: v.error });
    await pool.query(
      `INSERT INTO law_values (\`key\`, year, value, note, updated_by) VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE value = VALUES(value), note = VALUES(note), updated_by = VALUES(updated_by)`,
      [v.data.key, v.data.year, v.data.value, v.data.note, req.user.id]);
    await addAudit(pool, req.user, 'Compliance', 'Law Value Set', `${v.data.key} ${v.data.year} = ${v.data.value}${v.data.note ? ` (${v.data.note})` : ''}`);
    res.json({ success: true });
  } catch (err) { fail(res, 'PUT /compliance/law-values', err); }
});

// GET /api/compliance/calendar?month=YYYY-MM — every dated deadline of the month.
router.get('/calendar', authorize(...VIEW), async (req, res) => {
  try {
    const month = MONTH_RE.test(req.query.month || '') ? req.query.month : (await todayStr()).slice(0, 7);
    const from = `${month}-01`;
    const [y, m] = month.split('-').map(Number);
    const to = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
    const ce = companyClause(req, 'e.company_id');
    const events = fixedDeadlines(month).map((d) => ({ ...d, title: null }));
    const add = (kind, rows) => { for (const r of rows || []) events.push({ kind, date: r.d, title: r.title, link: r.link || null }); };

    add('document_expiry', await safe(async () => (await pool.query(
      `SELECT DATE_FORMAT(d.expiry_date, '%Y-%m-%d') AS d,
              CONCAT(COALESCE(d.doc_type, d.category, 'Document'), ' — ', TRIM(CONCAT(COALESCE(e.first_name,''),' ',COALESCE(e.last_name,'')))) AS title,
              '/document-radar' AS link
         FROM employee_documents d JOIN employees e ON e.id = d.employee_id
        WHERE d.expiry_date BETWEEN ? AND ? AND e.status IN (?)${ce.clause}`, [from, to, ACTIVE, ...ce.params]))[0]));
    add('company_document_expiry', await safe(async () => {
      const cc = companyClause(req, 'cd.company_id');
      return (await pool.query(
        `SELECT DATE_FORMAT(cd.expiry_date, '%Y-%m-%d') AS d, CONCAT(cd.category, ' — ', cd.file_name) AS title, '/company-docs' AS link
           FROM company_documents cd WHERE cd.expiry_date BETWEEN ? AND ?${cc.clause}`, [from, to, ...cc.params]))[0];
    }));
    add('training_expiry', await safe(async () => (await pool.query(
      `SELECT DATE_FORMAT(t.expires_on, '%Y-%m-%d') AS d,
              CONCAT(c.name, ' — ', TRIM(CONCAT(COALESCE(e.first_name,''),' ',COALESCE(e.last_name,'')))) AS title, '/training' AS link
         FROM employee_trainings t JOIN training_courses c ON c.id = t.course_id JOIN employees e ON e.id = t.employee_id
        WHERE t.expires_on BETWEEN ? AND ? AND e.status IN (?)${ce.clause}`, [from, to, ACTIVE, ...ce.params]))[0]));
    add('settlement_due', await safe(async () => (await pool.query(
      `SELECT DATE_FORMAT(DATE_ADD(o.last_working_day, INTERVAL 14 DAY), '%Y-%m-%d') AS d,
              TRIM(CONCAT(COALESCE(e.first_name,''),' ',COALESCE(e.last_name,''))) AS title, '/offboarding' AS link
         FROM offboarding_records o JOIN employees e ON e.id = o.employee_id
        WHERE o.settlement_status <> 'Paid' AND DATE_ADD(o.last_working_day, INTERVAL 14 DAY) BETWEEN ? AND ?${ce.clause}`, [from, to, ...ce.params]))[0]));
    add('last_working_day', await safe(async () => (await pool.query(
      `SELECT DATE_FORMAT(o.last_working_day, '%Y-%m-%d') AS d,
              TRIM(CONCAT(COALESCE(e.first_name,''),' ',COALESCE(e.last_name,''))) AS title, '/offboarding' AS link
         FROM offboarding_records o JOIN employees e ON e.id = o.employee_id
        WHERE o.last_working_day BETWEEN ? AND ?${ce.clause}`, [from, to, ...ce.params]))[0]));
    add('holiday', await safe(async () => (await pool.query(
      `SELECT DATE_FORMAT(holiday_date, '%Y-%m-%d') AS d, name_en AS title FROM holidays WHERE holiday_date BETWEEN ? AND ?`, [from, to]))[0]));

    events.sort((a, b) => a.date.localeCompare(b.date));
    res.json({ month, events });
  } catch (err) { fail(res, 'GET /compliance/calendar', err); }
});

export default router;
