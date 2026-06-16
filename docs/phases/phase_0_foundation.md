# Phase 0: Foundation & Setup — Detailed Steps

> **Status**: 🔲 Not Started
> **Estimated Duration**: Week 1
> **Architecture**: Client/Server monorepo

---

## 0.1 — Monorepo Structure

```
IST_HR_System/
├── client/                  # React frontend
│   ├── src/
│   ├── index.html
│   ├── vite.config.js
│   ├── tailwind.config.cjs
│   ├── postcss.config.cjs
│   └── package.json
├── server/                  # Node.js backend
│   ├── config/
│   ├── middleware/
│   ├── routes/
│   ├── services/
│   ├── app.js
│   ├── server.js
│   └── package.json
├── .env                     # Shared env vars
├── docs/                    # Documentation
└── README.md
```

---

## 0.2 — Client Initialization

```bash
cd IST_HR_System
npx -y create-vite@latest client -- --template react
cd client
npm install
```

### Frontend Dependencies

```bash
# UI & Styling
npm install tailwindcss@3 postcss autoprefixer
npm install @radix-ui/react-dialog @radix-ui/react-dropdown-menu @radix-ui/react-tabs @radix-ui/react-accordion
npm install @headlessui/react lucide-react
npm install class-variance-authority clsx tailwind-merge tailwindcss-animate

# State & Routing
npm install @reduxjs/toolkit react-redux react-router-dom@6

# HTTP
npm install axios

# Forms
npm install react-hook-form @hookform/resolvers yup

# Tables & DnD
npm install react-table react-beautiful-dnd

# Charts
npm install apexcharts react-apexcharts recharts

# Notifications & Dialogs
npm install react-toastify sweetalert2

# Date & Animation
npm install dayjs framer-motion

# File Upload
npm install react-dropzone

# Misc
npm install simplebar-react
```

### Vite Config

```javascript
// client/vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@api': path.resolve(__dirname, './src/api'),
      '@components': path.resolve(__dirname, './src/components'),
      '@pages': path.resolve(__dirname, './src/pages'),
      '@store': path.resolve(__dirname, './src/store'),
      '@hooks': path.resolve(__dirname, './src/hooks'),
      '@utils': path.resolve(__dirname, './src/utils'),
      '@assets': path.resolve(__dirname, './src/assets'),
      '@configs': path.resolve(__dirname, './src/configs'),
    }
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3001'
    }
  }
});
```

### TailwindCSS Config

```javascript
// client/tailwind.config.cjs
module.exports = {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
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
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      }
    },
  },
  plugins: [require('tailwindcss-animate')],
};
```

### Client Folder Structure

```
client/src/
├── api/                    # Axios instance + service files
├── assets/                 # Images, logos
├── components/
│   ├── ui/                 # Button, Card, Badge, Input, Modal, etc.
│   ├── partials/           # Header, Sidebar, Footer
│   └── shared/             # EntityBadge, StatusBadge, PageHeader
├── configs/                # constants.js, menuItems.js
├── hooks/                  # useAuth, useDebounce, etc.
├── layout/                 # MainLayout, AuthLayout
├── pages/
│   ├── auth/
│   ├── dashboard/
│   ├── settings/
│   ├── recruitment/
│   ├── employees/
│   ├── legal/
│   └── admin/
├── store/
│   └── slices/             # All Redux slices
└── utils/                  # formatters, validators
```

---

## 0.3 — Server Initialization

```bash
cd IST_HR_System
mkdir server && cd server
npm init -y
```

### Backend Dependencies

```bash
npm install express cors dotenv helmet morgan
npm install mysql2
npm install jsonwebtoken bcryptjs
npm install multer
npm install axios
npm install pdf-parse mammoth
```

### Express App Setup

```javascript
// server/app.js
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import 'dotenv/config';

// Import routes
import authRoutes from './routes/auth.js';
import companiesRoutes from './routes/companies.js';
// ... all other routes
import aiRoutes from './routes/ai.js';

const app = express();

app.use(cors({ origin: 'http://localhost:5173' }));
app.use(helmet());
app.use(morgan('dev'));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/companies', companiesRoutes);
// ... all other routes
app.use('/api/ai', aiRoutes);

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

export default app;
```

### MySQL Connection

```javascript
// server/config/db.js
import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  charset: 'utf8mb4',
});

// Test connection on startup
pool.getConnection()
  .then(conn => { console.log('✅ MySQL connected'); conn.release(); })
  .catch(err => { console.error('❌ MySQL connection failed:', err.message); });

export default pool;
```

### Environment File

```env
# .env (project root)
DB_HOST=<db-host>
DB_PORT=<db-port>
DB_USER=<db-user>
DB_PASSWORD=<set-in-environment>   # never commit real credentials
DB_NAME=<db-name>

JWT_SECRET=ist_hr_jwt_secret_2026_change_me
JWT_EXPIRES_IN=24h

DEEPSEEK_API_KEY=<set-in-environment>
DEEPSEEK_BASE_URL=https://api.deepseek.com

PORT=3001
NODE_ENV=development
```

---

## 0.4 — Design System (UI Components)

Build 20+ base UI components following DashSpace patterns:

| Component       | File                            | Purpose                    |
|-----------------|----------------------------------|----------------------------|
| Button          | `components/ui/Button.jsx`       | All button variants        |
| Card            | `components/ui/Card.jsx`         | Container card             |
| Badge           | `components/ui/Badge.jsx`        | Status/label badges        |
| Input           | `components/ui/Input.jsx`        | Text input with label      |
| Select          | `components/ui/Select.jsx`       | Searchable select          |
| Textarea        | `components/ui/Textarea.jsx`     | Multi-line input           |
| Modal           | `components/ui/Modal.jsx`        | Radix Dialog wrapper       |
| Dropdown        | `components/ui/Dropdown.jsx`     | Radix DropdownMenu         |
| Tabs            | `components/ui/Tabs.jsx`         | Radix Tabs                 |
| Accordion       | `components/ui/Accordion.jsx`    | Radix Accordion            |
| ProgressBar     | `components/ui/ProgressBar.jsx`  | Animated progress          |
| Skeleton        | `components/ui/Skeleton.jsx`     | Loading placeholder        |
| StatCard        | `components/ui/StatCard.jsx`     | Dashboard stat card        |
| Avatar          | `components/ui/Avatar.jsx`       | Initials-based avatar      |
| SearchInput     | `components/ui/SearchInput.jsx`  | Debounced search           |
| TagInput        | `components/ui/TagInput.jsx`     | Multi-tag entry            |
| DataTable       | `components/ui/DataTable.jsx`    | React Table wrapper        |
| EmptyState      | `components/ui/EmptyState.jsx`   | No data illustration       |
| FileUpload      | `components/ui/FileUpload.jsx`   | Drag-and-drop zone         |
| Toggle          | `components/ui/Toggle.jsx`       | On/off switch              |

Plus shared components:

| Component       | File                                | Purpose                  |
|-----------------|--------------------------------------|--------------------------|
| EntityBadge     | `components/shared/EntityBadge.jsx`  | Company color badge      |
| StatusBadge     | `components/shared/StatusBadge.jsx`  | Active/Inactive etc.     |
| ConfirmDialog   | `components/shared/ConfirmDialog.jsx`| SweetAlert2 wrapper      |
| PageHeader      | `components/shared/PageHeader.jsx`   | Title + action buttons   |
| FilterBar       | `components/shared/FilterBar.jsx`    | Search + filter row      |

**Acceptance Criteria**:
- [ ] `npm run dev` starts client on :5173
- [ ] `node server.js` starts server on :3001
- [ ] Server connects to MySQL successfully
- [ ] `/api/health` returns `{ status: 'ok' }`
- [ ] All UI components render correctly
