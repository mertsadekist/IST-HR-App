import { useEffect, useState } from 'react';
import { HandCoins, ListPlus, Timer } from 'lucide-react';
import dayjs from 'dayjs';
import Badge from '@components/ui/Badge';
import * as payrollApi from '@api/payrollApi';
import * as overtimeApi from '@api/overtimeApi';
import { money } from './profileUtils';

const settle = (p) => p.then(({ data }) => data).catch(() => null);
const hours = (m) => (Number(m || 0) / 60).toFixed(1);
const loanVariant = { Active: 'warning', Settled: 'success', Cancelled: 'inactive' };
const otVariant = { Pending: 'warning', Approved: 'success', Rejected: 'danger' };

function Section({ icon: Icon, title, count, children }) {
  return (
    <div className="rounded-2xl border border-surface-200 bg-white overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-surface-100 bg-surface-50/60">
        <Icon size={16} className="text-brand-600" />
        <h3 className="text-sm font-bold text-surface-900">{title}</h3>
        <span className="text-[11px] text-surface-400">({count})</span>
      </div>
      {children}
    </div>
  );
}

/**
 * Everything else payroll holds for this employee: loans and salary advances
 * with what is still outstanding, one-time pay items (bonus, commission,
 * deductions…) and overtime. Read-only here; they are managed on the payroll
 * and overtime pages.
 */
export default function EmployeePayExtras({ employee, t }) {
  const [data, setData] = useState(null);
  const [loadedFor, setLoadedFor] = useState(null);

  useEffect(() => {
    let alive = true;
    const id = employee.id;
    Promise.all([
      settle(payrollApi.getLoans({ employee_id: id })),
      settle(payrollApi.getAdjustments({ employee_id: id })),
      settle(overtimeApi.getOvertime({ employee_id: id })),
    ]).then(([loans, adjustments, overtime]) => {
      if (!alive) return;
      setData({ loans: loans || [], adjustments: adjustments || [], overtime: overtime?.rows || [] });
      setLoadedFor(id);
    });
    return () => { alive = false; };
  }, [employee.id]);

  if (loadedFor !== employee.id || !data) return null;
  const { loans, adjustments, overtime } = data;
  if (!loans.length && !adjustments.length && !overtime.length) {
    return <p className="text-xs text-surface-400 text-center py-2">{t('empProfile.px_none')}</p>;
  }
  const th = 'px-4 py-2.5 text-start font-semibold';
  const thEnd = 'px-4 py-2.5 text-end font-semibold';
  const head = 'text-[11px] uppercase tracking-wider text-surface-400 border-b border-surface-100';

  return (
    <div className="space-y-4">
      {loans.length > 0 && (
        <Section icon={HandCoins} title={t('empProfile.px_loans')} count={loans.length}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className={head}>
                <th className={th}>{t('empProfile.px_type')}</th><th className={thEnd}>{t('empProfile.px_principal')}</th>
                <th className={thEnd}>{t('empProfile.px_instalment')}</th><th className={thEnd}>{t('empProfile.px_repaid')}</th>
                <th className={thEnd}>{t('empProfile.px_outstanding')}</th><th className={th}>{t('empProfile.px_from')}</th><th className={th}>{t('portal.status')}</th>
              </tr></thead>
              <tbody className="divide-y divide-surface-100">
                {loans.map((l) => (
                  <tr key={l.id}>
                    <td className="px-4 py-2.5">{t(l.type === 'Advance' ? 'empProfile.px_advance' : 'empProfile.px_loan')}
                      {l.reason && <span className="block text-[11px] text-surface-400 truncate max-w-[240px]">{l.reason}</span>}</td>
                    <td className="px-4 py-2.5 text-end font-mono">{money(l.principal)}</td>
                    <td className="px-4 py-2.5 text-end font-mono">{money(l.instalment)}</td>
                    <td className="px-4 py-2.5 text-end font-mono text-emerald-700">{money(l.repaid)}</td>
                    <td className={`px-4 py-2.5 text-end font-mono font-semibold ${l.status === 'Active' && l.outstanding > 0 ? 'text-red-600' : 'text-surface-500'}`}>{money(l.outstanding)}</td>
                    <td className="px-4 py-2.5 text-surface-500 whitespace-nowrap">{l.start_period}</td>
                    <td className="px-4 py-2.5"><Badge variant={loanVariant[l.status] || 'info'} className="text-[10px]">{t(`empProfile.px_st_${String(l.status).toLowerCase()}`)}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {adjustments.length > 0 && (
        <Section icon={ListPlus} title={t('empProfile.px_adjustments')} count={adjustments.length}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className={head}>
                <th className={th}>{t('portal.period')}</th><th className={th}>{t('empProfile.px_item')}</th>
                <th className={thEnd}>{t('empProfile.px_amount')}</th><th className={th}>{t('portal.notes')}</th>
              </tr></thead>
              <tbody className="divide-y divide-surface-100">
                {adjustments.map((a) => (
                  <tr key={a.id}>
                    <td className="px-4 py-2.5 whitespace-nowrap">{dayjs(`${a.period}-01`).format('MMM YYYY')}</td>
                    <td className="px-4 py-2.5">{a.label}<span className="block text-[11px] text-surface-400">{a.category}</span></td>
                    <td className={`px-4 py-2.5 text-end font-mono font-semibold ${a.kind === 'deduction' ? 'text-red-600' : 'text-emerald-700'}`}>
                      {a.kind === 'deduction' ? '−' : '+'}{money(a.amount)}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-surface-500 truncate max-w-[260px]">{a.note || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {overtime.length > 0 && (
        <Section icon={Timer} title={t('empProfile.px_overtime')} count={overtime.length}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className={head}>
                <th className={th}>{t('portal.date')}</th><th className={thEnd}>{t('empProfile.px_ot_normal')}</th>
                <th className={thEnd}>{t('empProfile.px_ot_night')}</th><th className={thEnd}>{t('empProfile.px_ot_rest')}</th>
                <th className={thEnd}>{t('empProfile.px_amount')}</th><th className={th}>{t('portal.status')}</th>
              </tr></thead>
              <tbody className="divide-y divide-surface-100">
                {overtime.map((o) => (
                  <tr key={o.id}>
                    <td className="px-4 py-2.5 whitespace-nowrap">{o.work_date}</td>
                    <td className="px-4 py-2.5 text-end tabular-nums">{hours(o.approved_normal ?? o.normal_minutes)}</td>
                    <td className="px-4 py-2.5 text-end tabular-nums">{hours(o.approved_night ?? o.night_minutes)}</td>
                    <td className="px-4 py-2.5 text-end tabular-nums">{hours(o.approved_rest ?? o.rest_minutes)}</td>
                    <td className="px-4 py-2.5 text-end font-mono">{o.amount != null ? money(o.amount) : '—'}</td>
                    <td className="px-4 py-2.5"><Badge variant={otVariant[o.status] || 'info'} className="text-[10px]">{t(`empProfile.px_ot_${String(o.status).toLowerCase()}`)}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}
    </div>
  );
}
