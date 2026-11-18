import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import dayjs from 'dayjs';
import { MapPin, Plus, Trash2, Save, Loader2, Crosshair } from 'lucide-react';
import Card from '@components/ui/Card';
import Button from '@components/ui/Button';
import Badge from '@components/ui/Badge';
import * as clockApi from '@api/clockApi';
import * as employeesApi from '@api/employeesApi';

const input = 'w-full text-sm border border-surface-200 rounded-lg px-3 py-2 bg-white';
const label = 'text-xs font-semibold text-surface-700';

/**
 * Portal clock-in: off by default. An admin turns it on, chooses who may use
 * it, whether a location is required, and the sites a punch must be made at.
 * HR sees the day's portal punches with where each was made.
 */
export default function ClockInSettings() {
  const { t } = useTranslation();
  const isAdmin = useSelector((s) => s.auth.user?.role) === 'admin';
  const [form, setForm] = useState(null);
  const [people, setPeople] = useState([]);
  const [date, setDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [punches, setPunches] = useState({ date: null, rows: [] });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let off = false;
    clockApi.getSettings().then(({ data }) => { if (!off) setForm(data); }).catch(() => { if (!off) toast.error(t('common.failed_load')); });
    employeesApi.getEmployees({ limit: 500 }).then(({ data }) => {
      if (!off) setPeople((data.data || []).map((p) => ({ id: p.id, name: `${p.first_name} ${p.last_name}` })));
    }).catch(() => {});
    return () => { off = true; };
  }, [t]);

  useEffect(() => {
    let off = false;
    clockApi.getPunches(date).then(({ data }) => { if (!off) setPunches({ date, rows: data.punches }); }).catch(() => { if (!off) setPunches({ date, rows: [] }); });
    return () => { off = true; };
  }, [date]);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const save = async () => {
    setSaving(true);
    try {
      const { data } = await clockApi.saveSettings({ ...form, sites: form.sites.map((x) => ({ ...x, lat: Number(x.lat), lng: Number(x.lng), radius_m: Number(x.radius_m) })) });
      setForm(data); toast.success(t('clock.settings_saved'));
    } catch (e) { toast.error(e?.response?.data?.error || t('common.operation_failed')); }
    finally { setSaving(false); }
  };
  const hereFor = (i) => {
    if (!navigator.geolocation) { toast.error(t('clock.location_needed')); return; }
    navigator.geolocation.getCurrentPosition(
      (p) => set({ sites: form.sites.map((x, j) => (j === i ? { ...x, lat: p.coords.latitude.toFixed(6), lng: p.coords.longitude.toFixed(6) } : x)) }),
      () => toast.error(t('clock.location_needed')), { enableHighAccuracy: true, timeout: 15000 },
    );
  };

  if (!form) return <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 text-brand-600 animate-spin" /></div>;
  const ro = !isAdmin;
  return (
    <div className="space-y-4">
      <Card className="!p-5 space-y-4">
        <div className="flex items-start gap-3">
          <div className="flex-1">
            <h3 className="font-semibold text-surface-900">{t('clock.settings_title')}</h3>
            <p className="text-xs text-surface-500 mt-0.5">{t('clock.settings_desc')}</p>
          </div>
          <label className="inline-flex items-center gap-2 text-sm font-medium cursor-pointer">
            <input type="checkbox" disabled={ro} checked={form.enabled} onChange={(e) => set({ enabled: e.target.checked })} className="w-4 h-4" />
            {form.enabled ? <Badge variant="success">{t('clock.on')}</Badge> : <Badge variant="inactive">{t('clock.off')}</Badge>}
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div><span className={label}>{t('clock.who')}</span>
            <select disabled={ro} value={form.who} onChange={(e) => set({ who: e.target.value })} className={`${input} mt-1`}>
              <option value="all">{t('clock.who_all')}</option><option value="listed">{t('clock.who_listed')}</option>
            </select></div>
          <div><span className={label}>{t('clock.max_accuracy')}</span>
            <input disabled={ro} type="number" min="10" max="5000" value={form.max_accuracy_m} onChange={(e) => set({ max_accuracy_m: Number(e.target.value) })} className={`${input} mt-1`} /></div>
          <label className="flex items-center gap-2 text-sm text-surface-700 mt-5">
            <input type="checkbox" disabled={ro} checked={form.require_location} onChange={(e) => set({ require_location: e.target.checked })} /> {t('clock.require_location')}
          </label>
        </div>

        {form.who === 'listed' && (
          <div>
            <span className={label}>{t('clock.listed_people')}</span>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {form.employee_ids.map((id) => (
                <span key={id} className="inline-flex items-center gap-1 rounded-lg bg-surface-100 px-2 py-1 text-xs">
                  {people.find((p) => p.id === id)?.name || `#${id}`}
                  {!ro && <button type="button" onClick={() => set({ employee_ids: form.employee_ids.filter((x) => x !== id) })} className="text-surface-400 hover:text-red-600" aria-label={t('common.delete')}><Trash2 size={11} /></button>}
                </span>
              ))}
            </div>
            {!ro && (
              <select value="" onChange={(e) => { const id = Number(e.target.value); if (id && !form.employee_ids.includes(id)) set({ employee_ids: [...form.employee_ids, id] }); }} className={`${input} mt-2`}>
                <option value="">{t('clock.add_person')}</option>
                {people.filter((p) => !form.employee_ids.includes(p.id)).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            )}
          </div>
        )}

        <div>
          <div className="flex items-center">
            <span className={label}>{t('clock.sites')}</span>
            {!ro && <button type="button" onClick={() => set({ sites: [...form.sites, { name: '', lat: '', lng: '', radius_m: 200 }] })} className="ms-auto text-xs text-brand-700 inline-flex items-center gap-1"><Plus size={12} /> {t('clock.add_site')}</button>}
          </div>
          <p className="text-[11px] text-surface-400">{t('clock.sites_hint')}</p>
          <div className="space-y-2 mt-2">
            {form.sites.map((x, i) => (
              <div key={i} className="grid grid-cols-2 sm:grid-cols-6 gap-2 items-center">
                <input disabled={ro} value={x.name} onChange={(e) => set({ sites: form.sites.map((y, j) => (j === i ? { ...y, name: e.target.value } : y)) })} placeholder={t('clock.site_name')} className={`${input} sm:col-span-2`} />
                <input disabled={ro} value={x.lat} onChange={(e) => set({ sites: form.sites.map((y, j) => (j === i ? { ...y, lat: e.target.value } : y)) })} placeholder={t('clock.lat')} className={input} />
                <input disabled={ro} value={x.lng} onChange={(e) => set({ sites: form.sites.map((y, j) => (j === i ? { ...y, lng: e.target.value } : y)) })} placeholder={t('clock.lng')} className={input} />
                <input disabled={ro} type="number" min="20" value={x.radius_m} onChange={(e) => set({ sites: form.sites.map((y, j) => (j === i ? { ...y, radius_m: e.target.value } : y)) })} placeholder={t('clock.radius')} className={input} title={t('clock.radius')} />
                {!ro && (
                  <div className="flex gap-1">
                    <button type="button" onClick={() => hereFor(i)} className="p-1.5 text-surface-400 hover:text-brand-600" title={t('clock.use_here')} aria-label={t('clock.use_here')}><Crosshair size={14} /></button>
                    <button type="button" onClick={() => set({ sites: form.sites.filter((_, j) => j !== i) })} className="p-1.5 text-surface-400 hover:text-red-600" aria-label={t('common.delete')}><Trash2 size={14} /></button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
        {isAdmin ? (
          <div className="flex justify-end"><Button onClick={save} loading={saving}><Save size={14} /> {t('common.save')}</Button></div>
        ) : <p className="text-[11px] text-surface-400">{t('clock.admin_only')}</p>}
      </Card>

      <Card className="!p-0 overflow-hidden">
        <div className="flex items-center gap-2 p-3 border-b border-surface-100">
          <h3 className="text-sm font-semibold text-surface-800 flex-1">{t('clock.punches_title')}</h3>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="text-sm border border-surface-200 rounded-lg px-3 py-1.5 bg-white" />
        </div>
        {punches.date !== date ? <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 text-brand-600 animate-spin" /></div>
          : punches.rows.length === 0 ? <p className="text-sm text-surface-400 text-center py-6">{t('clock.no_punches')}</p> : (
            <table className="w-full text-sm">
              <tbody>
                {punches.rows.map((p) => (
                  <tr key={p.id} className="border-t border-surface-50">
                    <td className="p-3">{p.employee_name}</td>
                    <td className="p-3 text-xs">{p.kind === 'in' ? t('clock.clock_in') : t('clock.clock_out')} · {p.at}</td>
                    <td className="p-3 text-xs text-surface-500">
                      {p.site_name || '—'}{p.accuracy_m != null && ` · ±${p.accuracy_m} m`}
                      {p.lat != null && (
                        <a href={`https://www.google.com/maps?q=${p.lat},${p.lng}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 ms-2 text-brand-700 hover:underline"><MapPin size={11} /> {t('clock.map')}</a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
      </Card>
    </div>
  );
}
