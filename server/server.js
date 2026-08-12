import app from './app.js';
import pool from './config/db.js';
import { ensureSchema } from './config/ensureSchema.js';
import { verifySecrets } from './config/verifySecrets.js';
import { getAppSetting } from './services/appSettings.js';
import { applyDueSalaryChanges } from './services/salaryReviewService.js';
import { checkDomainRenewals } from './services/domainRenewalService.js';
import { checkDocumentExpiry } from './services/documentExpiryService.js';
import { runSync } from './services/attendanceSyncService.js';
import { sendSyncReport } from './services/attendanceSyncReport.js';
import { isConfigured as driveConfigured } from './services/googleDriveClient.js';
import { scheduleDailyAt } from './services/dailySchedule.js';

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

// Warn before a domain lapses. A lapsed domain takes the website, company email
// and every social login depending on it down at once, and the only warning is a
// date nobody is looking at. Notifies once per threshold, not once per run.
async function runDomainRenewalCheck() {
  try {
    const sent = await checkDomainRenewals(pool);
    if (sent) console.log(`🌐 Domain renewal check: ${sent} alert(s) sent`);
  } catch (err) {
    console.error('Domain renewal check failed:', err.message);
  }
}

// Warn before a trade licence, lease or insurance policy lapses. Same
// once-per-threshold rule as domains, on wider notice: licences need paperwork
// and approvals, not a card payment.
async function runDocumentExpiryCheck() {
  try {
    const sent = await checkDocumentExpiry(pool);
    if (sent) console.log(`📄 Document expiry check: ${sent} alert(s) sent`);
  } catch (err) {
    console.error('Document expiry check failed:', err.message);
  }
}

// Pull yesterday's attendance from the Drive folder, once a day at 05:00 local.
// A time-of-day job rather than the 6-hourly interval the others use: the file
// lands overnight and HR wants it waiting for them, not "some time today".
//
// The run claim lives in the database (see claimRun), so a redeploy at 05:30
// neither repeats the morning's work nor skips the day.
async function runAttendanceDriveSync() {
  if (!driveConfigured()) return;   // not set up yet; say nothing every morning
  const runDate = new Date().toISOString().slice(0, 10);
  try {
    const result = await runSync(pool, { trigger: 'Scheduled', runDate });
    if (result.skipped) {
      if (result.reason) console.log(`📥 Attendance sync: ${result.reason}`);
      return;
    }
    console.log(`📥 Attendance sync (${result.status}): `
      + `${result.summary?.files_imported || 0} file(s), `
      + `${result.summary?.inserted || 0} new / ${result.summary?.updated || 0} updated row(s)`);
    await sendSyncReport(pool, {
      status: result.status, summary: result.summary, runDate, error: result.error,
    });
  } catch (err) {
    console.error('Attendance Drive sync failed:', err.message);
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

  await runDomainRenewalCheck();
  setInterval(runDomainRenewalCheck, 6 * 60 * 60 * 1000); // every 6 hours

  await runDocumentExpiryCheck();
  setInterval(runDocumentExpiryCheck, 6 * 60 * 60 * 1000); // every 6 hours

  if (driveConfigured()) {
    scheduleDailyAt({
      hour: Number(process.env.ATTENDANCE_SYNC_HOUR || 5),
      minute: Number(process.env.ATTENDANCE_SYNC_MINUTE || 0),
      name: 'Attendance Drive sync',
      onTick: runAttendanceDriveSync,
    });
  } else {
    console.log('📥 Attendance Drive sync: not configured (GOOGLE_DRIVE_SA_* unset) — skipped');
  }
});
