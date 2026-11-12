import { useTranslation } from 'react-i18next';
import { lineLabel, lineWorking, money } from '@utils/payslipLines';

/**
 * One payslip, line by line: earnings, deductions, and how each deduction was
 * worked out. Shown to payroll in Payroll Runs and to the employee in My Salary,
 * so both read the same explanation.
 */
export default function PayslipLines({ t, lines, net }) {
  const { i18n } = useTranslation();
  const earnings = (lines || []).filter((l) => l.kind === 'earning');
  const deductions = (lines || []).filter((l) => l.kind === 'deduction');
  const total = (list) => list.reduce((s, l) => s + Number(l.amount || 0), 0);

  const row = (l, i, sign) => {
    const working = lineWorking(t, l);
    return (
      <li key={i} className="flex items-start justify-between gap-3 py-1">
        <span className="text-surface-700">
          {lineLabel(t, l, i18n.language)}
          {working && <span className="block text-[11px] text-surface-400">{working}</span>}
        </span>
        <span className={`font-mono whitespace-nowrap ${sign < 0 ? 'text-red-600' : 'text-surface-800'}`}>
          {sign < 0 ? '−' : ''}{money(l.amount)}
        </span>
      </li>
    );
  };

  return (
    <div className="grid sm:grid-cols-2 gap-4 text-xs">
      <div>
        <p className="font-semibold text-surface-500 uppercase tracking-wide text-[10px] mb-1">{t('payslip.earnings')}</p>
        <ul className="divide-y divide-surface-100">{earnings.map((l, i) => row(l, i, 1))}</ul>
        <p className="flex justify-between border-t border-surface-200 pt-1 mt-1 font-semibold text-surface-800">
          <span>{t('payslip.total_earnings')}</span><span className="font-mono">{money(total(earnings))}</span>
        </p>
      </div>
      <div>
        <p className="font-semibold text-surface-500 uppercase tracking-wide text-[10px] mb-1">{t('payslip.deductions')}</p>
        {deductions.length ? (
          <ul className="divide-y divide-surface-100">{deductions.map((l, i) => row(l, i, -1))}</ul>
        ) : <p className="text-surface-400 py-1">{t('payslip.no_deductions')}</p>}
        <p className="flex justify-between border-t border-surface-200 pt-1 mt-1 font-semibold text-surface-800">
          <span>{t('payslip.total_deductions')}</span><span className="font-mono text-red-600">−{money(total(deductions))}</span>
        </p>
        {net != null && (
          <p className="flex justify-between pt-2 mt-1 font-bold text-brand-700 text-sm">
            <span>{t('payslip.net_pay')}</span><span className="font-mono">{money(net)}</span>
          </p>
        )}
      </div>
    </div>
  );
}
