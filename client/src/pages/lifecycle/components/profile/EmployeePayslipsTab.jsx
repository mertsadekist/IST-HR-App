import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { Banknote, ChevronDown, ChevronRight, Download } from 'lucide-react';
import { toast } from 'react-toastify';
import dayjs from 'dayjs';
import Card from '@components/ui/Card';
import Badge from '@components/ui/Badge';
import Button from '@components/ui/Button';
import EmptyState from '@components/ui/EmptyState';
import PayslipLines from '@components/payroll/PayslipLines';
import SalaryReport from '@pages/portal/components/SalaryReport';
import { printElementWithLetterhead, waitForPaint } from '@utils/printDoc';
import * as payrollApi from '@api/payrollApi';
import { money, runStatusLabel } from './profileUtils';
import { StatCard } from './StatCard';

const FINAL = ['Approved', 'Paid'];

/**
 * The employee's payslip history as payroll sees it: every run they were in,
 * including drafts (marked as such), each expandable into its lines. The PDF
 * statement only carries approved and paid runs — a draft can still change.
 */
export default function EmployeePayslipsTab({ employee, t }) {
  const { items: companies } = useSelector((s) => s.companies);
  const company = companies.find((c) => c.id === employee.company_id) || null;
  const [payslips, setPayslips] = useState([]);
  const [loadedFor, setLoadedFor] = useState(null);
  const loading = loadedFor !== employee.id;
  const [year, setYear] = useState('all');
  const [openId, setOpenId] = useState(null);
  const [exporting, setExporting] = useState(false);
  const reportRef = useRef(null);

  useEffect(() => {
    let alive = true;
    const id = employee.id;
    payrollApi.employeePayslips(id)
      .then(({ data }) => { if (alive) setPayslips(Array.isArray(data) ? data : []); })
      .catch(() => { if (alive) setPayslips([]); })
      .finally(() => { if (alive) setLoadedFor(id); });
    return () => { alive = false; };
  }, [employee.id]);

  const years = useMemo(() => [...new Set(payslips.map((p) => String(p.period).slice(0, 4)))].sort().reverse(), [payslips]);
  const shown = year === 'all' ? payslips : payslips.filter((p) => String(p.period).startsWith(year));
  const final = shown.filter((p) => FINAL.includes(p.run_status));
  const thisYear = String(dayjs().year());
  const ytd = payslips.filter((p) => FINAL.includes(p.run_status) && String(p.period).startsWith(thisYear))
    .reduce((s, p) => s + Number(p.net || 0), 0);
  const totalPaid = final.reduce((s, p) => s + Number(p.net || 0), 0);
  const last = payslips.find((p) => FINAL.includes(p.run_status));
  const showAdditions = shown.some((p) => Number(p.additions) > 0);
  const cols = showAdditions ? 8 : 7;

  const download = async () => {
    setExporting(true);
    try {
      await waitForPaint();
      const who = `${employee.first_name}-${employee.last_name}`.replace(/[^\w-]+/g, '_');
      await printElementWithLetterhead(reportRef.current, employee.company_id, `Salary-Statement-${who}.pdf`);
      toast.success(t('empProfile.pdf_ready'));
    } catch { toast.error(t('portal.pdf_failed')); }
    finally { setExporting(false); }
  };

  if (loading) return <Card className="!p-6 animate-pulse"><div className="h-4 bg-surface-100 rounded w-1/3" /></Card>;

  if (!payslips.length) {
    return <Card><EmptyState icon={<Banknote className="w-6 h-6 text-surface-400" />} title={t('empProfile.ps_none')} description={t('empProfile.ps_none_desc')} /></Card>;
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label={t('empProfile.kpi_last_pay')} value={last ? money(last.net) : '—'} sub={last ? dayjs(`${last.period}-01`).format('MMM YYYY') : undefined} tone="brand" />
        <StatCard label={t('empProfile.ps_ytd', { year: thisYear })} value={money(ytd)} tone="emerald" />
        <StatCard label={t('empProfile.ps_total')} value={money(totalPaid)} sub={year === 'all' ? t('empProfile.ps_all_years') : year} />
        <StatCard label={t('empProfile.ps_count')} value={shown.length} />
      </div>

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <select value={year} onChange={(e) => setYear(e.target.value)}
          className="text-sm border border-surface-200 rounded-lg px-3 py-1.5 bg-white">
          <option value="all">{t('empProfile.ps_all_years')}</option>
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-surface-400 hidden sm:inline">{t('empProfile.ps_pdf_note')}</span>
          <Button size="sm" variant="secondary" onClick={download} loading={exporting} disabled={!final.length}>
            <Download size={14} /> {t('portal.download_pdf')}
          </Button>
        </div>
      </div>

      <Card className="!p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-50 border-b border-surface-100">
              <tr className="text-[11px] uppercase tracking-wider text-surface-400">
                <th className="px-4 py-3 text-start font-semibold">{t('portal.period')}</th>
                <th className="px-4 py-3 text-end font-semibold">{t('portal.basic')}</th>
                <th className="px-4 py-3 text-end font-semibold">{t('portal.allowances')}</th>
                <th className="px-4 py-3 text-end font-semibold">{t('portal.gross')}</th>
                {showAdditions && <th className="px-4 py-3 text-end font-semibold">{t('portal.additions')}</th>}
                <th className="px-4 py-3 text-end font-semibold">{t('portal.deductions')}</th>
                <th className="px-4 py-3 text-end font-semibold">{t('portal.net')}</th>
                <th className="px-4 py-3 text-start font-semibold">{t('portal.status')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100">
              {shown.map((p) => (
                <Fragment key={p.id}>
                  <tr className={`hover:bg-surface-50/60 ${p.lines?.length ? 'cursor-pointer' : ''} ${FINAL.includes(p.run_status) ? '' : 'opacity-70'}`}
                    onClick={() => p.lines?.length && setOpenId(openId === p.id ? null : p.id)}>
                    <td className="px-4 py-3 font-medium text-surface-800 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1">
                        {p.lines?.length ? (openId === p.id ? <ChevronDown size={13} /> : <ChevronRight size={13} className="rtl:rotate-180" />) : null}
                        {dayjs(`${p.period}-01`).format('MMM YYYY')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-end text-surface-600 font-mono">{money(p.basic_salary)}</td>
                    <td className="px-4 py-3 text-end text-surface-600 font-mono">{money(p.allowances)}</td>
                    <td className="px-4 py-3 text-end text-surface-600 font-mono">{money(p.gross)}</td>
                    {showAdditions && (
                      <td className="px-4 py-3 text-end text-emerald-700 font-mono">{Number(p.additions) > 0 ? `+${money(p.additions)}` : money(0)}</td>
                    )}
                    <td className={`px-4 py-3 text-end font-mono ${Number(p.deductions) > 0 ? 'text-red-600' : 'text-surface-400'}`}>
                      {Number(p.deductions) > 0 ? `−${money(p.deductions)}` : money(0)}
                    </td>
                    <td className="px-4 py-3 text-end font-semibold text-surface-900 font-mono">{money(p.net)}</td>
                    <td className="px-4 py-3">
                      <Badge variant={p.run_status === 'Paid' ? 'active' : p.run_status === 'Approved' ? 'info' : 'warning'} className="text-[10px] whitespace-nowrap">
                        {runStatusLabel(t, p.run_status)}
                      </Badge>
                    </td>
                  </tr>
                  {openId === p.id && (
                    <tr className="bg-surface-50/70">
                      <td colSpan={cols} className="px-4 py-4"><PayslipLines t={t} lines={p.lines} net={p.net} /></td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
            <tfoot className="bg-surface-50 border-t border-surface-200">
              <tr>
                <td colSpan={cols - 2} className="px-4 py-3 text-end text-xs font-semibold text-surface-500">{t('portal.total_paid')}</td>
                <td className="px-4 py-3 text-end font-bold text-surface-900 font-mono">{money(totalPaid)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>

      <div style={{ position: 'fixed', left: '-9999px', top: 0, width: '800px' }} aria-hidden="true">
        <SalaryReport ref={reportRef} employeeName={`${employee.first_name} ${employee.last_name}`} company={company}
          payslips={final} onLetterhead={!!company?.letterhead_path} />
      </div>
    </div>
  );
}
