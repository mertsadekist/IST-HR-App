import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import * as dashboardApi from '@api/dashboardApi';
import Card from '@components/ui/Card';
import Badge from '@components/ui/Badge';
import { PageTransition, AnimatedCard, StaggerContainer, StaggerItem } from '@components/ui/Motion';
import { useTranslation } from 'react-i18next';
import { LayoutDashboard, Users, FileText, UserCheck, TrendingUp, Sparkles, Clock, BarChart3 } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
dayjs.extend(relativeTime);

export default function Dashboard() {
  const { t } = useTranslation();
  const { user } = useSelector((state) => state.auth);
  const { currentCompanyId } = useSelector((state) => state.entity);
  const { items: companies } = useSelector((state) => state.companies);

  const [stats, setStats] = useState({ candidates: 0, vacancies: 0, employees: 0, monthHires: 0 });
  const [pipeline, setPipeline] = useState([]);
  const [activity, setActivity] = useState([]);
  const [hiresData, setHiresData] = useState([]);
  const [loading, setLoading] = useState(true);

  const currentCompany = companies.find(c => c.id === currentCompanyId);

  useEffect(() => {
    loadDashboard();
  }, [currentCompanyId]);

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const params = currentCompanyId ? { company_id: currentCompanyId } : {};
      const [statsRes, pipeRes, actRes, hiresRes] = await Promise.all([
        dashboardApi.getStats(params),
        dashboardApi.getPipeline(params),
        dashboardApi.getRecentActivity({ limit: 8 }),
        dashboardApi.getHiresByMonth({ months: 6 }),
      ]);
      setStats(statsRes.data);
      setPipeline(pipeRes.data);
      setActivity(actRes.data);
      setHiresData((hiresRes.data || []).map(r => ({
        ...r,
        label: dayjs(r.month + '-01').format('MMM'),
      })));
    } catch (err) {
      console.error('Dashboard load error:', err);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    { icon: Users, label: t('dashboard.total_candidates'), value: stats.candidates, color: 'text-blue-600', bg: 'bg-blue-50', ring: 'ring-blue-100' },
    { icon: FileText, label: t('dashboard.open_vacancies'), value: stats.vacancies, color: 'text-brand-600', bg: 'bg-brand-50', ring: 'ring-brand-100' },
    { icon: UserCheck, label: t('dashboard.active_employees'), value: stats.employees, color: 'text-emerald-600', bg: 'bg-emerald-50', ring: 'ring-emerald-100' },
    { icon: TrendingUp, label: t('dashboard.this_month_hires'), value: stats.monthHires, color: 'text-amber-600', bg: 'bg-amber-50', ring: 'ring-amber-100' },
  ];

  const totalInPipeline = pipeline.reduce((sum, s) => sum + s.candidate_count, 0);

  return (
    <PageTransition className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-surface-900">{t('dashboard.title')}</h1>
          <p className="text-surface-500 mt-0.5">
            {t('common.welcome_back', { name: user?.name })}
            {currentCompany && (
              <Badge variant="brand" className="mx-2">{currentCompany.short_code}</Badge>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="success" dot>{t('common.system_online')}</Badge>
        </div>
      </div>

      {/* Stat cards */}
      <StaggerContainer className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <StaggerItem key={i}>
              <Card hover className="!p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-medium text-surface-500 uppercase tracking-wide">{stat.label}</p>
                    <p className={`text-3xl font-bold text-surface-900 mt-1 ${loading ? 'animate-pulse' : ''}`}>
                      {loading ? '—' : stat.value.toLocaleString()}
                    </p>
                  </div>
                  <div className={`p-2.5 rounded-xl ${stat.bg} ring-1 ${stat.ring}`}>
                    <Icon size={20} className={stat.color} />
                  </div>
                </div>
              </Card>
            </StaggerItem>
          );
        })}
      </StaggerContainer>

      {/* AI Feature Banner */}
      <Card className="!p-0 overflow-hidden">
        <div className="bg-brand-gradient p-6 flex items-center gap-4">
          <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-sm">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-white">{t('dashboard.ai_feature_title')}</h3>
            <p className="text-brand-200 text-sm mt-0.5">
              {t('dashboard.ai_feature_desc')}
            </p>
          </div>
          <Badge variant="success" className="!bg-emerald-400/20 !text-emerald-200">{t('dashboard.connected')}</Badge>
        </div>
      </Card>

      {/* Pipeline + Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pipeline Funnel */}
        <Card>
          <Card.Header>
            <Card.Title>{t('dashboard.pipeline_title')}</Card.Title>
            {totalInPipeline > 0 && <Badge variant="brand">{t('dashboard.active_count', { count: totalInPipeline })}</Badge>}
          </Card.Header>
          {loading ? (
            <div className="space-y-2 animate-pulse">
              {[1, 2, 3, 4].map(i => <div key={i} className="h-8 bg-surface-100 rounded-xl" />)}
            </div>
          ) : pipeline.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-surface-400">{t('dashboard.no_pipeline')}</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {pipeline.filter(s => s.candidate_count > 0 || true).slice(0, 8).map((stage) => {
                const max = Math.max(...pipeline.map(s => s.candidate_count), 1);
                const pct = totalInPipeline > 0 ? (stage.candidate_count / max) * 100 : 0;
                return (
                  <div key={stage.id} className="flex items-center gap-3 group">
                    <div className="w-32 text-xs font-medium text-surface-600 truncate">{stage.name}</div>
                    <div className="flex-1 bg-surface-100 rounded-full h-6 overflow-hidden">
                      <div
                        className="h-full rounded-full flex items-center px-2 transition-all duration-500"
                        style={{ width: `${Math.max(pct, stage.candidate_count > 0 ? 12 : 0)}%`, backgroundColor: stage.color }}
                      >
                        {stage.candidate_count > 0 && (
                          <span className="text-[10px] font-bold" style={{ color: stage.text_color }}>{stage.candidate_count}</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Hires/Month Chart */}
        <Card>
          <Card.Header>
            <Card.Title>{t('dashboard.hires_trend')}</Card.Title>
            <Badge variant="info">{hiresData.length} months</Badge>
          </Card.Header>
          {loading ? (
            <div className="h-48 bg-surface-50 rounded-xl animate-pulse" />
          ) : hiresData.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <BarChart3 className="w-8 h-8 text-surface-300 mb-2" />
              <p className="text-sm text-surface-400">{t('dashboard.no_activity')}</p>
            </div>
          ) : (
            <div className="h-48 -mx-2">
              <ResponsiveContainer width="100%" height={192} minWidth={0}>
                <AreaChart data={hiresData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="hiresGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#7C3AED" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#7C3AED" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f1f4" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb', fontSize: 12 }}
                    formatter={(value) => [value, t('dashboard.hires', 'Hires')]}
                  />
                  <Area type="monotone" dataKey="count" stroke="#7C3AED" strokeWidth={2.5}
                    fill="url(#hiresGradient)" dot={{ r: 4, fill: '#7C3AED', strokeWidth: 2, stroke: '#fff' }}
                    activeDot={{ r: 6 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <Card.Header>
          <Card.Title>{t('dashboard.recent_activity')}</Card.Title>
        </Card.Header>
        {loading ? (
          <div className="space-y-3 animate-pulse">
            {[1, 2, 3].map(i => <div key={i} className="flex gap-3"><div className="w-8 h-8 bg-surface-200 rounded-full" /><div className="flex-1"><div className="h-3 bg-surface-200 rounded w-2/3 mb-1" /><div className="h-3 bg-surface-100 rounded w-1/3" /></div></div>)}
          </div>
        ) : activity.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="w-12 h-12 bg-surface-100 rounded-2xl flex items-center justify-center mb-3">
              <LayoutDashboard className="w-6 h-6 text-surface-400" />
            </div>
            <p className="text-sm text-surface-500">{t('dashboard.no_activity')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
            {activity.map((log) => (
              <div key={log.id} className="flex items-start gap-3 group">
                <div className="w-7 h-7 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 font-semibold text-[10px] mt-0.5 shrink-0">
                  {log.user_name?.charAt(0)?.toUpperCase() || '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-surface-700">
                    <span className="font-medium">{log.user_name}</span>
                    <span className="text-surface-400"> · {log.action}</span>
                  </p>
                  {log.detail && <p className="text-xs text-surface-400 truncate">{log.detail}</p>}
                </div>
                <span className="text-[10px] text-surface-400 whitespace-nowrap flex items-center gap-1">
                  <Clock size={10} />
                  {dayjs(log.created_at).fromNow()}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </PageTransition>
  );
}
