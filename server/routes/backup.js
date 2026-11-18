import { Router } from 'express';
import pool from '../config/db.js';
import { auth } from '../middleware/auth.js';
import { authorize } from '../middleware/rbac.js';
import { isPlatformAdmin } from '../middleware/tenant.js';
import path from 'path';
import { addAudit } from '../services/auditService.js';
import { listBackups, runBackup, backupDir, BACKUP_FILE_RE } from '../services/nightlyBackup.js';

const router = Router();

// Whitelist of tables the backup feature may read/write. Any table name coming
// from a request body MUST be validated against this list before interpolation.
const BACKUP_TABLES = [
  'companies', 'departments', 'job_titles', 'skill_categories', 'skills',
  'users', 'employees', 'candidates', 'vacancies',
  'ats_stages', 'candidate_stage_history', 'candidate_skills',
  'onboarding_records', 'onboarding_steps', 'onboarding_checklist_items',
  'offboarding_records', 'offboarding_steps', 'offboarding_checklist_items',
  'asset_assignments', 'platform_catalog', 'asset_categories',
  'performance_targets', 'kpi_hires', 'kpi_hire_tiers',
  'letter_templates', 'generated_letters',
  'onboarding_step_templates', 'onboarding_step_template_items',
  'offboarding_step_templates', 'offboarding_step_template_items',
  'cv_scorer_profiles',
];
const BACKUP_TABLE_SET = new Set(BACKUP_TABLES);

// ─── Nightly backups on the server volume (services/nightlyBackup.js) ─────────
// Every company's data, password hashes included: a platform admin only.
const platformOnly = (req, res, next) => (isPlatformAdmin(req.user) ? next() : res.status(403).json({ error: 'Only a platform admin can reach the full backups' }));

router.get('/nightly', auth, authorize('admin'), platformOnly, (req, res) => {
  try { res.json({ backups: listBackups(), keep: Number(process.env.BACKUP_KEEP) || 14, enabled: process.env.NIGHTLY_BACKUP !== 'off' }); }
  catch (err) { console.error('GET /backup/nightly error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

router.post('/nightly/run', auth, authorize('admin'), platformOnly, async (req, res) => {
  try {
    const out = await runBackup(pool);
    await addAudit(pool, req.user, 'Backup', 'Backup Run', `${out.name}: ${out.tables} tables, ${out.rows} rows`);
    res.json(out);
  } catch (err) { console.error('POST /backup/nightly/run error:', err); res.status(500).json({ error: 'Backup failed' }); }
});

router.get('/nightly/:name', auth, authorize('admin'), platformOnly, async (req, res) => {
  const { name } = req.params;
  if (!BACKUP_FILE_RE.test(name)) return res.status(400).json({ error: 'Not a backup file' });
  await addAudit(pool, req.user, 'Backup', 'Backup Downloaded', name);
  res.download(path.join(backupDir(), name), name, (err) => {
    if (err && !res.headersSent) res.status(404).json({ error: 'Backup not found' });
  });
});

// GET /api/backup/export — Export all data as JSON backup
router.get('/export', auth, authorize('admin'), async (req, res) => {
  try {
    const tables = BACKUP_TABLES;

    const backup = { version: '2.0', exported_at: new Date().toISOString(), tables: {} };
    for (const table of tables) {
      try {
        const [rows] = await pool.query(`SELECT * FROM ${table}`);
        backup.tables[table] = rows;
      } catch {
        backup.tables[table] = [];
      }
    }

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=ist_hr_backup_${new Date().toISOString().slice(0, 10)}.json`);
    res.json(backup);
  } catch (err) {
    console.error('Backup export error:', err);
    res.status(500).json({ error: 'Export failed' });
  }
});

// POST /api/backup/import — Import data from JSON backup
router.post('/import', auth, authorize('admin'), async (req, res) => {
  try {
    const { tables } = req.body;
    const platform = isPlatformAdmin(req.user);
    if (!tables) return res.status(400).json({ error: 'No backup data provided' });

    const imported = [];
    const skipped = [];
    const rejected = [];

    for (const [table, rows] of Object.entries(tables)) {
      // Reject any table name not in the known whitelist (prevents SQL identifier injection / arbitrary writes)
      if (!BACKUP_TABLE_SET.has(table)) { rejected.push(table); continue; }
      if (!rows?.length) { skipped.push(table); continue; }
      try {
        // Insert rows one by one, skip duplicates
        let count = 0;
        for (const row of rows) {
          // users.js stops a company-bound admin from creating a platform admin; a
          // restore must not be a way around that.
          if (table === 'users' && !platform && (row.role === 'admin' || row.company_id == null)) continue;
          try {
            await pool.query(`INSERT IGNORE INTO ${table} SET ?`, row);
            count++;
          } catch { /* skip individual row errors */ }
        }
        imported.push({ table, count });
      } catch {
        skipped.push(table);
      }
    }

    res.json({ success: true, imported, skipped, rejected });
  } catch (err) {
    console.error('Backup import error:', err);
    res.status(500).json({ error: 'Import failed' });
  }
});

export default router;
