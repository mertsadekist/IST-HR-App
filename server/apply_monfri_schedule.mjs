// Idempotent migration: a Monday–Friday week for IST Real Estate.
//
// The company's own week includes a short Saturday, 10:00–15:00, and the seeded
// "IST Real Estate — Standard" says so. Two people work standard hours from
// Monday to Friday and do not work Saturdays at all, so assigning them the
// company default raised an absence against each of them every single week.
//
// The punch record is unambiguous. Across ten weeks from 1 June, Mayas Barshiny
// and Subrat Poudyal have zero Saturday punches, while every one of their
// eighteen IST Real Estate colleagues has between two and ten. The feed covered
// those Saturdays — the colleagues are in it — so the silence is theirs.
//
// Hours are the ordinary ones: 10:00–19:00 with the hour for lunch, 480 net.
// They were briefly put on a no-meal-break week ending at 18:00, on the reading
// that the meal-break exemption meant they left early. It does not: they work to
// 19:00 and take the break. The 18:00 version recorded roughly 54 minutes of
// phantom surplus per day, which is why this schedule carries the standard hours
// and only the Saturday differs.
//
// Only the schedule is created here. Who sits on it is operational data that HR
// owns through Settings → Work Schedules → Coverage.
//
// Safe to re-run.
import pool from './config/db.js';

const NAME_EN = 'IST Real Estate — Standard (Mon–Fri)';

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
        name_ar: 'آي إس تي العقارية — الدوام القياسي (الاثنين–الجمعة)',
        is_default: false,
        notes: 'Standard hours and meal break, but Saturday off — evidenced by zero Saturday punches since June.',
      });
      for (let weekday = 0; weekday <= 6; weekday++) {
        const working = weekday >= 1 && weekday <= 5;
        await pool.query('INSERT INTO work_schedule_days SET ?', {
          schedule_id: r.insertId, weekday, is_working: working,
          start_time: working ? '10:00:00' : null,
          end_time: working ? '19:00:00' : null,
          break_minutes: working ? 60 : 0,
        });
      }
      console.log(`created "${NAME_EN}" (#${r.insertId}) — Mon–Fri 10:00–19:00, 60m break, Sat and Sun off`);
    }

    const [[assigned]] = await pool.query(`
      SELECT COUNT(*) c FROM employee_work_schedules ews
        JOIN work_schedules ws ON ws.id = ews.schedule_id
       WHERE ws.name_en = ? AND (ews.effective_to IS NULL OR ews.effective_to >= CURDATE())`, [NAME_EN]);
    console.log(`${assigned.c} employee(s) currently on it`);
  }
  console.log('MONFRI_SCHEDULE OK');
} catch (e) {
  console.error('MIGRATION ERROR:', e.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
