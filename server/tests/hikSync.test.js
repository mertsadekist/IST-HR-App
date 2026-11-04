/**
 * The Hik sync service against a real HR database, with the Hik side faked.
 *
 * `runHikSync` takes the punch reader as a parameter, so everything that matters
 * here — what is written, what is left alone, what is refused, and why — is
 * exercised against the real schema without a Hik server.
 *
 * SAFETY: this writes (inside a throwaway company, removed afterwards) and a
 * daily close touches every tracked employee in the database. It therefore only
 * runs against a local database. An earlier test of this kind ran against the
 * live database and destroyed rows; pointing this one at a remote host requires
 * ALLOW_REMOTE_DB_TESTS=1 on purpose.
 *
 *   docker run -d -p 127.0.0.1:33306:3306 -e MYSQL_ROOT_PASSWORD=testpw -e MYSQL_DATABASE=ist_hr mysql:8.0
 *   DB_HOST=127.0.0.1 DB_PORT=33306 DB_USER=root DB_PASSWORD=testpw DB_NAME=ist_hr \
 *     node setup-db.js && sh scripts/migrate.sh
 *
 * Device ids live in a `ZZH-` namespace no real employee can hold.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pool from '../config/db.js';
import { hikConfig } from '../services/hikConfig.js';
import {
  runHikSync, claimRun, resolveStartDate,
} from '../services/hikSyncService.js';

const LOCAL = ['127.0.0.1', 'localhost', '::1'].includes(String(process.env.DB_HOST || '').trim());
const allowed = LOCAL || process.env.ALLOW_REMOTE_DB_TESTS === '1';
const suite = allowed ? describe : describe.skip;

const tag = `HK${Date.now().toString().slice(-6)}`;
const dev = (n) => `ZZH-${tag}-${n}`;

// Mon 17 – Fri 21 Aug 2026; Sat 15 is a rest day; Thu 13 is a holiday.
const FRI_PREV = '2026-08-14';
const MON = '2026-08-17';
const TUE = '2026-08-18';
const WED = '2026-08-19';   // "today" in these tests
const HOLIDAY = '2026-08-13';
const NOW = new Date('2026-08-19T08:00:00Z');   // 12:00 in Dubai

const cfg = hikConfig({
  HIK_DB_HOST: 'x', HIK_DB_USER: 'x', HIK_DB_PASSWORD: 'x', HIK_DB_NAME: 'x',
  HIK_EVENTS_TABLE: 'events', HIK_COL_PERSON_ID: 'p', HIK_COL_EVENT_TIME: 't', HIK_EVENT_TZ: 'Asia/Dubai',
});

const fx = { company: null, user: null, schedule: null, A: null, B: null, C: null, D: null, E: null };
const createdRuns = [];

/** A feed that returns whatever punches fall in the requested window. */
const feedOf = (all) => async ({ from, to }) =>
  all.filter((e) => e.punched_at.slice(0, 10) >= from && e.punched_at.slice(0, 10) <= to);
const ev = (person_id, date, time, person_name = '') => ({ person_id, person_name, punched_at: `${date} ${time}` });

const run = async (over = {}) => {
  const r = await runHikSync(pool, { cfg, now: NOW, ...over });
  if (r.run_id) createdRuns.push(r.run_id);
  return r;
};
const rowOf = async (employeeId, date) => {
  const [[r]] = await pool.query(
    `SELECT status, source, punch_count, late_minutes, early_leave_minutes, work_hours, notes,
            TIME_FORMAT(check_in, '%H:%i:%s') AS ci, TIME_FORMAT(check_out, '%H:%i:%s') AS co,
            TIME_FORMAT(scheduled_in, '%H:%i') AS sin
       FROM attendance WHERE employee_id = ? AND work_date = ?`, [employeeId, date]);
  return r || null;
};

suite('Hik sync service (real HR schema, faked Hik feed)', () => {
  beforeAll(async () => {
    const [co] = await pool.query('INSERT INTO companies SET ?', {
      name: `${tag}_Co`, short_code: tag.slice(0, 10), currency: 'AED', status: 'Active',
    });
    fx.company = co.insertId;
    const [u] = await pool.query('INSERT INTO users SET ?', {
      name: `${tag} Admin`, username: `${tag}_admin`, password_hash: 'x', role: 'admin', is_active: 1,
    });
    fx.user = u.insertId;

    // Mon–Fri 10:00–19:00, an hour's break, ten minutes' grace each way.
    const [s] = await pool.query('INSERT INTO work_schedules SET ?', {
      company_id: fx.company, name_en: `${tag} Standard`, is_default: true,
      grace_in_minutes: 10, grace_out_minutes: 10, late_case_minutes: 30, early_case_minutes: 30,
    });
    fx.schedule = s.insertId;
    for (let weekday = 0; weekday <= 6; weekday++) {
      const working = weekday >= 1 && weekday <= 5;
      await pool.query('INSERT INTO work_schedule_days SET ?', {
        schedule_id: fx.schedule, weekday, is_working: working,
        start_time: working ? '10:00:00' : null, end_time: working ? '19:00:00' : null,
        break_minutes: working ? 60 : 0,
      });
    }
    await pool.query('INSERT INTO holidays SET ?', {
      company_id: fx.company, holiday_date: HOLIDAY, name_en: `${tag} Holiday`,
    });

    const mk = async (first, deviceId) => {
      const [r] = await pool.query('INSERT INTO employees SET ?', {
        company_id: fx.company, first_name: first, last_name: tag,
        email: `${tag}.${first}@example.test`, status: 'Active', start_date: '2026-01-01',
        attendance_id: deviceId,
      });
      return r.insertId;
    };
    fx.A = await mk('Alpha', dev(1));
    fx.B = await mk('Bravo', dev(2));
    fx.C = await mk('Charlie', dev(3));   // on approved leave Tue
    fx.D = await mk('Delta', dev(4));     // a hand-corrected Monday
    fx.E = await mk('Echo', dev(5));      // never punches anywhere

    const [[type]] = await pool.query("SELECT id FROM leave_types WHERE name = 'Annual Leave' LIMIT 1");
    await pool.query('INSERT INTO leave_requests SET ?', {
      company_id: fx.company, employee_id: fx.C, leave_type_id: type.id,
      start_date: TUE, end_date: TUE, days: 1, status: 'Approved', reason: 'fixture',
    });
    await pool.query('INSERT INTO attendance SET ?', {
      company_id: fx.company, employee_id: fx.D, work_date: MON,
      check_in: `${MON} 09:00:00`, check_out: `${MON} 17:00:00`, status: 'Present',
      source: 'Manual', notes: 'HR corrected',
    });
  });

  afterAll(async () => {
    if (fx.company) await pool.query('DELETE FROM companies WHERE id = ?', [fx.company]);
    if (fx.user) await pool.query('DELETE FROM users WHERE id = ?', [fx.user]);
    if (createdRuns.length) {
      await pool.query('DELETE FROM hik_sync_runs WHERE id IN (?)', [createdRuns]);
    }
    await pool.query("DELETE FROM attendance_ignored_devices WHERE device_id LIKE 'ZZH-%'");
  });

  describe('first punch in, last punch out', () => {
    const punches = [
      ev(dev(1), MON, '10:01:05'), ev(dev(1), MON, '13:00:00'), ev(dev(1), MON, '14:02:00'), ev(dev(1), MON, '19:05:30'),
      ev(dev(2), MON, '10:30:00'),                                   // one punch, 30 minutes late
      ev(dev(4), MON, '10:00:00'), ev(dev(4), MON, '18:00:00'),      // Delta has a Manual row
      ev('ZZH-stranger', MON, '11:00:00', 'Not An Employee'),
    ];

    it('writes the first punch as check-in and the last as check-out', async () => {
      const r = await run({ trigger: 'Backfill', from: MON, to: MON, fetch: feedOf(punches) });
      expect(r.ok).toBe(true);
      const a = await rowOf(fx.A, MON);
      expect(a).toMatchObject({ ci: '10:01:05', co: '19:05:30', status: 'Present', source: 'Hik Central', punch_count: 4 });
      expect(Number(a.work_hours)).toBe(9.07);
      expect(a.sin).toBe('10:00');
    });

    it('a single punch is a check-in with no check-out, and late past grace', async () => {
      const b = await rowOf(fx.B, MON);
      expect(b).toMatchObject({ ci: '10:30:00', co: null, status: 'Late', late_minutes: 30, punch_count: 1 });
      expect(b.work_hours).toBeNull();
    });

    it('never overwrites a hand-corrected day, and says so', async () => {
      const d = await rowOf(fx.D, MON);
      expect(d).toMatchObject({ source: 'Manual', ci: '09:00:00', co: '17:00:00' });
      const r = await run({ trigger: 'Backfill', from: MON, to: MON, fetch: feedOf(punches) });
      expect(r.summary.skipped_manual.map((m) => m.employee)).toEqual([`Delta ${tag}`]);
    });

    it('reports a person id that is not an employee instead of inventing one', async () => {
      const r = await run({ trigger: 'Backfill', from: MON, to: MON, fetch: feedOf(punches) });
      expect(r.summary.unmatched).toEqual([{ person_id: 'ZZH-stranger', name: 'Not An Employee', days: 1, punches: 1 }]);
      const [[n]] = await pool.query("SELECT COUNT(*) c FROM employees WHERE attendance_id = 'ZZH-stranger'");
      expect(n.c).toBe(0);
    });

    it('replaces a hand-corrected day only when explicitly told to', async () => {
      await run({ trigger: 'Backfill', from: MON, to: MON, fetch: feedOf(punches), overwriteManual: true });
      expect(await rowOf(fx.D, MON)).toMatchObject({ source: 'Hik Central', ci: '10:00:00', co: '18:00:00' });
    });

    it('running it again changes nothing — a day is recalculated, never appended to', async () => {
      const r = await run({ trigger: 'Backfill', from: MON, to: MON, fetch: feedOf(punches), overwriteManual: true });
      expect(r.summary.inserted + r.summary.updated).toBe(0);
      expect(r.summary.unchanged).toBe(3);
      const [[n]] = await pool.query('SELECT COUNT(*) c FROM attendance WHERE employee_id = ? AND work_date = ?', [fx.A, MON]);
      expect(n.c).toBe(1);
    });

    it('a Live pass that changes nothing leaves no run row behind', async () => {
      const before = (await pool.query('SELECT COUNT(*) c FROM hik_sync_runs'))[0][0].c;
      const r = await run({ trigger: 'Live', from: MON, to: MON, fetch: feedOf(punches), overwriteManual: true });
      expect(r.run_id).toBeNull();
      expect((await pool.query('SELECT COUNT(*) c FROM hik_sync_runs'))[0][0].c).toBe(before);
    });
  });

  describe('live — today is in progress', () => {
    const morning = [ev(dev(1), WED, '10:05:00')];

    it('records an arrival today without calling it a missing check-out', async () => {
      const r = await run({ trigger: 'Live', fetch: feedOf(morning) });
      expect(r.ok).toBe(true);
      expect(r.summary.missing_checkout).toEqual([]);
      expect(await rowOf(fx.A, WED)).toMatchObject({ ci: '10:05:00', co: null, status: 'Present', punch_count: 1 });
    });

    it('moves the check-out as later punches arrive, and never double-counts', async () => {
      const afternoon = [...morning, ev(dev(1), WED, '13:30:00')];
      let r = await run({ trigger: 'Live', fetch: feedOf(afternoon) });
      expect(r.summary.updated).toBe(1);
      expect(await rowOf(fx.A, WED)).toMatchObject({ ci: '10:05:00', co: '13:30:00', punch_count: 2 });

      const evening = [...afternoon, ev(dev(1), WED, '15:45:00')];
      r = await run({ trigger: 'Live', fetch: feedOf(evening) });
      expect(await rowOf(fx.A, WED)).toMatchObject({ co: '15:45:00', punch_count: 3 });

      r = await run({ trigger: 'Live', fetch: feedOf(evening) });
      expect(r.summary.updated + r.summary.inserted).toBe(0);
    });

    it("does not judge an early departure on a day that is not over", async () => {
      const a = await rowOf(fx.A, WED);
      expect(a.early_leave_minutes).toBeNull();
      expect(a.notes).toMatch(/day in progress/);
    });

    it('never writes an absence from a live pass', async () => {
      const [[n]] = await pool.query("SELECT COUNT(*) c FROM attendance WHERE company_id = ? AND status = 'Absent'", [fx.company]);
      expect(n.c).toBe(0);
    });
  });

  describe('the daily close — absence needs a finished day', () => {
    // Tue: Bravo punches (so the feed observed the day); Alpha, Delta, Echo do not;
    // Charlie has approved leave.
    const tuePunches = [ev(dev(2), TUE, '10:00:00'), ev(dev(2), TUE, '19:00:00')];

    it('does not mark anyone absent for a day the feed said nothing about', async () => {
      // Fri 14 Aug: a working day, but no punches from anybody.
      const r = await run({ trigger: 'Backfill', from: FRI_PREV, to: FRI_PREV, finalize: true, fetch: feedOf([]) });
      expect(r.ok).toBe(true);
      expect(r.summary.not_observed_days).toEqual([FRI_PREV]);
      expect(r.summary.absences).toEqual([]);
      expect(await rowOf(fx.E, FRI_PREV)).toBeNull();
    });

    it('marks a no-show Absent, approved leave On Leave, and leaves a holiday alone', async () => {
      const r = await run({
        trigger: 'Backfill', from: TUE, to: TUE, finalize: true,
        fetch: feedOf([...tuePunches, ev(dev(1), HOLIDAY, '11:00:00')]),
      });
      expect(r.ok).toBe(true);
      expect((await rowOf(fx.A, TUE)).status).toBe('Absent');
      expect((await rowOf(fx.E, TUE)).status).toBe('Absent');
      expect((await rowOf(fx.C, TUE)).status).toBe('On Leave');
      expect((await rowOf(fx.B, TUE)).status).toBe('Present');
      expect(r.summary.on_leave).toEqual([{ employee: `Charlie ${tag}`, date: TUE, leave_type: 'Annual Leave' }]);
      expect(r.summary.absences.map((a) => a.employee).sort()).toEqual([`Alpha ${tag}`, `Delta ${tag}`, `Echo ${tag}`]);
    });

    it('a holiday is not an absence even when the day was observed', async () => {
      const r = await run({
        trigger: 'Backfill', from: HOLIDAY, to: HOLIDAY, finalize: true,
        fetch: feedOf([ev(dev(1), HOLIDAY, '11:00:00')]),
      });
      expect(r.summary.absences).toEqual([]);
      expect(await rowOf(fx.E, HOLIDAY)).toBeNull();
      // But somebody who came in on the holiday keeps their punches.
      expect(await rowOf(fx.A, HOLIDAY)).toMatchObject({ ci: '11:00:00', source: 'Hik Central' });
    });

    it('a rest day is not an absence', async () => {
      const SAT = '2026-08-15';
      const r = await run({
        trigger: 'Backfill', from: SAT, to: SAT, finalize: true, fetch: feedOf([ev(dev(1), SAT, '12:00:00')]),
      });
      expect(r.summary.absences).toEqual([]);
      expect(await rowOf(fx.E, SAT)).toBeNull();
    });

    it('never finalizes today', async () => {
      const r = await run({ trigger: 'Backfill', from: WED, to: WED, finalize: true, fetch: feedOf([ev(dev(1), WED, '10:05:00')]) });
      expect(r.summary.absences).toEqual([]);
      expect(await rowOf(fx.E, WED)).toBeNull();
    });

    it('is idempotent: a second close writes nothing new', async () => {
      const feed = feedOf([...tuePunches, ev(dev(1), HOLIDAY, '11:00:00')]);
      const r = await run({ trigger: 'Backfill', from: TUE, to: TUE, finalize: true, fetch: feed });
      expect(r.summary.inserted + r.summary.updated).toBe(0);
    });

    it('a late-arriving punch turns an earlier Absent into a real day', async () => {
      const r = await run({
        trigger: 'Backfill', from: TUE, to: TUE, fetch: feedOf([...tuePunches, ev(dev(1), TUE, '10:02:00'), ev(dev(1), TUE, '19:10:00')]),
      });
      expect(r.summary.updated).toBeGreaterThanOrEqual(1);
      expect(await rowOf(fx.A, TUE)).toMatchObject({ status: 'Present', ci: '10:02:00', co: '19:10:00', source: 'Hik Central' });
    });

    it('revisits an earlier absence when leave was approved afterwards', async () => {
      const [[type]] = await pool.query("SELECT id FROM leave_types WHERE name = 'Annual Leave' LIMIT 1");
      await pool.query('INSERT INTO leave_requests SET ?', {
        company_id: fx.company, employee_id: fx.E, leave_type_id: type.id,
        start_date: TUE, end_date: TUE, days: 1, status: 'Approved', reason: 'late approval',
      });
      await run({ trigger: 'Backfill', from: TUE, to: TUE, finalize: true, fetch: feedOf(tuePunches) });
      expect((await rowOf(fx.E, TUE)).status).toBe('On Leave');
    });

    it('does not touch a hand-made absence row', async () => {
      // HR looks at the Absent the close wrote for Delta and corrects it.
      await pool.query(
        "UPDATE attendance SET status = 'Half Day', source = 'Manual', notes = 'HR decided' WHERE employee_id = ? AND work_date = ?",
        [fx.D, TUE]);
      await run({ trigger: 'Backfill', from: TUE, to: TUE, finalize: true, fetch: feedOf(tuePunches) });
      expect(await rowOf(fx.D, TUE)).toMatchObject({ status: 'Half Day', source: 'Manual' });
    });

    it('a "keep existing" backfill fills empty days but leaves Drive and file days alone', async () => {
      const OLD = '2026-08-11';   // a Tuesday in the past
      await pool.query('INSERT INTO attendance SET ?', {
        company_id: fx.company, employee_id: fx.B, work_date: OLD, check_in: `${OLD} 09:55:00`,
        check_out: `${OLD} 19:00:00`, status: 'Present', source: 'Drive Sync',
      });
      const feed = feedOf([
        ev(dev(1), OLD, '10:05:00'), ev(dev(1), OLD, '19:00:00'),   // Alpha: no row yet
        ev(dev(2), OLD, '11:30:00'), ev(dev(2), OLD, '19:00:00'),   // Bravo: has a Drive row
      ]);
      const r = await run({ trigger: 'Backfill', from: OLD, to: OLD, fillOnly: true, fetch: feed });
      expect(r.summary.kept_existing).toBe(1);
      expect(await rowOf(fx.A, OLD)).toMatchObject({ source: 'Hik Central', ci: '10:05:00' });
      expect(await rowOf(fx.B, OLD)).toMatchObject({ source: 'Drive Sync', ci: '09:55:00' });

      // Without the flag the door wins, as before.
      await run({ trigger: 'Backfill', from: OLD, to: OLD, fetch: feed });
      expect(await rowOf(fx.B, OLD)).toMatchObject({ source: 'Hik Central', ci: '11:30:00' });
    });

    it('door punches replace a self-service check-in, but a hand correction is untouched', async () => {
      // Somebody checked in from home through the app: not door evidence.
      const THU = '2026-08-12';   // a Wednesday in the past
      await pool.query('INSERT INTO attendance SET ?', {
        company_id: fx.company, employee_id: fx.A, work_date: THU, check_in: `${THU} 08:50:00`,
        status: 'Present', source: 'Self Service',
      });
      const r = await run({
        trigger: 'Backfill', from: THU, to: THU, overwriteManual: false,
        fetch: feedOf([ev(dev(1), THU, '10:20:00'), ev(dev(1), THU, '19:00:00')]),
      });
      expect(r.summary.skipped_manual).toEqual([]);
      expect(await rowOf(fx.A, THU)).toMatchObject({ source: 'Hik Central', ci: '10:20:00', status: 'Late' });
    });

    it('lists a finished day with one punch as missing its check-out', async () => {
      const r = await run({
        trigger: 'Backfill', from: TUE, to: TUE, fetch: feedOf([...tuePunches, ev(dev(5), TUE, '10:40:00')]),
      });
      expect(r.summary.missing_checkout).toEqual([{ employee: `Echo ${tag}`, date: TUE, check_in: '10:40:00' }]);
    });
  });

  describe('what it refuses to guess', () => {
    it('does not record punches for a person id shared by two employees', async () => {
      const [r1] = await pool.query('INSERT INTO employees SET ?', {
        company_id: fx.company, first_name: 'Twin1', last_name: tag, email: `${tag}.t1@example.test`,
        status: 'Active', start_date: '2026-01-01', attendance_id: dev(9),
      });
      const [r2] = await pool.query('INSERT INTO employees SET ?', {
        company_id: fx.company, first_name: 'Twin2', last_name: tag, email: `${tag}.t2@example.test`,
        status: 'Active', start_date: '2026-01-01', attendance_id: dev(9),
      });
      const res = await run({ trigger: 'Backfill', from: MON, to: MON, fetch: feedOf([ev(dev(9), MON, '10:00:00')]) });
      expect(res.summary.ambiguous_ids).toEqual([dev(9)]);
      expect(await rowOf(r1.insertId, MON)).toBeNull();
      expect(await rowOf(r2.insertId, MON)).toBeNull();
    });

    it('does not report an ignored person id as unmatched', async () => {
      await pool.query('INSERT INTO attendance_ignored_devices (device_id, device_name) VALUES (?, ?)', ['ZZH-stranger', 'x']);
      const r = await run({ trigger: 'Backfill', from: MON, to: MON, fetch: feedOf([ev('ZZH-stranger', MON, '11:00:00')]) });
      expect(r.summary.unmatched).toEqual([]);
    });

    it('refuses a range that is too long, backwards, or malformed', async () => {
      const long = await run({ trigger: 'Backfill', from: '2026-01-01', to: '2026-08-19', fetch: feedOf([]) });
      expect(long.ok).toBe(false);
      expect(long.error).toMatch(/at most 93 days/);
      const back = await run({ trigger: 'Backfill', from: TUE, to: MON, fetch: feedOf([]) });
      expect(back.error).toMatch(/after/);
      const bad = await run({ trigger: 'Backfill', from: 'yesterday', to: MON, fetch: feedOf([]) });
      expect(bad.error).toMatch(/YYYY-MM-DD/);
    });

    it('records a failed read as a failed run and writes nothing', async () => {
      const before = (await pool.query('SELECT COUNT(*) c FROM attendance WHERE company_id = ?', [fx.company]))[0][0].c;
      const r = await run({
        trigger: 'Manual', from: MON, to: MON,
        fetch: async () => { throw new Error('Cannot reach the Hik database (ECONNREFUSED)'); },
      });
      expect(r.ok).toBe(false);
      expect(r.status).toBe('Failed');
      expect((await pool.query('SELECT COUNT(*) c FROM attendance WHERE company_id = ?', [fx.company]))[0][0].c).toBe(before);
      const [[run1]] = await pool.query('SELECT status, error FROM hik_sync_runs WHERE id = ?', [r.run_id]);
      expect(run1).toMatchObject({ status: 'Failed' });
      expect(run1.error).toMatch(/ECONNREFUSED/);
    });

    it('does nothing and says why when the sync is not configured', async () => {
      const r = await runHikSync(pool, { cfg: hikConfig({}), fetch: async () => { throw new Error('must not be called'); } });
      expect(r).toMatchObject({ ok: false, skipped: true });
      expect(r.reason).toMatch(/not configured/);
    });
  });

  describe('the scheduled close is claimed exactly once', () => {
    const DATE = '2099-01-01';
    it('lets the first through, refuses a repeat, still allows the next day and any manual run', async () => {
      const first = await claimRun(pool, { trigger: 'Scheduled', runDate: DATE });
      expect(first).toBeTruthy(); createdRuns.push(first);
      expect(await claimRun(pool, { trigger: 'Scheduled', runDate: DATE })).toBeNull();   // the redeploy case
      const next = await claimRun(pool, { trigger: 'Scheduled', runDate: '2099-01-02' });
      expect(next).toBeTruthy(); createdRuns.push(next);
      for (const trigger of ['Manual', 'Manual', 'Backfill']) {
        const id = await claimRun(pool, { trigger, runDate: DATE });
        expect(id).toBeTruthy(); createdRuns.push(id);
      }
    });
  });

  describe('the start-date floor does not move', () => {
    const KEY = 'hik_sync_start_date';
    let saved;
    beforeAll(async () => {
      [[saved]] = [(await pool.query('SELECT v FROM app_settings WHERE k = ?', [KEY]))[0]];
      await pool.query('DELETE FROM app_settings WHERE k = ?', [KEY]);
    });
    afterAll(async () => {
      await pool.query('DELETE FROM app_settings WHERE k = ?', [KEY]);
      if (saved) await pool.query('INSERT INTO app_settings (k, v) VALUES (?, ?)', [KEY, saved.v]);
    });

    it('pins itself to the first day it runs and stays put as the calendar moves', async () => {
      expect(await resolveStartDate(pool, { today: '2026-08-12', cfg })).toBe('2026-08-12');
      expect(await resolveStartDate(pool, { today: '2026-09-01', cfg })).toBe('2026-08-12');
    });

    it('an explicit setting wins, and a malformed one is ignored', async () => {
      const withStart = hikConfig({ ...{ HIK_SYNC_START_DATE: '2026-08-01' } });
      expect(await resolveStartDate(pool, { today: '2026-09-01', cfg: withStart })).toBe('2026-08-01');
      const bad = hikConfig({ HIK_SYNC_START_DATE: 'yesterday' });
      expect(await resolveStartDate(pool, { today: '2026-09-01', cfg: bad })).toBe('2026-08-12');
    });

    it('automatic passes never reach before the floor', async () => {
      // Floor is 2026-08-12; today is the 19th; a 31-day look-back must stop at the floor.
      const wide = hikConfig({
        HIK_DB_HOST: 'x', HIK_DB_USER: 'x', HIK_DB_PASSWORD: 'x', HIK_DB_NAME: 'x',
        HIK_EVENTS_TABLE: 'events', HIK_COL_PERSON_ID: 'p', HIK_COL_EVENT_TIME: 't',
        HIK_EVENT_TZ: 'Asia/Dubai', HIK_SYNC_LOOKBACK_DAYS: '31',
      });
      let asked;
      await run({ cfg: wide, trigger: 'Live', fetch: async (range) => { asked = range; return []; } });
      expect(asked.from).toBe('2026-08-12');
      expect(asked.to).toBe(WED);
    });
  });
});
