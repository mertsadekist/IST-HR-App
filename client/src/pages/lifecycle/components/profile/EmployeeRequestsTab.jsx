import { useEffect, useState } from 'react';
import { Inbox, MessageSquare, FileText, Receipt, HandCoins, LifeBuoy } from 'lucide-react';
import Card from '@components/ui/Card';
import Badge from '@components/ui/Badge';
import EmptyState from '@components/ui/EmptyState';
import ApprovalProgress from '@components/approvals/ApprovalProgress';
import RequestDetail from '@components/requests/RequestDetail';
import * as requestsApi from '@api/requestsApi';
import { OPEN_STATUSES, slug, statusVariant, money, requestTitle } from '@utils/requests';
import { StatCard } from './StatCard';

const ICONS = { letter: FileText, expense: Receipt, advance: HandCoins, case: LifeBuoy };
const TYPES = ['letter', 'expense', 'advance', 'case'];

/**
 * What the employee has asked for from their own account — letters, expenses,
 * salary advances and HR cases — opened in the same detail window as the
 * Requests page, so HR can act on one without leaving the profile.
 */
export default function EmployeeRequestsTab({ employee, t }) {
  const [rows, setRows] = useState([]);
  const [loadedKey, setLoadedKey] = useState(null);
  const [reload, setReload] = useState(0);
  const key = `${employee.id}:${reload}`;
  const loading = loadedKey === null || !loadedKey.startsWith(`${employee.id}:`);
  const [type, setType] = useState('');
  const [openId, setOpenId] = useState(null);

  useEffect(() => {
    let alive = true;
    requestsApi.getRequests({ employee_id: employee.id })
      .then(({ data }) => { if (alive) setRows(Array.isArray(data) ? data : []); })
      .catch(() => { if (alive) setRows([]); })
      .finally(() => { if (alive) setLoadedKey(key); });
    return () => { alive = false; };
  }, [employee.id, key]);

  const shown = type ? rows.filter((r) => r.type === type) : rows;
  const open = rows.filter((r) => OPEN_STATUSES.includes(r.status)).length;
  const advances = rows.filter((r) => r.type === 'advance' && ['Approved', 'Completed'].includes(r.status))
    .reduce((s, r) => s + Number(r.amount || 0), 0);
  const expenses = rows.filter((r) => r.type === 'expense' && ['Approved', 'Completed'].includes(r.status))
    .reduce((s, r) => s + Number(r.amount || 0), 0);

  if (loading) return <Card className="!p-6 animate-pulse"><div className="h-4 bg-surface-100 rounded w-1/3" /></Card>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label={t('empProfile.rq_total')} value={rows.length} />
        <StatCard label={t('empProfile.rq_open')} value={open} tone={open ? 'amber' : 'default'} />
        <StatCard label={t('empProfile.rq_expenses')} value={money(expenses)} tone="emerald" />
        <StatCard label={t('empProfile.rq_advances')} value={money(advances)} tone="brand" />
      </div>

      <div className="flex flex-wrap gap-2">
        {['', ...TYPES].map((ty) => {
          const n = ty ? rows.filter((r) => r.type === ty).length : rows.length;
          if (ty && !n) return null;
          return (
            <button key={ty || 'all'} type="button" onClick={() => setType(ty)} aria-pressed={type === ty}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${type === ty ? 'bg-brand-600 border-brand-600 text-white' : 'bg-white border-surface-200 text-surface-600 hover:bg-surface-50'}`}>
              {ty ? t(`requests.type.${ty}`) : t('requests.all_types')} <span className="opacity-70">({n})</span>
            </button>
          );
        })}
      </div>

      {shown.length === 0 ? (
        <Card><EmptyState icon={<Inbox className="w-6 h-6 text-surface-400" />} title={t('empProfile.rq_none')} description={t('empProfile.rq_none_desc')} /></Card>
      ) : (
        <Card className="!p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-50 border-b border-surface-100">
                <tr className="text-[11px] uppercase tracking-wider text-surface-400">
                  <th className="px-4 py-3 text-start font-semibold">{t('requests.col.request')}</th>
                  <th className="px-4 py-3 text-end font-semibold">{t('requests.f.amount')}</th>
                  <th className="px-4 py-3 text-start font-semibold">{t('requests.col.raised')}</th>
                  <th className="px-4 py-3 text-start font-semibold">{t('requests.f.assigned_to')}</th>
                  <th className="px-4 py-3 text-start font-semibold">{t('requests.f.status')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100">
                {shown.map((r) => {
                  const Icon = ICONS[r.type] || FileText;
                  return (
                    <tr key={r.id} onClick={() => setOpenId(r.id)} className="hover:bg-surface-50/60 cursor-pointer">
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-2 min-w-0">
                          <Icon size={14} className="text-brand-500 shrink-0" />
                          <span className="truncate max-w-[360px] font-medium text-surface-800">{requestTitle(t, r)}</span>
                          {r.comment_count > 0 && <span className="inline-flex items-center gap-0.5 text-[11px] text-surface-400"><MessageSquare size={11} />{r.comment_count}</span>}
                        </span>
                        <span className="block text-[11px] text-surface-400 ms-6">{t(`requests.type.${r.type}`)}</span>
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
