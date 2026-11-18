import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { Plus, Send, Trash2, Edit3, Loader2 } from 'lucide-react';
import Card from '@components/ui/Card';
import Button from '@components/ui/Button';
import Badge from '@components/ui/Badge';
import Modal from '@components/ui/Modal';
import EmptyState from '@components/ui/EmptyState';
import { confirmDelete } from '@utils/confirm';
import * as api from '@api/reportSchedulesApi';

const field = 'w-full text-sm border border-surface-200 rounded-lg px-3 py-2 bg-white';
const lbl = 'text-xs font-semibold text-surface-700';
const blank = { name: '', report_key: 'headcount', frequency: 'weekly', weekday: 1, month_day: 1, send_hour: 8, recipients: '', active: true, all_companies: false };

/** Reports emailed as Excel on a schedule: daily, on a weekday, or on a day of the month. */
export default function ReportSchedules() {
  const { t } = useTranslation();
  const isAdmin = useSelector((s) => s.auth.user?.role) === 'admin';
  const { currentCompanyId } = useSelector((s) => s.entity);
  const [data, setData] = useState({ key: null, rows: null, reports: [] });
  const [reload, setReload] = useState(0);
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(null);

  useEffect(() => {
    let off = false;
    api.list().then(({ data: d }) => { if (!off) setData({ key: reload, rows: d.schedules, reports: d.reports }); })
      .catch(() => { if (!off) { setData({ key: reload, rows: [], reports: [] }); toast.error(t('common.failed_load')); } });
    return () => { off = true; };
  }, [reload, t]);

  const rows = data.key === reload ? data.rows : null;
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const when = (s) => {
    const hour = `${String(s.send_hour).padStart(2, '0')}:00`;
    if (s.frequency === 'weekly') return t('report_schedules.when_weekly', { day: t(`report_schedules.weekday_${s.weekday}`), hour });
    if (s.frequency === 'monthly') return t('report_schedules.when_monthly', { day: s.month_day, hour });
    return t('report_schedules.when_daily', { hour });
  };

  const save = async () => {
    setBusy('save');
    try {
      const body = { ...form, company_id: currentCompanyId, send_hour: Number(form.send_hour), weekday: Number(form.weekday), month_day: Number(form.month_day) };
      if (form.id) await api.update(form.id, body); else await api.create(body);
      toast.success(t('report_schedules.saved')); setForm(null); setReload((n) => n + 1);
    } catch (e) { toast.error(e?.response?.data?.error || t('common.operation_failed')); }
    finally { setBusy(null); }
  };
  const sendNow = async (s) => {
    setBusy(s.id);
    try { const { data: r } = await api.sendNow(s.id); toast.success(t('report_schedules.sent', { count: r.sent, rows: r.rows })); }
    catch (e) { toast.error(e?.response?.data?.error || t('common.operation_failed')); }
    finally { setBusy(null); }
  };
  const remove = async (s) => {
    const c = await confirmDelete(s.name); if (!c.isConfirmed) return;
    try { await api.remove(s.id); toast.success(t('common.deleted')); setReload((n) => n + 1); }
    catch (e) { toast.error(e?.response?.data?.error || t('common.operation_failed')); }
  };

  return (
    <div className="space-y-4">
      <Card className="!p-4 flex items-start gap-3">
        <div className="flex-1">
          <h3 className="font-semibold text-surface-900">{t('report_schedules.title')}</h3>
          <p className="text-xs text-surface-500 mt-0.5">{t('report_schedules.desc')}</p>
        </div>
        <Button onClick={() => setForm({ ...blank })}><Plus size={14} /> {t('report_schedules.new')}</Button>
      </Card>

      {!rows ? <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 text-brand-600 animate-spin" /></div>
        : rows.length === 0 ? <Card><EmptyState title={t('report_schedules.empty')} description={t('report_schedules.empty_desc')} /></Card> : (
          <Card className="!p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <tbody>
                {rows.map((s) => (
                  <tr key={s.id} className="border-t border-surface-50 first:border-t-0">
                    <td className="p-3">
                      <div className="font-medium text-surface-900">{s.name} {!s.active && <Badge variant="inactive">{t('report_schedules.paused')}</Badge>}</div>
                      <div className="text-xs text-surface-500">{t(`report_schedules.report_${s.report_key}`)} · {s.company_name || t('report_schedules.all_companies')}</div>
                    </td>
                    <td className="p-3 text-xs text-surface-600">{when(s)}<div className="text-surface-400">{s.last_sent_on ? t('report_schedules.last_sent', { date: s.last_sent_on }) : t('report_schedules.never_sent')}</div></td>
                    <td className="p-3 text-xs text-surface-500 max-w-[16rem] truncate" title={s.recipients}>{s.recipients.split(',').join(', ')}</td>
                    <td className="p-3 whitespace-nowrap text-end">
                      <button type="button" onClick={() => sendNow(s)} disabled={busy === s.id} className="p-1.5 text-surface-400 hover:text-brand-600" title={t('report_schedules.send_now')} aria-label={t('report_schedules.send_now')}>
                        {busy === s.id ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                      </button>
                      <button type="button" onClick={() => setForm({ ...blank, ...s, active: !!s.active, weekday: s.weekday ?? 1, month_day: s.month_day ?? 1 })} className="p-1.5 text-surface-400 hover:text-brand-600" aria-label={t('common.edit')}><Edit3 size={14} /></button>
                      {isAdmin && <button type="button" onClick={() => remove(s)} className="p-1.5 text-surface-400 hover:text-red-600" aria-label={t('common.delete')}><Trash2 size={14} /></button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}

      <Modal open={!!form} onClose={() => setForm(null)} title={form?.id ? t('report_schedules.edit') : t('report_schedules.new')}>
        {form && (
          <div className="space-y-3">
            <div><span className={lbl}>{t('report_schedules.name')}</span><input value={form.name} onChange={(e) => set({ name: e.target.value })} className={`${field} mt-1`} /></div>
            <div><span className={lbl}>{t('report_schedules.report')}</span>
              <select value={form.report_key} onChange={(e) => set({ report_key: e.target.value })} className={`${field} mt-1`}>
                {data.reports.map((k) => <option key={k} value={k}>{t(`report_schedules.report_${k}`)}</option>)}
              </select></div>
            <div className="grid grid-cols-3 gap-2">
              <div><span className={lbl}>{t('report_schedules.frequency')}</span>
                <select value={form.frequency} onChange={(e) => set({ frequency: e.target.value })} className={`${field} mt-1`}>
                  {['daily', 'weekly', 'monthly'].map((f) => <option key={f} value={f}>{t(`report_schedules.freq_${f}`)}</option>)}
                </select></div>
              {form.frequency === 'weekly' && <div><span className={lbl}>{t('report_schedules.weekday')}</span>
                <select value={form.weekday} onChange={(e) => set({ weekday: e.target.value })} className={`${field} mt-1`}>
                  {[0, 1, 2, 3, 4, 5, 6].map((d) => <option key={d} value={d}>{t(`report_schedules.weekday_${d}`)}</option>)}
                </select></div>}
              {form.frequency === 'monthly' && <div><span className={lbl}>{t('report_schedules.month_day')}</span>
                <input type="number" min="1" max="31" value={form.month_day} onChange={(e) => set({ month_day: e.target.value })} className={`${field} mt-1`} /></div>}
              <div><span className={lbl}>{t('report_schedules.hour')}</span>
                <select value={form.send_hour} onChange={(e) => set({ send_hour: e.target.value })} className={`${field} mt-1`}>
                  {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{`${String(h).padStart(2, '0')}:00`}</option>)}
                </select></div>
            </div>
            <div><span className={lbl}>{t('report_schedules.recipients')}</span>
              <textarea rows={2} value={form.recipients} onChange={(e) => set({ recipients: e.target.value })} placeholder={t('report_schedules.recipients_ph')} className={`${field} mt-1`} /></div>
            <div className="flex flex-wrap gap-4 text-sm text-surface-700">
              <label className="inline-flex items-center gap-2"><input type="checkbox" checked={form.active} onChange={(e) => set({ active: e.target.checked })} /> {t('report_schedules.active')}</label>
              {!form.id && <label className="inline-flex items-center gap-2"><input type="checkbox" checked={form.all_companies} onChange={(e) => set({ all_companies: e.target.checked })} /> {t('report_schedules.all_companies')}</label>}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setForm(null)}>{t('common.cancel')}</Button>
              <Button onClick={save} loading={busy === 'save'}>{t('common.save')}</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
