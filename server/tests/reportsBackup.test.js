import { describe, it, expect } from 'vitest';
import XLSX from 'xlsx';
import { validateSchedule, isDue, reportWorkbook } from '../services/reportScheduleService.js';
import { backupFileName, expiredBackups, BACKUP_FILE_RE } from '../services/nightlyBackup.js';

describe('scheduled reports', () => {
  const base = { name: 'Weekly headcount', report_key: 'headcount', frequency: 'weekly', weekday: 1, send_hour: 8, recipients: 'HR@x.ae; boss@x.ae hr@x.ae' };
  it('validates and cleans the recipients', () => {
    const v = validateSchedule(base);
    expect(v.data.recipients).toBe('hr@x.ae,boss@x.ae');
    expect(validateSchedule({ ...base, recipients: 'nope' }).error).toMatch(/Not an email/);
    expect(validateSchedule({ ...base, frequency: 'weekly', weekday: 9 }).error).toMatch(/weekday/);
    expect(validateSchedule({ ...base, report_key: 'salaries' }).error).toMatch(/report/);
  });
  it('is due once, on its day, from its hour', () => {
    const s = { active: 1, frequency: 'weekly', weekday: 1, send_hour: 8, last_sent_on: null };
    const monday9 = new Date(2026, 10, 16, 9, 0); // 16 Nov 2026 is a Monday
    expect(isDue(s, monday9)).toBe(true);
    expect(isDue(s, new Date(2026, 10, 16, 7, 0))).toBe(false);
    expect(isDue(s, new Date(2026, 10, 17, 9, 0))).toBe(false);
    expect(isDue({ ...s, last_sent_on: '2026-11-16' }, monday9)).toBe(false);
    expect(isDue({ ...s, last_sent_on: new Date(2026, 10, 16) }, monday9)).toBe(false);
    expect(isDue({ ...s, active: 0 }, monday9)).toBe(false);
  });
  it('sends a day-31 monthly report on the last day of a short month', () => {
    const s = { active: 1, frequency: 'monthly', month_day: 31, send_hour: 6 };
    expect(isDue(s, new Date(2026, 10, 30, 7))).toBe(true);
    expect(isDue(s, new Date(2026, 10, 29, 7))).toBe(false);
  });
  it('writes a sheet with a title, header and rows', () => {
    const buf = reportWorkbook({ title: 'T', columns: [{ key: 'a', label: 'A' }], rows: [{ a: 1 }, { a: 2 }] });
    const ws = XLSX.read(buf).Sheets.Report;
    expect(XLSX.utils.sheet_to_json(ws, { header: 1 })).toEqual([['T'], [], ['A'], [1], [2]]);
  });
});

describe('nightly backup', () => {
  it('names files by local date and time', () => {
    const n = backupFileName(new Date(2026, 10, 18, 2, 30));
    expect(n).toBe('hr-backup-2026-11-18-0230.json.gz');
    expect(BACKUP_FILE_RE.test(n)).toBe(true);
  });
  it('keeps the newest and ignores other files', () => {
    const names = ['hr-backup-2026-11-16-0230.json.gz', 'notes.txt', 'hr-backup-2026-11-18-0230.json.gz', 'hr-backup-2026-11-17-0230.json.gz'];
    expect(expiredBackups(names, 2)).toEqual(['hr-backup-2026-11-16-0230.json.gz']);
    expect(expiredBackups(names, 0)).toHaveLength(2); // always keeps at least one
  });
});
