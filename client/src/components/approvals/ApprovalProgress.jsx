import { Check, X, Clock, SkipForward, Hourglass } from 'lucide-react';
import { stepLabel } from '@utils/approvals';

const ICON = { approved: Check, rejected: X, current: Clock, skipped: SkipForward, waiting: Hourglass, not_reached: Hourglass };
const TONE = {
  approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  rejected: 'bg-red-50 text-red-700 border-red-200',
  current: 'bg-amber-50 text-amber-800 border-amber-200',
  skipped: 'bg-surface-50 text-surface-400 border-surface-200',
  waiting: 'bg-white text-surface-500 border-surface-200',
  not_reached: 'bg-white text-surface-300 border-surface-200',
};

/**
 * A request's approval chain at a glance: one chip per step, in order, with who
 * decided or who it is waiting for. `approval` is the server's summary.
 */
export default function ApprovalProgress({ t, approval, compact = false }) {
  if (!approval) return null;
  return (
    <div className="flex flex-wrap items-center gap-1">
      {approval.steps.map((s, i) => {
        const Icon = ICON[s.state] || Hourglass;
        const who = s.state === 'approved' || s.state === 'rejected'
          ? s.by_name + (s.on_behalf ? ` (${t('approvals.on_behalf')})` : '')
          : s.state === 'current' ? (s.approver_names || []).join(', ')
            : s.state === 'skipped' ? (s.skip_reason === 'no_manager' ? t('approvals.skip_no_manager') : t('approvals.skip_no_approver')) : '';
        return (
          <span key={i} title={[s.note, who].filter(Boolean).join(' — ')}
            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border text-[10px] font-medium ${TONE[s.state] || TONE.waiting}`}>
            <Icon size={10} /> {stepLabel(t, s)}
            {!compact && who && <span className="font-normal opacity-80">· {who}</span>}
          </span>
        );
      })}
      {approval.status === 'Approved' && <span className="text-[10px] text-surface-500">→ {t('approvals.hr_final')}</span>}
    </div>
  );
}
