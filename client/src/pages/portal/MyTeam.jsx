import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Users, Loader2, CalendarDays } from 'lucide-react';
import Card from '@components/ui/Card';
import Badge from '@components/ui/Badge';
import EmptyState from '@components/ui/EmptyState';
import PortalShell from './PortalShell';
import * as portalApi from '@api/portalApi';
import TeamCalendar from '@components/leave/TeamCalendar';

const todayVariant = { present: 'success', late: 'warning', absent: 'danger', leave: 'info', none: 'inactive' };

/**
 * For anyone who manages people: who is in today, who is away, and the month so
 * far — for their direct reports and everyone below them. Attendance and leave
 * only; pay, documents and bank details are never shown here.
 */
export default function MyTeam() {
  const { t } = useTranslation();
  const [state, setState] = useState({ loaded: false, team: [] });

  useEffect(() => {
    let off = false;
    portalApi.getMyTeam()
      .then(({ data }) => { if (!off) setState({ loaded: true, team: data.team || [] }); })
      .catch(() => { if (!off) setState({ loaded: true, team: [] }); });
    return () => { off = true; };
  }, []);

  const team = state.team;
  const stats = useMemo(() => ({
    size: team.length,
    in: team.filter((m) => ['present', 'late'].includes(m.today.state)).length,
    away: team.filter((m) => m.today.state === 'leave').length,
    pending: team.reduce((s, m) => s + m.leave.filter((l) => l.status === 'Pending').length, 0),
  }), [team]);

  const todayText = (m) => {
    if (!m.attendance_tracked) return t('team.not_tracked');
    switch (m.today.state) {
      case 'present': return t('team.in_at', { time: m.today.check_in || '' });
      case 'late': return t('team.late_at', { time: m.today.check_in || '' });
      case 'absent': return t('team.absent');
      case 'leave': return t('team.on_leave', { type: m.today.leave_type });
      default: return t('team.no_punch');
    }
  };

  return (
    <PortalShell icon={Users} title={t('team.title')} subtitle={t('team.subtitle')}
      stats={[
        { value: stats.size, label: t('team.stat_size') },
        { value: stats.in, label: t('team.stat_in') },
        { value: stats.away, label: t('team.stat_away') },
        { value: stats.pending, label: t('team.stat_pending') },
      ]}>
      {!state.loaded ? (
        <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 text-brand-600 animate-spin" /></div>
      ) : team.length === 0 ? (
        <Card><EmptyState icon={<Users className="w-6 h-6 text-surface-400" />} title={t('team.empty')} description={t('team.empty_desc')} /></Card>
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {team.map((m) => (
            <Card key={m.id} className="!p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-surface-900 truncate">{m.name}</p>
                  <p className="text-xs text-surface-500 truncate">{[m.job_title, m.department_name].filter(Boolean).join(' · ')}</p>
                  {!m.direct && <p className="text-[11px] text-surface-400">{t('team.via', { name: m.manager_name })}</p>}
                </div>
                <Badge variant={m.attendance_tracked ? todayVariant[m.today.state] : 'inactive'} className="text-[10px] shrink-0">{todayText(m)}</Badge>
              </div>
              {m.attendance_tracked && (
                <div className="grid grid-cols-3 gap-2 text-center">
                  {[['present', t('team.m_present'), 'text-emerald-700'], ['late', t('team.m_late'), 'text-amber-700'], ['absent', t('team.m_absent'), 'text-red-600']].map(([k, label, tone]) => (
                    <div key={k} className="bg-surface-50 rounded-lg py-1.5">
                      <p className={`text-lg font-bold ${tone}`}>{m.month[k]}</p>
                      <p className="text-[10px] text-surface-500">{label}</p>
                    </div>
                  ))}
                </div>
              )}
              {m.leave.length > 0 && (
                <ul className="space-y-1 text-xs">
                  {m.leave.map((l, i) => (
                    <li key={i} className="flex items-center gap-1.5 text-surface-600">
                      <CalendarDays size={12} className="shrink-0 text-surface-400" />
                      <span className="truncate">{l.leave_type}: {l.start_date}{l.end_date !== l.start_date ? ` → ${l.end_date}` : ''}</span>
                      <Badge variant={l.status === 'Pending' ? 'pending' : 'success'} className="text-[9px] ms-auto">
                        {l.status === 'Pending' ? t('team.pending') : t('team.approved')}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          ))}
        </div>
      )}
      {/* Who is off when, this month and the next ones. */}
      <TeamCalendar t={t} />
      <p className="text-[11px] text-surface-400">{t('team.privacy_note')}</p>
    </PortalShell>
  );
}
