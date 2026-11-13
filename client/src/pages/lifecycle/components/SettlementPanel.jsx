import { useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import { Calculator, Loader2, Plus, Trash2, CheckCircle2, Undo2, Banknote, AlertTriangle, Download, Clock } from 'lucide-react';
import Button from '@components/ui/Button';
import Badge from '@components/ui/Badge';
import * as offboardingApi from '@api/offboardingApi';
import { money } from '@utils/payslipLines';
import { printElementWithLetterhead, waitForPaint } from '@utils/printDoc';

const apiErr = (e, f) => e?.response?.data?.error || f;
const statusVariant = { 'Not Started': 'inactive', Draft: 'info', Approved: 'brand', Paid: 'success' };

function lineLabel(t, l) {
  switch (l.code) {
    case 'FINAL_SALARY': return t('settlement.line_final_salary');
    case 'LEAVE_ENCASHMENT': return t('settlement.line_leave');
    case 'GRATUITY': return t('settlement.line_gratuity');
    case 'OVERTIME': return t('settlement.line_overtime');
    case 'LOAN': return /advance/i.test(l.label) ? t('settlement.line_advance') : t('settlement.line_loan');
    default: return l.label;
  }
}
const statusLabel = (t, s) => ({
  'Not Started': t('settlement.st_not_started'), Draft: t('settlement.st_draft'),
  Approved: t('settlement.st_approved'), Paid: t('settlement.st_paid'),
})[s] || s;

/**
 * The final settlement of one offboarding: what is owed to and by the person
 * leaving, line by line, from Draft to Paid. Paid is final.
 */
export default function SettlementPanel({ offboardingId, companyId, employeeName, t, onChanged }) {
  const role = useSelector((s) => s.auth.user?.role);
  const userId = useSelector((s) => s.auth.user?.id);
  const isAdmin = role === 'admin';
  const canPay = ['admin', 'accountant'].includes(role);
  const [reload, setReload] = useState(0);
  const key = `${offboardingId}:${reload}`;
  const [state, setState] = useState({ key: null, data: null });
  const [inputs, setInputs] = useState({ carry_forward_days: '', leave_days_override: '', unpaid_leave_days: '' });
  const [busy, setBusy] = useState(false);
  const [lineForm, setLineForm] = useState(null);
  const [reasonFor, setReasonFor] = useState(null); // 'approve' | 'reopen'
  const [reason, setReason] = useState('');
  const [payForm, setPayForm] = useState(null);
  const [exporting, setExporting] = useState(false);
  const docRef = useRef(null);

  useEffect(() => {
    let off = false;
    offboardingApi.getSettlement(offboardingId)
      .then(({ data }) => {
        if (off) return;
        setState({ key, data });
        const v = (x) => (x == null ? '' : String(x));
        setInputs({ carry_forward_days: v(data.inputs.carry_forward_days), leave_days_override: v(data.inputs.leave_days_override),
          unpaid_leave_days: v(data.inputs.unpaid_leave_days) });
      })
      .catch(() => { if (!off) { setState({ key, data: null }); toast.error(t('settlement.load_failed')); } });
    return () => { off = true; };
  }, [key, offboardingId, t]);

  const refresh = () => { setReload((r) => r + 1); onChanged?.(); };
  const act = async (fn, ok) => {
    setBusy(true);
    try { await fn(); toast.success(ok); setReasonFor(null); setLineForm(null); setPayForm(null); refresh(); }
    catch (e) {
      toast.error(apiErr(e, t('common.operation_failed')));
      if (e?.response?.data?.code === 'CHANGED') refresh();
    } finally { setBusy(false); }
  };

  if (state.key !== key) return <div className="flex justify-center py-6"><Loader2 className="w-6 h-6 text-brand-600 animate-spin" /></div>;
  const s = state.data;
  if (!s) return null;

  const editable = ['Not Started', 'Draft'].includes(s.status);
  const calculate = () => act(() => offboardingApi.calculateSettlement(offboardingId, inputs), t('settlement.calculated'));
  const needsReasonToApprove = s.prepared_by === userId || s.blockers.clearance_open > 0;
  const approve = () => {
    if (needsReasonToApprove) {
      if (!isAdmin) { toast.error(s.prepared_by === userId ? t('settlement.same_person') : t('settlement.clearance_blocks')); return; }
      setReason(''); setReasonFor('approve'); return;
    }
    act(() => offboardingApi.approveSettlement(offboardingId), t('settlement.approved'));
  };
  const earnings = s.lines.filter((l) => l.kind === 'earning');
  const deductions = s.lines.filter((l) => l.kind === 'deduction');
  const input = 'w-full text-xs bg-white border border-surface-200 rounded-lg p-2';

  const exportPdf = async () => {
    setExporting(true);
    try {
      await waitForPaint();
      await printElementWithLetterhead(docRef.current, companyId, `Final-Settlement-${String(employeeName || '').replace(/[^\w-]+/g, '_')}.pdf`);
    } catch { toast.error(t('settlement.pdf_failed')); }
    finally { setExporting(false); }
  };

  const lineRow = (l, sign) => (
    <li key={l.id} className="flex items-start justify-between gap-3 py-1.5">
      <span className="text-surface-700">
        {lineLabel(t, l)}
        {l.source === 'manual' && <Badge variant="inactive" className="text-[9px] ms-1">{t('settlement.manual')}</Badge>}
        {l.explanation && <span className="block text-[11px] text-surface-400">{l.explanation}</span>}
      </span>
      <span className="flex items-center gap-1">
        <span className={`font-mono whitespace-nowrap ${sign < 0 ? 'text-red-600' : 'text-surface-800'}`}>{sign < 0 ? '−' : ''}{money(l.amount)}</span>
        {l.source === 'manual' && s.status === 'Draft' && isAdmin && (
          <button type="button" onClick={() => act(() => offboardingApi.deleteSettlementLine(offboardingId, l.id), t('common.deleted'))}
            className="p-1 text-surface-300 hover:text-red-600" aria-label={t('common.delete')}><Trash2 size={12} /></button>
        )}
      </span>
    </li>
  );

  return (
    <div className="rounded-xl border border-surface-200 p-4 space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <Banknote size={16} className="text-brand-600" />
        <h4 className="text-sm font-semibold text-surface-900">{t('settlement.title')}</h4>
        <Badge variant={statusVariant[s.status] || 'info'} className="text-[10px]">{statusLabel(t, s.status)}</Badge>
        {s.due_date && s.status !== 'Paid' && (
          <span className={`text-[11px] flex items-center gap-1 ${s.overdue ? 'text-red-600 font-semibold' : 'text-surface-500'}`}>
            <Clock size={11} /> {s.overdue ? t('settlement.overdue', { date: s.due_date }) : t('settlement.due', { date: s.due_date })}
          </span>
        )}
        {s.status === 'Paid' && <span className="text-[11px] text-emerald-700">{t('settlement.paid_on', { date: String(s.paid_at).slice(0, 10), ref: s.payment_ref })}</span>}
        {s.lines.length > 0 && (
          <Button size="sm" variant="secondary" className="ms-auto" onClick={exportPdf} loading={exporting}><Download size={13} /> PDF</Button>
        )}
      </div>

      {editable && (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-end">
          <label className="text-[11px] text-surface-500">{t('settlement.carry_forward')}
            <input type="number" min="0" step="0.5" value={inputs.carry_forward_days} onChange={(e) => setInputs((p) => ({ ...p, carry_forward_days: e.target.value }))} className={input} />
          </label>
          <label className="text-[11px] text-surface-500">{t('settlement.leave_override')}
            <input type="number" min="0" step="0.5" value={inputs.leave_days_override} placeholder={t('settlement.leave_override_ph')} onChange={(e) => setInputs((p) => ({ ...p, leave_days_override: e.target.value }))} className={input} />
          </label>
          <label className="text-[11px] text-surface-500">{t('settlement.unpaid_days')}
            <input type="number" min="0" step="1" value={inputs.unpaid_leave_days} onChange={(e) => setInputs((p) => ({ ...p, unpaid_leave_days: e.target.value }))} className={input} />
          </label>
          <Button size="sm" onClick={calculate} loading={busy}><Calculator size={14} /> {s.status === 'Not Started' ? t('settlement.calculate') : t('settlement.recalculate')}</Button>
        </div>
      )}

      {s.status === 'Not Started' ? (
        <p className="text-xs text-surface-500">{t('settlement.not_started_hint')}</p>
      ) : (
        <>
          <div ref={docRef} className="bg-white">
            <div className="grid sm:grid-cols-2 gap-4 text-xs">
              <div>
                <p className="font-semibold text-surface-500 uppercase tracking-wide text-[10px] mb-1">{t('settlement.dues')}</p>
                <ul className="divide-y divide-surface-100">{earnings.map((l) => lineRow(l, 1))}</ul>
              </div>
              <div>
                <p className="font-semibold text-surface-500 uppercase tracking-wide text-[10px] mb-1">{t('settlement.deductions')}</p>
                {deductions.length ? <ul className="divide-y divide-surface-100">{deductions.map((l) => lineRow(l, -1))}</ul>
                  : <p className="text-surface-400 py-1">{t('settlement.no_deductions')}</p>}
              </div>
            </div>
            <div className="flex justify-between items-center border-t border-surface-200 mt-2 pt-2">
              <span className="text-sm font-bold text-surface-900">{t('settlement.net')}</span>
              <span className="text-lg font-bold text-brand-700 font-mono">{money(s.totals.net)}</span>
            </div>
          </div>
          {s.totals.shortfall > 0 && (
            <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-2">{t('settlement.shortfall', { amount: money(s.totals.shortfall) })}</p>
          )}
        </>
      )}

      {/* What stops approval */}
      {s.status === 'Draft' && (s.blockers.clearance_open > 0 || s.blockers.open_run_period) && (
        <div className="text-xs space-y-1">
          {s.blockers.open_run_period && (
            <p className="flex items-start gap-1.5 text-red-700"><AlertTriangle size={13} className="mt-0.5 shrink-0" /> {t('settlement.in_open_run', { period: s.blockers.open_run_period })}</p>
          )}
          {s.blockers.clearance_open > 0 && (
            <p className="flex items-start gap-1.5 text-amber-800"><AlertTriangle size={13} className="mt-0.5 shrink-0" /> {t('settlement.clearance_open', { count: s.blockers.clearance_open })}</p>
          )}
        </div>
      )}
      {s.override_reason && <p className="text-[11px] text-surface-500">{t('settlement.override_note', { reason: s.override_reason })}</p>}

      {/* Manual line */}
      {s.status === 'Draft' && (lineForm ? (
        <form className="grid grid-cols-1 sm:grid-cols-[1fr_2fr_1fr_auto] gap-2 items-end"
          onSubmit={(e) => { e.preventDefault(); act(() => offboardingApi.addSettlementLine(offboardingId, { ...lineForm, amount: Number(lineForm.amount) }), t('settlement.line_added')); }}>
          <select value={lineForm.kind} onChange={(e) => setLineForm((f) => ({ ...f, kind: e.target.value }))} className={input}>
            <option value="earning">{t('settlement.kind_earning')}</option>
            <option value="deduction">{t('settlement.kind_deduction')}</option>
          </select>
          <input required maxLength={150} placeholder={t('settlement.line_label_ph')} value={lineForm.label} onChange={(e) => setLineForm((f) => ({ ...f, label: e.target.value }))} className={input} />
          <input required type="number" min="0.01" step="0.01" placeholder={t('settlement.amount')} value={lineForm.amount} onChange={(e) => setLineForm((f) => ({ ...f, amount: e.target.value }))} className={input} />
          <div className="flex gap-1">
            <Button size="sm" type="submit" loading={busy}>{t('common.save')}</Button>
            <Button size="sm" type="button" variant="secondary" onClick={() => setLineForm(null)}>{t('common.cancel')}</Button>
          </div>
        </form>
      ) : (
        <button type="button" onClick={() => setLineForm({ kind: 'earning', label: '', amount: '' })} className="text-xs text-brand-700 font-medium flex items-center gap-1">
          <Plus size={13} /> {t('settlement.add_line')}
        </button>
      ))}

      {/* Reason dialog (inline) */}
      {reasonFor && (
        <form className="space-y-2 p-3 bg-surface-50 rounded-lg" onSubmit={(e) => {
          e.preventDefault();
          if (reasonFor === 'approve') act(() => offboardingApi.approveSettlement(offboardingId, { override_reason: reason.trim() }), t('settlement.approved'));
          else act(() => offboardingApi.reopenSettlement(offboardingId, reason.trim()), t('settlement.reopened'));
        }}>
          <p className="text-xs text-surface-600">{reasonFor === 'approve' ? t('settlement.override_hint') : t('settlement.reopen_hint')}</p>
          <textarea rows={2} autoFocus value={reason} onChange={(e) => setReason(e.target.value)} className={input} />
          <div className="flex justify-end gap-2">
            <Button size="sm" type="button" variant="secondary" onClick={() => setReasonFor(null)}>{t('common.cancel')}</Button>
            <Button size="sm" type="submit" loading={busy} disabled={reason.trim().length < (reasonFor === 'approve' ? 10 : 1)}>
              {reasonFor === 'approve' ? t('settlement.approve') : t('settlement.reopen')}
            </Button>
          </div>
        </form>
      )}

      {/* Payment */}
      {payForm && (
        <form className="grid grid-cols-1 sm:grid-cols-[1fr_2fr_auto] gap-2 items-end p-3 bg-surface-50 rounded-lg"
          onSubmit={(e) => { e.preventDefault(); act(() => offboardingApi.markSettlementPaid(offboardingId, payForm), t('settlement.marked_paid')); }}>
          <label className="text-[11px] text-surface-500">{t('settlement.paid_date')}
            <input type="date" required value={payForm.paid_at} onChange={(e) => setPayForm((f) => ({ ...f, paid_at: e.target.value }))} className={input} />
          </label>
          <label className="text-[11px] text-surface-500">{t('settlement.payment_ref')}
            <input required maxLength={120} value={payForm.payment_ref} onChange={(e) => setPayForm((f) => ({ ...f, payment_ref: e.target.value }))} className={input} />
          </label>
          <div className="flex gap-1">
            <Button size="sm" type="submit" loading={busy}>{t('settlement.confirm_paid')}</Button>
            <Button size="sm" type="button" variant="secondary" onClick={() => setPayForm(null)}>{t('common.cancel')}</Button>
          </div>
        </form>
      )}

      <div className="flex justify-end gap-2 flex-wrap">
        {s.status === 'Draft' && (s.prepared_by !== userId || isAdmin) && !reasonFor && (
          <Button size="sm" onClick={approve} loading={busy} disabled={!!s.blockers.open_run_period}><CheckCircle2 size={14} /> {t('settlement.approve')}</Button>
        )}
        {s.status === 'Draft' && s.prepared_by === userId && !isAdmin && (
          <p className="text-[11px] text-surface-500">{t('settlement.waiting_other')}</p>
        )}
        {s.status === 'Approved' && !reasonFor && !payForm && (
          <>
            <Button size="sm" variant="secondary" onClick={() => { setReason(''); setReasonFor('reopen'); }}><Undo2 size={14} /> {t('settlement.reopen')}</Button>
            {canPay && <Button size="sm" onClick={() => setPayForm({ paid_at: new Date().toISOString().slice(0, 10), payment_ref: '' })}><Banknote size={14} /> {t('settlement.mark_paid')}</Button>}
          </>
        )}
      </div>
    </div>
  );
}
