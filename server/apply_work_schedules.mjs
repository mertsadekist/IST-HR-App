// Idempotent migration: work schedules, per-employee assignment, and holidays.
//
// Phase 1 of docs/attendance_schedules_and_exceptions_plan.md. Foundations only —
// nothing evaluates attendance yet and no existing row is touched.
//
// Why this exists: the fingerprint device applies ONE schedule to everybody
// (verified — every synced row carries scheduled_in 10:00 / scheduled_out 19:00).
// That is wrong for two real cases here: IST Real Estate works Saturday 10:00–15:00,
// so the device reports a four-hour early departure for a completed shift; and
// staff who skip the one-hour meal break leave at 18:00, which the device reports
// as an hour early, every day. The schedule lives here so those days can be judged
// correctly later.
//
// The "no meal break" arrangement is deliberately NOT a flag or an override — it
// is just another schedule whose days end at 18:00 with break_minutes 0. Both
// variants expect the same eight net hours, so one formula covers both and no
// branch is needed anywhere in the code.
//
// Safe to re-run: tables use CREATE TABLE IF NOT EXISTS, and the seed skips any
// schedule whose name is already present, so edits made in the UI survive.
import pool from './config/db.js';

const TABLES = [
  // A named shift pattern belonging to one company. The thresholds live here
  // rather than in global config because they are a property of the working
  // arrangement: a five-hour Saturday does not deserve the same grace as a
  // nine-hour Tuesday, and a future company may need different tolerances.
  `CREATE TABLE IF NOT EXISTS work_schedules (
     id                 INT AUTO_INCREMENT PRIMARY KEY,
     company_id         INT NOT NULL,
     name_en            VARCHAR(150) NOT NULL,
     name_ar            VARCHAR(150) NULL,
     -- Carried on the row, not hardcoded, so a company in another zone does not
     -- force a rewrite. Every comparison in the evaluator is wall-clock.
     timezone           VARCHAR(60) NOT NULL DEFAULT 'Asia/Dubai',
     -- Tolerance: within grace, nothing is recorded at all.
     grace_in_minutes   SMALLINT NOT NULL DEFAULT 10,
     grace_out_minutes  SMALLINT NOT NULL DEFAULT 10,
     -- Beyond grace the minutes are recorded, but a reviewable case only opens
     -- past these. Without the second threshold a ten-minute overrun becomes a
     -- case needing an explanation and a document, and the queue dies.
     late_case_minutes  SMALLINT NOT NULL DEFAULT 30,
     early_case_minutes SMALLINT NOT NULL DEFAULT 30,
     -- Net worked below this share of the expected day counts as a half day.
     half_day_threshold_pct TINYINT NOT NULL DEFAULT 50,
     is_default         BOOLEAN NOT NULL DEFAULT FALSE,
     active             BOOLEAN NOT NULL DEFAULT TRUE,
     notes              VARCHAR(500) NULL,
     created_by         INT NULL,
     created_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
     updated_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
     UNIQUE KEY uq_ws_company_name (company_id, name_en),
     INDEX idx_ws_company (company_id, active),
     FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
     FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  // Seven rows per schedule, one per weekday.
  //
  // weekday is 0 = Sunday … 6 = Saturday. That is JavaScript's Date.getDay() and
  // MySQL's DAYOFWEEK() - 1, so the same number means the same day on both sides
  // and no conversion is needed anywhere. Do not renumber it.
  //
  // break_minutes is policy, not measurement. The feed gives one check-in and one
  // check-out — the device treats the last punch of the day as the departure — so
  // time away at lunch can never be observed. Net worked is gross minus this.
  `CREATE TABLE IF NOT EXISTS work_schedule_days (
     id            INT AUTO_INCREMENT PRIMARY KEY,
     schedule_id   INT NOT NULL,
     weekday       TINYINT NOT NULL,
     is_working    BOOLEAN NOT NULL DEFAULT TRUE,
     start_time    TIME NULL,
     end_time      TIME NULL,
     break_minutes SMALLINT NOT NULL DEFAULT 0,
     UNIQUE KEY uq_wsd_schedule_day (schedule_id, weekday),
     FOREIGN KEY (schedule_id) REFERENCES work_schedules(id) ON DELETE CASCADE
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  // Which schedule an employee works, from when.
  //
  // Effective-dated on purpose: moving somebody onto a new shift in September
  // must not re-interpret August. The assignment in force on a date is the one
  // with the greatest effective_from on or before it whose effective_to has not
  // passed — see services/workScheduleService.js.
  `CREATE TABLE IF NOT EXISTS employee_work_schedules (
     id             INT AUTO_INCREMENT PRIMARY KEY,
     employee_id    INT NOT NULL,
     schedule_id    INT NOT NULL,
     company_id     INT NOT NULL,
     effective_from DATE NOT NULL,
     effective_to   DATE NULL,
     note           VARCHAR(300) NULL,
     assigned_by    INT NULL,
     created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
     UNIQUE KEY uq_ews_emp_from (employee_id, effective_from),
     INDEX idx_ews_lookup (employee_id, effective_from),
     INDEX idx_ews_company (company_id),
     FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
     FOREIGN KEY (schedule_id) REFERENCES work_schedules(id) ON DELETE CASCADE,
     FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
     FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  // Public and company holidays. company_id NULL means every company.
  //
  // Without this every national holiday becomes an absence the moment the
  // evaluator goes live, and absence deducts a day's pay in payrollService.
  `CREATE TABLE IF NOT EXISTS holidays (
     id           INT AUTO_INCREMENT PRIMARY KEY,
     company_id   INT NULL,
     holiday_date DATE NOT NULL,
     name_en      VARCHAR(150) NOT NULL,
     name_ar      VARCHAR(150) NULL,
     is_half_day  BOOLEAN NOT NULL DEFAULT FALSE,
     notes        VARCHAR(300) NULL,
     created_by   INT NULL,
     created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
     UNIQUE KEY uq_holiday_company_date (company_id, holiday_date),
     INDEX idx_holiday_date (holiday_date),
     FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
     FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
];

// The real working week at IST, as described by the business.
//
// Keyed on short_code rather than id: ids differ between the dev and production
// databases, and a seed that guesses wrong would file IST Markets staff under
// IST Real Estate's Saturday. A company that matches nothing is simply skipped —
// HR builds its schedules in Settings.
const MON_FRI = [1, 2, 3, 4, 5];
const SEEDS = {
  ISTRE: [
    {
      name_en: 'IST Real Estate — Standard',
      name_ar: 'آي إس تي العقارية — الدوام القياسي',
      is_default: true,
      notes: 'Sunday off. Saturday is a short day (10:00–15:00).',
      days: [
        ...MON_FRI.map((d) => ({ weekday: d, is_working: true, start_time: '10:00:00', end_time: '19:00:00', break_minutes: 60 })),
        { weekday: 6, is_working: true, start_time: '10:00:00', end_time: '15:00:00', break_minutes: 0 },
        { weekday: 0, is_working: false },
      ],
    },
    {
      name_en: 'IST Real Estate — No Meal Break',
      name_ar: 'آي إس تي العقارية — بدون فترة طعام',
      is_default: false,
      notes: 'For staff who do not take the one-hour meal break and leave at 18:00. Same eight net hours.',
      days: [
        ...MON_FRI.map((d) => ({ weekday: d, is_working: true, start_time: '10:00:00', end_time: '18:00:00', break_minutes: 0 })),
        { weekday: 6, is_working: true, start_time: '10:00:00', end_time: '15:00:00', break_minutes: 0 },
        { weekday: 0, is_working: false },
      ],
    },
  ],
  ISTMRKT: [
    {
      name_en: 'IST Markets — Standard',
      name_ar: 'آي إس تي ماركتس — الدوام القياسي',
      is_default: true,
      notes: 'Saturday and Sunday off.',
      days: [
        ...MON_FRI.map((d) => ({ weekday: d, is_working: true, start_time: '10:00:00', end_time: '19:00:00', break_minutes: 60 })),
        { weekday: 6, is_working: false },
        { weekday: 0, is_working: false },
      ],
    },
    {
      name_en: 'IST Markets — No Meal Break',
      name_ar: 'آي إس تي ماركتس — بدون فترة طعام',
      is_default: false,
      notes: 'For staff who do not take the one-hour meal break and leave at 18:00. Same eight net hours.',
      days: [
        ...MON_FRI.map((d) => ({ weekday: d, is_working: true, start_time: '10:00:00', end_time: '18:00:00', break_minutes: 0 })),
        { weekday: 6, is_working: false },
        { weekday: 0, is_working: false },
      ],
    },
  ],
};

try {
  for (const ddl of TABLES) {
    await pool.query(ddl);
    console.log(`table ${ddl.match(/CREATE TABLE IF NOT EXISTS (\w+)/)[1]} ready`);
  }

  const [companies] = await pool.query('SELECT id, name, short_code FROM companies');
  let created = 0;
  for (const co of companies) {
    const seeds = SEEDS[co.short_code];
    if (!seeds) {
      console.log(`no seed for ${co.name} (${co.short_code}) — build its schedules in Settings`);
      continue;
    }
    for (const s of seeds) {
      const [[existing]] = await pool.query(
        'SELECT id FROM work_schedules WHERE company_id = ? AND name_en = ?', [co.id, s.name_en]);
      if (existing) {
        console.log(`  "${s.name_en}" already present — left untouched`);
        continue;
      }
      const [r] = await pool.query('INSERT INTO work_schedules SET ?', {
        company_id: co.id, name_en: s.name_en, name_ar: s.name_ar,
        is_default: s.is_default, notes: s.notes,
      });
      for (const d of s.days) {
        await pool.query('INSERT INTO work_schedule_days SET ?', {
          schedule_id: r.insertId,
          weekday: d.weekday,
          is_working: d.is_working,
          start_time: d.start_time || null,
          end_time: d.end_time || null,
          break_minutes: d.break_minutes || 0,
        });
      }
      created++;
      console.log(`  seeded "${s.name_en}" (${s.days.filter((d) => d.is_working).length} working days)`);
    }
  }

  const [[counts]] = await pool.query(`
    SELECT (SELECT COUNT(*) FROM work_schedules) schedules,
           (SELECT COUNT(*) FROM work_schedule_days) days,
           (SELECT COUNT(*) FROM employee_work_schedules) assignments,
           (SELECT COUNT(*) FROM holidays) holidays`);
  console.log(`schedules: ${counts.schedules} (${created} new), day rows: ${counts.days}, `
    + `assignments: ${counts.assignments}, holidays: ${counts.holidays}`);
  console.log('WORK_SCHEDULES MIGRATION OK');
} catch (e) {
  console.error('MIGRATION ERROR:', e.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
