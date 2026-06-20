import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import * as performanceApi from '@api/performanceApi';
import * as employeesApi from '@api/employeesApi';
import Card from '@components/ui/Card';
import Button from '@components/ui/Button';
import Badge from '@components/ui/Badge';
import Modal from '@components/ui/Modal';
import Input from '@components/ui/Input';
import Select from '@components/ui/Select';
import EmptyState from '@components/ui/EmptyState';
import { confirmDelete } from '@utils/confirm';
import { toast } from 'react-toastify';
import { Target, Plus, CheckCircle, Trash2, Edit3 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import EmailButton from '@components/email/EmailButton';

const currentYear = new Date().getFullYear();
const quarters = [`Q1 ${currentYear}`, `Q2 ${currentYear}`, `Q3 ${currentYear}`, `Q4 ${currentYear}`];

export default function Performance() {
  const { t } = useTranslation();
  const { items: companies } = useSelector((s) => s.companies);
  const { currentCompanyId } = useSelector((s) => s.entity);
  const [targets, setTargets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [qFilter, setQFilter] = useState('');
  const [employees, setEmployees] = useState([]);

  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ employee_id: '', company_id: '', quarter: '', target_amount: '', currency: 'AED', kpi_notes: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadTargets(); }, [currentCompanyId, qFilter]);

  const loadTargets = async () => {
    setLoading(true);
    try {
      const params = {};
      if (currentCompanyId) params.company_id = currentCompanyId;
      if (qFilter) params.quarter = qFilter;
      const { data } = await performanceApi.getTargets(params);
      setTargets(data);
    } catch { toast.error(t('common.failed_load')); }
    finally { setLoading(false); }
  };

  const openAdd = async () => {
    try {
      const params = currentCompanyId ? { company_id: currentCompanyId, limit: 200 } : { limit: 200 };
      const { data } = await employeesApi.getEmployees(params);
      setEmployees(data.data || []);
    } catch { /* ignore */ }
    setForm({ employee_id: '', company_id: currentCompanyId ? String(currentCompanyId) : '', quarter: quarters[0], target_amount: '', currency: 'AED', kpi_notes: '' });
    setModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.employee_id || !form.quarter) { toast.error(t('toasts.t_employee_and_quarter_required')); return; }
    setSaving(true);
    try {
      await performanceApi.createTarget({
        ...form,
        employee_id: parseInt(form.employee_id),
        company_id: form.company_id ? parseInt(form.company_id) : null,
        target_amount: form.target_amount ? parseFloat(form.target_amount) : null,
      });
      toast.success(t('toasts.t_target_created'));
      setModal(false); loadTargets();
    } catch { toast.error(t('common.error')); }
    finally { setSaving(false); }
  };

  const handleSign = async (target) => {
    try { await performanceApi.signTarget(target.id); toast.success(t('toasts.t_target_signed')); loadTargets(); }
    catch { toast.error(t('common.error')); }
  };

  const handleDelete = async (target) => {
    const r = await confirmDelete(`target for ${target.first_name} ${target.last_name}`);
    if (r.isConfirmed) { try { await performanceApi.deleteTarget(target.id); toast.success(t('common.deleted')); loadTargets(); } catch { toast.error(t('common.error')); } }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-surface-900">{t('lifecycle.performance')}</h1>
          <p className="text-surface-500 mt-0.5 text-sm">{t('lifecycle.performance_desc')}</p></div>
        <Button onClick={openAdd}><Plus size={16} /> {t('lifecycle.add_target')}</Button>
      </div>

      <div className="flex gap-1 flex-wrap">
        <button onClick={() => setQFilter('')} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${!qFilter ? 'bg-brand-700 text-white' : 'bg-surface-100 text-surface-600 hover:bg-surface-200'}`}>{t('lifecycle.all')}</button>
        {quarters.map(q => (
          <button key={q} onClick={() => setQFilter(q)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${qFilter === q ? 'bg-brand-700 text-white' : 'bg-surface-100 text-surface-600 hover:bg-surface-200'}`}>{q}</button>
        ))}
        <Badge variant="brand" className="ml-2">{targets.length} {t('lifecycle.targets', 'targets')}</Badge>
      </div>

      {loading ? (
        <div className="space-y-3">{[1,2].map(i => <div key={i} className="card p-4 animate-pulse"><div className="h-4 bg-surface-200 rounded w-1/3 mb-2" /><div className="h-3 bg-surface-100 rounded w-2/3" /></div>)}</div>
      ) : targets.length === 0 ? (
        <Card><EmptyState icon={<Target className="w-6 h-6 text-surface-400" />} title={t('lifecycle.no_targets')} description={t('lifecycle.no_targets_desc')}
          action={<Button onClick={openAdd}><Plus size={16} /> {t('lifecycle.add_target')}</Button>} /></Card>
      ) : (
        <Card className="!p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-surface-100 bg-surface-50/60">
                <th className="text-left px-5 py-3 font-medium text-surface-500">{t('lifecycle.employee')}</th>
                <th className="text-left px-5 py-3 font-medium text-surface-500">{t('lifecycle.company')}</th>
                <th className="text-left px-5 py-3 font-medium text-surface-500">{t('lifecycle.quarter')}</th>
                <th className="text-left px-5 py-3 font-medium text-surface-500">{t('lifecycle.target')}</th>
                <th className="text-left px-5 py-3 font-medium text-surface-500">{t('lifecycle.signed')}</th>
                <th className="text-right px-5 py-3 font-medium text-surface-500">{t('lifecycle.actions')}</th>
              </tr></thead>
              <tbody>
                {targets.map(tgt => (
                  <tr key={tgt.id} className="border-b border-surface-50 hover:bg-surface-50/50 transition-colors group">
                    <td className="px-5 py-3">
                      <p className="font-medium text-surface-800">{tgt.first_name} {tgt.last_name}</p>
                      {tgt.kpi_notes && <p className="text-[10px] text-surface-400 line-clamp-1 mt-0.5">{tgt.kpi_notes}</p>}
                    </td>
                    <td className="px-5 py-3"><span className="px-2 py-0.5 rounded text-[10px] font-medium text-white" style={{ backgroundColor: tgt.color_primary || '#6D28D9' }}>{tgt.short_code}</span></td>
                    <td className="px-5 py-3"><Badge variant="info" className="text-[10px]">{tgt.quarter}</Badge></td>
                    <td className="px-5 py-3 font-semibold text-surface-800">{tgt.target_amount ? `${Number(tgt.target_amount).toLocaleString()} ${tgt.currency}` : '—'}</td>
                    <td className="px-5 py-3">
                      {tgt.signed_at ? (
                        <span className="flex items-center gap-1 text-emerald-600 text-xs font-medium"><CheckCircle size={12} /> {dayjs(tgt.signed_at).format('MMM D')}</span>
                      ) : (
                        <button onClick={() => handleSign(tgt)} className="text-xs text-brand-600 hover:text-brand-700 font-medium hover:underline">{t('lifecycle.sign_now')}</button>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <EmailButton
                          variant="icon"
                          to={tgt.email || ''}
                          toName={`${tgt.first_name} ${tgt.last_name}`}
                          templateType="performance_review"
                          templateData={{ name: `${tgt.first_name} ${tgt.last_name}`, quarter: tgt.quarter, target_amount: tgt.target_amount ? `${Number(tgt.target_amount).toLocaleString()} ${tgt.currency}` : '', kpi_notes: tgt.kpi_notes, company: tgt.company_name }}
                          relatedModule="Performance"
                          relatedId={tgt.id}
                          companyId={tgt.company_id}
                        />
                        <button onClick={() => handleDelete(tgt)} className="p-1.5 text-surface-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title={t('lifecycle.add_target')} size="md">
        <form onSubmit={handleSave} className="space-y-4">
          <Select label={t('lifecycle.employee')} required value={form.employee_id} onChange={(e) => setForm(p => ({ ...p, employee_id: e.target.value }))}
            options={employees.map(em => ({ value: String(em.id), label: `${em.first_name} ${em.last_name}` }))} placeholder={t('lifecycle.select_employee')} />
          <div className="grid grid-cols-2 gap-4">
            <Select label={t('lifecycle.company')} value={form.company_id} onChange={(e) => setForm(p => ({ ...p, company_id: e.target.value }))}
              options={companies.map(c => ({ value: String(c.id), label: c.name }))} placeholder={t('lifecycle.select_employee')} />
            <Select label={t('lifecycle.quarter')} required value={form.quarter} onChange={(e) => setForm(p => ({ ...p, quarter: e.target.value }))}
              options={quarters.map(q => ({ value: q, label: q }))} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label={t('lifecycle.target_amount')} type="number" placeholder={t('lifecycle.eg_50000', 'e.g. 50000')} value={form.target_amount} onChange={(e) => setForm(p => ({ ...p, target_amount: e.target.value }))} />
            <Select label={t('lifecycle.currency')} value={form.currency} onChange={(e) => setForm(p => ({ ...p, currency: e.target.value }))}
              options={['AED', 'USD', 'EUR', 'GBP', 'SAR'].map(c => ({ value: c, label: c }))} />
          </div>
          <div><label className="block text-sm font-medium text-surface-700 mb-1.5">{t('lifecycle.kpi_notes')}</label>
            <textarea placeholder={t('lifecycle.kpi_placeholder', 'Performance criteria, objectives...')} value={form.kpi_notes} onChange={(e) => setForm(p => ({ ...p, kpi_notes: e.target.value }))} rows={3}
              className="w-full px-3 py-2.5 text-sm bg-white border border-surface-200 rounded-xl input-focus transition-all resize-none" /></div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setModal(false)}>{t('common.cancel')}</Button>
            <Button type="submit" loading={saving}>{t('lifecycle.create_target')}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
