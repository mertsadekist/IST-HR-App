/**
 * Work schedules, assignment coverage, and the holiday calendar.
 *
 * Phase 1 of the attendance-exception work: reference data only. Nothing on this
 * page changes a recorded attendance day or anyone's pay — it describes the
 * working week so a later phase can judge days against it.
 *
 * The one thing worth knowing while reading this: weekday 0 is Sunday, matching
 * the server and MySQL. The display order starts at Monday because that is how
 * the working week reads here, but the stored number never changes.
 */
import { useState, useEffect, useMemo } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { fetchCompanies } from '@store/slices/companiesSlice';
import * as wsApi from '@api/workSchedulesApi';
import Card from '@components/ui/Card';
import Button from '@components/ui/Button';
import Badge from '@components/ui/Badge';
import Modal from '@components/ui/Modal';
import Input from '@components/ui/Input';
import Select from '@components/ui/Select';
import EmptyState from '@components/ui/EmptyState';
import { confirmDelete } from '@utils/confirm';
import { toast } from 'react-toastify';
import { Plus, Edit3, Trash2, CalendarClock, CalendarOff, Users, Star, AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

// Stored weekday numbers (0 = Sunday), shown Monday-first.
const DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

const emptyDays = () => DISPLAY_ORDER.map((weekday) => ({
  weekday,
  is_working: weekday !== 0 && weekday !== 6,
  start_time: '10:00',
  end_time: '19:00',
  break_minutes: 60,
}));

const emptyForm = () => ({
  name_en: '', name_ar: '', notes: '',
  grace_in_minutes: 10, grace_out_minutes: 10,
  late_case_minutes: 30, early_case_minutes: 30,
  half_day_threshold_pct: 50,
  is_default: false, active: true,
  days: emptyDays(),
});

/** 'HH:MM:SS' → 'HH:MM' for a time input, which rejects seconds. */
const toInputTime = (v) => (v ? String(v).slice(0, 5) : '');

const hhmm = (minutes) => {
  if (!minutes) return '0h';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
};

export default function WorkSchedules() {
  const { t, i18n } = useTranslation();
  const dispatch = useDispatch();
  const { items: companies } = useSelector((s) => s.companies);
  const isAdmin = useSelector((s) => s.auth.user?.role) === 'admin';
  const isArabic = i18n.language === 'ar';

  const [section, setSection] = useState('schedules'); // schedules | coverage | holidays
  const [selectedCompany, setSelectedCompany] = useState('');

  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm());

  const [coverage, setCoverage] = useState([]);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignTarget, setAssignTarget] = useState(null);
  const [assignForm, setAssignForm] = useState({ schedule_id: '', effective_from: '', note: '' });

  const [holidays, setHolidays] = useState([]);
  const [year, setYear] = useState(new Date().getFullYear());
  const [holidayOpen, setHolidayOpen] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState(null);
  const [holidayForm, setHolidayForm] = useState({ holiday_date: '', name_en: '', name_ar: '', all_companies: false, is_half_day: false });

  const weekdayLabel = (n) => t(`work_schedules.weekday_${n}`);
  const scheduleName = (s) => (isArabic && s?.name_ar ? s.name_ar : s?.name_en) || '';

  useEffect(() => { dispatch(fetchCompanies()); }, [dispatch]);
  useEffect(() => {
    if (companies.length > 0 && !selectedCompany) setSelectedCompany(String(companies[0].id));
  }, [companies, selectedCompany]);

  useEffect(() => { if (selectedCompany) loadSchedules(); }, [selectedCompany]);
  useEffect(() => { if (selectedCompany && section === 'coverage') loadCoverage(); }, [selectedCompany, section]);
  useEffect(() => { if (selectedCompany && section === 'holidays') loadHolidays(); }, [selectedCompany, section, year]);

  const params = () => ({ company_id: selectedCompany });

  const loadSchedules = async () => {
    setLoading(true);
    try {
      const { data } = await wsApi.getSchedules(params());
      setSchedules(data);
    } catch { toast.error(t('toasts.t_failed_to_load_schedules')); }
    finally { setLoading(false); }
  };

  const loadCoverage = async () => {
    try {
      const { data } = await wsApi.getCoverage(params());
      setCoverage(data);
    } catch { toast.error(t('toasts.t_failed_to_load_coverage')); }
  };

  const loadHolidays = async () => {
    try {
      const { data } = await wsApi.getHolidays({ ...params(), year });
      setHolidays(data);
    } catch { toast.error(t('toasts.t_failed_to_load_holidays')); }
  };

  // ───────── schedule editor ─────────

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm());
    setModalOpen(true);
  };

  const openEdit = (s) => {
    setEditing(s);
    setForm({
      name_en: s.name_en || '', name_ar: s.name_ar || '', notes: s.notes || '',
      grace_in_minutes: s.grace_in_minutes ?? 10, grace_out_minutes: s.grace_out_minutes ?? 10,
      late_case_minutes: s.late_case_minutes ?? 30, early_case_minutes: s.early_case_minutes ?? 30,
      half_day_threshold_pct: s.half_day_threshold_pct ?? 50,
      is_default: !!s.is_default, active: s.active !== false,
      days: DISPLAY_ORDER.map((weekday) => {
        const d = (s.days || []).find((x) => Number(x.weekday) === weekday);
        return {
          weekday,
          is_working: !!(d && d.is_working),
          start_time: toInputTime(d?.start_time) || '10:00',
          end_time: toInputTime(d?.end_time) || '19:00',
          break_minutes: d?.break_minutes ?? 0,
        };
      }),
    });
    setModalOpen(true);
  };

  const updateDay = (weekday, field, value) => setForm((prev) => ({
    ...prev,
    days: prev.days.map((d) => (d.weekday === weekday ? { ...d, [field]: value } : d)),
  }));

  // Mirrors the server's expectedNetMinutes so the editor shows what will be
  // stored, not an optimistic guess.
  const netMinutes = (d) => {
    if (!d.is_working) return 0;
    const [sh, sm] = String(d.start_time || '').split(':').map(Number);
    const [eh, em] = String(d.end_time || '').split(':').map(Number);
    if ([sh, sm, eh, em].some((n) => Number.isNaN(n))) return 0;
    const span = (eh * 60 + em) - (sh * 60 + sm);
    return Math.max(0, span - (Number(d.break_minutes) || 0));
  };
  const weeklyMinutes = useMemo(() => form.days.reduce((sum, d) => sum + netMinutes(d), 0), [form.days]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name_en.trim()) { toast.error(t('toasts.t_schedule_name_is_required')); return; }
    if (!form.days.some((d) => d.is_working)) { toast.error(t('toasts.t_schedule_needs_a_working_day')); return; }
    setSaving(true);
    try {
      const payload = {
        ...form,
        company_id: Number(selectedCompany),
        days: form.days.map((d) => ({
          weekday: d.weekday,
          is_working: d.is_working,
          start_time: d.is_working ? `${d.start_time}:00` : null,
          end_time: d.is_working ? `${d.end_time}:00` : null,
          break_minutes: d.is_working ? Number(d.break_minutes) || 0 : 0,
        })),
      };
      if (editing) {
        await wsApi.updateSchedule(editing.id, payload);
        toast.success(t('toasts.t_schedule_updated'));
      } else {
        await wsApi.createSchedule(payload);
        toast.success(t('toasts.t_schedule_created'));
      }
      setModalOpen(false);
      loadSchedules();
    } catch (err) {
      toast.error(err.response?.data?.error || t('toasts.t_operation_failed'));
    } finally { setSaving(false); }
  };

  const handleDelete = async (s) => {
    const result = await confirmDelete(`"${scheduleName(s)}"`);
    if (!result.isConfirmed) return;
    try {
      await wsApi.deleteSchedule(s.id);
      toast.success(t('toasts.t_schedule_deleted'));
      loadSchedules();
    } catch (err) {
      toast.error(err.response?.data?.error || t('toasts.t_operation_failed'));
    }
  };

  // ───────── assignment ─────────

  const openAssign = (emp) => {
    setAssignTarget(emp);
    setAssignForm({
      schedule_id: emp.schedule_id ? String(emp.schedule_id) : (schedules[0]?.id ? String(schedules[0].id) : ''),
      effective_from: new Date().toISOString().slice(0, 10),
      note: '',
    });
    setAssignOpen(true);
  };

  const handleAssign = async (e) => {
    e.preventDefault();
    if (!assignForm.schedule_id) { toast.error(t('toasts.t_choose_a_schedule')); return; }
    try {
      await wsApi.assignSchedule({
        employee_id: assignTarget.id,
        schedule_id: Number(assignForm.schedule_id),
        effective_from: assignForm.effective_from,
        note: assignForm.note || null,
      });
      toast.success(t('toasts.t_schedule_assigned'));
      setAssignOpen(false);
      loadCoverage();
    } catch (err) {
      toast.error(err.response?.data?.error || t('toasts.t_operation_failed'));
    }
  };

  // ───────── holidays ─────────

  const openHoliday = (h) => {
    setEditingHoliday(h || null);
    setHolidayForm(h
      ? { holiday_date: h.holiday_date, name_en: h.name_en, name_ar: h.name_ar || '', all_companies: h.company_id == null, is_half_day: !!h.is_half_day }
      : { holiday_date: '', name_en: '', name_ar: '', all_companies: false, is_half_day: false });
    setHolidayOpen(true);
  };

  const handleSaveHoliday = async (e) => {
    e.preventDefault();
    if (!holidayForm.holiday_date || !holidayForm.name_en.trim()) {
      toast.error(t('toasts.t_holiday_needs_a_date_and_name')); return;
    }
    try {
      if (editingHoliday) {
        await wsApi.updateHoliday(editingHoliday.id, holidayForm);
        toast.success(t('toasts.t_holiday_updated'));
      } else {
        await wsApi.createHoliday({ ...holidayForm, company_id: Number(selectedCompany) });
        toast.success(t('toasts.t_holiday_created'));
      }
      setHolidayOpen(false);
      loadHolidays();
    } catch (err) {
      toast.error(err.response?.data?.error || t('toasts.t_operation_failed'));
    }
  };

  const handleDeleteHoliday = async (h) => {
    const result = await confirmDelete(`"${h.name_en}"`);
    if (!result.isConfirmed) return;
    try {
      await wsApi.deleteHoliday(h.id);
      toast.success(t('toasts.t_holiday_deleted'));
      loadHolidays();
    } catch (err) {
      toast.error(err.response?.data?.error || t('toasts.t_operation_failed'));
    }
  };

  const unassigned = coverage.filter((c) => !c.schedule_id);
  const sections = [
    { key: 'schedules', icon: CalendarClock, label: t('work_schedules.tab_schedules') },
    { key: 'coverage', icon: Users, label: t('work_schedules.tab_coverage') },
    { key: 'holidays', icon: CalendarOff, label: t('work_schedules.tab_holidays') },
  ];

  return (
    <>
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Select
            value={selectedCompany}
            onChange={(e) => setSelectedCompany(e.target.value)}
            options={companies.map((c) => ({ value: String(c.id), label: `${c.name} (${c.short_code})` }))}
            className="!w-56"
          />
          <div className="flex gap-1 bg-surface-100 rounded-xl p-1">
            {sections.map((s) => (
              <button
                key={s.key}
                onClick={() => setSection(s.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  section === s.key ? 'bg-white text-brand-700 shadow-sm' : 'text-surface-500 hover:text-surface-700'
                }`}
              >
                <s.icon size={13} /> {s.label}
              </button>
            ))}
          </div>
        </div>
        {section === 'schedules' && <Button onClick={openAdd} disabled={!selectedCompany}><Plus size={16} /> {t('work_schedules.add_schedule')}</Button>}
        {section === 'holidays' && <Button onClick={() => openHoliday(null)}><Plus size={16} /> {t('work_schedules.add_holiday')}</Button>}
      </div>

      <p className="text-xs text-surface-400 mb-4">{t('work_schedules.page_hint')}</p>

      {/* ───────── schedules ───────── */}
      {section === 'schedules' && (
        loading ? (
          <div className="space-y-2">{[1, 2].map((i) => (
            <div key={i} className="card p-4 animate-pulse"><div className="h-4 bg-surface-200 rounded w-1/3 mb-3" /><div className="h-3 bg-surface-100 rounded w-2/3" /></div>
          ))}</div>
        ) : schedules.length === 0 ? (
          <Card>
            <EmptyState
              icon={<CalendarClock className="w-6 h-6 text-surface-400" />}
              title={t('work_schedules.no_schedules')}
              description={t('work_schedules.no_schedules_desc')}
              action={<Button onClick={openAdd}><Plus size={16} /> {t('work_schedules.add_schedule')}</Button>}
            />
          </Card>
        ) : (
          <div className="space-y-3">
            {schedules.map((s) => (
              <Card key={s.id} className="!p-4 group">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-surface-900">{scheduleName(s)}</h3>
                      {!!s.is_default && <Badge variant="brand" className="text-[10px]"><Star size={9} className="inline" /> {t('work_schedules.default')}</Badge>}
                      {!s.active && <Badge variant="inactive" className="text-[10px]">{t('work_schedules.inactive')}</Badge>}
                      <Badge variant="info" className="text-[10px]">{hhmm(s.weekly_minutes)} / {t('work_schedules.week')}</Badge>
                    </div>
                    {s.notes && <p className="text-xs text-surface-400 mt-1">{s.notes}</p>}

                    <div className="flex flex-wrap gap-1.5 mt-2.5">
                      {DISPLAY_ORDER.map((weekday) => {
                        const d = (s.days || []).find((x) => Number(x.weekday) === weekday);
                        const working = d && d.is_working;
                        return (
                          <span
                            key={weekday}
                            className={`px-2 py-1 rounded-lg text-[11px] ${working ? 'bg-brand-50 text-brand-700' : 'bg-surface-100 text-surface-400'}`}
                            title={working ? `${toInputTime(d.start_time)}–${toInputTime(d.end_time)}` : t('work_schedules.day_off')}
                          >
                            <span className="font-medium">{weekdayLabel(weekday)}</span>
                            {working && <span className="ms-1 opacity-70">{toInputTime(d.start_time)}–{toInputTime(d.end_time)}</span>}
                          </span>
                        );
                      })}
                    </div>

                    <p className="text-[11px] text-surface-400 mt-2">
                      {t('work_schedules.grace_summary', { in: s.grace_in_minutes, out: s.grace_out_minutes })}
                      {' · '}
                      {t('work_schedules.case_summary', { late: s.late_case_minutes, early: s.early_case_minutes })}
                    </p>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(s)} title={t('common.edit')}><Edit3 size={14} /></Button>
                    {isAdmin && (
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(s)} className="text-red-500 hover:!bg-red-50" title={t('common.delete')}>
                        <Trash2 size={14} />
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )
      )}

      {/* ───────── coverage ───────── */}
      {section === 'coverage' && (
        <>
          {unassigned.length > 0 && (
            <div className="mb-3 flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200">
              <AlertTriangle size={15} className="text-amber-600 mt-0.5 shrink-0" />
              <p className="text-xs text-amber-800">
                {t('work_schedules.unassigned_warning', { count: unassigned.length })}
              </p>
            </div>
          )}
          <Card className="!p-0 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-surface-50 text-surface-500 text-xs">
                <tr>
                  <th className="text-start p-3">{t('work_schedules.th_employee')}</th>
                  <th className="text-start p-3">{t('work_schedules.th_schedule')}</th>
                  <th className="text-start p-3">{t('work_schedules.th_since')}</th>
                  <th className="p-3" />
                </tr>
              </thead>
              <tbody>
                {coverage.map((c) => (
                  <tr key={c.id} className="border-t border-surface-100">
                    <td className="p-3">
                      <span className="font-medium text-surface-800">{c.first_name} {c.last_name}</span>
                      {c.attendance_id && <span className="text-[11px] text-surface-400 ms-2">#{c.attendance_id}</span>}
                    </td>
                    <td className="p-3">
                      {c.schedule_id ? (
                        <span className="text-surface-700">{isArabic && c.schedule_name_ar ? c.schedule_name_ar : c.schedule_name}</span>
                      ) : c.default_schedule_name ? (
                        <Badge variant="info" className="text-[10px]">{t('work_schedules.using_default')}</Badge>
                      ) : (
                        <Badge variant="danger" className="text-[10px]">{t('work_schedules.none')}</Badge>
                      )}
                    </td>
                    <td className="p-3 text-xs text-surface-500">{c.effective_from || '—'}</td>
                    <td className="p-3 text-end">
                      <Button size="sm" variant="secondary" onClick={() => openAssign(c)}>{t('work_schedules.assign')}</Button>
                    </td>
                  </tr>
                ))}
                {coverage.length === 0 && (
                  <tr><td colSpan={4} className="p-6 text-center text-xs text-surface-400">{t('work_schedules.no_employees')}</td></tr>
                )}
              </tbody>
            </table>
          </Card>
        </>
      )}

      {/* ───────── holidays ───────── */}
      {section === 'holidays' && (
        <>
          <div className="flex items-center gap-2 mb-3">
            <label className="text-xs font-semibold text-surface-700">{t('work_schedules.year')}</label>
            <input type="number" value={year} onChange={(e) => setYear(Number(e.target.value) || new Date().getFullYear())}
              className="text-xs border border-surface-200 rounded-lg px-2 py-1.5 w-24" />
          </div>
          {holidays.length === 0 ? (
            <Card>
              <EmptyState
                icon={<CalendarOff className="w-6 h-6 text-surface-400" />}
                title={t('work_schedules.no_holidays')}
                description={t('work_schedules.no_holidays_desc')}
                action={<Button onClick={() => openHoliday(null)}><Plus size={16} /> {t('work_schedules.add_holiday')}</Button>}
              />
            </Card>
          ) : (
            <Card className="!p-0 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-surface-50 text-surface-500 text-xs">
                  <tr>
                    <th className="text-start p-3">{t('work_schedules.th_date')}</th>
                    <th className="text-start p-3">{t('work_schedules.th_name')}</th>
                    <th className="text-start p-3">{t('work_schedules.th_applies_to')}</th>
                    <th className="p-3" />
                  </tr>
                </thead>
                <tbody>
                  {holidays.map((h) => (
                    <tr key={h.id} className="border-t border-surface-100 group">
                      <td className="p-3 font-medium text-surface-800">{h.holiday_date}</td>
                      <td className="p-3">
                        {isArabic && h.name_ar ? h.name_ar : h.name_en}
                        {!!h.is_half_day && <Badge variant="warning" className="text-[10px] ms-2">{t('work_schedules.half_day')}</Badge>}
                      </td>
                      <td className="p-3 text-xs text-surface-500">
                        {h.company_id == null ? t('work_schedules.all_companies') : h.company_name}
                      </td>
                      <td className="p-3 text-end">
                        <div className="flex gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button variant="ghost" size="icon" onClick={() => openHoliday(h)} title={t('common.edit')}><Edit3 size={13} /></Button>
                          {isAdmin && (
                            <Button variant="ghost" size="icon" onClick={() => handleDeleteHoliday(h)} className="text-red-500 hover:!bg-red-50" title={t('common.delete')}>
                              <Trash2 size={13} />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </>
      )}

      {/* ───────── schedule modal ───────── */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)}
        title={editing ? t('work_schedules.edit_schedule') : t('work_schedules.create_schedule')} size="lg">
        <form onSubmit={handleSave} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label={t('work_schedules.name_en')} required value={form.name_en}
              onChange={(e) => setForm((p) => ({ ...p, name_en: e.target.value }))} />
            <Input label={t('work_schedules.name_ar')} value={form.name_ar}
              onChange={(e) => setForm((p) => ({ ...p, name_ar: e.target.value }))} />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-surface-700">{t('work_schedules.the_week')}</label>
              <span className="text-xs text-surface-400">{t('work_schedules.weekly_total')}: <strong className="text-brand-600">{hhmm(weeklyMinutes)}</strong></span>
            </div>
            <div className="space-y-1.5">
              {form.days.map((d) => (
                <div key={d.weekday} className={`flex items-center gap-2 p-2 rounded-xl ${d.is_working ? 'bg-surface-50' : 'bg-surface-100/60'}`}>
                  <label className="flex items-center gap-2 w-32 shrink-0 cursor-pointer">
                    <input type="checkbox" checked={d.is_working}
                      onChange={(e) => updateDay(d.weekday, 'is_working', e.target.checked)}
                      className="rounded border-surface-300" />
                    <span className={`text-sm ${d.is_working ? 'text-surface-800 font-medium' : 'text-surface-400'}`}>{weekdayLabel(d.weekday)}</span>
                  </label>
                  {d.is_working ? (
                    <>
                      <input type="time" value={d.start_time} onChange={(e) => updateDay(d.weekday, 'start_time', e.target.value)}
                        className="px-2 py-1.5 text-sm bg-white border border-surface-200 rounded-lg input-focus" />
                      <span className="text-surface-400 text-xs">–</span>
                      <input type="time" value={d.end_time} onChange={(e) => updateDay(d.weekday, 'end_time', e.target.value)}
                        className="px-2 py-1.5 text-sm bg-white border border-surface-200 rounded-lg input-focus" />
                      <div className="flex items-center gap-1.5 ms-2">
                        <span className="text-[11px] text-surface-500">{t('work_schedules.break')}</span>
                        <input type="number" min={0} max={480} step={15} value={d.break_minutes}
                          onChange={(e) => updateDay(d.weekday, 'break_minutes', e.target.value)}
                          className="w-16 px-2 py-1.5 text-sm bg-white border border-surface-200 rounded-lg input-focus" />
                        <span className="text-[11px] text-surface-400">{t('work_schedules.min')}</span>
                      </div>
                      <span className="ms-auto text-[11px] text-surface-500 tabular-nums">{hhmm(netMinutes(d))} {t('work_schedules.net')}</span>
                    </>
                  ) : (
                    <span className="text-xs text-surface-400">{t('work_schedules.day_off')}</span>
                  )}
                </div>
              ))}
            </div>
            <p className="text-[11px] text-surface-400 mt-2">{t('work_schedules.break_hint')}</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Input label={t('work_schedules.grace_in')} type="number" min={0} value={form.grace_in_minutes}
              onChange={(e) => setForm((p) => ({ ...p, grace_in_minutes: e.target.value }))} />
            <Input label={t('work_schedules.grace_out')} type="number" min={0} value={form.grace_out_minutes}
              onChange={(e) => setForm((p) => ({ ...p, grace_out_minutes: e.target.value }))} />
            <Input label={t('work_schedules.late_case')} type="number" min={0} value={form.late_case_minutes}
              onChange={(e) => setForm((p) => ({ ...p, late_case_minutes: e.target.value }))} />
            <Input label={t('work_schedules.early_case')} type="number" min={0} value={form.early_case_minutes}
              onChange={(e) => setForm((p) => ({ ...p, early_case_minutes: e.target.value }))} />
          </div>
          <p className="text-[11px] text-surface-400 -mt-2">{t('work_schedules.threshold_hint')}</p>

          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1.5">{t('work_schedules.notes')}</label>
            <textarea value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} rows={2}
              className="w-full px-3 py-2.5 text-sm bg-white border border-surface-200 rounded-xl input-focus transition-all resize-none" />
          </div>

          <div className="flex items-center gap-5">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={form.is_default} onChange={(e) => setForm((p) => ({ ...p, is_default: e.target.checked }))}
                className="rounded border-surface-300" />
              {t('work_schedules.make_default')}
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={form.active} onChange={(e) => setForm((p) => ({ ...p, active: e.target.checked }))}
                className="rounded border-surface-300" />
              {t('work_schedules.active')}
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>{t('common.cancel')}</Button>
            <Button type="submit" loading={saving}>{editing ? t('common.save') : t('common.add')}</Button>
          </div>
        </form>
      </Modal>

      {/* ───────── assign modal ───────── */}
      <Modal open={assignOpen} onClose={() => setAssignOpen(false)} title={t('work_schedules.assign_title')} size="md">
        <form onSubmit={handleAssign} className="space-y-4">
          {assignTarget && (
            <p className="text-sm text-surface-600">{assignTarget.first_name} {assignTarget.last_name}</p>
          )}
          <Select
            label={t('work_schedules.th_schedule')}
            value={assignForm.schedule_id}
            onChange={(e) => setAssignForm((p) => ({ ...p, schedule_id: e.target.value }))}
            options={schedules.filter((s) => s.active !== false).map((s) => ({ value: String(s.id), label: scheduleName(s) }))}
          />
          <Input label={t('work_schedules.effective_from')} type="date" required value={assignForm.effective_from}
            onChange={(e) => setAssignForm((p) => ({ ...p, effective_from: e.target.value }))} />
          <p className="text-[11px] text-surface-400">{t('work_schedules.effective_hint')}</p>
          <Input label={t('work_schedules.note')} value={assignForm.note}
            onChange={(e) => setAssignForm((p) => ({ ...p, note: e.target.value }))} />
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setAssignOpen(false)}>{t('common.cancel')}</Button>
            <Button type="submit">{t('work_schedules.assign')}</Button>
          </div>
        </form>
      </Modal>

      {/* ───────── holiday modal ───────── */}
      <Modal open={holidayOpen} onClose={() => setHolidayOpen(false)}
        title={editingHoliday ? t('work_schedules.edit_holiday') : t('work_schedules.add_holiday')} size="md">
        <form onSubmit={handleSaveHoliday} className="space-y-4">
          <Input label={t('work_schedules.th_date')} type="date" required value={holidayForm.holiday_date}
            onChange={(e) => setHolidayForm((p) => ({ ...p, holiday_date: e.target.value }))} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label={t('work_schedules.name_en')} required value={holidayForm.name_en}
              onChange={(e) => setHolidayForm((p) => ({ ...p, name_en: e.target.value }))} />
            <Input label={t('work_schedules.name_ar')} value={holidayForm.name_ar}
              onChange={(e) => setHolidayForm((p) => ({ ...p, name_ar: e.target.value }))} />
          </div>
          {!editingHoliday && (
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={holidayForm.all_companies}
                onChange={(e) => setHolidayForm((p) => ({ ...p, all_companies: e.target.checked }))}
                className="rounded border-surface-300" />
              {t('work_schedules.applies_all_companies')}
            </label>
          )}
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={holidayForm.is_half_day}
              onChange={(e) => setHolidayForm((p) => ({ ...p, is_half_day: e.target.checked }))}
              className="rounded border-surface-300" />
            {t('work_schedules.is_half_day')}
          </label>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setHolidayOpen(false)}>{t('common.cancel')}</Button>
            <Button type="submit">{editingHoliday ? t('common.save') : t('common.add')}</Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
