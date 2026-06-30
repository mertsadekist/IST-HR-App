import { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { fetchCompanies } from '@store/slices/companiesSlice';
import * as settingsApi from '@api/settingsApi';
import * as legalApi from '@api/legalApi';
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
import { Plus, Edit3, Trash2, GripVertical, ArrowUp, ArrowDown, ListChecks, X, FileText, DollarSign } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function SystemConfig() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const { items: companies } = useSelector((s) => s.companies);
  const [activeTab, setActiveTab] = useState('ats');

  useEffect(() => { dispatch(fetchCompanies()); }, [dispatch]);

  const tabs = [
    { id: 'general', label: t('system_config.general'), icon: '🕒' },
    { id: 'ats', label: t('system_config.ats_stages'), icon: '🎯' },
    { id: 'onboarding', label: t('system_config.onboarding'), icon: '📋' },
    { id: 'offboarding', label: t('system_config.offboarding'), icon: '🚪' },
    { id: 'letters', label: t('system_config.letters'), icon: '📄' },
    { id: 'kpi', label: t('system_config.kpi_tiers'), icon: '💰' },
  ];

  return (
    <div className="space-y-4">
      {/* Sub-tabs */}
      <div className="flex gap-1.5 flex-wrap">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              activeTab === tab.id
                ? 'bg-brand-700 text-white shadow-sm'
                : 'bg-surface-100 text-surface-600 hover:bg-surface-200'
            }`}
          >
            <span className="mr-1.5">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'general' && <GeneralConfig />}
      {activeTab === 'ats' && <AtsStagesConfig />}
      {activeTab === 'onboarding' && <TemplateConfig type="onboarding" companies={companies} />}
      {activeTab === 'offboarding' && <TemplateConfig type="offboarding" companies={companies} />}
      {activeTab === 'letters' && <LetterTemplatesConfig />}
      {activeTab === 'kpi' && <KpiTiersConfig />}
    </div>
  );
}

// ==============================================
// General (timezone) Configuration
// ==============================================
const TIMEZONES = [
  'Asia/Dubai', 'Asia/Riyadh', 'Asia/Qatar', 'Asia/Kuwait', 'Asia/Bahrain', 'Asia/Muscat',
  'Asia/Baghdad', 'Asia/Amman', 'Asia/Beirut', 'Africa/Cairo', 'Europe/Istanbul', 'Europe/London', 'UTC',
];
function GeneralConfig() {
  const { t } = useTranslation();
  const isAdmin = useSelector((s) => s.auth.user?.role) === 'admin';
  const [tz, setTz] = useState('Asia/Dubai');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try { const { data } = await settingsApi.getGeneralSettings(); setTz(data.timezone || 'Asia/Dubai'); }
      catch { /* ignore */ } finally { setLoading(false); }
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await settingsApi.updateGeneralSettings({ timezone: tz });
      toast.success(t('system_config.timezone_saved', 'Timezone saved'));
    } catch {
      toast.error(t('system_config.timezone_save_failed', 'Failed to save timezone'));
    } finally { setSaving(false); }
  };

  const options = TIMEZONES.includes(tz) ? TIMEZONES : [tz, ...TIMEZONES];
  return (
    <Card className="!p-6 max-w-lg space-y-4">
      <div>
        <h3 className="font-semibold text-surface-800">{t('system_config.timezone', 'Timezone')}</h3>
        <p className="text-sm text-surface-500 mt-1">{t('system_config.timezone_hint', 'The timezone the system uses to display and record dates and times.')}</p>
      </div>
      <Select value={tz} onChange={(e) => setTz(e.target.value)} disabled={!isAdmin || loading}
        options={options.map((z) => ({ value: z, label: z }))} />
      {isAdmin && <Button onClick={save} loading={saving}>{t('common.save', 'Save')}</Button>}
    </Card>
  );
}

// ==============================================
// ATS Stages Configuration
// ==============================================
function AtsStagesConfig() {
  const { t } = useTranslation();
  const isAdmin = useSelector((s) => s.auth.user?.role) === 'admin'; // delete is admin-only
  const [stages, setStages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '', color: '#EDE9FE', text_color: '#5B21B6', is_success: false, is_fail: false,
  });

  useEffect(() => { loadStages(); }, []);

  const loadStages = async () => {
    setLoading(true);
    try {
      const { data } = await settingsApi.getAtsStages();
      setStages(data);
    } catch { toast.error(t('toasts.t_failed_to_load_stages')); }
    finally { setLoading(false); }
  };

  const openAdd = () => {
    setEditing(null);
    setForm({ name: '', color: '#EDE9FE', text_color: '#5B21B6', is_success: false, is_fail: false });
    setModalOpen(true);
  };

  const openEdit = (stage) => {
    setEditing(stage);
    setForm({
      name: stage.name, color: stage.color || '#EDE9FE', text_color: stage.text_color || '#5B21B6',
      is_success: !!stage.is_success, is_fail: !!stage.is_fail,
    });
    setModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name) { toast.error(t('toasts.t_stage_name_is_required')); return; }
    setSaving(true);
    try {
      if (editing) {
        await settingsApi.updateAtsStage(editing.id, form);
        toast.success(t('toasts.t_stage_updated'));
      } else {
        await settingsApi.createAtsStage({ ...form, sort_order: stages.length + 1 });
        toast.success(t('toasts.t_stage_created'));
      }
      setModalOpen(false);
      loadStages();
    } catch (err) { toast.error(t('common.error')); } finally { setSaving(false); }
  };

  const handleDelete = async (stage) => {
    const result = await confirmDelete(`stage "${stage.name}"`);
    if (result.isConfirmed) {
      try { await settingsApi.deleteAtsStage(stage.id); toast.success(t('toasts.t_stage_deleted')); loadStages(); }
      catch (err) { toast.error(t('toasts.t_delete_failed_stage_may_be_in_use')); }
    }
  };

  const moveStage = async (index, direction) => {
    const newStages = [...stages];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newStages.length) return;

    [newStages[index], newStages[targetIndex]] = [newStages[targetIndex], newStages[index]];
    const reordered = newStages.map((s, i) => ({ id: s.id, sort_order: i + 1 }));
    
    setStages(newStages);
    try {
      await settingsApi.reorderAtsStages({ stages: reordered });
    } catch (err) {
      toast.error(t('toasts.t_reorder_failed'));
      loadStages();
    }
  };

  if (loading) {
    return <div className="space-y-2">{[1, 2, 3].map(i => <div key={i} className="card p-4 animate-pulse"><div className="h-4 bg-surface-200 rounded w-1/3" /></div>)}</div>;
  }

  return (
    <>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="font-semibold text-surface-900">{t('system_config.ats_stages')}</h3>
          <p className="text-xs text-surface-400 mt-0.5">Configure the stages candidates move through in your recruitment pipeline</p>
        </div>
        <Button onClick={openAdd}><Plus size={16} /> {t('system_config.add_stage')}</Button>
      </div>

      {stages.length === 0 ? (
        <Card><EmptyState icon="🎯" title="No stages configured" action={<Button onClick={openAdd}><Plus size={16} /> {t('system_config.add_stage')}</Button>} /></Card>
      ) : (
        <div className="space-y-1.5">
          {stages.map((stage, idx) => (
            <Card key={stage.id} className="!p-3 flex items-center gap-3 group">
              <GripVertical size={14} className="text-surface-300" />
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: stage.color }} />
              <span
                className="px-2.5 py-1 rounded-lg text-xs font-semibold"
                style={{ backgroundColor: stage.color, color: stage.text_color }}
              >
                {stage.name}
              </span>
              <div className="flex-1" />
              {stage.is_success && <Badge variant="success" className="text-[10px]">✓ Success</Badge>}
              {stage.is_fail && <Badge variant="danger" className="text-[10px]">✕ Fail</Badge>}
              {stage.is_default && <Badge variant="info" className="text-[10px]">Default</Badge>}
              <span className="text-xs text-surface-400">#{idx + 1}</span>
              <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => moveStage(idx, 'up')} disabled={idx === 0} className="p-1 text-surface-400 hover:text-surface-600 disabled:opacity-30"><ArrowUp size={14} /></button>
                <button onClick={() => moveStage(idx, 'down')} disabled={idx === stages.length - 1} className="p-1 text-surface-400 hover:text-surface-600 disabled:opacity-30"><ArrowDown size={14} /></button>
                <button onClick={() => openEdit(stage)} className="p-1.5 text-surface-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors"><Edit3 size={13} /></button>
                {isAdmin && <button onClick={() => handleDelete(stage)} className="p-1.5 text-surface-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={13} /></button>}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? t('system_config.edit_stage') : t('system_config.add_stage')} size="sm">
        <form onSubmit={handleSave} className="space-y-4">
          <Input label={t('system_config.stage_name')} required placeholder="e.g. Technical Interview" value={form.name} onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))} />
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-surface-700">{t('system_config.stage_color')}</label>
              <div className="flex items-center gap-2">
                <input type="color" value={form.color} onChange={(e) => setForm(p => ({ ...p, color: e.target.value }))} className="w-10 h-10 rounded-xl border-0 cursor-pointer" />
                <span className="px-3 py-1.5 rounded-lg text-xs font-semibold" style={{ backgroundColor: form.color, color: form.text_color }}>Preview</span>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-surface-700">{t('system_config.text_color')}</label>
              <input type="color" value={form.text_color} onChange={(e) => setForm(p => ({ ...p, text_color: e.target.value }))} className="w-10 h-10 rounded-xl border-0 cursor-pointer" />
            </div>
          </div>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.is_success} onChange={(e) => setForm(p => ({ ...p, is_success: e.target.checked, is_fail: false }))}
                className="w-4 h-4 rounded border-surface-300 text-brand-600" />
              <span className="text-sm text-surface-700">{t('system_config.is_success_stage')}</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.is_fail} onChange={(e) => setForm(p => ({ ...p, is_fail: e.target.checked, is_success: false }))}
                className="w-4 h-4 rounded border-surface-300 text-brand-600" />
              <span className="text-sm text-surface-700">{t('system_config.is_fail_stage')}</span>
            </label>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>{t('common.cancel')}</Button>
            <Button type="submit" loading={saving}>{editing ? t('common.save') : t('common.add')}</Button>
          </div>
        </form>
      </Modal>
    </>
  );
}

// ==============================================
// Onboarding / Offboarding Template Config
// ==============================================
function TemplateConfig({ type, companies }) {
  const { t } = useTranslation();
  const isAdmin = useSelector((s) => s.auth.user?.role) === 'admin'; // delete is admin-only
  const [selectedCompany, setSelectedCompany] = useState('');
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ step_number: 1, name: '', owner: '', sla: '', checklist_items: [''] });

  useEffect(() => { if (companies.length > 0 && !selectedCompany) setSelectedCompany(String(companies[0].id)); }, [companies, selectedCompany]);
  useEffect(() => { if (selectedCompany) loadTemplates(); }, [selectedCompany]);

  const isOnboarding = type === 'onboarding';
  const apiGet = isOnboarding ? settingsApi.getOnboardingTemplates : settingsApi.getOffboardingTemplates;
  const apiCreate = isOnboarding ? settingsApi.createOnboardingTemplate : settingsApi.createOffboardingTemplate;
  const apiUpdate = isOnboarding ? settingsApi.updateOnboardingTemplate : settingsApi.updateOffboardingTemplate;
  const apiDelete = isOnboarding ? settingsApi.deleteOnboardingTemplate : settingsApi.deleteOffboardingTemplate;

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const { data } = await apiGet({ company_id: selectedCompany });
      setTemplates(data);
    } catch { toast.error(`Failed to load ${type} templates`); }
    finally { setLoading(false); }
  };

  const openAdd = () => {
    setEditing(null);
    setForm({ step_number: templates.length + 1, name: '', owner: '', sla: '', checklist_items: [''] });
    setModalOpen(true);
  };

  const openEdit = (tpl) => {
    setEditing(tpl);
    setForm({
      step_number: tpl.step_number, name: tpl.name, owner: tpl.owner || '', sla: tpl.sla || '',
      checklist_items: tpl.checklist_items?.length ? tpl.checklist_items.map(i => i.label) : [''],
    });
    setModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name) { toast.error(t('toasts.t_step_name_is_required')); return; }
    setSaving(true);
    try {
      const payload = {
        ...form,
        company_id: parseInt(selectedCompany),
        step_number: parseInt(form.step_number),
        checklist_items: form.checklist_items.filter(i => i.trim()),
      };
      if (editing) {
        await apiUpdate(editing.id, payload);
        toast.success(t('toasts.t_template_step_updated'));
      } else {
        await apiCreate(payload);
        toast.success(t('toasts.t_template_step_created'));
      }
      setModalOpen(false);
      loadTemplates();
    } catch (err) { toast.error(t('common.error')); } finally { setSaving(false); }
  };

  const handleDelete = async (tpl) => {
    const result = await confirmDelete(`step "${tpl.name}"`);
    if (result.isConfirmed) {
      try { await apiDelete(tpl.id); toast.success(t('toasts.t_template_step_deleted')); loadTemplates(); }
      catch (err) { toast.error(t('common.delete_failed')); }
    }
  };

  const addChecklistItem = () => setForm(p => ({ ...p, checklist_items: [...p.checklist_items, ''] }));
  const removeChecklistItem = (idx) => setForm(p => ({ ...p, checklist_items: p.checklist_items.filter((_, i) => i !== idx) }));
  const updateChecklistItem = (idx, val) => setForm(p => ({ ...p, checklist_items: p.checklist_items.map((item, i) => i === idx ? val : item) }));

  return (
    <>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="font-semibold text-surface-900">{isOnboarding ? t('system_config.onboarding') : t('system_config.offboarding')}</h3>
          <p className="text-xs text-surface-400 mt-0.5">Define the workflow steps that are created for each new {isOnboarding ? 'onboarding' : 'offboarding'} record</p>
        </div>
        <div className="flex items-center gap-3">
          <Select
            value={selectedCompany}
            onChange={(e) => setSelectedCompany(e.target.value)}
            options={companies.map(c => ({ value: String(c.id), label: `${c.name} (${c.short_code})` }))}
            className="!w-52"
          />
          <Button onClick={openAdd} disabled={!selectedCompany}><Plus size={16} /> {t('system_config.add_template')}</Button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">{[1, 2].map(i => <div key={i} className="card p-4 animate-pulse"><div className="h-4 bg-surface-200 rounded w-1/3" /></div>)}</div>
      ) : templates.length === 0 ? (
        <Card>
          <EmptyState
            icon={<ListChecks className="w-6 h-6 text-surface-400" />}
            title={`No ${type} templates yet`}
            description={`Define the steps for the ${type} workflow`}
            action={<Button onClick={openAdd}><Plus size={16} /> {t('system_config.add_template')}</Button>}
          />
        </Card>
      ) : (
        <div className="space-y-2">
          {templates.map((tpl) => (
            <Card key={tpl.id} className="!p-4 group">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-brand-50 rounded-xl flex items-center justify-center text-brand-700 font-bold text-sm shrink-0">
                  {tpl.step_number}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold text-surface-900 text-sm">{tpl.name}</h4>
                    {tpl.owner && <Badge variant="info" className="text-[10px]">{tpl.owner}</Badge>}
                    {tpl.sla && <span className="text-[10px] text-surface-400">SLA: {tpl.sla}</span>}
                  </div>
                  {tpl.checklist_items?.length > 0 && (
                    <div className="mt-1.5 space-y-0.5">
                      {tpl.checklist_items.map((item, idx) => (
                        <p key={idx} className="text-xs text-surface-500 flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-surface-300" />
                          {item.label}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(tpl)} title="Edit"><Edit3 size={14} /></Button>
                  {isAdmin && <Button variant="ghost" size="icon" onClick={() => handleDelete(tpl)} className="text-red-500 hover:!bg-red-50" title="Delete"><Trash2 size={14} /></Button>}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? t('system_config.edit_template') : t('system_config.add_template')} size="md">
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-4 gap-4">
            <Input label={t('system_config.step_number')} type="number" required value={form.step_number} onChange={(e) => setForm(p => ({ ...p, step_number: e.target.value }))} />
            <div className="col-span-3">
              <Input label={t('system_config.template_name')} required placeholder="e.g. Document Collection" value={form.name} onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label={t('system_config.owner_role')} placeholder="e.g. HR, IT, Finance" value={form.owner} onChange={(e) => setForm(p => ({ ...p, owner: e.target.value }))} />
            <Input label={t('system_config.sla_days')} placeholder="e.g. 2 days, 1 week" value={form.sla} onChange={(e) => setForm(p => ({ ...p, sla: e.target.value }))} />
          </div>

          {/* Checklist Items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-surface-700">Checklist Items</label>
              <button type="button" onClick={addChecklistItem} className="text-xs text-brand-600 hover:text-brand-700 font-medium">+ Add Item</button>
            </div>
            <div className="space-y-1.5">
              {form.checklist_items.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder={`Checklist item ${idx + 1}`}
                    value={item}
                    onChange={(e) => updateChecklistItem(idx, e.target.value)}
                    className="flex-1 px-3 py-2 text-sm bg-white border border-surface-200 rounded-lg input-focus"
                  />
                  {form.checklist_items.length > 1 && (
                    <button type="button" onClick={() => removeChecklistItem(idx)} className="p-1.5 text-surface-400 hover:text-red-500 transition-colors">
                      <X size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>{t('common.cancel')}</Button>
            <Button type="submit" loading={saving}>{editing ? t('common.save') : t('common.add')}</Button>
          </div>
        </form>
      </Modal>
    </>
  );
}

// ==============================================
// Letter Templates Configuration
// ==============================================
function LetterTemplatesConfig() {
  const { t } = useTranslation();
  const isAdmin = useSelector((s) => s.auth.user?.role) === 'admin'; // delete is admin-only
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', category: 'HR', fields_config: '[]', description: '' });

  const categories = ['HR', 'Legal', 'Finance', 'Operations', 'Management'];

  useEffect(() => { loadTemplates(); }, []);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const { data } = await legalApi.getTemplates();
      setTemplates(data);
    } catch { toast.error(t('toasts.t_failed_to_load_letter_templates')); }
    finally { setLoading(false); }
  };

  const openAdd = () => {
    setEditing(null);
    setForm({ name: '', category: 'HR', fields_config: '[]', description: '' });
    setModalOpen(true);
  };

  const openEdit = (tpl) => {
    setEditing(tpl);
    setForm({
      name: tpl.name || '', category: tpl.category || 'HR',
      fields_config: typeof tpl.fields_config === 'string' ? tpl.fields_config : JSON.stringify(tpl.fields_config || []),
      description: tpl.description || '',
    });
    setModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name) { toast.error(t('toasts.t_template_name_is_required')); return; }
    setSaving(true);
    try {
      const payload = { ...form };
      if (editing) {
        await legalApi.updateTemplate(editing.id, payload);
        toast.success(t('toasts.t_template_updated'));
      } else {
        await legalApi.createTemplate(payload);
        toast.success(t('toasts.t_template_created'));
      }
      setModalOpen(false);
      loadTemplates();
    } catch (err) { toast.error(t('common.error')); } finally { setSaving(false); }
  };

  const handleDelete = async (tpl) => {
    const result = await confirmDelete(`template "${tpl.name}"`);
    if (result.isConfirmed) {
      try { await legalApi.deleteTemplate(tpl.id); toast.success(t('toasts.t_template_deleted')); loadTemplates(); }
      catch { toast.error(t('common.delete_failed')); }
    }
  };

  if (loading) {
    return <div className="space-y-2">{[1, 2].map(i => <div key={i} className="card p-4 animate-pulse"><div className="h-4 bg-surface-200 rounded w-1/3" /></div>)}</div>;
  }

  return (
    <>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="font-semibold text-surface-900">{t('system_config.letters')}</h3>
          <p className="text-xs text-surface-400 mt-0.5">Configure letter types available for AI-powered generation</p>
        </div>
        <Button onClick={openAdd}><Plus size={16} /> {t('system_config.add_template')}</Button>
      </div>

      {templates.length === 0 ? (
        <Card><EmptyState icon={<FileText className="w-6 h-6 text-surface-400" />} title="No letter templates" description="Create templates for generating professional HR letters" action={<Button onClick={openAdd}><Plus size={16} /> {t('system_config.add_template')}</Button>} /></Card>
      ) : (
        <div className="space-y-1.5">
          {templates.map((tpl) => {
            let fieldCount = 0;
            try { fieldCount = JSON.parse(tpl.fields_config || '[]').length; } catch {}
            return (
              <Card key={tpl.id} className="!p-3 flex items-center gap-3 group">
                <FileText size={16} className="text-brand-500" />
                <span className="font-medium text-sm text-surface-900">{tpl.name}</span>
                <Badge variant="info" className="text-[10px]">{tpl.category}</Badge>
                {fieldCount > 0 && <span className="text-xs text-surface-400">{fieldCount} fields</span>}
                {tpl.description && <span className="text-xs text-surface-400 truncate max-w-48">— {tpl.description}</span>}
                <div className="flex-1" />
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => openEdit(tpl)} className="p-1.5 text-surface-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors"><Edit3 size={13} /></button>
                  {isAdmin && <button onClick={() => handleDelete(tpl)} className="p-1.5 text-surface-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={13} /></button>}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? t('system_config.edit_template') : t('system_config.add_template')} size="md">
        <form onSubmit={handleSave} className="space-y-4">
          <Input label={t('system_config.template_name')} required placeholder="e.g. Salary Certificate" value={form.name} onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))} />
          <Select label="Category" value={form.category} onChange={(e) => setForm(p => ({ ...p, category: e.target.value }))} options={categories} />
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1.5">{t('system_config.description')}</label>
            <textarea placeholder="..." value={form.description} onChange={(e) => setForm(p => ({ ...p, description: e.target.value }))} rows={2}
              className="w-full px-3 py-2.5 text-sm bg-white border border-surface-200 rounded-xl input-focus transition-all resize-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1.5">Fields Config (JSON)</label>
            <textarea placeholder='[{"key":"employee_name","label":"Employee Name","type":"text"}]' value={form.fields_config} onChange={(e) => setForm(p => ({ ...p, fields_config: e.target.value }))} rows={3}
              className="w-full px-3 py-2.5 text-xs font-mono bg-white border border-surface-200 rounded-xl input-focus transition-all resize-none" />
            <p className="text-[10px] text-surface-400 mt-1">JSON array of field definitions with key, label, and type</p>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>{t('common.cancel')}</Button>
            <Button type="submit" loading={saving}>{editing ? t('common.save') : t('common.add')}</Button>
          </div>
        </form>
      </Modal>
    </>
  );
}

// ==============================================
// KPI Tiers Configuration
// ==============================================
function KpiTiersConfig() {
  const { t } = useTranslation();
  const [tiers, setTiers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ tier_name: '', min_hires: 0, max_hires: 0, commission_per_hire: 0 });

  useEffect(() => { loadTiers(); }, []);

  const loadTiers = async () => {
    setLoading(true);
    try {
      const { data } = await kpiApi.getTiers();
      setTiers(data);
    } catch { toast.error(t('toasts.t_failed_to_load_kpi_tiers')); }
    finally { setLoading(false); }
  };

  const openAdd = () => {
    setForm({ tier_name: '', min_hires: 0, max_hires: 0, commission_per_hire: 0 });
    setModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.tier_name) { toast.error(t('toasts.t_tier_name_is_required')); return; }
    setSaving(true);
    try {
      await kpiApi.createTier({
        ...form,
        min_hires: parseInt(form.min_hires),
        max_hires: parseInt(form.max_hires),
        commission_per_hire: parseFloat(form.commission_per_hire),
      });
      toast.success(t('toasts.t_tier_created'));
      setModalOpen(false);
      loadTiers();
    } catch (err) { toast.error(t('common.error')); } finally { setSaving(false); }
  };

  if (loading) {
    return <div className="space-y-2">{[1, 2].map(i => <div key={i} className="card p-4 animate-pulse"><div className="h-4 bg-surface-200 rounded w-1/3" /></div>)}</div>;
  }

  return (
    <>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="font-semibold text-surface-900">{t('system_config.kpi_tiers')}</h3>
          <p className="text-xs text-surface-400 mt-0.5">Define commission tiers based on number of successful hires</p>
        </div>
        <Button onClick={openAdd}><Plus size={16} /> {t('system_config.add_tier')}</Button>
      </div>

      {tiers.length === 0 ? (
        <Card><EmptyState icon={<DollarSign className="w-6 h-6 text-surface-400" />} title="No KPI tiers configured" description="Set up commission tiers for recruiters" action={<Button onClick={openAdd}><Plus size={16} /> {t('system_config.add_tier')}</Button>} /></Card>
      ) : (
        <div className="space-y-1.5">
          {tiers.map((tier) => (
            <Card key={tier.id} className="!p-4 flex items-center gap-4 group">
              <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center">
                <DollarSign size={18} className="text-amber-600" />
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-sm text-surface-900">{tier.tier_name}</h4>
                <p className="text-xs text-surface-500">
                  {tier.min_hires}–{tier.max_hires} hires · <span className="text-emerald-600 font-medium">{Number(tier.commission_per_hire).toLocaleString()} per hire</span>
                </p>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={t('system_config.add_tier')} size="sm">
        <form onSubmit={handleSave} className="space-y-4">
          <Input label={t('system_config.tier_name')} required placeholder="e.g. Bronze, Silver, Gold" value={form.tier_name} onChange={(e) => setForm(p => ({ ...p, tier_name: e.target.value }))} />
          <div className="grid grid-cols-2 gap-4">
            <Input label={t('system_config.min_hires')} type="number" min="0" value={form.min_hires} onChange={(e) => setForm(p => ({ ...p, min_hires: e.target.value }))} />
            <Input label={t('system_config.max_hires')} type="number" min="0" value={form.max_hires} onChange={(e) => setForm(p => ({ ...p, max_hires: e.target.value }))} />
          </div>
          <Input label={t('system_config.commission_per_hire')} type="number" min="0" step="0.01" placeholder="e.g. 500" value={form.commission_per_hire} onChange={(e) => setForm(p => ({ ...p, commission_per_hire: e.target.value }))} />
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>{t('common.cancel')}</Button>
            <Button type="submit" loading={saving}>{t('common.add')}</Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
