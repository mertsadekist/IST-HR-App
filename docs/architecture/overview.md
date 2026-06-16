# Architecture Overview

## Application Structure

The IST HR System is a **full-stack web application** with a React frontend and Node.js/Express backend, connected to a **MySQL** database. DeepSeek AI is integrated for intelligent CV analysis and content generation.

### Stack Diagram

```
┌─────────────────────────────────────────────────┐
│                  FRONTEND                        │
│          React 18 + Vite + TailwindCSS           │
│          Redux Toolkit · React Router v6         │
└───────────────────┬─────────────────────────────┘
                    │  HTTP / REST API (Axios)
                    ▼
┌─────────────────────────────────────────────────┐
│                  BACKEND API                     │
│         Node.js + Express.js                     │
│         JWT Auth · bcrypt · multer               │
│         mysql2/promise · DeepSeek SDK            │
└───────┬─────────────────────┬───────────────────┘
        │                     │
        ▼                     ▼
┌───────────────┐    ┌────────────────────┐
│   MySQL DB    │    │   DeepSeek API     │
│ 147.93.27.94  │    │  api.deepseek.com  │
│   Port 5458   │    │  CV Scoring, AI    │
└───────────────┘    └────────────────────┘
```

---

## Technology Stack

| Layer              | Technology                                    |
|--------------------|-----------------------------------------------|
| **Frontend**       | React 18 + Vite                               |
| **Styling**        | TailwindCSS 3                                 |
| **State Mgmt**     | Redux Toolkit (RTK)                           |
| **Routing**        | React Router DOM v6                           |
| **HTTP Client**    | Axios                                         |
| **Backend**        | Node.js + Express.js                          |
| **Database**       | MySQL (remote, port 5458)                     |
| **DB Driver**      | mysql2/promise                                |
| **Auth**           | JWT (jsonwebtoken) + bcrypt                   |
| **File Upload**    | multer                                        |
| **AI Engine**      | DeepSeek API (chat/completions)               |
| **PDF Parsing**    | pdf-parse (server-side)                       |
| **DOCX Parsing**   | mammoth (server-side)                         |
| **Charts**         | ApexCharts / Recharts                         |
| **Forms**          | React Hook Form + Yup                        |
| **Tables**         | React Table                                   |
| **Drag & Drop**    | react-beautiful-dnd                           |
| **Notifications**  | react-toastify                                |
| **Animations**     | Framer Motion                                 |

---

## Project Structure

```
IST_HR_System/
├── client/                     # React Frontend (Vite)
│   ├── src/
│   │   ├── api/                # Axios instances & API calls
│   │   ├── assets/             # Images, logos, fonts
│   │   ├── components/
│   │   │   ├── ui/             # Base UI kit
│   │   │   ├── partials/       # Header, Sidebar, Footer
│   │   │   └── shared/         # EntityBadge, StatusBadge, etc.
│   │   ├── configs/            # Constants, menu items, theme
│   │   ├── hooks/              # Custom React hooks
│   │   ├── layout/             # Layout wrappers
│   │   ├── pages/              # All page components
│   │   ├── store/              # Redux slices
│   │   └── utils/              # Formatters, validators
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
│
├── server/                     # Node.js Backend (Express)
│   ├── config/
│   │   └── db.js               # MySQL connection pool
│   ├── middleware/
│   │   ├── auth.js             # JWT verification
│   │   ├── rbac.js             # Role-based access control
│   │   └── upload.js           # multer file upload
│   ├── routes/
│   │   ├── auth.js             # POST /api/auth/login, /logout
│   │   ├── companies.js        # CRUD /api/companies
│   │   ├── departments.js      # CRUD /api/departments
│   │   ├── jobTitles.js        # CRUD /api/job-titles
│   │   ├── skills.js           # CRUD /api/skills
│   │   ├── vacancies.js        # CRUD /api/vacancies
│   │   ├── candidates.js       # CRUD /api/candidates
│   │   ├── ats.js              # Pipeline stage management
│   │   ├── employees.js        # CRUD /api/employees
│   │   ├── onboarding.js       # Workflow /api/onboarding
│   │   ├── assets.js           # CRUD /api/assets
│   │   ├── performance.js      # CRUD /api/performance
│   │   ├── offboarding.js      # Workflow /api/offboarding
│   │   ├── legal.js            # Letters /api/legal
│   │   ├── documents.js        # File upload /api/documents
│   │   ├── payroll.js          # Calculators /api/payroll
│   │   ├── reports.js          # Analytics /api/reports
│   │   ├── audit.js            # Log /api/audit
│   │   ├── kpi.js              # KPI /api/kpi
│   │   ├── users.js            # CRUD /api/users
│   │   ├── settings.js         # System config /api/settings
│   │   └── ai.js               # DeepSeek /api/ai
│   ├── services/
│   │   ├── deepseekService.js  # DeepSeek API integration
│   │   ├── auditService.js     # Audit log helper
│   │   ├── cvParserService.js  # PDF/DOCX text extraction
│   │   └── settlementService.js# EOSB/gratuity calculation
│   ├── app.js                  # Express app setup
│   ├── server.js               # Entry point
│   └── package.json
│
├── .env                        # Environment variables
├── docs/                       # Documentation (this folder)
└── README.md
```

---

## Environment Variables (`.env`)

```env
# Database
DB_HOST=<db-host>
DB_PORT=<db-port>
DB_USER=<db-user>
DB_PASSWORD=<set-in-environment>   # never commit real credentials
DB_NAME=<db-name>

# JWT
JWT_SECRET=ist_hr_jwt_secret_key_change_in_production
JWT_EXPIRES_IN=24h

# DeepSeek AI
DEEPSEEK_API_KEY=<set-in-environment>
DEEPSEEK_BASE_URL=https://api.deepseek.com

# Server
PORT=3001
NODE_ENV=development

# Client
VITE_API_URL=http://localhost:3001/api
```

---

## API Architecture

### REST API Design

All endpoints follow: `{method} /api/{resource}`

| Method | Pattern                      | Purpose                |
|--------|------------------------------|------------------------|
| GET    | `/api/{resource}`            | List all (with filters)|
| GET    | `/api/{resource}/:id`        | Get single by ID       |
| POST   | `/api/{resource}`            | Create new             |
| PUT    | `/api/{resource}/:id`        | Update existing        |
| DELETE | `/api/{resource}/:id`        | Delete                 |

### Authentication Flow

```
1. POST /api/auth/login { username, password }
2. Server: bcrypt.compare(password, hash) → JWT token
3. Response: { token, user: { id, name, role, company_id } }
4. Client: stores token in localStorage
5. All subsequent requests: Authorization: Bearer <token>
6. Server middleware: verifies JWT → attaches req.user
```

### Role-Based Middleware

```javascript
// middleware/rbac.js
const authorize = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }
  next();
};
```

---

## DeepSeek AI Integration

### Service: `services/deepseekService.js`

```javascript
const DEEPSEEK_API = 'https://api.deepseek.com/chat/completions';

async function analyzeCV(cvText, vacancyProfile) {
  // POST to DeepSeek with structured prompt
  // Returns: { score, breakdown, summary, recommendations }
}

async function generateLetterContent(type, fields, companyInfo) {
  // Generates professional letter body
}

async function generateInterviewQuestions(role, skills, experience) {
  // Returns: array of tailored interview questions
}

async function generateJobDescription(title, dept, requirements) {
  // Returns: formatted JD text
}
```

### AI-Powered Features

| Feature                 | Endpoint              | AI Function                        |
|-------------------------|-----------------------|-------------------------------------|
| CV Scoring              | POST /api/ai/score-cv | Analyze CV against vacancy profile |
| Letter Generation       | POST /api/ai/letter   | Generate letter body content       |
| Interview Questions     | POST /api/ai/questions| Generate role-specific questions   |
| Job Description         | POST /api/ai/jd       | Generate JD from requirements      |
| Candidate Summary       | POST /api/ai/summary  | Summarize candidate profile        |

---

## CSS Architecture (TailwindCSS)

Custom theme tokens extending DashSpace:

```javascript
// tailwind.config.cjs
colors: {
  brand: {
    dark: '#1D1245',
    mid: '#6D28D9',
    light: '#EDE9FE',
  },
  accent: {
    orange: '#FB6814',
    coral: '#F43F5E',
  },
  status: {
    success: '#27AE60',
    danger: '#E74C3C',
    warning: '#E67E22',
    info: '#3B82F6',
  }
}
```

---

## Entity System

The application serves multiple business entities (companies). All data is filtered by `company_id`:

```sql
-- Every query includes company filter
SELECT * FROM candidates WHERE company_id = ? AND status = 'Active';
```

Entity switching updates `currentCompanyId` in the Redux store, and all API requests include it as a query parameter or are derived from the user's JWT.
