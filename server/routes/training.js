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
import { ensureUploadDir, uploadPath } from '../config/storage.js';
import { notifyRole } from '../services/notificationService.js';
import { DOC_EXPIRY_THRESHOLDS } from '../services/documentExpiryService.js';
import { thresholdFor, alreadyAlerted } from '../services/expiryAlerts.js';
import {
  validateCourse, validateTraining, trainingState, mandatoryGaps, validateSkills,
} from '../services/trainingService.js';

// Training (services/trainingService.js): the course catalogue, each person's
// trainings and certificates, their skills, and who lacks a mandatory course.
const router = Router();
router.use(auth, tenantScope);

const HR = ['admin', 'hr_manager'];
const isHR = (req) => HR.includes(req.user.role);
const ACTIVE = ['Onboarding', 'Active', 'Offboarding'];
const fail = (res, where, err) => { console.error(`${where} error:`, err); res.status(500).json({ error: 'Internal server error' }); };

const EXT = ['.pdf', '.png', '.jpg', '.jpeg', '.webp'];
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, ensureUploadDir('training_certificates')),
    filename: (req, file, cb) => cb(null, `${crypto.randomBytes(12).toString('hex')}${path.extname(file.originalname).toLowerCase()}`),
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = EXT.includes(path.extname(file.originalname).toLowerCase());
    cb(ok ? null : new Error(`Unsupported file type — allowed: ${EXT.join(', ')}`), ok);
  },
});
const acceptFile = (req, res, next) => upload.single('file')(req, res, (err) => {
  if (!err) return next();
  res.status(err.code === 'LIMIT_FILE_SIZE' ? 413 : 422).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'File must be 10 MB or smaller' : (err.message || 'Invalid upload') });
});
const dropFile = (req) => { if (req.file) fs.unlink(req.file.path, () => {}); };

async function todayStr() {
  const [[r]] = await pool.query("SELECT DATE_FORMAT(CURDATE(), '%Y-%m-%d') AS d");
  return r.d;
}
async function myEmployeeId(userId) {
  const [[u]] = await pool.query('SELECT employee_id FROM users WHERE id = ?', [userId]);
  return u?.employee_id || null;
}
/** An employee the caller may see: HR within scope, anyone themselves. */
async function visibleEmployee(req, id) {
  if (isHR(req)) {
    const co = companyClause(req, 'company_id');
    const [[e]] = await pool.query(`SELECT id, company_id FROM employees WHERE id = ?${co.clause}`, [id, ...co.params]);
    return e || null;
  }
  const me = await myEmployeeId(req.user.id);
  if (me !== Number(id)) return null;
  const [[e]] = await pool.query('SELECT id, company_id FROM employees WHERE id = ?', [id]);
  return e || null;
}
/** Courses a company can use: its own and the group-wide ones. */
async function coursesFor(companyIds, { activeOnly = true } = {}) {
  const ids = companyIds.length ? companyIds : [0];
  const [rows] = await pool.query(
    `SELECT * FROM training_courses WHERE (company_id IS NULL OR company_id IN (?))${activeOnly ? ' AND active = TRUE' : ''}
      ORDER BY mandatory DESC, name`, [ids]);
  return rows;
}

// ─── Courses ─────────────────────────────────────────────────────────────────
router.get('/courses', async (req, res) => {
  try {
    let companyIds;
    if (isHR(req)) {
      const co = companyClause(req, 'id');
      const [cs] = await pool.query(`SELECT id FROM companies WHERE 1=1${co.clause}`, co.params);
      companyIds = cs.map((c) => c.id);
    } else {
      const me = await myEmployeeId(req.user.id);
      const [[e]] = me ? await pool.query('SELECT company_id FROM employees WHERE id = ?', [me]) : [[null]];
      companyIds = e ? [e.company_id] : [];
    }
    res.json(await coursesFor(companyIds, { activeOnly: req.query.all !== '1' }));
  } catch (err) { fail(res, 'GET /training/courses', err); }
});

router.post('/courses', authorize(...HR), async (req, res) => {
  try {
    const v = validateCourse(req.body);
    if (v.error) return res.status(422).json({ error: v.error });
    // Group-wide (company_id empty) is the admin's to create.
    const groupWide = !req.body.company_id && req.user.role === 'admin';
    const companyId = groupWide ? null : resolveWriteCompanyId(req, req.body.company_id);
    if (!groupWide && !companyId) return res.status(400).json({ error: 'Choose the company' });
    const [r] = await pool.query('INSERT INTO training_courses SET ?', { ...v.data, company_id: companyId, created_by: req.user.id });
    await addAudit(pool, req.user, 'Training', 'Course Created', `"${v.data.name}"${v.data.mandatory ? ' (mandatory)' : ''}`);
    res.status(201).json({ id: r.insertId });
  } catch (err) { fail(res, 'POST /training/courses', err); }
});

async function editableCourse(req, id) {
  const [[c]] = await pool.query('SELECT * FROM training_courses WHERE id = ?', [id]);
  if (!c) return null;
  if (c.company_id == null) return req.user.role === 'admin' ? c : null;
  const co = companyClause(req, 'id');
  const [[ok]] = await pool.query(`SELECT id FROM companies WHERE id = ?${co.clause}`, [c.company_id, ...co.params]);
  return ok ? c : null;
}

router.put('/courses/:id', authorize(...HR), async (req, res) => {
  try {
    const c = await editableCourse(req, req.params.id);
    if (!c) return res.status(404).json({ error: 'Not found' });
    const v = validateCourse({ ...c, ...req.body });
    if (v.error) return res.status(422).json({ error: v.error });
    const active = req.body.active === undefined ? c.active : (req.body.active ? 1 : 0);
    await pool.query('UPDATE training_courses SET ? WHERE id = ?', [{ ...v.data, active }, c.id]);
    await addAudit(pool, req.user, 'Training', 'Course Updated', `"${v.data.name}"`);
    res.json({ success: true });
  } catch (err) { fail(res, 'PUT /training/courses/:id', err); }
});

router.delete('/courses/:id', authorize('admin'), async (req, res) => {
  try {
    const c = await editableCourse(req, req.params.id);
    if (!c) return res.status(404).json({ error: 'Not found' });
    const [[n]] = await pool.query('SELECT COUNT(*) AS n FROM employee_trainings WHERE course_id = ?', [c.id]);
    if (n.n) return res.status(409).json({ error: 'People have completed this course; retire it instead of deleting' });
    await pool.query('DELETE FROM training_courses WHERE id = ?', [c.id]);
    await addAudit(pool, req.user, 'Training', 'Course Deleted', `"${c.name}"`);
    res.json({ success: true });
  } catch (err) { fail(res, 'DELETE /training/courses/:id', err); }
});

// ─── One person's trainings and skills ───────────────────────────────────────
router.get('/employees/:id', async (req, res) => {
  try {
    const e = await visibleEmployee(req, req.params.id);
    if (!e) return res.status(404).json({ error: 'Not found' });
    const today = await todayStr();
    const [rows] = await pool.query(
      `SELECT t.id, t.course_id, t.result, t.notes, t.file_name, c.name AS course_name, c.provider, c.mandatory,
              DATE_FORMAT(t.completed_on, '%Y-%m-%d') AS completed_on, DATE_FORMAT(t.expires_on, '%Y-%m-%d') AS expires_on
         FROM employee_trainings t JOIN training_courses c ON c.id = t.course_id
        WHERE t.employee_id = ? ORDER BY t.completed_on DESC`, [e.id]);
    const [skills] = await pool.query(
      `SELECT es.skill_id, es.level, s.name, sc.name AS category
         FROM employee_skills es JOIN skills s ON s.id = es.skill_id LEFT JOIN skill_categories sc ON sc.id = s.category_id
        WHERE es.employee_id = ? ORDER BY sc.name, s.name`, [e.id]).catch(() => [[]]);
    const mandatory = (await coursesFor([e.company_id])).filter((c) => c.mandatory);
    res.json({
      trainings: rows.map((r) => ({ ...r, state: trainingState(r.expires_on, today) })),
      gaps: mandatoryGaps(mandatory, rows, today),
      skills,
    });
  } catch (err) { fail(res, 'GET /training/employees/:id', err); }
});

// POST /api/training/employees/:id (multipart: course_id, completed_on, expires_on?, result?, notes?, file?)
router.post('/employees/:id', authorize(...HR), acceptFile, async (req, res) => {
  try {
    const e = await visibleEmployee(req, req.params.id);
    if (!e) { dropFile(req); return res.status(404).json({ error: 'Not found' }); }
    const course = (await coursesFor([e.company_id], { activeOnly: false })).find((c) => c.id === Number(req.body.course_id));
    const v = validateTraining(req.body, course, await todayStr());
    if (v.error) { dropFile(req); return res.status(422).json({ error: v.error }); }
    const [r] = await pool.query('INSERT INTO employee_trainings SET ?', {
      ...v.data, company_id: e.company_id, employee_id: e.id, course_id: course.id, created_by: req.user.id,
      ...(req.file ? { file_name: req.file.originalname, file_type: req.file.mimetype, file_size: req.file.size, storage_key: req.file.filename } : {}),
    });
    await addAudit(pool, req.user, 'Training', 'Recorded', `"${course.name}" for employee #${e.id} on ${v.data.completed_on}`);
    res.status(201).json({ id: r.insertId, expires_on: v.data.expires_on });
  } catch (err) { dropFile(req); fail(res, 'POST /training/employees/:id', err); }
});

router.delete('/records/:id', authorize('admin'), async (req, res) => {
  try {
    const co = companyClause(req, 'company_id');
    const [[t]] = await pool.query(`SELECT * FROM employee_trainings WHERE id = ?${co.clause}`, [req.params.id, ...co.params]);
    if (!t) return res.status(404).json({ error: 'Not found' });
    await pool.query('DELETE FROM employee_trainings WHERE id = ?', [t.id]);
    if (t.storage_key) fs.unlink(uploadPath('training_certificates', t.storage_key), () => {});
    await addAudit(pool, req.user, 'Training', 'Record Deleted', `Training record #${t.id} for employee #${t.employee_id}`);
    res.json({ success: true });
  } catch (err) { fail(res, 'DELETE /training/records/:id', err); }
});

router.get('/records/:id/certificate', async (req, res) => {
  try {
    const [[t]] = await pool.query('SELECT * FROM employee_trainings WHERE id = ?', [req.params.id]);
    if (!t || !t.storage_key || !(await visibleEmployee(req, t.employee_id))) return res.status(404).json({ error: 'Not found' });
    const filePath = uploadPath('training_certificates', t.storage_key);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File missing on disk' });
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.download(filePath, t.file_name || 'certificate');
  } catch (err) { fail(res, 'GET /training/records/:id/certificate', err); }
});

// PUT /api/training/employees/:id/skills { skills: [{ skill_id, level }] } — replaces the list.
router.put('/employees/:id/skills', authorize(...HR), async (req, res) => {
  try {
    const e = await visibleEmployee(req, req.params.id);
    if (!e) return res.status(404).json({ error: 'Not found' });
    const v = validateSkills(req.body?.skills);
    if (v.error) return res.status(422).json({ error: v.error });
    await pool.query('DELETE FROM employee_skills WHERE employee_id = ?', [e.id]);
    for (const s of v.data) {
      await pool.query('INSERT INTO employee_skills SET ?', { employee_id: e.id, skill_id: s.skill_id, level: s.level, updated_by: req.user.id });
    }
    await addAudit(pool, req.user, 'Training', 'Skills Updated', `${v.data.length} skill(s) for employee #${e.id}`);
    res.json({ success: true });
  } catch (err) { fail(res, 'PUT /training/employees/:id/skills', err); }
});

// ─── Compliance overview (HR) ────────────────────────────────────────────────
// GET /api/training/overview — certificates expired or expiring, and who lacks a mandatory course.
router.get('/overview', authorize(...HR), async (req, res) => {
  try {
    const today = await todayStr();
    const co = companyClause(req, 'e.company_id');
    const [emps] = await pool.query(
      `SELECT e.id, e.company_id, TRIM(CONCAT(COALESCE(e.first_name, ''), ' ', COALESCE(e.last_name, ''))) AS name, d.name AS department
         FROM employees e LEFT JOIN departments d ON d.id = e.department_id
        WHERE e.status IN (?) AND e.is_owner = FALSE${co.clause} ORDER BY e.first_name, e.last_name`, [ACTIVE, ...co.params]);
    if (!emps.length) return res.json({ expiring: [], gaps: [], courses: [] });
    const [records] = await pool.query(
      `SELECT t.id, t.employee_id, t.course_id, c.name AS course_name,
              DATE_FORMAT(t.completed_on, '%Y-%m-%d') AS completed_on, DATE_FORMAT(t.expires_on, '%Y-%m-%d') AS expires_on
         FROM employee_trainings t JOIN training_courses c ON c.id = t.course_id WHERE t.employee_id IN (?)`, [emps.map((e) => e.id)]);
    const name = new Map(emps.map((e) => [e.id, e]));
    // Only the latest certificate per person and course matters for expiry.
    const latest = new Map();
    for (const r of records) {
      const k = `${r.employee_id}:${r.course_id}`;
      const cur = latest.get(k);
      if (!cur || (r.expires_on || '9999') > (cur.expires_on || '9999')) latest.set(k, r);
    }
    const expiring = [...latest.values()]
      .map((r) => ({ ...r, state: trainingState(r.expires_on, today), employee_name: name.get(r.employee_id)?.name, department: name.get(r.employee_id)?.department }))
      .filter((r) => r.state === 'expired' || r.state === 'expiring')
      .sort((a, b) => a.expires_on.localeCompare(b.expires_on));
    const courses = await coursesFor([...new Set(emps.map((e) => e.company_id))]);
    const gaps = [];
    for (const e of emps) {
      const mandatory = courses.filter((c) => c.mandatory && (c.company_id == null || c.company_id === e.company_id));
      const g = mandatoryGaps(mandatory, records.filter((r) => r.employee_id === e.id), today);
      if (g.length) gaps.push({ employee_id: e.id, employee_name: e.name, department: e.department, gaps: g });
    }
    res.json({ expiring, gaps, courses: courses.map((c) => ({ id: c.id, name: c.name, mandatory: !!c.mandatory })) });
  } catch (err) { fail(res, 'GET /training/overview', err); }
});

/**
 * Scheduler pass: warn HR before a certificate lapses, once per threshold —
 * only the latest certificate of each person and course.
 */
export async function checkTrainingExpiry(db) {
  const [rows] = await db.query(
    `SELECT t.id, t.company_id, t.expiry_alert_sent, c.name AS course_name,
            DATE_FORMAT(t.expires_on, '%Y-%m-%d') AS expires_on, DATEDIFF(t.expires_on, CURDATE()) AS days_left,
            TRIM(CONCAT(COALESCE(e.first_name, ''), ' ', COALESCE(e.last_name, ''))) AS employee_name
       FROM employee_trainings t JOIN training_courses c ON c.id = t.course_id JOIN employees e ON e.id = t.employee_id
      WHERE t.expires_on IS NOT NULL AND e.status IN (?)
        AND NOT EXISTS (SELECT 1 FROM employee_trainings t2 WHERE t2.employee_id = t.employee_id AND t2.course_id = t.course_id
                          AND (t2.expires_on IS NULL OR t2.expires_on > t.expires_on))`, [ACTIVE]);
  let sent = 0;
  for (const r of rows) {
    const threshold = thresholdFor(r.days_left, DOC_EXPIRY_THRESHOLDS);
    if (!threshold || alreadyAlerted(r.expiry_alert_sent, threshold)) continue;
    const expired = threshold === 'expired';
    await notifyRole(db, r.company_id, HR, {
      type: expired ? 'error' : 'warning',
      title: expired ? `Certificate expired: ${r.course_name} — ${r.employee_name}` : `${r.course_name} certificate of ${r.employee_name} expires in ${r.days_left} day(s)`,
      body: `Expiry: ${r.expires_on}`, link: '/training',
    });
    await db.query('UPDATE employee_trainings SET expiry_alert_sent = ? WHERE id = ?', [threshold, r.id]);
    sent++;
  }
  return sent;
}

export default router;
