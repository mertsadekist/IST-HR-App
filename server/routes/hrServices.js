import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import pool from '../config/db.js';
import { auth } from '../middleware/auth.js';
import { authorize } from '../middleware/rbac.js';
import { tenantScope, companyClause, resolveWriteCompanyId } from '../middleware/tenant.js';
import { addAudit } from '../services/auditService.js';
import { notifyUsers } from '../services/notificationService.js';
import { ensureUploadDir, uploadPath } from '../config/storage.js';
import {
  validateAnnouncement, isLive, validatePolicy, nextVersion, ackProgress, validateCase,
} from '../services/hrServicesService.js';

// Announcements, policies to acknowledge, and the disciplinary file
// (services/hrServicesService.js). Everyone reads announcements and policies
// for their company; HR writes them. The disciplinary file is HR's only.
const router = Router();
router.use(auth, tenantScope);

const HR = ['admin', 'hr_manager'];
const isHR = (req) => HR.includes(req.user.role);
const ACTIVE = ['Onboarding', 'Active', 'Offboarding'];
const fail = (res, where, err) => { console.error(`${where} error:`, err); res.status(500).json({ error: 'Internal server error' }); };

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, ensureUploadDir('policies')),
    filename: (req, file, cb) => cb(null, `${crypto.randomBytes(12).toString('hex')}${path.extname(file.originalname).toLowerCase()}`),
  }),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = path.extname(file.originalname).toLowerCase() === '.pdf';
    cb(ok ? null : new Error('Policies are uploaded as PDF'), ok);
  },
});
const acceptFile = (req, res, next) => upload.single('file')(req, res, (err) => {
  if (!err) return next();
  res.status(err.code === 'LIMIT_FILE_SIZE' ? 413 : 422).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'File must be 20 MB or smaller' : (err.message || 'Invalid upload') });
});
const dropFile = (req) => { if (req.file) fs.unlink(req.file.path, () => {}); };

async function todayStr() {
  const [[r]] = await pool.query("SELECT DATE_FORMAT(CURDATE(), '%Y-%m-%d') AS d");
  return r.d;
}
async function me(req) {
  const [[u]] = await pool.query(
    'SELECT u.employee_id, e.company_id FROM users u LEFT JOIN employees e ON e.id = u.employee_id WHERE u.id = ?', [req.user.id]);
  return u || {};
}
/** The companies whose announcements and policies the caller sees. */
async function readerCompanies(req) {
  if (isHR(req)) {
    const co = companyClause(req, 'id');
    const [cs] = await pool.query(`SELECT id FROM companies WHERE 1=1${co.clause}`, co.params);
    return cs.map((c) => c.id);
  }
  const m = await me(req);
  return m.company_id ? [m.company_id] : [];
}
/** Active users of some companies (null = every company), for notifications. */
async function usersOf(companyId) {
  const [rows] = companyId == null
    ? await pool.query('SELECT id FROM users WHERE is_active = TRUE')
    : await pool.query(
      `SELECT u.id FROM users u LEFT JOIN employees e ON e.id = u.employee_id
        WHERE u.is_active = TRUE AND (e.company_id = ? OR u.company_id = ? OR u.company_id IS NULL)`, [companyId, companyId]);
  return rows.map((r) => r.id);
}
/** Group-wide items (company empty) are the admin's to create. */
function writeCompany(req, bodyCompanyId) {
  if (!bodyCompanyId && req.user.role === 'admin') return { companyId: null };
  const companyId = resolveWriteCompanyId(req, bodyCompanyId);
  return companyId ? { companyId } : { error: 'Choose the company' };
}

// ─── Announcements ───────────────────────────────────────────────────────────
router.get('/announcements', async (req, res) => {
  try {
    const companies = await readerCompanies(req);
    const today = await todayStr();
    const [rows] = await pool.query(
      `SELECT a.*, DATE_FORMAT(a.expires_on, '%Y-%m-%d') AS expires_on, c.name AS company_name, u.name AS created_by_name,
              EXISTS (SELECT 1 FROM announcement_reads r WHERE r.announcement_id = a.id AND r.user_id = ?) AS is_read,
              (SELECT COUNT(*) FROM announcement_reads r WHERE r.announcement_id = a.id) AS read_count
         FROM announcements a LEFT JOIN companies c ON c.id = a.company_id LEFT JOIN users u ON u.id = a.created_by
        WHERE (a.company_id IS NULL OR a.company_id IN (?))
        ORDER BY a.published_at IS NULL DESC, a.published_at DESC, a.created_at DESC LIMIT 200`,
      [req.user.id, companies.length ? companies : [0]]);
    const list = rows.map((a) => ({ ...a, is_read: !!a.is_read, live: isLive(a, today) }));
    // Everyone else sees only what is live; HR also sees drafts and expired ones.
    res.json(isHR(req) ? list : list.filter((a) => a.live).map(({ read_count, ...a }) => a));
  } catch (err) { fail(res, 'GET /hr-services/announcements', err); }
});

router.get('/announcements/unread-count', async (req, res) => {
  try {
    const companies = await readerCompanies(req);
    const [[r]] = await pool.query(
      `SELECT COUNT(*) AS n FROM announcements a
        WHERE a.published_at IS NOT NULL AND (a.expires_on IS NULL OR a.expires_on >= CURDATE())
          AND (a.company_id IS NULL OR a.company_id IN (?))
          AND NOT EXISTS (SELECT 1 FROM announcement_reads r WHERE r.announcement_id = a.id AND r.user_id = ?)`,
      [companies.length ? companies : [0], req.user.id]);
    res.json({ unread: r.n });
  } catch (err) { fail(res, 'GET /hr-services/announcements/unread-count', err); }
});

// POST /api/hr-services/announcements { title, body, priority, expires_on, company_id?, publish }
router.post('/announcements', authorize(...HR), async (req, res) => {
  try {
    const v = validateAnnouncement(req.body, await todayStr());
    if (v.error) return res.status(422).json({ error: v.error });
    const w = writeCompany(req, req.body.company_id);
    if (w.error) return res.status(400).json({ error: w.error });
    const publish = !!req.body.publish;
    const [r] = await pool.query('INSERT INTO announcements SET ?', {
      ...v.data, company_id: w.companyId, created_by: req.user.id, published_at: publish ? new Date() : null,
    });
    if (publish) {
      await notifyUsers(pool, (await usersOf(w.companyId)).filter((id) => id !== req.user.id), {
        companyId: w.companyId, type: v.data.priority === 'important' ? 'warning' : 'info', title: v.data.title, body: null, link: '/portal/announcements',
      });
    }
    await addAudit(pool, req.user, 'Announcements', publish ? 'Published' : 'Drafted', `"${v.data.title}"`);
    res.status(201).json({ id: r.insertId });
  } catch (err) { fail(res, 'POST /hr-services/announcements', err); }
});

async function scopedAnnouncement(req, id) {
  const [[a]] = await pool.query('SELECT * FROM announcements WHERE id = ?', [id]);
  if (!a) return null;
  if (a.company_id == null) return req.user.role === 'admin' ? a : null;
  return (await readerCompanies(req)).includes(a.company_id) ? a : null;
}

router.put('/announcements/:id', authorize(...HR), async (req, res) => {
  try {
    const a = await scopedAnnouncement(req, req.params.id);
    if (!a) return res.status(404).json({ error: 'Not found' });
    const v = validateAnnouncement({ ...a, expires_on: a.expires_on ? String(a.expires_on).slice(0, 10) : null, ...req.body }, await todayStr());
    if (v.error) return res.status(422).json({ error: v.error });
    const publishNow = req.body.publish && !a.published_at;
    await pool.query('UPDATE announcements SET ? WHERE id = ?', [{ ...v.data, ...(publishNow ? { published_at: new Date() } : {}) }, a.id]);
    if (publishNow) {
      await notifyUsers(pool, (await usersOf(a.company_id)).filter((id) => id !== req.user.id), {
        companyId: a.company_id, type: v.data.priority === 'important' ? 'warning' : 'info', title: v.data.title, body: null, link: '/portal/announcements',
      });
    }
    await addAudit(pool, req.user, 'Announcements', publishNow ? 'Published' : 'Updated', `"${v.data.title}"`);
    res.json({ success: true });
  } catch (err) { fail(res, 'PUT /hr-services/announcements/:id', err); }
});

router.post('/announcements/:id/read', async (req, res) => {
  try {
    await pool.query('INSERT IGNORE INTO announcement_reads (announcement_id, user_id) VALUES (?, ?)', [req.params.id, req.user.id]);
    res.json({ success: true });
  } catch (err) { fail(res, 'POST /hr-services/announcements/:id/read', err); }
});

router.delete('/announcements/:id', authorize('admin'), async (req, res) => {
  try {
    const a = await scopedAnnouncement(req, req.params.id);
    if (!a) return res.status(404).json({ error: 'Not found' });
    await pool.query('DELETE FROM announcements WHERE id = ?', [a.id]);
    await addAudit(pool, req.user, 'Announcements', 'Deleted', `"${a.title}"`);
    res.json({ success: true });
  } catch (err) { fail(res, 'DELETE /hr-services/announcements/:id', err); }
});

// ─── Policies ────────────────────────────────────────────────────────────────
router.get('/policies', async (req, res) => {
  try {
    const companies = await readerCompanies(req);
    const m = await me(req);
    const [rows] = await pool.query(
      `SELECT p.id, p.company_id, p.title, p.category, p.version, p.requires_ack, p.status, p.published_at, p.file_name,
              DATE_FORMAT(p.ack_due, '%Y-%m-%d') AS ack_due, c.name AS company_name,
              (SELECT DATE_FORMAT(a.acknowledged_at, '%Y-%m-%d') FROM policy_acknowledgements a
                WHERE a.policy_id = p.id AND a.version = p.version AND a.employee_id = ?) AS my_ack
         FROM policies p LEFT JOIN companies c ON c.id = p.company_id
        WHERE (p.company_id IS NULL OR p.company_id IN (?))${isHR(req) ? '' : " AND p.status = 'Published'"}
        ORDER BY FIELD(p.status, 'Published', 'Draft', 'Retired'), p.category, p.title`,
      [m.employee_id || 0, companies.length ? companies : [0]]);
    if (isHR(req) && rows.length) {
      for (const p of rows) {
        if (p.status !== 'Published' || !p.requires_ack) continue;
        const [[t]] = await pool.query(
          `SELECT COUNT(*) AS n FROM employees WHERE status IN (?) AND (? IS NULL OR company_id = ?)${companies.length ? ' AND company_id IN (?)' : ''}`,
          [ACTIVE, p.company_id, p.company_id, ...(companies.length ? [companies] : [])]);
        const [[d]] = await pool.query(
          `SELECT COUNT(*) AS n FROM policy_acknowledgements a JOIN employees e ON e.id = a.employee_id
            WHERE a.policy_id = ? AND a.version = ? AND e.status IN (?)`, [p.id, p.version, ACTIVE]);
        p.progress = ackProgress(d.n, t.n);
      }
    }
    res.json(rows);
  } catch (err) { fail(res, 'GET /hr-services/policies', err); }
});

async function visiblePolicy(req, id) {
  const [[p]] = await pool.query('SELECT * FROM policies WHERE id = ?', [id]);
  if (!p) return null;
  if (!isHR(req) && p.status !== 'Published') return null;
  if (p.company_id == null) return p;
  return (await readerCompanies(req)).includes(p.company_id) ? p : null;
}

router.get('/policies/:id', async (req, res) => {
  try {
    const p = await visiblePolicy(req, req.params.id);
    if (!p) return res.status(404).json({ error: 'Not found' });
    const m = await me(req);
    const [[ack]] = await pool.query(
      "SELECT DATE_FORMAT(acknowledged_at, '%Y-%m-%d %H:%i') AS at FROM policy_acknowledgements WHERE policy_id = ? AND version = ? AND employee_id = ?",
      [p.id, p.version, m.employee_id || 0]);
    const { storage_key, ...out } = p;
    res.json({ ...out, ack_due: p.ack_due ? String(p.ack_due).slice(0, 10) : null, has_file: !!storage_key, my_ack: ack?.at || null });
  } catch (err) { fail(res, 'GET /hr-services/policies/:id', err); }
});

router.get('/policies/:id/file', async (req, res) => {
  try {
    const p = await visiblePolicy(req, req.params.id);
    if (!p || !p.storage_key) return res.status(404).json({ error: 'Not found' });
    const filePath = uploadPath('policies', p.storage_key);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File missing on disk' });
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.download(filePath, p.file_name || 'policy.pdf');
  } catch (err) { fail(res, 'GET /hr-services/policies/:id/file', err); }
});

// POST /api/hr-services/policies (multipart: title, category, body, requires_ack, ack_due, company_id?, file?)
router.post('/policies', authorize(...HR), acceptFile, async (req, res) => {
  try {
    const v = validatePolicy(req.body);
    if (v.error) { dropFile(req); return res.status(422).json({ error: v.error }); }
    if (!v.data.body && !req.file) { dropFile(req); return res.status(422).json({ error: 'Write the policy or attach its PDF' }); }
    const w = writeCompany(req, req.body.company_id);
    if (w.error) { dropFile(req); return res.status(400).json({ error: w.error }); }
    const [r] = await pool.query('INSERT INTO policies SET ?', {
      ...v.data, company_id: w.companyId, created_by: req.user.id,
      ...(req.file ? { file_name: req.file.originalname, file_type: req.file.mimetype, file_size: req.file.size, storage_key: req.file.filename } : {}),
    });
    await addAudit(pool, req.user, 'Policies', 'Drafted', `"${v.data.title}"`);
    res.status(201).json({ id: r.insertId });
  } catch (err) { dropFile(req); fail(res, 'POST /hr-services/policies', err); }
});

// PUT /api/hr-services/policies/:id (multipart) — edit; a published policy stays on its version until republished.
router.put('/policies/:id', authorize(...HR), acceptFile, async (req, res) => {
  try {
    const p = await visiblePolicy(req, req.params.id);
    if (!p || (p.company_id == null && req.user.role !== 'admin')) { dropFile(req); return res.status(404).json({ error: 'Not found' }); }
    const v = validatePolicy({ ...p, ...req.body });
    if (v.error) { dropFile(req); return res.status(422).json({ error: v.error }); }
    await pool.query('UPDATE policies SET ? WHERE id = ?', [{
      ...v.data,
      ...(req.file ? { file_name: req.file.originalname, file_type: req.file.mimetype, file_size: req.file.size, storage_key: req.file.filename } : {}),
    }, p.id]);
    if (req.file && p.storage_key) fs.unlink(uploadPath('policies', p.storage_key), () => {});
    await addAudit(pool, req.user, 'Policies', 'Updated', `"${v.data.title}" (v${p.version})`);
    res.json({ success: true });
  } catch (err) { dropFile(req); fail(res, 'PUT /hr-services/policies/:id', err); }
});

// POST /api/hr-services/policies/:id/publish — v1 the first time, the next version after that.
router.post('/policies/:id/publish', authorize(...HR), async (req, res) => {
  try {
    const p = await visiblePolicy(req, req.params.id);
    if (!p || (p.company_id == null && req.user.role !== 'admin')) return res.status(404).json({ error: 'Not found' });
    const version = nextVersion(p.version, !!p.published_at);
    await pool.query("UPDATE policies SET status = 'Published', version = ?, published_at = NOW() WHERE id = ?", [version, p.id]);
    await notifyUsers(pool, (await usersOf(p.company_id)).filter((id) => id !== req.user.id), {
      companyId: p.company_id, type: 'info',
      title: p.requires_ack ? `Please read and acknowledge: ${p.title}` : `Policy published: ${p.title}`,
      body: version > 1 ? `Version ${version}` : null, link: '/portal/policies',
    });
    await addAudit(pool, req.user, 'Policies', 'Published', `"${p.title}" v${version}`);
    res.json({ success: true, version });
  } catch (err) { fail(res, 'POST /hr-services/policies/:id/publish', err); }
});

router.post('/policies/:id/retire', authorize(...HR), async (req, res) => {
  try {
    const p = await visiblePolicy(req, req.params.id);
    if (!p || (p.company_id == null && req.user.role !== 'admin')) return res.status(404).json({ error: 'Not found' });
    await pool.query("UPDATE policies SET status = 'Retired' WHERE id = ?", [p.id]);
    await addAudit(pool, req.user, 'Policies', 'Retired', `"${p.title}"`);
    res.json({ success: true });
  } catch (err) { fail(res, 'POST /hr-services/policies/:id/retire', err); }
});

// POST /api/hr-services/policies/:id/acknowledge — the signed-in employee, current version.
router.post('/policies/:id/acknowledge', async (req, res) => {
  try {
    const p = await visiblePolicy(req, req.params.id);
    if (!p || p.status !== 'Published') return res.status(404).json({ error: 'Not found' });
    const m = await me(req);
    if (!m.employee_id) return res.status(400).json({ error: 'No employee profile linked to your account' });
    await pool.query('INSERT IGNORE INTO policy_acknowledgements (policy_id, version, employee_id, user_id) VALUES (?, ?, ?, ?)',
      [p.id, p.version, m.employee_id, req.user.id]);
    await addAudit(pool, req.user, 'Policies', 'Acknowledged', `"${p.title}" v${p.version}`);
    res.json({ success: true });
  } catch (err) { fail(res, 'POST /hr-services/policies/:id/acknowledge', err); }
});

// GET /api/hr-services/policies/:id/acknowledgements — who has and has not, current version.
router.get('/policies/:id/acknowledgements', authorize(...HR), async (req, res) => {
  try {
    const p = await visiblePolicy(req, req.params.id);
    if (!p) return res.status(404).json({ error: 'Not found' });
    const companies = await readerCompanies(req);
    const [rows] = await pool.query(
      `SELECT e.id, TRIM(CONCAT(COALESCE(e.first_name,''),' ',COALESCE(e.last_name,''))) AS name, d.name AS department,
              DATE_FORMAT(a.acknowledged_at, '%Y-%m-%d') AS acknowledged_on
         FROM employees e LEFT JOIN departments d ON d.id = e.department_id
         LEFT JOIN policy_acknowledgements a ON a.employee_id = e.id AND a.policy_id = ? AND a.version = ?
        WHERE e.status IN (?) AND (? IS NULL OR e.company_id = ?) AND e.company_id IN (?)
        ORDER BY a.acknowledged_at IS NOT NULL, e.first_name, e.last_name`,
      [p.id, p.version, ACTIVE, p.company_id, p.company_id, companies.length ? companies : [0]]);
    res.json({ version: p.version, people: rows, progress: ackProgress(rows.filter((r) => r.acknowledged_on).length, rows.length) });
  } catch (err) { fail(res, 'GET /hr-services/policies/:id/acknowledgements', err); }
});

// POST /api/hr-services/policies/:id/remind — notify everyone who has not acknowledged yet.
router.post('/policies/:id/remind', authorize(...HR), async (req, res) => {
  try {
    const p = await visiblePolicy(req, req.params.id);
    if (!p || p.status !== 'Published') return res.status(404).json({ error: 'Not found' });
    const companies = await readerCompanies(req);
    const [users] = await pool.query(
      `SELECT u.id FROM users u JOIN employees e ON e.id = u.employee_id
        WHERE u.is_active = TRUE AND e.status IN (?) AND (? IS NULL OR e.company_id = ?) AND e.company_id IN (?)
          AND NOT EXISTS (SELECT 1 FROM policy_acknowledgements a WHERE a.policy_id = ? AND a.version = ? AND a.employee_id = e.id)`,
      [ACTIVE, p.company_id, p.company_id, companies.length ? companies : [0], p.id, p.version]);
    await notifyUsers(pool, users.map((u) => u.id), { companyId: p.company_id, type: 'warning', title: `Reminder: please acknowledge ${p.title}`, body: null, link: '/portal/policies' });
    res.json({ reminded: users.length });
  } catch (err) { fail(res, 'POST /hr-services/policies/:id/remind', err); }
});

// ─── Disciplinary file (HR only) ─────────────────────────────────────────────
router.get('/disciplinary', authorize(...HR), async (req, res) => {
  try {
    const co = companyClause(req, 'dc.company_id');
    let where = `WHERE 1=1${co.clause}`;
    const params = [...co.params];
    if (req.query.employee_id) { where += ' AND dc.employee_id = ?'; params.push(req.query.employee_id); }
    if (req.query.status) { where += ' AND dc.status = ?'; params.push(req.query.status); }
    const [rows] = await pool.query(
      `SELECT dc.*, DATE_FORMAT(dc.incident_date, '%Y-%m-%d') AS incident_date,
              TRIM(CONCAT(COALESCE(e.first_name,''),' ',COALESCE(e.last_name,''))) AS employee_name, d.name AS department,
              u.name AS issued_by_name, gl.letter_type, gl.recipient_name AS letter_recipient
         FROM disciplinary_cases dc JOIN employees e ON e.id = dc.employee_id
         LEFT JOIN departments d ON d.id = e.department_id LEFT JOIN users u ON u.id = dc.issued_by
         LEFT JOIN generated_letters gl ON gl.id = dc.letter_id
        ${where} ORDER BY dc.incident_date DESC, dc.id DESC LIMIT 500`, params);
    res.json(rows);
  } catch (err) { fail(res, 'GET /hr-services/disciplinary', err); }
});

router.post('/disciplinary', authorize(...HR), async (req, res) => {
  try {
    const v = validateCase(req.body, await todayStr());
    if (v.error) return res.status(422).json({ error: v.error });
    const co = companyClause(req, 'company_id');
    const [[e]] = await pool.query(`SELECT id, company_id FROM employees WHERE id = ?${co.clause}`, [v.data.employee_id, ...co.params]);
    if (!e) return res.status(404).json({ error: 'Employee not found' });
    if (v.data.letter_id) {
      const [[l]] = await pool.query('SELECT id FROM generated_letters WHERE id = ? AND company_id = ?', [v.data.letter_id, e.company_id]);
      if (!l) return res.status(422).json({ error: 'That letter is not in this employee’s company' });
    }
    const [r] = await pool.query('INSERT INTO disciplinary_cases SET ?', { ...v.data, company_id: e.company_id, issued_by: req.user.id });
    await addAudit(pool, req.user, 'Disciplinary', 'Recorded', `${v.data.action} (${v.data.category}) for employee #${e.id} on ${v.data.incident_date}`);
    res.status(201).json({ id: r.insertId });
  } catch (err) { fail(res, 'POST /hr-services/disciplinary', err); }
});

router.put('/disciplinary/:id', authorize(...HR), async (req, res) => {
  try {
    const co = companyClause(req, 'company_id');
    const [[c]] = await pool.query(`SELECT * FROM disciplinary_cases WHERE id = ?${co.clause}`, [req.params.id, ...co.params]);
    if (!c) return res.status(404).json({ error: 'Not found' });
    const data = {};
    if (req.body.employee_response !== undefined) data.employee_response = String(req.body.employee_response || '').trim().slice(0, 5000) || null;
    if (req.body.letter_id !== undefined) {
      const id = Number(req.body.letter_id) || null;
      if (id) {
        const [[l]] = await pool.query('SELECT id FROM generated_letters WHERE id = ? AND company_id = ?', [id, c.company_id]);
        if (!l) return res.status(422).json({ error: 'That letter is not in this employee’s company' });
      }
      data.letter_id = id;
    }
    if (req.body.status === 'Closed' && c.status === 'Open') {
      data.status = 'Closed'; data.closed_at = new Date(); data.close_note = String(req.body.close_note || '').trim().slice(0, 500) || null;
    } else if (req.body.status === 'Open' && c.status === 'Closed') {
      data.status = 'Open'; data.closed_at = null;
    }
    if (!Object.keys(data).length) return res.status(400).json({ error: 'Nothing to update' });
    await pool.query('UPDATE disciplinary_cases SET ? WHERE id = ?', [data, c.id]);
    await addAudit(pool, req.user, 'Disciplinary', 'Updated', `Case #${c.id}: ${Object.keys(data).join(', ')}`);
    res.json({ success: true });
  } catch (err) { fail(res, 'PUT /hr-services/disciplinary/:id', err); }
});

router.delete('/disciplinary/:id', authorize('admin'), async (req, res) => {
  try {
    const co = companyClause(req, 'company_id');
    const [[c]] = await pool.query(`SELECT * FROM disciplinary_cases WHERE id = ?${co.clause}`, [req.params.id, ...co.params]);
    if (!c) return res.status(404).json({ error: 'Not found' });
    await pool.query('DELETE FROM disciplinary_cases WHERE id = ?', [c.id]);
    await addAudit(pool, req.user, 'Disciplinary', 'Deleted', `Case #${c.id} (${c.action}) for employee #${c.employee_id}`);
    res.json({ success: true });
  } catch (err) { fail(res, 'DELETE /hr-services/disciplinary/:id', err); }
});

// Letters an HR user may link to a case: the employee's company's, newest first.
router.get('/disciplinary/letters', authorize(...HR), async (req, res) => {
  try {
    const co = companyClause(req, 'company_id');
    const [rows] = await pool.query(
      `SELECT id, letter_type, recipient_name, DATE_FORMAT(generated_at, '%Y-%m-%d') AS generated_on, company_id
         FROM generated_letters WHERE 1=1${co.clause} ORDER BY generated_at DESC LIMIT 300`, co.params);
    res.json(rows);
  } catch (err) { fail(res, 'GET /hr-services/disciplinary/letters', err); }
});

export default router;
