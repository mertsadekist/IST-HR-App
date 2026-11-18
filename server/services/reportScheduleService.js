/**
 * Scheduled reports: a report emailed as an Excel file on a schedule
 * (daily, a weekday, or a day of the month, at an hour), to a list of people.
 *
 * The scheduler wakes every few minutes and sends whatever is due and has not
 * gone out today. The report definitions are small SQL reads scoped to the
 * schedule's company (or every company when it has none).
 */
import XLSX from 'xlsx';

export const REPORT_KEYS = ['headcount', 'expiring_documents', 'upcoming_leave', 'attendance_exceptions'];
export const FREQUENCIES = ['daily', 'weekly', 'monthly'];
const EMAIL_RE = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;

/** @returns {{error:string}|{data:object}} */
export function validateSchedule(b = {}) {
  const name = String(b.name || '').trim();
  if (name.length < 3 || name.length > 120) return { error: 'Give the schedule a name (3 to 120 characters)' };
  if (!REPORT_KEYS.includes(b.report_key)) return { error: 'Choose a report' };
  if (!FREQUENCIES.includes(b.frequency)) return { error: 'Choose how often' };
  const hour = Number(b.send_hour);
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) return { error: 'Choose the hour' };
  const weekday = b.frequency === 'weekly' ? Number(b.weekday) : null;
  if (b.frequency === 'weekly' && !(Number.isInteger(weekday) && weekday >= 0 && weekday <= 6)) return { error: 'Choose the weekday' };
  const monthDay = b.frequency === 'monthly' ? Number(b.month_day) : null;
  if (b.frequency === 'monthly' && !(Number.isInteger(monthDay) && monthDay >= 1 && monthDay <= 31)) return { error: 'Choose the day of the month' };
  const recipients = [...new Set(String(Array.isArray(b.recipients) ? b.recipients.join(',') : b.recipients || '')
    .split(/[,;\s]+/).map((s) => s.trim().toLowerCase()).filter(Boolean))];
  if (!recipients.length) return { error: 'Add at least one recipient' };
  const bad = recipients.find((r) => !EMAIL_RE.test(r));
  if (bad) return { error: `Not an email address: ${bad}` };
  if (recipients.length > 20) return { error: 'At most 20 recipients' };
  return { data: { name, report_key: b.report_key, frequency: b.frequency, send_hour: hour, weekday, month_day: monthDay, recipients: recipients.join(','), active: b.active === false ? 0 : 1 } };
}

const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/**
 * Due now: the hour has come (or passed) today, today is a sending day, and it
 * has not been sent today. A day-31 schedule sends on the last day of shorter months.
 * `now` is local time (process.env.TZ is the app's timezone).
 */
export function isDue(s, now = new Date()) {
  if (!s.active) return false;
  if (now.getHours() < Number(s.send_hour)) return false;
  // mysql2 returns a DATE as a Date at local midnight unless it was formatted in SQL.
  const sent = s.last_sent_on instanceof Date ? ymd(s.last_sent_on) : String(s.last_sent_on || '').slice(0, 10);
  if (sent === ymd(now)) return false;
  if (s.frequency === 'weekly') return now.getDay() === Number(s.weekday);
  if (s.frequency === 'monthly') {
    const last = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    return now.getDate() === Math.min(Number(s.month_day), last);
  }
  return true;
}

export { ymd as localYmd };

/** The workbook for a report: one sheet, a header row, then the rows. */
export function reportWorkbook({ title, columns, rows }) {
  const aoa = [[title], [], columns.map((c) => c.label), ...rows.map((r) => columns.map((c) => r[c.key] ?? ''))];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = columns.map((c) => ({ wch: c.width || 18 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Report');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

const NAME = "TRIM(CONCAT(COALESCE(e.first_name,''),' ',COALESCE(e.last_name,'')))";

/**
 * Read a report's rows.
 * @param {import('mysql2/promise').Pool} pool
 * @param {string} key
 * @param {number|null} companyId null = every company
 */
export async function buildReport(pool, key, companyId) {
  const co = companyId ? { clause: ' AND e.company_id = ?', params: [companyId] } : { clause: '', params: [] };
  if (key === 'headcount') {
    const [rows] = await pool.query(
      `SELECT c.name AS company, COALESCE(d.name, '—') AS department, ${NAME} AS employee, e.nationality,
              e.status, DATE_FORMAT(e.start_date, '%Y-%m-%d') AS start_date, COALESCE(e.job_title_text, jt.title, '') AS job_title
         FROM employees e JOIN companies c ON c.id = e.company_id
         LEFT JOIN departments d ON d.id = e.department_id LEFT JOIN job_titles jt ON jt.id = e.job_title_id
        WHERE e.status IN ('Active','Onboarding','Offboarding')${co.clause}
        ORDER BY c.name, department, employee`, co.params);
    return { title: `Headcount — ${rows.length} employee(s)`, rows, columns: [
      { key: 'company', label: 'Company', width: 24 }, { key: 'department', label: 'Department', width: 20 },
      { key: 'employee', label: 'Employee', width: 26 }, { key: 'job_title', label: 'Job title', width: 24 },
      { key: 'nationality', label: 'Nationality' }, { key: 'status', label: 'Status', width: 12 }, { key: 'start_date', label: 'Joined', width: 12 },
    ] };
  }
  if (key === 'expiring_documents') {
    const [rows] = await pool.query(
      `SELECT ${NAME} AS employee, c.name AS company, d.doc_type, d.doc_number,
              DATE_FORMAT(d.expiry_date, '%Y-%m-%d') AS expiry_date, DATEDIFF(d.expiry_date, CURDATE()) AS days_left
         FROM employee_documents d JOIN employees e ON e.id = d.employee_id JOIN companies c ON c.id = e.company_id
        WHERE d.expiry_date IS NOT NULL AND d.expiry_date <= DATE_ADD(CURDATE(), INTERVAL 60 DAY)
          AND e.status IN ('Active','Onboarding','Offboarding')${co.clause}
        ORDER BY d.expiry_date`, co.params);
    return { title: `Employee documents expired or expiring within 60 days — ${rows.length}`, rows, columns: [
      { key: 'employee', label: 'Employee', width: 26 }, { key: 'company', label: 'Company', width: 22 },
      { key: 'doc_type', label: 'Document', width: 20 }, { key: 'doc_number', label: 'Number', width: 18 },
      { key: 'expiry_date', label: 'Expires', width: 12 }, { key: 'days_left', label: 'Days left', width: 10 },
    ] };
  }
  if (key === 'upcoming_leave') {
    const [rows] = await pool.query(
      `SELECT ${NAME} AS employee, c.name AS company, lt.name AS leave_type,
              DATE_FORMAT(lr.start_date, '%Y-%m-%d') AS start_date, DATE_FORMAT(lr.end_date, '%Y-%m-%d') AS end_date, lr.status
         FROM leave_requests lr JOIN employees e ON e.id = lr.employee_id JOIN companies c ON c.id = e.company_id
         LEFT JOIN leave_types lt ON lt.id = lr.leave_type_id
        WHERE lr.status IN ('Approved','Pending') AND lr.end_date >= CURDATE()
          AND lr.start_date <= DATE_ADD(CURDATE(), INTERVAL 14 DAY)${co.clause}
        ORDER BY lr.start_date, employee`, co.params);
    return { title: `Leave in the next 14 days — ${rows.length}`, rows, columns: [
      { key: 'employee', label: 'Employee', width: 26 }, { key: 'company', label: 'Company', width: 22 },
      { key: 'leave_type', label: 'Leave', width: 18 }, { key: 'start_date', label: 'From', width: 12 },
      { key: 'end_date', label: 'To', width: 12 }, { key: 'status', label: 'Status', width: 12 },
    ] };
  }
  if (key === 'attendance_exceptions') {
    const [rows] = await pool.query(
      `SELECT ${NAME} AS employee, c.name AS company, DATE_FORMAT(a.work_date, '%Y-%m-%d') AS work_date, a.status,
              DATE_FORMAT(a.check_in, '%H:%i') AS check_in, DATE_FORMAT(a.check_out, '%H:%i') AS check_out
         FROM attendance a JOIN employees e ON e.id = a.employee_id JOIN companies c ON c.id = e.company_id
        WHERE a.work_date = DATE_SUB(CURDATE(), INTERVAL 1 DAY) AND a.status IN ('Absent','Late','Half Day')${co.clause}
        ORDER BY a.status, employee`, co.params);
    return { title: `Yesterday’s absences and late arrivals — ${rows.length}`, rows, columns: [
      { key: 'employee', label: 'Employee', width: 26 }, { key: 'company', label: 'Company', width: 22 },
      { key: 'work_date', label: 'Date', width: 12 }, { key: 'status', label: 'Status', width: 12 },
      { key: 'check_in', label: 'In', width: 8 }, { key: 'check_out', label: 'Out', width: 8 },
    ] };
  }
  throw new Error(`Unknown report ${key}`);
}
