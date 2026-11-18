import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { Gavel, Plus, Loader2, Trash2, Lock, Unlock } from 'lucide-react';
import Card from '@components/ui/Card';
import Button from '@components/ui/Button';
import Badge from '@components/ui/Badge';
import Modal from '@components/ui/Modal';
import * as hrApi from '@api/hrServicesApi';
import * as employeesApi from '@api/employeesApi';
import { confirmDelete } from '@utils/confirm';
import { CASE_CATEGORIES, CASE_ACTIONS, keyOf } from '@utils/hrServices';

const input = 'w-full text-sm border border-surface-200 rounded-lg px-3 py-2 mt-1 bg-white';
const label = 'text-xs font-semibold text-surface-700';
const ACTION_VARIANT = {
  Counselling: 'info', 'Verbal Warning': 'info', 'Written Warning': 'warning', 'Final Warning': 'danger', Suspension: 'danger', Termination: 'danger',
};

/**
 * The disciplinary file: what happened, the action taken, the employee's
 * response, and the letter issued for it (from Legal letters). HR only.
 */
export default function Disciplinary() {
  const { t } = useTranslation();
  const isAdmin = useSelector((s) => s.auth.user?.role) === 'admin';
  const { currentCompanyId } = useSelector((s) => s.entity);
  const [status, setStatus] = useState('');
  const [reload, setReload] = useState(0);
  const key = `${currentCompanyId ?? 'all'}:${status}:${reload}`;
  const [state, setState] = useState({ key: null, items: [] });
  const [lookups, setLookups] = useState({ people: [], letters: [] });
  const [form, setForm] = useState(null);

  useEffect(() => {
    let off = false;
    hrApi.getCases(status ? { status } : {})
      .then(({ data }) => { if (!off) setState({ key, items: data }); })
      .catch(() => { if (!off) { setState({ key, items: [] }); toast.error(t('common.failed_load')); } });
    return () => { off = true; };
  }, [key, status, t]);

  useEffect(() => {
    let off = false;
    Promise.all([
      employeesApi.getEmployees({ limit: 500 }).catch(() => ({ data: { data: [] } })),
      hrApi.getCaseLetters().catch(() => ({ data: [] })),
    ]).then(([e, l]) => {
      if (!off) setLookups({ people: (e.data.data || []).map((p) => ({ id: p.id, name: `${p.first_name} ${p.last_name}` })), letters: l.data });
    });
    return () => { off = true; };
  }, [currentCompanyId]);

  const refresh = () => setReload((n) => n + 1);
  const save = async () => {
    try {
      if (form.id) await hrApi.updateCase(form.id, { employee_response: form.employee_response, letter_id: form.letter_id || null });
      else await hrApi.createCase(form);
      toast.success(t('disciplinary.saved')); setForm(null); refresh();
    } catch (e) { toast.error(e?.response?.data?.error || t('common.operation_failed')); }
  };
  const toggle = async (c) => {
    try { await hrApi.updateCase(c.id, { status: c.status === 'Open' ? 'Closed' : 'Open' }); refresh(); }
    catch (e) { toast.error(e?.response?.data?.error || t('common.operation_failed')); }
  };
  const remove = async (c) => {
    if (!(await confirmDelete(`${t(`disciplinary.action.${keyOf(c.action)}`)} · ${c.employee_name}`)).isConfirmed) return;
    try { await hrApi.deleteCase(c.id); refresh(); }
    catch (e) { toast.error(e?.response?.data?.error || t('common.operation_failed')); }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 flex items-center gap-2"><Gavel className="text-brand-600" /> {t('disciplinary.title')}</h1>
          <p className="text-sm text-surface-500 mt-1">{t('disciplinary.subtitle')}</p>
        </div>
        <div className="ms-auto flex gap-2">
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="text-sm border border-surface-200 rounded-lg px-3 py-2 bg-white">
            <option value="">{t('disciplinary.all')}</option><option value="Open">{t('disciplinary.status_open')}</option><option value="Closed">{t('disciplinary.status_closed')}</option>
          </select>
          <Button onClick={() => setForm({ employee_id: '', category: 'Attendance', action: 'Verbal Warning', incident_date: '', description: '', employee_response: '', letter_id: '' })}><Plus size={16} /> {t('disciplinary.new')}</Button>
        </div>
      </div>

      {state.key !== key ? <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 text-brand-600 animate-spin" /></div>
        : state.items.length === 0 ? <Card><p className="text-sm text-surface-400 text-center py-6">{t('disciplinary.none')}</p></Card> : (
          <Card className="!p-0 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-surface-50 text-surface-500 text-xs"><tr>
                <th className="text-start p-3">{t('disciplinary.col.employee')}</th><th className="text-start p-3">{t('disciplinary.col.date')}</th>
                <th className="text-start p-3">{t('disciplinary.col.action')}</th><th className="text-start p-3">{t('disciplinary.col.letter')}</th><th className="p-3" />
              </tr></thead>
              <tbody>
                {state.items.map((c) => (
                  <tr key={c.id} className={`border-t border-surface-50 ${c.status === 'Closed' ? 'opacity-60' : ''}`}>
                    <td className="p-3"><button type="button" onClick={() => setForm({ ...c, letter_id: c.letter_id || '', employee_response: c.employee_response || '' })} className="text-surface-800 hover:text-brand-700 text-start">{c.employee_name}</button>
                      {c.department && <span className="block text-[11px] text-surface-400">{c.department}</span>}</td>
                    <td className="p-3 text-xs whitespace-nowrap">{c.incident_date}<span className="block text-surface-400">{t(`disciplinary.category.${keyOf(c.category)}`)}</span></td>
                    <td className="p-3"><Badge variant={ACTION_VARIANT[c.action] || 'info'} className="text-[10px]">{t(`disciplinary.action.${keyOf(c.action)}`)}</Badge></td>
                    <td className="p-3 text-xs text-surface-500">{c.letter_id ? `${c.letter_type || ''} #${c.letter_id}` : '—'}</td>
                    <td className="p-3 text-end whitespace-nowrap">
                      <button type="button" onClick={() => toggle(c)} className="p-1.5 text-surface-400 hover:text-brand-600" title={c.status === 'Open' ? t('disciplinary.close') : t('disciplinary.reopen')} aria-label={c.status === 'Open' ? t('disciplinary.close') : t('disciplinary.reopen')}>
                        {c.status === 'Open' ? <Lock size={14} /> : <Unlock size={14} />}
                      </button>
                      {isAdmin && <button type="button" onClick={() => remove(c)} className="p-1.5 text-surface-400 hover:text-red-600" aria-label={t('common.delete')}><Trash2 size={14} /></button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}

      {form && (
        <Modal open onClose={() => setForm(null)} title={form.id ? `${form.employee_name} · ${form.incident_date}` : t('disciplinary.new')} size="md">
          <div className="space-y-3">
            {!form.id ? (
              <>
                <div><label className={label}>{t('disciplinary.col.employee')} *</label>
                  <select value={form.employee_id} onChange={(e) => setForm((p) => ({ ...p, employee_id: e.target.value }))} className={input}>
                    <option value="">—</option>{lookups.people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select></div>
                <div className="grid grid-cols-3 gap-3">
                  <div><label className={label}>{t('disciplinary.f_category')}</label>
                    <select value={form.category} onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))} className={input}>
                      {CASE_CATEGORIES.map((c) => <option key={c} value={c}>{t(`disciplinary.category.${keyOf(c)}`)}</option>)}
                    </select></div>
                  <div><label className={label}>{t('disciplinary.col.action')}</label>
                    <select value={form.action} onChange={(e) => setForm((p) => ({ ...p, action: e.target.value }))} className={input}>
                      {CASE_ACTIONS.map((a) => <option key={a} value={a}>{t(`disciplinary.action.${keyOf(a)}`)}</option>)}
                    </select></div>
                  <div><label className={label}>{t('disciplinary.col.date')} *</label>
                    <input type="date" value={form.incident_date} onChange={(e) => setForm((p) => ({ ...p, incident_date: e.target.value }))} className={input} /></div>
                </div>
                <div><label className={label}>{t('disciplinary.f_description')} *</label>
                  <textarea rows={4} value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} className={input} /></div>
              </>
            ) : (
              <div className="text-sm space-y-1 bg-surface-50 rounded-xl p-3">
                <p><Badge variant={ACTION_VARIANT[form.action] || 'info'} className="text-[10px]">{t(`disciplinary.action.${keyOf(form.action)}`)}</Badge> <span className="text-xs text-surface-500 ms-1">{t(`disciplinary.category.${keyOf(form.category)}`)} · {t('disciplinary.by', { name: form.issued_by_name || '—' })}</span></p>
                <p className="text-surface-700 whitespace-pre-wrap">{form.description}</p>
              </div>
            )}
            <div><label className={label}>{t('disciplinary.f_response')}</label>
              <textarea rows={3} value={form.employee_response} onChange={(e) => setForm((p) => ({ ...p, employee_response: e.target.value }))} className={input} /></div>
            <div><label className={label}>{t('disciplinary.f_letter')}</label>
              <select value={form.letter_id} onChange={(e) => setForm((p) => ({ ...p, letter_id: e.target.value }))} className={input}>
                <option value="">—</option>
                {lookups.letters.map((l) => <option key={l.id} value={l.id}>#{l.id} · {l.letter_type} · {l.recipient_name} · {l.generated_on}</option>)}
              </select>
              <p className="text-[11px] text-surface-400 mt-1">{t('disciplinary.letter_hint')}</p></div>
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
