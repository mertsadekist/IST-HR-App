import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import { Plus, Trash2, Download, Loader2, Save, AlertTriangle } from 'lucide-react';
import Button from '@components/ui/Button';
import Badge from '@components/ui/Badge';
import * as trainingApi from '@api/trainingApi';
import * as skillsApi from '@api/skillsApi';
import { confirmDelete } from '@utils/confirm';

const STATE_VARIANT = { valid: 'success', expiring: 'warning', expired: 'danger', no_expiry: 'info' };
const input = 'w-full text-sm border border-surface-200 rounded-lg px-3 py-2 bg-white';

/**
 * A person's trainings (with the certificate and when it runs out), the
 * mandatory courses they still lack, and their skills from the catalogue.
 */
export default function EmployeeTrainingTab({ employee, t, canEdit }) {
  const isAdmin = useSelector((s) => s.auth.user?.role) === 'admin';
  const [reload, setReload] = useState(0);
  const key = `${employee.id}:${reload}`;
  const [state, setState] = useState({ key: null, data: null });
  const [courses, setCourses] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [form, setForm] = useState(null);
  const [file, setFile] = useState(null);
  const [skills, setSkills] = useState(null); // local edit copy
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let off = false;
    trainingApi.getEmployeeTraining(employee.id)
      .then(({ data }) => { if (!off) setState({ key, data }); })
      .catch(() => { if (!off) setState({ key, data: { trainings: [], gaps: [], skills: [] } }); });
    return () => { off = true; };
  }, [employee.id, key]);

  useEffect(() => {
    if (!canEdit) return undefined;
    let off = false;
    trainingApi.getCourses().then(({ data }) => { if (!off) setCourses(data); }).catch(() => {});
    skillsApi.getSkillsFlat().then(({ data }) => { if (!off) setCatalog(data); }).catch(() => {});
    return () => { off = true; };
  }, [canEdit]);

  const data = state.key === key ? state.data : null;
  const shownSkills = skills ?? data?.skills ?? [];

  const add = async () => {
    setBusy(true);
    try {
      const fd = new FormData();
      for (const [k, v] of Object.entries(form)) if (v !== '' && v != null) fd.append(k, v);
      if (file) fd.append('file', file);
      await trainingApi.addTraining(employee.id, fd);
      toast.success(t('training.recorded'));
      setForm(null); setFile(null); setReload((n) => n + 1);
    } catch (e) { toast.error(e?.response?.data?.error || t('common.operation_failed')); }
    finally { setBusy(false); }
  };
  const remove = async (r) => {
    if (!(await confirmDelete(`"${r.course_name}"`)).isConfirmed) return;
    try { await trainingApi.deleteTraining(r.id); setReload((n) => n + 1); }
    catch (e) { toast.error(e?.response?.data?.error || t('common.operation_failed')); }
  };
  const download = async (r) => {
    try {
      const { data: blob } = await trainingApi.downloadCertificate(r.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = r.file_name || 'certificate';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch { toast.error(t('common.operation_failed')); }
  };
  const saveSkills = async () => {
    setBusy(true);
    try {
      await trainingApi.saveSkills(employee.id, shownSkills.map((s) => ({ skill_id: s.skill_id, level: s.level })));
      toast.success(t('training.skills_saved'));
      setSkills(null); setReload((n) => n + 1);
    } catch (e) { toast.error(e?.response?.data?.error || t('common.operation_failed')); }
    finally { setBusy(false); }
  };

  if (!data) return <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 text-brand-600 animate-spin" /></div>;
  return (
    <div className="space-y-5">
      {data.gaps.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 space-y-1">
          <p className="font-semibold flex items-center gap-1.5"><AlertTriangle size={14} /> {t('training.gaps_title')}</p>
          {data.gaps.map((g) => <p key={g.course_id}>{g.name} — {t(`training.gap_${g.reason}`)}</p>)}
        </div>
      )}

      <div>
        <div className="flex items-center mb-2">
          <h4 className="text-sm font-semibold text-surface-800">{t('training.trainings')}</h4>
          {canEdit && !form && (
            <Button size="sm" variant="secondary" className="ms-auto" onClick={() => setForm({ course_id: '', completed_on: '', expires_on: '', result: '', notes: '' })}>
              <Plus size={14} /> {t('training.add')}
            </Button>
          )}
        </div>
        {form && (
          <div className="rounded-xl border border-surface-200 p-3 mb-3 space-y-2">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <select value={form.course_id} onChange={(e) => setForm((p) => ({ ...p, course_id: e.target.value }))} className={input}>
                <option value="">{t('training.choose_course')}</option>
                {courses.map((c) => <option key={c.id} value={c.id}>{c.name}{c.validity_months ? ` (${t('training.valid_months', { n: c.validity_months })})` : ''}</option>)}
              </select>
              <input type="date" value={form.completed_on} onChange={(e) => setForm((p) => ({ ...p, completed_on: e.target.value }))} className={input} title={t('training.completed_on')} />
              <input type="date" value={form.expires_on} onChange={(e) => setForm((p) => ({ ...p, expires_on: e.target.value }))} className={input} title={t('training.expires_on_hint')} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input value={form.result} onChange={(e) => setForm((p) => ({ ...p, result: e.target.value }))} placeholder={t('training.result_ph')} maxLength={100} className={input} />
              <input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" onChange={(e) => setFile(e.target.files?.[0] || null)} className="text-xs" />
            </div>
            <p className="text-[11px] text-surface-500">{t('training.expiry_hint')}</p>
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="secondary" onClick={() => { setForm(null); setFile(null); }}>{t('common.cancel')}</Button>
              <Button size="sm" onClick={add} loading={busy}>{t('common.save')}</Button>
            </div>
          </div>
        )}
        {data.trainings.length === 0 ? <p className="text-xs text-surface-400">{t('training.none')}</p> : (
          <table className="w-full text-sm">
            <thead className="text-surface-500 text-xs"><tr>
              <th className="text-start py-2">{t('training.course')}</th><th className="text-start py-2">{t('training.completed_on')}</th>
              <th className="text-start py-2">{t('training.expires_on')}</th><th className="py-2" />
            </tr></thead>
            <tbody>
              {data.trainings.map((r) => (
                <tr key={r.id} className="border-t border-surface-50">
                  <td className="py-2">{r.course_name}{r.result && <span className="block text-[11px] text-surface-400">{r.result}</span>}</td>
                  <td className="py-2 text-xs">{r.completed_on}</td>
                  <td className="py-2 text-xs">{r.expires_on || '—'} <Badge variant={STATE_VARIANT[r.state]} className="text-[10px] ms-1">{t(`training.state.${r.state}`)}</Badge></td>
                  <td className="py-2 text-end whitespace-nowrap">
                    {r.file_name && <button type="button" onClick={() => download(r)} className="p-1 text-surface-400 hover:text-brand-600" aria-label={t('training.certificate')}><Download size={14} /></button>}
                    {isAdmin && <button type="button" onClick={() => remove(r)} className="p-1 text-surface-400 hover:text-red-600" aria-label={t('common.delete')}><Trash2 size={14} /></button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div>
        <div className="flex items-center mb-2">
          <h4 className="text-sm font-semibold text-surface-800">{t('training.skills')}</h4>
          {canEdit && skills && <Button size="sm" className="ms-auto" onClick={saveSkills} loading={busy}><Save size={14} /> {t('common.save')}</Button>}
        </div>
        {shownSkills.length === 0 && <p className="text-xs text-surface-400 mb-2">{t('training.no_skills')}</p>}
        <div className="space-y-1.5">
          {shownSkills.map((s, i) => (
            <div key={s.skill_id} className="flex items-center gap-2 text-sm">
              <span className="flex-1 text-surface-800">{s.name}{s.category && <span className="text-[11px] text-surface-400 ms-1.5">{s.category}</span>}</span>
              <div className="inline-flex gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} type="button" disabled={!canEdit}
                    onClick={() => setSkills(shownSkills.map((x, j) => (j === i ? { ...x, level: n } : x)))}
                    className={`w-6 h-6 rounded text-[11px] border ${s.level >= n ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-surface-400 border-surface-200'}`}>{n}</button>
                ))}
              </div>
              {canEdit && <button type="button" onClick={() => setSkills(shownSkills.filter((_, j) => j !== i))} className="p-1 text-surface-400 hover:text-red-600" aria-label={t('common.delete')}><Trash2 size={13} /></button>}
            </div>
          ))}
        </div>
        {canEdit && (
          <select value="" onChange={(e) => {
            const sk = catalog.find((c) => String(c.id) === e.target.value);
            if (sk && !shownSkills.some((x) => x.skill_id === sk.id)) setSkills([...shownSkills, { skill_id: sk.id, name: sk.name, category: sk.category_name, level: 3 }]);
          }} className={`${input} mt-2`}>
            <option value="">{t('training.add_skill')}</option>
            {catalog.filter((c) => !shownSkills.some((x) => x.skill_id === c.id)).map((c) => <option key={c.id} value={c.id}>{c.category_name} · {c.name}</option>)}
          </select>
        )}
      </div>
    </div>
  );
}
