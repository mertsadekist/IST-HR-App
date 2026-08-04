import app from './app.js';
import pool from './config/db.js';
import { ensureSchema } from './config/ensureSchema.js';
import { verifySecrets } from './config/verifySecrets.js';
import { getAppSetting } from './services/appSettings.js';
import { applyDueSalaryChanges } from './services/salaryReviewService.js';

const PORT = process.env.PORT || 3001;

// Validate the crypto secrets before binding a port: in production a weak or
// duplicated key must stop the deploy, not be discovered after credentials have
// been written under it. See docs/secrets_protection_design.md.
verifySecrets();

// Apply any approved salary-review items whose effective_date has arrived. Runs
// once at boot and then on an interval — a lightweight in-process scheduler
// (no cron dependency) matching the ensureSchema() self-heal pattern above.
// Assumes a single server instance (current Coolify deployment); see
// salaryReviewService.js for the note on why a second replica is a safe race.
async function runSalaryReviewScheduler() {
  try {
    const applied = await applyDueSalaryChanges(pool);
    if (applied) console.log(`💰 Salary review scheduler: applied ${applied} due salary change(s)`);
  } catch (err) {
    console.error('Salary review scheduler failed:', err.message);
  }
}

app.listen(PORT, async () => {
  console.log(`\n🚀 IST HR API Server running on http://localhost:${PORT}`);
  console.log(`📋 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🔑 Environment: ${process.env.NODE_ENV || 'development'}\n`);
  await ensureSchema(); // self-heal additive columns/tables (attendance_id, app_settings, salary_reviews…)
  // Operate in the configured timezone (UI setting → APP_TZ env → Asia/Dubai).
  const tz = await getAppSetting('timezone', process.env.APP_TZ || process.env.TZ || 'Asia/Dubai');
  if (tz) { process.env.TZ = tz; console.log(`🕒 App timezone: ${tz}`); }

  await runSalaryReviewScheduler();
  setInterval(runSalaryReviewScheduler, 6 * 60 * 60 * 1000); // every 6 hours
});
