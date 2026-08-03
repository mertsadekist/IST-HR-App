import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import * as payApi from '@api/payrollApi';
import Card from '@components/ui/Card';
import Button from '@components/ui/Button';
import Badge from '@components/ui/Badge';
import Modal from '@components/ui/Modal';
import EmptyState from '@components/ui/EmptyState';
import { toast } from 'react-toastify';
import { confirmDelete } from '@utils/confirm';
import { Banknote, Plus, RefreshCw, Loader2, CheckCircle2, Trash2, FileSpreadsheet, AlertTriangle } from 'lucide-react';
import { downloadBlob } from '@utils/pdf';
import dayjs from 'dayjs';

const apiErr = (e, f) => e?.response?.data?.error || (e?.response?.data?.errors?.[0]?.message) || f;
const statusVariant = (s) => ({ Draft: 'info', Approved: 'warning', Paid: 'success', Cancelled: 'danger' }[s] || 'info');
const stLabel = (t, s) => t(`payroll_runs.st_${String(s || '').toLowerCase()}`, s);

export default function PayrollRuns() {
  const { t } = useTranslation();
  const { user } = useSelector((s) => s.auth);
  const { currentCompanyId } = useSelector((s) => s.entity);
  const isAdmin = user?.role === 'admin';
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState(dayjs().format('YYYY-MM'));
  const [generating, setGenerating] = useState(false);
  const [openRun, setOpenRun] = useState(null);
  const [detail, setDetail] = useState(null);
  const [myslips, setMyslips] = useState([]);
  const [wps, setWps] = useState(null);       // readiness report for the open run
  const [wpsBusy, setWpsBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    try { const { data } = await payApi.getRuns(currentCompanyId ? { company_id: currentCompanyId } : {}); setRuns(data); } catch { toast.error(t('common.failed_load')); }
    finally { setLoading(false); }
    try { const { data } = await payApi.myPayslips({}); setMyslips(data); } catch { /* ignore */ }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [currentCompanyId]);

  const generate = async () => {
    if (!currentCompanyId) { toast.error(t('payroll_runs.select_company')); return; }
    setGenerating(true);
    try { const { data } = await payApi.generateRun({ period, company_id: currentCompanyId }); toast.success(t('payroll_runs.run_generated', { count: data.employee_count, net: data.total_net })); load(); }
    catch (e) { toast.error(apiErr(e, t('payroll_runs.generate_failed'))); } finally { setGenerating(false); }
  };
  const openDetail = async (r) => { setOpenRun(r); try { const { data } = await payApi.getRun(r.id); setDetail(data); } catch { toast.error(t('payroll_runs.load_run_failed')); } };
  const reloadDetail = async () => { if (openRun) { const { data } = await payApi.getRun(openRun.id); setDetail(data); } load(); };

  const approve = async (r) => { try { await payApi.approveRun(r.id); toast.success(t('payroll_runs.approved')); reloadDetail(); } catch (e) { toast.error(apiErr(e, t('common.operation_failed'))); } };
  const pay = async (r) => { try { await payApi.markPaid(r.id); toast.success(t('payroll_runs.marked_paid')); reloadDetail(); } catch (e) { toast.error(apiErr(e, t('common.operation_failed'))); } };
  const del = async (r) => { const c = await confirmDelete(`payroll run ${r.period}`); if (!c.isConfirmed) return; try { await payApi.deleteRun(r.id); toast.success(t('common.deleted')); if (document.activeElement instanceof HTMLElement) document.activeElement.blur(); setOpenRun(null); setDetail(null); load(); } catch (e) { toast.error(apiErr(e, t('common.operation_failed'))); } };

  // ── WPS (UAE Wage Protection System) ──────────────────────────────────────
  // The readiness panel is always shown first: the file goes to the Ministry of
  // Labour, so the totals and any missing identifiers get one deliberate review.
  const openWps = async () => {
    setWpsBusy(true);
    try { const { data } = await payApi.wpsReadiness(detail.id); setWps(data); }
    catch (e) { toast.error(apiErr(e, t('payroll_runs.wps_check_failed'))); }
    finally { setWpsBusy(false); }
  };
  const downloadWps = async (force) => {
    setWpsBusy(true);
    try {
      const res = await payApi.wpsExport(detail.id, force);
      const match = /filename="([^"]+)"/.exec(res.headers['content-disposition'] || '');
      downloadBlob(res.data, match?.[1] || `WPS-${detail.period}.xlsx`);
      toast.success(t('payroll_runs.wps_downloaded'));
      setWps(null);
    } catch (e) { toast.error(apiErr(e, t('payroll_runs.wps_failed'))); }
    finally { setWpsBusy(false); }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-surface-900">{t('payroll_runs.title')}</h1>
          <p className="text-surface-500 mt-0.5 text-sm">{t('payroll_runs.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <input type="month" value={period} onChange={(e) => setPeriod(e.target.value)} className="text-sm border border-surface-200 rounded-lg px-3 py-2" />
          <Button onClick={generate} loading={generating}><Plus size={16} /> {t('payroll_runs.generate')}</Button>
          <Button variant="secondary" onClick={load}><RefreshCw size={14} /></Button>
        </div>
      </div>

      {loading ? (
        <div className="card p-6 animate-pulse"><div className="h-4 bg-surface-200 rounded w-1/3" /></div>
      ) : runs.length === 0 ? (
        <Card><EmptyState icon={<Banknote className="w-6 h-6 text-surface-400" />} title={t('payroll_runs.no_runs')} description={t('payroll_runs.no_runs_desc')} /></Card>
      ) : (
        <div className="space-y-2">
          {runs.map((r) => (
            <Card key={r.id} hover className="!p-4 cursor-pointer" onClick={() => openDetail(r)}>
              <div className="flex items-center gap-4 flex-wrap">
                <div className="w-10 h-10 rounded-xl bg-brand-100 flex items-center justify-center text-brand-700"><Banknote size={18} /></div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2"><span className="font-semibold text-surface-900">{dayjs(r.period + '-01').format('MMMM YYYY')}</span><Badge variant={statusVariant(r.status)}>{stLabel(t, r.status)}</Badge></div>
                  <p className="text-xs text-surface-400 mt-0.5">{r.employee_count} {t('payroll_runs.employees')} · {t('payroll_runs.gross')} {r.total_gross} · {t('payroll_runs.deductions')} {r.total_deductions}</p>
                </div>
                <div className="text-right"><p className="text-xs text-surface-400">{t('payroll_runs.net_total')}</p><p className="font-bold text-brand-600">{r.total_net}</p></div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* My payslips */}
      {myslips.length > 0 && (
        <Card className="!p-0 overflow-hidden">
          <div className="p-4 border-b border-surface-100"><h3 className="font-semibold text-surface-800">{t('payroll_runs.my_payslips')}</h3></div>
          <table className="w-full text-sm">
            <thead className="bg-surface-50 text-surface-500 text-xs"><tr><th className="text-left p-3">{t('payroll_runs.th_period')}</th><th className="p-3">{t('payroll_runs.th_gross')}</th><th className="p-3">{t('payroll_runs.th_deductions')}</th><th className="p-3">{t('payroll_runs.th_net')}</th><th className="p-3">{t('payroll_runs.th_status')}</th></tr></thead>
            <tbody>{myslips.map((s) => (
              <tr key={s.id} className="border-t border-surface-50"><td className="p-3">{dayjs(s.period + '-01').format('MMM YYYY')}</td><td className="p-3 text-center">{s.gross}</td><td className="p-3 text-center">{s.deductions}</td><td className="p-3 text-center font-semibold text-brand-600">{s.net}</td><td className="p-3 text-center"><Badge variant={statusVariant(s.run_status)} className="text-[10px]">{stLabel(t, s.run_status)}</Badge></td></tr>
            ))}</tbody>
          </table>
        </Card>
      )}

      <Modal open={!!openRun} onClose={() => { setOpenRun(null); setDetail(null); }} title={detail ? t('payroll_runs.modal_title', { period: dayjs(detail.period + '-01').format('MMMM YYYY') }) : t('payroll_runs.loading')} size="xl">
        {!detail ? <div className="flex justify-center py-10"><Loader2 className="w-7 h-7 text-brand-600 animate-spin" /></div> : (
          <div className="space-y-4">
            <div className="flex items-center gap-3 flex-wrap p-3 bg-surface-50 rounded-xl">
              <Badge variant={statusVariant(detail.status)}>{stLabel(t, detail.status)}</Badge>
              <span className="text-sm text-surface-600">{detail.employee_count} {t('payroll_runs.employees')}</span>
              <span className="text-sm text-surface-600">{t('payroll_runs.net')}: <b className="text-brand-600">{detail.total_net}</b></span>
              <div className="ml-auto flex gap-2">
                <Button size="sm" variant="secondary" onClick={openWps} loading={wpsBusy && !wps}><FileSpreadsheet size={14} /> {t('payroll_runs.wps_export')}</Button>
                {detail.status === 'Draft' && <Button size="sm" onClick={() => approve(detail)}><CheckCircle2 size={14} /> {t('payroll_runs.approve')}</Button>}
                {detail.status === 'Approved' && isAdmin && <Button size="sm" onClick={() => pay(detail)}>{t('payroll_runs.mark_paid')}</Button>}
                {detail.status === 'Draft' && isAdmin && <Button size="sm" variant="danger" onClick={() => del(detail)}><Trash2 size={14} /></Button>}
              </div>
            </div>
            <Card className="!p-0 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-surface-50 text-surface-500 text-xs"><tr>
                  <th className="text-left p-3">{t('payroll_runs.th_employee')}</th><th className="p-3">{t('payroll_runs.th_basic')}</th><th className="p-3">{t('payroll_runs.th_allowances')}</th><th className="p-3">{t('payroll_runs.th_gross')}</th>
                  <th className="p-3">{t('payroll_runs.th_unpaid')}</th><th className="p-3">{t('payroll_runs.th_absence')}</th><th className="p-3">{t('payroll_runs.th_deductions')}</th><th className="p-3">{t('payroll_runs.th_net')}</th></tr></thead>
                <tbody>{(detail.items || []).map((it) => (
                  <tr key={it.id} className="border-t border-surface-50">
                    <td className="p-3">{it.first_name} {it.last_name}</td>
                    <td className="p-3 text-center">{it.basic_salary}</td><td className="p-3 text-center">{it.allowances}</td><td className="p-3 text-center">{it.gross}</td>
                    <td className="p-3 text-center">{it.unpaid_leave_days}</td><td className="p-3 text-center">{it.absence_days}</td>
                    <td className="p-3 text-center text-red-500">{it.deductions}</td><td className="p-3 text-center font-semibold text-brand-600">{it.net}</td>
                  </tr>
                ))}</tbody>
              </table>
            </Card>
          </div>
        )}
      </Modal>

      {/* WPS readiness → download. Rendered after the run modal so it stacks on top. */}
      <Modal open={!!wps} onClose={() => setWps(null)} title={t('payroll_runs.wps_title')} size="lg">
        {wps && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 bg-surface-50 rounded-xl"><p className="text-xs text-surface-400">{t('payroll_runs.wps_company')}</p><p className="font-semibold text-surface-800 text-sm">{wps.company_name}</p></div>
              <div className="p-3 bg-surface-50 rounded-xl"><p className="text-xs text-surface-400">{t('payroll_runs.wps_mol_id')}</p><p className="font-semibold text-surface-800 text-sm">{wps.mol_id || '—'}</p></div>
              <div className="p-3 bg-surface-50 rounded-xl"><p className="text-xs text-surface-400">{t('payroll_runs.wps_employees')}</p><p className="font-semibold text-surface-800 text-sm">{wps.employee_count}</p></div>
              <div className="p-3 bg-surface-50 rounded-xl"><p className="text-xs text-surface-400">{t('payroll_runs.wps_total')}</p><p className="font-bold text-brand-600 text-sm">{Number(wps.total_net || 0).toFixed(2)}</p></div>
            </div>

            {wps.ready ? (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm">
                <CheckCircle2 size={16} className="mt-0.5 shrink-0" /><span>{t('payroll_runs.wps_ready')}</span>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm">
                  <AlertTriangle size={16} className="mt-0.5 shrink-0" /><span>{t('payroll_runs.wps_incomplete')}</span>
                </div>
                {wps.companyIssues?.length > 0 && (
                  <div className="text-sm">
                    <p className="font-semibold text-surface-700 mb-1">{t('payroll_runs.wps_company_issues')}</p>
                    <ul className="list-disc ms-5 text-surface-600 space-y-0.5">{wps.companyIssues.map((c) => <li key={c}>{c}</li>)}</ul>
                  </div>
                )}
                {wps.employeeIssues?.length > 0 && (
                  <Card className="!p-0 overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-surface-50 text-surface-500 text-xs"><tr><th className="text-start p-3">{t('payroll_runs.th_employee')}</th><th className="text-start p-3">{t('payroll_runs.wps_missing')}</th></tr></thead>
                      <tbody>{wps.employeeIssues.map((e) => (
                        <tr key={e.employee_id} className="border-t border-surface-50"><td className="p-3">{e.name}</td><td className="p-3 text-red-600">{e.missing.join(' · ')}</td></tr>
                      ))}</tbody>
                    </table>
                  </Card>
                )}
              </div>
            )}

            {wps.unverified_bank?.length > 0 && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">
                {t('payroll_runs.wps_unverified_bank', { names: wps.unverified_bank.join(', ') })}
              </p>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="secondary" onClick={() => setWps(null)}>{t('common.cancel')}</Button>
              {wps.ready
                ? <Button onClick={() => downloadWps(false)} loading={wpsBusy}><FileSpreadsheet size={14} /> {t('payroll_runs.wps_download')}</Button>
                : <Button variant="secondary" onClick={() => downloadWps(true)} loading={wpsBusy}>{t('payroll_runs.wps_download_draft')}</Button>}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
