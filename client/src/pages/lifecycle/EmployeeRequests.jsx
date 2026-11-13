import { useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { Inbox, Loader2, MessageSquare, FileText, Receipt, HandCoins, LifeBuoy } from 'lucide-react';
import Card from '@components/ui/Card';
import Badge from '@components/ui/Badge';
import ApprovalProgress from '@components/approvals/ApprovalProgress';
import RequestDetail from '@components/requests/RequestDetail';
import * as requestsApi from '@api/requestsApi';
import { REQUEST_TYPES, OPEN_STATUSES, slug, statusVariant, money, requestTitle } from '@utils/requests';

const ICONS = { letter: FileText, expense: Receipt, advance: HandCoins, case: LifeBuoy };
const STATUS_FILTERS = ['open', 'Completed', 'Resolved', 'Closed', 'Rejected', 'Cancelled', 'all'];

/**
 * HR's queue of what employees asked for from the portal. Expenses and
 * advances arrive here once their approval chain is done (or straight away
 * where none is set up); approving one books it into payroll. Letters are
 * issued by uploading the signed letter; cases are worked to Resolved and
 * Closed, with the employee kept in the conversation.
 */
export default function EmployeeRequests() {
  const { t } = useTranslation();
  const { currentCompanyId } = useSelector((s) => s.entity);
  const [type, setType] = useState('');
  const [status, setStatus] = useState('open');
  const [reload, setReload] = useState(0);
  const key = `${currentCompanyId ?? 'all'}:${type}:${reload}`;
  const [state, setState] = useState({ key: null, rows: [] });
  const [openId, setOpenId] = useState(null);

  useEffect(() => {
    let off = false;
    const params = { ...(type ? { type } : {}), ...(currentCompanyId ? { company_id: currentCompanyId } : {}) };
    requestsApi.getRequests(params)
      .then(({ data }) => { if (!off) setState({ key, rows: data }); })
      .catch(() => { if (!off) { setState({ key, rows: [] }); toast.error(t('common.failed_load')); } });
    return () => { off = true; };
  }, [key, type, currentCompanyId, t]);

  const all = state.rows;
  const rows = useMemo(() => all.filter((r) => (status === 'all' ? true
    : status === 'open' ? OPEN_STATUSES.includes(r.status) : r.status === status)), [all, status]);
  const counts = useMemo(() => {
    const c = { open: 0, waitingChain: 0, ready: 0 };
    for (const r of all) {
      if (!OPEN_STATUSES.includes(r.status)) continue;
      c.open += 1;
      if (r.approval?.status === 'Pending') c.waitingChain += 1; else c.ready += 1;
    }
    return c;
  }, [all]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 flex items-center gap-2"><Inbox className="text-brand-600" /> {t('requests.hr_title')}</h1>
          <p className="text-sm text-surface-500 mt-1">{t('requests.hr_subtitle')}</p>
        </div>
        <div className="ms-auto flex gap-3">
          {[['open', counts.open], ['ready_for_hr', counts.ready], ['in_chain', counts.waitingChain]].map(([k, v]) => (
            <div key={k} className="text-center bg-white border border-surface-200 rounded-xl px-4 py-2">
              <span className="block text-xl font-bold text-surface-900">{v}</span>
              <span className="text-[11px] text-surface-500">{t(`requests.stat.${k}`)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="flex gap-1 bg-surface-50 p-1 rounded-xl">
          {['', ...REQUEST_TYPES].map((ty) => (
            <button key={ty || 'all'} type="button" onClick={() => setType(ty)}
              className={`px-3 py-2 rounded-lg text-xs font-medium ${type === ty ? 'bg-brand-600 text-white' : 'text-surface-600 hover:bg-surface-100'}`}>
              {ty ? t(`requests.type.${ty}`) : t('requests.all_types')}
            </button>
          ))}
        </div>
        <select value={status} onChange={(e) => setStatus(e.target.value)}
          className="text-sm bg-white border border-surface-200 rounded-xl px-3 py-2">
          {STATUS_FILTERS.map((s) => (
            <option key={s} value={s}>{s === 'open' ? t('requests.filter_open') : s === 'all' ? t('requests.filter_all') : t(`requests.status.${slug(s)}`)}</option>
          ))}
        </select>
      </div>

      {state.key !== key ? (
        <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 text-brand-600 animate-spin" /></div>
      ) : rows.length === 0 ? (
        <Card><p className="text-sm text-surface-500 text-center py-6">{t('requests.queue_empty')}</p></Card>
      ) : (
        <Card className="!p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-50 border-b border-surface-100">
                <tr className="text-[11px] uppercase tracking-wider text-surface-400">
                  <th className="px-4 py-3 text-start font-semibold">{t('requests.col.employee')}</th>
                  <th className="px-4 py-3 text-start font-semibold">{t('requests.col.request')}</th>
                  <th className="px-4 py-3 text-end font-semibold">{t('requests.f.amount')}</th>
                  <th className="px-4 py-3 text-start font-semibold">{t('requests.col.raised')}</th>
                  <th className="px-4 py-3 text-start font-semibold">{t('requests.f.assigned_to')}</th>
                  <th className="px-4 py-3 text-start font-semibold">{t('requests.f.status')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100">
                {rows.map((r) => {
                  const Icon = ICONS[r.type];
                  return (
                    <tr key={r.id} onClick={() => setOpenId(r.id)} className="hover:bg-surface-50/60 cursor-pointer">
                      <td className="px-4 py-3 font-medium text-surface-800 whitespace-nowrap">{r.employee_name}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-2 min-w-0">
                          <Icon size={14} className="text-surface-400 shrink-0" />
                          <span className="truncate max-w-[320px]">{requestTitle(t, r)}</span>
                          {r.comment_count > 0 && <span className="inline-flex items-center gap-0.5 text-[11px] text-surface-400"><MessageSquare size={11} />{r.comment_count}</span>}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-end font-mono">{r.amount != null ? money(r.amount) : '—'}</td>
                      <td className="px-4 py-3 text-surface-500 whitespace-nowrap">{String(r.created_at).slice(0, 10)}
                        {r.due_date && <span className="block text-[11px] text-amber-700">{t('requests.due', { date: r.due_date })}</span>}
                      </td>
                      <td className="px-4 py-3 text-surface-500 text-xs">{r.assigned_to_name || '—'}</td>
                      <td className="px-4 py-3">
                        <Badge className="text-[10px]" variant={statusVariant(r.status)}>{t(`requests.status.${slug(r.status)}`)}</Badge>
                        {OPEN_STATUSES.includes(r.status) && r.approval?.status === 'Pending' && (
                          <div className="mt-1"><ApprovalProgress t={t} approval={r.approval} compact /></div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {openId && <RequestDetail t={t} id={openId} staff onClose={() => setOpenId(null)} onChanged={() => setReload((n) => n + 1)} />}
    </div>
  );
}
