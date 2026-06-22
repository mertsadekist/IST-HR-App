import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import * as kpiApi from '@api/kpiApi';
import Card from '@components/ui/Card';
import Button from '@components/ui/Button';
import Badge from '@components/ui/Badge';
import Modal from '@components/ui/Modal';
import Input from '@components/ui/Input';
import Select from '@components/ui/Select';
import EmptyState from '@components/ui/EmptyState';
import { confirmDelete } from '@utils/confirm';
import { toast } from 'react-toastify';
import { Award, Plus, DollarSign, Users, TrendingUp, CheckCircle, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';

export default function KPITracker() {
  const { t } = useTranslation();
  const { items: companies } = useSelector((s) => s.companies);
  const { currentCompanyId } = useSelector((s) => s.entity);
  const { user } = useSelector((s) => s.auth);
  const isAdmin = user?.role === 'admin'; // delete is admin-only
  const [hires, setHires] = useState([]);
  const [tiers, setTiers] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  const [hireModal, setHireModal] = useState(false);
  const [hireForm, setHireForm] = useState({ employee_name: '', role: '', company_id: '', join_date: '', notes: '', tier_ids: [] });
  const [saving, setSaving] = useState(false);

  const [tierModal, setTierModal] = useState(false);
  const [tierForm, setTierForm] = useState({ name: '', label: '', amount: '', icon: '🏅' });

  useEffect(() => { loadAll(); }, [currentCompanyId]);

  const loadAll = async () => {
    setLoading(true);
    try {
      const params = currentCompanyId ? { company_id: currentCompanyId } : {};
      const [hiresRes, tiersRes, summaryRes] = await Promise.all([
        kpiApi.getHires(params), kpiApi.getTiers(), kpiApi.getSummary()
      ]);
      setHires(hiresRes.data);
      setTiers(tiersRes.data);
      setSummary(summaryRes.data);
    } catch { toast.error(t('common.failed_load')); }
    finally { setLoading(false); }
  };

  const handleLogHire = async (e) => {
    e.preventDefault();
    if (!hireForm.employee_name || !hireForm.company_id || !hireForm.join_date) { toast.error(t('toasts.t_name_company_and_date_required')); return; }
    setSaving(true);
    try {
      await kpiApi.logHire({ ...hireForm, company_id: parseInt(hireForm.company_id) });
      toast.success(t('toasts.t_hire_logged'));
      setHireModal(false); loadAll();
    } catch { toast.error(t('common.error')); }
    finally { setSaving(false); }
  };

  const handleConfirm = async (hire) => {
    try { await kpiApi.confirmHire(hire.id); toast.success(t('toasts.t_confirmed')); loadAll(); }
    catch { toast.error(t('common.error')); }
  };

  const handleDelete = async (hire) => {
    const r = await confirmDelete(`hire "${hire.employee_name}"`);
    if (r.isConfirmed) { try { await kpiApi.deleteHire(hire.id); toast.success(t('common.deleted')); loadAll(); } catch { toast.error(t('common.error')); } }
  };

  const handleAddTier = async (e) => {
    e.preventDefault();
    try { await kpiApi.createTier({ ...tierForm, amount: parseFloat(tierForm.amount) }); toast.success(t('toasts.t_tier_added')); setTierModal(false); loadAll(); }
    catch { toast.error(t('common.error')); }
  };

  const toggleTier = (tierId) => {
    setHireForm(p => {
      const ids = p.tier_ids.includes(tierId) ? p.tier_ids.filter(id => id !== tierId) : [...p.tier_ids, tierId];
      return { ...p, tier_ids: ids };
    });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-surface-900">{t('kpi.title')}</h1>
          <p className="text-surface-500 mt-0.5 text-sm">{t('kpi.subtitle')}</p></div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => { setTierForm({ name: '', label: '', amount: '', icon: '🏅' }); setTierModal(true); }}><Plus size={14} /> {t('kpi.add_tier')}</Button>
          <Button onClick={() => { setHireForm({ employee_name: '', role: '', company_id: currentCompanyId ? String(currentCompanyId) : '', join_date: '', notes: '', tier_ids: [] }); setHireModal(true); }}><Plus size={16} /> {t('kpi.log_hire')}</Button>
        </div>
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: t('kpi.total_hires'), value: summary.totals?.total_hires || 0, icon: Users, color: 'text-brand-600' },
            { label: t('kpi.confirmed'), value: summary.totals?.confirmed || 0, icon: CheckCircle, color: 'text-emerald-600' },
            { label: t('kpi.pending'), value: summary.totals?.pending || 0, icon: TrendingUp, color: 'text-amber-600' },
            { label: t('kpi.total_commission'), value: `${Number(summary.totals?.total_commission || 0).toLocaleString()} AED`, icon: DollarSign, color: 'text-green-600' },
          ].map((s, i) => (
            <Card key={i} className="!p-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl bg-surface-50 flex items-center justify-center ${s.color}`}><s.icon size={20} /></div>
                <div><p className="text-2xl font-bold text-surface-800">{s.value}</p><p className="text-[10px] text-surface-400 uppercase">{s.label}</p></div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Commission Tiers */}
      {tiers.length > 0 && (
        <div className="mb-6">
          <h2 className="font-semibold text-surface-700 mb-3">{t('kpi.commission_tiers')}</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {tiers.map(t => (
              <Card key={t.id} className="!p-4 border-t-4 border-t-brand-500">
                <div className="text-2xl mb-1">{t.icon}</div>
                <div className="text-lg font-bold text-brand-600">{Number(t.amount).toLocaleString()} {t.currency || 'AED'}</div>
                <div className="text-sm font-semibold text-surface-800 mt-1">{t.name}</div>
                {t.label && <div className="text-xs text-surface-500 mt-1">{t.label}</div>}
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Quarterly Targets */}
      <div className="mb-6">
        <h2 className="font-semibold text-surface-700 mb-3">📊 {t('kpi.targets')}</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Q1 Sales Hires', target: '20', unit: 'agents', current: hires.length },
            { label: 'Q1 Retention Rate', target: '85', unit: '%', current: 92 },
            { label: 'Avg Time to Hire', target: '14', unit: 'days', current: 12 }
          ].map((t, i) => (
            <div key={i} className="bg-surface-50 border-l-4 border-surface-800 rounded-lg p-4 shadow-sm">
              <div className="text-xs text-surface-500 mb-1">{t.label}</div>
              <div className="flex items-baseline gap-1">
                <span className="text-xl font-bold text-surface-900">{t.current}</span>
                <span className="text-surface-400">/</span>
                <span className="text-lg font-semibold text-surface-700">{t.target}</span>
                <span className="text-xs text-surface-500 ml-1">{t.unit}</span>
              </div>
              <div className="w-full bg-surface-200 h-1.5 rounded-full mt-3 overflow-hidden">
                <div className="bg-surface-800 h-full rounded-full" style={{ width: `${Math.min(100, (t.current / parseInt(t.target)) * 100)}%` }}></div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Hires by company */}
      {summary?.byCompany?.length > 0 && (
        <div className="flex gap-3 flex-wrap">
          {summary.byCompany.map((c, i) => (
            <div key={i} className="px-3 py-2 rounded-xl border border-surface-200 text-xs flex items-center gap-2">
              <span className="px-1.5 py-0.5 rounded text-[9px] font-medium text-white" style={{ backgroundColor: c.color_primary || '#6D28D9' }}>{c.short_code}</span>
              <span className="font-medium text-surface-700">{c.count} hires</span>
              <span className="text-surface-400">·</span>
              <span className="text-emerald-600 font-medium">{Number(c.commission || 0).toLocaleString()} AED</span>
            </div>
          ))}
        </div>
      )}

      {/* Hires table */}
      {loading ? (
        <Card className="!p-6 animate-pulse"><div className="h-4 bg-surface-200 rounded w-1/3 mb-2" /><div className="h-3 bg-surface-100 rounded w-2/3" /></Card>
      ) : hires.length === 0 ? (
        <Card><EmptyState icon={<Award className="w-6 h-6 text-surface-400" />} title={t('kpi.no_hires')} description={t('kpi.no_hires_desc')}
          action={<Button onClick={() => setHireModal(true)}><Plus size={16} /> {t('kpi.log_hire')}</Button>} /></Card>
      ) : (
        <Card className="!p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-surface-100 bg-surface-50/60">
                <th className="text-left px-5 py-3 font-medium text-surface-500">{t('kpi.employee')}</th>
                <th className="text-left px-5 py-3 font-medium text-surface-500">{t('kpi.role')}</th>
                <th className="text-left px-5 py-3 font-medium text-surface-500">{t('kpi.company')}</th>
                <th className="text-left px-5 py-3 font-medium text-surface-500">{t('kpi.join_date')}</th>
                <th className="text-left px-5 py-3 font-medium text-surface-500">{t('kpi.tiers')}</th>
                <th className="text-left px-5 py-3 font-medium text-surface-500">{t('kpi.commission')}</th>
                <th className="text-left px-5 py-3 font-medium text-surface-500">{t('kpi.status')}</th>
                <th className="text-right px-5 py-3 font-medium text-surface-500">{t('kpi.actions')}</th>
              </tr></thead>
              <tbody>
                {hires.map(h => (
                  <tr key={h.id} className="border-b border-surface-50 hover:bg-surface-50/50 transition-colors group">
                    <td className="px-5 py-3 font-medium text-surface-800">{h.employee_name}</td>
                    <td className="px-5 py-3 text-surface-600 text-xs">{h.role || '—'}</td>
                    <td className="px-5 py-3"><span className="px-2 py-0.5 rounded text-[10px] font-medium text-white" style={{ backgroundColor: h.color_primary || '#6D28D9' }}>{h.short_code}</span></td>
                    <td className="px-5 py-3 text-xs text-surface-400">{dayjs(h.join_date).format('MMM D, YYYY')}</td>
                    <td className="px-5 py-3"><div className="flex gap-0.5">{(h.tiers || []).map(t => <span key={t.id} title={`${t.name}: ${t.amount} ${t.currency}`} className="text-sm">{t.icon}</span>)}</div></td>
                    <td className="px-5 py-3 font-semibold text-emerald-600">{Number(h.total_commission || h.commission || 0).toLocaleString()} AED</td>
                    <td className="px-5 py-3"><Badge variant={h.status === 'Confirmed' ? 'success' : 'warning'} className="text-[10px]">{h.status}</Badge></td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {h.status === 'Pending' && <button onClick={() => handleConfirm(h)} className="p-1.5 text-surface-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors" title="Confirm"><CheckCircle size={14} /></button>}
                        {isAdmin && <button onClick={() => handleDelete(h)} className="p-1.5 text-surface-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={14} /></button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Log Hire Modal */}
      <Modal open={hireModal} onClose={() => setHireModal(false)} title={t('kpi.log_hire')} size="md">
        <form onSubmit={handleLogHire} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label={t('kpi.employee')} required placeholder="Full name" value={hireForm.employee_name} onChange={(e) => setHireForm(p => ({ ...p, employee_name: e.target.value }))} />
            <Input label={t('kpi.role')} placeholder="Job title" value={hireForm.role} onChange={(e) => setHireForm(p => ({ ...p, role: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Select label={t('kpi.company')} required value={hireForm.company_id} onChange={(e) => setHireForm(p => ({ ...p, company_id: e.target.value }))}
              options={companies.map(c => ({ value: String(c.id), label: c.name }))} placeholder="..." />
            <Input label={t('kpi.join_date')} type="date" required value={hireForm.join_date} onChange={(e) => setHireForm(p => ({ ...p, join_date: e.target.value }))} />
          </div>
          {tiers.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-surface-700 mb-1.5">{t('kpi.commission_tiers')}</label>
              <div className="flex gap-2 flex-wrap">
                {tiers.map(t => (
                  <button key={t.id} type="button" onClick={() => toggleTier(t.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${hireForm.tier_ids.includes(t.id) ? 'bg-brand-50 border-brand-300 text-brand-700' : 'bg-surface-50 border-surface-200 text-surface-600 hover:border-surface-300'}`}>
                    {t.icon} {t.name} — {Number(t.amount).toLocaleString()} {t.currency}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div><label className="block text-sm font-medium text-surface-700 mb-1.5">{t('kpi.notes')}</label>
            <textarea placeholder="..." value={hireForm.notes} onChange={(e) => setHireForm(p => ({ ...p, notes: e.target.value }))} rows={2}
              className="w-full px-3 py-2.5 text-sm bg-white border border-surface-200 rounded-xl input-focus transition-all resize-none" /></div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setHireModal(false)}>{t('common.cancel')}</Button>
            <Button type="submit" loading={saving}>{t('kpi.log_hire')}</Button>
          </div>
        </form>
      </Modal>

      {/* Add Tier Modal */}
      <Modal open={tierModal} onClose={() => setTierModal(false)} title={t('kpi.add_commission_tier')} size="sm">
        <form onSubmit={handleAddTier} className="space-y-4">
          <Input label={t('kpi.tier_name')} required placeholder="e.g. Standard Hire" value={tierForm.name} onChange={(e) => setTierForm(p => ({ ...p, name: e.target.value }))} />
          <Input label={t('kpi.label')} placeholder="Display label" value={tierForm.label} onChange={(e) => setTierForm(p => ({ ...p, label: e.target.value }))} />
          <div className="grid grid-cols-2 gap-4">
            <Input label={t('kpi.amount_aed')} type="number" required placeholder="500" value={tierForm.amount} onChange={(e) => setTierForm(p => ({ ...p, amount: e.target.value }))} />
            <Input label={t('kpi.icon')} placeholder="🏅" value={tierForm.icon} onChange={(e) => setTierForm(p => ({ ...p, icon: e.target.value }))} />
          </div>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => setTierModal(false)}>{t('common.cancel')}</Button>
            <Button type="submit">{t('common.add')}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
