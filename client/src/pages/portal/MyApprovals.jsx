import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { Stamp, Loader2, Check, X, CalendarDays, Timer, Receipt, HandCoins } from 'lucide-react';
import Card from '@components/ui/Card';
import Button from '@components/ui/Button';
import EmptyState from '@components/ui/EmptyState';
import PortalShell from './PortalShell';
import ApprovalProgress from '@components/approvals/ApprovalProgress';
import LeaveContext from '@components/leave/LeaveContext';
import * as approvalsApi from '@api/approvalsApi';

const ICONS = { leave: CalendarDays, overtime: Timer, expense: Receipt, advance: HandCoins };
const money = (n) => Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const hm = (m) => `${Math.floor((m || 0) / 60)}:${String((m || 0) % 60).padStart(2, '0')}`;

/**
 * What is waiting for the signed-in user's decision: leave requests and overtime
 * days at the step of an approval chain they approve. Approving moves it to the
 * next step (or to HR's final decision); rejecting needs a reason and rejects it.
 */
export default function MyApprovals() {
  const { t } = useTranslation();
  const [reload, setReload] = useState(0);
  const [state, setState] = useState({ key: null, items: [] });
  const [busy, setBusy] = useState(null);
  const [notes, setNotes] = useState({});

  useEffect(() => {
    let off = false;
    approvalsApi.getMyApprovals()
      .then(({ data }) => { if (!off) setState({ key: reload, items: data }); })
      .catch(() => { if (!off) setState({ key: reload, items: [] }); });
    return () => { off = true; };
  }, [reload]);

  const decide = async (item, decision) => {
    const note = (notes[item.id] || '').trim();
    if (decision === 'Rejected' && !note) { toast.error(t('approvals.reason_required')); return; }
    setBusy(item.id);
    try {
      await approvalsApi.actOnApproval(item.id, decision, note);
      toast.success(decision === 'Approved' ? t('approvals.you_approved') : t('approvals.you_rejected'));
      setReload((r) => r + 1);
    } catch (e) { toast.error(e?.response?.data?.error || t('common.operation_failed')); }
    finally { setBusy(null); }
  };

  const items = state.items;
  return (
    <PortalShell icon={Stamp} title={t('approvals.mine_title')} subtitle={t('approvals.mine_subtitle')}
      stats={[{ value: items.length, label: t('approvals.waiting') }]}>
      {state.key !== reload ? (
        <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 text-brand-600 animate-spin" /></div>
      ) : items.length === 0 ? (
        <Card><EmptyState icon={<Stamp className="w-6 h-6 text-surface-400" />} title={t('approvals.mine_empty')} description={t('approvals.mine_empty_desc')} /></Card>
      ) : (
        <div className="space-y-3">
          {items.map((it) => {
            const d = it.details;
            return (
              <Card key={it.id} className="!p-4 space-y-3">
                <div className="flex items-start gap-3 flex-wrap">
                  <div className="p-2 rounded-xl bg-brand-50 text-brand-700">{(() => { const Icon = ICONS[it.process] || Stamp; return <Icon size={18} />; })()}</div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-surface-900">{it.employee?.name}
                      <span className="text-xs font-normal text-surface-500 ms-2">{it.employee?.job_title}</span></p>
                    {it.process === 'leave' ? (
                      <p className="text-sm text-surface-700">
                        {d.leave_type}: {d.start_date}{d.end_date !== d.start_date ? ` → ${d.end_date}` : ''} · {t('approvals.days', { count: Number(d.days) })}
                      </p>
                    ) : it.process === 'expense' ? (
                      <p className="text-sm text-surface-700">
                        {t('approvals.expense_line', { amount: money(d.amount), category: t(`requests.expense_cat.${d.details?.category}`), date: d.details?.expense_date })}
                        <span className="block text-xs text-surface-500 mt-0.5">{d.details?.description}</span>
                      </p>
                    ) : it.process === 'advance' ? (
                      <p className="text-sm text-surface-700">
                        {t('approvals.advance_line', { amount: money(d.amount), months: d.details?.months, instalment: money(d.details?.instalment) })}
                        <span className="block text-xs text-surface-500 mt-0.5">{d.details?.reason}</span>
                      </p>
                    ) : (
                      <p className="text-sm text-surface-700">
                        {t('approvals.overtime_on', { date: d.work_date })} · {[
                          d.normal_minutes ? `${hm(d.normal_minutes)} ${t('approvals.ot_normal')}` : null,
                          d.night_minutes ? `${hm(d.night_minutes)} ${t('approvals.ot_night')}` : null,
                          d.rest_minutes ? `${hm(d.rest_minutes)} ${t('approvals.ot_rest')}` : null,
                        ].filter(Boolean).join(' + ')}
                        {d.check_in && <span className="text-xs text-surface-400 ms-2 font-mono">{String(d.check_in).slice(0, 5)}–{String(d.check_out || '').slice(0, 5)}</span>}
                      </p>
                    )}
                    {d.reason && <p className="text-xs text-surface-500 mt-0.5">{d.reason}</p>}
                  </div>
                </div>
                <ApprovalProgress t={t} approval={it.chain} />
                {it.process === 'leave' && <LeaveContext t={t} requestId={it.entity_id} compact />}
                <div className="flex gap-2 items-center flex-wrap">
                  <input value={notes[it.id] || ''} onChange={(e) => setNotes((n) => ({ ...n, [it.id]: e.target.value }))}
                    placeholder={t('approvals.note_ph')} maxLength={500}
                    className="flex-1 min-w-[200px] text-sm bg-white border border-surface-200 rounded-lg px-3 py-2" />
                  <Button size="sm" variant="secondary" onClick={() => decide(it, 'Rejected')} disabled={busy === it.id}><X size={14} /> {t('approvals.reject')}</Button>
                  <Button size="sm" onClick={() => decide(it, 'Approved')} loading={busy === it.id}><Check size={14} /> {t('approvals.approve')}</Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </PortalShell>
  );
}
