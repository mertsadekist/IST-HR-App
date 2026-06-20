import { useState, useEffect, useCallback, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchCompanies } from '@store/slices/companiesSlice';
import * as companiesApi from '@api/companiesApi';
import Card from '@components/ui/Card';
import Button from '@components/ui/Button';
import Badge from '@components/ui/Badge';
import Modal from '@components/ui/Modal';
import Input from '@components/ui/Input';
import Select from '@components/ui/Select';
import EmptyState from '@components/ui/EmptyState';
import { confirmDelete } from '@utils/confirm';
import { toast } from 'react-toastify';
import { Plus, Edit3, Trash2, Building2, Globe, Phone, Mail, Upload, Image } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const currencies = ['AED', 'USD', 'EUR', 'GBP', 'SAR', 'QAR', 'BHD', 'KWD', 'OMR', 'EGP', 'INR'];
const industries = ['Real Estate', 'Finance', 'Technology', 'Healthcare', 'Hospitality', 'Education', 'Retail', 'Construction', 'Consulting', 'Other'];

export default function CompanySettings() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const { items: companies, loading } = useSelector((s) => s.companies);
  const { user } = useSelector((s) => s.auth);
  const isAdmin = user?.role === 'admin'; // only admin may add/edit/delete companies
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm());
  // Letterhead state (admin only; per-company A4 background)
  const [lhMargins, setLhMargins] = useState({ top: 50, bottom: 40, left: 18, right: 18 });
  const [lhBusy, setLhBusy] = useState(false);
  const lhInputRef = useRef(null);

  function emptyForm() {
    return {
      name: '', short_code: '', currency: 'AED', address: '', phone: '',
      email: '', website: '', industry: '', crm_platform: '',
      color_primary: '#6D28D9', color_secondary: '#1D1245', status: 'Active',
      logo: '',
    };
  }

  useEffect(() => { dispatch(fetchCompanies()); }, [dispatch]);

  const openAdd = () => { setEditing(null); setForm(emptyForm()); setModalOpen(true); };
  const openEdit = (company) => {
    setEditing(company);
    setForm({
      name: company.name || '', short_code: company.short_code || '',
      currency: company.currency || 'AED', address: company.address || '',
      phone: company.phone || '', email: company.email || '',
      website: company.website || '', industry: company.industry || '',
      crm_platform: company.crm_platform || '',
      color_primary: company.color_primary || '#6D28D9',
      color_secondary: company.color_secondary || '#1D1245',
      status: company.status || 'Active',
      logo: company.logo || '',
    });
    try {
      setLhMargins(company.letterhead_margins ? JSON.parse(company.letterhead_margins) : { top: 50, bottom: 40, left: 18, right: 18 });
    } catch { setLhMargins({ top: 50, bottom: 40, left: 18, right: 18 }); }
    setModalOpen(true);
  };

  // Re-fetch the company being edited (after a letterhead change) and refresh list.
  const refreshEditing = async () => {
    if (!editing) return;
    try {
      const res = await companiesApi.getCompany(editing.id);
      setEditing(res.data);
    } catch { /* ignore */ }
    dispatch(fetchCompanies());
  };

  const handleLhUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !editing) return;
    setLhBusy(true);
    const fd = new FormData();
    fd.append('file', file);
    try {
      await companiesApi.uploadLetterhead(editing.id, fd);
      toast.success(t('toasts.t_letterhead_uploaded'));
      await refreshEditing();
    } catch (err) { toast.error(err.response?.data?.error || 'Upload failed'); }
    finally { setLhBusy(false); if (lhInputRef.current) lhInputRef.current.value = ''; }
  };

  const handleLhMargins = async () => {
    if (!editing) return;
    setLhBusy(true);
    try { await companiesApi.saveLetterheadMargins(editing.id, lhMargins); toast.success(t('toasts.t_margins_saved')); dispatch(fetchCompanies()); }
    catch { toast.error(t('toasts.t_failed_to_save_margins')); }
    finally { setLhBusy(false); }
  };

  const handleLhRemove = async () => {
    if (!editing) return;
    setLhBusy(true);
    try { await companiesApi.deleteLetterhead(editing.id); toast.success(t('toasts.t_letterhead_removed')); await refreshEditing(); }
    catch { toast.error(t('toasts.t_failed_to_remove_letterhead')); }
    finally { setLhBusy(false); }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name || !form.short_code || !form.currency) {
      toast.error(t('toasts.t_name_short_code_and_currency_are_required'));
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await companiesApi.updateCompany(editing.id, form);
        toast.success(t('toasts.t_company_updated'));
      } else {
        await companiesApi.createCompany(form);
        toast.success(t('toasts.t_company_created'));
      }
      setModalOpen(false);
      dispatch(fetchCompanies());
    } catch (err) {
      toast.error(err.response?.data?.error || 'Operation failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (company) => {
    const result = await confirmDelete(`"${company.name}"`);
    if (result.isConfirmed) {
      try {
        await companiesApi.deleteCompany(company.id);
        toast.success(t('toasts.t_company_deleted'));
        dispatch(fetchCompanies());
      } catch (err) {
        toast.error(err.response?.data?.error || 'Delete failed');
      }
    }
  };

  const update = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="card p-6 animate-pulse">
            <div className="h-4 bg-surface-200 rounded w-3/4 mb-3" />
            <div className="h-3 bg-surface-100 rounded w-1/2 mb-2" />
            <div className="h-3 bg-surface-100 rounded w-1/3" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-surface-500">{t('company_settings.configured', { count: companies.length })}</p>
        {isAdmin && <Button onClick={openAdd}><Plus size={16} /> {t('company_settings.add_company')}</Button>}
      </div>

      {/* Company Cards */}
      {companies.length === 0 ? (
        <Card>
          <EmptyState
            icon="🏢"
            title={t('company_settings.no_companies')}
            description={t('company_settings.start_creating')}
            action={isAdmin ? <Button onClick={openAdd}><Plus size={16} /> {t('company_settings.add_company')}</Button> : null}
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {companies.map((company) => (
            <Card key={company.id} hover className="!p-0 overflow-hidden">
              {/* Color header bar */}
              <div className="h-2" style={{ background: `linear-gradient(90deg, ${company.color_primary || '#6D28D9'}, ${company.color_secondary || '#1D1245'})` }} />
              <div className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    {company.logo ? (
                      <img src={company.logo} alt="" className="w-10 h-10 rounded-xl object-cover shadow-sm" />
                    ) : (
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-sm"
                        style={{ backgroundColor: company.color_primary || '#6D28D9' }}
                      >
                        {company.short_code?.substring(0, 2)}
                      </div>
                    )}
                    <div>
                      <h3 className="font-semibold text-surface-900">{company.name}</h3>
                      <p className="text-xs text-surface-400">{t('company_settings.code')}: {company.short_code}</p>
                    </div>
                  </div>
                  <Badge variant={company.status === 'Active' ? 'active' : 'inactive'} dot>
                    {company.status}
                  </Badge>
                </div>

                <div className="space-y-1.5 text-sm text-surface-500 mb-4">
                  <p className="flex items-center gap-2">
                    <span className="text-xs bg-surface-100 px-2 py-0.5 rounded-md font-medium">{company.currency}</span>
                    {company.industry && <span className="text-xs">· {company.industry}</span>}
                  </p>
                  {company.email && (
                    <p className="flex items-center gap-1.5 text-xs"><Mail size={12} /> {company.email}</p>
                  )}
                  {company.phone && (
                    <p className="flex items-center gap-1.5 text-xs"><Phone size={12} /> {company.phone}</p>
                  )}
                </div>

                {isAdmin && (
                  <div className="flex gap-2">
                    <Button variant="secondary" size="sm" onClick={() => openEdit(company)} className="flex-1">
                      <Edit3 size={14} /> {t('common.edit')}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(company)} className="text-red-500 hover:!bg-red-50">
                      <Trash2 size={14} />
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          ))}

          {/* Add Card */}
          {isAdmin && (
          <button
            onClick={openAdd}
            className="card border-2 border-dashed border-surface-200 hover:border-brand-300 hover:bg-brand-50/30 transition-all p-6 flex flex-col items-center justify-center gap-2 min-h-[200px] cursor-pointer group"
          >
            <div className="w-12 h-12 rounded-2xl bg-brand-50 flex items-center justify-center group-hover:bg-brand-100 transition-colors">
              <Plus className="text-brand-600" size={24} />
            </div>
            <p className="text-sm font-medium text-surface-500 group-hover:text-brand-600">{t('company_settings.add_company')}</p>
          </button>
          )}
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? t('company_settings.edit_company') : t('company_settings.add_company')}
        size="lg"
      >
        <form onSubmit={handleSave} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label={t('company_settings.company_name')}
              placeholder="e.g. My Real Estate Company"
              required
              value={form.name}
              onChange={(e) => update('name', e.target.value)}
            />
            <Input
              label={t('company_settings.short_code')}
              placeholder="e.g. RE"
              required
              maxLength={10}
              value={form.short_code}
              onChange={(e) => update('short_code', e.target.value.toUpperCase())}
            />
            <Select
              label={t('company_settings.currency')}
              required
              value={form.currency}
              onChange={(e) => update('currency', e.target.value)}
              options={currencies}
            />
            <Select
              label={t('company_settings.industry')}
              value={form.industry}
              onChange={(e) => update('industry', e.target.value)}
              options={industries}
              placeholder="Select industry..."
            />
            <Input
              label={t('company_settings.email')}
              type="email"
              placeholder="company@domain.com"
              value={form.email}
              onChange={(e) => update('email', e.target.value)}
            />
            <Input
              label={t('company_settings.phone')}
              placeholder="+971 4 xxx xxxx"
              value={form.phone}
              onChange={(e) => update('phone', e.target.value)}
            />
            <Input
              label={t('company_settings.website')}
              placeholder="https://..."
              value={form.website}
              onChange={(e) => update('website', e.target.value)}
            />
            <Input
              label={t('company_settings.crm_platform')}
              placeholder="e.g. Bitrix, Skale..."
              value={form.crm_platform}
              onChange={(e) => update('crm_platform', e.target.value)}
            />
          </div>

          {/* Logo Upload */}
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1.5">{t('company_settings.company_logo')}</label>
            <div className="flex items-center gap-4">
              {form.logo ? (
                <img src={form.logo} alt="Logo" className="w-14 h-14 rounded-xl object-cover border border-surface-200" />
              ) : (
                <div className="w-14 h-14 rounded-xl bg-surface-100 flex items-center justify-center">
                  <Image className="text-surface-400" size={20} />
                </div>
              )}
              <div className="flex-1">
                <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-surface-100 hover:bg-surface-200 rounded-xl text-sm font-medium text-surface-700 transition-colors">
                  <Upload size={14} />
                  {form.logo ? t('company_settings.change_logo') : t('company_settings.upload_logo')}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files[0];
                      if (file) {
                        if (file.size > 2 * 1024 * 1024) {
                          toast.error(t('toasts.t_logo_must_be_under_2mb'));
                          return;
                        }
                        const reader = new FileReader();
                        reader.onload = (ev) => update('logo', ev.target.result);
                        reader.readAsDataURL(file);
                      }
                    }}
                  />
                </label>
                {form.logo && (
                  <button type="button" onClick={() => update('logo', '')} className="ml-2 text-xs text-red-500 hover:text-red-700">{t('company_settings.remove')}</button>
                )}
                <p className="text-[10px] text-surface-400 mt-1">{t('company_settings.logo_requirements')}</p>
              </div>
            </div>
          </div>

          <div className="col-span-2">
            <label className="block text-sm font-medium text-surface-700 mb-1.5">{t('company_settings.address')}</label>
            <textarea
              placeholder="..."
              value={form.address}
              onChange={(e) => update('address', e.target.value)}
              rows={2}
              className="w-full px-3 py-2.5 text-sm bg-white border border-surface-200 rounded-xl input-focus transition-all resize-none"
            />
          </div>

          {/* Brand colors */}
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium text-surface-700">{t('company_settings.brand_color')}</label>
              <input
                type="color"
                value={form.color_primary}
                onChange={(e) => update('color_primary', e.target.value)}
                className="w-8 h-8 rounded-lg border-0 cursor-pointer"
              />
            </div>
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium text-surface-700">{t('company_settings.secondary')}</label>
              <input
                type="color"
                value={form.color_secondary}
                onChange={(e) => update('color_secondary', e.target.value)}
                className="w-8 h-8 rounded-lg border-0 cursor-pointer"
              />
            </div>
            <div className="flex-1" />
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-surface-700">{t('company_settings.status')}</label>
              <button
                type="button"
                onClick={() => update('status', form.status === 'Active' ? 'Inactive' : 'Active')}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  form.status === 'Active' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'
                }`}
              >
                {form.status}
              </button>
            </div>
          </div>

          {/* Preview */}
          <div className="p-3 bg-surface-50 rounded-xl flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-xs"
              style={{ backgroundColor: form.color_primary }}
            >
              {form.short_code?.substring(0, 2) || '??'}
            </div>
            <div>
              <p className="text-sm font-medium text-surface-900">{form.name || 'Company Name'}</p>
              <p className="text-xs text-surface-400">{form.short_code || 'CODE'} · {form.currency} · {form.industry || 'Industry'}</p>
            </div>
          </div>

          {/* Letterhead (A4 background for generated documents) — existing company only */}
          {editing && (
            <div className="border-t border-surface-100 pt-4">
              <label className="block text-sm font-medium text-surface-700 mb-2">{t('company_settings.letterhead', 'Letterhead (A4 background for documents)')}</label>
              {editing.letterhead_path ? (
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-xs px-2 py-1 rounded bg-emerald-50 text-emerald-700 font-medium">✓ {t('company_settings.letterhead_set', 'Letterhead set')} ({String(editing.letterhead_type || '').toUpperCase()})</span>
                  <button type="button" onClick={handleLhRemove} className="text-xs text-red-500 hover:text-red-700">{t('company_settings.remove', 'Remove')}</button>
                </div>
              ) : (
                <p className="text-xs text-surface-400 mb-3">{t('company_settings.no_letterhead', 'No letterhead uploaded yet.')}</p>
              )}
              <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-surface-100 hover:bg-surface-200 rounded-xl text-sm font-medium text-surface-700">
                <Upload size={14} />
                {editing.letterhead_path ? t('company_settings.replace_letterhead', 'Replace letterhead') : t('company_settings.upload_letterhead', 'Upload letterhead')} (PDF / PNG / JPG)
                <input type="file" ref={lhInputRef} accept=".pdf,.png,.jpg,.jpeg" className="hidden" onChange={handleLhUpload} />
              </label>

              <div className="grid grid-cols-4 gap-2 mt-3">
                {['top', 'bottom', 'left', 'right'].map((k) => (
                  <div key={k}>
                    <label className="block text-[10px] text-surface-500 uppercase mb-1">{k} (mm)</label>
                    <input type="number" min="0" max="200" value={lhMargins[k]}
                      onChange={(e) => setLhMargins((p) => ({ ...p, [k]: Number(e.target.value) }))}
                      className="w-full px-2 py-1.5 text-sm bg-white border border-surface-200 rounded-lg" />
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-surface-400 mt-1">{t('company_settings.letterhead_hint', 'Content margins keep the letterhead header/footer clear. Save margins, then use “Send by Email (PDF)” on a letter to preview and fine-tune.')}</p>
              <Button type="button" size="sm" variant="secondary" className="mt-2" onClick={handleLhMargins} loading={lhBusy}>{t('company_settings.save_margins', 'Save margins')}</Button>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" loading={saving}>
              {editing ? t('common.save') : t('common.add')}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
