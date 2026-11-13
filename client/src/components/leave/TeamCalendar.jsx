import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import dayjs from 'dayjs';
import Card from '@components/ui/Card';
import * as leaveApi from '@api/leaveApi';

/**
 * A month of leave: people down the side, days across. Approved leave is a
 * solid block in the type's colour, pending leave a faded one; public holidays
 * are shaded. HR sees everyone in the selected Entity, a manager their team.
 */
export default function TeamCalendar({ t }) {
  const [month, setMonth] = useState(dayjs().format('YYYY-MM'));
  const [state, setState] = useState({ month: null, data: null });

  useEffect(() => {
    let off = false;
    leaveApi.getCalendar(month)
      .then(({ data }) => { if (!off) setState({ month, data }); })
      .catch(() => { if (!off) setState({ month, data: { employees: [], leaves: [], holidays: [] } }); });
    return () => { off = true; };
  }, [month]);

  const days = useMemo(() => {
    const first = dayjs(`${month}-01`);
    return Array.from({ length: first.daysInMonth() }, (_, i) => first.add(i, 'day'));
  }, [month]);
  const d = state.month === month ? state.data : null;
  const holidays = new Map((d?.holidays || []).map((h) => [h.holiday_date, h]));
  const byEmp = new Map();
  for (const l of d?.leaves || []) {
    if (!byEmp.has(l.employee_id)) byEmp.set(l.employee_id, []);
    byEmp.get(l.employee_id).push(l);
  }
  const shift = (k) => setMonth(dayjs(`${month}-01`).add(k, 'month').format('YYYY-MM'));
  const rows = (d?.employees || []).filter((e) => byEmp.has(e.id));

  return (
    <Card className="!p-0 overflow-hidden">
      <div className="flex items-center gap-2 p-3 border-b border-surface-100">
        <button type="button" onClick={() => shift(-1)} className="p-1.5 rounded-lg hover:bg-surface-100" aria-label={t('leave_x.prev_month')}><ChevronLeft size={16} className="rtl:rotate-180" /></button>
        <span className="font-semibold text-surface-800 min-w-[120px] text-center">{dayjs(`${month}-01`).format('MMMM YYYY')}</span>
        <button type="button" onClick={() => shift(1)} className="p-1.5 rounded-lg hover:bg-surface-100" aria-label={t('leave_x.next_month')}><ChevronRight size={16} className="rtl:rotate-180" /></button>
        <span className="ms-auto text-xs text-surface-500">{t('leave_x.cal_people_off', { n: rows.length, total: d?.employees?.length || 0 })}</span>
      </div>
      {!d ? (
        <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 text-brand-600 animate-spin" /></div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-surface-500 text-center py-8">{t('leave_x.cal_empty')}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="text-[11px] border-collapse">
            <thead>
              <tr>
                <th className="sticky start-0 bg-white z-10 text-start px-3 py-2 font-semibold text-surface-500 min-w-[160px]">{t('leave_x.cal_person')}</th>
                {days.map((day) => {
                  const h = holidays.get(day.format('YYYY-MM-DD'));
                  return (
                    <th key={day.date()} title={h?.name_en || undefined}
                      className={`w-7 min-w-[28px] py-2 font-medium ${h ? 'bg-rose-50 text-rose-700' : 'text-surface-400'}`}>
                      {day.date()}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => (
                <tr key={e.id} className="border-t border-surface-50">
                  <td className="sticky start-0 bg-white z-10 px-3 py-1.5 whitespace-nowrap">
                    <span className="text-surface-800">{e.name}</span>
                    {e.department && <span className="block text-[10px] text-surface-400">{e.department}</span>}
                  </td>
                  {days.map((day) => {
                    const ds = day.format('YYYY-MM-DD');
                    const l = byEmp.get(e.id).find((x) => x.start_date <= ds && x.end_date >= ds);
                    const h = holidays.get(ds);
                    return (
                      <td key={ds} className={`p-0.5 ${h ? 'bg-rose-50/60' : ''}`}>
                        {l && (
                          <div title={`${l.leave_type_name} · ${l.start_date} → ${l.end_date}${l.status === 'Pending' ? ` (${t('leave_x.pending')})` : ''}`}
                            className="h-5 rounded" style={{ background: l.color || '#7c3aed', opacity: l.status === 'Pending' ? 0.4 : 0.9 }} />
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-[11px] text-surface-400 px-3 py-2">{t('leave_x.cal_legend')}</p>
        </div>
      )}
    </Card>
  );
}
