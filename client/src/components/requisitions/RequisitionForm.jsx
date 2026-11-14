import { useState } from 'react';
import { toast } from 'react-toastify';
import Modal from '@components/ui/Modal';
import Button from '@components/ui/Button';
import * as requisitionsApi from '@api/requisitionsApi';

const input = 'w-full text-sm border border-surface-200 rounded-lg px-3 py-2 mt-1 bg-white';
const label = 'text-xs font-semibold text-surface-700';

/**
 * Ask for a hire: the role, how many, new or replacing someone, the salary
 * range and why. Departments and job titles are offered where the caller can
 * see them (HR); a manager names the role in words.
 */
export default function RequisitionForm({ t, onClose, onSaved, people = [], departments = [], jobTitles = [] }) {
  const [form, setForm] = useState({
    title: '', head_count: 1, reason: 'New', replaces_employee_id: '', department_id: '', job_title_id: '',
    budget_min: '', budget_max: '', target_start: '', justification: '',
  });
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));
  const save = async () => {
    setSaving(true);
    try {
      const { data } = await requisitionsApi.createRequisition(form);
      toast.success(data.in_approval_chain ? t('requisitions.sent_chain') : t('requisitions.sent'));
      onSaved();
    } catch (e) { toast.error(e?.response?.data?.error || t('common.operation_failed')); }
    finally { setSaving(false); }
  };
  return (
    <Modal open onClose={onClose} title={t('requisitions.new')} size="md">
      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2"><label className={label}>{t('requisitions.f.title')} *</label>
            <input value={form.title} onChange={set('title')} maxLength={200} className={input} /></div>
          <div><label className={label}>{t('requisitions.f.head_count')} *</label>
            <input type="number" min="1" max="50" value={form.head_count} onChange={set('head_count')} className={input} /></div>
        </div>
        {(departments.length > 0 || jobTitles.length > 0) && (
          <div className="grid grid-cols-2 gap-3">
            <div><label className={label}>{t('requisitions.f.department')}</label>
              <select value={form.department_id} onChange={set('department_id')} className={input}>
                <option value="">—</option>{departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select></div>
            <div><label className={label}>{t('requisitions.f.job_title')}</label>
              <select value={form.job_title_id} onChange={set('job_title_id')} className={input}>
                <option value="">—</option>{jobTitles.map((j) => <option key={j.id} value={j.id}>{j.title}</option>)}
              </select></div>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div><label className={label}>{t('requisitions.f.reason')} *</label>
            <select value={form.reason} onChange={set('reason')} className={input}>
              <option value="New">{t('requisitions.reason.new')}</option>
              <option value="Replacement">{t('requisitions.reason.replacement')}</option>
            </select></div>
          {form.reason === 'Replacement' && (
            <div><label className={label}>{t('requisitions.f.replaces')} *</label>
              <select value={form.replaces_employee_id} onChange={set('replaces_employee_id')} className={input}>
                <option value="">—</option>{people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select></div>
          )}
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div><label className={label}>{t('requisitions.f.budget_min')}</label><input type="number" min="0" value={form.budget_min} onChange={set('budget_min')} className={input} /></div>
          <div><label className={label}>{t('requisitions.f.budget_max')}</label><input type="number" min="0" value={form.budget_max} onChange={set('budget_max')} className={input} /></div>
          <div><label className={label}>{t('requisitions.f.target_start')}</label><input type="date" value={form.target_start} onChange={set('target_start')} className={input} /></div>
        </div>
        <div><label className={label}>{t('requisitions.f.justification')} *</label>
          <textarea rows={3} value={form.justification} onChange={set('justification')} maxLength={2000} className={input} /></div>
        <p className="text-[11px] text-surface-500">{t('requisitions.form_hint')}</p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button>
          <Button onClick={save} loading={saving}>{t('requisitions.send')}</Button>
        </div>
      </div>
    </Modal>
  );
}
