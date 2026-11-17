import { useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { Clock, ChevronLeft, ChevronRight, Download, Info } from 'lucide-react';
import { toast } from 'react-toastify';
import dayjs from 'dayjs';
import Card from '@components/ui/Card';
import Badge from '@components/ui/Badge';
import Button from '@components/ui/Button';
import EmptyState from '@components/ui/EmptyState';
import AttendanceReport from '@pages/portal/components/AttendanceReport';
import { printElementWithLetterhead, waitForPaint } from '@utils/printDoc';
import * as attendanceApi from '@api/attendanceApi';
import { attendanceStatusLabel, attendanceTone } from './profileUtils';
import { StatCard } from './StatCard';

const count = (summary, status) => Number(summary?.by_status?.find((s) => s.status === status)?.count || 0);

/**
 * The employee's attendance sheet, a month at a time, with the same printable
 * report the employee can download from their own portal.
 */
export default function EmployeeAttendanceTab({ employee, t }) {
  const { i18n } = useTranslation();
  // Weekday in the interface language (dayjs is not localised here).
  const weekday = (d) => new Date(`${d}T00:00:00`).toLocaleDateString(i18n.language === 'ar' ? 'ar' : 'en', { weekday: 'short' });
  const { items: companies } = useSelector((s) => s.companies);
  const company = companies.find((c) => c.id === employee.company_id) || null;
  const [month, setMonth] = useState(dayjs().format('YYYY-MM'));
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loadedKey, setLoadedKey] = useState(null);
  const key = `${employee.id}:${month}`;
  const loading = loadedKey !== key;
  const [exporting, setExporting] = useState(false);
  const reportRef = useRef(null);

  useEffect(() => {
    let alive = true;
    const k = `${employee.id}:${month}`;
    const from = dayjs(`${month}-01`).startOf('month').format('YYYY-MM-DD');
    const to = dayjs(`${month}-01`).endOf('month').format('YYYY-MM-DD');
    Promise.all([
      attendanceApi.list({ employee_id: employee.id, from, to }).catch(() => ({ data: [] })),
      attendanceApi.summary({ employee_id: employee.id, month }).catch(() => ({ data: null })),
    ]).then(([list, sum]) => {
      if (!alive) return;
      setRows(Array.isArray(list.data) ? list.data : []);
      setSummary(sum.data || null);
      setLoadedKey(k);
    });
    return () => { alive = false; };
  }, [employee.id, month]);

  const shift = (n) => setMonth(dayjs(`${month}-01`).add(n, 'month').format('YYYY-MM'));

  const download = async () => {
    setExporting(true);
    try {
      await waitForPaint();
      const who = `${employee.first_name}-${employee.last_name}`.replace(/[^\w-]+/g, '_');
      await printElementWithLetterhead(reportRef.current, employee.company_id, `Attendance-${month}-${who}.pdf`);
      toast.success(t('empProfile.pdf_ready'));
    } catch { toast.error(t('portal.pdf_failed')); }
    finally { setExporting(false); }
  };

  const lateMinutes = rows.reduce((s, r) => s + Number(r.late_minutes || 0), 0);

  return (
    <div className="space-y-4">
      {!!employee.is_owner && (
        <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 flex items-start gap-2 text-xs text-blue-800">
          <Info size={15} className="shrink-0 mt-0.5" /> {t('empProfile.att_owner_note')}
        </div>
      )}

      <div className="flex items-center gap-2 flex-wrap justify-between">
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => shift(-1)}
            className="p-1.5 text-surface-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors" title={t('portal.prev_month')}>
            <ChevronLeft size={16} className="rtl:rotate-180" />
          </button>
          <input type="month" value={month} max={dayjs().format('YYYY-MM')}
            onChange={(e) => e.target.value && setMonth(e.target.value)}
            className="text-sm border border-surface-200 rounded-lg px-3 py-1.5 bg-white" />
          <button type="button" onClick={() => shift(1)} disabled={month >= dayjs().format('YYYY-MM')}
            className="p-1.5 text-surface-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors disabled:opacity-30" title={t('portal.next_month')}>
            <ChevronRight size={16} className="rtl:rotate-180" />
          </button>
        </div>
        <Button size="sm" variant="secondary" onClick={download} loading={exporting} disabled={loading || rows.length === 0}>
          <Download size={14} /> {t('portal.download_pdf')}
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard label={t('portal.at_present')} value={count(summary, 'Present') + count(summary, 'Remote')} tone="emerald" />
        <StatCard label={t('portal.at_late')} value={count(summary, 'Late')} sub={lateMinutes ? t('empProfile.att_minutes', { n: lateMinutes }) : undefined} tone="amber" />
        <StatCard label={t('portal.at_absent')} value={count(summary, 'Absent')} tone="red" />
        <StatCard label={t('portal.at_half_day')} value={count(summary, 'Half Day')} />
        <StatCard label={t('portal.at_on_leave')} value={count(summary, 'On Leave')} tone="brand" />
        <StatCard label={t('portal.total_hours')} value={summary?.total_hours ?? 0} />
      </div>

      {loading ? (
        <Card className="!p-6 animate-pulse"><div className="h-4 bg-surface-100 rounded w-1/3" /></Card>
      ) : rows.length === 0 ? (
        <Card><EmptyState icon={<Clock className="w-6 h-6 text-surface-400" />}
          title={t('portal.no_attendance')}
          description={t('portal.no_attendance_desc', { month: dayjs(`${month}-01`).format('MMMM YYYY') })} /></Card>
      ) : (
        <Card className="!p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-50 border-b border-surface-100">
                <tr className="text-[11px] uppercase tracking-wider text-surface-400">
                  <th className="px-4 py-3 text-start font-semibold">{t('portal.date')}</th>
                  <th className="px-4 py-3 text-start font-semibold">{t('portal.day')}</th>
                  <th className="px-4 py-3 text-start font-semibold">{t('empProfile.att_shift')}</th>
                  <th className="px-4 py-3 text-start font-semibold">{t('portal.check_in')}</th>
                  <th className="px-4 py-3 text-start font-semibold">{t('portal.check_out')}</th>
                  <th className="px-4 py-3 text-end font-semibold">{t('portal.hours')}</th>
                  <th className="px-4 py-3 text-end font-semibold">{t('empProfile.att_late_min')}</th>
                  <th className="px-4 py-3 text-start font-semibold">{t('portal.status')}</th>
                  <th className="px-4 py-3 text-start font-semibold">{t('portal.notes')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100">
                {rows.map((a) => (
                  <tr key={a.id} className={`hover:bg-surface-50/60 ${a.status === 'Absent' ? 'bg-red-50/40' : ''}`}>
                    <td className="px-4 py-2.5 font-medium text-surface-800 whitespace-nowrap">{a.work_date}</td>
                    <td className="px-4 py-2.5 text-surface-500">{weekday(a.work_date)}</td>
                    <td className="px-4 py-2.5 font-mono text-surface-400 text-xs whitespace-nowrap">
                      {a.scheduled_in && a.scheduled_out ? `${a.scheduled_in}–${a.scheduled_out}` : '—'}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-surface-600">{a.check_in || '—'}</td>
                    <td className="px-4 py-2.5 font-mono text-surface-600">{a.check_out || '—'}</td>
                    <td className="px-4 py-2.5 text-end text-surface-700">{a.work_hours != null ? Number(a.work_hours).toFixed(2) : '—'}</td>
                    <td className={`px-4 py-2.5 text-end ${Number(a.late_minutes) > 0 ? 'text-amber-700 font-semibold' : 'text-surface-300'}`}>{Number(a.late_minutes) > 0 ? a.late_minutes : '—'}</td>
                    <td className="px-4 py-2.5">
                      <Badge className="text-[10px] whitespace-nowrap" variant={attendanceTone[a.status] || 'info'}>{attendanceStatusLabel(t, a.status)}</Badge>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-surface-500 max-w-[16rem] truncate">{a.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <div style={{ position: 'fixed', left: '-9999px', top: 0, width: '800px' }} aria-hidden="true">
        <AttendanceReport ref={reportRef} employeeName={`${employee.first_name} ${employee.last_name}`} company={company}
          month={month} rows={rows} summary={summary} onLetterhead={!!company?.letterhead_path} />
      </div>
    </div>
  );
}
