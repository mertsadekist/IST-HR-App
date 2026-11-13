import { useEffect, useState } from 'react';
import { Users, FileWarning, Wallet, AlertTriangle } from 'lucide-react';
import * as leaveApi from '@api/leaveApi';

const n = (v) => Number(v || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });

/**
 * What the person deciding a leave request should know: who else in the team
 * is off over those dates (and the busiest day's share), travel documents that
 * run out around the trip, and what the request does to the balance and pay.
 */
export default function LeaveContext({ t, requestId, compact = false }) {
  const [state, setState] = useState({ id: null, data: null });

  useEffect(() => {
    if (!requestId) return undefined;
    let off = false;
    leaveApi.getContext(requestId)
      .then(({ data }) => { if (!off) setState({ id: requestId, data }); })
      .catch(() => { if (!off) setState({ id: requestId, data: null }); });
    return () => { off = true; };
  }, [requestId]);

  const d = state.id === requestId ? state.data : null;
  if (!d) return null;
  const pay = d.pay || {};
  const busy = d.peak_percent >= 50;
  return (
    <div className={`rounded-xl border p-3 text-xs space-y-2 ${busy || d.documents.length ? 'border-amber-200 bg-amber-50/60' : 'border-surface-200 bg-surface-50'}`}>
      <div className="flex items-start gap-2">
        <Users size={14} className="text-surface-500 mt-0.5 shrink-0" />
        <div className="min-w-0">
          <p className={busy ? 'text-amber-900 font-medium' : 'text-surface-700'}>
            {d.team_basis === 'none' ? t('leave_x.ctx_no_team')
              : d.others_off.length === 0 ? t('leave_x.ctx_nobody_off', { size: d.team_size })
                : t('leave_x.ctx_peak', { peak: d.peak_off, size: d.team_size, pct: d.peak_percent })}
          </p>
          {!compact && d.others_off.length > 0 && (
            <ul className="mt-1 space-y-0.5 text-surface-600">
              {d.others_off.map((o) => (
                <li key={o.id}>
                  <span className="inline-block w-2 h-2 rounded-full me-1.5" style={{ background: o.color || '#7c3aed' }} />
                  {o.employee_name} · {o.leave_type_name} · {o.start_date}{o.end_date !== o.start_date ? ` → ${o.end_date}` : ''}
                  {o.status === 'Pending' && <span className="text-surface-400"> ({t('leave_x.pending')})</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      {d.documents.map((doc) => (
        <div key={doc.doc_type + doc.expiry_date} className="flex items-start gap-2 text-amber-900">
          <FileWarning size={14} className="mt-0.5 shrink-0" />
          <p>{t(`leave_x.ctx_doc_${doc.when}`, { doc: t(`leave_x.doc.${doc.doc_type.replace(/\s+/g, '_')}`), date: doc.expiry_date })}</p>
        </div>
      ))}
      <div className="flex items-start gap-2 text-surface-700">
        <Wallet size={14} className="text-surface-500 mt-0.5 shrink-0" />
        <p>
          {[
            pay.full_days ? t('leave_x.pay_full', { n: n(pay.full_days) }) : null,
            pay.half_days ? t('leave_x.pay_half', { n: n(pay.half_days) }) : null,
            pay.unpaid_days ? t('leave_x.pay_unpaid', { n: n(pay.unpaid_days) }) : null,
          ].filter(Boolean).join(' · ') || t('leave_x.pay_none')}
          {d.balance?.remaining != null && <span className="text-surface-500"> · {t('leave_x.ctx_remaining', { n: n(d.balance.remaining) })}</span>}
        </p>
      </div>
      {!compact && d.warnings.filter((w) => w !== 'document').map((w) => (
        <p key={w} className="flex items-start gap-2 text-amber-800"><AlertTriangle size={14} className="mt-0.5 shrink-0" /> {t(`leave_x.warn.${w}`)}</p>
      ))}
    </div>
  );
}
