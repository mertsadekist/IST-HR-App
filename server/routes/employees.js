import { Router } from 'express';
import pool from '../config/db.js';
import { auth } from '../middleware/auth.js';
import { authorize } from '../middleware/rbac.js';
import { addAudit } from '../services/auditService.js';
import { tenantScope, companyClause, resolveWriteCompanyId } from '../middleware/tenant.js';
import { validate } from '../middleware/validate.js';
import bcrypt from 'bcryptjs';
import { parseEmployeeDocument } from '../services/deepseekService.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { extractTextFromFile } from '../services/cvParserService.js';
import { ensureUploadDir, uploadPath } from '../config/storage.js';

const upload = multer({
  dest: ensureUploadDir('employee_docs'),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.doc', '.docx', '.txt', '.png', '.jpg', '.jpeg'];
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, allowed.includes(ext));
  },
});

// Employee profile picture. Stored on the persistent uploads volume so it
// survives redeploys (mirrors the company letterhead upload).
const PHOTO_EXT = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };
const photoUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, ensureUploadDir('employee_photos')),
    filename: (req, file, cb) => cb(null, `emp_${req.params.id}_${Date.now()}.${PHOTO_EXT[file.mimetype] || 'bin'}`),
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (PHOTO_EXT[file.mimetype]) return cb(null, true);
    cb(new Error('Profile photo must be a PNG, JPG, or WEBP image'));
  },
});

const router = Router();
router.use(auth, tenantScope);

// Verifies an employee exists within the caller's company scope; returns the row or null.
async function getScopedEmployee(req, employeeId) {
  const co = companyClause(req, 'company_id');
  const [[emp]] = await pool.query('SELECT * FROM employees WHERE id = ?' + co.clause, [employeeId, ...co.params]);
  return emp || null;
}

// POST /api/employees/parse-document
router.post('/parse-document', auth, authorize('admin', 'hr_manager', 'hr_specialist'), upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const { doc_type } = req.body;
    
    let text = '';
    const ext = path.extname(req.file.originalname).toLowerCase();
    
    // Simple text extraction. For images, we just use a mock text for this demo since we don't have OCR
    if (['.png', '.jpg', '.jpeg'].includes(ext)) {
      text = `This is a mock OCR output for a ${doc_type}. Name: John Doe, Nationality: US, Passport: P1234567, Expiry: 2030-01-01`;
    } else {
      text = await extractTextFromFile(req.file.path, ext);
    }

    const parsedData = await parseEmployeeDocument(text, doc_type || 'Document');
    
    res.json({
      success: true,
      file_path: req.file.filename,
      original_name: req.file.originalname,
      parsed_data: parsedData
    });
  } catch (err) {
    console.error('Parse document error:', err);
    res.status(500).json({ error: 'Failed to parse document' });
  }
});

// POST /api/employees/onboard
router.post('/onboard', authorize('admin', 'hr_manager'), async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const { employee_data, documents, create_user } = req.body;

    // Force the employee (and any created user) into the caller's company scope
    employee_data.company_id = resolveWriteCompanyId(req, employee_data?.company_id);
    if (!employee_data.company_id) {
      await connection.rollback();
      return res.status(400).json({ error: 'Company is required' });
    }

    // 1. Create Employee
    const [empResult] = await connection.query('INSERT INTO employees SET ?', [employee_data]);
    const employeeId = empResult.insertId;

    // 2. Save Documents
    if (documents && documents.length > 0) {
      for (const doc of documents) {
        await connection.query(
          'INSERT INTO employee_documents (employee_id, category, file_name, file_url, parsed_data) VALUES (?, ?, ?, ?, ?)',
          [employeeId, doc.category, doc.original_name, doc.file_path, JSON.stringify(doc.parsed_data || {})]
        );
      }
    }

    // 3. Create User Account if requested
    let userId = null;
    let tempPassword = null;
    if (create_user && employee_data.email) {
      tempPassword = Math.random().toString(36).slice(-8); // Generate random 8 char password
      const passwordHash = await bcrypt.hash(tempPassword, 10);
      
      const username = employee_data.email.split('@')[0] + Math.floor(Math.random() * 100);
      
      const [userResult] = await connection.query(
        'INSERT INTO users (username, password_hash, name, email, role, company_id, department_id, employee_id, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
          username, passwordHash, `${employee_data.first_name} ${employee_data.last_name}`, 
          employee_data.email, 'employee', employee_data.company_id, employee_data.department_id, employeeId, true
        ]
      );
      userId = userResult.insertId;
    }

    await addAudit(connection, req.user, 'Employees', 'Onboarded', `Fully onboarded employee ${employee_data.first_name} ${employee_data.last_name}`);
    await connection.commit();

    res.status(201).json({ 
      success: true, 
      employee_id: employeeId,
      user: userId ? { username: employee_data.email.split('@')[0] + '...', password: tempPassword } : null
    });
  } catch (err) {
    await connection.rollback();
    console.error('Onboard error:', err);
    res.status(500).json({ error: 'Failed to onboard employee' });
  } finally {
    connection.release();
  }
});

// GET /api/employees?status=X&search=X&page=1&limit=25 (scoped to caller's company)
router.get('/', async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 25, 100);
    const offset = (page - 1) * limit;
    const co = companyClause(req, 'e.company_id');
    const coCount = companyClause(req, 'company_id');
    let sql = `SELECT e.*, c.name as company_name, c.short_code, c.color_primary,
               d.name as department_name, jt.title as job_title_name, u.id as user_id, u.username
               FROM employees e
               LEFT JOIN companies c ON e.company_id = c.id
               LEFT JOIN departments d ON e.department_id = d.id
               LEFT JOIN job_titles jt ON e.job_title_id = jt.id
               LEFT JOIN users u ON u.employee_id = e.id WHERE 1=1` + co.clause;
    let countSql = 'SELECT COUNT(*) as total FROM employees WHERE 1=1' + coCount.clause;
    const params = [...co.params], countParams = [...coCount.params];
    if (req.query.status) { sql += ' AND e.status = ?'; params.push(req.query.status); countSql += ' AND status = ?'; countParams.push(req.query.status); }
    if (req.query.search) { const s = `%${req.query.search}%`; sql += ' AND (e.first_name LIKE ? OR e.last_name LIKE ? OR e.email LIKE ?)'; params.push(s,s,s); countSql += ' AND (first_name LIKE ? OR last_name LIKE ? OR email LIKE ?)'; countParams.push(s,s,s); }
    sql += ' ORDER BY e.created_at DESC LIMIT ? OFFSET ?'; params.push(limit, offset);
    const [rows] = await pool.query(sql, params);
    const [[cnt]] = await pool.query(countSql, countParams);
    res.json({ data: rows, total: cnt.total, page, limit, totalPages: Math.ceil(cnt.total / limit) });
  } catch (err) { console.error('GET /employees error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

// GET /api/employees/:id (company-scoped)
router.get('/:id', async (req, res) => {
  try {
    const co = companyClause(req, 'e.company_id');
    const [rows] = await pool.query(`SELECT e.*, c.name as company_name, c.short_code, d.name as department_name, jt.title as job_title_name, u.id as user_id, u.username
      FROM employees e LEFT JOIN companies c ON e.company_id = c.id LEFT JOIN departments d ON e.department_id = d.id LEFT JOIN job_titles jt ON e.job_title_id = jt.id
      LEFT JOIN users u ON u.employee_id = e.id WHERE e.id = ?` + co.clause, [req.params.id, ...co.params]);
    if (!rows.length) return res.status(404).json({ error: 'Employee not found' });
    res.json(rows[0]);
  } catch (err) { console.error('GET /employees/:id error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

// POST /api/employees/:id/create-login — for employees who exist without ever
// getting portal credentials (e.g. onboarded via the Onboarding v2 pipeline,
// which — unlike the quick "Add Employee" wizard — never creates a login).
// Generates a one-time random username/password (same scheme as the wizard's
// optional create_user step) and returns them for HR to hand to the employee.
router.post('/:id/create-login', authorize('admin', 'hr_manager'), async (req, res) => {
  try {
    const emp = await getScopedEmployee(req, req.params.id);
    if (!emp) return res.status(404).json({ error: 'Employee not found' });
    if (!emp.email) return res.status(422).json({ error: 'Employee has no email on file — add one before creating a login' });

    const [[existing]] = await pool.query('SELECT id FROM users WHERE employee_id = ?', [emp.id]);
    if (existing) return res.status(409).json({ error: 'This employee already has a login account' });

    const base = emp.email.split('@')[0].replace(/[^a-zA-Z0-9._-]/g, '');
    let username, userId, tempPassword;
    for (let attempt = 0; attempt < 5 && !userId; attempt++) {
      username = `${base}${Math.floor(Math.random() * 900) + 100}`;
      tempPassword = Math.random().toString(36).slice(-8);
      const passwordHash = await bcrypt.hash(tempPassword, 10);
      try {
        const [r] = await pool.query(
          'INSERT INTO users (username, password_hash, name, email, role, company_id, department_id, employee_id, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [username, passwordHash, `${emp.first_name} ${emp.last_name}`, emp.email, 'employee', emp.company_id, emp.department_id, emp.id, true]
        );
        userId = r.insertId;
      } catch (e) { if (e.code !== 'ER_DUP_ENTRY') throw e; }
    }
    if (!userId) return res.status(500).json({ error: 'Could not generate a unique username, try again' });

    await addAudit(pool, req.user, 'Employees', 'Login Created', `Login account created for employee ${emp.first_name} ${emp.last_name}`);
    res.status(201).json({ user_id: userId, username, password: tempPassword });
  } catch (err) { console.error('POST /employees/:id/create-login error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

// ==================== Profile photo ====================

// Turns multer rejections (wrong type, too large) into a 4xx instead of letting
// them bubble to the generic 500 handler.
const acceptPhoto = (req, res, next) => photoUpload.single('photo')(req, res, (err) => {
  if (!err) return next();
  const tooBig = err.code === 'LIMIT_FILE_SIZE';
  res.status(tooBig ? 413 : 422).json({ error: tooBig ? 'Photo must be 5 MB or smaller' : (err.message || 'Invalid photo upload') });
});

// POST /api/employees/:id/photo — upload/replace the profile picture (scoped).
router.post('/:id/photo', authorize('admin', 'hr_manager'), acceptPhoto, async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'A photo file is required' });
    const emp = await getScopedEmployee(req, req.params.id);
    if (!emp) {
      fs.unlink(req.file.path, () => {});
      return res.status(404).json({ error: 'Employee not found' });
    }
    // Drop the previous file so replaced photos don't accumulate on the volume.
    if (emp.photo_path) fs.unlink(uploadPath('employee_photos', emp.photo_path), () => {});
    const type = PHOTO_EXT[req.file.mimetype];
    await pool.query('UPDATE employees SET photo_path = ?, photo_type = ? WHERE id = ?', [req.file.filename, type, emp.id]);
    await addAudit(pool, req.user, 'Employees', 'Photo Updated', `Profile photo set for ${emp.first_name} ${emp.last_name}`);
    res.json({ success: true, type });
  } catch (err) { console.error('POST /employees/:id/photo error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

// GET /api/employees/:id/photo — stream the photo (any authenticated user in scope).
router.get('/:id/photo', async (req, res) => {
  try {
    const emp = await getScopedEmployee(req, req.params.id);
    if (!emp || !emp.photo_path) return res.status(404).json({ error: 'No photo set' });
    const filePath = uploadPath('employee_photos', emp.photo_path);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Photo file missing on disk' });
    res.type(emp.photo_type === 'png' ? 'image/png' : emp.photo_type === 'webp' ? 'image/webp' : 'image/jpeg');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.sendFile(filePath);
  } catch (err) { console.error('GET /employees/:id/photo error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

// DELETE /api/employees/:id/photo — remove the photo (admin only, scoped).
router.delete('/:id/photo', authorize('admin'), async (req, res) => {
  try {
    const emp = await getScopedEmployee(req, req.params.id);
    if (!emp) return res.status(404).json({ error: 'Employee not found' });
    if (emp.photo_path) fs.unlink(uploadPath('employee_photos', emp.photo_path), () => {});
    await pool.query('UPDATE employees SET photo_path = NULL, photo_type = NULL WHERE id = ?', [emp.id]);
    await addAudit(pool, req.user, 'Employees', 'Photo Removed', `Profile photo removed for ${emp.first_name} ${emp.last_name}`);
    res.json({ success: true });
  } catch (err) { console.error('DELETE /employees/:id/photo error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

// POST /api/employees — Create employee manually
router.post('/', authorize('admin', 'hr_manager'), validate({
  first_name: { required: true, type: 'string', minLen: 1, maxLen: 255 },
  last_name: { required: true, type: 'string', minLen: 1, maxLen: 255 },
  email: { type: 'email' },
  phone: { type: 'phone' },
  start_date: { type: 'date' },
  basic_salary: { type: 'number', min: 0 },
  full_salary: { type: 'number', min: 0 },
  attendance_id: { type: 'string', maxLen: 100 },
}), async (req, res) => {
  try {
    const { first_name, last_name, email, phone, nationality, department_id, job_title_text, start_date, basic_salary, full_salary, attendance_id } = req.body;
    const company_id = resolveWriteCompanyId(req, req.body.company_id);
    if (!first_name || !last_name || !company_id) {
      return res.status(400).json({ error: 'First name, last name and company are required' });
    }
    // Per-company duplicate-email guard (DB-004)
    if (email) {
      const [[dup]] = await pool.query('SELECT id FROM employees WHERE company_id = ? AND email = ?', [company_id, email]);
      if (dup) return res.status(409).json({ error: 'An employee with this email already exists in this company' });
    }
    const [result] = await pool.query('INSERT INTO employees SET ?', {
      first_name, last_name,
      email: email || null,
      phone: phone || null,
      nationality: nationality || null,
      company_id: parseInt(company_id),
      department_id: department_id ? parseInt(department_id) : null,
      job_title_text: job_title_text || null,
      start_date: start_date || new Date(),
      basic_salary: basic_salary || null,
      full_salary: full_salary || null,
      attendance_id: attendance_id || null,
      status: 'Active',
    });
    await addAudit(pool, req.user, 'Employees', 'Created', `Employee ${first_name} ${last_name} created manually`);
    res.status(201).json({ id: result.insertId, success: true });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'An employee with this email already exists in this company' });
    console.error('POST /employees error:', err); res.status(500).json({ error: 'Internal server error' });
  }
});

// Columns an HR user may edit through PUT /employees/:id. Anything else in the
// body (id, company_id, candidate_id, timestamps, …) is ignored rather than
// blindly written — this route previously did `UPDATE employees SET ?` on the
// whole request body.
const EDITABLE_EMPLOYEE_FIELDS = [
  'first_name', 'last_name', 'email', 'phone', 'nationality',
  'department_id', 'job_title_id', 'job_title_text',
  'start_date', 'end_date', 'basic_salary', 'full_salary',
  'attendance_id', 'status', 'labour_contract_status', 'labour_contract_issued_at',
];
const EMPLOYEE_STATUSES = ['Onboarding', 'Active', 'Offboarding', 'Exited'];
const LABOUR_CONTRACT_STATUSES = ['Not Issued', 'Issued'];

// PUT /api/employees/:id (company-scoped; cannot re-tenant)
router.put('/:id', authorize('admin', 'hr_manager'), async (req, res) => {
  try {
    const data = {};
    for (const f of EDITABLE_EMPLOYEE_FIELDS) {
      if (req.body[f] !== undefined) data[f] = req.body[f] === '' ? null : req.body[f];
    }
    if (data.status != null && !EMPLOYEE_STATUSES.includes(data.status)) {
      return res.status(422).json({ error: `status must be one of: ${EMPLOYEE_STATUSES.join(', ')}` });
    }
    if (data.labour_contract_status != null) {
      if (!LABOUR_CONTRACT_STATUSES.includes(data.labour_contract_status)) {
        return res.status(422).json({ error: `labour_contract_status must be one of: ${LABOUR_CONTRACT_STATUSES.join(', ')}` });
      }
      // Keep the issued date consistent with the flag unless one was supplied.
      if (req.body.labour_contract_issued_at === undefined) {
        data.labour_contract_issued_at = data.labour_contract_status === 'Issued'
          ? new Date().toISOString().slice(0, 10)
          : null;
      }
    }
    if (!Object.keys(data).length) return res.status(400).json({ error: 'Nothing to update' });

    const co = companyClause(req, 'company_id');
    const [result] = await pool.query('UPDATE employees SET ? WHERE id = ?' + co.clause, [data, req.params.id, ...co.params]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Employee not found' });
    await addAudit(pool, req.user, 'Employees', 'Updated', `Employee #${req.params.id} updated`);
    res.json({ success: true });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'An employee with this email already exists in this company' });
    console.error('PUT /employees/:id error:', err); res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/employees/:id (company-scoped)
router.delete('/:id', authorize('admin'), async (req, res) => {
  try {
    const emp = await getScopedEmployee(req, req.params.id);
    if (!emp) return res.status(404).json({ error: 'Employee not found' });
    const co = companyClause(req, 'company_id');
    await pool.query('DELETE FROM employees WHERE id = ?' + co.clause, [req.params.id, ...co.params]);
    await addAudit(pool, req.user, 'Employees', 'Deleted', `Employee ${emp.first_name} ${emp.last_name} deleted`);
    res.json({ success: true });
  } catch (err) { console.error('DELETE /employees/:id error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

// GET /api/employees/:id/documents — Retrieve all documents for an employee
router.get('/:id/documents', async (req, res) => {
  try {
    const employeeId = parseInt(req.params.id);

    // The employee must belong to the caller's company
    if (!(await getScopedEmployee(req, employeeId))) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    // RBAC: Employees can only view their own documents
    if (req.user.role === 'employee') {
      const [[dbUser]] = await pool.query('SELECT employee_id FROM users WHERE id = ?', [req.user.id]);
      if (!dbUser || dbUser.employee_id !== employeeId) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    const [rows] = await pool.query(
      'SELECT id, employee_id, category, file_name, file_url, created_at FROM employee_documents WHERE employee_id = ? ORDER BY created_at DESC',
      [employeeId]
    );
    res.json(rows);
  } catch (err) {
    console.error('GET /employees/:id/documents error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/employees/:id/documents — Upload a new document for an employee
router.post('/:id/documents', authorize('admin', 'hr_manager', 'hr_specialist'), upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const employeeId = parseInt(req.params.id);
    const { category } = req.body;

    // The employee must belong to the caller's company
    if (!(await getScopedEmployee(req, employeeId))) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    // Enforce that destination folder exists
    ensureUploadDir('employee_docs');
    
    const [result] = await pool.query(
      'INSERT INTO employee_documents (employee_id, category, file_name, file_url, parsed_data) VALUES (?, ?, ?, ?, ?)',
      [employeeId, category || 'General', req.file.originalname, req.file.filename, '{}']
    );
    
    await addAudit(pool, req.user, 'Employees', 'Document Uploaded', `Uploaded document "${req.file.originalname}" for employee #${employeeId}`);
    res.status(201).json({ id: result.insertId, file_name: req.file.originalname, file_url: req.file.filename, success: true });
  } catch (err) {
    console.error('POST /employees/:id/documents error:', err);
    res.status(500).json({ error: 'Failed to upload document' });
  }
});

// GET /api/employees/:id/documents/:docId/download — Securely download a document
router.get('/:id/documents/:docId/download', async (req, res) => {
  try {
    const employeeId = parseInt(req.params.id);
    const docId = parseInt(req.params.docId);

    // The employee must belong to the caller's company
    if (!(await getScopedEmployee(req, employeeId))) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    const [[doc]] = await pool.query('SELECT * FROM employee_documents WHERE id = ? AND employee_id = ?', [docId, employeeId]);
    if (!doc) return res.status(404).json({ error: 'Document not found' });

    // RBAC: Employees can only view their own documents
    if (req.user.role === 'employee') {
      const [[dbUser]] = await pool.query('SELECT employee_id FROM users WHERE id = ?', [req.user.id]);
      if (!dbUser || dbUser.employee_id !== employeeId) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }
    
    const filePath = uploadPath('employee_docs', doc.file_url);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File does not exist on server disk' });
    }
    
    res.download(filePath, doc.file_name);
  } catch (err) {
    console.error('GET /employees/:id/documents/:docId/download error:', err);
    res.status(500).json({ error: 'Failed to download document' });
  }
});

export default router;
