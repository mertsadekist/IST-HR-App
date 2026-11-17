import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { TrendingUp, TrendingDown, ArrowRight, ExternalLink, ListChecks, Paperclip, Scale } from 'lucide-react';
import Card from '@components/ui/Card';
import Badge from '@components/ui/Badge';
import EmptyState from '@components/ui/EmptyState';
import * as srApi from '@api/salaryReviewApi';
import { money } from './profileUtils';
import { StatCard } from './StatCard';

const reviewVariant = (s) => ({ Draft: 'info', Submitted: 'warning', Approved: 'success', Rejected: 'danger', Completed: 'brand' }[s] || 'info');
const itemVariant = (s) => ({ Pending: 'info', Skipped: 'inactive', Approved: 'success', Rejected: 'danger', Applied: 'brand' }[s] || 'info');

// The status words already exist for the Salary Reviews page; written out so
// every key is visible to the i18n audit.
function stLabel(t, s) {
  switch (s) {
    case 'Draft': return t('salary_reviews.st_draft');
    case 'Submitted': return t('salary_reviews.st_submitted');
    case 'Approved': return t('salary_reviews.st_approved');
    case 'Rejected': return t('salary_reviews.st_rejected');
    case 'Completed': return t('salary_reviews.st_completed');
    case 'Pending': return t('salary_reviews.st_pending');
    case 'Skipped': return t('salary_reviews.st_skipped');
    case 'Applied': return t('salary_reviews.st_applied');
    default: return s || '';
  }
}

/** Change from current to proposed, as an amount and a percentage. */
function Change({ from, to, t }) {
  if (to == null || from == null) return <span className="text-surface-400 text-xs">{t('empProfile.sr_no_change_set')}</span>;
  const diff = to - from;
  if (!diff) return <span className="text-surface-500 text-xs">{t('empProfile.sr_unchanged')}</span>;
  const pct = from ? (diff / from) * 100 : null;
  const up = diff > 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold ${up ? 'text-emerald-700' : 'text-red-600'}`}>
      <Icon size={13} /> {up ? '+' : '−'}{money(Math.abs(diff))}{pct != null && ` (${up ? '+' : '−'}${Math.abs(pct).toFixed(1)}%)`}
    </span>
  );
}

/**
 * The employee's line in every annual salary review: salary before and the
 * proposed salary after, the change, the band, the decision on the cycle and
 * whether it has been applied. A card opens that cycle on the Salary Reviews
 * page with this employee's line expanded.
 */
export default function EmployeeSalaryReviewsTab({ employee, t }) {
  const [rows, setRows] = useState([]);
  const [loadedFor, setLoadedFor] = useState(null);
  const loading = loadedFor !== employee.id;

  useEffect(() => {
    let alive = true;
    const id = employee.id;
    srApi.getEmployeeSalaryReviews(id)
      .then(({ data }) => { if (alive) setRows(Array.isArray(data) ? data : []); })
      .catch(() => { if (alive) setRows([]); })
      .finally(() => { if (alive) setLoadedFor(id); });
    return () => { alive = false; };
  }, [employee.id]);

  if (loading) return <Card className="!p-6 animate-pulse"><div className="h-4 bg-surface-100 rounded w-1/3" /></Card>;
  if (!rows.length) {
    return <Card><EmptyState icon={<Scale className="w-6 h-6 text-surface-400" />} title={t('empProfile.sr_none')} description={t('empProfile.sr_none_desc')} /></Card>;
  }

  const applied = rows.filter((r) => r.item_status === 'Applied' && r.new_full_salary != null);
  const last = applied[0];
  const first = applied[applied.length - 1];
  const totalGrowth = last && first?.current_full_salary
    ? ((last.new_full_salary - first.current_full_salary) / first.current_full_salary) * 100 : null;
  const open = rows.find((r) => ['Draft', 'Submitted'].includes(r.review_status));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label={t('empProfile.sr_current_full')} value={employee.full_salary != null ? money(employee.full_salary) : '—'} sub={t('empProfile.aed')} tone="brand" />
        <StatCard label={t('empProfile.sr_last_change')} value={last ? `${last.review_year}` : '—'}
          sub={last ? `${money(last.current_full_salary)} → ${money(last.new_full_salary)}` : t('empProfile.sr_never_applied')} />
        <StatCard label={t('empProfile.sr_growth')} value={totalGrowth != null ? `${totalGrowth >= 0 ? '+' : '−'}${Math.abs(totalGrowth).toFixed(1)}%` : '—'}
          sub={applied.length ? t('empProfile.sr_applied_count', { n: applied.length }) : undefined} tone={totalGrowth > 0 ? 'emerald' : 'default'} />
        <StatCard label={t('empProfile.sr_open_cycle')} value={open ? open.review_year : '—'} sub={open ? stLabel(t, open.review_status) : t('empProfile.sr_none_open')} tone={open ? 'amber' : 'default'} />
      </div>

      <div className="space-y-3">
        {rows.map((r) => {
          const inBand = r.new_full_salary != null && r.band_min != null && r.band_max != null
            ? r.new_full_salary >= r.band_min && r.new_full_salary <= r.band_max : null;
          return (
            <div key={r.item_id} className="rounded-2xl border border-surface-200 bg-white p-4 hover:shadow-sm transition">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-bold text-surface-900">{t('empProfile.sr_cycle', { year: r.review_year })}</h3>
                <Badge variant={reviewVariant(r.review_status)} className="text-[10px]">{t('empProfile.sr_cycle_status')}: {stLabel(t, r.review_status)}</Badge>
                <Badge variant={itemVariant(r.item_status)} className="text-[10px]">{t('empProfile.sr_line_status')}: {stLabel(t, r.item_status)}</Badge>
                <Link to={`/salary-reviews?open=${r.salary_review_id}&item=${r.item_id}`}
                  className="ms-auto inline-flex items-center gap-1 text-xs text-brand-600 hover:text-brand-700 hover:underline">
                  {t('empProfile.sr_open')} <ExternalLink size={12} />
                </Link>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                {[
                  ['empProfile.sr_basic', r.current_basic_salary, r.new_basic_salary],
                  ['empProfile.sr_full', r.current_full_salary, r.new_full_salary],
                ].map(([label, from, to]) => (
                  <div key={label} className="rounded-xl bg-surface-50 border border-surface-100 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-surface-400">{t(label)}</p>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <span className="font-mono text-sm text-surface-600">{from != null ? money(from) : '—'}</span>
                      <ArrowRight size={14} className="text-surface-300 rtl:rotate-180" />
                      <span className="font-mono text-base font-bold text-surface-900">{to != null ? money(to) : '—'}</span>
                    </div>
                    <div className="mt-1"><Change from={from} to={to} t={t} /></div>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-x-4 gap-y-1 flex-wrap mt-3 text-[11px] text-surface-500">
                {r.job_title_name && <span>{r.job_title_name}</span>}
                {r.band_min != null && r.band_max != null && (
                  <span className={inBand === false ? 'text-amber-700 font-semibold' : ''}>
                    {t('empProfile.sr_band', { min: money(r.band_min), max: money(r.band_max) })}
                    {inBand === false && ` · ${t('empProfile.sr_out_of_band')}`}
                  </span>
                )}
                {r.effective_date && <span>{t('empProfile.sr_effective', { date: r.effective_date })}</span>}
                {r.actions_required > 0 && (
                  <span className="inline-flex items-center gap-1"><ListChecks size={12} /> {t('empProfile.sr_actions', { done: r.actions_done, total: r.actions_required })}</span>
                )}
                {r.document_count > 0 && <span className="inline-flex items-center gap-1"><Paperclip size={12} /> {r.document_count}</span>}
                {r.decided_by_name && <span>{t('empProfile.sr_decided_by', { name: r.decided_by_name })}</span>}
              </div>
              {(r.notes || r.decision_note) && (
                <p className="text-xs text-surface-600 mt-2 whitespace-pre-wrap">{r.notes || r.decision_note}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
