# Data Layer — MySQL + Express API

## Overview

The IST HR System uses a **MySQL database** accessed through a **Node.js/Express REST API**. The frontend communicates exclusively via HTTP requests — no direct database access from the browser.

```
React (Axios) → Express API → MySQL Database
                     ↓
              DeepSeek AI API (for AI features)
```

---

## Database Connection

### Configuration: `server/config/db.js`

```javascript
import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host: process.env.DB_HOST,           // 147.93.27.94
  port: process.env.DB_PORT,           // 5458
  user: process.env.DB_USER,           // mysql
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,       // default
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: 'utf8mb4',
});

export default pool;
```

### Usage Pattern

```javascript
import pool from '../config/db.js';

// Query example
const [rows] = await pool.query('SELECT * FROM companies WHERE status = ?', ['Active']);

// Insert example
const [result] = await pool.query(
  'INSERT INTO companies (name, short_code, currency) VALUES (?, ?, ?)',
  [name, shortCode, currency]
);
const newId = result.insertId;

// Transaction example
const conn = await pool.getConnection();
try {
  await conn.beginTransaction();
  await conn.query('INSERT INTO employees ...', [...]);
  await conn.query('INSERT INTO onboarding_records ...', [...]);
  await conn.commit();
} catch (err) {
  await conn.rollback();
  throw err;
} finally {
  conn.release();
}
```

---

## API Layer (Frontend)

### Axios Instance: `client/src/api/axios.js`

```javascript
import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001/api',
  timeout: 15000,
});

// Request interceptor: attach JWT token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('ist_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Response interceptor: handle 401 → redirect to login
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('ist_token');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;
```

### API Service Files: `client/src/api/`

```
api/
├── axios.js              # Configured Axios instance
├── authApi.js            # login, logout, me
├── companiesApi.js       # CRUD companies
├── departmentsApi.js     # CRUD departments
├── jobTitlesApi.js       # CRUD job titles
├── skillsApi.js          # CRUD skills + categories
├── vacanciesApi.js       # CRUD vacancies
├── candidatesApi.js      # CRUD candidates + CV upload
├── atsApi.js             # Stage transitions
├── employeesApi.js       # CRUD employees
├── onboardingApi.js      # Workflow management
├── assetsApi.js          # Assignment + catalog + inventory
├── performanceApi.js     # Targets + KPIs
├── offboardingApi.js     # Workflow + settlement
├── legalApi.js           # Letters + templates
├── documentsApi.js       # File upload/download
├── payrollApi.js         # Calculations
├── reportsApi.js         # Analytics queries
├── auditApi.js           # Log queries
├── kpiApi.js             # KPI tracking
├── usersApi.js           # User management
├── settingsApi.js        # System configuration
└── aiApi.js              # DeepSeek AI calls
```

### Example API Service

```javascript
// api/companiesApi.js
import api from './axios';

export const getCompanies = (params) => api.get('/companies', { params });
export const getCompany = (id) => api.get(`/companies/${id}`);
export const createCompany = (data) => api.post('/companies', data);
export const updateCompany = (id, data) => api.put(`/companies/${id}`, data);
export const deleteCompany = (id) => api.delete(`/companies/${id}`);
```

---

## Backend Route Pattern

### Example: `server/routes/companies.js`

```javascript
import { Router } from 'express';
import pool from '../config/db.js';
import { auth } from '../middleware/auth.js';
import { authorize } from '../middleware/rbac.js';
import { addAudit } from '../services/auditService.js';

const router = Router();

// GET /api/companies — List all
router.get('/', auth, async (req, res) => {
  const [rows] = await pool.query(
    'SELECT * FROM companies ORDER BY name'
  );
  res.json(rows);
});

// GET /api/companies/:id — Get one
router.get('/:id', auth, async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM companies WHERE id = ?', [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: 'Not found' });
  res.json(rows[0]);
});

// POST /api/companies — Create
router.post('/', auth, authorize('admin'), async (req, res) => {
  const { name, short_code, currency, ...rest } = req.body;
  const [result] = await pool.query(
    'INSERT INTO companies SET ?',
    { name, short_code, currency, ...rest }
  );
  await addAudit(pool, req.user, 'Companies', 'Created', `Company "${name}" created`);
  res.status(201).json({ id: result.insertId, name, short_code });
});

// PUT /api/companies/:id — Update
router.put('/:id', auth, authorize('admin'), async (req, res) => {
  await pool.query('UPDATE companies SET ? WHERE id = ?', [req.body, req.params.id]);
  await addAudit(pool, req.user, 'Companies', 'Updated', `Company #${req.params.id} updated`);
  res.json({ success: true });
});

// DELETE /api/companies/:id — Delete
router.delete('/:id', auth, authorize('admin'), async (req, res) => {
  await pool.query('DELETE FROM companies WHERE id = ?', [req.params.id]);
  await addAudit(pool, req.user, 'Companies', 'Deleted', `Company #${req.params.id} deleted`);
  res.json({ success: true });
});

export default router;
```

---

## Redux Store Pattern (with API)

```javascript
// store/slices/companiesSlice.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import * as companiesApi from '@/api/companiesApi';

export const fetchCompanies = createAsyncThunk(
  'companies/fetchAll',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await companiesApi.getCompanies();
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.error || 'Failed to load');
    }
  }
);

const companiesSlice = createSlice({
  name: 'companies',
  initialState: { items: [], loading: false, error: null },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchCompanies.pending, (state) => { state.loading = true; })
      .addCase(fetchCompanies.fulfilled, (state, { payload }) => {
        state.items = payload;
        state.loading = false;
      })
      .addCase(fetchCompanies.rejected, (state, { payload }) => {
        state.error = payload;
        state.loading = false;
      });
  },
});

export default companiesSlice.reducer;
```

---

## File Upload / Download

### Upload (multer)

```javascript
// middleware/upload.js
import multer from 'multer';
const storage = multer.memoryStorage();
export const upload = multer({ storage, limits: { fileSize: 25 * 1024 * 1024 } }); // 25MB

// Route: POST /api/documents
router.post('/', auth, upload.single('file'), async (req, res) => {
  const { company_id, category } = req.body;
  await pool.query('INSERT INTO company_documents SET ?', {
    company_id,
    category,
    file_name: req.file.originalname,
    file_type: req.file.mimetype,
    file_size: req.file.size,
    file_data: req.file.buffer,     // LONGBLOB in MySQL
    uploaded_by: req.user.id,
  });
  res.status(201).json({ success: true });
});
```

### Download

```javascript
// Route: GET /api/documents/:id/download
router.get('/:id/download', auth, async (req, res) => {
  const [rows] = await pool.query(
    'SELECT file_name, file_type, file_data FROM company_documents WHERE id = ?',
    [req.params.id]
  );
  if (!rows.length) return res.status(404).json({ error: 'Not found' });
  const doc = rows[0];
  res.setHeader('Content-Type', doc.file_type);
  res.setHeader('Content-Disposition', `inline; filename="${doc.file_name}"`);
  res.send(doc.file_data);
});
```

---

## DeepSeek AI Integration

### Service: `server/services/deepseekService.js`

```javascript
import axios from 'axios';

const deepseek = axios.create({
  baseURL: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com',
  headers: {
    'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`,
    'Content-Type': 'application/json',
  },
  timeout: 60000,
});

export async function analyzeCV(cvText, vacancyProfile) {
  const prompt = `You are an expert HR recruiter. Analyze this CV against the vacancy requirements.
  
  VACANCY: ${JSON.stringify(vacancyProfile)}
  
  CV TEXT: ${cvText}
  
  Return a JSON object with:
  - score (0-100)
  - breakdown: { experience, skills, education, languages, quality, ai_awareness } (each 0-100)
  - matched_skills: [list of matched skills]
  - missing_skills: [list of missing required skills]
  - summary: brief assessment (2-3 sentences)
  - fit_level: "Strong Fit" | "Good Fit" | "Partial Fit" | "Weak Fit"
  - recommendations: [suggestions for interview focus areas]`;

  const { data } = await deepseek.post('/chat/completions', {
    model: 'deepseek-chat',
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
    temperature: 0.3,
  });

  return JSON.parse(data.choices[0].message.content);
}

export async function generateLetterContent(type, fields, companyInfo) { ... }
export async function generateInterviewQuestions(role, skills) { ... }
export async function generateJobDescription(title, requirements) { ... }
export async function summarizeCandidate(candidateData) { ... }
```

---

## Authentication (JWT + bcrypt)

### Login Flow

```javascript
// routes/auth.js
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  
  const [users] = await pool.query(
    'SELECT * FROM users WHERE username = ? AND is_active = TRUE', [username]
  );
  if (!users.length) return res.status(401).json({ error: 'Invalid credentials' });

  const user = users[0];
  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

  const token = jwt.sign(
    { id: user.id, role: user.role, company_id: user.company_id },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN }
  );

  await pool.query('UPDATE users SET last_login_at = NOW() WHERE id = ?', [user.id]);

  res.json({
    token,
    user: { id: user.id, name: user.name, role: user.role, company_id: user.company_id }
  });
});
```

### JWT Middleware

```javascript
// middleware/auth.js
import jwt from 'jsonwebtoken';

export const auth = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return res.status(401).json({ error: 'No token' });

  try {
    const decoded = jwt.verify(header.split(' ')[1], process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
};
```

---

## Audit Logging

```javascript
// services/auditService.js
export async function addAudit(pool, user, module, action, detail) {
  await pool.query('INSERT INTO audit_logs SET ?', {
    user_id: user?.id || null,
    user_name: user?.name || 'System',
    module,
    action,
    detail,
  });
}
```

Every route that modifies data calls `addAudit()` to maintain the immutable audit trail.
