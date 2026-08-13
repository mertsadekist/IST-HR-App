// Idempotent migration: a Monday–Friday, no-meal-break week for IST Real Estate.
//
// The seeded "IST Real Estate — No Meal Break" schedule keeps the company's short
// Saturday, because that is the company's week. Two people work the no-break day
// but do not work Saturdays at all, and assigning them a Saturday-working
// schedule generated an absence every week.
//
// The evidence is unambiguous: across ten weeks from 1 June, Mayas Barshiny and
// Subrat Poudyal have zero Saturday punches, while every one of their eighteen
// IST Real Estate colleagues has between two and ten. The feed covered those
// Saturdays — other people are in it — so the silence is real, not a gap.
//
// Only the schedule is created here. Who is assigned to it is operational data
// that HR owns through Settings → Work Schedules → Coverage, and does not belong
// in a migration.
//
// Safe to re-run.
import pool from './config/db.js';

const NAME_EN = 'IST Real Estate — No Meal Break (Mon–Fri)';

try {
  const [[company]] = await pool.query("SELECT id FROM companies WHERE short_code = 'ISTRE'");
  if (!company) {
    console.log('IST Real Estate (ISTRE) not present on this database — nothing to do');
  } else {
    const [[existing]] = await pool.query(
      'SELECT id FROM work_schedules WHERE company_id = ? AND name_en = ?', [company.id, NAME_EN]);
    if (existing) {
      console.log(`"${NAME_EN}" already present (#${existing.id}) — left untouched`);
    } else {
      const [r] = await pool.query('INSERT INTO work_schedules SET ?', {
        company_id: company.id,
        name_en: NAME_EN,
        name_ar: 'آي إس تي العقارية — بدون فترة طعام (الاثنين–الجمعة)',
        is_default: false,
        notes: 'No meal break, day ends at 18:00. Saturday off — evidenced by zero Saturday punches since June.',
      });
      for (let weekday = 0; weekday <= 6; weekday++) {
        const working = weekday >= 1 && weekday <= 5;
        await pool.query('INSERT INTO work_schedule_days SET ?', {
          schedule_id: r.insertId, weekday, is_working: working,
          start_time: working ? '10:00:00' : null,
          end_time: working ? '18:00:00' : null,
          break_minutes: 0,
        });
      }
      console.log(`created "${NAME_EN}" (#${r.insertId}) — Mon–Fri 10:00–18:00, no break, Sat and Sun off`);
    }

    const [[assigned]] = await pool.query(`
      SELECT COUNT(*) c FROM employee_work_schedules ews
        JOIN work_schedules ws ON ws.id = ews.schedule_id
       WHERE ws.name_en = ? AND (ews.effective_to IS NULL OR ews.effective_to >= CURDATE())`, [NAME_EN]);
    console.log(`${assigned.c} employee(s) currently on it`);
  }
  console.log('NO_BREAK_MONFRI_SCHEDULE OK');
} catch (e) {
  console.error('MIGRATION ERROR:', e.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
