/**
 * The two pieces that decide *when* the sync happens: the time-of-day maths and
 * the run claim.
 *
 * The claim is the one that matters operationally — it is what stops a redeploy
 * at 05:30 from importing the morning twice, and what still lets a person retry
 * a file as often as they need.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pool from '../config/db.js';
import { msUntilNext } from '../services/dailySchedule.js';
import { claimRun, resolveStartDate } from '../services/attendanceSyncService.js';
import { shadowProgress } from '../services/attendanceEvaluationRunner.js';
import { buildSyncReport } from '../services/attendanceSyncReport.js';

describe('msUntilNext', () => {
  const at = (h, m) => new Date(2026, 7, 10, h, m, 0, 0); // 10 Aug 2026, local

  it('waits until later today when the hour has not passed', () => {
    expect(msUntilNext(5, 0, at(2, 0))).toBe(3 * 3600_000);
  });

  it('rolls to tomorrow once the hour has passed', () => {
    expect(msUntilNext(5, 0, at(6, 0))).toBe(23 * 3600_000);
  });

  it('rolls over rather than firing instantly when it is exactly the time', () => {
    const ms = msUntilNext(5, 0, at(5, 0));
    expect(ms).toBe(24 * 3600_000);
  });

  it('is always in the future', () => {
    for (const h of [0, 4, 5, 13, 23]) {
      expect(msUntilNext(5, 0, at(h, 30))).toBeGreaterThan(0);
    }
  });

  it('honours the minute', () => {
    expect(msUntilNext(5, 30, at(5, 0))).toBe(30 * 60_000);
  });
});

describe('claimRun — exactly once for the schedule, unlimited for people', () => {
  const RUN_DATE = '2099-01-01';   // far future, cannot collide with real runs
  const created = [];

  afterAll(async () => {
    if (created.length) {
      await pool.query(`DELETE FROM attendance_sync_runs WHERE id IN (${created.map(() => '?').join(',')})`, created);
    }
  });

  it('lets the first scheduled run through', async () => {
    const id = await claimRun(pool, { trigger: 'Scheduled', runDate: RUN_DATE });
    expect(id).toBeTruthy();
    created.push(id);
  });

  it('refuses a second scheduled run for the same day', async () => {
    // This is the redeploy case: the container restarts and tries again.
    const again = await claimRun(pool, { trigger: 'Scheduled', runDate: RUN_DATE });
    expect(again).toBeNull();
  });

  it('still allows the next day', async () => {
    const id = await claimRun(pool, { trigger: 'Scheduled', runDate: '2099-01-02' });
    expect(id).toBeTruthy();
    created.push(id);
  });

  it('never blocks a manual run or a retry, however many', async () => {
    for (const trigger of ['Manual', 'Retry', 'Retry', 'Manual']) {
      const id = await claimRun(pool, { trigger, runDate: RUN_DATE });
      expect(id).toBeTruthy();
      created.push(id);
    }
  });
});

describe('the morning email', () => {
  const summary = {
    files: ['2026-08-10'], files_imported: 1, inserted: 20, updated: 2,
    unmatched: [{ device_id: '4001', name: 'Majd Barshiny', status: 'No punches' }],
    skipped_manual: [{ employee: 'Mert Sadek', date: '2026-08-10' }],
    reclassified_leave: [{ employee: 'Yatra Mulmi', date: '2026-08-10', leave_type: 'Annual Leave' }],
    missing_punch: [{ employee: 'Shinaritah', date: '2026-08-10', check_in: '10:19:13' }],
    company_mismatch: [{ employee: 'Mert Sadek', file_says: 'IST Markets', record_company_id: 1 }],
    errors: [],
  };

  it('leads with what happened', () => {
    const r = buildSyncReport({ status: 'Completed', summary, runDate: '2026-08-11' });
    expect(r.subject).toMatch(/1 file\(s\) imported/);
    expect(r.html).toContain('20');
    expect(r.html).toContain('2026-08-10');
  });

  it('lists every category that needs a human', () => {
    const { html } = buildSyncReport({ status: 'Completed', summary, runDate: '2026-08-11' });
    expect(html).toMatch(/Unknown device IDs/);
    expect(html).toContain('Majd Barshiny');
    expect(html).toMatch(/Recorded as leave instead of absence/);
    expect(html).toContain('Annual Leave');
    expect(html).toMatch(/Checked in but never out/);
    expect(html).toMatch(/Left alone — corrected by hand/);
    expect(html).toMatch(/Company differs/);
  });

  it('escapes names rather than letting them into the markup', () => {
    const { html } = buildSyncReport({
      status: 'Completed', runDate: '2026-08-11',
      summary: { ...summary, unmatched: [{ device_id: '1', name: '<script>x</script>' }] },
    });
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('says plainly when no file arrived, because silence hides a dead feed', () => {
    const r = buildSyncReport({ status: 'No File', summary: {}, runDate: '2026-08-11' });
    expect(r.subject).toMatch(/no new file/i);
    expect(r.html).toMatch(/No new attendance file was found/);
  });

  it('carries the reason and the retry route when it failed', () => {
    const r = buildSyncReport({
      status: 'Failed', summary: {}, runDate: '2026-08-11', error: 'Drive returned 403',
    });
    expect(r.subject).toMatch(/failed/i);
    expect(r.html).toContain('Drive returned 403');
    expect(r.html).toMatch(/retry/i);
  });

  it('has a plain-text alternative for clients that will not render html', () => {
    const r = buildSyncReport({ status: 'Completed', summary, runDate: '2026-08-11' });
    expect(r.text).toContain('4001');
    expect(r.text).not.toContain('<');
  });
});

describe('the morning email carries the schedule checks', () => {
  const withEval = {
    files: ['2026-08-13'], files_imported: 1, inserted: 20, updated: 0,
    unmatched: [], skipped_manual: [], reclassified_leave: [], missing_punch: [],
    company_mismatch: [], errors: [],
    evaluation: {
      days_evaluated: 24, exceptions_opened: 3, exceptions_closed: 1, disagreements: 5,
      shadow: { started_at: '2026-08-13', day: 1, total_days: 28, complete: false },
      days_not_observed: [],
      opened_cases: [
        { employee: 'Sara Hashem', date: '2026-08-13', type: 'ABSENT_NO_RECORD', severity: 'Blocking', detail: 'x' },
        { employee: 'Mayas Barshiny', date: '2026-08-13', type: 'LATE_ARRIVAL', severity: 'Review', detail: 'x' },
        { employee: 'Nawar Eskef', date: '2026-08-13', type: 'EARLY_DEPARTURE', severity: 'Review', detail: 'x' },
      ],
    },
  };

  it('says twice that nothing was applied', () => {
    // The section is full of the words "absent" and "late" against real names.
    // Somebody skimming it at six in the morning must not think a decision was
    // taken about anyone.
    const { html } = buildSyncReport({ status: 'Completed', summary: withEval, runDate: '2026-08-13' });
    expect(html).toMatch(/shadow mode/i);
    expect(html).toMatch(/Nothing below has been applied/i);
    expect(html).toMatch(/No attendance record, status or payroll figure was changed/i);
  });

  it('shows how far through the observation period we are', () => {
    const { html } = buildSyncReport({ status: 'Completed', summary: withEval, runDate: '2026-08-13' });
    expect(html).toContain('Day 1 of 28');
  });

  it('names the blocking cases but only counts the rest', () => {
    const { html } = buildSyncReport({ status: 'Completed', summary: withEval, runDate: '2026-08-13' });
    expect(html).toContain('Sara Hashem');
    expect(html).not.toContain('Mayas Barshiny');
    expect(html).toMatch(/and 2 for review/);
    expect(html).toMatch(/late arrival/);
  });

  it('says plainly when the engine agreed with everything', () => {
    const quiet = { ...withEval, evaluation: { ...withEval.evaluation, exceptions_opened: 0, disagreements: 0, opened_cases: [] } };
    const { html } = buildSyncReport({ status: 'Completed', summary: quiet, runDate: '2026-08-13' });
    expect(html).toMatch(/agreed with every day/i);
  });

  it('reports a day the file did not cover, so nobody reads absence into it', () => {
    const gap = { ...withEval, evaluation: { ...withEval.evaluation, days_not_observed: ['2026-08-13'] } };
    const { html } = buildSyncReport({ status: 'Completed', summary: gap, runDate: '2026-08-13' });
    expect(html).toMatch(/nobody was marked absent for those days/i);
  });

  it('omits the whole section when the checks did not run', () => {
    const { html } = buildSyncReport({
      status: 'Completed', summary: { ...withEval, evaluation: undefined }, runDate: '2026-08-13' });
    expect(html).not.toMatch(/Schedule checks/);
  });

  it('says so when the checks failed, and that the import survived', () => {
    const { html } = buildSyncReport({
      status: 'Completed',
      summary: { ...withEval, evaluation: undefined, evaluation_error: 'connection lost' },
      runDate: '2026-08-13',
    });
    expect(html).toContain('connection lost');
    expect(html).toMatch(/import itself is unaffected/i);
  });

  it('carries the summary into the plain-text alternative too', () => {
    const { text } = buildSyncReport({ status: 'Completed', summary: withEval, runDate: '2026-08-13' });
    expect(text).toMatch(/shadow mode, nothing applied/i);
    expect(text).toContain('3 new case(s)');
  });
});

describe('the shadow period is a fixed window, not a rolling one', () => {
  const KEY = 'attendance_shadow_started_at';
  beforeAll(async () => { await pool.query('DELETE FROM app_settings WHERE k = ?', [KEY]).catch(() => {}); });
  afterAll(async () => { await pool.query('DELETE FROM app_settings WHERE k = ?', [KEY]).catch(() => {}); });

  it('pins day 1 on the first run', async () => {
    const p = await shadowProgress('2026-08-13');
    expect(p).toMatchObject({ started_at: '2026-08-13', day: 1, total_days: 28, complete: false });
  });

  it('counts forward instead of resetting', async () => {
    // The same fault the sync's start date had: recomputed from "today" every
    // run, the window slides forward and is never reached.
    expect((await shadowProgress('2026-08-20')).day).toBe(8);
    expect((await shadowProgress('2026-09-09')).day).toBe(28);
  });

  it('reports completion once the window is up', async () => {
    expect((await shadowProgress('2026-09-09')).complete).toBe(true);
    expect((await shadowProgress('2026-09-20')).complete).toBe(true);
  });
});

describe('the start-date floor must not move', () => {
  const KEY = 'attendance_sync_start_date';
  let saved;

  beforeAll(async () => {
    saved = process.env.ATTENDANCE_SYNC_START_DATE;
    delete process.env.ATTENDANCE_SYNC_START_DATE;
    await pool.query('DELETE FROM app_settings WHERE setting_key = ?', [KEY]).catch(() => {});
  });
  afterAll(async () => {
    if (saved === undefined) delete process.env.ATTENDANCE_SYNC_START_DATE;
    else process.env.ATTENDANCE_SYNC_START_DATE = saved;
    await pool.query('DELETE FROM app_settings WHERE setting_key = ?', [KEY]).catch(() => {});
  });

  it('pins itself to the day of the first run', async () => {
    expect(await resolveStartDate(pool, { today: '2026-08-12' })).toBe('2026-08-12');
  });

  it('stays put as the calendar moves on', async () => {
    // The bug this replaced: the floor was recomputed as "today" while nothing
    // had imported, so it advanced every night and each morning's file was
    // always dated the day before it. Nothing would ever have imported.
    expect(await resolveStartDate(pool, { today: '2026-08-13' })).toBe('2026-08-12');
    expect(await resolveStartDate(pool, { today: '2026-09-01' })).toBe('2026-08-12');
  });

  it('lets an explicit setting override the stored one', async () => {
    process.env.ATTENDANCE_SYNC_START_DATE = '2026-08-01';
    expect(await resolveStartDate(pool, { today: '2026-08-13' })).toBe('2026-08-01');
    delete process.env.ATTENDANCE_SYNC_START_DATE;
  });

  it('ignores a malformed override rather than trusting it', async () => {
    process.env.ATTENDANCE_SYNC_START_DATE = 'yesterday';
    expect(await resolveStartDate(pool, { today: '2026-08-13' })).toBe('2026-08-12');
    delete process.env.ATTENDANCE_SYNC_START_DATE;
  });
});
