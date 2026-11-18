import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { HeartHandshake, Plus, Loader2, Trash2 } from 'lucide-react';
import Card from '@components/ui/Card';
import Button from '@components/ui/Button';
import Modal from '@components/ui/Modal';
import * as benefitsApi from '@api/benefitsApi';
import { confirmDelete } from '@utils/confirm';

const input = 'w-full text-sm border border-surface-200 rounded-lg px-3 py-2 mt-1 bg-white';
const label = 'text-xs font-semibold text-surface-700';

/**
 * Benefits: the companies' group insurance policies, and what needs doing in
 * the next 60 days (cover ending, air tickets falling due). Each person's
 * enrolment and ticket are set on their profile, Benefits tab.
 */
export default function Benefits() {
  const { t } = useTranslation();
  const isAdmin = useSelector((s) => s.auth.user?.role) === 'admin';
  const { currentCompanyId } = useSelector((s) => s.entity);
  const [reload, setReload] = useState(0);
  const key = `${currentCompanyId ?? 'all'}:${reload}`;
  const [state, setState] = useState({ key: null, policies: [], overview: null });
  const [form, setForm] = useState(null);

  useEffect(() => {
    let off = false;
    Promise.all([benefitsApi.getPolicies(), benefitsApi.getOverview()])
      .then(([p, o]) => { if (!off) setState({ key, policies: p.data, overview: o.data }); })
      .catch(() => { if (!off) { setState({ key, policies: [], overview: { insurance_ending: [], tickets_due: [] } }); toast.error(t('common.failed_load')); } });
    return () => { off = true; };
  }, [key, t]);

  const save = async () => {
    try {
      if (form.id) await benefitsApi.updatePolicy(form.id, form); else await benefitsApi.createPolicy(form);
      toast.success(t('benefits.saved')); setForm(null); setReload((n) => n + 1);
    } catch (e) { toast.error(e?.response?.data?.error || t('common.operation_failed')); }
  };
  const remove = async (p) => {
    if (!(await confirmDelete(`${p.provider} ${p.policy_number || ''}`)).isConfirmed) return;
    try { await benefitsApi.deletePolicy(p.id); setReload((n) => n + 1); }
    catch (e) { toast.error(e?.response?.data?.error || t('common.operation_failed')); }
  };

  const ready = state.key === key;
  const o = state.overview;
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 flex items-center gap-2"><HeartHandshake className="text-brand-600" /> {t('benefits.title')}</h1>
          <p className="text-sm text-surface-500 mt-1">{t('benefits.subtitle')}</p>
        </div>
        <Button className="ms-auto" onClick={() => setForm({ provider: '', policy_number: '', plan_name: '', start_date: '', end_date: '', notes: '' })}><Plus size={16} /> {t('benefits.new_policy')}</Button>
      </div>

      {!ready ? <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 text-brand-600 animate-spin" /></div> : (
        <>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <Card className="!p-0 overflow-hidden">
              <h3 className="px-4 pt-4 pb-2 text-sm font-semibold text-surface-800">{t('benefits.cover_ending')}</h3>
              {o.insurance_ending.length === 0 ? <p className="text-sm text-surface-400 text-center py-6">{t('benefits.nothing_due')}</p> : (
                <ul className="divide-y divide-surface-50">{o.insurance_ending.map((r) => (
                  <li key={r.employee_id} className="px-4 py-2 flex text-sm"><span className="flex-1">{r.employee_name}</span><span className="text-xs text-surface-500">{r.provider} · {r.ends_on}</span></li>
                ))}</ul>
              )}
            </Card>
            <Card className="!p-0 overflow-hidden">
              <h3 className="px-4 pt-4 pb-2 text-sm font-semibold text-surface-800">{t('benefits.tickets_due')}</h3>
              {o.tickets_due.length === 0 ? <p className="text-sm text-surface-400 text-center py-6">{t('benefits.nothing_due')}</p> : (
                <ul className="divide-y divide-surface-50">{o.tickets_due.map((r) => (
                  <li key={r.employee_id} className="px-4 py-2 flex text-sm"><span className="flex-1">{r.employee_name}</span><span className="text-xs text-surface-500">{r.destination || '—'} · {r.due}</span></li>
                ))}</ul>
              )}
            </Card>
          </div>

          <Card className="!p-0 overflow-hidden">
            <h3 className="px-4 pt-4 pb-2 text-sm font-semibold text-surface-800">{t('benefits.policies')}</h3>
            {state.policies.length === 0 ? <p className="text-sm text-surface-400 text-center py-6">{t('benefits.no_policies')}</p> : (
              <table className="w-full text-sm">
                <thead className="bg-surface-50 text-surface-500 text-xs"><tr>
                  <th className="text-start p-3">{t('benefits.provider')}</th><th className="text-start p-3">{t('benefits.period')}</th>
                  <th className="p-3">{t('benefits.enrolled')}</th><th className="p-3" />
                </tr></thead>
                <tbody>
                  {state.policies.map((p) => (
                    <tr key={p.id} className="border-t border-surface-50">
                      <td className="p-3"><button type="button" onClick={() => setForm({ ...p })} className="text-surface-800 hover:text-brand-700 text-start">{p.provider}</button>
                        <span className="block text-[11px] text-surface-400">{[p.policy_number, p.plan_name, p.company_name].filter(Boolean).join(' · ')}</span></td>
                      <td className="p-3 text-xs">{p.start_date} → {p.end_date}</td>
                      <td className="p-3 text-center">{p.enrolled}</td>
                      <td className="p-3 text-end">{isAdmin && <button type="button" onClick={() => remove(p)} className="p-1.5 text-surface-400 hover:text-red-600" aria-label={t('common.delete')}><Trash2 size={14} /></button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
          <p className="text-[11px] text-surface-400">{t('benefits.page_hint')}</p>
        </>
      )}

      {form && (
        <Modal open onClose={() => setForm(null)} title={form.id ? form.provider : t('benefits.new_policy')} size="md">
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><label className={label}>{t('benefits.provider')} *</label><input value={form.provider} onChange={(e) => setForm((p) => ({ ...p, provider: e.target.value }))} className={input} /></div>
              <div><label className={label}>{t('benefits.policy_number')}</label><input value={form.policy_number || ''} onChange={(e) => setForm((p) => ({ ...p, policy_number: e.target.value }))} className={input} /></div>
              <div><label className={label}>{t('benefits.plan')}</label><input value={form.plan_name || ''} onChange={(e) => setForm((p) => ({ ...p, plan_name: e.target.value }))} className={input} /></div>
              <div />
              <div><label className={label}>{t('benefits.from')} *</label><input type="date" value={form.start_date || ''} onChange={(e) => setForm((p) => ({ ...p, start_date: e.target.value }))} className={input} /></div>
              <div><label className={label}>{t('benefits.to')} *</label><input type="date" value={form.end_date || ''} onChange={(e) => setForm((p) => ({ ...p, end_date: e.target.value }))} className={input} /></div>
            </div>
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
