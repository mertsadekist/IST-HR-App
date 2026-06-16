# Phase 2: Core Frontend Infrastructure — Detailed Steps

> **Status**: 🔲 Not Started
> **Estimated Duration**: Week 2-3
> **Depends On**: Phase 0, Phase 1

---

## 2.1 — Axios & API Layer

### Axios Instance: `client/src/api/axios.js`

```javascript
import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 15000,
});

// Attach JWT token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('ist_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Handle 401 → redirect to login
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

### API Service Files (22 files)

Each follows this pattern:
```javascript
// api/companiesApi.js
import api from './axios';
export const getCompanies = (params) => api.get('/companies', { params });
export const getCompany = (id) => api.get(`/companies/${id}`);
export const createCompany = (data) => api.post('/companies', data);
export const updateCompany = (id, data) => api.put(`/companies/${id}`, data);
export const deleteCompany = (id) => api.delete(`/companies/${id}`);
```

Full list: authApi, companiesApi, departmentsApi, jobTitlesApi, skillsApi, vacanciesApi, candidatesApi, atsApi, employeesApi, onboardingApi, assetsApi, performanceApi, offboardingApi, legalApi, documentsApi, payrollApi, reportsApi, auditApi, kpiApi, usersApi, settingsApi, aiApi.

**Acceptance Criteria**:
- [ ] All 22 API service files created
- [ ] JWT token attached to all requests
- [ ] 401 responses redirect to login

---

## 2.2 — Authentication & Login Page

### Login Page (`pages/auth/Login.jsx`)
- Full-screen gradient background (brand purple → dark)
- Centered glassmorphism card
- Logo, username, password fields, login button
- Error message display

### Auth Redux Slice (`store/slices/authSlice.js`)

```javascript
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import * as authApi from '@api/authApi';

export const loginUser = createAsyncThunk(
  'auth/login',
  async ({ username, password }, { rejectWithValue }) => {
    try {
      const { data } = await authApi.login(username, password);
      localStorage.setItem('ist_token', data.token);
      return data.user;
    } catch (err) {
      return rejectWithValue(err.response?.data?.error || 'Login failed');
    }
  }
);

export const verifyToken = createAsyncThunk(
  'auth/verify',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await authApi.me();
      return data;
    } catch {
      localStorage.removeItem('ist_token');
      return rejectWithValue('Invalid token');
    }
  }
);

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    user: null,
    isAuthenticated: false,
    loading: true,   // true initially for token verification
    error: null,
  },
  reducers: {
    logout(state) {
      state.user = null;
      state.isAuthenticated = false;
      localStorage.removeItem('ist_token');
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loginUser.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(loginUser.fulfilled, (state, { payload }) => {
        state.user = payload;
        state.isAuthenticated = true;
        state.loading = false;
      })
      .addCase(loginUser.rejected, (state, { payload }) => {
        state.error = payload;
        state.loading = false;
      })
      .addCase(verifyToken.fulfilled, (state, { payload }) => {
        state.user = payload;
        state.isAuthenticated = true;
        state.loading = false;
      })
      .addCase(verifyToken.rejected, (state) => {
        state.loading = false;
      });
  },
});
```

### Protected Route (`components/shared/ProtectedRoute.jsx`)
```jsx
// Checks: isAuthenticated → if not, redirect to /login
// Optional: checks role → if insufficient, redirect to /unauthorized
// Shows loading spinner while verifyToken is in progress
```

**Acceptance Criteria**:
- [ ] Login with DB credentials → dashboard
- [ ] Invalid credentials → error message
- [ ] Page refresh → auto-verify token → stays logged in
- [ ] Token expired → redirect to login

---

## 2.3 — Layout System

### Sidebar (`components/partials/Sidebar.jsx`)

```
┌─────────────────────┐
│ 🏢 IST HR System    │
│ ─────────────────── │
│ 👤 User Name         │
│    HR Manager        │
│ ─────────────────── │
│ ⬡ [ALL] [RE] [MKT]  │  ← Entity switcher (from /api/companies)
│ ─────────────────── │
│ 📊 Dashboard         │
│ ─────────────────── │
│ 🔍 RECRUITMENT       │
│   📋 ATS Pipeline    │
│   👥 Candidates      │
│   📄 Vacancies       │
│   🎯 CV Scorer       │
│ ─────────────────── │
│ 👤 EMPLOYEE LIFECYCLE│
│   ✅ Onboarding      │
│   💻 Assets          │
│   📈 Performance     │
│   🚪 Offboarding     │
│ ─────────────────── │
│ ⚖️ LEGAL / DOCS      │
│   📜 Legal Letters   │
│   📁 Company Docs    │
│   💰 Payroll & Law   │
│ ─────────────────── │
│ 📊 ANALYTICS         │
│   📊 Reports         │
│   📝 Audit Log       │
│   🏆 KPI Tracker     │
│ ─────────────────── │
│ ⚙️ ADMIN             │
│   🏗️ Org Chart       │
│   👥 Users           │
│   ⚙️ Settings        │
└─────────────────────┘
```

### Entity Switcher
- Loads companies from `/api/companies` on mount
- Stores selected company in Redux → `entitySlice.currentCompanyId`
- "ALL" option shows data across all companies
- API requests include `?company_id=X` for filtered queries

### MainLayout (`layout/MainLayout.jsx`)
```jsx
<div className="flex h-screen bg-gray-50">
  <Sidebar />
  <div className="flex-1 flex flex-col overflow-hidden">
    <Topbar />
    <main className="flex-1 overflow-y-auto p-6">
      <Suspense fallback={<Loading />}>
        <Outlet />
      </Suspense>
    </main>
  </div>
</div>
```

**Acceptance Criteria**:
- [ ] Sidebar loads companies from API
- [ ] Entity switching updates Redux state
- [ ] Active menu item highlighted
- [ ] Mobile hamburger toggle

---

## 2.4 — Redux Store

### Store Configuration

```javascript
// store/index.js
import { configureStore } from '@reduxjs/toolkit';

import authReducer from './slices/authSlice';
import entityReducer from './slices/entitySlice';
import companiesReducer from './slices/companiesSlice';
import departmentsReducer from './slices/departmentsSlice';
import vacanciesReducer from './slices/vacanciesSlice';
import candidatesReducer from './slices/candidatesSlice';
import employeesReducer from './slices/employeesSlice';
import onboardingReducer from './slices/onboardingSlice';
import assetsReducer from './slices/assetsSlice';
import performanceReducer from './slices/performanceSlice';
import offboardingReducer from './slices/offboardingSlice';
import auditReducer from './slices/auditSlice';
import kpiReducer from './slices/kpiSlice';
import usersReducer from './slices/usersSlice';
import settingsReducer from './slices/settingsSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    entity: entityReducer,
    companies: companiesReducer,
    departments: departmentsReducer,
    vacancies: vacanciesReducer,
    candidates: candidatesReducer,
    employees: employeesReducer,
    onboarding: onboardingReducer,
    assets: assetsReducer,
    performance: performanceReducer,
    offboarding: offboardingReducer,
    audit: auditReducer,
    kpi: kpiReducer,
    users: usersReducer,
    settings: settingsReducer,
  },
});
```

### Slice Pattern (all slices follow)

```javascript
const slice = createSlice({
  name: 'resource',
  initialState: { items: [], loading: false, error: null },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchItems.pending, (state) => { state.loading = true; })
      .addCase(fetchItems.fulfilled, (state, { payload }) => {
        state.items = payload; state.loading = false;
      })
      .addCase(fetchItems.rejected, (state, { payload }) => {
        state.error = payload; state.loading = false;
      });
  },
});
```

---

## 2.5 — Routing

```jsx
// App.jsx
<Routes>
  <Route element={<AuthLayout />}>
    <Route path="/login" element={<Login />} />
  </Route>

  <Route element={<ProtectedRoute />}>
    <Route element={<MainLayout />}>
      <Route path="/" element={<Navigate to="/dashboard" />} />
      <Route path="/dashboard" element={<Dashboard />} />

      {/* Settings */}
      <Route path="/settings/companies" element={<CompanyManagement />} />
      <Route path="/settings/departments" element={<DepartmentManagement />} />
      <Route path="/settings/skills" element={<SkillsManagement />} />
      <Route path="/settings/catalog" element={<CatalogManagement />} />
      <Route path="/settings/system" element={<SystemConfig />} />

      {/* Recruitment */}
      <Route path="/ats" element={<ATSPipeline />} />
      <Route path="/candidates" element={<Candidates />} />
      <Route path="/vacancies" element={<Vacancies />} />
      <Route path="/cv-scorer" element={<CVScorer />} />

      {/* Employee Lifecycle */}
      <Route path="/onboarding" element={<Onboarding />} />
      <Route path="/assets" element={<Assets />} />
      <Route path="/performance" element={<Performance />} />
      <Route path="/offboarding" element={<Offboarding />} />

      {/* Legal */}
      <Route path="/legal-letters" element={<LegalLetters />} />
      <Route path="/company-docs" element={<CompanyDocs />} />
      <Route path="/payroll" element={<Payroll />} />

      {/* Admin */}
      <Route path="/reports" element={<Reports />} />
      <Route path="/audit" element={<AuditLog />} />
      <Route path="/kpi" element={<KPITracker />} />
      <Route path="/org-chart" element={<OrgChart />} />
      <Route path="/users" element={<UserManagement />} />

      <Route path="*" element={<NotFound />} />
    </Route>
  </Route>
</Routes>
```

All page components loaded with `React.lazy()`.

**Acceptance Criteria**:
- [ ] All routes resolve correctly
- [ ] Unauthenticated → /login
- [ ] 404 for unknown routes
- [ ] Lazy loading works (loading spinner shown)
