import { useState, useEffect } from 'react';
import { Download, ChevronLeft, ChevronRight, CalendarOff, Plane } from 'lucide-react';
import { toast } from 'react-toastify';
import dayjs from 'dayjs';
import Card from '@components/ui/Card';
import Badge from '@components/ui/Badge';
import EmptyState from '@components/ui/EmptyState';
import * as leaveApi from '@api/leaveApi';
import { StatCard } from './StatCard';

// Days come back as 0, "0.00" or 90 depending on the source; show them one way:
// whole days without decimals, half days with one.
const num = (v) => (v == null || v === '' ? null : Number(v));
const fmt = (v) => {
  const n = num(v);
  if (n == null || Number.isNaN(n)) return '—';
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
};

function leaveStatusLabel(t, s) {
  switch (s) {
    case 'Pending': return t('leave.st_pending');
    case 'Approved': return t('leave.st_approved');
    case 'Rejected': return t('leave.st_rejected');
    case 'Cancelled': return t('leave.st_cancelled');
    default: return s || '';
  }
}
const statusVariant = (s) => ({ Approved: 'success', Rejected: 'danger', Cancelled: 'inactive', Pending: 'warning' }[s] || 'info');

/**
 * The employee's leave for one year: what each leave type allows, what has
 * been used, what is left, and every request with its documents. Reuses
 * GET /leave/report.
 */
export default function EmployeeLeaveTab({ employee, t }) {
  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState(thisYear);
  const [report, setReport] = useState(null);
  const [loadedKey, setLoadedKey] = useState(null);
  const loading = loadedKey !== `${employee.id}:${year}`;
  const [files, setFiles] = useState({});

  useEffect(() => {
    let cancelled = false;
    const key = `${employee.id}:${year}`;
    leaveApi.getReport({ employee_id: employee.id, year })
      .then(async ({ data }) => {
        if (cancelled) return;
        setReport(data);
        setLoadedKey(key);
        // Pull attachments only for requests that actually have some.
        const withFiles = (data.requests || []).filter((r) => Number(r.file_count) > 0);
        const pairs = await Promise.all(withFiles.map((r) =>
          leaveApi.getRequestFiles(r.id).then(({ data: f }) => [r.id, f]).catch(() => [r.id, []])));
        if (!cancelled) setFiles(Object.fromEntries(pairs));
      })
      .catch(() => { if (!cancelled) { setReport(null); setLoadedKey(key); } });
    return () => { cancelled = true; };
  }, [employee.id, year]);

  const download = async (f) => {
    try {
      const res = await leaveApi.downloadLeaveFile(f.id);
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url; a.download = f.file_name || 'document';
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch { toast.error(t('toasts.t_failed_to_download_document')); }
  };

  const summary = report?.summary || [];
  // Types the employee has an allowance for, or has used, come first; types
  // with nothing either way are listed compactly underneath.
  const active = summary.filter((s) => (num(s.entitled) || 0) > 0 || (num(s.used) || 0) > 0);
  const idle = summary.filter((s) => !active.includes(s));
  const requests = report?.requests || [];
  const totals = active.reduce((acc, s) => {
    const ent = num(s.entitled) || 0;
    const used = num(s.used) || 0;
    return { entitled: acc.entitled + ent, used: acc.used + used, left: acc.left + Math.max(0, ent - used) };
  }, { entitled: 0, used: 0, left: 0 });
  const pending = requests.filter((r) => r.status === 'Pending').length;

  return (
    <div className="space-y-5">
      {/* Year */}
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => setYear((y) => y - 1)} title={t('empProfile.lv_prev_year')}
          className="p-1.5 rounded-lg text-surface-500 hover:text-brand-600 hover:bg-brand-50">
          <ChevronLeft size={16} className="rtl:rotate-180" />
        </button>
        <span className="px-3 py-1.5 rounded-lg border border-surface-200 bg-white text-sm font-semibold text-surface-800 tabular-nums min-w-[72px] text-center">{year}</span>
        <button type="button" onClick={() => setYear((y) => y + 1)} disabled={year >= thisYear + 1} title={t('empProfile.lv_next_year')}
          className="p-1.5 rounded-lg text-surface-500 hover:text-brand-600 hover:bg-brand-50 disabled:opacity-30">
          <ChevronRight size={16} className="rtl:rotate-180" />
        </button>
        {year !== thisYear && (
          <button type="button" onClick={() => setYear(thisYear)} className="text-xs text-brand-600 hover:underline ms-1">{t('empProfile.lv_this_year')}</button>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{[1, 2, 3, 4].map((i) => <div key={i} className="h-24 rounded-xl bg-surface-100 animate-pulse" />)}</div>
      ) : !report ? (
        <p className="text-xs text-surface-400">{t('common.failed_load')}</p>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard label={t('empProfile.lv_entitled')} value={fmt(totals.entitled)} sub={t('empProfile.lv_days')} />
            <StatCard label={t('empProfile.lv_used')} value={fmt(totals.used)} sub={t('empProfile.lv_days')} tone="amber" />
            <StatCard label={t('empProfile.lv_left')} value={fmt(totals.left)} sub={t('empProfile.lv_days')} tone="emerald" />
            <StatCard label={t('empProfile.lv_pending')} value={pending} tone={pending ? 'brand' : 'default'} />
          </div>

          {/* Balances */}
          <div className="rounded-2xl border border-surface-200 bg-white overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-surface-100 bg-surface-50/60">
              <Plane size={16} className="text-brand-600" />
              <h3 className="text-sm font-bold text-surface-900">{t('empProfile.lv_balances', { year })}</h3>
            </div>
            {active.length === 0 ? (
              <p className="text-xs text-surface-400 p-4">{t('empProfile.no_leave_types')}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[11px] uppercase tracking-wider text-surface-400 border-b border-surface-100">
                      <th className="px-4 py-2.5 text-start font-semibold">{t('leave.th_type')}</th>
                      <th className="px-4 py-2.5 text-end font-semibold w-24">{t('leave.th_entitled')}</th>
                      <th className="px-4 py-2.5 text-end font-semibold w-24">{t('leave.th_used')}</th>
                      <th className="px-4 py-2.5 text-end font-semibold w-24">{t('leave.th_remaining')}</th>
                      <th className="px-4 py-2.5 text-start font-semibold w-[28%] hidden md:table-cell">{t('empProfile.lv_usage')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-100">
                    {active.map((s) => {
                      const ent = num(s.entitled);
                      const used = num(s.used) || 0;
                      const left = ent == null ? null : Math.max(0, ent - used);
                      const pct = ent ? Math.min(100, Math.round((used / ent) * 100)) : (used > 0 ? 100 : 0);
                      const bar = pct >= 90 ? 'bg-red-500' : pct >= 60 ? 'bg-amber-500' : 'bg-brand-500';
                      return (
                        <tr key={s.leave_type_id} className="hover:bg-surface-50/50">
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center gap-2 font-medium text-surface-800">
                              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: s.color || '#7c3aed' }} />
                              {s.name}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-end tabular-nums text-surface-600">{fmt(ent)}</td>
                          <td className="px-4 py-3 text-end tabular-nums text-surface-600">{fmt(used)}</td>
                          <td className="px-4 py-3 text-end tabular-nums">
                            <span className={`font-bold ${left === 0 ? 'text-surface-400' : 'text-emerald-700'}`}>{fmt(left)}</span>
                          </td>
                          <td className="px-4 py-3 hidden md:table-cell">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-1.5 rounded-full bg-surface-100 overflow-hidden">
                                <div className={`h-full rounded-full ${bar}`} style={{ width: `${pct}%` }} />
                              </div>
                              <span className="text-[11px] text-surface-400 tabular-nums w-9 text-end">{pct}%</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {idle.length > 0 && (
              <div className="px-4 py-3 border-t border-surface-100 bg-surface-50/40">
                <p className="text-[11px] text-surface-400 mb-1.5">{t('empProfile.lv_no_allowance')}</p>
                <div className="flex flex-wrap gap-1.5">
                  {idle.map((s) => (
                    <span key={s.leave_type_id} className="text-[11px] px-2 py-0.5 rounded-full bg-white border border-surface-200 text-surface-500">{s.name}</span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Requests */}
          {requests.length === 0 ? (
            <Card><EmptyState icon={<CalendarOff className="w-6 h-6 text-surface-400" />} title={t('empProfile.lv_no_requests')} description={t('leave.no_report_requests')} /></Card>
          ) : (
            <div className="rounded-2xl border border-surface-200 bg-white overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-surface-100 bg-surface-50/60">
                <CalendarOff size={16} className="text-brand-600" />
                <h3 className="text-sm font-bold text-surface-900">{t('empProfile.lv_requests')}</h3>
                <span className="text-[11px] text-surface-400">({requests.length})</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[11px] uppercase tracking-wider text-surface-400 border-b border-surface-100">
                      <th className="px-4 py-2.5 text-start font-semibold">{t('leave.th_type')}</th>
                      <th className="px-4 py-2.5 text-start font-semibold">{t('leave.th_dates')}</th>
                      <th className="px-4 py-2.5 text-end font-semibold">{t('leave_x.days')}</th>
                      <th className="px-4 py-2.5 text-start font-semibold">{t('portal.status')}</th>
                      <th className="px-4 py-2.5 text-start font-semibold">{t('leave.th_decided_by')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-100">
                    {requests.map((r) => (
                      <tr key={r.id} className="align-top hover:bg-surface-50/50">
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-2 font-medium text-surface-800">
                            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: r.color || '#7c3aed' }} />
                            {r.leave_type_name}
                          </span>
                          {r.reason && <p className="text-[11px] text-surface-500 mt-1 max-w-[320px]">{r.reason}</p>}
                          {(files[r.id] || []).length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-1.5">
                              {files[r.id].map((f) => (
                                <button key={f.id} type="button" onClick={() => download(f)}
                                  className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-md bg-surface-100 hover:bg-surface-200 text-surface-600">
                                  <Download size={11} /> {t(`leave.kind_${f.kind}`)}: {f.file_name}
                                </button>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-surface-600 tabular-nums">
                          {dayjs(r.start_date).format('YYYY-MM-DD')} → {dayjs(r.end_date).format('YYYY-MM-DD')}
                        </td>
                        <td className="px-4 py-3 text-end tabular-nums font-semibold text-surface-800">{fmt(r.days)}</td>
                        <td className="px-4 py-3"><Badge variant={statusVariant(r.status)} className="text-[10px] whitespace-nowrap">{leaveStatusLabel(t, r.status)}</Badge></td>
                        <td className="px-4 py-3 text-xs text-surface-500">
                          {r.approver_name || r.decided_by_name || '—'}
                          {r.decided_at && <span className="block text-[11px] text-surface-400">{dayjs(r.decided_at).format('YYYY-MM-DD')}</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
