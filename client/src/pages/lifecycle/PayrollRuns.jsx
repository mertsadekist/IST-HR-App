import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import * as payApi from '@api/payrollApi';
import Card from '@components/ui/Card';
import Button from '@components/ui/Button';
import Badge from '@components/ui/Badge';
import Modal from '@components/ui/Modal';
import Input from '@components/ui/Input';
import EmptyState from '@components/ui/EmptyState';
import { toast } from 'react-toastify';
import { confirmDelete, confirmAction } from '@utils/confirm';
import { Banknote, Plus, RefreshCw, Loader2, CheckCircle2, Trash2, FileSpreadsheet, AlertTriangle, Send, FileText, ChevronDown, ChevronRight, XCircle, Mail, Undo2 } from 'lucide-react';
import { lineLabel, money } from '@utils/payslipLines';
import PayslipLines from '@components/payroll/PayslipLines';
import { downloadBlob } from '@utils/pdf';
import dayjs from 'dayjs';

const apiErr = (e, f) => e?.response?.data?.error || (e?.response?.data?.errors?.[0]?.message) || f;
const statusVariant = (s) => ({ Draft: 'info', 'Pending Approval': 'pending', Approved: 'brand', Paid: 'success', Cancelled: 'danger' }[s] || 'info');
const stLabel = (t, s) => t(`payroll_runs.st_${String(s || '').toLowerCase().replace(/\s+/g, '_')}`, s);

// What each check code means, in the reader's language. Codes mirror checkRun()
// in server/services/payrollV2.js.
function checkLabel(t, c) {
  switch (c.code) {
    case 'NO_SALARY': return t('payroll_runs.chk_no_salary');
    case 'WPS_MISSING': return t('payroll_runs.chk_wps_missing', { fields: (c.detail || []).map((f) => wpsFieldLabel(t, f)).join(' · ') });
    case 'IBAN_INVALID': return t('payroll_runs.chk_iban_invalid');
    case 'COMPANY_MOL_MISSING': return t('payroll_runs.chk_company_mol_missing');
    case 'BANK_UNVERIFIED': return t('payroll_runs.chk_bank_unverified');
    case 'NOT_IN_WPS': return t('payroll_runs.chk_not_in_wps');
    case 'DEDUCTIONS_OVER_HALF': return t('payroll_runs.chk_deductions_over_half');
    case 'COMPONENTS_MISMATCH': return t('payroll_runs.chk_components_mismatch', {
      components: money(c.detail?.components), allowances: money(c.detail?.allowances) });
    case 'BIG_CHANGE': return t('payroll_runs.chk_big_change', { prev: money(c.detail?.prev_net), net: money(c.detail?.net), pct: c.detail?.pct });
    case 'NEW_IN_RUN': return t('payroll_runs.chk_new_in_run');
    default: return c.code;
  }
}
function wpsFieldLabel(t, f) {
  switch (f) {
    case 'work_permit_no': return t('payroll_runs.fld_work_permit');
    case 'personal_no': return t('payroll_runs.fld_personal_no');
    case 'iban': return t('payroll_runs.fld_iban');
    case 'bank_name': return t('payroll_runs.fld_bank_name');
    default: return f;
  }
}

export default function PayrollRuns() {
  const { t } = useTranslation();
  const { user } = useSelector((s) => s.auth);
  const { currentCompanyId } = useSelector((s) => s.entity);
  const isAdmin = user?.role === 'admin';
  // The accountant runs this page end to end: generate, approve, produce the
  // WPS file, send it, and close the cycle once the transfer has gone out.
  // Deleting a run stays admin-only — see server/routes/payroll.js.
  const canClosePayroll = isAdmin || user?.role === 'accountant';
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState(dayjs().format('YYYY-MM'));
  const [generating, setGenerating] = useState(false);
  const [openRun, setOpenRun] = useState(null);
  const [detail, setDetail] = useState(null);
  const [myslips, setMyslips] = useState([]);
  const [wps, setWps] = useState(null);       // readiness report for the open run
  const [wpsBusy, setWpsBusy] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const [sendForm, setSendForm] = useState({ to: '', toName: '', cc: '', message: '' });

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
  // ── Run review: blocking checks, warnings, and the comparison with last month ──
  const [review, setReview] = useState(null);
  const [tab, setTab] = useState('employees');
  const [expanded, setExpanded] = useState(() => new Set());
  const [actionBusy, setActionBusy] = useState(false);
  // One dialog for every action that needs a written reason: rejecting, an
  // admin override of blocking checks, an admin approving their own submission.
  const [reasonDlg, setReasonDlg] = useState(null); // { title, hint, minLen, confirmLabel, onSubmit }
  const [reasonText, setReasonText] = useState('');

  const loadReview = async (id) => {
    try { const { data } = await payApi.getReview(id); setReview(data); } catch { setReview(null); }
  };
  const openDetail = async (r) => {
    setOpenRun(r); setDetail(null); setReview(null); setTab('employees'); setExpanded(new Set());
    try { const { data } = await payApi.getRun(r.id); setDetail(data); loadReview(r.id); } catch { toast.error(t('payroll_runs.load_run_failed')); }
  };
  const reloadDetail = async () => {
    if (openRun) { const { data } = await payApi.getRun(openRun.id); setDetail(data); loadReview(openRun.id); }
    load();
  };
  // One-time earnings get their own column, only when a run has any.
  const showAdditions = (detail?.items || []).some((it) => Number(it.additions) > 0);
  const toggleRow = (id) => setExpanded((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const askReason = (dlg) => { setReasonText(''); setReasonDlg(dlg); };

  const runAction = async (fn, okMsg) => {
    setActionBusy(true);
    try { await fn(); toast.success(okMsg); setReasonDlg(null); await reloadDetail(); }
    catch (e) {
      // A 422 from submit/approve carries the fresh review; show it rather than a bare error.
      if (e?.response?.data?.code === 'CHECKS_FAILED') setReview(e.response.data);
      toast.error(apiErr(e, t('common.operation_failed')));
    } finally { setActionBusy(false); }
  };

  const submit = () => {
    if (review && !review.ok) {
      if (!isAdmin) { toast.error(t('payroll_runs.fix_errors_first')); return; }
      askReason({ title: t('payroll_runs.override_title'), hint: t('payroll_runs.override_hint'), minLen: 10,
        confirmLabel: t('payroll_runs.submit'), onSubmit: (reason) => runAction(() => payApi.submitRun(detail.id, { override_reason: reason }), t('payroll_runs.submitted')) });
      return;
    }
    runAction(() => payApi.submitRun(detail.id), t('payroll_runs.submitted'));
  };
  const approve = () => {
    if (detail.submitted_by === user?.id) {
      if (!isAdmin) { toast.error(t('payroll_runs.same_person')); return; }
      askReason({ title: t('payroll_runs.self_approve_title'), hint: t('payroll_runs.self_approve_hint'), minLen: 10,
        confirmLabel: t('payroll_runs.approve'), onSubmit: (reason) => runAction(() => payApi.approveRunWith(detail.id, { self_approval_reason: reason }), t('payroll_runs.approved')) });
      return;
    }
    runAction(() => payApi.approveRunWith(detail.id), t('payroll_runs.approved'));
  };
  const reject = () => askReason({ title: t('payroll_runs.reject_title'), hint: t('payroll_runs.reject_hint'), minLen: 1,
    confirmLabel: t('payroll_runs.reject'), onSubmit: (reason) => runAction(() => payApi.rejectRun(detail.id, reason), t('payroll_runs.rejected')) });
  const notifyPayslips = async () => {
    // One click emails every employee in the run, so it is asked first.
    const ok = await confirmAction(t('payroll_runs.email_payslips'),
      t('payroll_runs.email_payslips_confirm', { count: detail.items?.length || 0 }));
    if (!ok.isConfirmed) return;
    setActionBusy(true);
    try {
      const { data } = await payApi.notifyPayslips(detail.id);
      toast.success(t('payroll_runs.payslips_sent', { sent: data.sent, missing: data.no_email?.length || 0 }));
      if (data.failed) toast.warning(t('payroll_runs.payslips_failed', { count: data.failed }));
      await reloadDetail();
    } catch (e) { toast.error(apiErr(e, t('common.operation_failed'))); }
    finally { setActionBusy(false); }
  };
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
  // The salary explanation. Downloaded before approval by design: a wrong
  // deduction can still be fixed while the run is a Draft, and this is the only
  // view that shows which day caused it.
  const [explainBusy, setExplainBusy] = useState(false);
  const downloadExplanation = async () => {
    setExplainBusy(true);
    try {
      const res = await payApi.explanationExport(detail.id);
      const match = /filename="([^"]+)"/.exec(res.headers['content-disposition'] || '');
      downloadBlob(res.data, match?.[1] || `Salary-Explanation-${detail.period}.xlsx`);
      // The server counts rows whose stored figure does not match the day-by-day
      // working and puts it in a header, so the warning arrives with the file
      // rather than waiting to be noticed inside it.
      const mismatches = Number(res.headers['x-reconcile-mismatches'] || 0);
      if (mismatches > 0) toast.warning(t('payroll_runs.explain_mismatch', { count: mismatches }));
      else toast.success(t('payroll_runs.explain_downloaded'));
    } catch (e) { toast.error(apiErr(e, t('payroll_runs.explain_failed'))); }
    finally { setExplainBusy(false); }
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

  // Sending goes straight from the server: it rebuilds the same workbook and
  // attaches it, so nothing passes through the browser on the way to the bank.
  const sendWps = async (e) => {
    e.preventDefault();
    if (!sendForm.to.trim()) { toast.error(t('payroll_runs.wps_send_to_required')); return; }
    setWpsBusy(true);
    try {
      const { data } = await payApi.wpsSend(detail.id, {
        to: sendForm.to.trim(),
        toName: sendForm.toName.trim(),
        cc: sendForm.cc.trim(),
        message: sendForm.message.trim(),
        force: !wps.ready, // the confirmation below is the deliberate step
      });
      toast.success(t('payroll_runs.wps_sent', { to: sendForm.to.trim(), count: data.count }));
      setSendOpen(false); setWps(null);
    } catch (err) { toast.error(apiErr(err, t('payroll_runs.wps_send_failed'))); }
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
                <Button size="sm" variant="secondary" onClick={downloadExplanation} loading={explainBusy}
                  title={t('payroll_runs.explain_hint')}>
                  <FileText size={14} /> {t('payroll_runs.explain_export')}
                </Button>
                <Button size="sm" variant="secondary" onClick={openWps} loading={wpsBusy && !wps}><FileSpreadsheet size={14} /> {t('payroll_runs.wps_export')}</Button>
                {detail.status === 'Draft' && (
                  <Button size="sm" onClick={submit} loading={actionBusy} disabled={!review || (!review.ok && !isAdmin)}
                    title={review && !review.ok && !isAdmin ? t('payroll_runs.fix_errors_first') : undefined}>
                    <Send size={14} /> {t('payroll_runs.submit')}
                  </Button>
                )}
                {detail.status === 'Pending Approval' && (
                  <>
                    <Button size="sm" variant="secondary" onClick={reject} disabled={actionBusy}><Undo2 size={14} /> {t('payroll_runs.reject')}</Button>
                    {(detail.submitted_by !== user?.id || isAdmin) && (
                      <Button size="sm" onClick={approve} loading={actionBusy}><CheckCircle2 size={14} /> {t('payroll_runs.approve')}</Button>
                    )}
                  </>
                )}
                {['Approved', 'Paid'].includes(detail.status) && (
                  <Button size="sm" variant="secondary" onClick={notifyPayslips} loading={actionBusy}
                    title={detail.payslips_notified_at ? t('payroll_runs.payslips_already', { at: dayjs(detail.payslips_notified_at).format('YYYY-MM-DD HH:mm') }) : undefined}>
                    <Mail size={14} /> {t('payroll_runs.email_payslips')}
                  </Button>
                )}
                {detail.status === 'Approved' && canClosePayroll && <Button size="sm" onClick={() => pay(detail)}>{t('payroll_runs.mark_paid')}</Button>}
                {detail.status === 'Draft' && isAdmin && <Button size="sm" variant="danger" onClick={() => del(detail)}><Trash2 size={14} /></Button>}
              </div>
            </div>

            {/* Sent back by the approver: the reason stays on screen until resubmitted. */}
            {detail.status === 'Draft' && detail.rejection_reason && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-sm">
                <Undo2 size={16} className="mt-0.5 shrink-0" />
                <span>{t('payroll_runs.rejected_banner', { reason: detail.rejection_reason })}</span>
              </div>
            )}
            {detail.status === 'Pending Approval' && detail.submitted_by === user?.id && !isAdmin && (
              <p className="text-xs text-surface-500">{t('payroll_runs.waiting_other_approver')}</p>
            )}
            {detail.check_override_reason && (
              <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-2">{t('payroll_runs.override_banner', { reason: detail.check_override_reason })}</p>
            )}

            {/* Checks: errors stop the run; warnings are for the approver to read. */}
            {review && ['Draft', 'Pending Approval'].includes(detail.status) && (review.errors.length > 0 || review.warnings.length > 0) && (
              <div className="space-y-2">
                {review.errors.length > 0 && (
                  <div className="p-3 rounded-xl bg-red-50 border border-red-200">
                    <p className="text-sm font-semibold text-red-800 flex items-center gap-1.5 mb-1"><XCircle size={15} /> {t('payroll_runs.errors_title', { count: review.errors.length })}</p>
                    <ul className="text-xs text-red-800 space-y-0.5">
                      {review.errors.map((c, i) => <li key={i}>{c.name ? <b>{c.name}: </b> : null}{checkLabel(t, c)}</li>)}
                    </ul>
                  </div>
                )}
                {review.warnings.length > 0 && (
                  <details className="p-3 rounded-xl bg-amber-50 border border-amber-200">
                    <summary className="text-sm font-semibold text-amber-900 cursor-pointer flex items-center gap-1.5"><AlertTriangle size={15} /> {t('payroll_runs.warnings_title', { count: review.warnings.length })}</summary>
                    <ul className="text-xs text-amber-900 space-y-0.5 mt-2">
                      {review.warnings.map((c, i) => <li key={i}>{c.name ? <b>{c.name}: </b> : null}{checkLabel(t, c)}</li>)}
                    </ul>
                  </details>
                )}
              </div>
            )}

            <div className="flex gap-1 border-b border-surface-200">
              {['employees', 'variance'].map((k) => (
                <button key={k} type="button" onClick={() => setTab(k)}
                  className={`px-3 py-2 text-sm font-semibold border-b-2 -mb-px ${tab === k ? 'border-brand-600 text-brand-600' : 'border-transparent text-surface-500 hover:text-surface-700'}`}>
                  {k === 'employees' ? t('payroll_runs.tab_employees') : t('payroll_runs.tab_variance', { period: review?.previous_period || '—' })}
                </button>
              ))}
            </div>

            {tab === 'employees' ? (
              <Card className="!p-0 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-surface-50 text-surface-500 text-xs"><tr>
                    <th className="text-start p-3">{t('payroll_runs.th_employee')}</th><th className="p-3">{t('payroll_runs.th_basic')}</th><th className="p-3">{t('payroll_runs.th_allowances')}</th><th className="p-3">{t('payroll_runs.th_gross')}</th>{showAdditions && <th className="p-3">{t('payroll_runs.th_additions')}</th>}
                    <th className="p-3">{t('payroll_runs.th_unpaid')}</th><th className="p-3">{t('payroll_runs.th_absence')}</th><th className="p-3">{t('payroll_runs.th_deductions')}</th><th className="p-3">{t('payroll_runs.th_net')}</th></tr></thead>
                  <tbody>{(detail.items || []).map((it) => {
                    const open = expanded.has(it.id);
                    const hasLines = it.lines?.length > 0;
                    return [
                      <tr key={it.id} className={`border-t border-surface-50 ${hasLines ? 'cursor-pointer hover:bg-surface-50/60' : ''}`} onClick={() => hasLines && toggleRow(it.id)}>
                        <td className="p-3">
                          <span className="inline-flex items-center gap-1">
                            {hasLines ? (open ? <ChevronDown size={13} /> : <ChevronRight size={13} className="rtl:rotate-180" />) : null}
                            {it.first_name} {it.last_name}
                          </span>
                        </td>
                        <td className="p-3 text-center">{it.basic_salary}</td><td className="p-3 text-center">{it.allowances}</td><td className="p-3 text-center">{it.gross}</td>{showAdditions && <td className="p-3 text-center text-emerald-700">{Number(it.additions) > 0 ? it.additions : '—'}</td>}
                        <td className="p-3 text-center">{it.unpaid_leave_days}</td><td className="p-3 text-center">{it.absence_days}</td>
                        <td className="p-3 text-center text-red-500">{it.deductions}</td><td className="p-3 text-center font-semibold text-brand-600">{it.net}</td>
                      </tr>,
                      open && (
                        <tr key={`${it.id}-lines`} className="bg-surface-50/70">
                          <td colSpan={showAdditions ? 9 : 8} className="px-6 py-3"><PayslipLines t={t} lines={it.lines} net={it.net} /></td>
                        </tr>
                      ),
                    ];
                  })}</tbody>
                </table>
                {!(detail.items || []).some((it) => it.lines?.length) && (detail.items || []).length > 0 && (
                  <p className="text-[11px] text-surface-400 px-3 py-2 border-t border-surface-100">{t('payroll_runs.no_lines_hint')}</p>
                )}
              </Card>
            ) : (
              <VarianceTable t={t} review={review} />
            )}
          </div>
        )}
      </Modal>

      {/* A written reason: reject, admin override of checks, admin self-approval. */}
      <Modal open={!!reasonDlg} onClose={() => setReasonDlg(null)} title={reasonDlg?.title || ''} size="md">
        {reasonDlg && (
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (reasonText.trim().length >= reasonDlg.minLen) reasonDlg.onSubmit(reasonText.trim()); }}>
            <p className="text-sm text-surface-600">{reasonDlg.hint}</p>
            <textarea rows={3} autoFocus value={reasonText} onChange={(e) => setReasonText(e.target.value)}
              className="w-full px-3 py-2.5 text-sm bg-white border border-surface-200 rounded-xl input-focus resize-none" />
            {reasonDlg.minLen > 1 && <p className="text-[11px] text-surface-400">{t('payroll_runs.reason_min', { count: reasonDlg.minLen })}</p>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setReasonDlg(null)}>{t('common.cancel')}</Button>
              <Button type="submit" loading={actionBusy} disabled={reasonText.trim().length < reasonDlg.minLen}>{reasonDlg.confirmLabel}</Button>
            </div>
          </form>
        )}
      </Modal>

      {/* WPS readiness → download. Rendered after the run modal so it stacks on top. */}
      <Modal open={!!wps} onClose={() => setWps(null)} title={t('payroll_runs.wps_title')} size="lg">
        {wps && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 bg-surface-50 rounded-xl"><p className="text-xs text-surface-400">{t('payroll_runs.wps_company')}</p><p className="font-semibold text-surface-800 text-sm">{wps.company_name}</p></div>
              <div className="p-3 bg-surface-50 rounded-xl"><p className="text-xs text-surface-400">{t('payroll_runs.wps_mol_id')}</p><p className="font-semibold text-surface-800 text-sm">{wps.mol_id || '—'}</p></div>
              <div className="p-3 bg-surface-50 rounded-xl"><p className="text-xs text-surface-400">{t('payroll_runs.wps_employees')}</p><p className="font-semibold text-surface-800 text-sm">{wps.included_count}{wps.excluded?.length > 0 && <span className="text-surface-400"> / {wps.employee_count}</span>}</p></div>
              <div className="p-3 bg-surface-50 rounded-xl"><p className="text-xs text-surface-400">{t('payroll_runs.wps_total')}</p><p className="font-bold text-brand-600 text-sm">{Number(wps.included_total || 0).toFixed(2)}</p></div>
            </div>

            {/* Offboarding staff are out of the file entirely: their final pay is
                a settlement matter, not a monthly transfer. Shown because the
                file total is lower by these amounts. */}
            {wps.offboarding_excluded?.length > 0 && (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
                <p className="text-sm font-semibold text-amber-900 mb-1">{t('payroll_runs.wps_offboarding', { count: wps.offboarding_excluded.length })}</p>
                <p className="text-[11px] text-amber-800 mb-2">{t('payroll_runs.wps_offboarding_hint')}</p>
                <ul className="text-xs text-amber-900 space-y-0.5">
                  {wps.offboarding_excluded.map((e) => (
                    <li key={e.employee_id} className="flex justify-between">
                      <span>{e.name} <span className="text-amber-700">· {e.status}</span></span>
                      <span className="font-mono text-amber-700">{Number(e.net || 0).toFixed(2)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Held back for a missing labour contract — not an error, but the
                reason the file total differs from the payroll run total. */}
            {wps.excluded?.length > 0 && (
              <div className="p-3 rounded-xl bg-surface-50 border border-surface-200">
                <p className="text-sm font-semibold text-surface-700 mb-1">{t('payroll_runs.wps_excluded', { count: wps.excluded.length })}</p>
                <p className="text-[11px] text-surface-500 mb-2">{t('payroll_runs.wps_excluded_hint')}</p>
                <ul className="text-xs text-surface-600 space-y-0.5">
                  {wps.excluded.map((e) => (
                    <li key={e.employee_id} className="flex justify-between">
                      <span>{e.name}</span><span className="font-mono text-surface-400">{Number(e.net || 0).toFixed(2)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {wps.included_count === 0 ? (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm">
                <AlertTriangle size={16} className="mt-0.5 shrink-0" /><span>{t('payroll_runs.wps_none_eligible')}</span>
              </div>
            ) : wps.ready ? (
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

            <div className="flex justify-end gap-2 pt-1 flex-wrap">
              <Button variant="secondary" onClick={() => setWps(null)}>{t('common.cancel')}</Button>
              {wps.included_count > 0 && (
                <Button variant="secondary" onClick={() => { setSendForm({ to: '', toName: '', cc: '', message: '' }); setSendOpen(true); }}>
                  <Send size={14} /> {t('payroll_runs.wps_send')}
                </Button>
              )}
              {wps.included_count === 0 ? null : wps.ready
                ? <Button onClick={() => downloadWps(false)} loading={wpsBusy}><FileSpreadsheet size={14} /> {t('payroll_runs.wps_download')}</Button>
                : <Button variant="secondary" onClick={() => downloadWps(true)} loading={wpsBusy}>{t('payroll_runs.wps_download_draft')}</Button>}
            </div>
          </div>
        )}
      </Modal>

      {/* Send the WPS file to the bank or the PRO who files it */}
      <Modal open={sendOpen} onClose={() => setSendOpen(false)} title={t('payroll_runs.wps_send_title')} size="md">
        <form onSubmit={sendWps} className="space-y-4">
          <p className="text-xs text-surface-500">{t('payroll_runs.wps_send_desc')}</p>
          {wps && !wps.ready && (
            <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-2 flex items-start gap-2">
              <AlertTriangle size={14} className="shrink-0 mt-0.5" /> {t('payroll_runs.wps_send_draft_warning')}
            </p>
          )}
          <div className="grid grid-cols-2 gap-4">
            <Input label={t('payroll_runs.wps_send_to')} type="email" required placeholder="wps@bank.example"
              value={sendForm.to} onChange={(e) => setSendForm(p => ({ ...p, to: e.target.value }))} />
            <Input label={t('payroll_runs.wps_send_to_name')} placeholder={t('payroll_runs.wps_send_to_name_ph')}
              value={sendForm.toName} onChange={(e) => setSendForm(p => ({ ...p, toName: e.target.value }))} />
          </div>
          <Input label={t('payroll_runs.wps_send_cc')} placeholder={t('payroll_runs.wps_send_cc_ph')}
            value={sendForm.cc} onChange={(e) => setSendForm(p => ({ ...p, cc: e.target.value }))} />
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1.5">{t('payroll_runs.wps_send_message')}</label>
            <textarea rows={3} placeholder={t('payroll_runs.wps_send_message_ph')} value={sendForm.message}
              onChange={(e) => setSendForm(p => ({ ...p, message: e.target.value }))}
              className="w-full px-3 py-2.5 text-sm bg-white border border-surface-200 rounded-xl input-focus transition-all resize-none" />
            <p className="text-[11px] text-surface-400 mt-1">{t('payroll_runs.wps_send_summary_note')}</p>
          </div>
          <div className="flex justify-end gap-3 pt-1">
            <Button type="button" variant="secondary" onClick={() => setSendOpen(false)}>{t('common.cancel')}</Button>
            <Button type="submit" loading={wpsBusy}><Send size={14} /> {t('payroll_runs.wps_send')}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

/**
 * Month-on-month: each employee's net against the last approved or paid run,
 * with what moved. A change above 10% is highlighted.
 */
function VarianceTable({ t, review }) {
  if (!review) return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 text-brand-600 animate-spin" /></div>;
  if (!review.previous_period) return <p className="text-sm text-surface-500 py-6 text-center">{t('payroll_runs.no_previous')}</p>;
  const statusText = (s) => ({
    new: t('payroll_runs.var_new'), left: t('payroll_runs.var_left'), same: t('payroll_runs.var_same'), changed: t('payroll_runs.var_changed'),
  })[s];
  const rows = [...review.variance].sort((a, b) => Number(b.flagged) - Number(a.flagged) || Math.abs(b.diff || 0) - Math.abs(a.diff || 0));
  return (
    <Card className="!p-0 overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-surface-50 text-surface-500 text-xs"><tr>
          <th className="text-start p-3">{t('payroll_runs.th_employee')}</th>
          <th className="p-3">{t('payroll_runs.var_prev_net', { period: review.previous_period })}</th>
          <th className="p-3">{t('payroll_runs.th_net')}</th>
          <th className="p-3">{t('payroll_runs.var_diff')}</th>
          <th className="text-start p-3">{t('payroll_runs.var_what_changed')}</th>
        </tr></thead>
        <tbody>{rows.map((v) => (
          <tr key={`${v.employee_id}-${v.status}`} className={`border-t border-surface-50 ${v.flagged ? 'bg-amber-50/60' : ''}`}>
            <td className="p-3">
              {v.name}
              {v.status !== 'changed' && <Badge variant={v.status === 'same' ? 'inactive' : 'info'} className="text-[10px] ms-2">{statusText(v.status)}</Badge>}
            </td>
            <td className="p-3 text-center font-mono">{v.prev_net == null ? '—' : money(v.prev_net)}</td>
            <td className="p-3 text-center font-mono">{v.net == null ? '—' : money(v.net)}</td>
            <td className={`p-3 text-center font-mono ${v.diff > 0 ? 'text-emerald-600' : v.diff < 0 ? 'text-red-600' : 'text-surface-400'}`}>
              {v.diff == null ? '—' : `${v.diff > 0 ? '+' : ''}${money(v.diff)}${v.pct != null ? ` (${v.pct > 0 ? '+' : ''}${v.pct}%)` : ''}`}
            </td>
            <td className="p-3 text-xs text-surface-600">
              {v.changes.map((c, i) => (
                <span key={i} className="block">{lineLabel(t, c)}: <span className="font-mono">{money(c.prev)} → {money(c.cur)}</span></span>
              ))}
            </td>
          </tr>
        ))}</tbody>
      </table>
    </Card>
  );
}
