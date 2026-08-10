import { useState, useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import * as payrollApi from '@api/payrollApi';
import Card from '@components/ui/Card';
import Badge from '@components/ui/Badge';
import Button from '@components/ui/Button';
import EmptyState from '@components/ui/EmptyState';
import PortalShell from './PortalShell';
import { useMyCompany } from './useMyCompany';
import SalaryReport from './components/SalaryReport';
import { printElementWithLetterhead, waitForPaint } from '@utils/printDoc';
import { toast } from 'react-toastify';
import { Banknote, Download } from 'lucide-react';

const money = (n) => Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function MySalary() {
  const { t } = useTranslation();
  const { user } = useSelector((s) => s.auth);
  const myCompany = useMyCompany();
  const [payslips, setPayslips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const reportRef = useRef(null);

  useEffect(() => {
    let alive = true;
    payrollApi.myPayslips({})
      .then(({ data }) => { if (alive) setPayslips(data || []); })
      .catch(() => { if (alive) setPayslips([]); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const download = async () => {
    setExporting(true);
    try {
      await waitForPaint();
      const who = (user?.name || 'employee').replace(/[^\w-]+/g, '_');
      await printElementWithLetterhead(reportRef.current, myCompany?.id, `Salary-Statement-${who}.pdf`);
      toast.success(t('portal.pdf_downloaded'));
    } catch { toast.error(t('portal.pdf_failed')); }
    finally { setExporting(false); }
  };

  const totalPaid = payslips.reduce((s, p) => s + Number(p.net || 0), 0);
  const lastNet = payslips[0]?.net;

  return (
    <PortalShell
      icon={Banknote}
      title={t('portal.salary_section')}
      subtitle={t('portal.salary_subtitle')}
      stats={[
        { value: payslips.length, label: t('portal.payslips_count') },
        { value: lastNet != null ? money(lastNet) : '—', label: t('portal.last_payment') },
      ]}
      actions={(
        <Button size="sm" variant="secondary" onClick={download} loading={exporting} disabled={loading || payslips.length === 0}>
          <Download size={14} /> {t('portal.download_pdf')}
        </Button>
      )}
    >
      {loading ? (
        <Card className="!p-6 animate-pulse"><div className="h-4 bg-surface-100 rounded w-1/3" /></Card>
      ) : payslips.length === 0 ? (
        <Card><EmptyState icon={<Banknote className="w-6 h-6 text-surface-400" />}
          title={t('portal.no_payslips')} description={t('portal.no_payslips_desc')} /></Card>
      ) : (
        <Card className="!p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-50 border-b border-surface-100">
                <tr className="text-[11px] uppercase tracking-wider text-surface-400">
                  <th className="px-5 py-3 text-start font-semibold">{t('portal.period')}</th>
                  <th className="px-5 py-3 text-end font-semibold">{t('portal.basic')}</th>
                  <th className="px-5 py-3 text-end font-semibold">{t('portal.allowances')}</th>
                  <th className="px-5 py-3 text-end font-semibold">{t('portal.gross')}</th>
                  <th className="px-5 py-3 text-end font-semibold">{t('portal.deductions')}</th>
                  <th className="px-5 py-3 text-end font-semibold">{t('portal.net')}</th>
                  <th className="px-5 py-3 text-start font-semibold">{t('portal.status')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100">
                {payslips.map((p) => (
                  <tr key={p.id} className="hover:bg-surface-50/60">
                    <td className="px-5 py-3 font-medium text-surface-800">{p.period}</td>
                    <td className="px-5 py-3 text-end text-surface-600">{money(p.basic_salary)}</td>
                    <td className="px-5 py-3 text-end text-surface-600">{money(p.allowances)}</td>
                    <td className="px-5 py-3 text-end text-surface-600">{money(p.gross)}</td>
                    <td className={`px-5 py-3 text-end ${Number(p.deductions) > 0 ? 'text-red-600' : 'text-surface-400'}`}>
                      {Number(p.deductions) > 0 ? `−${money(p.deductions)}` : money(0)}
                    </td>
                    <td className="px-5 py-3 text-end font-semibold text-surface-900">{money(p.net)}</td>
                    <td className="px-5 py-3">
                      <Badge variant={p.run_status === 'Paid' ? 'active' : 'warning'} className="text-[10px]">
                        {t(`portal.st_${String(p.run_status || '').toLowerCase()}`, p.run_status)}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-surface-50 border-t border-surface-200">
                <tr>
                  <td colSpan={5} className="px-5 py-3 text-end text-xs font-semibold text-surface-500">{t('portal.total_paid')}</td>
                  <td className="px-5 py-3 text-end font-bold text-surface-900">{money(totalPaid)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
      )}

      <div style={{ position: 'fixed', left: '-9999px', top: 0, width: '800px' }} aria-hidden="true">
        <SalaryReport ref={reportRef} employeeName={user?.name} company={myCompany}
          payslips={payslips} onLetterhead={!!myCompany?.letterhead_path} />
      </div>
    </PortalShell>
  );
}
