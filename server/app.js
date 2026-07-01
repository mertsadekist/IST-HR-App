import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from project root
dotenv.config({ path: join(__dirname, '..', '.env') });

// Import routes
import multer from 'multer';
import { rateLimit } from './middleware/rateLimit.js';
import authRoutes from './routes/auth.js';
import companiesRoutes from './routes/companies.js';
import departmentsRoutes from './routes/departments.js';
import jobTitlesRoutes from './routes/jobTitles.js';
import skillsRoutes from './routes/skills.js';
import usersRoutes from './routes/users.js';
import auditRoutes from './routes/audit.js';
import aiRoutes from './routes/ai.js';
import settingsRoutes from './routes/settings.js';
import dashboardRoutes from './routes/dashboard.js';
import vacanciesRoutes from './routes/vacancies.js';
import candidatesRoutes from './routes/candidates.js';
import employeesRoutes from './routes/employees.js';
import onboardingRoutes from './routes/onboarding.js';
import onboardingV2Routes from './routes/onboardingV2.js';
import assetsRoutes from './routes/assets.js';
import offboardingRoutes from './routes/offboarding.js';
import legalRoutes from './routes/legal.js';
import documentsRoutes from './routes/documents.js';
import reportsRoutes from './routes/reports.js';
import performanceRoutes from './routes/performance.js';
import kpiRoutes from './routes/kpi.js';
import cvScorerRoutes from './routes/cvScorer.js';
import backupRoutes from './routes/backup.js';
import migrateRoutes from './routes/migrate.js';
import inventoryRoutes from './routes/inventory.js';
import portalRoutes from './routes/portal.js';
import emailRoutes from './routes/email.js';
import leaveRoutes from './routes/leave.js';
import attendanceRoutes from './routes/attendance.js';
import payrollRoutes from './routes/payroll.js';
import notificationsRoutes from './routes/notifications.js';
import publicRoutes from './routes/public.js';
import applicationsRoutes from './routes/applications.js';
import salaryReviewsRoutes from './routes/salaryReviews.js';

const app = express();

// Behind Coolify/Traefik (or any reverse proxy): trust X-Forwarded-* so req.ip,
// req.protocol and rate limiting see the real client IP / scheme.
app.set('trust proxy', 1);

// Middleware
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? process.env.CLIENT_URL
    : ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true,
}));
app.use(helmet({
  crossOriginResourcePolicy: false,
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      // TLS terminates at the reverse proxy and the app is also reachable over
      // plain HTTP (e.g. Coolify's *.sslip.io fallback). Do NOT force browsers
      // to upgrade same-origin asset requests to https — that breaks asset
      // loading (503/CORS) when the page itself is served over http.
      'upgrade-insecure-requests': null,
    },
  },
}));
app.use(morgan('dev'));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// Global rate limit (per IP) — defence-in-depth against abuse/DoS
app.use('/api/', rateLimit({ windowMs: 60_000, max: 300 }));

// Stricter limit on authentication to slow brute-force attempts
app.use('/api/auth/login', rateLimit({
  windowMs: 15 * 60_000,
  max: 10,
  message: 'Too many login attempts. Please try again in a few minutes.',
}));

// Tight limits on AI endpoints (cost) and email (abuse)
app.use('/api/ai/', rateLimit({ windowMs: 60_000, max: 30 }));
app.use('/api/cv-scorer/', rateLimit({ windowMs: 60_000, max: 30 }));
app.use('/api/email/', rateLimit({ windowMs: 60_000, max: 60 }));

// Public recruitment endpoints (NO auth) — stricter per-IP rate limit
app.use('/api/public', rateLimit({ windowMs: 60_000, max: 40, message: 'Too many requests. Please slow down.' }), publicRoutes);

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/companies', companiesRoutes);
app.use('/api/departments', departmentsRoutes);
app.use('/api/job-titles', jobTitlesRoutes);
app.use('/api/skills', skillsRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/vacancies', vacanciesRoutes);
app.use('/api/candidates', candidatesRoutes);
app.use('/api/employees', employeesRoutes);
app.use('/api/onboarding/v2', onboardingV2Routes); // stage-based rebuild (must precede legacy mount)
app.use('/api/onboarding', onboardingRoutes);
app.use('/api/assets', assetsRoutes);
app.use('/api/offboarding', offboardingRoutes);
app.use('/api/legal', legalRoutes);
app.use('/api/documents', documentsRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/performance', performanceRoutes);
app.use('/api/kpi', kpiRoutes);
app.use('/api/cv-scorer', cvScorerRoutes);
app.use('/api/backup', backupRoutes);
app.use('/api/migrate', migrateRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/portal', portalRoutes);
app.use('/api/email', emailRoutes);
app.use('/api/leave', leaveRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/payroll', payrollRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/applications', applicationsRoutes);
app.use('/api/salary-reviews', salaryReviewsRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 404 handler for unmatched API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.originalUrl} not found` });
});

// ── Serve the built React client (single-container production deploy) ─────────
// CLIENT_DIST defaults to ../client/dist; set it explicitly in the container.
const CLIENT_DIST = process.env.CLIENT_DIST || join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(join(CLIENT_DIST, 'index.html'))) {
  app.use(express.static(CLIENT_DIST));
  // SPA fallback — every non-API route returns index.html (client-side routing).
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(join(CLIENT_DIST, 'index.html'));
  });
  console.log(`🗂️  Serving client from ${CLIENT_DIST}`);
}

// Global error handler
app.use((err, req, res, next) => {
  // Multer / upload errors → 400 (bad request) rather than 500
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: `Upload error: ${err.message}` });
  }
  if (err && /Unsupported file type/i.test(err.message || '')) {
    return res.status(400).json({ error: err.message });
  }
  // Malformed JSON body
  if (err && err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }
  // Payload too large
  if (err && err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Request body too large' });
  }
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

export default app;
