import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ClipboardCheck, Loader2, ChevronRight } from 'lucide-react';
import Card from '@components/ui/Card';
import Badge from '@components/ui/Badge';
import EmptyState from '@components/ui/EmptyState';
import PortalShell from './PortalShell';
import ReviewForm from '@components/reviews/ReviewForm';
import * as reviewsApi from '@api/reviewsApi';
import { recKey, reviewStatusKey, reviewStatusVariant } from '@utils/reviews';

/**
 * My appraisals (self review, then the outcome once HR completes it), and —
 * for managers — the reviews of the people who report to me.
 */
export default function MyReviews() {
  const { t } = useTranslation();
  const [reload, setReload] = useState(0);
  const [state, setState] = useState({ key: null, mine: [], team: [] });
  const [open, setOpen] = useState(null);

  useEffect(() => {
    let off = false;
    reviewsApi.getMine()
      .then(({ data }) => { if (!off) setState({ key: reload, mine: data.mine, team: data.team }); })
      .catch(() => { if (!off) setState({ key: reload, mine: [], team: [] }); });
    return () => { off = true; };
  }, [reload]);

  const loading = state.key !== reload;
  const waitingMe = state.mine.filter((r) => r.status === 'Self Review').length + state.team.filter((r) => r.status === 'Manager Review').length;
  const Row = ({ r, who }) => (
    <li>
      <button type="button" onClick={() => setOpen(r.id)} className="w-full text-start px-5 py-3 hover:bg-surface-50/60 flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-medium text-surface-800 truncate">{who ? `${r.employee_name} · ${r.cycle_name}` : r.cycle_name}</p>
          <p className="text-xs text-surface-500">
            {r.status === 'Self Review' && r.self_due && t('reviews.due', { date: r.self_due })}
            {r.status === 'Manager Review' && r.manager_due && t('reviews.due', { date: r.manager_due })}
            {r.status === 'Completed' && r.final_rating != null && <>{t('reviews.final_line', { n: r.final_rating })}{r.final_recommendation ? ` · ${t(`reviews.rec.${recKey(r.final_recommendation)}`)}` : ''}</>}
          </p>
        </div>
        <Badge className="text-[10px]" variant={reviewStatusVariant(r.status)}>{t(`reviews.status.${reviewStatusKey(r.status)}`)}</Badge>
        <ChevronRight size={14} className="text-surface-300 rtl:rotate-180" />
      </button>
    </li>
  );

  return (
    <PortalShell icon={ClipboardCheck} title={t('reviews.my_title')} subtitle={t('reviews.my_subtitle')}
      stats={[{ value: waitingMe, label: t('reviews.waiting_for_you') }]}>
      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 text-brand-600 animate-spin" /></div>
      ) : (
        <>
          <Card className="!p-0 overflow-hidden">
            <h3 className="px-5 pt-4 pb-2 text-sm font-semibold text-surface-800">{t('reviews.my_reviews')}</h3>
            {state.mine.length === 0 ? (
              <EmptyState icon={<ClipboardCheck className="w-6 h-6 text-surface-400" />} title={t('reviews.none_mine')} description={t('reviews.none_mine_desc')} />
            ) : <ul className="divide-y divide-surface-100">{state.mine.map((r) => <Row key={r.id} r={r} />)}</ul>}
          </Card>
          {state.team.length > 0 && (
            <Card className="!p-0 overflow-hidden">
              <h3 className="px-5 pt-4 pb-2 text-sm font-semibold text-surface-800">{t('reviews.team_reviews')}</h3>
              <ul className="divide-y divide-surface-100">{state.team.map((r) => <Row key={r.id} r={r} who />)}</ul>
            </Card>
          )}
        </>
      )}
      {open && <ReviewForm t={t} id={open} onClose={() => setOpen(null)} onChanged={() => setReload((n) => n + 1)} />}
    </PortalShell>
  );
}
