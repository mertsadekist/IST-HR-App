# Authentication & Authorization

## Overview

JWT-based authentication with bcrypt password hashing and role-based access control (RBAC).

```
Frontend                    Backend                     MySQL
  │                           │                           │
  │ POST /api/auth/login      │                           │
  │ { username, password }    │                           │
  │ ──────────────────────►   │                           │
  │                           │ SELECT * FROM users       │
  │                           │ WHERE username = ?        │
  │                           │ ──────────────────────►   │
  │                           │ ◄──────────────────────   │
  │                           │ bcrypt.compare()          │
  │                           │ jwt.sign()                │
  │ ◄──────────────────────   │                           │
  │ { token, user }           │                           │
  │                           │                           │
  │ GET /api/companies        │                           │
  │ Authorization: Bearer xxx │                           │
  │ ──────────────────────►   │                           │
  │                           │ jwt.verify(token)         │
  │                           │ req.user = decoded        │
  │                           │ rbac check (role)         │
  │                           │ ──────────────────────►   │
  │ ◄──────────────────────   │ ◄──────────────────────   │
  │ [companies data]          │                           │
```

---

## User Table

```sql
CREATE TABLE users (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    username        VARCHAR(100) NOT NULL UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,           -- bcrypt hash
    name            VARCHAR(255) NOT NULL,
    email           VARCHAR(255) NULL,
    role            ENUM('admin', 'hr_manager', 'recruiter', 'employee') DEFAULT 'employee',
    company_id      INT NULL,                        -- NULL = ALL companies
    is_active       BOOLEAN DEFAULT TRUE,
    last_login_at   TIMESTAMP NULL,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL
);
```

---

## Password Handling

```javascript
import bcrypt from 'bcryptjs';

// Hash on create/reset
const hash = await bcrypt.hash(plainPassword, 10);

// Compare on login
const isValid = await bcrypt.compare(plainPassword, user.password_hash);
```

---

## JWT Token

```javascript
import jwt from 'jsonwebtoken';

// Sign on login
const token = jwt.sign(
  { id: user.id, role: user.role, company_id: user.company_id },
  process.env.JWT_SECRET,    // from .env
  { expiresIn: '24h' }      // from .env JWT_EXPIRES_IN
);

// Verify on every request
const decoded = jwt.verify(token, process.env.JWT_SECRET);
// decoded = { id: 1, role: 'admin', company_id: null, iat: ..., exp: ... }
```

---

## Middleware

### Auth Middleware

```javascript
// middleware/auth.js
export const auth = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  try {
    req.user = jwt.verify(header.split(' ')[1], process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};
```

### RBAC Middleware

```javascript
// middleware/rbac.js
export const authorize = (...allowedRoles) => (req, res, next) => {
  if (!allowedRoles.includes(req.user.role)) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }
  next();
};

// Usage: router.post('/', auth, authorize('admin', 'hr_manager'), handler);
```

---

## Roles & Permissions

| Role         | Dashboard | Recruitment | Employees | Legal | Reports | Audit | Users | Settings |
|-------------|-----------|-------------|-----------|-------|---------|-------|-------|----------|
| admin       | ✅        | ✅          | ✅        | ✅    | ✅      | ✅    | ✅    | ✅       |
| hr_manager  | ✅        | ✅          | ✅        | ✅    | ✅      | ❌    | ❌    | ❌       |
| recruiter   | ✅        | ✅          | ❌        | ❌    | Read    | ❌    | ❌    | ❌       |
| employee    | ✅ (own)  | ❌          | Own only  | ❌    | ❌      | ❌    | ❌    | ❌       |

---

## Frontend Auth Flow

### On App Load (App.jsx)

```javascript
useEffect(() => {
  const token = localStorage.getItem('ist_token');
  if (token) {
    dispatch(verifyToken()); // POST /api/auth/me
  } else {
    dispatch(setLoading(false));
  }
}, []);
```

### Login

```javascript
const handleLogin = async (formData) => {
  const result = await dispatch(loginUser(formData)).unwrap();
  // Token saved to localStorage in thunk
  // User object saved to Redux state
  navigate('/dashboard');
};
```

### Logout

```javascript
const handleLogout = () => {
  dispatch(logout());         // Clears Redux state
  localStorage.removeItem('ist_token');
  navigate('/login');
};
```

### Protected Route

```jsx
function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useSelector(state => state.auth);
  
  if (loading) return <LoadingScreen />;
  if (!isAuthenticated) return <Navigate to="/login" />;
  
  return children || <Outlet />;
}
```

---

## Security Notes

- **bcrypt** with salt rounds = 10 (recommended for password hashing)
- **JWT secret** stored in `.env`, never committed to git
- **Token expiry** set to 24 hours for session management
- **401 interceptor** in Axios auto-redirects to login on token expiry
- **Self-protection**: Admin cannot disable their own account
- **Password reset**: Admin generates new password → bcrypt hash → UPDATE
