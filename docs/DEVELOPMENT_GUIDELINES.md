# Development Guidelines & Best Practices

> Adapted for the IST HR System full-stack architecture: React + Express + MySQL + DeepSeek AI

---

## Project Architecture

```
Frontend (React + Vite)  →  Backend (Express API)  →  MySQL Database
                                    ↓
                            DeepSeek AI API
```

All data flows through the Express API — the React frontend **never** accesses MySQL directly.

---

## Backend Standards (Node.js + Express)

### Route Handler Pattern

```javascript
// routes/{resource}.js
import { Router } from 'express';
import pool from '../config/db.js';
import { auth } from '../middleware/auth.js';
import { authorize } from '../middleware/rbac.js';
import { addAudit } from '../services/auditService.js';

const router = Router();

router.get('/', auth, async (req, res) => {
  try {
    const { company_id, status } = req.query;
    let sql = 'SELECT * FROM resource WHERE 1=1';
    const params = [];
    
    if (company_id) { sql += ' AND company_id = ?'; params.push(company_id); }
    if (status) { sql += ' AND status = ?'; params.push(status); }
    sql += ' ORDER BY created_at DESC';
    
    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error('GET /resource error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', auth, authorize('admin', 'hr_manager'), async (req, res) => {
  try {
    const [result] = await pool.query('INSERT INTO resource SET ?', req.body);
    await addAudit(pool, req.user, 'Resource', 'Created', `Created #${result.insertId}`);
    res.status(201).json({ id: result.insertId, ...req.body });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Duplicate entry' });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
```

### Error Handling

```javascript
// Always wrap async route handlers in try/catch
// Return appropriate HTTP status codes:
//   200 — Success
//   201 — Created
//   400 — Validation error
//   401 — Unauthorized (bad/missing JWT)
//   403 — Forbidden (insufficient role)
//   404 — Not found
//   409 — Conflict (duplicate)
//   500 — Server error
```

### Transaction Pattern (for multi-table operations)

```javascript
const conn = await pool.getConnection();
try {
  await conn.beginTransaction();
  
  const [employee] = await conn.query('INSERT INTO employees SET ?', {...});
  await conn.query('INSERT INTO onboarding_records SET ?', { employee_id: employee.insertId });
  // ... more inserts
  
  await conn.commit();
  res.status(201).json({ success: true });
} catch (err) {
  await conn.rollback();
  res.status(500).json({ error: 'Transaction failed' });
} finally {
  conn.release();
}
```

### SQL Best Practices

```sql
-- Always use parameterized queries (never string concatenation)
pool.query('SELECT * FROM users WHERE id = ?', [userId]);

-- Use JOINs for related data
SELECT jt.*, GROUP_CONCAT(s.name) AS skills
FROM job_titles jt
LEFT JOIN job_title_skills jts ON jt.id = jts.job_title_id
LEFT JOIN skills s ON jts.skill_id = s.id
WHERE jt.department_id = ?
GROUP BY jt.id;

-- Use LIMIT/OFFSET for pagination
SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT ? OFFSET ?;

-- Add indexes for frequently queried columns
CREATE INDEX idx_candidates_company ON candidates(company_id);
```

---

## Frontend Standards (React)

### Component Architecture

1. **Functional Components Only** — No class components
2. **Single Responsibility** — One component = one purpose
3. **Props Destructuring** — Always destructure, provide defaults
4. **Custom Hooks** — Extract reusable logic into `hooks/`
5. **Lazy Loading** — `React.lazy()` for route-level components

### File Naming

```
ComponentName.jsx     → PascalCase for components
useCustomHook.js      → camelCase with "use" prefix
resourceApi.js        → camelCase for API services
resourceSlice.js      → camelCase for Redux slices
```

### Component Template

```jsx
import { useState, useMemo, useCallback, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';

/**
 * ComponentName — Brief description.
 */
export default function ComponentName({ title, onAction, children }) {
  const dispatch = useDispatch();
  const { items, loading } = useSelector((state) => state.resource);
  
  useEffect(() => {
    dispatch(fetchItems());
  }, [dispatch]);

  if (loading) return <Skeleton />;

  return (
    <div className="component-wrapper">
      {children}
    </div>
  );
}
```

### Redux Async Thunk Pattern (API-backed)

```javascript
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import * as api from '@api/resourceApi';

export const fetchItems = createAsyncThunk(
  'resource/fetchAll',
  async (params, { rejectWithValue }) => {
    try {
      const { data } = await api.getAll(params);
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.error || 'Failed');
    }
  }
);

export const createItem = createAsyncThunk(
  'resource/create',
  async (payload, { rejectWithValue, dispatch }) => {
    try {
      const { data } = await api.create(payload);
      dispatch(fetchItems());  // Refresh list
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.error || 'Failed');
    }
  }
);

const slice = createSlice({
  name: 'resource',
  initialState: { items: [], loading: false, error: null },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchItems.pending, (state) => { state.loading = true; state.error = null; })
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

## Form Handling (React Hook Form + Yup)

```jsx
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';

const schema = yup.object({
  name: yup.string().required('Name is required'),
  email: yup.string().email('Invalid email').required(),
  amount: yup.number().min(0).required(),
});

function MyForm({ onSubmit, defaultValues }) {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    resolver: yupResolver(schema),
    defaultValues,
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <Input label="Name" {...register('name')} error={errors.name?.message} />
      <Button type="submit" loading={isSubmitting}>Save</Button>
    </form>
  );
}
```

---

## API Service Pattern

```javascript
// api/resourceApi.js
import api from './axios';

export const getAll = (params) => api.get('/resource', { params });
export const getOne = (id) => api.get(`/resource/${id}`);
export const create = (data) => api.post('/resource', data);
export const update = (id, data) => api.put(`/resource/${id}`, data);
export const remove = (id) => api.delete(`/resource/${id}`);

// File upload
export const uploadFile = (id, file) => {
  const form = new FormData();
  form.append('file', file);
  return api.post(`/resource/${id}/upload`, form, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
};
```

---

## DeepSeek AI Integration Pattern

```javascript
// Server-side only — never expose API key to frontend

// services/deepseekService.js
async function chat(systemPrompt, userPrompt, jsonMode = false) {
  const { data } = await client.post('/chat/completions', {
    model: 'deepseek-chat',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    ...(jsonMode && { response_format: { type: 'json_object' } }),
    temperature: 0.3,
  });
  return data.choices[0].message.content;
}

// Frontend calls: POST /api/ai/score-cv → server calls DeepSeek → returns result
```

---

## Error Handling

### Backend
```javascript
try {
  const [rows] = await pool.query('...', [...]);
  res.json(rows);
} catch (err) {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error' });
}
```

### Frontend
```javascript
try {
  await dispatch(createItem(formData)).unwrap();
  toast.success('Created successfully');
  closeModal();
} catch (error) {
  toast.error(error || 'Something went wrong');
}
```

---

## Security Considerations

- **JWT tokens** expire after 24 hours — `req.user` is always verified
- **bcrypt** password hashing (saltRounds = 10) — never store plain text
- **Parameterized queries** — SQL injection prevention
- **RBAC** — Route-level role checking via middleware
- **DeepSeek API key** — Server-side only, never exposed to client
- **CORS** — Restricted to frontend origin
- **helmet** — HTTP security headers
- **File upload** — 25MB limit, MIME type validation

---

## Performance Checklist

### Frontend
- [ ] `React.lazy` for route-level code splitting
- [ ] `React.memo` for list item components
- [ ] `useMemo` for filtered/sorted array computations
- [ ] `useCallback` for handlers passed to children
- [ ] Debounced search inputs (300ms)
- [ ] Skeleton loaders during API calls

### Backend
- [ ] MySQL connection pooling (connectionLimit: 10)
- [ ] Indexed columns for WHERE/ORDER clauses
- [ ] LIMIT/OFFSET pagination for large tables (audit_logs)
- [ ] SELECT only needed columns (avoid SELECT *)
- [ ] Use EXPLAIN to verify query plans
