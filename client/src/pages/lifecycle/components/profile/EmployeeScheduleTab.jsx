import { useState, useEffect } from 'react';
import { CalendarClock, AlertTriangle, Trash2 } from 'lucide-react';
import { toast } from 'react-toastify';
import dayjs from 'dayjs';
import Button from '@components/ui/Button';
import Badge from '@components/ui/Badge';
import { confirmDelete } from '@utils/confirm';
import * as wsApi from '@api/workSchedulesApi';

/**
 * Which shift this employee works, and the history of that.
 *
 * Reference data only — nothing here changes a recorded attendance day. The
 * assignment is effective-dated, so moving somebody onto a new shift today does
 * not re-interpret the days they already worked.
 */
export default function EmployeeScheduleTab({ employee, t, canEdit }) {
  const [data, setData] = useState(null);
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ schedule_id: '', effective_from: dayjs().format('YYYY-MM-DD'), note: '' });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [{ data: a }, { data: s }] = await Promise.all([
        wsApi.getAssignments(employee.id),
        wsApi.getSchedules({ company_id: employee.company_id }),
      ]);
      setData(a);
      setSchedules(s.filter((x) => x.active !== false));
      setForm((p) => ({ ...p, schedule_id: p.schedule_id || (a.effective ? String(a.effective.schedule_id) : (s[0] ? String(s[0].id) : '')) }));
    } catch { setData(null); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [employee.id]);

  const assign = async (e) => {
    e.preventDefault();
    if (!form.schedule_id) { toast.error(t('toasts.t_choose_a_schedule')); return; }
    setSaving(true);
    try {
      await wsApi.assignSchedule({
        employee_id: employee.id,
        schedule_id: Number(form.schedule_id),
        effective_from: form.effective_from,
        note: form.note || null,
      });
      toast.success(t('toasts.t_schedule_assigned'));
      setForm((p) => ({ ...p, note: '' }));
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || t('toasts.t_operation_failed'));
    } finally { setSaving(false); }
  };

  const remove = async (row) => {
    const result = await confirmDelete(`${row.name_en} — ${row.effective_from}`);
    if (!result.isConfirmed) return;
    try {
      await wsApi.removeAssignment(row.id);
      toast.success(t('toasts.t_assignment_removed'));
      load();
    } catch (err) { toast.error(err.response?.data?.error || t('toasts.t_operation_failed')); }
  };

  if (loading) return <div className="card p-4 animate-pulse"><div className="h-3 bg-surface-200 rounded w-1/3" /></div>;
  if (!data) return <p className="text-xs text-surface-400">{t('common.failed_load')}</p>;

  const eff = data.effective;
  const day = eff?.today;

  return (
    <div className="space-y-4">
      {/* What today is judged against */}
      <div className="p-3.5 rounded-xl border border-surface-200 bg-surface-50">
        <div className="flex items-center gap-2 mb-1.5">
          <CalendarClock size={15} className="text-brand-600" />
          <span className="text-xs font-semibold text-surface-700">{t('employees.current_schedule')}</span>
        </div>
        {!eff ? (
          <div className="flex items-start gap-2">
            <AlertTriangle size={14} className="text-amber-600 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-800">{t('employees.no_schedule_resolved')}</p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-surface-900 text-sm">{eff.name_en}</span>
              <Badge variant={eff.source === 'assignment' ? 'success' : 'info'} className="text-[10px]">
                {t(eff.source === 'assignment' ? 'employees.sched_assigned' : 'employees.sched_company_default')}
              </Badge>
            </div>
            <p className="text-xs text-surface-500 mt-1">
              {day?.is_working
                ? t('employees.sched_today_working', {
                    start: String(day.start_time || '').slice(0, 5),
                    end: String(day.end_time || '').slice(0, 5),
                    hours: (day.expected_minutes / 60).toFixed(day.expected_minutes % 60 ? 1 : 0),
                  })
                : t('employees.sched_today_off')}
            </p>
          </>
        )}
      </div>

      {/* Assign */}
      {canEdit && (
        <form onSubmit={assign} className="p-3.5 rounded-xl border border-surface-200 space-y-3">
          <p className="text-xs font-semibold text-surface-700">{t('employees.assign_schedule')}</p>
          {schedules.length === 0 ? (
            <p className="text-xs text-surface-400">{t('employees.no_schedules_for_company')}</p>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <select value={form.schedule_id} onChange={(e) => setForm((p) => ({ ...p, schedule_id: e.target.value }))}
                  className="text-xs border border-surface-200 rounded-lg px-2 py-2 bg-white">
                  {schedules.map((s) => <option key={s.id} value={s.id}>{s.name_en}</option>)}
                </select>
                <input type="date" value={form.effective_from}
                  onChange={(e) => setForm((p) => ({ ...p, effective_from: e.target.value }))}
                  className="text-xs border border-surface-200 rounded-lg px-2 py-2" />
                <input type="text" placeholder={t('work_schedules.note')} value={form.note}
                  onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))}
                  className="text-xs border border-surface-200 rounded-lg px-2 py-2" />
              </div>
              <div className="flex items-center justify-between gap-3">
                <p className="text-[11px] text-surface-400">{t('work_schedules.effective_hint')}</p>
                <Button size="sm" type="submit" loading={saving}>{t('work_schedules.assign')}</Button>
              </div>
            </>
          )}
        </form>
      )}

      {/* History */}
      <div>
        <p className="text-xs font-semibold text-surface-700 mb-2">{t('employees.schedule_history')}</p>
        {data.history.length === 0 ? (
          <p className="text-xs text-surface-400">{t('employees.no_schedule_history')}</p>
        ) : (
          <div className="space-y-1.5">
            {data.history.map((h) => (
              <div key={h.id} className="flex items-center gap-2 p-2.5 rounded-lg border border-surface-100 text-xs group">
                <span className="font-medium text-surface-800">{h.name_en}</span>
                <span className="text-surface-400">
                  {h.effective_from} → {h.effective_to || t('employees.sched_ongoing')}
                </span>
                {h.note && <span className="text-surface-400 italic truncate">“{h.note}”</span>}
                {h.assigned_by_name && <span className="text-surface-300 ms-auto">{h.assigned_by_name}</span>}
                {canEdit && (
                  <Button variant="ghost" size="icon" onClick={() => remove(h)}
                    className="text-red-500 hover:!bg-red-50 opacity-0 group-hover:opacity-100" title={t('common.delete')}>
                    <Trash2 size={12} />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
