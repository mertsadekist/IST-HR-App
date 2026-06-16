import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import * as reportsApi from '@api/reportsApi';
import Card from '@components/ui/Card';
import Button from '@components/ui/Button';
import Badge from '@components/ui/Badge';
import Select from '@components/ui/Select';
import { toast } from 'react-toastify';
import { BarChart3, Users, Clock, UserCheck, RefreshCw, TrendingUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';

export default function Reports() {
  const { t } = useTranslation();
  const { currentCompanyId } = useSelector((s) => s.entity);
  const [tab, setTab] = useState('pipeline');
  const [loading, setLoading] = useState(true);
  const [pipelineData, setPipelineData] = useState([]);
  const [journeyData, setJourneyData] = useState([]);
  const [employeeData, setEmployeeData] = useState(null);
  const [onboardingData, setOnboardingData] = useState(null);

  useEffect(() => { loadReport(); }, [tab, currentCompanyId]);

  const loadReport = async () => {
    setLoading(true);
    const params = currentCompanyId ? { company_id: currentCompanyId } : {};
    try {
      switch (tab) {
        case 'pipeline': { const { data } = await reportsApi.getPipelineReport(params); setPipelineData(data); break; }
        case 'journey': { const { data } = await reportsApi.getJourneyReport(params); setJourneyData(data); break; }
        case 'employees': { const { data } = await reportsApi.getEmployeesReport(params); setEmployeeData(data); break; }
        case 'onboarding': { const { data } = await reportsApi.getOnboardingReport(params); setOnboardingData(data); break; }
      }
    } catch { toast.error('Failed to load report'); }
    finally { setLoading(false); }
  };

  const tabs = [
    { key: 'pipeline', label: t('reports.pipeline'), icon: BarChart3 },
    { key: 'journey', label: t('reports.journey'), icon: Clock },
    { key: 'employees', label: t('reports.employees'), icon: Users },
    { key: 'onboarding', label: t('reports.onboarding'), icon: UserCheck },
  ];

  const maxPipeline = Math.max(...pipelineData.map(p => p.count), 1);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-surface-900">{t('reports.title')}</h1>
          <p className="text-surface-500 mt-0.5 text-sm">{t('reports.subtitle')}</p></div>
        <Button variant="secondary" onClick={loadReport}><RefreshCw size={14} /> {t('reports.refresh')}</Button>
      </div>

      <div className="flex gap-1 bg-surface-50 p-1 rounded-xl w-fit">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium transition-all ${tab === t.key ? 'bg-brand-700 text-white shadow-sm' : 'text-surface-600 hover:bg-surface-100'}`}>
            <t.icon size={14} /> {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <Card className="!p-6 animate-pulse"><div className="h-6 bg-surface-200 rounded w-1/3 mb-4" /><div className="h-4 bg-surface-100 rounded w-1/2 mb-2" /><div className="h-4 bg-surface-100 rounded w-2/3" /></Card>
      ) : (
        <>
          {/* Pipeline Report */}
          {tab === 'pipeline' && (
            <Card className="!p-6">
              <h2 className="font-semibold text-surface-800 mb-4">{t('reports.pipeline_distribution')}</h2>
              {pipelineData.length === 0 ? <p className="text-sm text-surface-400">{t('reports.no_pipeline_data')}</p> : (
                <div className="space-y-3">
                  {pipelineData.map((p, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <span className="w-36 text-xs font-medium text-surface-600 truncate">{p.stage_name}</span>
                      <div className="flex-1 bg-surface-100 rounded-full h-6 overflow-hidden">
                        <div className="h-full rounded-full flex items-center px-2 text-[10px] font-bold text-white transition-all duration-500"
                          style={{ width: `${Math.max((p.count / maxPipeline) * 100, p.count > 0 ? 8 : 0)}%`, backgroundColor: p.color || '#6D28D9' }}>
                          {p.count > 0 && p.count}
                        </div>
                      </div>
                      <span className="w-8 text-xs text-surface-500 text-right">{p.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}

          {/* Journey Report */}
          {tab === 'journey' && (
            <Card className="!p-0 overflow-hidden">
              <div className="px-5 py-3 border-b border-surface-100"><h2 className="font-semibold text-surface-800">{t('reports.candidate_journey')}</h2></div>
              {journeyData.length === 0 ? <p className="text-sm text-surface-400 p-6 text-center">{t('reports.no_candidates')}</p> : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b border-surface-100 bg-surface-50/60">
                      <th className="text-left px-5 py-3 font-medium text-surface-500">{t('reports.candidate')}</th>
                      <th className="text-left px-5 py-3 font-medium text-surface-500">{t('reports.vacancy')}</th>
                      <th className="text-left px-5 py-3 font-medium text-surface-500">{t('reports.current_stage')}</th>
                      <th className="text-left px-5 py-3 font-medium text-surface-500">{t('reports.applied')}</th>
                      <th className="text-left px-5 py-3 font-medium text-surface-500">{t('reports.days')}</th>
                      <th className="text-left px-5 py-3 font-medium text-surface-500">{t('reports.hired')}</th>
                    </tr></thead>
                    <tbody>
                      {journeyData.map((j, i) => (
                        <tr key={i} className="border-b border-surface-50 hover:bg-surface-50/50">
                          <td className="px-5 py-3 font-medium text-surface-800">{j.candidate_name} <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-100 text-surface-500 ml-1">{j.short_code}</span></td>
                          <td className="px-5 py-3 text-surface-600 text-xs">{j.vacancy_title || '—'}</td>
                          <td className="px-5 py-3"><Badge variant="info" className="text-[10px]">{j.current_stage || '—'}</Badge></td>
                          <td className="px-5 py-3 text-xs text-surface-400">{dayjs(j.applied_at).format('MMM D, YYYY')}</td>
                          <td className="px-5 py-3"><span className={`text-xs font-bold ${j.days_in_pipeline > 30 ? 'text-red-500' : j.days_in_pipeline > 14 ? 'text-amber-500' : 'text-emerald-500'}`}>{j.days_in_pipeline}d</span></td>
                          <td className="px-5 py-3 text-xs text-surface-400">{j.hired_at ? dayjs(j.hired_at).format('MMM D') : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          )}

          {/* Employees Report */}
          {tab === 'employees' && employeeData && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card className="!p-5">
                <h3 className="font-semibold text-surface-800 mb-3">{t('reports.by_status')}</h3>
                <div className="space-y-2">
                  {employeeData.byStatus.map((s, i) => (
                    <div key={i} className="flex items-center justify-between py-1.5 px-3 bg-surface-50 rounded-lg">
                      <span className="text-sm text-surface-600">{s.status}</span>
                      <span className="text-sm font-bold text-surface-800">{s.count}</span>
                    </div>
                  ))}
                  {employeeData.byStatus.length === 0 && <p className="text-sm text-surface-400">{t('reports.no_employees')}</p>}
                </div>
              </Card>
              <Card className="!p-5">
                <h3 className="font-semibold text-surface-800 mb-3">{t('reports.by_company')}</h3>
                <div className="space-y-2">
                  {employeeData.byCompany.map((c, i) => (
                    <div key={i} className="flex items-center justify-between py-1.5 px-3 bg-surface-50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-medium text-white" style={{ backgroundColor: c.color_primary || '#6D28D9' }}>{c.short_code}</span>
                        <span className="text-sm text-surface-600">{c.name}</span>
                      </div>
                      <span className="text-sm font-bold text-surface-800">{c.count}</span>
                    </div>
                  ))}
                </div>
              </Card>
              <Card className="!p-5">
                <h3 className="font-semibold text-surface-800 mb-3">{t('reports.by_department')}</h3>
                <div className="space-y-2">
                  {employeeData.byDepartment.slice(0, 10).map((d, i) => (
                    <div key={i} className="flex items-center justify-between py-1.5 px-3 bg-surface-50 rounded-lg">
                      <span className="text-sm text-surface-600">{d.department} <span className="text-[10px] text-surface-400">({d.short_code})</span></span>
                      <span className="text-sm font-bold text-surface-800">{d.count}</span>
                    </div>
                  ))}
                  {employeeData.byDepartment.length === 0 && <p className="text-sm text-surface-400">{t('reports.no_data')}</p>}
                </div>
              </Card>
              <Card className="!p-5">
                <h3 className="font-semibold text-surface-800 mb-3">{t('reports.recent_hires')}</h3>
                <div className="space-y-2">
                  {employeeData.recentHires.map((h, i) => (
                    <div key={i} className="flex items-center justify-between py-1.5 px-3 bg-surface-50 rounded-lg">
                      <div>
                        <span className="text-sm font-medium text-surface-700">{h.first_name} {h.last_name}</span>
                        <p className="text-[10px] text-surface-400">{h.job_title} · {h.department}</p>
                      </div>
                      <div className="text-right">
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-medium text-white" style={{ backgroundColor: h.color_primary || '#6D28D9' }}>{h.short_code}</span>
                        <p className="text-[10px] text-surface-400 mt-0.5">{h.start_date ? dayjs(h.start_date).format('MMM D') : '—'}</p>
                      </div>
                    </div>
                  ))}
                  {employeeData.recentHires.length === 0 && <p className="text-sm text-surface-400">{t('reports.no_hires')}</p>}
                </div>
              </Card>
            </div>
          )}

          {/* Onboarding Report */}
          {tab === 'onboarding' && onboardingData && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: t('reports.total'), value: onboardingData.summary?.total || 0, icon: Users },
                  { label: t('reports.in_progress'), value: onboardingData.summary?.in_progress || 0, icon: Clock },
                  { label: t('reports.completed'), value: onboardingData.summary?.completed || 0, icon: UserCheck },
                  { label: t('reports.avg_days'), value: onboardingData.summary?.avg_days ? `${Math.round(onboardingData.summary.avg_days)}d` : '—', icon: TrendingUp },
                ].map((s, i) => (
                  <Card key={i} className="!p-4 text-center">
                    <s.icon size={20} className="mx-auto text-brand-500 mb-1" />
                    <p className="text-2xl font-bold text-surface-800">{s.value}</p>
                    <p className="text-[10px] text-surface-400 uppercase">{s.label}</p>
                  </Card>
                ))}
              </div>
              <Card className="!p-0 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b border-surface-100 bg-surface-50/60">
                      <th className="text-left px-5 py-3 font-medium text-surface-500">{t('reports.employee')}</th>
                      <th className="text-left px-5 py-3 font-medium text-surface-500">{t('reports.status')}</th>
                      <th className="text-left px-5 py-3 font-medium text-surface-500">{t('reports.progress')}</th>
                      <th className="text-left px-5 py-3 font-medium text-surface-500">{t('reports.duration')}</th>
                      <th className="text-left px-5 py-3 font-medium text-surface-500">{t('reports.started')}</th>
                    </tr></thead>
                    <tbody>
                      {(onboardingData.records || []).map(r => (
                        <tr key={r.id} className="border-b border-surface-50 hover:bg-surface-50/50">
                          <td className="px-5 py-3 font-medium text-surface-800">
                            {r.first_name} {r.last_name}
                            <span className="ml-1.5 px-1.5 py-0.5 rounded text-[9px] font-medium text-white" style={{ backgroundColor: r.color_primary || '#6D28D9' }}>{r.short_code}</span>
                          </td>
                          <td className="px-5 py-3"><Badge variant={r.status === 'Completed' ? 'success' : 'warning'} className="text-[10px]">{r.status}</Badge></td>
                          <td className="px-5 py-3"><div className="flex items-center gap-2 w-28">
                            <div className="flex-1 bg-surface-100 rounded-full h-2"><div className="bg-brand-gradient h-2 rounded-full" style={{ width: `${r.progress}%` }} /></div>
                            <span className="text-[10px] font-medium text-surface-500">{r.progress}%</span>
                          </div></td>
                          <td className="px-5 py-3 text-xs text-surface-500">{r.duration_days}d</td>
                          <td className="px-5 py-3 text-xs text-surface-400">{dayjs(r.started_at).format('MMM D, YYYY')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {(!onboardingData.records || onboardingData.records.length === 0) && <p className="text-sm text-surface-400 p-6 text-center">{t('reports.no_data')}</p>}
              </Card>
            </div>
          )}
        </>
      )}
    </div>
  );
}
