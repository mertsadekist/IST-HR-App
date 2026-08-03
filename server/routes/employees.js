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
import crypto from 'crypto';
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

// GET /api/employees/:id/history — everything on record for one employee,
// normalized into a single date-sorted timeline for the printable report:
// onboarding milestones, documents received, company assets handed over, and
// leave taken. Each entry is { source, occurred_at, type, description, actor }.
router.get('/:id/history', async (req, res) => {
  try {
    const emp = await getScopedEmployee(req, req.params.id);
    if (!emp) return res.status(404).json({ error: 'Employee not found' });

    // DATE columns are formatted in SQL: mysql2 hands them back as JS Dates at
    // local midnight, so serializing them to ISO would shift them a day back.
    const [[header]] = await pool.query(
      `SELECT e.id, e.first_name, e.last_name, e.email, e.phone, e.nationality,
              DATE_FORMAT(e.start_date, '%Y-%m-%d') AS start_date,
              e.status, e.labour_contract_status,
              DATE_FORMAT(e.labour_contract_issued_at, '%Y-%m-%d') AS labour_contract_issued_at,
              e.job_title_text, c.name AS company_name, d.name AS department_name, jt.title AS job_title_name
       FROM employees e
       LEFT JOIN companies c ON e.company_id = c.id
       LEFT JOIN departments d ON e.department_id = d.id
       LEFT JOIN job_titles jt ON e.job_title_id = jt.id
       WHERE e.id = ?`, [emp.id]);

    // Onboarding milestones (linked through the onboarding record, not the employee).
    const [obEvents] = await pool.query(
      `SELECT ev.event_type, ev.detail, ev.user_name, ev.created_at
       FROM onboarding_events ev
       JOIN onboarding_records r ON r.id = ev.onboarding_id
       WHERE r.employee_id = ? ORDER BY ev.created_at`, [emp.id]);

    const [docs] = await pool.query(
      'SELECT category, file_name, created_at FROM employee_documents WHERE employee_id = ? ORDER BY created_at', [emp.id]);

    // Assets/accounts currently or previously issued to the employee.
    const [assets] = await pool.query(
      `SELECT name, asset_type, identifier, status,
              DATE_FORMAT(issued_date, '%Y-%m-%d') AS issued_date,
              DATE_FORMAT(returned_date, '%Y-%m-%d') AS returned_date
       FROM asset_assignments WHERE employee_id = ? ORDER BY COALESCE(issued_date, created_at)`, [emp.id]);

    // Physical handover trail (equipment/furniture), with who performed it.
    const [assetHistory] = await pool.query(
      `SELECT h.action, DATE_FORMAT(h.action_date, '%Y-%m-%d') AS action_date,
              h.condition_at_action, h.notes, u.name AS actor,
              COALESCE(inv.brand, '') AS brand, COALESCE(inv.model, '') AS model, inv.asset_code
       FROM asset_assignment_history h
       LEFT JOIN users u ON h.assigned_by = u.id
       LEFT JOIN asset_inventory inv ON h.inventory_id = inv.id
       WHERE h.employee_id = ? ORDER BY h.action_date`, [emp.id]);

    const [leave] = await pool.query(
      `SELECT DATE_FORMAT(lr.start_date, '%Y-%m-%d') AS start_date,
              DATE_FORMAT(lr.end_date, '%Y-%m-%d') AS end_date,
              lr.days, lr.status, lr.reason, lt.name AS leave_type, u.name AS decided_by_name
       FROM leave_requests lr
       JOIN leave_types lt ON lr.leave_type_id = lt.id
       LEFT JOIN users u ON lr.decided_by = u.id
       WHERE lr.employee_id = ? ORDER BY lr.start_date`, [emp.id]);

    const d = (v) => (v ? String(v).slice(0, 10) : null);
    const timeline = [
      ...obEvents.map((e) => ({
        source: 'Onboarding', occurred_at: e.created_at, type: e.event_type, description: e.detail, actor: e.user_name || null,
      })),
      ...docs.map((x) => ({
        source: 'Document', occurred_at: x.created_at, type: x.category, description: x.file_name, actor: null,
      })),
      ...assets.map((a) => ({
        source: 'Asset', occurred_at: a.issued_date, type: a.asset_type,
        description: [a.name, a.identifier].filter(Boolean).join(' — ') + (a.returned_date ? ` (returned ${d(a.returned_date)})` : ''),
        actor: null,
      })),
      ...assetHistory.map((h) => ({
        source: 'Asset', occurred_at: h.action_date, type: h.action,
        description: [[h.brand, h.model].filter(Boolean).join(' '), h.asset_code, h.condition_at_action, h.notes].filter(Boolean).join(' · '),
        actor: h.actor || null,
      })),
      ...leave.map((l) => ({
        source: 'Leave', occurred_at: l.start_date, type: l.leave_type,
        description: `${d(l.start_date)} → ${d(l.end_date)} · ${l.days} day(s) · ${l.status}${l.reason ? ` · ${l.reason}` : ''}`,
        actor: l.decided_by_name || null,
      })),
    ].filter((x) => x.occurred_at)
      .sort((a, b) => new Date(a.occurred_at) - new Date(b.occurred_at))
      .map((x) => ({ ...x, occurred_at: typeof x.occurred_at === 'string' ? x.occurred_at : x.occurred_at.toISOString() }));

    res.json({ employee: header, timeline, counts: { onboarding: obEvents.length, documents: docs.length, assets: assets.length + assetHistory.length, leave: leave.length } });
  } catch (err) { console.error('GET /employees/:id/history error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

// ==================== Bank details + stamped IBAN letter ====================

// The bank-stamped IBAN letter is the evidence behind a payroll account, so it
// is kept as a real file (same pattern as leave/onboarding attachments).
const BANK_EXT = ['.pdf', '.png', '.jpg', '.jpeg', '.webp'];
const bankUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, ensureUploadDir('employee_bank')),
    filename: (req, file, cb) => cb(null, `${crypto.randomBytes(12).toString('hex')}${path.extname(file.originalname).toLowerCase()}`),
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = BANK_EXT.includes(path.extname(file.originalname).toLowerCase());
    cb(ok ? null : new Error(`Unsupported file type — allowed: ${BANK_EXT.join(', ')}`), ok);
  },
});
const acceptBankFile = (req, res, next) => bankUpload.single('file')(req, res, (err) => {
  if (!err) return next();
  const tooBig = err.code === 'LIMIT_FILE_SIZE';
  res.status(tooBig ? 413 : 422).json({ error: tooBig ? 'File must be 10 MB or smaller' : (err.message || 'Invalid upload') });
});

// Loose IBAN shape check (same rule the onboarding stage engine applies).
const IBAN_RE = /^[A-Z]{2}[0-9A-Z]{13,32}$/;
const normIban = (v) => String(v || '').replace(/\s/g, '').toUpperCase();

// GET /api/employees/:id/bank — details + attached letters (scoped).
router.get('/:id/bank', async (req, res) => {
  try {
    const emp = await getScopedEmployee(req, req.params.id);
    if (!emp) return res.status(404).json({ error: 'Employee not found' });
    const [[bank]] = await pool.query(
      `SELECT b.*, u.name AS verified_by_name FROM employee_bank_details b
       LEFT JOIN users u ON b.verified_by = u.id WHERE b.employee_id = ?`, [emp.id]);
    const [files] = await pool.query(
      `SELECT f.id, f.kind, f.file_name, f.file_type, f.file_size, f.uploaded_at, u.name AS uploaded_by_name
       FROM employee_bank_files f LEFT JOIN users u ON f.uploaded_by = u.id
       WHERE f.employee_id = ? ORDER BY f.uploaded_at DESC`, [emp.id]);
    res.json({ bank: bank || null, files });
  } catch (err) { console.error('GET /employees/:id/bank error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

// PUT /api/employees/:id/bank — create/update the payroll account (scoped).
// Editing the account always drops verification: a changed account needs a new
// stamped letter before it can be trusted for payroll again.
router.put('/:id/bank', authorize('admin', 'hr_manager'), async (req, res) => {
  try {
    const emp = await getScopedEmployee(req, req.params.id);
    if (!emp) return res.status(404).json({ error: 'Employee not found' });
    const { bank_name, account_holder_name, account_number, swift_code, branch_name, transfer_method, salary_currency, notes } = req.body;
    const iban = normIban(req.body.iban);
    if (!bank_name || !account_holder_name || !account_number || !iban) {
      return res.status(422).json({ error: 'Bank name, account holder, account number and IBAN are required' });
    }
    if (!IBAN_RE.test(iban)) return res.status(422).json({ error: 'Invalid IBAN format' });
    const METHODS = ['Bank Transfer', 'WPS', 'Cheque', 'Cash'];
    const method = METHODS.includes(transfer_method) ? transfer_method : 'Bank Transfer';

    await pool.query(
      `INSERT INTO employee_bank_details
         (employee_id, company_id, bank_name, account_holder_name, account_number, iban, swift_code, branch_name, transfer_method, salary_currency, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE bank_name=VALUES(bank_name), account_holder_name=VALUES(account_holder_name),
         account_number=VALUES(account_number), iban=VALUES(iban), swift_code=VALUES(swift_code),
         branch_name=VALUES(branch_name), transfer_method=VALUES(transfer_method),
         salary_currency=VALUES(salary_currency), notes=VALUES(notes),
         verified=0, verified_by=NULL, verified_at=NULL`,
      [emp.id, emp.company_id, bank_name, account_holder_name, account_number, iban,
        swift_code || null, branch_name || null, method, salary_currency || null, notes || null]);
    await addAudit(pool, req.user, 'Employees', 'Bank Details Updated', `Bank account saved for ${emp.first_name} ${emp.last_name} (pending verification)`);
    res.json({ success: true });
  } catch (err) { console.error('PUT /employees/:id/bank error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

// POST /api/employees/:id/bank/verify — refuses without a stamped IBAN letter.
router.post('/:id/bank/verify', authorize('admin', 'hr_manager'), async (req, res) => {
  try {
    const emp = await getScopedEmployee(req, req.params.id);
    if (!emp) return res.status(404).json({ error: 'Employee not found' });
    const [[bank]] = await pool.query('SELECT id FROM employee_bank_details WHERE employee_id = ?', [emp.id]);
    if (!bank) return res.status(400).json({ error: 'No bank details to verify' });
    const [[letter]] = await pool.query(
      "SELECT id FROM employee_bank_files WHERE employee_id = ? AND kind = 'iban_letter' LIMIT 1", [emp.id]);
    if (!letter) return res.status(422).json({ error: 'Attach the bank-stamped IBAN letter before verifying the account' });

    await pool.query('UPDATE employee_bank_details SET verified = 1, verified_by = ?, verified_at = NOW() WHERE employee_id = ?', [req.user.id, emp.id]);
    await addAudit(pool, req.user, 'Employees', 'Bank Details Verified', `Bank account verified for ${emp.first_name} ${emp.last_name}`);
    res.json({ success: true });
  } catch (err) { console.error('POST /employees/:id/bank/verify error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

// POST /api/employees/:id/bank/files — attach the stamped IBAN letter (scoped).
router.post('/:id/bank/files', authorize('admin', 'hr_manager'), acceptBankFile, async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'A file is required' });
    const emp = await getScopedEmployee(req, req.params.id);
    if (!emp) { fs.unlink(req.file.path, () => {}); return res.status(404).json({ error: 'Employee not found' }); }
    const kind = req.body.kind === 'other' ? 'other' : 'iban_letter';
    const [r] = await pool.query('INSERT INTO employee_bank_files SET ?', {
      employee_id: emp.id, company_id: emp.company_id, kind,
      file_name: req.file.originalname, file_type: req.file.mimetype, file_size: req.file.size,
      storage_key: req.file.filename, uploaded_by: req.user.id,
    });
    await addAudit(pool, req.user, 'Employees', 'IBAN Letter Attached', `${kind} attached for ${emp.first_name} ${emp.last_name}`);
    res.status(201).json({ id: r.insertId, kind });
  } catch (err) { console.error('POST /employees/:id/bank/files error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

// GET /api/employees/:id/bank/files/:fileId/download (scoped)
router.get('/:id/bank/files/:fileId/download', async (req, res) => {
  try {
    const emp = await getScopedEmployee(req, req.params.id);
    if (!emp) return res.status(404).json({ error: 'Employee not found' });
    const [[f]] = await pool.query('SELECT * FROM employee_bank_files WHERE id = ? AND employee_id = ?', [req.params.fileId, emp.id]);
    if (!f) return res.status(404).json({ error: 'File not found' });
    const filePath = uploadPath('employee_bank', f.storage_key);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File missing on disk' });
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.download(filePath, f.file_name || 'iban-letter');
  } catch (err) { console.error('GET bank file download error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

// DELETE /api/employees/:id/bank/files/:fileId — admin only (scoped).
router.delete('/:id/bank/files/:fileId', authorize('admin'), async (req, res) => {
  try {
    const emp = await getScopedEmployee(req, req.params.id);
    if (!emp) return res.status(404).json({ error: 'Employee not found' });
    const [[f]] = await pool.query('SELECT * FROM employee_bank_files WHERE id = ? AND employee_id = ?', [req.params.fileId, emp.id]);
    if (!f) return res.status(404).json({ error: 'File not found' });
    fs.unlink(uploadPath('employee_bank', f.storage_key), () => {});
    await pool.query('DELETE FROM employee_bank_files WHERE id = ?', [f.id]);
    // Removing the evidence invalidates the verification it supported.
    if (f.kind === 'iban_letter') {
      const [[left]] = await pool.query("SELECT id FROM employee_bank_files WHERE employee_id = ? AND kind = 'iban_letter' LIMIT 1", [emp.id]);
      if (!left) await pool.query('UPDATE employee_bank_details SET verified = 0, verified_by = NULL, verified_at = NULL WHERE employee_id = ?', [emp.id]);
    }
    await addAudit(pool, req.user, 'Employees', 'Bank File Removed', `${f.kind} removed for ${emp.first_name} ${emp.last_name}`);
    res.json({ success: true });
  } catch (err) { console.error('DELETE bank file error:', err); res.status(500).json({ error: 'Internal server error' }); }
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
  'work_permit_no', 'personal_no',
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
    // WPS identifiers: digits only (leading zeros are significant, so they stay
    // strings). Length isn't pinned to 9/14 — the MOL has issued shorter legacy
    // numbers — but anything non-numeric is a typo that would fail submission.
    for (const f of ['work_permit_no', 'personal_no']) {
      if (data[f] != null) {
        data[f] = String(data[f]).replace(/\s+/g, '');
        if (!/^\d{1,20}$/.test(data[f])) {
          return res.status(422).json({ error: `${f === 'work_permit_no' ? 'Work permit no' : 'Personal no'} must contain digits only` });
        }
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
