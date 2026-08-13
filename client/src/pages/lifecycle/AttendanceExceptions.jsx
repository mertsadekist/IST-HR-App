/**
 * The attendance evaluator's findings — SHADOW MODE.
 *
 * Phase 2 of the attendance-exception work. The engine judges every day against
 * the employee's work schedule and records what it thinks; nothing it decides is
 * written to the attendance record, and no payroll figure can move. This page is
 * where those two opinions are compared, for a few weeks, before anyone trusts
 * the engine with the real columns.
 *
 * The banner at the top is not decoration. Somebody arriving at a page full of
 * "Absent" and "Late" needs to know immediately that none of it has been applied
 * to anyone.
 */
import { useState, useEffect, useMemo } from 'react';
import { useSelector } from 'react-redux';
import * as evalApi from '@api/attendanceEvaluationApi';
import Card from '@components/ui/Card';
import Button from '@components/ui/Button';
import Badge from '@components/ui/Badge';
import EmptyState from '@components/ui/EmptyState';
import { toast } from 'react-toastify';
import { Eye, Play, AlertTriangle, Scale, Users, History, CheckCircle2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';

const SEVERITY_STYLE = {
  Blocking: 'bg-red-50 text-red-700 border-red-200',
  Review: 'bg-amber-50 text-amber-700 border-amber-200',
  Info: 'bg-sky-50 text-sky-700 border-sky-200',
};

const STATUS_VARIANT = {
  Open: 'danger', 'Awaiting Employee': 'warning', 'Awaiting Manager': 'warning',
  Resolved: 'success', Waived: 'info', 'Auto-resolved': 'inactive',
};

const mins = (n) => (n == null ? '—' : (n < 60 ? `${n}m` : `${Math.floor(n / 60)}h${n % 60 ? ` ${n % 60}m` : ''}`));

export default function AttendanceExceptions() {
  const { t } = useTranslation();
  const { currentCompanyId } = useSelector((s) => s.entity);
  const canRun = ['admin', 'hr_manager'].includes(useSelector((s) => s.auth.user?.role));

  const [tab, setTab] = useState('exceptions'); // exceptions | comparison | runs
  const [from, setFrom] = useState(dayjs().subtract(30, 'day').format('YYYY-MM-DD'));
  const [to, setTo] = useState(dayjs().format('YYYY-MM-DD'));
  const [severity, setSeverity] = useState('');
  const [onlyOpen, setOnlyOpen] = useState(true);

  const [summary, setSummary] = useState(null);
  const [exceptions, setExceptions] = useState([]);
  const [comparison, setComparison] = useState([]);
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);

  const params = () => ({ from, to, company_id: currentCompanyId || undefined });

  const load = async () => {
    setLoading(true);
    try {
      const [{ data: s }, { data: e }] = await Promise.all([
        evalApi.getSummary(params()),
        evalApi.getExceptions({ ...params(), severity: severity || undefined, status: onlyOpen ? 'open' : undefined }),
      ]);
      setSummary(s);
      setExceptions(e);
    } catch { toast.error(t('toasts.t_failed_to_load_evaluation')); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [from, to, severity, onlyOpen, currentCompanyId]);

  useEffect(() => {
    if (tab === 'comparison') evalApi.getComparison(params()).then(({ data }) => setComparison(data)).catch(() => setComparison([]));
    if (tab === 'runs') evalApi.getRuns().then(({ data }) => setRuns(data)).catch(() => setRuns([]));
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [tab, from, to, currentCompanyId]);

  const run = async () => {
    setRunning(true);
    try {
      const { data } = await evalApi.runEvaluation({ from, to, company_id: currentCompanyId || undefined });
      toast.success(t('toasts.t_evaluation_complete', {
        days: data.days_evaluated, opened: data.exceptions_opened, differs: data.disagreements,
      }));
      load();
      if (tab === 'runs') evalApi.getRuns().then(({ data: r }) => setRuns(r));
      if (tab === 'comparison') evalApi.getComparison(params()).then(({ data: c }) => setComparison(c));
    } catch (err) {
      toast.error(err.response?.data?.error || t('toasts.t_operation_failed'));
    } finally { setRunning(false); }
  };

  const grouped = useMemo(() => {
    const out = { Blocking: [], Review: [], Info: [] };
    for (const e of exceptions) (out[e.severity] || out.Review).push(e);
    return out;
  }, [exceptions]);

  const agreement = summary?.agreement;
  const agreePct = agreement && agreement.evaluated
    ? Math.round(100 * (1 - (agreement.status_differs + agreement.late_differs + agreement.early_differs) / (agreement.evaluated * 3)))
    : null;

  const tabs = [
    { key: 'exceptions', icon: AlertTriangle, label: t('attendance_eval.tab_exceptions') },
    { key: 'comparison', icon: Scale, label: t('attendance_eval.tab_comparison') },
    { key: 'runs', icon: History, label: t('attendance_eval.tab_runs') },
  ];

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-surface-900">{t('attendance_eval.title')}</h1>
          <p className="text-surface-500 mt-0.5 text-sm">{t('attendance_eval.subtitle')}</p>
        </div>
        {canRun && (
          <Button onClick={run} loading={running}><Play size={15} /> {t('attendance_eval.run')}</Button>
        )}
      </div>

      {/* The whole point of the mode, said plainly. */}
      <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-indigo-50 border border-indigo-200">
        <Eye size={17} className="text-indigo-600 mt-0.5 shrink-0" />
        <div className="text-xs text-indigo-900">
          <p className="font-semibold">{t('attendance_eval.shadow_banner_title')}</p>
          <p className="mt-0.5">{t('attendance_eval.shadow_banner_body')}</p>
        </div>
      </div>

      {/* Range */}
      <div className="flex items-center gap-2 flex-wrap">
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
          className="text-xs border border-surface-200 rounded-lg px-2 py-2" />
        <span className="text-surface-400 text-xs">→</span>
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
          className="text-xs border border-surface-200 rounded-lg px-2 py-2" />
        <div className="flex gap-1 bg-surface-100 rounded-xl p-1 ms-2">
          {tabs.map((x) => (
            <button key={x.key} onClick={() => setTab(x.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                tab === x.key ? 'bg-white text-brand-700 shadow-sm' : 'text-surface-500 hover:text-surface-700'}`}>
              <x.icon size={13} /> {x.label}
            </button>
          ))}
        </div>
      </div>

      {/* Agreement */}
      {agreement && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat label={t('attendance_eval.days_evaluated')} value={agreement.evaluated} />
          <Stat label={t('attendance_eval.status_differs')} value={agreement.status_differs} tone={agreement.status_differs ? 'warn' : 'ok'} />
          <Stat label={t('attendance_eval.late_differs')} value={agreement.late_differs} tone={agreement.late_differs ? 'warn' : 'ok'} />
          <Stat label={t('attendance_eval.agreement')} value={agreePct == null ? '—' : `${agreePct}%`} tone={agreePct >= 90 ? 'ok' : 'warn'} />
        </div>
      )}

      {/* ───────── exceptions ───────── */}
      {tab === 'exceptions' && (
        <>
          <div className="flex items-center gap-2 flex-wrap">
            <select value={severity} onChange={(e) => setSeverity(e.target.value)}
              className="text-xs border border-surface-200 rounded-lg px-2 py-2 bg-white">
              <option value="">{t('attendance_eval.all_severities')}</option>
              <option value="Blocking">{t('attendance_eval.sev_blocking')}</option>
              <option value="Review">{t('attendance_eval.sev_review')}</option>
              <option value="Info">{t('attendance_eval.sev_info')}</option>
            </select>
            <label className="flex items-center gap-1.5 text-xs text-surface-600 cursor-pointer">
              <input type="checkbox" checked={onlyOpen} onChange={(e) => setOnlyOpen(e.target.checked)}
                className="rounded border-surface-300" />
              {t('attendance_eval.only_open')}
            </label>
            <span className="text-xs text-surface-400 ms-auto">{t('attendance_eval.n_cases', { count: exceptions.length })}</span>
          </div>

          {loading ? (
            <div className="space-y-2">{[1, 2, 3].map((i) => (
              <div key={i} className="card p-4 animate-pulse"><div className="h-3 bg-surface-200 rounded w-1/3" /></div>))}
            </div>
          ) : exceptions.length === 0 ? (
            <Card><EmptyState icon={<CheckCircle2 className="w-6 h-6 text-emerald-500" />}
              title={t('attendance_eval.no_cases')} description={t('attendance_eval.no_cases_desc')} /></Card>
          ) : (
            <div className="space-y-4">
              {['Blocking', 'Review', 'Info'].filter((s) => grouped[s].length).map((sev) => (
                <div key={sev}>
                  <p className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-2">
                    {t(`attendance_eval.sev_${sev.toLowerCase()}`)} · {grouped[sev].length}
                  </p>
                  <div className="space-y-1.5">
                    {grouped[sev].map((e) => (
                      <div key={e.id} className={`p-3 rounded-xl border ${SEVERITY_STYLE[e.severity]}`}>
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-sm">{e.employee_name}</span>
                              <span className="text-xs opacity-70">{e.work_date}</span>
                              <Badge variant="inactive" className="text-[10px]">{t(`attendance_eval.type_${e.type}`)}</Badge>
                              <Badge variant={STATUS_VARIANT[e.status] || 'info'} className="text-[10px]">
                                {t(`attendance_eval.status_${e.status.replace(/[ -]/g, '_')}`)}
                              </Badge>
                            </div>
                            <p className="text-xs mt-1 opacity-90">{e.detail}</p>
                            {(e.check_in || e.check_out) && (
                              <p className="text-[11px] mt-1 opacity-70">
                                {t('attendance_eval.punches')}: {e.check_in || '—'} → {e.check_out || '—'}
                                {e.expected_minutes != null && ` · ${t('attendance_eval.expected')} ${mins(e.expected_minutes)}`}
                                {e.worked_minutes != null && ` · ${t('attendance_eval.worked')} ${mins(e.worked_minutes)}`}
                              </p>
                            )}
                          </div>
                          {e.employee_status !== 'Active' && (
                            <Badge variant="warning" className="text-[10px] shrink-0">{e.employee_status}</Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Cases bunched on a few people usually mean a data gap, not a discipline problem. */}
          {summary?.top_people?.length > 0 && (
            <Card className="!p-0 overflow-hidden">
              <div className="px-4 py-2.5 bg-surface-50 flex items-center gap-2">
                <Users size={14} className="text-surface-400" />
                <span className="text-xs font-semibold text-surface-600">{t('attendance_eval.by_person')}</span>
              </div>
              <table className="w-full text-xs">
                <thead className="text-surface-400"><tr>
                  <th className="text-start px-4 py-2">{t('attendance_eval.th_employee')}</th>
                  <th className="px-4 py-2">{t('attendance_eval.th_cases')}</th>
                  <th className="px-4 py-2">{t('attendance_eval.th_absences')}</th>
                  <th className="text-start px-4 py-2">{t('attendance_eval.th_note')}</th>
                </tr></thead>
                <tbody>
                  {summary.top_people.map((p) => (
                    <tr key={p.employee_id} className="border-t border-surface-100">
                      <td className="px-4 py-2 font-medium text-surface-800">{p.name}</td>
                      <td className="px-4 py-2 text-center">{p.n}</td>
                      <td className="px-4 py-2 text-center">{p.absences}</td>
                      <td className="px-4 py-2 text-surface-500">
                        {p.employee_status !== 'Active' && !p.end_date
                          ? t('attendance_eval.offboarding_no_end_date', { status: p.employee_status })
                          : ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </>
      )}

      {/* ───────── comparison ───────── */}
      {tab === 'comparison' && (
        comparison.length === 0 ? (
          <Card><EmptyState icon={<Scale className="w-6 h-6 text-surface-400" />}
            title={t('attendance_eval.no_diffs')} description={t('attendance_eval.no_diffs_desc')} /></Card>
        ) : (
          <Card className="!p-0 overflow-x-auto">
            <table className="w-full text-xs min-w-[860px]">
              <thead className="bg-surface-50 text-surface-500"><tr>
                <th className="text-start p-3">{t('attendance_eval.th_date')}</th>
                <th className="text-start p-3">{t('attendance_eval.th_employee')}</th>
                <th className="text-start p-3">{t('attendance_eval.punches')}</th>
                <th className="text-start p-3">{t('attendance_eval.th_expected')}</th>
                <th className="text-start p-3">{t('attendance_eval.th_stored')}</th>
                <th className="text-start p-3">{t('attendance_eval.th_engine')}</th>
              </tr></thead>
              <tbody>
                {comparison.map((r) => (
                  <tr key={r.id} className="border-t border-surface-100">
                    <td className="p-3 whitespace-nowrap">{r.work_date}</td>
                    <td className="p-3">{r.employee_name}</td>
                    <td className="p-3 whitespace-nowrap text-surface-500">{r.check_in || '—'} → {r.check_out || '—'}</td>
                    <td className="p-3 whitespace-nowrap text-surface-500">
                      {r.expected_in ? `${r.expected_in}–${r.expected_out}` : '—'}
                      {r.schedule_name && <span className="block text-[10px] opacity-60">{r.schedule_name}</span>}
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      <span className="text-surface-600">{r.stored_status || '—'}</span>
                      {(r.stored_late || r.stored_early) && (
                        <span className="block text-[10px] opacity-70">
                          {t('attendance_eval.late')} {mins(r.stored_late)} · {t('attendance_eval.early')} {mins(r.stored_early)}
                        </span>
                      )}
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      <span className="font-semibold text-brand-700">{r.eval_status}</span>
                      {(r.eval_late_minutes != null || r.eval_early_leave_minutes != null) && (
                        <span className="block text-[10px] opacity-70">
                          {t('attendance_eval.late')} {mins(r.eval_late_minutes)} · {t('attendance_eval.early')} {mins(r.eval_early_leave_minutes)}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )
      )}

      {/* ───────── runs ───────── */}
      {tab === 'runs' && (
        runs.length === 0 ? (
          <Card><EmptyState icon={<History className="w-6 h-6 text-surface-400" />}
            title={t('attendance_eval.no_runs')} description={t('attendance_eval.no_runs_desc')} /></Card>
        ) : (
          <div className="space-y-2">
            {runs.map((r) => {
              const s = typeof r.summary === 'string' ? safeParse(r.summary) : r.summary;
              return (
                <Card key={r.id} className="!p-3.5">
                  <div className="flex items-center gap-2 flex-wrap text-xs">
                    <Badge variant={r.error ? 'danger' : 'success'} className="text-[10px]">
                      {r.error ? t('attendance_eval.run_failed') : t('attendance_eval.run_ok')}
                    </Badge>
                    <span className="font-medium text-surface-800">{r.date_from} → {r.date_to}</span>
                    <span className="text-surface-400">{r.trigger_type}</span>
                    {!!r.shadow && <Badge variant="info" className="text-[10px]">{t('attendance_eval.shadow')}</Badge>}
                    <span className="text-surface-400 ms-auto">{dayjs(r.started_at).format('DD MMM HH:mm')}</span>
                  </div>
                  <p className="text-[11px] text-surface-500 mt-1.5">
                    {t('attendance_eval.run_line', {
                      days: r.days_evaluated, rows: r.rows_updated,
                      opened: r.exceptions_opened, closed: r.exceptions_closed, differs: r.disagreements,
                    })}
                  </p>
                  {r.error && <p className="text-[11px] text-red-600 mt-1">{r.error}</p>}
                  {s?.days_not_observed?.length > 0 && (
                    <p className="text-[11px] text-amber-700 mt-1">
                      {t('attendance_eval.days_not_observed', { days: s.days_not_observed.join(', ') })}
                    </p>
                  )}
                  {s?.dormant_employees?.length > 0 && (
                    <p className="text-[11px] text-amber-700 mt-1">
                      {t('attendance_eval.dormant', { names: s.dormant_employees.map((e) => e.name).join(', ') })}
                    </p>
                  )}
                  {s?.untracked_employees?.length > 0 && (
                    <p className="text-[11px] text-amber-700 mt-1">
                      {t('attendance_eval.untracked', { names: s.untracked_employees.map((e) => e.name).join(', ') })}
                    </p>
                  )}
                </Card>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}

function Stat({ label, value, tone }) {
  const colour = tone === 'ok' ? 'text-emerald-600' : tone === 'warn' ? 'text-amber-600' : 'text-surface-900';
  return (
    <Card className="!p-3.5">
      <p className="text-[11px] text-surface-400 uppercase tracking-wider">{label}</p>
      <p className={`text-xl font-bold mt-0.5 ${colour}`}>{value}</p>
    </Card>
  );
}

function safeParse(s) {
  try { return JSON.parse(s); } catch { return null; }
}
