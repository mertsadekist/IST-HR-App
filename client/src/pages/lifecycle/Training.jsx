import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { GraduationCap, Plus, Loader2, Trash2, Archive } from 'lucide-react';
import Card from '@components/ui/Card';
import Button from '@components/ui/Button';
import Badge from '@components/ui/Badge';
import Modal from '@components/ui/Modal';
import * as trainingApi from '@api/trainingApi';
import { confirmDelete } from '@utils/confirm';

const input = 'w-full text-sm border border-surface-200 rounded-lg px-3 py-2 mt-1 bg-white';

/**
 * Training compliance and the course catalogue. Certificates that expired or
 * run out within 60 days, people missing a mandatory course, and the courses
 * themselves. Trainings are recorded on each employee's profile.
 */
export default function Training() {
  const { t } = useTranslation();
  const { user } = useSelector((s) => s.auth);
  const { currentCompanyId } = useSelector((s) => s.entity);
  const isAdmin = user?.role === 'admin';
  const [tab, setTab] = useState('overview');
  const [reload, setReload] = useState(0);
  const key = `${currentCompanyId ?? 'all'}:${reload}`;
  const [state, setState] = useState({ key: null, overview: null, courses: [] });
  const [form, setForm] = useState(null);

  useEffect(() => {
    let off = false;
    Promise.all([trainingApi.getOverview(), trainingApi.getCourses({ all: 1 })])
      .then(([o, c]) => { if (!off) setState({ key, overview: o.data, courses: c.data }); })
      .catch(() => { if (!off) { setState({ key, overview: { expiring: [], gaps: [] }, courses: [] }); toast.error(t('common.failed_load')); } });
    return () => { off = true; };
  }, [key, t]);

  const refresh = () => setReload((n) => n + 1);
  const save = async () => {
    try {
      if (form.id) await trainingApi.updateCourse(form.id, form);
      else await trainingApi.createCourse(form);
      toast.success(t('training.course_saved')); setForm(null); refresh();
    } catch (e) { toast.error(e?.response?.data?.error || t('common.operation_failed')); }
  };
  const retire = async (c) => {
    try { await trainingApi.updateCourse(c.id, { active: !c.active }); refresh(); }
    catch (e) { toast.error(e?.response?.data?.error || t('common.operation_failed')); }
  };
  const remove = async (c) => {
    if (!(await confirmDelete(`"${c.name}"`)).isConfirmed) return;
    try { await trainingApi.deleteCourse(c.id); refresh(); }
    catch (e) { toast.error(e?.response?.data?.error || t('common.operation_failed')); }
  };

  const ready = state.key === key;
  const o = state.overview;
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 flex items-center gap-2"><GraduationCap className="text-brand-600" /> {t('training.title')}</h1>
          <p className="text-sm text-surface-500 mt-1">{t('training.subtitle')}</p>
        </div>
        <Button className="ms-auto" onClick={() => setForm({ name: '', provider: '', validity_months: '', mandatory: false })}><Plus size={16} /> {t('training.new_course')}</Button>
      </div>

      <div className="flex gap-1 border-b border-surface-100">
        {['overview', 'courses'].map((tb) => (
          <button key={tb} type="button" onClick={() => setTab(tb)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${tab === tb ? 'border-brand-600 text-brand-700' : 'border-transparent text-surface-500 hover:text-surface-700'}`}>{t(`training.tab_${tb}`)}</button>
        ))}
      </div>

      {!ready ? (
        <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 text-brand-600 animate-spin" /></div>
      ) : tab === 'overview' ? (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <Card className="!p-0 overflow-hidden">
            <h3 className="px-4 pt-4 pb-2 text-sm font-semibold text-surface-800">{t('training.expiring_title')}</h3>
            {o.expiring.length === 0 ? <p className="text-sm text-surface-400 text-center py-6">{t('training.expiring_empty')}</p> : (
              <table className="w-full text-sm"><tbody>
                {o.expiring.map((r) => (
                  <tr key={r.id} className="border-t border-surface-50">
                    <td className="p-3">{r.employee_name}{r.department && <span className="block text-[11px] text-surface-400">{r.department}</span>}</td>
                    <td className="p-3">{r.course_name}</td>
                    <td className="p-3 text-xs whitespace-nowrap">{r.expires_on} <Badge variant={r.state === 'expired' ? 'danger' : 'warning'} className="text-[10px] ms-1">{t(`training.state.${r.state}`)}</Badge></td>
                  </tr>
                ))}
              </tbody></table>
            )}
          </Card>
          <Card className="!p-0 overflow-hidden">
            <h3 className="px-4 pt-4 pb-2 text-sm font-semibold text-surface-800">{t('training.gaps_overview')}</h3>
            {o.gaps.length === 0 ? <p className="text-sm text-surface-400 text-center py-6">{t('training.gaps_empty')}</p> : (
              <ul className="divide-y divide-surface-50">
                {o.gaps.map((p) => (
                  <li key={p.employee_id} className="px-4 py-2.5">
                    <p className="text-sm text-surface-800">{p.employee_name}{p.department && <span className="text-[11px] text-surface-400 ms-1.5">{p.department}</span>}</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {p.gaps.map((g) => <Badge key={g.course_id} variant={g.reason === 'expired' ? 'danger' : 'warning'} className="text-[10px]">{g.name} · {t(`training.gap_${g.reason}`)}</Badge>)}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <p className="text-[11px] text-surface-400 xl:col-span-2">{t('training.overview_hint')}</p>
        </div>
      ) : (
        <Card className="!p-0 overflow-hidden">
          {state.courses.length === 0 ? <p className="text-sm text-surface-400 text-center py-6">{t('training.no_courses')}</p> : (
            <table className="w-full text-sm">
              <thead className="bg-surface-50 text-surface-500 text-xs"><tr>
                <th className="text-start p-3">{t('training.course')}</th><th className="text-start p-3">{t('training.provider')}</th>
                <th className="text-start p-3">{t('training.validity')}</th><th className="p-3" />
              </tr></thead>
              <tbody>
                {state.courses.map((c) => (
                  <tr key={c.id} className={`border-t border-surface-50 ${c.active ? '' : 'opacity-50'}`}>
                    <td className="p-3">
                      <button type="button" onClick={() => setForm({ ...c, mandatory: !!c.mandatory, validity_months: c.validity_months ?? '' })} className="text-surface-800 hover:text-brand-700 text-start">{c.name}</button>
                      {!!c.mandatory && <Badge variant="warning" className="text-[10px] ms-1.5">{t('training.mandatory')}</Badge>}
                      {c.company_id == null && <Badge variant="info" className="text-[10px] ms-1">{t('training.group_wide')}</Badge>}
                    </td>
                    <td className="p-3 text-xs text-surface-500">{c.provider || '—'}</td>
                    <td className="p-3 text-xs">{c.validity_months ? t('training.valid_months', { n: c.validity_months }) : t('training.no_expiry')}</td>
                    <td className="p-3 text-end whitespace-nowrap">
                      <button type="button" onClick={() => retire(c)} className="p-1 text-surface-400 hover:text-brand-600" title={c.active ? t('training.retire') : t('training.restore')} aria-label={c.active ? t('training.retire') : t('training.restore')}><Archive size={14} /></button>
                      {isAdmin && <button type="button" onClick={() => remove(c)} className="p-1 text-surface-400 hover:text-red-600" aria-label={t('common.delete')}><Trash2 size={14} /></button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}

      {form && (
        <Modal open onClose={() => setForm(null)} title={form.id ? form.name : t('training.new_course')} size="md">
          <div className="space-y-3">
            <div><label className="text-xs font-semibold text-surface-700">{t('training.course')} *</label>
              <input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} maxLength={200} className={input} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs font-semibold text-surface-700">{t('training.provider')}</label>
                <input value={form.provider || ''} onChange={(e) => setForm((p) => ({ ...p, provider: e.target.value }))} maxLength={200} className={input} /></div>
              <div><label className="text-xs font-semibold text-surface-700">{t('training.validity_months')}</label>
                <input type="number" min="1" max="120" value={form.validity_months} onChange={(e) => setForm((p) => ({ ...p, validity_months: e.target.value }))} placeholder={t('training.no_expiry')} className={input} /></div>
            </div>
            <label className="flex items-center gap-2 text-sm text-surface-700">
              <input type="checkbox" checked={!!form.mandatory} onChange={(e) => setForm((p) => ({ ...p, mandatory: e.target.checked }))} />
              {t('training.mandatory_label')}
            </label>
            {!form.id && isAdmin && <p className="text-[11px] text-surface-500">{t('training.group_hint')}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setForm(null)}>{t('common.cancel')}</Button>
              <Button onClick={save}>{t('common.save')}</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
