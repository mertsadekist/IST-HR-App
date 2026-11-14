import { useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import dayjs from 'dayjs';
import { CalendarRange, ChevronLeft, ChevronRight, Loader2, Moon, Save, Undo2 } from 'lucide-react';
import Card from '@components/ui/Card';
import Button from '@components/ui/Button';
import * as attendanceApi from '@api/attendanceApi';

const PALETTE = ['#2563EB', '#16A34A', '#D97706', '#9333EA', '#0891B2', '#DB2777', '#65A30D', '#EA580C'];
const ATT_TONE = {
  Present: 'bg-emerald-100 text-emerald-800', Remote: 'bg-emerald-100 text-emerald-800', Late: 'bg-amber-100 text-amber-800',
  'Half Day': 'bg-amber-100 text-amber-800', Absent: 'bg-red-100 text-red-700', 'On Leave': 'bg-violet-100 text-violet-800',
  Holiday: 'bg-rose-50 text-rose-700',
};
const attKey = (s) => String(s || '').toLowerCase().replace(/\s+/g, '_');

/**
 * The month per person and day. *Attendance* shows what happened (present,
 * late, absent, leave, holiday). *Shifts* shows what each day is planned as —
 * the weekly schedule, or a shift or day off set for that date — and lets HR
 * paint shifts on: pick a shift, click or drag across days, save.
 */
export default function Roster() {
  const { t } = useTranslation();
  const { user } = useSelector((s) => s.auth);
  const { currentCompanyId } = useSelector((s) => s.entity);
  const canEdit = ['admin', 'hr_manager'].includes(user?.role);
  const [month, setMonth] = useState(dayjs().format('YYYY-MM'));
  const [mode, setMode] = useState('attendance');
  const [reload, setReload] = useState(0);
  const key = `${currentCompanyId ?? 'all'}:${month}:${reload}`;
  const [state, setState] = useState({ key: null, data: null });
  const [brush, setBrush] = useState(null); // { value: id|'off'|null }
  const [pending, setPending] = useState({}); // `${empId}|${date}` → value
  const [painting, setPainting] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let off = false;
    attendanceApi.roster(month)
      .then(({ data }) => { if (!off) setState({ key, data }); })
      .catch(() => { if (!off) { setState({ key, data: null }); toast.error(t('common.failed_load')); } });
    return () => { off = true; };
  }, [key, month, t]);

  useEffect(() => {
    const stop = () => setPainting(false);
    window.addEventListener('mouseup', stop);
    return () => window.removeEventListener('mouseup', stop);
  }, []);

  const data = state.key === key ? state.data : null;
  const colorOf = useMemo(() => new Map((data?.schedules || []).map((s, i) => [s.id, PALETTE[i % PALETTE.length]])), [data]);
  const scheduleName = useMemo(() => new Map((data?.schedules || []).map((s) => [s.id, s.name])), [data]);
  const shift = (k) => { setMonth(dayjs(`${month}-01`).add(k, 'month').format('YYYY-MM')); setPending({}); };
  const pendingCount = Object.keys(pending).length;

  const paint = (empId, date) => {
    if (!brush || mode !== 'shifts' || !canEdit) return;
    setPending((p) => ({ ...p, [`${empId}|${date}`]: brush.value }));
  };

  const save = async () => {
    // One call per person and value, with that person's days.
    const groups = new Map();
    for (const [k, v] of Object.entries(pending)) {
      const [emp, date] = k.split('|');
      const g = `${emp}|${v ?? ''}`;
      if (!groups.has(g)) groups.set(g, { employee_ids: [Number(emp)], value: v, dates: [] });
      groups.get(g).dates.push(date);
    }
    setSaving(true);
    try {
      for (const g of groups.values()) await attendanceApi.setShifts(g);
      toast.success(t('roster.saved', { n: pendingCount }));
      setPending({});
      setReload((n) => n + 1);
    } catch (e) { toast.error(e?.response?.data?.error || t('common.operation_failed')); }
    finally { setSaving(false); }
  };

  const shiftCell = (emp, d) => {
    const k = `${emp.id}|${d}`;
    const planned = k in pending;
    const v = planned ? pending[k] : undefined;
    const cell = emp.days[d];
    let label = ''; let color = null; let override = false; let night = false; let off = false;
    if (planned) {
      if (v === 'off') { off = true; label = t('roster.off_abbr'); }
      else if (v == null) { label = '↺'; }
      else { color = colorOf.get(Number(v)); label = (scheduleName.get(Number(v)) || '').slice(0, 2); }
    } else if (cell.shift) {
      override = cell.shift.source === 'shift' || cell.shift.source === 'day_off';
      night = cell.shift.night;
      if (!cell.shift.working) { off = true; label = cell.shift.source === 'day_off' ? t('roster.off_abbr') : ''; }
      else { color = colorOf.get(cell.shift.schedule_id) || '#64748B'; label = (cell.shift.name || '').slice(0, 2); }
    }
    return (
      <div title={cell.shift ? `${cell.shift.name || ''} ${cell.shift.start ? `${cell.shift.start}–${cell.shift.end}` : ''}${cell.holiday ? ` · ${cell.holiday}` : ''}` : undefined}
        className={`h-7 rounded flex items-center justify-center text-[10px] font-semibold select-none ${planned ? 'outline outline-2 outline-dashed outline-brand-500' : ''} ${off ? 'bg-surface-100 text-surface-400' : 'text-white'}`}
        style={color ? { background: color, opacity: override || planned ? 1 : 0.55 } : undefined}>
        {night ? <Moon size={10} /> : label}
      </div>
    );
  };

  const attCell = (emp, d) => {
    const c = emp.days[d];
    const future = data && d > data.today;
    let cls = 'bg-transparent text-surface-300'; let label = '';
    if (c.att) { cls = ATT_TONE[c.att.status] || 'bg-surface-100 text-surface-600'; label = t(`roster.abbr.${attKey(c.att.status)}`); }
    else if (c.leave) { cls = c.leave.status === 'Pending' ? 'bg-violet-50 text-violet-500' : 'bg-violet-100 text-violet-800'; label = t('roster.abbr.on_leave'); }
    else if (c.holiday) { cls = 'bg-rose-50 text-rose-600'; label = t('roster.abbr.holiday'); }
    else if (c.shift && !c.shift.working) { cls = 'bg-surface-50 text-surface-300'; label = '·'; }
    else if (!future && c.shift?.working) { cls = 'bg-surface-50 text-surface-400'; label = '?'; }
    const tip = c.att ? `${t(`roster.status.${attKey(c.att.status)}`)}${c.att.check_in ? ` ${c.att.check_in}–${c.att.check_out || ''}` : ''}${c.att.late ? ` (+${c.att.late})` : ''}`
      : c.leave ? `${c.leave.type}${c.leave.status === 'Pending' ? ` (${t('roster.pending')})` : ''}` : c.holiday || undefined;
    return <div title={tip} className={`h-7 rounded flex items-center justify-center text-[10px] font-semibold ${cls}`}>{label}</div>;
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-start gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 flex items-center gap-2"><CalendarRange className="text-brand-600" /> {t('roster.title')}</h1>
          <p className="text-sm text-surface-500 mt-1">{t('roster.subtitle')}</p>
        </div>
        <div className="ms-auto flex gap-1 bg-surface-50 p-1 rounded-xl">
          {['attendance', 'shifts'].map((m) => (
            <button key={m} type="button" onClick={() => setMode(m)}
              className={`px-3 py-2 rounded-lg text-xs font-medium ${mode === m ? 'bg-brand-600 text-white' : 'text-surface-600 hover:bg-surface-100'}`}>
              {t(`roster.mode_${m}`)}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <button type="button" onClick={() => shift(-1)} className="p-1.5 rounded-lg hover:bg-surface-100" aria-label={t('roster.prev')}><ChevronLeft size={16} className="rtl:rotate-180" /></button>
        <span className="font-semibold text-surface-800 min-w-[120px] text-center">{dayjs(`${month}-01`).format('MMMM YYYY')}</span>
        <button type="button" onClick={() => shift(1)} className="p-1.5 rounded-lg hover:bg-surface-100" aria-label={t('roster.next')}><ChevronRight size={16} className="rtl:rotate-180" /></button>

        {mode === 'shifts' && canEdit && data && (
          <div className="flex items-center gap-1.5 flex-wrap ms-2">
            <span className="text-xs text-surface-500">{t('roster.brush')}</span>
            {data.schedules.map((s) => (
              <button key={s.id} type="button" onClick={() => setBrush({ value: s.id })}
                className={`px-2 py-1 rounded-lg text-[11px] text-white ${brush?.value === s.id ? 'ring-2 ring-offset-1 ring-brand-500' : ''}`}
                style={{ background: colorOf.get(s.id) }}>{s.name}</button>
            ))}
            <button type="button" onClick={() => setBrush({ value: 'off' })}
              className={`px-2 py-1 rounded-lg text-[11px] bg-surface-200 text-surface-700 ${brush?.value === 'off' ? 'ring-2 ring-offset-1 ring-brand-500' : ''}`}>{t('roster.day_off')}</button>
            <button type="button" onClick={() => setBrush({ value: null })}
              className={`px-2 py-1 rounded-lg text-[11px] border border-surface-300 text-surface-600 ${brush && brush.value === null ? 'ring-2 ring-offset-1 ring-brand-500' : ''}`}>{t('roster.weekly')}</button>
          </div>
        )}
        {pendingCount > 0 && (
          <div className="ms-auto flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => setPending({})}><Undo2 size={14} /> {t('roster.discard')}</Button>
            <Button size="sm" onClick={save} loading={saving}><Save size={14} /> {t('roster.save', { n: pendingCount })}</Button>
          </div>
        )}
      </div>

      <Card className="!p-0 overflow-hidden">
        {!data ? (
          <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 text-brand-600 animate-spin" /></div>
        ) : data.employees.length === 0 ? (
          <p className="text-sm text-surface-500 text-center py-8">{t('roster.empty')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="text-[11px] border-collapse">
              <thead>
                <tr>
                  <th className="sticky start-0 bg-white z-10 text-start px-3 py-2 font-semibold text-surface-500 min-w-[170px]">{t('roster.person')}</th>
                  {data.dates.map((d) => {
                    const day = dayjs(d);
                    return (
                      <th key={d} className={`w-8 min-w-[32px] py-1 font-medium ${d === data.today ? 'text-brand-700' : 'text-surface-400'}`}>
                        <span className="block">{day.date()}</span>
                        <span className="block text-[9px] font-normal">{day.format('dd')}</span>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {data.employees.map((emp) => (
                  <tr key={emp.id} className="border-t border-surface-50">
                    <td className="sticky start-0 bg-white z-10 px-3 py-1 whitespace-nowrap">
                      <span className="text-surface-800">{emp.name}</span>
                      {emp.department && <span className="block text-[10px] text-surface-400">{emp.department}</span>}
                    </td>
                    {data.dates.map((d) => (
                      <td key={d} className={`p-0.5 ${mode === 'shifts' && brush && canEdit ? 'cursor-crosshair' : ''}`}
                        onMouseDown={() => { setPainting(true); paint(emp.id, d); }}
                        onMouseEnter={() => { if (painting) paint(emp.id, d); }}>
                        {mode === 'shifts' ? shiftCell(emp, d) : attCell(emp, d)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <p className="text-[11px] text-surface-400">{mode === 'shifts' ? t('roster.legend_shifts') : t('roster.legend_attendance')}</p>
    </div>
  );
}
