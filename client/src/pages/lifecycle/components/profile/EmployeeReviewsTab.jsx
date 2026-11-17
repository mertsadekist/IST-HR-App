import { useEffect, useState } from 'react';
import { ClipboardCheck, Star } from 'lucide-react';
import Card from '@components/ui/Card';
import Badge from '@components/ui/Badge';
import EmptyState from '@components/ui/EmptyState';
import ReviewForm from '@components/reviews/ReviewForm';
import * as reviewsApi from '@api/reviewsApi';
import { recKey, reviewStatusKey, reviewStatusVariant } from '@utils/reviews';
import { StatCard } from './StatCard';

function Stars({ value }) {
  if (value == null) return <span className="text-surface-300">—</span>;
  const n = Number(value);
  return (
    <span className="inline-flex items-center gap-0.5" title={String(n)}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} size={12} className={i <= Math.round(n) ? 'text-amber-400 fill-amber-400' : 'text-surface-200'} />
      ))}
      <span className="ms-1 text-[11px] text-surface-500 tabular-nums">{n.toFixed(1)}</span>
    </span>
  );
}

/**
 * The employee's appraisals across every cycle: self, manager and final
 * ratings and the recommendation. A row opens the same review form as the
 * Appraisals page.
 */
export default function EmployeeReviewsTab({ employee, t }) {
  const [rows, setRows] = useState([]);
  const [loadedKey, setLoadedKey] = useState(null);
  const [reload, setReload] = useState(0);
  const key = `${employee.id}:${reload}`;
  const loading = loadedKey === null || !loadedKey.startsWith(`${employee.id}:`);
  const [openId, setOpenId] = useState(null);

  useEffect(() => {
    let alive = true;
    reviewsApi.getEmployeeReviews(employee.id)
      .then(({ data }) => { if (alive) setRows(Array.isArray(data) ? data : []); })
      .catch(() => { if (alive) setRows([]); })
      .finally(() => { if (alive) setLoadedKey(key); });
    return () => { alive = false; };
  }, [employee.id, key]);

  if (loading) return <Card className="!p-6 animate-pulse"><div className="h-4 bg-surface-100 rounded w-1/3" /></Card>;
  if (!rows.length) {
    return <Card><EmptyState icon={<ClipboardCheck className="w-6 h-6 text-surface-400" />} title={t('empProfile.rv_none')} description={t('empProfile.rv_none_desc')} /></Card>;
  }

  const done = rows.filter((r) => r.status === 'Completed' && r.final_rating != null);
  const latest = done[0];
  const avg = done.length ? done.reduce((s, r) => s + Number(r.final_rating), 0) / done.length : null;
  const inProgress = rows.filter((r) => r.status !== 'Completed').length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label={t('empProfile.rv_latest')} value={latest ? Number(latest.final_rating).toFixed(1) : '—'} sub={latest?.cycle_name} tone="brand" />
        <StatCard label={t('empProfile.rv_average')} value={avg != null ? avg.toFixed(1) : '—'} sub={t('empProfile.rv_cycles', { n: done.length })} />
        <StatCard label={t('empProfile.rv_in_progress')} value={inProgress} tone={inProgress ? 'amber' : 'default'} />
        <StatCard label={t('reviews.recommendation')} value={latest?.final_recommendation ? t(`reviews.rec.${recKey(latest.final_recommendation)}`) : '—'} />
      </div>

      <Card className="!p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-50 border-b border-surface-100">
              <tr className="text-[11px] uppercase tracking-wider text-surface-400">
                <th className="px-4 py-3 text-start font-semibold">{t('empProfile.rv_cycle')}</th>
                <th className="px-4 py-3 text-start font-semibold">{t('org.manager')}</th>
                <th className="px-4 py-3 text-start font-semibold">{t('reviews.col.self')}</th>
                <th className="px-4 py-3 text-start font-semibold">{t('reviews.col.manager_rating')}</th>
                <th className="px-4 py-3 text-start font-semibold">{t('reviews.col.final')}</th>
                <th className="px-4 py-3 text-start font-semibold">{t('reviews.recommendation')}</th>
                <th className="px-4 py-3 text-start font-semibold">{t('portal.status')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100">
              {rows.map((r) => {
                const rec = r.final_recommendation || r.manager_recommendation;
                return (
                  <tr key={r.id} onClick={() => setOpenId(r.id)} className="hover:bg-surface-50/60 cursor-pointer">
                    <td className="px-4 py-3">
                      <span className="font-medium text-surface-800">{r.cycle_name}</span>
                      {r.period_start && <span className="block text-[11px] text-surface-400">{t('reviews.period', { from: r.period_start, to: r.period_end })}</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-surface-500">{r.manager_name || '—'}</td>
                    <td className="px-4 py-3"><Stars value={r.self_rating} /></td>
                    <td className="px-4 py-3"><Stars value={r.manager_rating} /></td>
                    <td className="px-4 py-3"><Stars value={r.final_rating} /></td>
                    <td className="px-4 py-3 text-xs">{rec ? t(`reviews.rec.${recKey(rec)}`) : '—'}</td>
                    <td className="px-4 py-3"><Badge variant={reviewStatusVariant(r.status)} className="text-[10px]">{t(`reviews.status.${reviewStatusKey(r.status)}`)}</Badge></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {openId && <ReviewForm t={t} id={openId} onClose={() => setOpenId(null)} onChanged={() => setReload((n) => n + 1)} />}
    </div>
  );
}
