import { Router } from 'express';
import pool from '../config/db.js';
import { auth } from '../middleware/auth.js';
import { authorize } from '../middleware/rbac.js';
import { addAudit } from '../services/auditService.js';
import bcrypt from 'bcryptjs';
import { parseEmployeeDocument } from '../services/deepseekService.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { extractTextFromFile } from '../services/cvParserService.js';

const upload = multer({
  dest: path.join(process.cwd(), '..', 'uploads', 'employee_docs'),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.doc', '.docx', '.txt', '.png', '.jpg', '.jpeg'];
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, allowed.includes(ext));
  },
});

const router = Router();

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
router.post('/onboard', auth, authorize('admin', 'hr_manager'), async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const { employee_data, documents, create_user } = req.body;

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

    await addAudit(connection, req.user, 'Employees', 'Onboarded', \`Fully onboarded employee \${employee_data.first_name} \${employee_data.last_name}\`);
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

// GET /api/employees?company_id=X&status=X&search=X&page=1&limit=25
router.get('/', auth, async (req, res) => {
