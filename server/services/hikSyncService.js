/**
 * The Hik Central attendance sync: reads door punches from the Hik database and
 * keeps each employee's day in `attendance` equal to "first punch in, last punch
 * out". See docs/attendance_hik_sync.md.
 *
 * ## Two kinds of pass, one code path
 *
 *  - **Live** (every few minutes): recomputes today and a short look-back window
 *    from the punches. Idempotent — a day is *recalculated*, never appended to —
 *    so running it twice, late, or while another pass is in flight cannot
 *    double-count anything. Writes only days somebody punched on.
 *
 *  - **Finalize** (once a day, and on demand): the same, plus the part that needs
 *    a day to be OVER: people who never punched on a working day become Absent
 *    (or On Leave), and the shadow schedule evaluator is run over the days.
 *
 * Absence is never inferred by a live pass. At 09:05 half the office has not
 * arrived yet; calling them absent would be wrong, and payroll deducts on it.
 *
 * Everything that touches the network is injected (`fetch`), so the decisions —
 * what is written, what is skipped and why — are testable against a real HR
 * database without a Hik server.
 */
import { addAudit } from './auditService.js';
import { getAppSetting, setAppSetting } from './appSettings.js';
import { notifyRole } from './notificationService.js';
import { hikConfig, configProblems } from './hikConfig.js';
import { fetchPunches } from './hikClient.js';
import {
  addDays, daysBetween, localDate, groupPunches, deriveDay, deriveAbsence, describeDay,
} from './hikRules.js';
import { resolveDayRule } from './workScheduleService.js';
import { effectiveEndDateSql } from './employmentWindow.js';
import { eachDate } from './attendanceEvaluator.js';
import {
  loadScheduleIndex, loadHolidays, loadLeave,
} from './attendanceEvaluationRunner.js';

const SOURCE = 'Hik Central';
const START_KEY = 'hik_sync_start_date';
const CAP = 200;   // lists in the summary are capped so one bad week cannot make it huge

let running = false;

/**
 * The floor for automatic passes: nothing before it is ever touched.
 *
 * Persisted the first time it is resolved. A floor recomputed from "today" on
 * every pass is not a floor — it slides forward with the calendar — which is the
 * bug the Drive sync's version of this had to be fixed for. An explicit
 * HIK_SYNC_START_DATE always wins, so it can be widened later.
 */
export async function resolveStartDate(pool, { today, cfg = hikConfig() } = {}) {
  if (cfg.schedule.startDate) return cfg.schedule.startDate;
  const stored = await getAppSetting(START_KEY, null);
  if (stored && /^\d{4}-\d{2}-\d{2}$/.test(stored)) return stored;
  await setAppSetting(START_KEY, today);
  return today;
}

/**
 * Claims the scheduled finalize for a date. Whoever inserts the row owns the run,
 * so a redeploy at 05:30 neither repeats the morning nor skips it.
 *
 * @returns {Promise<number|null>} run id, or null when it is already claimed
 */
export async function claimRun(pool, { trigger = 'Scheduled', runDate, actorId = null }) {
  const claimKey = trigger === 'Scheduled' ? `sched:${runDate}` : null;
  try {
    const [r] = await pool.query(
      'INSERT INTO hik_sync_runs (trigger_type, status, date_to, started_by, claim_key) VALUES (?, ?, ?, ?, ?)',
      [trigger, 'Running', runDate, actorId, claimKey]);
    return r.insertId;
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') return null;
    throw e;
  }
}

/** True when the stored row already says exactly what this pass would write. */
function sameAsStored(existing, next) {
  if (!existing || existing.source !== SOURCE) return false;
  return existing.ci === (next.check_in || null)
    && (existing.co || null) === (next.check_out || null)
    && existing.status === next.status
    && Number(existing.work_hours ?? -1) === Number(next.work_hours ?? -1)
    && (existing.late_minutes ?? null) === (next.late_minutes ?? null)
    && (existing.early_leave_minutes ?? null) === (next.early_leave_minutes ?? null)
    && Number(existing.punch_count || 0) === Number(next.punch_count || 0);
}

async function upsertAttendance(pool, emp, date, d, actorId) {
  await pool.query(
    `INSERT INTO attendance
       (company_id, employee_id, work_date, check_in, check_out, work_hours, status, notes,
        late_minutes, early_leave_minutes, scheduled_in, scheduled_out,
        source, source_status_code, sync_file_id, punch_count, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?)
     ON DUPLICATE KEY UPDATE
       check_in = VALUES(check_in), check_out = VALUES(check_out),
       work_hours = VALUES(work_hours), status = VALUES(status), notes = VALUES(notes),
       late_minutes = VALUES(late_minutes), early_leave_minutes = VALUES(early_leave_minutes),
       scheduled_in = VALUES(scheduled_in), scheduled_out = VALUES(scheduled_out),
       source = VALUES(source), source_status_code = NULL, sync_file_id = NULL,
       punch_count = VALUES(punch_count)`,
    [emp.company_id, emp.id, date,
      d.check_in ? `${date} ${d.check_in}` : null,
      d.check_out ? `${date} ${d.check_out}` : null,
      d.work_hours, d.status, d.notes,
      d.late_minutes ?? null, d.early_leave_minutes ?? null,
      d.scheduled_in ?? null, d.scheduled_out ?? null,
      SOURCE, d.punch_count ?? null, actorId]);
}

function emptySummary(from, to) {
  return {
    from, to, finalized: false,
    events_read: 0, people_seen: 0,
    inserted: 0, updated: 0, unchanged: 0, in_progress: 0,
    skipped_manual: [], kept_existing: 0, unmatched: [], ambiguous_ids: [], ignored: [],
    missing_checkout: [], absences: [], on_leave: [],
    not_observed_days: [], no_schedule: [], errors: [],
    newest_event: null,
  };
}

/**
 * One pass.
 *
 * @param {object} pool  mysql2 pool for the HR database
 * @param {object} opts
 * @param {'Live'|'Scheduled'|'Manual'|'Backfill'} opts.trigger
 * @param {boolean} opts.finalize        also close finished days (absences, evaluation)
 * @param {string|null} opts.from        explicit window (manual / backfill)
 * @param {string|null} opts.to
 * @param {boolean} opts.overwriteManual  replace hand-corrected rows
 * @param {boolean} opts.fillOnly        never replace a day that came from anywhere
 *                                       but Hik Central (Drive, a file, a person)
 * @param {Function} opts.fetch          injected for tests; defaults to the real reader
 * @param {Date} opts.now                injected for tests
 */
export async function runHikSync(pool, {
  trigger = 'Live', actorId = null, finalize = false, from = null, to = null,
  overwriteManual = false, fillOnly = false, fetch = fetchPunches, now = new Date(), cfg = hikConfig(),
  runId: claimedRunId = null,
} = {}) {
  const problems = configProblems(cfg);
  if (problems.length) {
    return { ok: false, skipped: true, reason: `Hik Central sync is not configured: ${problems[0]}`, run_id: null };
  }
  if (running) {
    return { ok: true, skipped: true, reason: 'A sync pass is already running', run_id: null };
  }
  running = true;

  const today = localDate(cfg.tz, now);
  let runId = claimedRunId;
  let summary = null;
  const startedAt = Date.now();

  try {
    // ── The window ──────────────────────────────────────────────────────────
    let winFrom;
    let winTo;
    if (from || to) {
      winFrom = from; winTo = to || today;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(winFrom)) || !/^\d{4}-\d{2}-\d{2}$/.test(String(winTo))) {
        throw new Error('The dates must be YYYY-MM-DD');
      }
      if (winTo > today) winTo = today;
      if (winFrom > winTo) throw new Error('"from" is after "to"');
      if (daysBetween(winFrom, winTo) + 1 > cfg.limits.maxBackfillDays) {
        throw new Error(`A range can cover at most ${cfg.limits.maxBackfillDays} days`);
      }
    } else {
      const floor = await resolveStartDate(pool, { today, cfg });
      winTo = today;
      winFrom = addDays(today, -cfg.schedule.lookbackDays);
      if (winFrom < floor) winFrom = floor;
      if (winFrom > winTo) {
        // The sync's start date is in the future: nothing to do, and that is fine.
        return { ok: true, skipped: true, reason: `Sync starts on ${floor}`, run_id: null };
      }
    }
    summary = emptySummary(winFrom, winTo);
    summary.finalized = finalize;

    // ── Read the punches ────────────────────────────────────────────────────
    const events = await fetch({ from: winFrom, to: winTo }, cfg);
    summary.events_read = events.length;
    for (const e of events) {
      if (!summary.newest_event || e.punched_at > summary.newest_event) summary.newest_event = e.punched_at;
    }
    const buckets = groupPunches(events);
    summary.people_seen = new Set([...buckets.values()].map((b) => b.person_id)).size;
    const observed = new Set([...buckets.values()].map((b) => b.date));

    // ── Who they are ────────────────────────────────────────────────────────
    const [emps] = await pool.query(
      `SELECT e.id, e.company_id, e.attendance_id, e.first_name, e.last_name, e.status,
              DATE_FORMAT(e.start_date, '%Y-%m-%d') AS start_date,
              ${effectiveEndDateSql('e')} AS end_date
         FROM employees e WHERE e.attendance_id IS NOT NULL AND e.attendance_id <> ''`);
    const byDevice = new Map();
    const ambiguous = new Set();
    for (const e of emps) {
      const k = String(e.attendance_id).trim();
      if (byDevice.has(k)) ambiguous.add(k); else byDevice.set(k, e);
    }
    // Two employees sharing one device id cannot be told apart. Writing the
    // punches to either would be a guess about whose day it was.
    for (const k of ambiguous) byDevice.delete(k);
    summary.ambiguous_ids = [...ambiguous];

    const [ignoredRows] = await pool.query('SELECT device_id FROM attendance_ignored_devices');
    const ignored = new Set(ignoredRows.map((i) => String(i.device_id).trim()));

    const nameOf = (e) => `${e.first_name} ${e.last_name}`.trim();
    const unmatched = new Map();
    const matched = [];
    for (const b of buckets.values()) {
      if (ignored.has(b.person_id)) { summary.ignored.push(b.person_id); continue; }
      const emp = byDevice.get(b.person_id);
      if (!emp) {
        if (ambiguous.has(b.person_id)) continue;
        const u = unmatched.get(b.person_id)
          || { person_id: b.person_id, name: b.person_name, days: 0, punches: 0 };
        u.days++; u.punches += b.times.length;
        if (!u.name && b.person_name) u.name = b.person_name;
        unmatched.set(b.person_id, u);
        continue;
      }
      matched.push({ bucket: b, emp });
    }
    summary.unmatched = [...unmatched.values()].slice(0, CAP);
    summary.ignored = [...new Set(summary.ignored)];

    // ── What each of them was supposed to be doing ──────────────────────────
    const trackable = emps.filter((e) => byDevice.get(String(e.attendance_id).trim()) === e
      && ['Active', 'Onboarding', 'Offboarding'].includes(e.status));
    const scheduleFor = await loadScheduleIndex(emps.filter((e) => byDevice.has(String(e.attendance_id).trim())), pool);
    const holidayFor = await loadHolidays(winFrom, winTo, pool);
    const leaveFor = await loadLeave(trackable, winFrom, winTo, pool);

    const empIds = [...new Set([...matched.map((m) => m.emp.id), ...(finalize ? trackable.map((e) => e.id) : [])])];
    const existing = new Map();
    if (empIds.length) {
      const [rows] = await pool.query(
        `SELECT employee_id, DATE_FORMAT(work_date, '%Y-%m-%d') AS d, source, status,
                TIME_FORMAT(check_in, '%H:%i:%s') AS ci, TIME_FORMAT(check_out, '%H:%i:%s') AS co,
                work_hours, late_minutes, early_leave_minutes, punch_count
           FROM attendance WHERE work_date BETWEEN ? AND ? AND employee_id IN (?)`,
        [winFrom, winTo, empIds]);
      for (const r of rows) existing.set(`${r.employee_id}|${r.d}`, r);
    }

    // ── Days somebody punched on ────────────────────────────────────────────
    const punchedKeys = new Set();
    for (const { bucket, emp } of matched) {
      const date = bucket.date;
      const key = `${emp.id}|${date}`;
      punchedKeys.add(key);

      const resolved = scheduleFor(emp, date);
      const schedule = resolved?.schedule || null;
      const dayRule = schedule ? resolveDayRule(schedule, date) : null;
      const d = deriveDay({
        times: bucket.times, date, today, schedule, dayRule,
        minStayMinutes: cfg.rules.minStayMinutes,
      });
      d.notes = describeDay(d);

      if (d.in_progress) summary.in_progress++;
      if (d.missing_checkout && summary.missing_checkout.length < CAP) {
        summary.missing_checkout.push({ employee: nameOf(emp), date, check_in: d.check_in });
      }

      const prev = existing.get(key);
      if (prev?.source === 'Manual' && !overwriteManual) {
        summary.skipped_manual.push({ employee: nameOf(emp), date });
        continue;
      }
      if (fillOnly && prev && prev.source !== SOURCE) { summary.kept_existing++; continue; }
      if (sameAsStored(prev, d)) { summary.unchanged++; continue; }

      try {
        await upsertAttendance(pool, emp, date, d, actorId);
        if (prev) summary.updated++; else summary.inserted++;
        existing.set(key, { ...prev, source: SOURCE, status: d.status, ci: d.check_in, co: d.check_out,
          work_hours: d.work_hours, late_minutes: d.late_minutes, early_leave_minutes: d.early_leave_minutes,
          punch_count: d.punch_count });
      } catch (e) {
        summary.errors.push({ employee: nameOf(emp), date, message: e.message });
      }
    }

    // ── Days nobody punched on, once they are over ──────────────────────────
    if (finalize) {
      const finished = eachDate(winFrom, winTo).filter((d) => d < today);
      for (const date of finished) {
        if (!observed.has(date)) {
          // The feed said nothing at all about this day. Not an empty office.
          summary.not_observed_days.push(date);
          continue;
        }
        for (const emp of trackable) {
          if (emp.start_date && date < emp.start_date) continue;
          if (emp.end_date && date > emp.end_date) continue;
          const key = `${emp.id}|${date}`;
          if (punchedKeys.has(key)) continue;

          const prev = existing.get(key);
          // A hand-made row, a CSV import or an old Drive row is somebody's
          // decision about the day; a Hik row WITH punches is the feed's own
          // evidence. Only an earlier Hik absence may be revisited (say, because
          // leave was approved afterwards).
          if (prev && (prev.source !== SOURCE || Number(prev.punch_count || 0) > 0)) continue;

          const resolved = scheduleFor(emp, date);
          const schedule = resolved?.schedule || null;
          const dayRule = schedule ? resolveDayRule(schedule, date) : null;
          const verdict = deriveAbsence({
            schedule, dayRule,
            holiday: holidayFor(emp.company_id, date),
            leave: leaveFor(emp.id, date),
            observed: true,
          });
          if (verdict.skip) {
            if (verdict.skip === 'no_schedule' && summary.no_schedule.length < CAP
              && !summary.no_schedule.includes(nameOf(emp))) summary.no_schedule.push(nameOf(emp));
            continue;
          }

          const row = {
            check_in: null, check_out: null, work_hours: null, status: verdict.status,
            late_minutes: null, early_leave_minutes: null,
            scheduled_in: dayRule?.start_time ?? null, scheduled_out: dayRule?.end_time ?? null,
            punch_count: 0,
            notes: verdict.status === 'On Leave'
              ? `no door punches · approved leave: ${verdict.leave_type}`
              : `no door punches${verdict.partial_leave ? ` · only part of the day covered by ${verdict.leave_type}` : ''}`,
          };
          if (prev && prev.status === row.status) { summary.unchanged++; continue; }
          try {
            await upsertAttendance(pool, emp, date, row, actorId);
            existing.set(key, { source: SOURCE, status: row.status, punch_count: 0 });
            const entry = { employee: nameOf(emp), date };
            if (row.status === 'On Leave') {
              if (summary.on_leave.length < CAP) summary.on_leave.push({ ...entry, leave_type: verdict.leave_type });
            } else if (summary.absences.length < CAP) summary.absences.push(entry);
            if (prev) summary.updated++; else summary.inserted++;
          } catch (e) {
            summary.errors.push({ ...{ employee: nameOf(emp), date }, message: e.message });
          }
        }
      }
    }

    // ── Bookkeeping ─────────────────────────────────────────────────────────
    await setAppSetting('hik_last_sync_at', new Date().toISOString());
    await setAppSetting('hik_last_error', '');
    if (summary.newest_event) await setAppSetting('hik_last_event_at', summary.newest_event);

    const changed = summary.inserted + summary.updated > 0;
    const failed = summary.errors.length > 0;

    // Judge the finished days against the schedule, in shadow mode. After the
    // import is safely recorded and wrapped: the evaluator observes, and a fault
    // in it must never lose a day that was imported.
    if (finalize) {
      try {
        const { runEvaluation } = await import('./attendanceEvaluationRunner.js');
        const days = eachDate(winFrom, winTo).filter((d) => d < today);
        if (days.length) {
          summary.evaluation = await runEvaluation({
            from: days[0], to: days[days.length - 1], trigger: 'Post-Sync', shadow: true,
          });
        }
      } catch (e) {
        console.error('post-sync evaluation failed (the sync itself is unaffected):', e.message);
        summary.evaluation_error = e.message;
      }
    }

    const status = failed ? 'Failed' : 'Completed';
    const absences = summary.absences.length + summary.on_leave.length;
    const runError = failed ? String(summary.errors[0].message).slice(0, 1000) : null;
    const summaryJson = JSON.stringify(summary);
    // A Live pass that changed nothing is not worth a row: at one pass every few
    // minutes the table would be 99% "nothing happened".
    const worthRecording = trigger !== 'Live' || changed || failed;
    if (runId) {
      await pool.query(
        `UPDATE hik_sync_runs SET status = ?, date_from = ?, date_to = ?, events_read = ?, rows_inserted = ?,
                rows_updated = ?, rows_unchanged = ?, absences = ?, summary = ?, error = ?, finished_at = NOW()
          WHERE id = ?`,
        [status, winFrom, winTo, summary.events_read, summary.inserted, summary.updated, summary.unchanged,
          absences, summaryJson, runError, runId]);
    } else if (worthRecording) {
      const [r] = await pool.query(
        `INSERT INTO hik_sync_runs (trigger_type, status, date_from, date_to, events_read, rows_inserted,
                rows_updated, rows_unchanged, absences, summary, error, started_by, finished_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [trigger, status, winFrom, winTo, summary.events_read, summary.inserted, summary.updated,
          summary.unchanged, absences, summaryJson, runError, actorId]);
      runId = r.insertId;
    }

    if (trigger !== 'Live') {
      await addAudit(pool, { id: actorId, name: actorId ? undefined : 'System (Hik Central sync)' },
        'Attendance', 'Hik Sync',
        `${trigger} sync ${winFrom}..${winTo}: ${summary.inserted} new / ${summary.updated} updated / `
        + `${summary.unchanged} unchanged row(s)`
        + (summary.unmatched.length ? `, ${summary.unmatched.length} unmatched person id(s)` : '')
        + (overwriteManual ? ', WITH overwrite of hand-corrected rows' : ''));
    }

    return {
      ok: !failed, run_id: runId, status, summary, took_ms: Date.now() - startedAt,
    };
  } catch (err) {
    const message = String(err?.message || err).slice(0, 1000);
    try { await setAppSetting('hik_last_error', message); } catch { /* best effort */ }
    if (runId) {
      await pool.query(
        "UPDATE hik_sync_runs SET status = 'Failed', error = ?, summary = ?, finished_at = NOW() WHERE id = ?",
        [message, JSON.stringify(summary || {}), runId]).catch(() => {});
    } else {
      await pool.query(
        `INSERT INTO hik_sync_runs (trigger_type, status, date_from, date_to, summary, error, started_by, finished_at)
         VALUES (?, 'Failed', ?, ?, ?, ?, ?, NOW())`,
        [trigger, summary?.from || null, summary?.to || null, JSON.stringify(summary || {}), message, actorId])
        .then(([r]) => { runId = r.insertId; }).catch(() => {});
    }
    return { ok: false, run_id: runId, status: 'Failed', error: message };
  } finally {
    running = false;
  }
}

// ─── What the server's timers call ───────────────────────────────────────────

const ALERT_AFTER = 3;          // consecutive failed live passes before anyone is told
let consecutiveFailures = 0;

async function tellAdmins(pool, { type, title, body }) {
  const [companies] = await pool.query("SELECT id FROM companies WHERE status = 'Active'");
  for (const c of companies) {
    await notifyRole(pool, c.id, ['admin', 'hr_manager'], { type, title, body, link: '/attendance/sync' })
      .catch(() => {});
  }
}

/**
 * The every-few-minutes pass. Quiet when all is well; when it has failed
 * several times running it says so once, and says so again when it recovers.
 */
export async function liveTick(pool) {
  const result = await runHikSync(pool, { trigger: 'Live' });
  if (result.skipped) return result;

  if (!result.ok) {
    consecutiveFailures++;
    console.error(`🚪 Hik live sync failed (${consecutiveFailures} in a row): ${result.error}`);
    if (consecutiveFailures === ALERT_AFTER) {
      await tellAdmins(pool, {
        type: 'error',
        title: 'Hik Central sync is failing',
        body: `Attendance is not updating. ${String(result.error || '').slice(0, 200)}`,
      });
    }
  } else {
    if (consecutiveFailures >= ALERT_AFTER) {
      await tellAdmins(pool, {
        type: 'info', title: 'Hik Central sync recovered',
        body: 'Attendance is updating again.',
      });
    }
    consecutiveFailures = 0;
    const s = result.summary;
    if (s.inserted + s.updated > 0) {
      console.log(`🚪 Hik live sync: ${s.inserted} new / ${s.updated} updated row(s) (${s.events_read} punches read)`);
    }
  }
  return result;
}

/**
 * The once-a-day pass: closes yesterday, then emails the report. The run claim is
 * taken first, so two instances (or a redeploy) cannot both do the morning.
 */
export async function finalizeTick(pool, { sendReport } = {}) {
  const cfg = hikConfig();
  if (configProblems(cfg).length) return { ok: false, skipped: true };
  const today = localDate(cfg.tz);
  const runId = await claimRun(pool, { trigger: 'Scheduled', runDate: today });
  if (!runId) {
    return { ok: true, skipped: true, reason: `The scheduled run for ${today} has already happened` };
  }
  const result = await runHikSync(pool, { trigger: 'Scheduled', finalize: true, runId, cfg });
  if (result.skipped) {
    // Only reachable if another pass was mid-flight; release the claim so the
    // next opportunity (or a manual run) is not locked out of the day.
    await pool.query('DELETE FROM hik_sync_runs WHERE id = ?', [runId]).catch(() => {});
    return result;
  }
  if (sendReport) {
    await sendReport(pool, {
      status: result.status, summary: result.summary, runDate: today, error: result.error,
    }).catch((e) => console.error('Hik sync report failed:', e.message));
  }
  return result;
}
