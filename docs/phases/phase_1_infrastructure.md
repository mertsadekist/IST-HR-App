# Phase 1: Backend API + Database — Detailed Steps

> **Status**: 🔲 Not Started
> **Estimated Duration**: Week 1-2
> **Depends On**: Phase 0

---

## 1.1 — Database Schema Creation

### Run Full Schema

Execute the SQL from `docs/architecture/database_schema.md` against the MySQL server:

```bash
mysql -h 147.93.27.94 -P 5458 -u mysql -p default < schema.sql
```

All 40 tables with foreign keys, indexes, and ENUMs.

### Seed Default Admin User

```sql
-- Password: "admin123" hashed with bcrypt
INSERT INTO users (username, password_hash, name, email, role, is_active)
VALUES ('admin', '$2a$10$...bcrypt_hash...', 'System Admin', 'admin@ist.com', 'admin', TRUE);
```

The seed script hashes the password with bcrypt before inserting.

### Seed Default ATS Stages

```sql
INSERT INTO ats_stages (name, color, text_color, sort_order, is_default, is_success, is_fail) VALUES
('New Applicants',      '#EDE9FE', '#5B21B6', 1,  TRUE,  FALSE, FALSE),
('Shortlisted',         '#DBEAFE', '#1E40AF', 2,  FALSE, FALSE, FALSE),
('Contacted',           '#D1FAE5', '#065F46', 3,  FALSE, FALSE, FALSE),
('Scheduled Interview', '#FEF3C7', '#92400E', 4,  FALSE, FALSE, FALSE),
('1st Interview',       '#FECACA', '#991B1B', 5,  FALSE, FALSE, FALSE),
('2nd Interview',       '#FED7AA', '#9A3412', 6,  FALSE, FALSE, FALSE),
('Assessment',          '#E0E7FF', '#3730A3', 7,  FALSE, FALSE, FALSE),
('Offer Made',          '#CFFAFE', '#155E75', 8,  FALSE, FALSE, FALSE),
('Offer Accepted',      '#ECFDF5', '#047857', 9,  FALSE, FALSE, FALSE),
('Joining Process',     '#FEF9C3', '#854D0E', 10, FALSE, FALSE, FALSE),
('Success',             '#BBF7D0', '#166534', 11, FALSE, TRUE,  FALSE),
('Failed',              '#FECACA', '#991B1B', 12, FALSE, FALSE, TRUE),
('Blacklisted',         '#374151', '#F9FAFB', 13, FALSE, FALSE, TRUE);
```

**Acceptance Criteria**:
- [ ] All 40 tables created successfully
- [ ] Admin user can login
- [ ] ATS stages seeded

---

## 1.2 — Authentication API

### Files to Create

```
server/
├── routes/auth.js
├── middleware/auth.js
├── middleware/rbac.js
```

### `POST /api/auth/login`

```javascript
// Request: { username: "admin", password: "admin123" }
// Process:
//   1. SELECT * FROM users WHERE username = ? AND is_active = TRUE
//   2. bcrypt.compare(password, user.password_hash)
//   3. jwt.sign({ id, role, company_id }, JWT_SECRET, { expiresIn: '24h' })
//   4. UPDATE users SET last_login_at = NOW()
// Response: { token: "eyJ...", user: { id, name, role, company_id } }
```

### `POST /api/auth/me`

```javascript
// Headers: Authorization: Bearer <token>
// Process: jwt.verify(token) → SELECT user from DB
// Response: { id, name, role, company_id, email }
```

### JWT Auth Middleware

```javascript
// Verifies token → attaches req.user = { id, role, company_id }
// Returns 401 if invalid/expired
```

### RBAC Middleware

```javascript
// authorize('admin', 'hr_manager') → checks req.user.role
// Returns 403 if role not in allowed list
```

**Acceptance Criteria**:
- [ ] Login with valid credentials returns JWT
- [ ] Login with invalid credentials returns 401
- [ ] `/api/auth/me` returns user profile with valid token
- [ ] Protected routes reject requests without token

---

## 1.3 — Core CRUD Routes

### Route Template

Each resource follows this pattern:

```javascript
// routes/{resource}.js
router.get('/',      auth, getAll);       // List (with filters)
router.get('/:id',   auth, getOne);       // Get single
router.post('/',     auth, rbac, create); // Create
router.put('/:id',   auth, rbac, update); // Update
router.delete('/:id',auth, rbac, delete); // Delete
```

### Routes to Build

| Route               | Table(s)                    | RBAC          | Notes                  |
|---------------------|-----------------------------|---------------|------------------------|
| `/api/companies`    | companies                   | admin         |                        |
| `/api/departments`  | departments                 | admin         | Filter by company_id   |
| `/api/job-titles`   | job_titles + seniorities    | admin         | Includes nested seniority|
| `/api/skills`       | skill_categories + skills   | admin/hr      | Nested CRUD            |
| `/api/vacancies`    | vacancies                   | admin/hr/rec  | With counts            |
| `/api/candidates`   | candidates + skills + history| admin/hr/rec | Complex joins          |
| `/api/ats`          | candidates + stage_history  | admin/hr/rec  | Stage transitions      |
| `/api/employees`    | employees                   | admin/hr      |                        |
| `/api/onboarding`   | onboarding_records + steps  | admin/hr      | Nested workflow        |
| `/api/assets`       | asset_assignments + catalog | admin/hr      | With inventory         |
| `/api/performance`  | performance_targets         | admin/hr      |                        |
| `/api/offboarding`  | offboarding_records + steps | admin/hr      | Nested workflow        |
| `/api/legal`        | letter_templates + generated| admin/hr      |                        |
| `/api/documents`    | company_documents           | admin/hr      | File upload/download   |
| `/api/payroll`      | — (calculation only)        | admin/hr      | No DB storage needed   |
| `/api/reports`      | — (aggregate queries)       | admin/hr      | Read-only              |
| `/api/audit`        | audit_logs                  | admin         | Read-only              |
| `/api/kpi`          | kpi_hires + tiers           | admin/hr      |                        |
| `/api/users`        | users                       | admin         | With bcrypt            |
| `/api/settings`     | ats_stages + templates      | admin         | System configuration   |

### Special: ATS Stage Move Endpoint

```javascript
// PUT /api/ats/:candidateId/move
// Body: { stage_id: 11, notes: "Passed all interviews" }
// Process:
//   1. Update candidates SET current_stage_id = ?
//   2. INSERT INTO candidate_stage_history
//   3. IF stage.is_success:
//      BEGIN TRANSACTION
//      - INSERT INTO employees (from candidate data)
//      - INSERT INTO onboarding_records
//      - INSERT INTO onboarding_steps (from templates)
//      - INSERT INTO onboarding_checklist_items (from template items)
//      - UPDATE candidates SET status = 'Hired'
//      COMMIT
//   4. IF stage.is_fail:
//      - UPDATE candidates SET status = 'Failed'/'Blacklisted'
//   5. addAudit(...)
```

**Acceptance Criteria**:
- [ ] All CRUD routes return correct responses
- [ ] Filters work (company_id, status, etc.)
- [ ] ATS stage move creates employee on success
- [ ] Audit entries created for all mutations

---

## 1.4 — DeepSeek AI Service

### Files

```
server/services/deepseekService.js
server/routes/ai.js
```

### DeepSeek Client Setup

```javascript
// services/deepseekService.js
import axios from 'axios';

const client = axios.create({
  baseURL: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com',
  headers: {
    'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`,
    'Content-Type': 'application/json',
  },
  timeout: 60000,
});

async function chat(systemPrompt, userPrompt, jsonMode = false) {
  const { data } = await client.post('/chat/completions', {
    model: 'deepseek-chat',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    ...(jsonMode && { response_format: { type: 'json_object' } }),
    temperature: 0.3,
    max_tokens: 4000,
  });
  return data.choices[0].message.content;
}
```

### AI Functions

#### 1. `analyzeCV(cvText, vacancyProfile)`
- **Input**: Raw CV text + vacancy requirements (skills, experience, etc.)
- **Output**: `{ score, breakdown, matched_skills, missing_skills, summary, fit_level, recommendations }`
- **Stored in**: `candidates.ai_score` + `candidates.ai_analysis`

#### 2. `generateLetterContent(type, fields, company)`
- **Input**: Letter type + filled fields + company info
- **Output**: Professional letter body HTML
- **Stored in**: `generated_letters.rendered_html`

#### 3. `generateInterviewQuestions(role, skills, experience)`
- **Input**: Job role + required skills + years
- **Output**: Array of 10 tailored questions
- **Usage**: CV Scorer shortlist tab

#### 4. `generateJobDescription(title, dept, requirements)`
- **Input**: Title + department + requirements keywords
- **Output**: Formatted job description text
- **Usage**: Vacancy creation assistant

#### 5. `summarizeCandidate(candidateData)`
- **Input**: Full candidate profile JSON
- **Output**: 2-3 sentence professional summary
- **Usage**: Candidate profile card

### API Routes

```javascript
// routes/ai.js
router.post('/score-cv',          auth, scoreCVHandler);
router.post('/generate-letter',   auth, generateLetterHandler);
router.post('/generate-questions', auth, generateQuestionsHandler);
router.post('/generate-jd',       auth, generateJDHandler);
router.post('/summarize',         auth, summarizeHandler);
```

**Acceptance Criteria**:
- [ ] All 5 AI functions return valid responses
- [ ] JSON mode works for structured outputs
- [ ] Error handling for API failures/timeouts
- [ ] Rate limiting consideration

---

## 1.5 — File Handling

### CV Parser Service

```javascript
// services/cvParserService.js
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';

export async function parseCV(buffer, mimetype) {
  let text = '';
  
  if (mimetype === 'application/pdf') {
    const result = await pdfParse(buffer);
    text = result.text;
  } else if (mimetype.includes('wordprocessingml') || mimetype.includes('msword')) {
    const result = await mammoth.extractRawText({ buffer });
    text = result.value;
  } else {
    text = buffer.toString('utf-8');
  }
  
  return {
    rawText: text,
    extracted: extractFields(text), // regex extraction
  };
}

function extractFields(text) {
  return {
    email: text.match(/[\w.-]+@[\w.-]+\.\w+/)?.[0] || null,
    phone: text.match(/\+?\d[\d\s()-]{7,}/)?.[0] || null,
    // ... more patterns
  };
}
```

### Upload Endpoint

```javascript
// POST /api/candidates/:id/cv
// - multer processes file
// - cvParserService extracts text
// - DeepSeek scores if vacancy attached
// - Stores file in candidate_documents, text in candidates.cv_text
```

### Document Upload/Download

```javascript
// POST /api/documents — Upload file → company_documents (LONGBLOB)
// GET /api/documents/:id/download — Stream file back with correct headers
```

**Acceptance Criteria**:
- [ ] PDF, DOCX, TXT all parse correctly on server
- [ ] Files stored in MySQL LONGBLOB
- [ ] Download serves correct MIME type
- [ ] 25MB file size limit enforced
