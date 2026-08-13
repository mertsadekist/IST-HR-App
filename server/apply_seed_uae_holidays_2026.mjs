// Idempotent seed: the UAE public holiday calendar for 2026.
//
// Phase 1 follow-up for docs/attendance_schedules_and_exceptions_plan.md. The
// evaluator needs this before it can go live: without a holiday calendar every
// public holiday reads as a working day nobody attended, and payrollService
// deducts a full day's gross for each row with status = 'Absent'.
//
// All rows are seeded with company_id NULL — UAE public holidays apply to both
// IST entities, and a NULL company is the calendar's "every company" value.
//
// ## Where the dates come from, and how sure we are
//
// Two are fixed in the Gregorian calendar and not in doubt: Commemoration Day
// and National Day. New Year's Day likewise.
//
// The rest follow the Hijri calendar and are confirmed by moon sighting, so the
// published date can move by a day and the UAE Cabinet may transfer a holiday to
// make a long weekend. Each such row says so in `notes`, and HR should correct it
// in Settings → Work Schedules → Holidays once the Cabinet announces.
//
// One was settled empirically rather than by publication. The Islamic New Year
// for 2026 is published as Tuesday 16 June, transferable to Monday 15 June. The
// attendance record answers which happened here: 15 June has zero punches
// company-wide and 16 June has seventeen. IST took the Monday, so that is what
// is seeded. This is worth remembering as a method — for a transferable holiday
// already in the past, the punch record is better evidence than any listing.
//
// Dates before 1 June 2026 predate the attendance data entirely, so they could
// not be checked the same way and have no effect on any evaluation today. They
// are here so the calendar is complete for reporting.
//
// Safe to re-run: a date already present is left exactly as it is, so a
// correction made in the UI is never overwritten by a redeploy.
import pool from './config/db.js';

const CONFIRMED = 'Fixed Gregorian date.';
const MOON = 'Hijri date — confirm against the UAE Cabinet announcement; moon sighting can move it by a day.';
const OBSERVED = 'Confirmed from the attendance record: zero punches company-wide on this date.';

const HOLIDAYS = [
  { date: '2026-01-01', en: "New Year's Day", ar: 'رأس السنة الميلادية', notes: CONFIRMED },

  // Published variously as 19–22 and 20–22 March. Before the attendance data
  // begins, so it changes nothing operationally either way.
  { date: '2026-03-19', en: 'Eid Al Fitr Holiday', ar: 'عطلة عيد الفطر', notes: MOON },
  { date: '2026-03-20', en: 'Eid Al Fitr', ar: 'عيد الفطر', notes: MOON },
  { date: '2026-03-21', en: 'Eid Al Fitr', ar: 'عيد الفطر', notes: MOON },
  { date: '2026-03-22', en: 'Eid Al Fitr', ar: 'عيد الفطر', notes: MOON },

  { date: '2026-05-26', en: 'Arafat Day', ar: 'يوم عرفة', notes: MOON },
  { date: '2026-05-27', en: 'Eid Al Adha', ar: 'عيد الأضحى', notes: MOON },
  { date: '2026-05-28', en: 'Eid Al Adha', ar: 'عيد الأضحى', notes: MOON },
  { date: '2026-05-29', en: 'Eid Al Adha', ar: 'عيد الأضحى', notes: MOON },

  // Published as Tue 16 June, transferable to Mon 15 June. The punch record says
  // IST took the Monday. See the note at the top of this file.
  { date: '2026-06-15', en: 'Islamic New Year', ar: 'رأس السنة الهجرية', notes: OBSERVED },

  // Twelve days after this migration was written. Still to be confirmed.
  { date: '2026-08-25', en: "Prophet Muhammad's Birthday", ar: 'المولد النبوي الشريف', notes: MOON },

  { date: '2026-12-01', en: 'Commemoration Day', ar: 'يوم الشهيد', notes: CONFIRMED },
  { date: '2026-12-02', en: 'UAE National Day', ar: 'اليوم الوطني لدولة الإمارات', notes: CONFIRMED },
  { date: '2026-12-03', en: 'UAE National Day', ar: 'اليوم الوطني لدولة الإمارات', notes: CONFIRMED },
];

try {
  let added = 0;
  let kept = 0;
  for (const h of HOLIDAYS) {
    // `company_id <=> NULL` because a plain `=` never matches NULL, and MySQL
    // permits many NULLs in the unique index — so the guard has to be explicit.
    const [[existing]] = await pool.query(
      'SELECT id, name_en FROM holidays WHERE holiday_date = ? AND company_id <=> NULL', [h.date]);
    if (existing) {
      console.log(`  ${h.date} already recorded as "${existing.name_en}" — left alone`);
      kept++;
      continue;
    }
    await pool.query('INSERT INTO holidays SET ?', {
      company_id: null, holiday_date: h.date,
      name_en: h.en, name_ar: h.ar, is_half_day: false, notes: h.notes,
    });
    console.log(`  ${h.date}  ${h.en}`);
    added++;
  }

  const [[c]] = await pool.query(
    "SELECT COUNT(*) n FROM holidays WHERE YEAR(holiday_date) = 2026 AND company_id IS NULL");
  console.log(`\n${added} added, ${kept} already present — ${c.n} group-wide holiday day(s) in 2026`);

  // Any holiday that lands on a day the schedule already treats as a rest day is
  // harmless but pointless, and worth knowing about.
  const [overlap] = await pool.query(`
    SELECT DATE_FORMAT(h.holiday_date, '%Y-%m-%d') d, h.name_en, ws.name_en schedule
      FROM holidays h
      JOIN work_schedule_days wsd ON wsd.weekday = DAYOFWEEK(h.holiday_date) - 1 AND wsd.is_working = FALSE
      JOIN work_schedules ws ON ws.id = wsd.schedule_id AND ws.is_default = TRUE
     WHERE YEAR(h.holiday_date) = 2026 AND h.company_id IS NULL
     ORDER BY h.holiday_date`);
  if (overlap.length) {
    console.log('\nHolidays falling on a day these schedules already rest:');
    for (const o of overlap) console.log(`  ${o.d}  ${o.name_en}  (${o.schedule})`);
  }

  console.log('\nSEED_UAE_HOLIDAYS_2026 OK');
} catch (e) {
  console.error('MIGRATION ERROR:', e.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
