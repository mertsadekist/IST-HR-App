import app from './app.js';
import pool from './config/db.js';
import { ensureSchema } from './config/ensureSchema.js';
import { verifySecrets } from './config/verifySecrets.js';
import { getAppSetting } from './services/appSettings.js';
import { applyDueSalaryChanges } from './services/salaryReviewService.js';
import { checkDomainRenewals } from './services/domainRenewalService.js';
import { checkDocumentExpiry } from './services/documentExpiryService.js';
import { checkEmployeeDocumentExpiry } from './services/employeeDocumentExpiryService.js';
import { liveTick, finalizeTick } from './services/hikSyncService.js';
import { sendSyncReport } from './services/attendanceSyncReport.js';
import { hikConfig, configProblems as hikConfigProblems } from './services/hikConfig.js';
import { closeHikPool } from './services/hikClient.js';
import { scheduleDailyAt } from './services/dailySchedule.js';

const PORT = process.env.PORT || 3001;

// A rejected promise nobody awaited (a route that took a connection outside its
// try block while the database was down) would otherwise terminate the process
// and put the container in a restart loop. Log it and keep serving.
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection:', reason instanceof Error ? reason.message : reason);
});

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
  // Employees' passports, visas, Emirates IDs and labour cards: same cadence,
  // kept in its own try so one failing does not silence the other.
  try {
    const sent = await checkEmployeeDocumentExpiry(pool);
    if (sent) console.log(`🛂 Employee document expiry check: ${sent} alert(s) sent`);
  } catch (err) {
    console.error('Employee document expiry check failed:', err.message);
  }
}

// Attendance from Hik Central, two cadences (see services/hikSyncService.js):
//
//  - every few minutes: recompute today's check-in / last-seen from the door
//    punches, so HR sees who is in as it happens. Never decides an absence.
//  - once a day (05:00 local): close the days that are over — absences, approved
//    leave, the schedule checks — and email the report.
//
// The daily claim lives in the database (see claimRun), so a redeploy at 05:30
// neither repeats the morning's work nor skips the day.
async function runHikLive() {
  try {
    await liveTick(pool);
  } catch (err) {
    console.error('Hik live sync failed:', err.message);
  }
}

async function runHikFinalize() {
  try {
    const result = await finalizeTick(pool, { sendReport: sendSyncReport });
    if (result.skipped) {
      if (result.reason) console.log(`🚪 Hik daily close: ${result.reason}`);
      return;
    }
    console.log(`🚪 Hik daily close (${result.status}): `
      + `${result.summary?.inserted || 0} new / ${result.summary?.updated || 0} updated row(s), `
      + `${(result.summary?.absences || []).length} absent`);
  } catch (err) {
    console.error('Hik daily close failed:', err.message);
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

  const hik = hikConfig();
  const hikProblems = hikConfigProblems(hik);
  if (!hikProblems.length) {
    if (hik.db.ssl === 'disable' && process.env.NODE_ENV === 'production') {
      console.warn('⚠️  HIK_DB_SSL=disable: the Hik database password and the punches cross the network unencrypted');
    }
    await runHikLive();
    setInterval(runHikLive, hik.schedule.intervalMinutes * 60 * 1000);
    scheduleDailyAt({
      hour: hik.schedule.finalizeHour,
      minute: hik.schedule.finalizeMinute,
      name: 'Hik Central daily close',
      onTick: runHikFinalize,
    });
  } else {
    console.log(`🚪 Hik Central sync: not configured (${hikProblems[0]}) — skipped`);
  }
});

// Release the Hik connection pool on shutdown so a redeploy does not leave
// sessions open on the access-control database.
for (const sig of ['SIGTERM', 'SIGINT']) {
  process.on(sig, () => { closeHikPool().finally(() => process.exit(0)); });
}
