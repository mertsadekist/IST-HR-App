import { useEffect, useState } from 'react';
import { Hourglass, Plane, Clock, Banknote, FileText, Laptop, AlertTriangle, CheckCircle2, ChevronRight } from 'lucide-react';
import dayjs from 'dayjs';
import * as employeesApi from '@api/employeesApi';
import * as leaveApi from '@api/leaveApi';
import * as attendanceApi from '@api/attendanceApi';
import * as payrollApi from '@api/payrollApi';
import * as assetsApi from '@api/assetsApi';
import { money, tenureText } from './profileUtils';
import { StatCard } from './StatCard';

const settle = (p) => p.then(({ data }) => data).catch(() => null);

/**
 * The first thing HR sees on a profile: a handful of headline figures, each a
 * shortcut into its tab, and the list of things that still need doing for
 * this person. Every source is optional — a role that cannot read payroll just
 * gets no payroll card, rather than an error.
 */
export default function EmployeeOverviewTab({ employee, t, canPayroll, canAttendance, onOpenTab }) {
  const [data, setData] = useState(null);
  const [loadedFor, setLoadedFor] = useState(null);
  const loading = loadedFor !== employee.id;

  useEffect(() => {
    let alive = true;
    const id = employee.id;
    const year = dayjs().year();
    const month = dayjs().format('YYYY-MM');
    Promise.all([
      settle(employeesApi.getEmployeeDocuments(id)),
      settle(leaveApi.getReport({ employee_id: id, year })),
      canAttendance ? settle(attendanceApi.summary({ employee_id: id, month })) : null,
      canPayroll ? settle(payrollApi.employeePayslips(id)) : null,
      settle(assetsApi.getAssets({ employee_id: id })),
    ]).then(([docs, leave, att, payslips, assets]) => {
      if (!alive) return;
      setData({ docs, leave, att, payslips, assets });
      setLoadedFor(id);
    });
    return () => { alive = false; };
  }, [employee.id, canPayroll, canAttendance]);

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 2xl:grid-cols-6 gap-3">
        {[1, 2, 3, 4, 5, 6].map((i) => <div key={i} className="h-24 rounded-xl bg-surface-100 animate-pulse" />)}
      </div>
    );
  }

  const { docs, leave, att, payslips, assets } = data;
  const official = (docs || []).filter((d) => d.doc_type);
  const expired = official.filter((d) => d.days_left != null && d.days_left < 0).length;
  const soon = official.filter((d) => d.days_left != null && d.days_left >= 0 && d.days_left <= 90).length;

  // The leave type with the largest entitlement is the annual one in practice.
  const main = [...(leave?.summary || [])].sort((a, b) => Number(b.entitled) - Number(a.entitled))[0];
  const leaveLeft = main ? Math.max(0, Number(main.entitled) - Number(main.used)) : null;
  const pendingLeave = (leave?.requests || []).filter((r) => r.status === 'Pending').length;

  const stat = (s) => Number(att?.by_status?.find((x) => x.status === s)?.count || 0);
  const lastPay = (payslips || []).find((p) => ['Approved', 'Paid'].includes(p.run_status));
  const heldAssets = Array.isArray(assets) ? assets.filter((a) => a.status === 'Active').length : null;

  const issues = [];
  if (employee.labour_contract_status !== 'Issued') issues.push({ text: t('empProfile.warn_lc'), tab: 'profile', level: 'red' });
  if (expired) issues.push({ text: t('empProfile.warn_docs_expired', { count: expired }), tab: 'documents', level: 'red' });
  if (soon) issues.push({ text: t('empProfile.warn_docs_soon', { count: soon }), tab: 'documents', level: 'amber' });
  if (docs && !official.length) issues.push({ text: t('empProfile.warn_no_docs'), tab: 'documents', level: 'amber' });
  if (!employee.work_permit_no || !employee.personal_no) issues.push({ text: t('empProfile.warn_wps'), tab: 'profile', level: 'amber' });
  if (!employee.attendance_id && !employee.is_owner) issues.push({ text: t('empProfile.warn_att_id'), tab: 'profile', level: 'amber' });
  if (!employee.user_id) issues.push({ text: t('empProfile.warn_no_login'), tab: 'profile', level: 'info' });

  const dot = { red: 'bg-red-500', amber: 'bg-amber-500', info: 'bg-blue-400' };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-3 2xl:grid-cols-6 gap-3">
        <StatCard icon={Hourglass} label={t('empProfile.kpi_tenure')} value={tenureText(t, employee.start_date)}
          sub={employee.start_date ? dayjs(employee.start_date).format('MMM D, YYYY') : undefined} onClick={() => onOpenTab('profile')} />
        <StatCard icon={Plane} label={t('empProfile.kpi_leave')} value={leaveLeft != null ? t('empProfile.days_value', { n: leaveLeft }) : '—'}
          sub={main ? (pendingLeave ? t('empProfile.kpi_leave_pending', { type: main.name, n: pendingLeave }) : main.name) : undefined}
          tone="brand" onClick={() => onOpenTab('leave')} />
        {canAttendance && (
          <StatCard icon={Clock} label={t('empProfile.kpi_attendance')} value={stat('Present') + stat('Remote')}
            sub={t('empProfile.kpi_attendance_sub', { absent: stat('Absent'), late: stat('Late') })}
            tone={stat('Absent') ? 'amber' : 'emerald'} onClick={() => onOpenTab('attendance')} />
        )}
        {canPayroll && (
          <StatCard icon={Banknote} label={t('empProfile.kpi_last_pay')} value={lastPay ? money(lastPay.net) : '—'}
            sub={lastPay ? dayjs(`${lastPay.period}-01`).format('MMM YYYY') : t('empProfile.ps_none')} tone="emerald" onClick={() => onOpenTab('payslips')} />
        )}
        <StatCard icon={FileText} label={t('empProfile.kpi_docs')} value={(docs || []).length}
          sub={t('empProfile.kpi_docs_sub', { expired, soon })} tone={expired ? 'red' : soon ? 'amber' : 'default'} onClick={() => onOpenTab('documents')} />
        <StatCard icon={Laptop} label={t('empProfile.kpi_assets')} value={heldAssets ?? '—'} onClick={() => onOpenTab('assets')} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <div className="bg-white rounded-xl border border-surface-200 p-4">
          <h3 className="font-bold text-sm text-surface-900 flex items-center gap-1.5 mb-3">
            <AlertTriangle size={16} className="text-amber-500" /> {t('empProfile.attention')}
          </h3>
          {issues.length === 0 ? (
            <p className="text-xs text-emerald-700 flex items-center gap-1.5"><CheckCircle2 size={14} /> {t('empProfile.all_good')}</p>
          ) : (
            <ul className="divide-y divide-surface-100">
              {issues.map((x) => (
                <li key={x.text}>
                  <button type="button" onClick={() => onOpenTab(x.tab)}
                    className="w-full flex items-center gap-2 py-2 text-xs text-surface-700 hover:text-brand-700 text-start">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${dot[x.level]}`} />
                    <span className="flex-1">{x.text}</span>
                    <ChevronRight size={14} className="text-surface-300 rtl:rotate-180" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="bg-white rounded-xl border border-surface-200 p-4">
          <h3 className="font-bold text-sm text-surface-900 flex items-center gap-1.5 mb-3">
            <Plane size={16} className="text-brand-600" /> {t('empProfile.leave_balances', { year: dayjs().year() })}
          </h3>
          {!(leave?.summary || []).length ? (
            <p className="text-xs text-surface-400">{t('empProfile.no_leave_types')}</p>
          ) : (
            <div className="space-y-3">
              {leave.summary.map((s) => {
                const ent = Number(s.entitled) || 0;
                const used = Number(s.used) || 0;
                const pct = ent ? Math.min(100, Math.round((used / ent) * 100)) : 0;
                return (
                  <div key={s.leave_type_id}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-surface-700 font-medium">{s.name}</span>
                      <span className="text-surface-500 tabular-nums">{t('empProfile.leave_used_of', { used, total: ent })}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-surface-100 overflow-hidden">
                      <div className={`h-full rounded-full ${pct >= 90 ? 'bg-red-500' : pct >= 60 ? 'bg-amber-500' : 'bg-brand-500'}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
