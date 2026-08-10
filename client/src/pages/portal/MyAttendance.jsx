import { useState, useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import * as attendanceApi from '@api/attendanceApi';
import Card from '@components/ui/Card';
import Badge from '@components/ui/Badge';
import Button from '@components/ui/Button';
import EmptyState from '@components/ui/EmptyState';
import PortalShell from './PortalShell';
import { useMyCompany } from './useMyCompany';
import AttendanceReport from './components/AttendanceReport';
import { printElementWithLetterhead, waitForPaint } from '@utils/printDoc';
import { toast } from 'react-toastify';
import { Clock, ChevronLeft, ChevronRight, Download } from 'lucide-react';
import dayjs from 'dayjs';

// The statuses worth a colour of their own. Anything the enum grows later falls
// through to neutral rather than breaking the row.
const tone = {
  Present: 'active', Remote: 'info', Late: 'warning',
  'Half Day': 'warning', Absent: 'danger', 'On Leave': 'brand', Holiday: 'inactive',
};

const dot = (s) => (
  s === 'Absent' ? 'bg-red-500'
    : s === 'Late' || s === 'Half Day' ? 'bg-amber-500'
      : s === 'On Leave' ? 'bg-brand-500'
        : s === 'Holiday' ? 'bg-surface-300' : 'bg-emerald-500'
);

export default function MyAttendance() {
  const { t } = useTranslation();
  const { user } = useSelector((s) => s.auth);
  const myCompany = useMyCompany();
  // Browsed a month at a time: a year of daily rows is a wall of numbers, and
  // the question being asked is nearly always about this month.
  const [month, setMonth] = useState(dayjs().format('YYYY-MM'));
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const reportRef = useRef(null);

  // State is set only once the data lands: `loading` covers the first paint and
  // a month change swaps the table when the new month arrives, which keeps the
  // effect free of a synchronous setState.
  useEffect(() => {
    let alive = true;
    const from = dayjs(`${month}-01`).startOf('month').format('YYYY-MM-DD');
    const to = dayjs(`${month}-01`).endOf('month').format('YYYY-MM-DD');
    Promise.all([
      attendanceApi.list({ from, to }).catch(() => ({ data: [] })),
      attendanceApi.summary({ month }).catch(() => ({ data: null })),
    ]).then(([list, sum]) => {
      if (!alive) return;
      setRows(list.data || []);
      setSummary(sum.data || null);
      setLoading(false);
    });
    return () => { alive = false; };
  }, [month]);

  const download = async () => {
    setExporting(true);
    try {
      await waitForPaint();
      const who = (user?.name || 'employee').replace(/[^\w-]+/g, '_');
      await printElementWithLetterhead(reportRef.current, myCompany?.id, `Attendance-${month}-${who}.pdf`);
      toast.success(t('portal.pdf_downloaded'));
    } catch { toast.error(t('portal.pdf_failed')); }
    finally { setExporting(false); }
  };

  const absent = Number(summary?.by_status?.find((s) => s.status === 'Absent')?.count || 0);
  const present = Number(summary?.by_status?.find((s) => s.status === 'Present')?.count || 0);

  return (
    <PortalShell
      icon={Clock}
      title={t('portal.attendance_section')}
      subtitle={t('portal.attendance_subtitle')}
      stats={[
        { value: present, label: t('portal.at_present') },
        { value: absent, label: t('portal.at_absent') },
        { value: summary?.total_hours ?? 0, label: t('portal.total_hours') },
      ]}
    >
      <div className="flex items-center gap-2 flex-wrap justify-end">
        <Button size="sm" variant="secondary" onClick={download} loading={exporting} disabled={loading || rows.length === 0}>
          <Download size={14} /> {t('portal.download_pdf')}
        </Button>
        <button type="button" onClick={() => setMonth(dayjs(`${month}-01`).subtract(1, 'month').format('YYYY-MM'))}
          className="p-1.5 text-surface-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors" title={t('portal.prev_month')}>
          <ChevronLeft size={16} className="rtl:rotate-180" />
        </button>
        <input type="month" value={month} max={dayjs().format('YYYY-MM')}
          onChange={(e) => e.target.value && setMonth(e.target.value)}
          className="text-sm border border-surface-200 rounded-lg px-3 py-1.5 bg-white" />
        <button type="button" onClick={() => setMonth(dayjs(`${month}-01`).add(1, 'month').format('YYYY-MM'))}
          disabled={month >= dayjs().format('YYYY-MM')}
          className="p-1.5 text-surface-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors disabled:opacity-30" title={t('portal.next_month')}>
          <ChevronRight size={16} className="rtl:rotate-180" />
        </button>
      </div>

      {summary?.by_status?.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {summary.by_status.map((s) => (
            <Card key={s.status} className="!p-4">
              <p className="text-2xl font-bold text-surface-900">{s.count}</p>
              <div className="flex items-center gap-1.5 mt-1">
                <span className={`w-2 h-2 rounded-full ${dot(s.status)}`} />
                <span className="text-xs text-surface-500">
                  {t(`portal.at_${s.status.toLowerCase().replace(' ', '_')}`, s.status)}
                </span>
              </div>
            </Card>
          ))}
          <Card className="!p-4 bg-surface-50">
            <p className="text-2xl font-bold text-surface-900">{summary.total_hours}</p>
            <p className="text-xs text-surface-500 mt-1">{t('portal.total_hours')}</p>
          </Card>
        </div>
      )}

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
                  <th className="px-5 py-3 text-start font-semibold">{t('portal.date')}</th>
                  <th className="px-5 py-3 text-start font-semibold">{t('portal.day')}</th>
                  <th className="px-5 py-3 text-start font-semibold">{t('portal.check_in')}</th>
                  <th className="px-5 py-3 text-start font-semibold">{t('portal.check_out')}</th>
                  <th className="px-5 py-3 text-end font-semibold">{t('portal.hours')}</th>
                  <th className="px-5 py-3 text-start font-semibold">{t('portal.status')}</th>
                  <th className="px-5 py-3 text-start font-semibold">{t('portal.notes')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100">
                {rows.map((a) => (
                  <tr key={a.id} className={`hover:bg-surface-50/60 ${a.status === 'Absent' ? 'bg-red-50/40' : ''}`}>
                    <td className="px-5 py-2.5 font-medium text-surface-800">{a.work_date}</td>
                    <td className="px-5 py-2.5 text-surface-500">{dayjs(a.work_date).format('ddd')}</td>
                    <td className="px-5 py-2.5 font-mono text-surface-600">{a.check_in || '—'}</td>
                    <td className="px-5 py-2.5 font-mono text-surface-600">{a.check_out || '—'}</td>
                    <td className="px-5 py-2.5 text-end text-surface-700">{a.work_hours != null ? Number(a.work_hours).toFixed(2) : '—'}</td>
                    <td className="px-5 py-2.5">
                      <Badge className="text-[10px]" variant={tone[a.status] || 'info'}>
                        {t(`portal.at_${String(a.status || '').toLowerCase().replace(' ', '_')}`, a.status)}
                      </Badge>
                    </td>
                    <td className="px-5 py-2.5 text-xs text-surface-500 max-w-[16rem] truncate">{a.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <div style={{ position: 'fixed', left: '-9999px', top: 0, width: '800px' }} aria-hidden="true">
        <AttendanceReport ref={reportRef} employeeName={user?.name} company={myCompany}
          month={month} rows={rows} summary={summary} onLetterhead={!!myCompany?.letterhead_path} />
      </div>
    </PortalShell>
  );
}
