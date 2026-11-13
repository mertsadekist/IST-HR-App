import { useEffect, useState } from 'react';
import { Loader2, AlertTriangle } from 'lucide-react';
import * as leaveApi from '@api/leaveApi';

const n = (v) => Number(v || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });

/**
 * What a leave request will cost, shown while it is being filled in: the days
 * counted (working days skip rest days and holidays), how they are paid, the
 * balance left afterwards, and anything HR will look at (notice, eligibility,
 * an overlapping request). Advisory: nothing here stops the request.
 */
export default function LeavePreview({ t, leaveTypeId, start, end, partialHours, employeeId }) {
  const ready = !!(leaveTypeId && start && end && end >= start);
  const key = ready ? JSON.stringify([leaveTypeId, start, end, partialHours || '', employeeId || '']) : null;
  const [state, setState] = useState({ key: null, data: null });

  useEffect(() => {
    if (!key) return undefined;
    let off = false;
    const timer = setTimeout(() => {
      leaveApi.preview({
        leave_type_id: Number(leaveTypeId), start_date: start, end_date: end,
        ...(partialHours ? { partial_hours: partialHours } : {}), ...(employeeId ? { employee_id: employeeId } : {}),
      })
        .then(({ data }) => { if (!off) setState({ key, data }); })
        .catch(() => { if (!off) setState({ key, data: null }); });
    }, 350);
    return () => { off = true; clearTimeout(timer); };
  }, [key, leaveTypeId, start, end, partialHours, employeeId]);

  if (!ready) return null;
  if (state.key !== key) {
    return <div className="flex items-center gap-2 text-xs text-surface-400"><Loader2 size={12} className="animate-spin" /> {t('leave_x.preview_loading')}</div>;
  }
  const d = state.data;
  if (!d) return null;
  const pay = d.pay || {};
  const after = d.balance?.remaining == null ? null : Number(d.balance.remaining) - Number(d.days);
  return (
    <div className="rounded-xl border border-surface-200 bg-surface-50 p-3 text-xs space-y-1.5">
      <p className="font-semibold text-surface-800">
        {d.day_basis === 'working' ? t('leave_x.preview_working_days', { n: n(d.days) }) : t('leave_x.preview_days', { n: n(d.days) })}
        {d.excluded?.length > 0 && <span className="font-normal text-surface-500"> · {t('leave_x.preview_excluded', { n: d.excluded.length })}</span>}
      </p>
      <p className="text-surface-600">
        {[
          pay.full_days ? t('leave_x.pay_full', { n: n(pay.full_days) }) : null,
          pay.half_days ? t('leave_x.pay_half', { n: n(pay.half_days) }) : null,
          pay.unpaid_days ? t('leave_x.pay_unpaid', { n: n(pay.unpaid_days) }) : null,
        ].filter(Boolean).join(' · ') || t('leave_x.pay_none')}
      </p>
      {d.balance?.remaining != null && (
        <p className="text-surface-600">
          {t('leave_x.balance_line', { remaining: n(d.balance.remaining), after: n(after) })}
          {Number(d.balance.adjusted) !== 0 && <span className="text-surface-400"> ({t('leave_x.incl_adjusted', { n: n(d.balance.adjusted) })})</span>}
        </p>
      )}
      {d.warnings?.length > 0 && (
        <ul className="space-y-0.5 pt-1">
          {d.warnings.map((w) => (
            <li key={w} className="flex items-start gap-1.5 text-amber-800"><AlertTriangle size={12} className="mt-0.5 shrink-0" /> {t(`leave_x.warn.${w}`)}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
